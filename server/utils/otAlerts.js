/**
 * OT Alerts Manager
 * Detects out-of-range values and generates alerts for OT data
 */

const crypto = require('crypto');

class OTAlertsManager {
    constructor(db, broadcastToOrganizationFn = null) {
        this.db = db;
        this.alertHistory = new Map(); // Track recent alerts to avoid spam
        this.broadcastToOrganization = broadcastToOrganizationFn; // WebSocket broadcast function
    }

    /**
     * Check if a value is outside configured thresholds
     */
    checkThreshold(value, threshold) {
        if (threshold === null || threshold === undefined) {
            return { isAlert: false };
        }

        const { min, max, operator } = threshold;

        if (operator === 'gt' && value > max) {
            return { isAlert: true, severity: 'error', message: `Value ${value} exceeds maximum threshold ${max}` };
        }
        if (operator === 'lt' && value < min) {
            return { isAlert: true, severity: 'error', message: `Value ${value} below minimum threshold ${min}` };
        }
        if (operator === 'range' && (value < min || value > max)) {
            return { isAlert: true, severity: 'error', message: `Value ${value} outside range [${min}, ${max}]` };
        }
        if (operator === 'warning_gt' && value > max * 0.8) {
            return { isAlert: true, severity: 'warning', message: `Value ${value} approaching maximum threshold ${max}` };
        }
        if (operator === 'warning_lt' && value < min * 1.2) {
            return { isAlert: true, severity: 'warning', message: `Value ${value} approaching minimum threshold ${min}` };
        }

        return { isAlert: false };
    }

    /**
     * Process OT data and check for alerts
     */
    async processAlerts(nodeId, nodeType, outputData, alertConfig, organizationId, userId) {
        if (!alertConfig || !alertConfig.enabled) {
            return [];
        }

        const alerts = [];
        const timestamp = new Date().toISOString();
        const alertKey = `${nodeId}_${timestamp}`;

        // Prevent duplicate alerts within cooldown period
        const cooldown = alertConfig.cooldown || 60000; // 1 minute default
        if (this.alertHistory.has(alertKey)) {
            const lastAlert = this.alertHistory.get(alertKey);
            if (Date.now() - lastAlert.timestamp < cooldown) {
                return []; // Skip duplicate alert
            }
        }

        // Extract values from outputData based on node type
        const values = this.extractValues(outputData, nodeType);

        // Check each configured threshold
        for (const [fieldName, threshold] of Object.entries(alertConfig.thresholds || {})) {
            const value = values[fieldName];
            
            if (value === null || value === undefined) {
                continue; // Skip missing values
            }

            const check = this.checkThreshold(value, threshold);
            
            if (check.isAlert) {
                const alert = {
                    id: crypto.randomBytes(8).toString('hex'),
                    nodeId,
                    nodeType,
                    fieldName,
                    value,
                    threshold,
                    severity: check.severity || 'error',
                    message: check.message || `Alert: ${fieldName} = ${value}`,
                    timestamp,
                    organizationId,
                    userId
                };

                alerts.push(alert);
                this.alertHistory.set(alertKey, { timestamp: Date.now(), alert });
            }
        }

        // Clean old alert history (keep last 1000 entries)
        if (this.alertHistory.size > 1000) {
            const entries = Array.from(this.alertHistory.entries());
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            this.alertHistory.clear();
            entries.slice(0, 1000).forEach(([key, value]) => {
                this.alertHistory.set(key, value);
            });
        }

        return alerts;
    }

    /**
     * Extract numeric values from OT output data
     */
    extractValues(outputData, nodeType) {
        const values = {};

        if (!outputData) {
            return values;
        }

        switch (nodeType) {
            case 'opcua':
                // OPC UA: values object contains nodeId -> value mappings
                if (outputData.values) {
                    Object.assign(values, outputData.values);
                }
                // Also check raw array
                if (outputData.raw && Array.isArray(outputData.raw)) {
                    outputData.raw.forEach(item => {
                        if (item.nodeId && item.value !== undefined) {
                            values[item.nodeId] = item.value;
                        }
                    });
                }
                break;

            case 'mqtt':
                // MQTT: topicData contains topic -> value mappings
                if (outputData.topicData) {
                    Object.assign(values, outputData.topicData);
                }
                // Also check messages array
                if (outputData.messages && Array.isArray(outputData.messages)) {
                    outputData.messages.forEach(msg => {
                        if (msg.payload && typeof msg.payload === 'object') {
                            Object.assign(values, msg.payload);
                        } else if (typeof msg.payload === 'number') {
                            values[msg.topic] = msg.payload;
                        }
                    });
                }
                break;

            case 'modbus':
                // Modbus: registers object contains address -> value mappings
                if (outputData.registers) {
                    Object.assign(values, outputData.registers);
                }
                // Also check raw array
                if (outputData.raw && Array.isArray(outputData.raw)) {
                    outputData.raw.forEach(item => {
                        if (item.address !== undefined && item.value !== undefined) {
                            values[`address_${item.address}`] = item.value;
                        }
                    });
                }
                break;

            case 'scada':
                // SCADA: tags object contains tag -> value mappings
                if (outputData.tags) {
                    Object.assign(values, outputData.tags);
                }
                break;

            default:
                // Generic: try to extract numeric values from any object
                if (typeof outputData === 'object') {
                    Object.entries(outputData).forEach(([key, value]) => {
                        if (typeof value === 'number') {
                            values[key] = value;
                        } else if (typeof value === 'object' && value !== null) {
                            // Recursively extract from nested objects
                            Object.assign(values, this.extractValues(value, 'generic'));
                        }
                    });
                }
        }

        return values;
    }

    /**
     * Create notification from alert
     */
    async createNotification(alert, organizationId, userId) {
        try {
            const notificationId = crypto.randomBytes(8).toString('hex');
            const now = new Date().toISOString();

            await this.db.run(
                `INSERT INTO notifications (id, orgId, userId, type, title, message, metadata, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    notificationId,
                    organizationId,
                    userId,
                    alert.severity === 'error' ? 'error' : 'warning',
                    `OT Alert: ${alert.nodeType.toUpperCase()} - ${alert.fieldName}`,
                    alert.message,
                    JSON.stringify({
                        nodeId: alert.nodeId,
                        nodeType: alert.nodeType,
                        fieldName: alert.fieldName,
                        value: alert.value,
                        threshold: alert.threshold,
                        alertId: alert.id
                    }),
                    now
                ]
            );

            return notificationId;
        } catch (error) {
            console.error('[OTAlerts] Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Save alert to database
     */
    async saveAlert(alert, organizationId) {
        try {
            // Check if alerts table exists, if not create it
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS ot_alerts (
                    id TEXT PRIMARY KEY,
                    organizationId TEXT,
                    nodeId TEXT,
                    nodeType TEXT,
                    fieldName TEXT,
                    value REAL,
                    threshold TEXT,
                    severity TEXT,
                    message TEXT,
                    metadata TEXT,
                    createdAt TEXT,
                    acknowledgedAt TEXT,
                    acknowledgedBy TEXT,
                    FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
                )
            `);

            await this.db.run(
                `INSERT INTO ot_alerts (id, organizationId, nodeId, nodeType, fieldName, value, threshold, severity, message, metadata, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    alert.id,
                    organizationId,
                    alert.nodeId,
                    alert.nodeType,
                    alert.fieldName,
                    alert.value,
                    JSON.stringify(alert.threshold),
                    alert.severity,
                    alert.message,
                    JSON.stringify({ timestamp: alert.timestamp }),
                    alert.timestamp
                ]
            );

            return alert.id;
        } catch (error) {
            console.error('[OTAlerts] Error saving alert:', error);
            throw error;
        }
    }

    /**
     * Process alerts for a node execution result
     */
    async processNodeAlerts(node, outputData, organizationId, userId) {
        const alertConfig = node.config?.alerts;
        
        if (!alertConfig || !alertConfig.enabled) {
            return [];
        }

        const alerts = await this.processAlerts(
            node.id,
            node.type,
            outputData,
            alertConfig,
            organizationId,
            userId
        );

        // Save alerts and create notifications
        for (const alert of alerts) {
            try {
                await this.saveAlert(alert, organizationId);
                await this.createNotification(alert, organizationId, userId);
                
                // Broadcast alert via WebSocket if available
                if (this.broadcastToOrganization) {
                    try {
                        this.broadcastToOrganization(organizationId, {
                            type: 'ot_alert',
                            alert: {
                                id: alert.id,
                                nodeId: alert.nodeId,
                                nodeType: alert.nodeType,
                                fieldName: alert.fieldName,
                                value: alert.value,
                                threshold: alert.threshold,
                                severity: alert.severity,
                                message: alert.message,
                                timestamp: alert.timestamp
                            }
                        });
                    } catch (wsError) {
                        console.error('[OTAlerts] Error broadcasting alert via WebSocket:', wsError);
                        // Don't fail if WebSocket broadcast fails
                    }
                }
            } catch (error) {
                console.error(`[OTAlerts] Error processing alert ${alert.id}:`, error);
            }
        }

        return alerts;
    }
}

// Singleton instance
let instance = null;

function getOTAlertsManager(db, broadcastToOrganizationFn = null) {
    if (!instance) {
        instance = new OTAlertsManager(db, broadcastToOrganizationFn);
    } else if (broadcastToOrganizationFn && !instance.broadcastToOrganization) {
        // Update broadcast function if provided and not set
        instance.broadcastToOrganization = broadcastToOrganizationFn;
    }
    return instance;
}

module.exports = {
    getOTAlertsManager,
    OTAlertsManager
};
