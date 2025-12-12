const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { openDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

async function register(req, res) {
    const { email, password, name, orgName } = req.body;

    if (!email || !password || !name || !orgName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const db = await openDb();

    try {
        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const userId = Math.random().toString(36).substr(2, 9);
        const orgId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Transaction-like operations
        await db.run('BEGIN TRANSACTION');

        // Create User
        await db.run(
            'INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)',
            [userId, email, hashedPassword, name, now]
        );

        // Create Organization
        await db.run(
            'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)',
            [orgId, orgName, now]
        );

        // Link User to Organization
        await db.run(
            'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
            [userId, orgId, 'admin']
        );

        await db.run('COMMIT');

        // Auto-login (generate token)
        const token = jwt.sign({ sub: userId, email, orgId }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(201).json({ message: 'Registered successfully', user: { id: userId, name, email, orgId } });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await openDb();

    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get user's organization (assuming single org for now)
        const userOrg = await db.get('SELECT organizationId FROM user_organizations WHERE userId = ?', [user.id]);

        if (!userOrg) {
            return res.status(403).json({ error: 'User does not belong to an organization' });
        }

        const token = jwt.sign({ sub: user.id, email: user.email, orgId: userOrg.organizationId }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ message: 'Logged in', user: { id: user.id, name: user.name, email: user.email, orgId: userOrg.organizationId } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}

function logout(req, res) {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out' });
}

function authenticateToken(req, res, next) {
    const token = req.cookies['auth_token'];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.user = user;
        next();
    });
}

async function getMe(req, res) {
    // req.user is populated by authenticateToken
    const db = await openDb();
    try {
        const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.sub]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ user: { ...user, orgId: req.user.orgId } });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}

async function getOrganizations(req, res) {
    // req.user is populated by authenticateToken
    const db = await openDb();
    try {
        const orgs = await db.all(`
            SELECT o.id, o.name, uo.role 
            FROM organizations o
            JOIN user_organizations uo ON o.id = uo.organizationId
            WHERE uo.userId = ?
        `, [req.user.sub]);

        res.json(orgs);
    } catch (error) {
        console.error('GetOrganizations error:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
}

async function switchOrganization(req, res) {
    const { orgId } = req.body;
    const userId = req.user.sub; // From current valid token

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    const db = await openDb();

    try {
        // Verify user belongs to the target organization
        const membership = await db.get(
            'SELECT role FROM user_organizations WHERE userId = ? AND organizationId = ?',
            [userId, orgId]
        );

        if (!membership) {
            return res.status(403).json({ error: 'User does not belong to this organization' });
        }

        // Generate new token with updated orgId
        const token = jwt.sign({ sub: userId, email: req.user.email, orgId }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ message: 'Switched organization', orgId });

    } catch (error) {
        console.error('SwitchOrganization error:', error);
        res.status(500).json({ error: 'Failed to switch organization' });
    }
}

async function getOrganizationUsers(req, res) {
    const db = await openDb();
    try {
        const users = await db.all(`
            SELECT u.id, u.name, u.email, uo.role, uo.organizationId
            FROM users u
            JOIN user_organizations uo ON u.id = uo.userId
            WHERE uo.organizationId = ?
        `, [req.user.orgId]);

        res.json(users);
    } catch (error) {
        console.error('GetOrganizationUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch organization users' });
    }
}

async function inviteUser(req, res) {
    const { email } = req.body;
    const orgId = req.user.orgId;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const db = await openDb();

    try {
        // Check if user exists
        const user = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (user) {
            // Check if already in org
            const existingMember = await db.get(
                'SELECT * FROM user_organizations WHERE userId = ? AND organizationId = ?',
                [user.id, orgId]
            );

            if (existingMember) {
                return res.status(400).json({ error: 'User is already a member of this organization' });
            }

            // Add to org
            await db.run(
                'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
                [user.id, orgId, 'member']
            );

            res.json({ message: 'User added to organization', added: true });
        } else {
            // Mock invite for non-existing user
            // In a real app, this would send an email and create a pending invite record
            res.json({ message: 'Invitation email sent', added: false });
        }

    } catch (error) {
        console.error('InviteUser error:', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
}

module.exports = { register, login, logout, authenticateToken, getMe, getOrganizations, switchOrganization, getOrganizationUsers, inviteUser };
