/**
 * Shared helper functions used across route modules
 */

/**
 * Generate a short unique ID
 */
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Log an activity to the audit_logs table
 */
async function logActivity(db, {
    organizationId,
    userId,
    userName,
    userEmail,
    action,
    resourceType,
    resourceId,
    resourceName,
    details,
    ipAddress,
    userAgent
}) {
    try {
        const id = generateId();
        await db.run(
            `INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, details, ipAddress, userAgent, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, 
             details ? JSON.stringify(details) : null, ipAddress, userAgent, new Date().toISOString()]
        );
        return id;
    } catch (error) {
        console.error('Error logging activity:', error);
        return null;
    }
}

module.exports = {
    generateId,
    logActivity
};

