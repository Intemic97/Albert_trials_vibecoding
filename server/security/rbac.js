/**
 * Role-Based Access Control (RBAC) Module
 * 
 * Roles hierarchy:
 *   admin > editor > viewer > auditor
 * 
 * Resources: entities, workflows, dashboards, copilots, agents, settings, billing, audit_logs
 * Actions: create, read, update, delete, execute, export
 * 
 * Default permissions per role:
 * - admin: full access to everything
 * - editor: create, read, update, execute (no delete, no settings, no billing)
 * - viewer: read only, can execute workflows
 * - auditor: read audit_logs and settings only
 */

// Default permissions matrix
const DEFAULT_PERMISSIONS = {
    admin: {
        entities:    ['create', 'read', 'update', 'delete', 'export'],
        workflows:   ['create', 'read', 'update', 'delete', 'execute', 'export'],
        dashboards:  ['create', 'read', 'update', 'delete', 'export'],
        copilots:    ['create', 'read', 'update', 'delete'],
        agents:      ['create', 'read', 'update', 'delete'],
        connections: ['create', 'read', 'update', 'delete'],
        settings:    ['read', 'update'],
        billing:     ['read', 'update'],
        audit_logs:  ['read', 'export'],
        users:       ['create', 'read', 'update', 'delete'],
        sso:         ['read', 'update'],
    },
    editor: {
        entities:    ['create', 'read', 'update', 'export'],
        workflows:   ['create', 'read', 'update', 'execute', 'export'],
        dashboards:  ['create', 'read', 'update', 'export'],
        copilots:    ['create', 'read', 'update'],
        agents:      ['create', 'read', 'update'],
        connections: ['read'],
        settings:    ['read'],
        billing:     [],
        audit_logs:  [],
        users:       ['read'],
        sso:         [],
    },
    viewer: {
        entities:    ['read'],
        workflows:   ['read', 'execute'],
        dashboards:  ['read'],
        copilots:    ['read'],
        agents:      ['read'],
        connections: ['read'],
        settings:    ['read'],
        billing:     [],
        audit_logs:  [],
        users:       ['read'],
        sso:         [],
    },
    auditor: {
        entities:    ['read'],
        workflows:   ['read'],
        dashboards:  ['read'],
        copilots:    [],
        agents:      [],
        connections: [],
        settings:    ['read'],
        billing:     ['read'],
        audit_logs:  ['read', 'export'],
        users:       ['read'],
        sso:         ['read'],
    },
    // Legacy 'member' role maps to 'editor'
    member: null, // Will be resolved to 'editor'
};

// Role hierarchy (higher index = more privileges)
const ROLE_HIERARCHY = ['auditor', 'viewer', 'editor', 'admin'];

/**
 * Check if a user has permission to perform an action on a resource
 * @param {string} role - User's role in the organization
 * @param {string} resource - The resource type (e.g., 'entities', 'workflows')
 * @param {string} action - The action (e.g., 'create', 'read', 'update', 'delete')
 * @returns {boolean}
 */
function hasPermission(role, resource, action) {
    // Resolve legacy roles
    const resolvedRole = role === 'member' ? 'editor' : role;
    
    const permissions = DEFAULT_PERMISSIONS[resolvedRole];
    if (!permissions) return false;

    const resourcePermissions = permissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions.includes(action);
}

/**
 * Express middleware factory: require permission for a resource+action
 * Usage: app.get('/api/entities', requirePermission('entities', 'read'), handler)
 */
function requirePermission(resource, action) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Platform admins bypass RBAC
        if (req.user.isAdmin) {
            return next();
        }

        const role = req.user.orgRole || 'viewer';
        
        if (!hasPermission(role, resource, action)) {
            // Log the failed access attempt
            console.warn(`[RBAC] Access denied: user=${req.user.sub} role=${role} resource=${resource} action=${action}`);
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: { resource, action },
                userRole: role,
            });
        }

        next();
    };
}

/**
 * Get all permissions for a role
 */
function getPermissionsForRole(role) {
    const resolvedRole = role === 'member' ? 'editor' : role;
    return DEFAULT_PERMISSIONS[resolvedRole] || {};
}

/**
 * Get available roles
 */
function getAvailableRoles() {
    return ROLE_HIERARCHY.map(role => ({
        id: role,
        name: role.charAt(0).toUpperCase() + role.slice(1),
        level: ROLE_HIERARCHY.indexOf(role),
        permissions: DEFAULT_PERMISSIONS[role],
    }));
}

/**
 * Check if role A has higher or equal privileges than role B
 */
function isRoleAtLeast(roleA, roleB) {
    const resolvedA = roleA === 'member' ? 'editor' : roleA;
    const resolvedB = roleB === 'member' ? 'editor' : roleB;
    return ROLE_HIERARCHY.indexOf(resolvedA) >= ROLE_HIERARCHY.indexOf(resolvedB);
}

/**
 * Initialize RBAC routes for managing custom permissions
 */
function initRBACRoutes(app, db) {
    const { authenticateToken, requireOrgAdmin } = require('../auth');

    // Get available roles and their permissions
    app.get('/api/rbac/roles', authenticateToken, (req, res) => {
        res.json({ roles: getAvailableRoles() });
    });

    // Get permissions for a specific user in the current org
    app.get('/api/rbac/my-permissions', authenticateToken, (req, res) => {
        const role = req.user.orgRole || 'viewer';
        const permissions = getPermissionsForRole(role);
        res.json({ role, permissions, isAdmin: !!req.user.isAdmin });
    });

    // Update a user's role (admin only)
    app.put('/api/rbac/users/:userId/role', authenticateToken, requireOrgAdmin, async (req, res) => {
        try {
            const { role } = req.body;
            if (!ROLE_HIERARCHY.includes(role)) {
                return res.status(400).json({ error: `Invalid role. Must be one of: ${ROLE_HIERARCHY.join(', ')}` });
            }

            // Can't change own role
            if (req.params.userId === req.user.sub) {
                return res.status(400).json({ error: 'Cannot change your own role' });
            }

            await db.run(
                'UPDATE user_organizations SET role = ? WHERE userId = ? AND organizationId = ?',
                [role, req.params.userId, req.user.orgId]
            );

            // Audit log
            try {
                await db.run(
                    'INSERT INTO audit_logs (id, userId, action, resourceType, resourceId, details, organizationId, ipAddress, createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
                    [`audit_${Date.now()}`, req.user.sub, 'role_changed', 'user', req.params.userId, JSON.stringify({ newRole: role }), req.user.orgId, req.ip, new Date().toISOString()]
                );
            } catch (_) {}

            res.json({ success: true, role });
        } catch (error) {
            console.error('[RBAC] Error updating role:', error);
            res.status(500).json({ error: 'Failed to update role' });
        }
    });

    console.log('[RBAC] RBAC routes initialized');
}

module.exports = { hasPermission, requirePermission, getPermissionsForRole, getAvailableRoles, isRoleAtLeast, initRBACRoutes, ROLE_HIERARCHY };
