/**
 * Dashboard Repository
 * Data access layer for dashboards, widgets, dashboard_workflow_connections.
 */

class DashboardRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // DASHBOARDS
  // ============================================================

  async findAllByOrg(orgId) {
    return this.db.all(
      'SELECT id, name, description, isPublic, shareToken, createdAt, updatedAt FROM dashboards WHERE organizationId = ? ORDER BY updatedAt DESC',
      [orgId]
    );
  }

  async findById(id, orgId) {
    return this.db.get('SELECT * FROM dashboards WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findNameById(id, orgId) {
    return this.db.get('SELECT name FROM dashboards WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findIdByOrg(id, orgId) {
    return this.db.get('SELECT id FROM dashboards WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findByShareToken(token) {
    return this.db.get('SELECT id, name, description, createdAt FROM dashboards WHERE shareToken = ? AND isPublic = 1', [token]);
  }

  async countAll() {
    return this.db.get('SELECT COUNT(*) as count FROM dashboards');
  }

  async create({ id, organizationId, name, description, createdBy, createdAt, updatedAt }) {
    return this.db.run(
      'INSERT INTO dashboards (id, organizationId, name, description, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, name, description, createdBy, createdAt, updatedAt]
    );
  }

  async update(id, orgId, { name, description, updatedAt }) {
    return this.db.run(
      'UPDATE dashboards SET name = ?, description = ?, updatedAt = ? WHERE id = ? AND organizationId = ?',
      [name, description, updatedAt, id, orgId]
    );
  }

  async delete(id, orgId) {
    return this.db.run('DELETE FROM dashboards WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async deleteByCreator(userId) {
    return this.db.run('DELETE FROM dashboards WHERE createdBy = ?', [userId]);
  }

  async setPublic(id, orgId, shareToken, updatedAt) {
    return this.db.run(
      'UPDATE dashboards SET isPublic = 1, shareToken = ?, updatedAt = ? WHERE id = ? AND organizationId = ?',
      [shareToken, updatedAt, id, orgId]
    );
  }

  async setPrivate(id, orgId, updatedAt) {
    return this.db.run(
      'UPDATE dashboards SET isPublic = 0, shareToken = NULL, updatedAt = ? WHERE id = ? AND organizationId = ?',
      [updatedAt, id, orgId]
    );
  }

  async touch(id) {
    return this.db.run('UPDATE dashboards SET updatedAt = ? WHERE id = ?', [new Date().toISOString(), id]);
  }

  // ============================================================
  // WIDGETS
  // ============================================================

  async findWidgetsByDashboard(dashboardId) {
    return this.db.all(
      'SELECT id, title, description, config, position, gridX, gridY, gridWidth, gridHeight, dataSource, workflowConnectionId, createdAt FROM widgets WHERE dashboardId = ? ORDER BY position ASC',
      [dashboardId]
    );
  }

  async findWidgetByIdWithOrgCheck(widgetId, orgId) {
    return this.db.get(
      'SELECT w.id FROM widgets w JOIN dashboards d ON w.dashboardId = d.id WHERE w.id = ? AND d.organizationId = ?',
      [widgetId, orgId]
    );
  }

  async findWidgetInDashboard(widgetId, dashboardId) {
    return this.db.get('SELECT id FROM widgets WHERE id = ? AND dashboardId = ?', [widgetId, dashboardId]);
  }

  async createWidget({ id, dashboardId, title, description, config, position, gridX, gridY, gridWidth, gridHeight, createdAt }) {
    return this.db.run(
      'INSERT INTO widgets (id, dashboardId, title, description, config, position, gridX, gridY, gridWidth, gridHeight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, dashboardId, title, description, config, position, gridX, gridY, gridWidth, gridHeight, createdAt]
    );
  }

  async deleteWidget(widgetId) {
    return this.db.run('DELETE FROM widgets WHERE id = ?', [widgetId]);
  }

  async updateWidgetGrid(widgetId, { gridX, gridY, gridWidth, gridHeight }) {
    return this.db.run(
      'UPDATE widgets SET gridX = ?, gridY = ?, gridWidth = ?, gridHeight = ? WHERE id = ?',
      [gridX, gridY, gridWidth, gridHeight, widgetId]
    );
  }

  async updateWidgetConnection(widgetId, { workflowConnectionId, dataSource }) {
    return this.db.run(
      'UPDATE widgets SET workflowConnectionId = ?, dataSource = ? WHERE id = ?',
      [workflowConnectionId, dataSource, widgetId]
    );
  }

  async getMaxWidgetPosition(dashboardId) {
    return this.db.get('SELECT MAX(position) as maxPos FROM widgets WHERE dashboardId = ?', [dashboardId]);
  }

  // ============================================================
  // WORKFLOW CONNECTIONS
  // ============================================================

  async findConnectionByWidget(widgetId) {
    return this.db.get('SELECT id FROM dashboard_workflow_connections WHERE widgetId = ?', [widgetId]);
  }

  async findConnectionWithOrgCheck(widgetId, orgId) {
    return this.db.get(
      'SELECT c.*, d.organizationId FROM dashboard_workflow_connections c JOIN dashboards d ON c.dashboardId = d.id WHERE c.widgetId = ? AND d.organizationId = ?',
      [widgetId, orgId]
    );
  }

  async createConnection({ id, dashboardId, widgetId, workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, createdAt, updatedAt }) {
    return this.db.run(
      'INSERT INTO dashboard_workflow_connections (id, dashboardId, widgetId, workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, dashboardId, widgetId, workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, createdAt, updatedAt]
    );
  }

  async updateConnection(widgetId, { workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, updatedAt }) {
    return this.db.run(
      'UPDATE dashboard_workflow_connections SET workflowId = ?, nodeId = ?, executionId = ?, outputPath = ?, refreshMode = ?, refreshInterval = ?, updatedAt = ? WHERE widgetId = ?',
      [workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, updatedAt, widgetId]
    );
  }
}

module.exports = { DashboardRepository };
