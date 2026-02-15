/**
 * Admin & Audit Log Routes
 * 
 * Handles: audit logs, AI audit logs, admin stats, user management.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');

module.exports = function({ db }) {

router.get('/audit-logs', authenticateToken, async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0, 
            action, 
            resourceType, 
            userId,
            startDate,
            endDate,
            search
        } = req.query;

        let query = `
            SELECT * FROM audit_logs 
            WHERE organizationId = ?
        `;
        const params = [req.user.orgId];

        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }

        if (resourceType) {
            query += ' AND resourceType = ?';
            params.push(resourceType);
        }

        if (userId) {
            query += ' AND userId = ?';
            params.push(userId);
        }

        if (startDate) {
            query += ' AND createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND createdAt <= ?';
            params.push(endDate);
        }

        if (search) {
            query += ' AND (userName LIKE ? OR userEmail LIKE ? OR resourceName LIKE ? OR action LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const logs = await db.all(query, params);

        // Parse details JSON
        const parsedLogs = logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        }));

        res.json(parsedLogs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// Get audit log stats/summary
router.get('/audit-logs/stats', authenticateToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get counts by action type
        const actionCounts = await db.all(`
            SELECT action, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY action
            ORDER BY count DESC
        `, [req.user.orgId, startDate]);

        // Get counts by resource type
        const resourceCounts = await db.all(`
            SELECT resourceType, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY resourceType
            ORDER BY count DESC
        `, [req.user.orgId, startDate]);

        // Get most active users
        const activeUsers = await db.all(`
            SELECT userId, userName, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ? AND userId IS NOT NULL
            GROUP BY userId
            ORDER BY count DESC
            LIMIT 10
        `, [req.user.orgId, startDate]);

        // Get activity by day
        const dailyActivity = await db.all(`
            SELECT DATE(createdAt) as date, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY DATE(createdAt)
            ORDER BY date ASC
        `, [req.user.orgId, startDate]);

        // Get total count
        const total = await db.get(`
            SELECT COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
        `, [req.user.orgId, startDate]);

        res.json({
            total: total.count,
            actionCounts,
            resourceCounts,
            activeUsers,
            dailyActivity
        });
    } catch (error) {
        console.error('Get audit log stats error:', error);
        res.status(500).json({ error: 'Failed to get audit log stats' });
    }
});

// Get unique action types and resource types for filters
router.get('/audit-logs/filters', authenticateToken, async (req, res) => {
    try {
        const actions = await db.all(`
            SELECT DISTINCT action FROM audit_logs WHERE organizationId = ? ORDER BY action
        `, [req.user.orgId]);

        const resourceTypes = await db.all(`
            SELECT DISTINCT resourceType FROM audit_logs WHERE organizationId = ? ORDER BY resourceType
        `, [req.user.orgId]);

        const users = await db.all(`
            SELECT DISTINCT userId, userName FROM audit_logs 
            WHERE organizationId = ? AND userId IS NOT NULL 
            ORDER BY userName
        `, [req.user.orgId]);

        res.json({
            actions: actions.map(a => a.action),
            resourceTypes: resourceTypes.map(r => r.resourceType),
            users: users.map(u => ({ id: u.userId, name: u.userName }))
        });
    } catch (error) {
        console.error('Get audit log filters error:', error);
        res.status(500).json({ error: 'Failed to get filters' });
    }
});

// Export audit logs as CSV
router.get('/audit-logs/export', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, action, resourceType } = req.query;

        let query = `SELECT * FROM audit_logs WHERE organizationId = ?`;
        const params = [req.user.orgId];

        if (startDate) {
            query += ' AND createdAt >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND createdAt <= ?';
            params.push(endDate);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        if (resourceType) {
            query += ' AND resourceType = ?';
            params.push(resourceType);
        }

        query += ' ORDER BY createdAt DESC';

        const logs = await db.all(query, params);

        // Convert to CSV
        const headers = ['Date', 'User', 'Email', 'Action', 'Resource Type', 'Resource Name', 'Details', 'IP Address'];
        const rows = logs.map(log => [
            log.createdAt,
            log.userName || 'System',
            log.userEmail || '',
            log.action,
            log.resourceType,
            log.resourceName || '',
            log.details || '',
            log.ipAddress || ''
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export audit logs error:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

// AI Audit Logs - Trazabilidad específica de IA (compliance)
router.get('/ai-audit-logs', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0, agentRole, chatId, startDate, endDate } = req.query;
        let query = `SELECT * FROM ai_audit_logs WHERE organizationId = ?`;
        const params = [req.user.orgId];
        if (agentRole) { query += ' AND agentRole = ?'; params.push(agentRole); }
        if (chatId) { query += ' AND chatId = ?'; params.push(chatId); }
        if (startDate) { query += ' AND createdAt >= ?'; params.push(startDate); }
        if (endDate) { query += ' AND createdAt <= ?'; params.push(endDate); }
        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        const logs = await db.all(query, params);
        res.json(logs);
    } catch (error) {
        console.error('Get AI audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch AI audit logs' });
    }
});

router.get('/ai-audit-logs/stats', authenticateToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const byRole = await db.all(`
            SELECT agentRole, COUNT(*) as count, SUM(tokensTotal) as totalTokens
            FROM ai_audit_logs WHERE organizationId = ? AND createdAt >= ?
            GROUP BY agentRole
        `, [req.user.orgId, startDate]);
        const total = await db.get(`SELECT COUNT(*) as c, COALESCE(SUM(tokensTotal),0) as tokens FROM ai_audit_logs WHERE organizationId = ? AND createdAt >= ?`, [req.user.orgId, startDate]);
        const daily = await db.all(`
            SELECT DATE(createdAt) as date, COUNT(*) as count, SUM(tokensTotal) as tokens
            FROM ai_audit_logs WHERE organizationId = ? AND createdAt >= ?
            GROUP BY DATE(createdAt) ORDER BY date ASC
        `, [req.user.orgId, startDate]);
        res.json({ total: total?.c || 0, totalTokens: total?.tokens || 0, byRole, daily });
    } catch (error) {
        console.error('AI audit stats error:', error);
        res.status(500).json({ error: 'Failed to fetch AI audit stats' });
    }
});

// Admin Routes - Platform-wide admin panel
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get total counts
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const orgCount = await db.get('SELECT COUNT(*) as count FROM organizations');
        const workflowCount = await db.get('SELECT COUNT(*) as count FROM workflows');
        const dashboardCount = await db.get('SELECT COUNT(*) as count FROM dashboards');
        const entityCount = await db.get('SELECT COUNT(*) as count FROM entities');

        res.json({
            users: userCount.count,
            organizations: orgCount.count,
            workflows: workflowCount.count,
            dashboards: dashboardCount.count,
            entities: entityCount.count
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get all users with their organization info and resource counts
        const users = await db.all(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.profilePhoto,
                u.companyRole,
                u.isAdmin,
                u.createdAt,
                u.onboardingRole,
                u.onboardingIndustry,
                u.onboardingUseCase,
                u.onboardingSource,
                u.onboardingCompleted,
                GROUP_CONCAT(DISTINCT o.name) as organizations,
                COUNT(DISTINCT uo.organizationId) as orgCount
            FROM users u
            LEFT JOIN user_organizations uo ON u.id = uo.userId
            LEFT JOIN organizations o ON uo.organizationId = o.id
            GROUP BY u.id
            ORDER BY u.createdAt DESC
        `);

        // For each user, get their workflow and dashboard counts across all their orgs
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            // Get all org IDs for this user
            const userOrgs = await db.all(
                'SELECT organizationId FROM user_organizations WHERE userId = ?',
                [user.id]
            );
            const orgIds = userOrgs.map(o => o.organizationId);

            let workflowCount = 0;
            let dashboardCount = 0;

            if (orgIds.length > 0) {
                const placeholders = orgIds.map(() => '?').join(',');
                const wfCount = await db.get(
                    `SELECT COUNT(*) as count FROM workflows WHERE organizationId IN (${placeholders})`,
                    orgIds
                );
                const dbCount = await db.get(
                    `SELECT COUNT(*) as count FROM dashboards WHERE organizationId IN (${placeholders})`,
                    orgIds
                );
                workflowCount = wfCount.count;
                dashboardCount = dbCount.count;
            }

            return {
                ...user,
                isAdmin: !!user.isAdmin,
                onboardingCompleted: !!user.onboardingCompleted,
                workflowCount,
                dashboardCount
            };
        }));

        res.json(usersWithCounts);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.put('/admin/users/:id/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin } = req.body;

        await db.run('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);

        res.json({ message: 'User admin status updated' });
    } catch (error) {
        console.error('Update admin status error:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

// Delete user - Admin only
router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user.sub;

        // Prevent self-deletion
        if (id === adminUserId) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        // Check if user exists
        const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Helper function to safely delete from a table (ignores errors if table doesn't exist)
        const safeDelete = async (query, params) => {
            try {
                await db.run(query, params);
            } catch (err) {
                console.log(`[Admin] Safe delete skipped (table may not exist): ${err.message}`);
            }
        };

        // Start transaction for cascading deletes
        await db.run('BEGIN TRANSACTION');

        try {
            // Delete user's organization memberships
            await safeDelete('DELETE FROM user_organizations WHERE userId = ?', [id]);

            // Delete user's workflows (if they are the creator)
            await safeDelete('DELETE FROM workflows WHERE createdBy = ?', [id]);

            // Delete user's dashboards (if they are the creator)
            await safeDelete('DELETE FROM dashboards WHERE createdBy = ?', [id]);

            // Delete user's reports (if they are the creator)
            await safeDelete('DELETE FROM reports WHERE createdBy = ?', [id]);

            // Delete user's entities (if they are the creator)
            await safeDelete('DELETE FROM entities WHERE createdBy = ?', [id]);

            // Delete user's credentials
            await safeDelete('DELETE FROM credentials WHERE userId = ?', [id]);

            // Delete user's audit logs
            await safeDelete('DELETE FROM audit_logs WHERE userId = ?', [id]);

            // Delete any pending invitations sent by this user
            await safeDelete('DELETE FROM pending_invitations WHERE invitedBy = ?', [id]);

            // Delete node feedback from this user
            await safeDelete('DELETE FROM node_feedback WHERE userId = ?', [id]);

            // Delete the user (this one must succeed)
            await db.run('DELETE FROM users WHERE id = ?', [id]);

            await db.run('COMMIT');

            console.log(`[Admin] User ${user.email} (${id}) deleted by admin ${adminUserId}`);
            res.json({ message: `User ${user.email} has been deleted`, deletedUser: { id, email: user.email, name: user.name } });

        } catch (deleteError) {
            await db.run('ROLLBACK');
            throw deleteError;
        }

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user: ' + error.message });
    }
});

    return router;
};
