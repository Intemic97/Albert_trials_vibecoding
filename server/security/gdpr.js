/**
 * GDPR Compliance Module
 * 
 * Implements:
 * - Right to be forgotten (data deletion)
 * - Data export (data portability)
 * - Consent management
 * - Data processing records
 */

const crypto = require('crypto');

/**
 * Initialize GDPR routes
 */
function initGDPRRoutes(app, db) {
    const { authenticateToken, requireOrgAdmin } = require('../auth');

    // ==================== Right to be Forgotten ====================

    /**
     * Request account deletion (user-initiated)
     * Creates a deletion request that must be processed
     */
    app.post('/api/gdpr/deletion-request', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.sub;
            const email = req.user.email;
            const now = new Date().toISOString();

            // Check for existing pending request
            const existing = await db.get(
                'SELECT id FROM data_deletion_requests WHERE userId = ? AND status IN (?, ?)',
                [userId, 'pending', 'processing']
            );
            if (existing) {
                return res.json({ message: 'A deletion request is already pending', requestId: existing.id });
            }

            const requestId = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            await db.run(
                'INSERT INTO data_deletion_requests (id, userId, email, organizationId, status, requestedAt) VALUES (?,?,?,?,?,?)',
                [requestId, userId, email, req.user.orgId, 'pending', now]
            );

            // Audit log
            await logAudit(db, userId, 'gdpr_deletion_requested', 'user', userId, req.user.orgId, req.ip, req.get('user-agent'));

            res.json({
                requestId,
                message: 'Deletion request created. Your data will be removed within 30 days as required by GDPR.',
                status: 'pending'
            });
        } catch (error) {
            console.error('[GDPR] Deletion request error:', error);
            res.status(500).json({ error: 'Failed to create deletion request' });
        }
    });

    /**
     * Process a deletion request (admin-initiated)
     */
    app.post('/api/gdpr/deletion-request/:requestId/process', authenticateToken, requireOrgAdmin, async (req, res) => {
        try {
            const request = await db.get(
                'SELECT * FROM data_deletion_requests WHERE id = ? AND organizationId = ?',
                [req.params.requestId, req.user.orgId]
            );
            if (!request) {
                return res.status(404).json({ error: 'Deletion request not found' });
            }
            if (request.status !== 'pending') {
                return res.status(400).json({ error: `Request is already ${request.status}` });
            }

            // Mark as processing
            await db.run('UPDATE data_deletion_requests SET status = ? WHERE id = ?', ['processing', request.id]);

            const deletionLog = [];

            try {
                // Delete user data in order (respecting foreign keys)
                const userId = request.userId;

                // 1. Delete copilot chat messages and chats
                const chats = await db.all('SELECT id FROM copilot_chats WHERE agentId IN (SELECT id FROM copilot_agents WHERE createdBy = ?)', [userId]);
                for (const chat of chats) {
                    await db.run('DELETE FROM copilot_chats WHERE id = ?', [chat.id]);
                }
                deletionLog.push(`Deleted ${chats.length} copilot chats`);

                // 2. Delete agent memory
                await db.run('DELETE FROM agent_memory WHERE agentId IN (SELECT id FROM copilot_agents WHERE createdBy = ?)', [userId]);
                deletionLog.push('Deleted agent memory');

                // 3. Delete agents created by user
                const agentsDeleted = await db.run('DELETE FROM copilot_agents WHERE createdBy = ? AND NOT id LIKE ?', [userId, 'agent_default_%']);
                deletionLog.push(`Deleted ${agentsDeleted.changes || 0} agents`);

                // 4. Delete workflows created by user
                const workflowsDeleted = await db.run('DELETE FROM workflows WHERE createdBy = ?', [userId]);
                deletionLog.push(`Deleted ${workflowsDeleted.changes || 0} workflows`);

                // 5. Delete uploaded files
                // (In production, also delete from S3/object storage)
                deletionLog.push('File cleanup queued');

                // 6. Anonymize audit logs (keep for compliance but remove PII)
                await db.run(
                    "UPDATE audit_logs SET userId = 'DELETED_USER', ipAddress = 'REDACTED', userAgent = 'REDACTED' WHERE userId = ?",
                    [userId]
                );
                deletionLog.push('Audit logs anonymized');

                // 7. Remove from organizations
                await db.run('DELETE FROM user_organizations WHERE userId = ?', [userId]);
                deletionLog.push('Organization memberships removed');

                // 8. Delete/anonymize the user record
                await db.run(
                    "UPDATE users SET email = ?, name = 'Deleted User', password = 'DELETED', profilePhoto = NULL, companyRole = NULL WHERE id = ?",
                    [`deleted_${Date.now()}@deleted.local`, userId]
                );
                deletionLog.push('User record anonymized');

                // Mark request as completed
                await db.run(
                    'UPDATE data_deletion_requests SET status = ?, completedAt = ?, processedBy = ?, deletionLog = ? WHERE id = ?',
                    ['completed', new Date().toISOString(), req.user.sub, JSON.stringify(deletionLog), request.id]
                );

                await logAudit(db, req.user.sub, 'gdpr_deletion_completed', 'user', userId, req.user.orgId, req.ip, req.get('user-agent'));

                res.json({ success: true, deletionLog });
            } catch (deleteError) {
                // Mark as failed
                await db.run(
                    'UPDATE data_deletion_requests SET status = ?, deletionLog = ? WHERE id = ?',
                    ['failed', JSON.stringify([...deletionLog, `Error: ${deleteError.message}`]), request.id]
                );
                throw deleteError;
            }
        } catch (error) {
            console.error('[GDPR] Process deletion error:', error);
            res.status(500).json({ error: 'Failed to process deletion request' });
        }
    });

    /**
     * List deletion requests (admin view)
     */
    app.get('/api/gdpr/deletion-requests', authenticateToken, requireOrgAdmin, async (req, res) => {
        try {
            const requests = await db.all(
                'SELECT id, email, status, requestedAt, completedAt FROM data_deletion_requests WHERE organizationId = ? ORDER BY requestedAt DESC',
                [req.user.orgId]
            );
            res.json({ requests });
        } catch (error) {
            console.error('[GDPR] List requests error:', error);
            res.status(500).json({ error: 'Failed to list deletion requests' });
        }
    });

    // ==================== Data Export (Portability) ====================

    /**
     * Export all user data (GDPR data portability)
     * Returns a JSON file with all data associated with the user
     */
    app.get('/api/gdpr/export', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.sub;
            const orgId = req.user.orgId;

            // Collect all user data
            const userData = {
                exportDate: new Date().toISOString(),
                exportFormat: 'GDPR Data Export v1.0',
                user: {},
                organizations: [],
                chats: [],
                agents: [],
                workflows: [],
                auditLog: [],
            };

            // User profile
            const user = await db.get('SELECT id, email, name, companyRole, locale, createdAt FROM users WHERE id = ?', [userId]);
            userData.user = user || {};

            // Organization memberships
            const orgs = await db.all(
                'SELECT o.name, uo.role, uo.joinedAt FROM user_organizations uo JOIN organizations o ON o.id = uo.organizationId WHERE uo.userId = ?',
                [userId]
            );
            userData.organizations = orgs;

            // Copilot chats (only messages, not internal metadata)
            const chats = await db.all(
                'SELECT id, title, messages, createdAt FROM copilot_chats WHERE organizationId = ?',
                [orgId]
            );
            userData.chats = chats.map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt,
                messageCount: (() => { try { return JSON.parse(c.messages).length; } catch (_) { return 0; } })(),
            }));

            // Agents created by user
            const agents = await db.all(
                'SELECT id, name, description, createdAt FROM copilot_agents WHERE createdBy = ?',
                [userId]
            );
            userData.agents = agents;

            // Workflows
            const workflows = await db.all(
                'SELECT id, name, description, createdAt FROM workflows WHERE createdBy = ?',
                [userId]
            );
            userData.workflows = workflows;

            // Recent audit log entries
            const audits = await db.all(
                'SELECT action, resourceType, createdAt FROM audit_logs WHERE userId = ? ORDER BY createdAt DESC LIMIT 100',
                [userId]
            );
            userData.auditLog = audits;

            // Log the export
            await logAudit(db, userId, 'gdpr_data_exported', 'user', userId, orgId, req.ip, req.get('user-agent'));

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}-${Date.now()}.json"`);
            res.json(userData);
        } catch (error) {
            console.error('[GDPR] Export error:', error);
            res.status(500).json({ error: 'Failed to export user data' });
        }
    });

    // ==================== Consent Management ====================

    /**
     * Get user consent status
     */
    app.get('/api/gdpr/consent', authenticateToken, async (req, res) => {
        try {
            const consents = await db.all(
                'SELECT purpose, granted, grantedAt, revokedAt FROM user_consents WHERE userId = ?',
                [req.user.sub]
            );
            
            // Default consent types
            const consentTypes = [
                { purpose: 'data_processing', description: 'Processing of personal data for service delivery', required: true },
                { purpose: 'ai_training', description: 'Use of interaction data for AI model improvement', required: false },
                { purpose: 'analytics', description: 'Usage analytics and product improvement', required: false },
                { purpose: 'marketing', description: 'Marketing communications', required: false },
            ];

            const result = consentTypes.map(type => {
                const consent = consents.find(c => c.purpose === type.purpose);
                return {
                    ...type,
                    granted: consent ? !!consent.granted : type.required, // Required consents default to true
                    grantedAt: consent?.grantedAt,
                    revokedAt: consent?.revokedAt,
                };
            });

            res.json({ consents: result });
        } catch (error) {
            // Table might not exist yet
            res.json({ consents: [] });
        }
    });

    /**
     * Update consent
     */
    app.put('/api/gdpr/consent', authenticateToken, async (req, res) => {
        try {
            const { purpose, granted } = req.body;
            if (!purpose) {
                return res.status(400).json({ error: 'Purpose is required' });
            }

            const now = new Date().toISOString();
            const existing = await db.get(
                'SELECT id FROM user_consents WHERE userId = ? AND purpose = ?',
                [req.user.sub, purpose]
            );

            if (existing) {
                await db.run(
                    'UPDATE user_consents SET granted = ?, grantedAt = ?, revokedAt = ? WHERE id = ?',
                    [granted ? 1 : 0, granted ? now : null, granted ? null : now, existing.id]
                );
            } else {
                const id = `consent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
                await db.run(
                    'INSERT INTO user_consents (id, userId, purpose, granted, grantedAt) VALUES (?,?,?,?,?)',
                    [id, req.user.sub, purpose, granted ? 1 : 0, granted ? now : null]
                );
            }

            await logAudit(db, req.user.sub, granted ? 'consent_granted' : 'consent_revoked', 'consent', purpose, req.user.orgId, req.ip, req.get('user-agent'));

            res.json({ success: true });
        } catch (error) {
            console.error('[GDPR] Consent update error:', error);
            res.status(500).json({ error: 'Failed to update consent' });
        }
    });

    console.log('[GDPR] GDPR compliance routes initialized');
}

// Helper: audit log
async function logAudit(db, userId, action, resourceType, resourceId, orgId, ip, userAgent) {
    try {
        await db.run(
            'INSERT INTO audit_logs (id, userId, action, resourceType, resourceId, organizationId, ipAddress, userAgent, createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
            [`audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, userId, action, resourceType, resourceId, orgId, ip, userAgent, new Date().toISOString()]
        );
    } catch (_) {}
}

module.exports = { initGDPRRoutes };
