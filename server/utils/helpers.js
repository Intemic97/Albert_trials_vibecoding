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

/**
 * Log a security event (cross-tenant access attempt, blocked request, etc.)
 * These are stored in audit_logs with action prefixed by 'security_'
 * 
 * For cross-tenant events, details should contain { targetOrg } — the actual
 * resource owner org. The log is stored under targetOrg so org admins can see
 * the intrusion attempt. The attacker's orgId is stored in details.
 */
async function logSecurityEvent(db, {
    organizationId,
    userId,
    userEmail,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress,
    userAgent
}) {
    try {
        const id = generateId();
        const securityAction = action.startsWith('security_') ? action : `security_${action}`;
        // Enrich details with the attacker's org for forensics
        const enrichedDetails = {
            ...(details || {}),
            attackerOrg: organizationId,
            attackerUserId: userId,
            attackerEmail: userEmail
        };
        console.warn(`[SECURITY] ${securityAction}: user=${userId || 'anonymous'} org=${organizationId || 'none'} resource=${resourceType}/${resourceId} ip=${ipAddress} details=${JSON.stringify(enrichedDetails)}`);
        // Store under the TARGET org (resource owner) so their admins see it.
        // If targetOrg is not provided, fall back to attacker's org (best-effort).
        const storeOrgId = (details && details.targetOrg) ? details.targetOrg : organizationId;
        // userId is set to NULL because the attacker may not exist in our users table
        // (foreign key constraint). Attacker identity is stored in details JSON.
        await db.run(
            `INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, details, ipAddress, userAgent, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, storeOrgId, null, null, null, securityAction, resourceType, resourceId, null,
             JSON.stringify(enrichedDetails), ipAddress, userAgent, new Date().toISOString()]
        );
        return id;
    } catch (error) {
        // Security logging should never block the request — fail silently but log to console
        console.error('[SECURITY] Failed to write security audit log:', error.message);
        return null;
    }
}

module.exports = {
    generateId,
    logActivity,
    logSecurityEvent
};

