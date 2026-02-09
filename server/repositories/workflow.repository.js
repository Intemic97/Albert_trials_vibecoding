/**
 * Workflow Repository
 * Data access layer for workflows table.
 */

class WorkflowRepository {
  constructor(db) {
    this.db = db;
  }

  async findAllByOrg(orgId) {
    return this.db.all(
      'SELECT id, name, createdAt, updatedAt, createdBy, createdByName, lastEditedBy, lastEditedByName, tags FROM workflows WHERE organizationId = ? ORDER BY updatedAt DESC',
      [orgId]
    );
  }

  async findById(id, orgId) {
    return this.db.get('SELECT * FROM workflows WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findByIdUnsafe(id) {
    return this.db.get('SELECT * FROM workflows WHERE id = ?', [id]);
  }

  async findNameById(id) {
    return this.db.get('SELECT name FROM workflows WHERE id = ?', [id]);
  }

  async findNameByIdAndOrg(id, orgId) {
    return this.db.get('SELECT name FROM workflows WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findOrgId(workflowId) {
    const row = await this.db.get('SELECT organizationId FROM workflows WHERE id = ?', [workflowId]);
    return row?.organizationId;
  }

  async findPublicById(id) {
    return this.db.get('SELECT id, name, data FROM workflows WHERE id = ?', [id]);
  }

  async countByOrg(orgId) {
    return this.db.get('SELECT COUNT(*) as count FROM workflows WHERE organizationId = ?', [orgId]);
  }

  async countAll() {
    return this.db.get('SELECT COUNT(*) as count FROM workflows');
  }

  async create({ id, organizationId, name, data, tags, createdAt, updatedAt, createdBy, createdByName }) {
    return this.db.run(
      'INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt, createdBy, createdByName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, name, data, tags, createdAt, updatedAt, createdBy, createdByName]
    );
  }

  async update(id, orgId, { name, data, tags, updatedAt, lastEditedBy, lastEditedByName }) {
    return this.db.run(
      'UPDATE workflows SET name = ?, data = ?, tags = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ? WHERE id = ? AND organizationId = ?',
      [name, data, tags, updatedAt, lastEditedBy, lastEditedByName, id, orgId]
    );
  }

  async delete(id, orgId) {
    return this.db.run('DELETE FROM workflows WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async deleteByCreator(userId) {
    return this.db.run('DELETE FROM workflows WHERE createdBy = ?', [userId]);
  }

  // Overview stats: recent workflows with execution counts
  async findRecentWithExecutionStats(orgId, limit = 10) {
    return this.db.all(
      `SELECT w.id, w.name, w.updatedAt,
        COALESCE(COUNT(e.id), 0) as executionCount,
        MAX(e.createdAt) as lastExecutionAt,
        COALESCE(SUM(CASE WHEN e.status = 'running' THEN 1 ELSE 0 END), 0) as runningCount,
        COALESCE(SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END), 0) as completedCount,
        COALESCE(SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END), 0) as failedCount
      FROM workflows w
      LEFT JOIN workflow_executions e ON w.id = e.workflowId
      WHERE w.organizationId = ?
      GROUP BY w.id, w.name, w.updatedAt
      ORDER BY COALESCE(MAX(e.createdAt), w.updatedAt) DESC
      LIMIT ?`,
      [orgId, limit]
    );
  }

  // Access request: get workflow with org info
  async findWithOrgInfo(workflowId) {
    return this.db.get(
      `SELECT w.name, w.organizationId, o.name as organizationName
       FROM workflows w LEFT JOIN organizations o ON w.organizationId = o.id
       WHERE w.id = ?`,
      [workflowId]
    );
  }
}

module.exports = { WorkflowRepository };
