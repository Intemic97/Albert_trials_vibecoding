/**
 * Execution Repository
 * Data access layer for workflow_executions and execution_logs tables.
 * 
 * Execution states: pending -> running -> completed | failed | cancelled
 *                   running -> paused (human approval) -> running
 */

const VALID_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'];

class ExecutionRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // WORKFLOW EXECUTIONS
  // ============================================================

  async findById(executionId) {
    return this.db.get('SELECT * FROM workflow_executions WHERE id = ?', [executionId]);
  }

  async findByIdAndOrg(executionId, orgId) {
    return this.db.get('SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?', [executionId, orgId]);
  }

  async findByWorkflowId(workflowId, limit = 20) {
    return this.db.all(
      `SELECT id, status, triggerType, inputs, nodeResults, finalOutput, createdAt, startedAt, completedAt, error
       FROM workflow_executions WHERE workflowId = ? ORDER BY createdAt DESC LIMIT ?`,
      [workflowId, limit]
    );
  }

  async findLatestByWorkflow(workflowId, orgId) {
    return this.db.get(
      'SELECT * FROM workflow_executions WHERE workflowId = ? AND organizationId = ? ORDER BY createdAt DESC LIMIT 1',
      [workflowId, orgId]
    );
  }

  async create({ id, workflowId, organizationId, status = 'pending', triggerType = 'manual', inputs, createdAt }) {
    return this.db.run(
      `INSERT INTO workflow_executions (id, workflowId, organizationId, status, triggerType, inputs, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, workflowId, organizationId, status, triggerType, inputs ? JSON.stringify(inputs) : null, createdAt || new Date().toISOString()]
    );
  }

  async updateStatus(executionId, status, extras = {}) {
    const fields = ['status = ?'];
    const params = [status];

    if (extras.error) { fields.push('error = ?'); params.push(extras.error); }
    if (extras.completedAt) { fields.push('completedAt = ?'); params.push(extras.completedAt); }
    if (extras.startedAt) { fields.push('startedAt = ?'); params.push(extras.startedAt); }
    if (extras.nodeResults) { fields.push('nodeResults = ?'); params.push(JSON.stringify(extras.nodeResults)); }
    if (extras.finalOutput) { fields.push('finalOutput = ?'); params.push(JSON.stringify(extras.finalOutput)); }
    if (extras.currentNodeId !== undefined) { fields.push('currentNodeId = ?'); params.push(extras.currentNodeId); }

    params.push(executionId);
    return this.db.run(`UPDATE workflow_executions SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async cancel(executionId) {
    return this.db.run(
      `UPDATE workflow_executions SET status = 'cancelled', error = 'Execution cancelled by user', completedAt = ? WHERE id = ? AND status IN ('pending', 'running')`,
      [new Date().toISOString(), executionId]
    );
  }

  // Stats for overview
  async countByOrg(orgId) {
    return this.db.get(
      'SELECT COUNT(*) as count FROM workflow_executions WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)',
      [orgId]
    );
  }

  async countByOrgAndStatus(orgId, status) {
    return this.db.get(
      `SELECT COUNT(*) as count FROM workflow_executions WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?) AND status = ?`,
      [orgId, status]
    );
  }

  async dailyExecutionsByOrg(orgId, since) {
    return this.db.all(
      `SELECT DATE(createdAt) as date, COUNT(*) as count
       FROM workflow_executions
       WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)
       AND createdAt >= ?
       GROUP BY DATE(createdAt) ORDER BY date ASC`,
      [orgId, since]
    );
  }

  // ============================================================
  // EXECUTION LOGS
  // ============================================================

  async findLogsByExecutionId(executionId) {
    return this.db.all('SELECT * FROM execution_logs WHERE executionId = ? ORDER BY timestamp ASC', [executionId]);
  }

  async createLog({ id, executionId, nodeId, nodeType, status, inputData, outputData, error, duration, timestamp }) {
    return this.db.run(
      `INSERT INTO execution_logs (id, executionId, nodeId, nodeType, status, inputData, outputData, error, duration, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, executionId, nodeId, nodeType, status, 
       inputData ? JSON.stringify(inputData) : null,
       outputData ? JSON.stringify(outputData) : null,
       error, duration, timestamp || new Date().toISOString()]
    );
  }
}

module.exports = { ExecutionRepository, VALID_STATUSES };
