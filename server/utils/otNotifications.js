/**
 * OT Notifications Service
 * Handles email/SMS notifications for OT alerts
 */

const nodemailer = require('nodemailer');

class OTNotificationsService {
    constructor(db) {
        this.db = db;
        this.transporter = null;
        this.rateLimitMap = new Map(); // Prevent notification spam
        this.RATE_LIMIT_MINUTES = 5; // Don't send same alert type more than once per 5 minutes
    }

    /**
     * Initialize the email transporter with organization SMTP settings
     */
    async initTransporter(organizationId) {
        try {
            // Get organization's notification settings
            const settings = await this.getNotificationSettings(organizationId);
            
            if (!settings || !settings.smtpEnabled) {
                return null;
            }

            this.transporter = nodemailer.createTransport({
                host: settings.smtpHost || 'smtp.gmail.com',
                port: parseInt(settings.smtpPort) || 587,
                secure: parseInt(settings.smtpPort) === 465,
                auth: {
                    user: settings.smtpUser,
                    pass: settings.smtpPass
                }
            });

            return this.transporter;
        } catch (error) {
            console.error('[OTNotifications] Error initializing transporter:', error);
            return null;
        }
    }

    /**
     * Get notification settings for an organization
     */
    async getNotificationSettings(organizationId) {
        try {
            const row = await this.db.get(
                `SELECT * FROM ot_notification_settings WHERE organizationId = ?`,
                [organizationId]
            );
            
            if (row) {
                return {
                    ...row,
                    emailRecipients: row.emailRecipients ? JSON.parse(row.emailRecipients) : [],
                    alertSeverities: row.alertSeverities ? JSON.parse(row.alertSeverities) : ['error']
                };
            }
            
            return null;
        } catch (error) {
            // Table might not exist yet
            return null;
        }
    }

    /**
     * Save notification settings for an organization
     */
    async saveNotificationSettings(organizationId, settings) {
        try {
            // Ensure table exists
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS ot_notification_settings (
                    id TEXT PRIMARY KEY,
                    organizationId TEXT UNIQUE,
                    smtpEnabled INTEGER DEFAULT 0,
                    smtpHost TEXT,
                    smtpPort TEXT DEFAULT '587',
                    smtpUser TEXT,
                    smtpPass TEXT,
                    emailRecipients TEXT DEFAULT '[]',
                    alertSeverities TEXT DEFAULT '["error"]',
                    emailEnabled INTEGER DEFAULT 1,
                    browserEnabled INTEGER DEFAULT 1,
                    cooldownMinutes INTEGER DEFAULT 5,
                    createdAt TEXT,
                    updatedAt TEXT,
                    FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
                )
            `);

            const now = new Date().toISOString();
            const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.db.run(`
                INSERT OR REPLACE INTO ot_notification_settings 
                (id, organizationId, smtpEnabled, smtpHost, smtpPort, smtpUser, smtpPass, 
                 emailRecipients, alertSeverities, emailEnabled, browserEnabled, cooldownMinutes, createdAt, updatedAt)
                VALUES (
                    COALESCE((SELECT id FROM ot_notification_settings WHERE organizationId = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT createdAt FROM ot_notification_settings WHERE organizationId = ?), ?),
                    ?
                )
            `, [
                organizationId, id,
                organizationId,
                settings.smtpEnabled ? 1 : 0,
                settings.smtpHost || '',
                settings.smtpPort || '587',
                settings.smtpUser || '',
                settings.smtpPass || '',
                JSON.stringify(settings.emailRecipients || []),
                JSON.stringify(settings.alertSeverities || ['error']),
                settings.emailEnabled !== false ? 1 : 0,
                settings.browserEnabled !== false ? 1 : 0,
                settings.cooldownMinutes || 5,
                organizationId, now,
                now
            ]);

            return true;
        } catch (error) {
            console.error('[OTNotifications] Error saving settings:', error);
            throw error;
        }
    }

    /**
     * Check if we should send a notification (rate limiting)
     */
    shouldSendNotification(alertKey) {
        const now = Date.now();
        const lastSent = this.rateLimitMap.get(alertKey);
        
        if (lastSent && (now - lastSent) < (this.RATE_LIMIT_MINUTES * 60 * 1000)) {
            return false;
        }
        
        this.rateLimitMap.set(alertKey, now);
        return true;
    }

    /**
     * Send email notification for an OT alert
     */
    async sendAlertEmail(alert, organizationId) {
        try {
            const settings = await this.getNotificationSettings(organizationId);
            
            if (!settings || !settings.smtpEnabled || !settings.emailEnabled) {
                console.log('[OTNotifications] Email notifications disabled for org:', organizationId);
                return false;
            }

            // Check if this severity should trigger email
            if (!settings.alertSeverities.includes(alert.severity)) {
                console.log('[OTNotifications] Alert severity not configured for email:', alert.severity);
                return false;
            }

            // Rate limit check
            const alertKey = `${organizationId}_${alert.nodeType}_${alert.fieldName}`;
            if (!this.shouldSendNotification(alertKey)) {
                console.log('[OTNotifications] Rate limited, skipping email for:', alertKey);
                return false;
            }

            // Initialize transporter
            await this.initTransporter(organizationId);
            
            if (!this.transporter) {
                console.log('[OTNotifications] No transporter available');
                return false;
            }

            const recipients = settings.emailRecipients;
            if (!recipients || recipients.length === 0) {
                console.log('[OTNotifications] No email recipients configured');
                return false;
            }

            // Build email content
            const severityColor = alert.severity === 'error' ? '#ef4444' : '#f59e0b';
            const severityLabel = alert.severity.toUpperCase();
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                        .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; }
                        .badge-error { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
                        .badge-warning { background: #fffbeb; color: #f59e0b; border: 1px solid #fde68a; }
                        .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
                        .label { color: #6b7280; font-size: 12px; }
                        .value { font-weight: 600; font-size: 14px; }
                        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="margin: 0;">⚠️ OT Alert: ${severityLabel}</h2>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">${alert.nodeType.toUpperCase()} - ${alert.fieldName}</p>
                        </div>
                        <div class="content">
                            <div class="detail">
                                <div class="label">Message</div>
                                <div class="value">${alert.message}</div>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <div class="detail" style="flex: 1;">
                                    <div class="label">Current Value</div>
                                    <div class="value" style="color: ${severityColor};">${alert.value}</div>
                                </div>
                                <div class="detail" style="flex: 1;">
                                    <div class="label">Threshold</div>
                                    <div class="value">
                                        ${alert.threshold?.min !== undefined ? `Min: ${alert.threshold.min}` : ''}
                                        ${alert.threshold?.max !== undefined ? ` Max: ${alert.threshold.max}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="detail">
                                <div class="label">Timestamp</div>
                                <div class="value">${new Date(alert.timestamp).toLocaleString()}</div>
                            </div>
                            <div class="detail">
                                <div class="label">Node ID</div>
                                <div class="value" style="font-family: monospace; font-size: 12px;">${alert.nodeId}</div>
                            </div>
                            <div class="footer">
                                <p>This is an automated alert from Intemic Industrial Monitoring.</p>
                                <p>To manage notification settings, visit your dashboard settings.</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const textContent = `
OT Alert: ${severityLabel}
${alert.nodeType.toUpperCase()} - ${alert.fieldName}

Message: ${alert.message}
Current Value: ${alert.value}
Threshold: ${alert.threshold?.min !== undefined ? `Min: ${alert.threshold.min}` : ''} ${alert.threshold?.max !== undefined ? `Max: ${alert.threshold.max}` : ''}
Timestamp: ${new Date(alert.timestamp).toLocaleString()}
Node ID: ${alert.nodeId}

This is an automated alert from Intemic Industrial Monitoring.
            `;

            // Send email
            const info = await this.transporter.sendMail({
                from: settings.smtpUser,
                to: recipients.join(', '),
                subject: `[${severityLabel}] OT Alert: ${alert.nodeType.toUpperCase()} - ${alert.fieldName}`,
                text: textContent,
                html: htmlContent
            });

            console.log('[OTNotifications] Email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('[OTNotifications] Error sending email:', error);
            return false;
        }
    }

    /**
     * Send a test email to verify SMTP configuration
     */
    async sendTestEmail(organizationId, testEmail) {
        try {
            const settings = await this.getNotificationSettings(organizationId);
            
            if (!settings || !settings.smtpEnabled) {
                return { success: false, message: 'SMTP not configured' };
            }

            await this.initTransporter(organizationId);
            
            if (!this.transporter) {
                return { success: false, message: 'Failed to initialize email transporter' };
            }

            const htmlContent = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>✅ Test Email from Intemic</h2>
                    <p>This is a test email to verify your SMTP configuration for OT alert notifications.</p>
                    <p>If you received this email, your configuration is working correctly.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                        Sent at: ${new Date().toLocaleString()}
                    </p>
                </div>
            `;

            await this.transporter.sendMail({
                from: settings.smtpUser,
                to: testEmail,
                subject: 'Intemic OT Notifications - Test Email',
                text: 'This is a test email to verify your SMTP configuration for OT alert notifications.',
                html: htmlContent
            });

            return { success: true, message: 'Test email sent successfully' };
        } catch (error) {
            console.error('[OTNotifications] Test email error:', error);
            return { success: false, message: error.message };
        }
    }
}

// Singleton instance
let instance = null;

function getOTNotificationsService(db) {
    if (!instance) {
        instance = new OTNotificationsService(db);
    }
    return instance;
}

module.exports = {
    getOTNotificationsService,
    OTNotificationsService
};
