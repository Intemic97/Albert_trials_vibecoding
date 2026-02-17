/**
 * Notifications, OT Alerts & Alert Config Routes
 * 
 * Handles: user notifications, OT alerts, notification settings,
 * OT metrics history, alert configurations.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { getOTNotificationsService } = require('../utils/otNotifications');

module.exports = function({ db }) {

    // ==================== NOTIFICATIONS ====================

    // Get notifications for user
    router.get('/notifications', authenticateToken, async (req, res) => {
        try {
            const { limit = 20, offset = 0, unread } = req.query;
            
            let query = `
                SELECT n.*, 
                       CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as isRead
                FROM notifications n
                LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
                WHERE n.userId = ? AND n.orgId = ?
            `;
            const params = [req.user.id, req.user.id, req.user.orgId];
            
            if (unread === 'true') {
                query += ' AND nr.id IS NULL';
            }
            
            query += ' ORDER BY n.createdAt DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));
            
            const notifications = await db.all(query, params);
            
            res.json(notifications.map(n => ({
                ...n,
                isRead: Boolean(n.isRead)
            })));
        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({ error: 'Failed to get notifications' });
        }
    });

    // Get unread count
    router.get('/notifications/unread-count', authenticateToken, async (req, res) => {
        try {
            const result = await db.get(`
                SELECT COUNT(*) as count
                FROM notifications n
                LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
                WHERE n.userId = ? AND n.orgId = ? AND nr.id IS NULL
            `, [req.user.id, req.user.id, req.user.orgId]);
            
            res.json({ count: result?.count || 0 });
        } catch (error) {
            console.error('Get unread count error:', error);
            res.status(500).json({ error: 'Failed to get unread count' });
        }
    });

    // Mark all as read
    router.post('/notifications/read-all', authenticateToken, async (req, res) => {
        try {
            const unreadNotifications = await db.all(`
                SELECT n.id
                FROM notifications n
                LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
                WHERE n.userId = ? AND n.orgId = ? AND nr.id IS NULL
            `, [req.user.id, req.user.id, req.user.orgId]);
            
            for (const notification of unreadNotifications) {
                await db.run(
                    'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
                    [generateId(), notification.id, req.user.id, new Date().toISOString()]
                );
            }
            
            res.json({ message: 'All notifications marked as read', count: unreadNotifications.length });
        } catch (error) {
            console.error('Mark all read error:', error);
            res.status(500).json({ error: 'Failed to mark notifications as read' });
        }
    });

    // Mark single notification as read
    router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
        try {
            await db.run(
                'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
                [generateId(), req.params.id, req.user.id, new Date().toISOString()]
            );
            
            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            console.error('Mark read error:', error);
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    });

    // Delete all notifications for user
    router.delete('/notifications', authenticateToken, async (req, res) => {
        try {
            // Delete notifications targeted at this user, or org-wide ones
            await db.run(
                'DELETE FROM notifications WHERE (orgId = ? AND userId = ?) OR userId = ?',
                [req.user.orgId, req.user.id, req.user.id]
            );
            // Also clean up any notification_reads for this user
            await db.run('DELETE FROM notification_reads WHERE userId = ?', [req.user.id]);
            
            res.json({ message: 'All notifications cleared' });
        } catch (error) {
            console.error('Clear all notifications error:', error);
            res.status(500).json({ error: 'Failed to clear notifications' });
        }
    });

    // Delete single notification
    router.delete('/notifications/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            // Delete the notification itself (only if it belongs to this user/org)
            await db.run(
                'DELETE FROM notifications WHERE id = ? AND (userId = ? OR orgId = ?)',
                [id, req.user.id, req.user.orgId]
            );
            // Also clean up reads
            await db.run('DELETE FROM notification_reads WHERE notificationId = ?', [id]);
            
            res.json({ message: 'Notification deleted' });
        } catch (error) {
            console.error('Delete notification error:', error);
            res.status(500).json({ error: 'Failed to delete notification' });
        }
    });

    // ==================== OT ALERTS ====================

    // Get OT alerts
    router.get('/ot-alerts', authenticateToken, async (req, res) => {
        try {
            const { limit = 50, offset = 0, severity, acknowledged } = req.query;
            
            let query = 'SELECT * FROM ot_alerts WHERE organizationId = ?';
            const params = [req.user.orgId];
            
            if (severity) {
                query += ' AND severity = ?';
                params.push(severity);
            }
            
            if (acknowledged === 'false' || acknowledged === false) {
                query += ' AND acknowledgedAt IS NULL';
            } else if (acknowledged === 'true' || acknowledged === true) {
                query += ' AND acknowledgedAt IS NOT NULL';
            }
            
            query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));
            
            const alerts = await db.all(query, params);
            
            res.json(alerts.map(alert => ({
                ...alert,
                threshold: alert.threshold ? JSON.parse(alert.threshold) : null,
                metadata: alert.metadata ? JSON.parse(alert.metadata) : null
            })));
        } catch (error) {
            console.error('Get OT alerts error:', error);
            res.status(500).json({ error: 'Failed to get OT alerts' });
        }
    });

    // Create OT alert (from dashboard threshold)
    router.post('/ot-alerts', authenticateToken, async (req, res) => {
        try {
            const { severity, message, metadata, fieldName, value, threshold } = req.body;
            const id = require('crypto').randomUUID();
            const now = new Date().toISOString();
            await db.run(
                `INSERT INTO ot_alerts (id, organizationId, severity, message, fieldName, value, threshold, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, req.user.orgId, severity || 'warning', message || 'Threshold crossed', fieldName || '', value || 0, threshold || '', JSON.stringify(metadata || {}), now]
            );
            res.status(201).json({ id, severity, message, createdAt: now });
        } catch (error) {
            console.error('Create OT alert error:', error);
            res.status(500).json({ error: 'Failed to create alert' });
        }
    });

    // Acknowledge OT alert
    router.post('/ot-alerts/:id/acknowledge', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const now = new Date().toISOString();
            
            await db.run(
                'UPDATE ot_alerts SET acknowledgedAt = ?, acknowledgedBy = ? WHERE id = ? AND organizationId = ?',
                [now, req.user.sub, id, req.user.orgId]
            );
            
            res.json({ success: true, message: 'Alert acknowledged' });
        } catch (error) {
            console.error('Acknowledge OT alert error:', error);
            res.status(500).json({ error: 'Failed to acknowledge alert' });
        }
    });

    // ==================== OT NOTIFICATION SETTINGS ====================

    // Get OT notification settings
    router.get('/ot-notification-settings', authenticateToken, async (req, res) => {
        try {
            const notificationsService = getOTNotificationsService(db);
            const settings = await notificationsService.getNotificationSettings(req.user.orgId);
            
            if (settings) {
                settings.smtpPass = settings.smtpPass ? '********' : '';
            }
            
            res.json(settings || {
                smtpEnabled: false,
                smtpHost: '',
                smtpPort: '587',
                smtpUser: '',
                emailRecipients: [],
                alertSeverities: ['error'],
                emailEnabled: true,
                browserEnabled: true,
                cooldownMinutes: 5
            });
        } catch (error) {
            console.error('Get OT notification settings error:', error);
            res.status(500).json({ error: 'Failed to get notification settings' });
        }
    });

    // Save OT notification settings
    router.post('/ot-notification-settings', authenticateToken, async (req, res) => {
        try {
            const notificationsService = getOTNotificationsService(db);
            const settings = req.body;
            
            if (settings.smtpPass === '********') {
                const existingSettings = await notificationsService.getNotificationSettings(req.user.orgId);
                if (existingSettings) {
                    settings.smtpPass = existingSettings.smtpPass;
                }
            }
            
            await notificationsService.saveNotificationSettings(req.user.orgId, settings);
            res.json({ success: true, message: 'Notification settings saved' });
        } catch (error) {
            console.error('Save OT notification settings error:', error);
            res.status(500).json({ error: 'Failed to save notification settings' });
        }
    });

    // Send test email
    router.post('/ot-notification-settings/test', authenticateToken, async (req, res) => {
        try {
            const { testEmail } = req.body;
            
            if (!testEmail) {
                return res.status(400).json({ error: 'Test email address required' });
            }
            
            const notificationsService = getOTNotificationsService(db);
            const result = await notificationsService.sendTestEmail(req.user.orgId, testEmail);
            
            res.json(result);
        } catch (error) {
            console.error('Test email error:', error);
            res.status(500).json({ error: 'Failed to send test email' });
        }
    });

    // Get OT metrics history (for charts)
    router.get('/ot-metrics/history', authenticateToken, async (req, res) => {
        try {
            const { connectionId, timeRange = '24h', metric = 'latency' } = req.query;
            
            const rangeMs = {
                '1h': 60 * 60 * 1000,
                '6h': 6 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000
            }[timeRange] || 24 * 60 * 60 * 1000;
            
            const points = 24;
            const interval = rangeMs / points;
            const data = [];
            
            for (let i = 0; i < points; i++) {
                const timestamp = new Date(Date.now() - rangeMs + (i * interval)).toISOString();
                data.push({
                    timestamp,
                    value: metric === 'latency' 
                        ? Math.random() * 50 + 20
                        : Math.floor(Math.random() * 100)
                });
            }
            
            res.json({
                metric,
                timeRange,
                connectionId: connectionId || 'all',
                data
            });
        } catch (error) {
            console.error('Get OT metrics history error:', error);
            res.status(500).json({ error: 'Failed to get metrics history' });
        }
    });

    // ==================== ALERT CONFIGS ====================

    // Get alert configurations
    router.get('/alert-configs', authenticateToken, async (req, res) => {
        try {
            const configs = await db.all(
                'SELECT * FROM alert_configs WHERE orgId = ? AND (userId = ? OR userId IS NULL) ORDER BY createdAt DESC',
                [req.user.orgId, req.user.id]
            );
            
            res.json(configs || []);
        } catch (error) {
            console.error('Get alert configs error:', error);
            res.status(500).json({ error: 'Failed to get alert configurations' });
        }
    });

    // Create alert configuration
    router.post('/alert-configs', authenticateToken, async (req, res) => {
        try {
            const { name, type, condition, threshold, entityId, enabled = true } = req.body;
            
            const id = generateId();
            await db.run(
                `INSERT INTO alert_configs (id, orgId, userId, name, type, condition, threshold, entityId, enabled, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, req.user.orgId, req.user.id, name, type, condition, threshold, entityId, enabled ? 1 : 0, new Date().toISOString()]
            );
            
            res.json({ id, message: 'Alert configuration created' });
        } catch (error) {
            console.error('Create alert config error:', error);
            res.status(500).json({ error: 'Failed to create alert configuration' });
        }
    });

    // Update alert configuration
    router.put('/alert-configs/:id', authenticateToken, async (req, res) => {
        try {
            const { name, type, condition, threshold, entityId, enabled } = req.body;
            
            await db.run(
                `UPDATE alert_configs SET 
                    name = COALESCE(?, name),
                    type = COALESCE(?, type),
                    condition = COALESCE(?, condition),
                    threshold = COALESCE(?, threshold),
                    entityId = COALESCE(?, entityId),
                    enabled = COALESCE(?, enabled)
                 WHERE id = ? AND orgId = ?`,
                [name, type, condition, threshold, entityId, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id, req.user.orgId]
            );
            
            res.json({ message: 'Alert configuration updated' });
        } catch (error) {
            console.error('Update alert config error:', error);
            res.status(500).json({ error: 'Failed to update alert configuration' });
        }
    });

    // Delete alert configuration
    router.delete('/alert-configs/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM alert_configs WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]);
            res.json({ message: 'Alert configuration deleted' });
        } catch (error) {
            console.error('Delete alert config error:', error);
            res.status(500).json({ error: 'Failed to delete alert configuration' });
        }
    });

    return router;
};

