/**
 * Notification Repository
 * Data access layer for notifications, notification_reads, ot_alerts, alert_configs,
 * audit_logs, node_feedback, pending_approvals, copilot_chats.
 */

class NotificationRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  async findAllForUser(userId, orgId) {
    return this.db.all(
      `SELECT n.*, CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as isRead
       FROM notifications n
       LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
       WHERE n.orgId = ? OR n.userId = ?`,
      [userId, orgId, userId]
    );
  }

  async countUnread(userId, orgId) {
    return this.db.get(
      `SELECT COUNT(*) as count FROM notifications n
       LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
       WHERE (n.orgId = ? OR n.userId = ?) AND nr.id IS NULL`,
      [userId, orgId, userId]
    );
  }

  async markAllRead(userId, orgId) {
    const unread = await this.db.all(
      `SELECT n.id FROM notifications n
       LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
       WHERE (n.orgId = ? OR n.userId = ?) AND nr.id IS NULL`,
      [userId, orgId, userId]
    );
    for (const n of unread) {
      const id = Math.random().toString(36).substr(2, 9);
      await this.db.run(
        'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
        [id, n.id, userId, new Date().toISOString()]
      );
    }
  }

  async markRead(notificationId, userId) {
    const id = Math.random().toString(36).substr(2, 9);
    return this.db.run(
      'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
      [id, notificationId, userId, new Date().toISOString()]
    );
  }

  // ============================================================
  // OT ALERTS
  // ============================================================

  async findOTAlerts(orgId, filters = {}) {
    let query = 'SELECT * FROM ot_alerts WHERE organizationId = ?';
    const params = [orgId];
    if (filters.severity) { query += ' AND severity = ?'; params.push(filters.severity); }
    if (filters.acknowledged === 'true') { query += ' AND acknowledgedAt IS NOT NULL'; }
    if (filters.acknowledged === 'false') { query += ' AND acknowledgedAt IS NULL'; }
    query += ' ORDER BY createdAt DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    return this.db.all(query, params);
  }

  async acknowledgeOTAlert(id, orgId, userId) {
    return this.db.run(
      'UPDATE ot_alerts SET acknowledgedAt = ?, acknowledgedBy = ? WHERE id = ? AND organizationId = ?',
      [new Date().toISOString(), userId, id, orgId]
    );
  }

  // ============================================================
  // ALERT CONFIGS
  // ============================================================

  async findAlertConfigs(orgId, userId) {
    return this.db.all(
      'SELECT * FROM alert_configs WHERE orgId = ? AND (userId = ? OR userId IS NULL) ORDER BY createdAt DESC',
      [orgId, userId]
    );
  }

  async createAlertConfig(data) {
    return this.db.run(
      'INSERT INTO alert_configs (id, orgId, userId, name, type, condition, threshold, entityId, enabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.orgId, data.userId, data.name, data.type, data.condition, data.threshold, data.entityId, data.enabled, data.createdAt]
    );
  }

  async updateAlertConfig(id, orgId, updates) {
    return this.db.run(
      'UPDATE alert_configs SET name = COALESCE(?, name), type = COALESCE(?, type), condition = COALESCE(?, condition), threshold = COALESCE(?, threshold), entityId = COALESCE(?, entityId), enabled = COALESCE(?, enabled) WHERE id = ? AND orgId = ?',
      [updates.name, updates.type, updates.condition, updates.threshold, updates.entityId, updates.enabled, id, orgId]
    );
  }

  async deleteAlertConfig(id, orgId) {
    return this.db.run('DELETE FROM alert_configs WHERE id = ? AND orgId = ?', [id, orgId]);
  }

  // ============================================================
  // AUDIT LOGS (platform-level)
  // ============================================================

  async findAuditLogs(orgId, filters = {}) {
    let query = 'SELECT * FROM audit_logs WHERE organizationId = ?';
    const params = [orgId];
    if (filters.action) { query += ' AND action = ?'; params.push(filters.action); }
    if (filters.resourceType) { query += ' AND resourceType = ?'; params.push(filters.resourceType); }
    if (filters.userId) { query += ' AND userId = ?'; params.push(filters.userId); }
    if (filters.since) { query += ' AND createdAt >= ?'; params.push(filters.since); }
    query += ' ORDER BY createdAt DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    return this.db.all(query, params);
  }

  async createAuditLog(data) {
    return this.db.run(
      'INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, details, ipAddress, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.organizationId, data.userId, data.userName, data.userEmail, data.action, data.resourceType, data.resourceId, data.resourceName, data.details, data.ipAddress, data.userAgent, data.createdAt]
    );
  }

  async getAuditStats(orgId, since) {
    const byAction = await this.db.all(
      'SELECT action, COUNT(*) as count FROM audit_logs WHERE organizationId = ? AND createdAt >= ? GROUP BY action ORDER BY count DESC',
      [orgId, since]
    );
    const byResource = await this.db.all(
      'SELECT resourceType, COUNT(*) as count FROM audit_logs WHERE organizationId = ? AND createdAt >= ? GROUP BY resourceType ORDER BY count DESC',
      [orgId, since]
    );
    const byUser = await this.db.all(
      'SELECT userId, userName, COUNT(*) as count FROM audit_logs WHERE organizationId = ? AND createdAt >= ? AND userId IS NOT NULL GROUP BY userId ORDER BY count DESC LIMIT 10',
      [orgId, since]
    );
    const byDay = await this.db.all(
      'SELECT DATE(createdAt) as date, COUNT(*) as count FROM audit_logs WHERE organizationId = ? AND createdAt >= ? GROUP BY DATE(createdAt) ORDER BY date ASC',
      [orgId, since]
    );
    const total = await this.db.get(
      'SELECT COUNT(*) as count FROM audit_logs WHERE organizationId = ? AND createdAt >= ?',
      [orgId, since]
    );
    return { byAction, byResource, byUser, byDay, total: total?.count || 0 };
  }

  async getAuditFilters(orgId) {
    const actions = await this.db.all('SELECT DISTINCT action FROM audit_logs WHERE organizationId = ? ORDER BY action', [orgId]);
    const resourceTypes = await this.db.all('SELECT DISTINCT resourceType FROM audit_logs WHERE organizationId = ? ORDER BY resourceType', [orgId]);
    const users = await this.db.all('SELECT DISTINCT userId, userName FROM audit_logs WHERE organizationId = ? AND userId IS NOT NULL ORDER BY userName', [orgId]);
    return { actions, resourceTypes, users };
  }

  async deleteAuditLogsByUser(userId) {
    return this.db.run('DELETE FROM audit_logs WHERE userId = ?', [userId]);
  }

  // ============================================================
  // NODE FEEDBACK
  // ============================================================

  async createNodeFeedback(data) {
    return this.db.run(
      'INSERT INTO node_feedback (id, nodeType, nodeLabel, feedbackText, userId, userName, userEmail, organizationId, workflowId, workflowName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.nodeType, data.nodeLabel, data.feedbackText, data.userId, data.userName, data.userEmail, data.organizationId, data.workflowId, data.workflowName, data.createdAt]
    );
  }

  async findAllNodeFeedback() {
    return this.db.all(
      'SELECT nf.*, o.name as organizationName FROM node_feedback nf LEFT JOIN organizations o ON nf.organizationId = o.id ORDER BY nf.createdAt DESC'
    );
  }

  async deleteNodeFeedback(id) {
    return this.db.run('DELETE FROM node_feedback WHERE id = ?', [id]);
  }

  async deleteNodeFeedbackByUser(userId) {
    return this.db.run('DELETE FROM node_feedback WHERE userId = ?', [userId]);
  }

  // ============================================================
  // PENDING APPROVALS
  // ============================================================

  async findPendingApprovals(userId, orgId) {
    return this.db.all(
      `SELECT pa.*, w.name as workflowName
       FROM pending_approvals pa
       LEFT JOIN workflows w ON pa.workflowId = w.id
       WHERE pa.assignedUserId = ? AND pa.status = 'pending' AND pa.organizationId = ?
       ORDER BY pa.createdAt DESC`,
      [userId, orgId]
    );
  }

  async createApproval(data) {
    return this.db.run(
      "INSERT INTO pending_approvals (id, workflowId, nodeId, nodeLabel, assignedUserId, assignedUserName, status, createdAt, inputDataPreview, organizationId) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
      [data.id, data.workflowId, data.nodeId, data.nodeLabel, data.assignedUserId, data.assignedUserName, data.createdAt, data.inputDataPreview, data.organizationId]
    );
  }

  async approveApproval(id, userId, orgId) {
    return this.db.run(
      "UPDATE pending_approvals SET status = 'approved', updatedAt = ? WHERE id = ? AND assignedUserId = ? AND organizationId = ?",
      [new Date().toISOString(), id, userId, orgId]
    );
  }

  async rejectApproval(id, userId, orgId) {
    return this.db.run(
      "UPDATE pending_approvals SET status = 'rejected', updatedAt = ? WHERE id = ? AND assignedUserId = ? AND organizationId = ?",
      [new Date().toISOString(), id, userId, orgId]
    );
  }

  // ============================================================
  // COPILOT CHATS
  // ============================================================

  async findChatsByOrg(orgId) {
    return this.db.all('SELECT * FROM copilot_chats WHERE organizationId = ? ORDER BY updatedAt DESC', [orgId]);
  }

  async findChatById(chatId, orgId) {
    return this.db.get('SELECT * FROM copilot_chats WHERE id = ? AND organizationId = ?', [chatId, orgId]);
  }

  async createChat(data) {
    return this.db.run(
      'INSERT INTO copilot_chats (id, userId, organizationId, title, messages, instructions, allowedEntities, isFavorite, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.userId, data.organizationId, data.title, data.messages, data.instructions, data.allowedEntities, data.isFavorite, data.tags, data.createdAt, data.updatedAt]
    );
  }

  async updateChat(chatId, data) {
    return this.db.run(
      'UPDATE copilot_chats SET title = ?, messages = ?, instructions = ?, allowedEntities = ?, isFavorite = ?, tags = ?, updatedAt = ? WHERE id = ?',
      [data.title, data.messages, data.instructions, data.allowedEntities, data.isFavorite, data.tags, data.updatedAt, chatId]
    );
  }

  async deleteChat(chatId) {
    return this.db.run('DELETE FROM copilot_chats WHERE id = ?', [chatId]);
  }
}

module.exports = { NotificationRepository };
