const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const { openDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Cookie configuration based on environment
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PRODUCTION, // true in production (HTTPS), false in development
    sameSite: IS_PRODUCTION ? 'none' : 'lax', // 'none' needed for cross-site cookies with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

// Initialize Resend - API key should be in environment variable
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Intemic <onboarding@resend.dev>';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// App URL for verification links
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function register(req, res) {
    const { email, password, name, orgName } = req.body;

    if (!email || !password || !name || !orgName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const db = await openDb();

    try {
        // Check if user exists
        const existingUser = await db.get('SELECT id, emailVerified FROM users WHERE email = ?', [email]);
        if (existingUser) {
            // If user exists but email not verified, allow re-sending verification
            if (!existingUser.emailVerified) {
                return res.status(400).json({ error: 'User already exists. Please check your email for verification link.' });
            }
            return res.status(400).json({ error: 'User already exists' });
        }

        const userId = Math.random().toString(36).substr(2, 9);
        const orgId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Transaction-like operations
        await db.run('BEGIN TRANSACTION');

        // Create User (emailVerified = 0 by default)
        await db.run(
            'INSERT INTO users (id, email, password, name, createdAt, emailVerified, verificationToken) VALUES (?, ?, ?, ?, ?, 0, ?)',
            [userId, email, hashedPassword, name, now, verificationToken]
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

        // Send verification email
        const verificationUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
        
        try {
            if (!resend) {
                console.warn('[Auth] RESEND_API_KEY missing, skipping verification email');
            } else {
                const sendResult = await resend.emails.send({
                    from: RESEND_FROM,
                    to: email,
                    subject: 'Verify your email - Intemic',
                    html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <div style="text-align: center; margin-bottom: 40px;">
                            <h1 style="color: #1F5F68; margin: 0;">Welcome to Intemic!</h1>
                        </div>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Hi ${name},
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Thanks for signing up! Please verify your email address by clicking the button below:
                        </p>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${verificationUrl}" 
                               style="background-color: #1F5F68; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                                Verify Email Address
                            </a>
                        </div>
                        
                        <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                            Or copy and paste this link in your browser:<br>
                            <a href="${verificationUrl}" style="color: #1F5F68; word-break: break-all;">${verificationUrl}</a>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 40px 0;">
                        
                        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                            If you didn't create an account with Intemic, you can safely ignore this email.
                        </p>
                    </div>
                    `
                });
                console.log(`[Auth] Verification email sent to ${email}`);
                console.log('[Auth] Resend send result:', sendResult);
            }
        } catch (emailError) {
            console.error('[Auth] Failed to send verification email:', emailError);
            // Don't fail registration if email fails - user can request resend
        }

        // Don't auto-login - user must verify email first
        res.status(201).json({ 
            message: 'Registration successful! Please check your email to verify your account.',
            requiresVerification: true 
        });

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

        // Check if email is verified (allow bypass for specific local user)
        if (!user.emailVerified && user.email !== 'm.alcazar@intemic.com') {
            return res.status(403).json({ 
                error: 'Please verify your email before logging in. Check your inbox for the verification link.',
                requiresVerification: true,
                email: user.email
            });
        }

        // Get user's organization (assuming single org for now)
        const userOrg = await db.get('SELECT organizationId FROM user_organizations WHERE userId = ?', [user.id]);

        if (!userOrg) {
            return res.status(403).json({ error: 'User does not belong to an organization' });
        }

        const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, orgId: userOrg.organizationId, isAdmin: !!user.isAdmin }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('auth_token', token, COOKIE_OPTIONS);

        // Log login activity
        try {
            const logId = Math.random().toString(36).substr(2, 9);
            await db.run(
                `INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, ipAddress, userAgent, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [logId, userOrg.organizationId, user.id, user.name, user.email, 'login', 'user', user.id, user.name, 
                 req.ip || req.headers['x-forwarded-for'], req.headers['user-agent'], new Date().toISOString()]
            );
        } catch (logErr) {
            console.error('Error logging login:', logErr);
        }

        res.json({ message: 'Logged in', user: { id: user.id, name: user.name, email: user.email, orgId: userOrg.organizationId, profilePhoto: user.profilePhoto, companyRole: user.companyRole, locale: user.locale || 'es', isAdmin: !!user.isAdmin, onboardingCompleted: !!user.onboardingCompleted } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}

function logout(req, res) {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: IS_PRODUCTION ? 'none' : 'lax'
    });
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
        // Add 'id' as alias for 'sub' for backwards compatibility
        req.user = { ...user, id: user.sub };
        next();
    });
}

async function getMe(req, res) {
    // req.user is populated by authenticateToken
    const db = await openDb();
    try {
        const user = await db.get('SELECT id, name, email, profilePhoto, companyRole, locale, isAdmin, onboardingCompleted FROM users WHERE id = ?', [req.user.sub]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ user: { ...user, orgId: req.user.orgId, isAdmin: !!user.isAdmin, onboardingCompleted: !!user.onboardingCompleted } });
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
            SELECT o.id, o.name, o.logo, uo.role 
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

        // Get user's admin status and name to preserve in the new token
        const user = await db.get('SELECT isAdmin, name FROM users WHERE id = ?', [userId]);

        // Generate new token with updated orgId and preserve isAdmin
        const token = jwt.sign({ 
            sub: userId, 
            email: req.user.email, 
            name: user?.name || req.user.name,
            orgId, 
            isAdmin: !!user?.isAdmin 
        }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('auth_token', token, COOKIE_OPTIONS);

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
            SELECT u.id, u.name, u.email, u.profilePhoto, u.companyRole, uo.role, uo.organizationId
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
    const inviterId = req.user.sub;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const db = await openDb();

    try {
        // Get inviter info and organization name
        const inviter = await db.get('SELECT name FROM users WHERE id = ?', [inviterId]);
        const org = await db.get('SELECT name FROM organizations WHERE id = ?', [orgId]);

        // Check if user already exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existingUser) {
            // Check if already in org
            const existingMember = await db.get(
                'SELECT * FROM user_organizations WHERE userId = ? AND organizationId = ?',
                [existingUser.id, orgId]
            );

            if (existingMember) {
                return res.status(400).json({ error: 'User is already a member of this organization' });
            }

            // Add existing user to org directly
            await db.run(
                'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
                [existingUser.id, orgId, 'member']
            );

            return res.json({ message: 'User added to organization', added: true });
        }

        // Check if there's already a pending invitation for this email to this org
        const existingInvite = await db.get(
            'SELECT id FROM pending_invitations WHERE email = ? AND organizationId = ? AND status = ?',
            [email, orgId, 'pending']
        );

        if (existingInvite) {
            return res.status(400).json({ error: 'An invitation has already been sent to this email' });
        }

        // Create invitation token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Save invitation to database
        await db.run(
            'INSERT INTO pending_invitations (id, email, organizationId, invitedBy, invitedByName, token, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [inviteId, email, orgId, inviterId, inviter?.name || 'A team member', inviteToken, 'pending', now]
        );

        // Send invitation email
        const inviteUrl = `${APP_URL}/invite?token=${inviteToken}`;
        let emailSent = false;
        let emailError = null;
        
        console.log(`[Auth] Preparing invitation email for ${email}`);
        console.log(`[Auth] Invite URL: ${inviteUrl}`);
        console.log(`[Auth] Resend configured: ${!!resend}, From: ${RESEND_FROM}`);
        
        try {
            if (!resend) {
                console.warn('[Auth] RESEND_API_KEY missing - invitation saved but email NOT sent');
                console.warn('[Auth] To enable email sending, set RESEND_API_KEY in your environment variables');
            } else {
                const sendResult = await resend.emails.send({
                    from: RESEND_FROM,
                    to: email,
                    subject: `You've been invited to join ${org?.name || 'a team'} on Intemic`,
                    html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <div style="text-align: center; margin-bottom: 40px;">
                            <h1 style="color: #1F5F68; margin: 0;">You're Invited!</h1>
                        </div>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Hi there,
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            <strong>${inviter?.name || 'A team member'}</strong> has invited you to join 
                            <strong>${org?.name || 'their organization'}</strong> on Intemic.
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Click the button below to create your account and join the team:
                        </p>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${inviteUrl}" 
                               style="background-color: #1F5F68; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                                Accept Invitation
                            </a>
                        </div>
                        
                        <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                            Or copy and paste this link in your browser:<br>
                            <a href="${inviteUrl}" style="color: #1F5F68; word-break: break-all;">${inviteUrl}</a>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 40px 0;">
                        
                        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                            If you didn't expect this invitation, you can safely ignore this email.
                        </p>
                    </div>
                    `
                });
                console.log(`[Auth] Invitation email sent to ${email} for org ${org?.name}`);
                console.log('[Auth] Resend send result:', JSON.stringify(sendResult, null, 2));
                
                if (sendResult?.data?.id) {
                    emailSent = true;
                } else if (sendResult?.error) {
                    emailError = sendResult.error.message || 'Unknown Resend error';
                    console.error('[Auth] Resend returned error:', sendResult.error);
                }
            }
        } catch (err) {
            emailError = err.message;
            console.error('[Auth] Failed to send invitation email:', err);
            // Don't fail the invitation if email fails - invitation is still saved
        }

        // Log invite activity
        try {
            const logId = Math.random().toString(36).substr(2, 9);
            await db.run(
                `INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, details, ipAddress, userAgent, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [logId, orgId, inviterId, inviter?.name, req.user.email, 'invite', 'user', inviteId, email, 
                 JSON.stringify({ organizationName: org?.name, emailSent, emailError }), req.ip || req.headers['x-forwarded-for'], req.headers['user-agent'], new Date().toISOString()]
            );
        } catch (logErr) {
            console.error('Error logging invite:', logErr);
        }

        // Return appropriate message based on email status
        if (!resend) {
            res.json({ 
                message: 'Invitation created but email service not configured. Please configure RESEND_API_KEY.', 
                added: false,
                emailSent: false,
                inviteUrl // Include URL for manual sharing in development
            });
        } else if (emailSent) {
            res.json({ message: 'Invitation email sent', added: false, emailSent: true });
        } else {
            res.json({ 
                message: `Invitation created but email failed to send: ${emailError || 'Unknown error'}`, 
                added: false,
                emailSent: false,
                inviteUrl // Include URL for manual sharing as fallback
            });
        }

    } catch (error) {
        console.error('InviteUser error:', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
}

async function updateProfile(req, res) {
    const { name, companyRole, profilePhoto, locale } = req.body;
    const userId = req.user.sub;

    const db = await openDb();

    try {
        // Build dynamic update query
        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (companyRole !== undefined) {
            updates.push('companyRole = ?');
            params.push(companyRole);
        }
        if (profilePhoto !== undefined) {
            updates.push('profilePhoto = ?');
            params.push(profilePhoto);
        }
        if (locale !== undefined) {
            const normalizedLocale = String(locale).toLowerCase().startsWith('en') ? 'en' : 'es';
            updates.push('locale = ?');
            params.push(normalizedLocale);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(userId);
        await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        // Return updated user with all necessary fields
        const user = await db.get('SELECT id, name, email, profilePhoto, companyRole, locale, isAdmin, onboardingCompleted FROM users WHERE id = ?', [userId]);
        res.json({ user: { ...user, orgId: req.user.orgId, isAdmin: !!user.isAdmin, onboardingCompleted: !!user.onboardingCompleted } });

    } catch (error) {
        console.error('UpdateProfile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}

// Middleware to verify user is a platform admin
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Middleware to verify user is org admin (for agent management, etc.)
function requireOrgAdmin(req, res, next) {
    if (!req.user || !req.user.orgId) return res.status(401).json({ error: 'Authentication required' });
    openDb().then(db => db.get('SELECT role FROM user_organizations WHERE userId = ? AND organizationId = ?', [req.user.sub, req.user.orgId]))
        .then(row => {
            if (!row || row.role !== 'admin') {
                return res.status(403).json({ error: 'Se requieren permisos de administrador de la organización' });
            }
            next();
        })
        .catch(err => {
            console.error('[requireOrgAdmin]', err);
            res.status(500).json({ error: 'Error verificando permisos' });
        });
}

async function completeOnboarding(req, res) {
    const { role, industry, useCase, source } = req.body;
    const userId = req.user.sub;

    const db = await openDb();

    try {
        await db.run(
            `UPDATE users SET 
                onboardingRole = ?, 
                onboardingIndustry = ?, 
                onboardingUseCase = ?, 
                onboardingSource = ?,
                onboardingCompleted = 1
            WHERE id = ?`,
            [role, industry, useCase, source, userId]
        );

        res.json({ success: true, message: 'Onboarding completed' });
    } catch (error) {
        console.error('CompleteOnboarding error:', error);
        res.status(500).json({ error: 'Failed to save onboarding data' });
    }
}

async function verifyEmail(req, res) {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
    }

    const db = await openDb();

    try {
        // Find user by verification token
        const user = await db.get('SELECT id, email, name, emailVerified FROM users WHERE verificationToken = ?', [token]);

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        if (user.emailVerified) {
            return res.json({ message: 'Email already verified. You can now log in.' });
        }

        // Mark email as verified and clear token
        await db.run(
            'UPDATE users SET emailVerified = 1, verificationToken = NULL WHERE id = ?',
            [user.id]
        );

        console.log(`[Auth] Email verified for user ${user.email}`);

        res.json({ message: 'Email verified successfully! You can now log in.', email: user.email });

    } catch (error) {
        console.error('VerifyEmail error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
}

async function resendVerification(req, res) {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const db = await openDb();

    try {
        const user = await db.get('SELECT id, name, emailVerified, verificationToken FROM users WHERE email = ?', [email]);

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({ message: 'If an account exists with this email, a verification link will be sent.' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email is already verified. You can log in.' });
        }

        // Generate new token if needed
        let verificationToken = user.verificationToken;
        if (!verificationToken) {
            verificationToken = crypto.randomBytes(32).toString('hex');
            await db.run('UPDATE users SET verificationToken = ? WHERE id = ?', [verificationToken, user.id]);
        }

        // Send verification email
        const verificationUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
        
        if (!resend) {
            console.warn('[Auth] RESEND_API_KEY missing, skipping resend verification email');
        } else {
            const sendResult = await resend.emails.send({
                from: RESEND_FROM,
                to: email,
                subject: 'Verify your email - Intemic',
                html: `
                <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="color: #1F5F68; margin: 0;">Verify Your Email</h1>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                        Hi ${user.name},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                        Please verify your email address by clicking the button below:
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${verificationUrl}" 
                           style="background-color: #1F5F68; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                            Verify Email Address
                        </a>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link in your browser:<br>
                        <a href="${verificationUrl}" style="color: #1F5F68; word-break: break-all;">${verificationUrl}</a>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 40px 0;">
                    
                    <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
                `
            });

            console.log(`[Auth] Verification email resent to ${email}`);
            console.log('[Auth] Resend send result:', sendResult);
        }
        res.json({ message: 'Verification email sent. Please check your inbox.' });

    } catch (error) {
        console.error('ResendVerification error:', error);
        res.status(500).json({ error: 'Failed to resend verification email' });
    }
}

// Validate invitation token and return invitation details
async function validateInvitation(req, res) {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Invitation token is required' });
    }

    const db = await openDb();

    try {
        const invitation = await db.get(`
            SELECT pi.*, o.name as organizationName 
            FROM pending_invitations pi
            JOIN organizations o ON pi.organizationId = o.id
            WHERE pi.token = ? AND pi.status = 'pending'
        `, [token]);

        if (!invitation) {
            return res.status(400).json({ error: 'Invalid or expired invitation' });
        }

        res.json({
            email: invitation.email,
            organizationName: invitation.organizationName,
            invitedByName: invitation.invitedByName
        });

    } catch (error) {
        console.error('ValidateInvitation error:', error);
        res.status(500).json({ error: 'Failed to validate invitation' });
    }
}

// Register with invitation token
async function registerWithInvitation(req, res) {
    const { email, password, name, token } = req.body;

    if (!email || !password || !name || !token) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const db = await openDb();

    try {
        // Validate invitation
        const invitation = await db.get(
            'SELECT * FROM pending_invitations WHERE token = ? AND status = ? AND email = ?',
            [token, 'pending', email]
        );

        if (!invitation) {
            return res.status(400).json({ error: 'Invalid invitation or email mismatch' });
        }

        // Check if user already exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists. Please login instead.' });
        }

        const userId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Transaction
        await db.run('BEGIN TRANSACTION');

        // Create User (already verified since they came via invitation)
        await db.run(
            'INSERT INTO users (id, email, password, name, createdAt, emailVerified) VALUES (?, ?, ?, ?, ?, 1)',
            [userId, email, hashedPassword, name, now]
        );

        // Link User to Organization from invitation
        await db.run(
            'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
            [userId, invitation.organizationId, 'member']
        );

        // Mark invitation as accepted
        await db.run(
            'UPDATE pending_invitations SET status = ? WHERE id = ?',
            ['accepted', invitation.id]
        );

        await db.run('COMMIT');

        // Auto-login
        const token_jwt = jwt.sign(
            { sub: userId, email, name, orgId: invitation.organizationId }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.cookie('auth_token', token_jwt, COOKIE_OPTIONS);

        console.log(`[Auth] User ${email} registered via invitation and joined org ${invitation.organizationId}`);

        res.status(201).json({ 
            message: 'Registration successful!', 
            user: { id: userId, name, email, orgId: invitation.organizationId }
        });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error('RegisterWithInvitation error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// Request password reset - sends email with reset link
async function forgotPassword(req, res) {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const db = await openDb();

    try {
        // Find user by email
        const user = await db.get('SELECT id, name, emailVerified FROM users WHERE email = ?', [email]);

        // Always return success to prevent email enumeration attacks
        if (!user) {
            console.log(`[Auth] Password reset requested for non-existent email: ${email}`);
            return res.json({ message: 'If an account exists with this email, you will receive a password reset link.' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

        // Save token to database
        await db.run(
            'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
            [resetToken, resetExpires, user.id]
        );

        // Send reset email
        const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

        try {
            if (!resend) {
                console.warn('[Auth] RESEND_API_KEY missing, skipping reset password email');
            } else {
                const sendResult = await resend.emails.send({
                    from: RESEND_FROM,
                    to: email,
                    subject: 'Reset your Intemic password',
                    html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <div style="text-align: center; margin-bottom: 40px;">
                            <h1 style="color: #1F5F68; margin: 0;">Reset Your Password</h1>
                        </div>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Hi${user.name ? ` ${user.name}` : ''},
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            We received a request to reset the password for your Intemic account. 
                            Click the button below to create a new password:
                        </p>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${resetUrl}" 
                               style="background-color: #1F5F68; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                            Or copy and paste this link in your browser:<br>
                            <a href="${resetUrl}" style="color: #1F5F68; word-break: break-all;">${resetUrl}</a>
                        </p>
                        
                        <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                            This link will expire in <strong>1 hour</strong>.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 40px 0;">
                        
                        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                            If you didn't request a password reset, you can safely ignore this email. 
                            Your password will remain unchanged.
                        </p>
                    </div>
                    `
                });
                console.log(`[Auth] Password reset email sent to ${email}`);
                console.log('[Auth] Resend send result:', sendResult);
            }
        } catch (emailError) {
            console.error('[Auth] Failed to send password reset email:', emailError);
            return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
        }

        res.json({ message: 'If an account exists with this email, you will receive a password reset link.' });

    } catch (error) {
        console.error('ForgotPassword error:', error);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
}

// Validate reset token
async function validateResetToken(req, res) {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Reset token is required' });
    }

    const db = await openDb();

    try {
        const user = await db.get(
            'SELECT id, email FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
            [token, new Date().toISOString()]
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        res.json({ valid: true, email: user.email });

    } catch (error) {
        console.error('ValidateResetToken error:', error);
        res.status(500).json({ error: 'Failed to validate reset token' });
    }
}

// Reset password with token
async function resetPassword(req, res) {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = await openDb();

    try {
        // Find user with valid token
        const user = await db.get(
            'SELECT id, email FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
            [token, new Date().toISOString()]
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Update password and clear reset token
        await db.run(
            'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        console.log(`[Auth] Password reset successful for ${user.email}`);

        res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });

    } catch (error) {
        console.error('ResetPassword error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`;

// Google OAuth - Initiate login
async function googleAuth(req, res) {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&access_type=offline` +
        `&prompt=consent`;

    // Store state in session/cookie for validation
    res.cookie('oauth_state', state, { 
        httpOnly: true, 
        secure: IS_PRODUCTION, 
        sameSite: IS_PRODUCTION ? 'none' : 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.redirect(authUrl);
}

// Google OAuth - Handle callback
async function googleCallback(req, res) {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;

    if (!code) {
        return res.redirect(`${APP_URL}?error=oauth_failed`);
    }

    if (state !== storedState) {
        return res.redirect(`${APP_URL}?error=invalid_state`);
    }

    // Clear state cookie
    res.clearCookie('oauth_state');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.redirect(`${APP_URL}?error=oauth_not_configured`);
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('[Google OAuth] Token exchange failed:', errorText);
            return res.redirect(`${APP_URL}?error=token_exchange_failed`);
        }

        const tokens = await tokenResponse.json();
        const { access_token } = tokens;

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        if (!userInfoResponse.ok) {
            return res.redirect(`${APP_URL}?error=user_info_failed`);
        }

        const googleUser = await userInfoResponse.json();
        const { email, name, picture } = googleUser;

        if (!email) {
            return res.redirect(`${APP_URL}?error=no_email`);
        }

        const db = await openDb();

        // Check if user exists
        let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (user) {
            // User exists, log them in
            const userOrg = await db.get('SELECT organizationId FROM user_organizations WHERE userId = ?', [user.id]);
            
            if (!userOrg) {
                return res.redirect(`${APP_URL}?error=no_organization`);
            }

            // Update profile photo if available
            if (picture && picture !== user.profilePhoto) {
                await db.run('UPDATE users SET profilePhoto = ? WHERE id = ?', [picture, user.id]);
                user.profilePhoto = picture;
            }

            const token = jwt.sign(
                { sub: user.id, email: user.email, name: user.name, orgId: userOrg.organizationId, isAdmin: !!user.isAdmin },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.cookie('auth_token', token, COOKIE_OPTIONS);
            return res.redirect(`${APP_URL}`);
        } else {
            // New user - create account
            // For Google OAuth, we need a workspace name - use email domain or prompt
            const emailDomain = email.split('@')[1];
            const defaultOrgName = emailDomain.split('.')[0].charAt(0).toUpperCase() + emailDomain.split('.')[0].slice(1);

            const userId = Math.random().toString(36).substr(2, 9);
            const orgId = Math.random().toString(36).substr(2, 9);
            const now = new Date().toISOString();

            await db.run('BEGIN TRANSACTION');

            // Create User (email verified by default for Google OAuth)
            await db.run(
                'INSERT INTO users (id, email, password, name, createdAt, emailVerified, profilePhoto) VALUES (?, ?, ?, ?, ?, 1, ?)',
                [userId, email, '', name || email.split('@')[0], now, picture || null]
            );

            // Create Organization
            await db.run(
                'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)',
                [orgId, defaultOrgName, now]
            );

            // Link User to Organization
            await db.run(
                'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
                [userId, orgId, 'admin']
            );

            await db.run('COMMIT');

            // Auto-login
            const token = jwt.sign(
                { sub: userId, email, name: name || email.split('@')[0], orgId, isAdmin: false },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.cookie('auth_token', token, COOKIE_OPTIONS);
            return res.redirect(`${APP_URL}`);
        }
    } catch (error) {
        console.error('[Google OAuth] Callback error:', error);
        return res.redirect(`${APP_URL}?error=oauth_error`);
    }
}

module.exports = { register, login, logout, authenticateToken, getMe, getOrganizations, switchOrganization, getOrganizationUsers, inviteUser, updateProfile, requireAdmin, requireOrgAdmin, completeOnboarding, verifyEmail, resendVerification, validateInvitation, registerWithInvitation, forgotPassword, validateResetToken, resetPassword, googleAuth, googleCallback };
