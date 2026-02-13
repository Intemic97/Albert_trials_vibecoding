/**
 * SSO Module - SAML 2.0 and OpenID Connect
 * 
 * Supports enterprise identity providers:
 * - Azure AD (Entra ID)
 * - Okta
 * - Google Workspace
 * - Any SAML 2.0 or OIDC compliant IdP
 * 
 * Configuration is per-organization, stored in the database.
 */

const passport = require('passport');
const { Strategy: SamlStrategy } = require('@node-saml/passport-saml');
const { Issuer, generators } = require('openid-client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * Initialize SSO routes on the Express app
 */
function initSSO(app, db) {
    // Initialize Passport
    app.use(passport.initialize());

    // ==================== SSO Configuration CRUD ====================

    // Get SSO config for an organization
    app.get('/api/sso/config', authenticateToken, requireOrgAdmin, async (req, res) => {
        try {
            const config = await db.get(
                'SELECT id, organizationId, provider, protocol, entityId, ssoUrl, certificate, clientId, issuerUrl, enabled, createdAt, updatedAt FROM sso_configurations WHERE organizationId = ?',
                [req.user.orgId]
            );
            if (!config) {
                return res.json({ configured: false });
            }
            // Never return sensitive fields (clientSecret, certificate private key)
            res.json({
                configured: true,
                provider: config.provider,
                protocol: config.protocol,
                entityId: config.entityId,
                ssoUrl: config.ssoUrl,
                clientId: config.clientId,
                issuerUrl: config.issuerUrl,
                enabled: !!config.enabled,
                hasCertificate: !!config.certificate,
            });
        } catch (error) {
            console.error('[SSO] Error fetching config:', error);
            res.status(500).json({ error: 'Failed to fetch SSO configuration' });
        }
    });

    // Create/Update SSO config
    app.put('/api/sso/config', authenticateToken, requireOrgAdmin, async (req, res) => {
        try {
            const { provider, protocol, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, enabled } = req.body;
            
            if (!provider || !protocol) {
                return res.status(400).json({ error: 'Provider and protocol are required' });
            }
            if (!['saml', 'oidc'].includes(protocol)) {
                return res.status(400).json({ error: 'Protocol must be "saml" or "oidc"' });
            }

            const now = new Date().toISOString();
            const existing = await db.get('SELECT id FROM sso_configurations WHERE organizationId = ?', [req.user.orgId]);

            if (existing) {
                await db.run(
                    `UPDATE sso_configurations SET provider=?, protocol=?, entityId=?, ssoUrl=?, certificate=?, clientId=?, clientSecret=?, issuerUrl=?, enabled=?, updatedAt=? WHERE organizationId=?`,
                    [provider, protocol, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, enabled ? 1 : 0, now, req.user.orgId]
                );
            } else {
                const id = `sso_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
                await db.run(
                    `INSERT INTO sso_configurations (id, organizationId, provider, protocol, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, enabled, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [id, req.user.orgId, provider, protocol, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, enabled ? 1 : 0, now, now]
                );
            }

            // Log audit event
            try {
                await db.run(
                    'INSERT INTO audit_logs (id, userId, action, resourceType, resourceId, organizationId, ipAddress, userAgent, createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
                    [`audit_${Date.now()}`, req.user.sub, 'sso_config_updated', 'sso', req.user.orgId, req.user.orgId, req.ip, req.get('user-agent'), now]
                );
            } catch (_) {}

            res.json({ success: true });
        } catch (error) {
            console.error('[SSO] Error saving config:', error);
            res.status(500).json({ error: 'Failed to save SSO configuration' });
        }
    });

    // ==================== SAML Routes ====================

    // SAML login initiation
    app.get('/api/sso/saml/login/:orgId', async (req, res) => {
        try {
            const config = await db.get(
                'SELECT * FROM sso_configurations WHERE organizationId = ? AND protocol = ? AND enabled = 1',
                [req.params.orgId, 'saml']
            );
            if (!config) {
                return res.status(404).json({ error: 'SAML SSO not configured for this organization' });
            }

            const samlStrategy = new SamlStrategy({
                callbackUrl: `${API_URL}/api/sso/saml/callback`,
                entryPoint: config.ssoUrl,
                issuer: config.entityId || `${API_URL}/saml/metadata`,
                cert: config.certificate,
                wantAuthnResponseSigned: true,
                wantAssertionsSigned: true,
            }, (profile, done) => done(null, profile));

            passport.use('saml-dynamic', samlStrategy);
            passport.authenticate('saml-dynamic', { session: false })(req, res);
        } catch (error) {
            console.error('[SSO] SAML login error:', error);
            res.status(500).json({ error: 'SSO login failed' });
        }
    });

    // SAML callback (ACS URL)
    app.post('/api/sso/saml/callback', async (req, res) => {
        try {
            // Extract RelayState or InResponseTo to identify the org
            // For now, we look up by the issuer in the response
            const configs = await db.all('SELECT * FROM sso_configurations WHERE protocol = ? AND enabled = 1', ['saml']);
            
            for (const config of configs) {
                try {
                    const samlStrategy = new SamlStrategy({
                        callbackUrl: `${API_URL}/api/sso/saml/callback`,
                        entryPoint: config.ssoUrl,
                        issuer: config.entityId || `${API_URL}/saml/metadata`,
                        cert: config.certificate,
                        wantAuthnResponseSigned: true,
                    }, async (profile, done) => {
                        try {
                            const user = await findOrCreateSSOUser(db, profile, config.organizationId);
                            done(null, user);
                        } catch (err) {
                            done(err);
                        }
                    });

                    passport.use('saml-callback', samlStrategy);
                    
                    return passport.authenticate('saml-callback', { session: false }, (err, user) => {
                        if (err || !user) {
                            return res.redirect(`${APP_URL}/login?error=sso_failed`);
                        }
                        // Issue JWT and redirect
                        const token = issueJWT(user);
                        res.cookie('token', token, getCookieOptions());
                        res.redirect(`${APP_URL}/`);
                    })(req, res);
                } catch (_) {
                    continue;
                }
            }

            res.redirect(`${APP_URL}/login?error=sso_no_config`);
        } catch (error) {
            console.error('[SSO] SAML callback error:', error);
            res.redirect(`${APP_URL}/login?error=sso_error`);
        }
    });

    // ==================== OIDC Routes ====================

    // OIDC login initiation
    app.get('/api/sso/oidc/login/:orgId', async (req, res) => {
        try {
            const config = await db.get(
                'SELECT * FROM sso_configurations WHERE organizationId = ? AND protocol = ? AND enabled = 1',
                [req.params.orgId, 'oidc']
            );
            if (!config) {
                return res.status(404).json({ error: 'OIDC SSO not configured for this organization' });
            }

            const issuer = await Issuer.discover(config.issuerUrl);
            const client = new issuer.Client({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uris: [`${API_URL}/api/sso/oidc/callback`],
                response_types: ['code'],
            });

            const nonce = generators.nonce();
            const state = generators.state();
            
            // Store state temporarily (in production, use Redis or DB)
            req.app.locals[`oidc_state_${state}`] = { orgId: req.params.orgId, nonce };

            const authUrl = client.authorizationUrl({
                scope: 'openid email profile',
                state,
                nonce,
            });

            res.redirect(authUrl);
        } catch (error) {
            console.error('[SSO] OIDC login error:', error);
            res.status(500).json({ error: 'SSO login failed' });
        }
    });

    // OIDC callback
    app.get('/api/sso/oidc/callback', async (req, res) => {
        try {
            const { state, code } = req.query;
            const stateData = req.app.locals[`oidc_state_${state}`];
            
            if (!stateData) {
                return res.redirect(`${APP_URL}/login?error=sso_invalid_state`);
            }
            delete req.app.locals[`oidc_state_${state}`];

            const config = await db.get(
                'SELECT * FROM sso_configurations WHERE organizationId = ? AND protocol = ? AND enabled = 1',
                [stateData.orgId, 'oidc']
            );
            if (!config) {
                return res.redirect(`${APP_URL}/login?error=sso_no_config`);
            }

            const issuer = await Issuer.discover(config.issuerUrl);
            const client = new issuer.Client({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uris: [`${API_URL}/api/sso/oidc/callback`],
                response_types: ['code'],
            });

            const params = client.callbackParams(req);
            const tokenSet = await client.callback(`${API_URL}/api/sso/oidc/callback`, params, { nonce: stateData.nonce, state });
            const userinfo = await client.userinfo(tokenSet.access_token);

            const profile = {
                email: userinfo.email,
                nameID: userinfo.sub,
                firstName: userinfo.given_name || userinfo.name?.split(' ')[0],
                lastName: userinfo.family_name || userinfo.name?.split(' ').slice(1).join(' '),
            };

            const user = await findOrCreateSSOUser(db, profile, stateData.orgId);
            const token = issueJWT(user);
            res.cookie('token', token, getCookieOptions());
            res.redirect(`${APP_URL}/`);
        } catch (error) {
            console.error('[SSO] OIDC callback error:', error);
            res.redirect(`${APP_URL}/login?error=sso_error`);
        }
    });

    // ==================== SSO User Management ====================

    // Check if org has SSO enabled (public endpoint for login page)
    app.get('/api/sso/check/:orgSlug', async (req, res) => {
        try {
            // Look up org by slug or ID
            const org = await db.get('SELECT id FROM organizations WHERE id = ? OR name = ?', [req.params.orgSlug, req.params.orgSlug]);
            if (!org) return res.json({ ssoEnabled: false });

            const config = await db.get(
                'SELECT protocol, provider FROM sso_configurations WHERE organizationId = ? AND enabled = 1',
                [org.id]
            );
            res.json({
                ssoEnabled: !!config,
                protocol: config?.protocol,
                provider: config?.provider,
                loginUrl: config ? `/api/sso/${config.protocol}/login/${org.id}` : null,
            });
        } catch (error) {
            res.json({ ssoEnabled: false });
        }
    });

    console.log('[SSO] SSO routes initialized');
}

// ==================== Helper Functions ====================

async function findOrCreateSSOUser(db, profile, organizationId) {
    const email = profile.email || profile.nameID;
    if (!email) throw new Error('SSO profile does not contain email');

    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
        // Auto-create user from SSO
        const userId = `user_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || email.split('@')[0];
        const now = new Date().toISOString();

        await db.run(
            'INSERT INTO users (id, email, name, password, emailVerified, ssoProvider, createdAt) VALUES (?,?,?,?,?,?,?)',
            [userId, email, name, 'SSO_NO_PASSWORD', 1, 'sso', now]
        );

        // Add to organization
        await db.run(
            'INSERT INTO user_organizations (userId, organizationId, role, joinedAt) VALUES (?,?,?,?)',
            [userId, organizationId, 'member', now]
        );

        user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    } else {
        // Ensure user is in this organization
        const membership = await db.get(
            'SELECT * FROM user_organizations WHERE userId = ? AND organizationId = ?',
            [user.id, organizationId]
        );
        if (!membership) {
            await db.run(
                'INSERT INTO user_organizations (userId, organizationId, role, joinedAt) VALUES (?,?,?,?)',
                [user.id, organizationId, 'member', new Date().toISOString()]
            );
        }
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        orgId: organizationId,
    };
}

function issueJWT(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, name: user.name, orgId: user.orgId },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function getCookieOptions() {
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: IS_PRODUCTION ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
    };
}

// Re-use auth middleware from auth.js
function authenticateToken(req, res, next) {
    const { authenticateToken: authFn } = require('../auth');
    return authFn(req, res, next);
}

function requireOrgAdmin(req, res, next) {
    const { requireOrgAdmin: adminFn } = require('../auth');
    return adminFn(req, res, next);
}

module.exports = { initSSO };
