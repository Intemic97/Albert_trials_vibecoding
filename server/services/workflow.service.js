/**
 * Workflow Service
 * Business logic for workflow CRUD, validation.
 * Uses WorkflowRepository for data access.
 */

class WorkflowService {
  constructor(repos) {
    this.workflowRepo = repos.workflow;
    this.executionRepo = repos.execution;
  }

  async getAllWorkflows(orgId) {
    return this.workflowRepo.findAllByOrg(orgId);
  }

  async getWorkflowById(id, orgId) {
    const workflow = await this.workflowRepo.findById(id, orgId);
    if (!workflow) return null;
    // Parse data if stored as string
    if (typeof workflow.data === 'string') {
      try { workflow.data = JSON.parse(workflow.data); } catch {}
    }
    return workflow;
  }

  async createWorkflow(data, orgId, userId, userName) {
    const now = new Date().toISOString();
    const workflow = {
      id: data.id || this._generateId(),
      organizationId: orgId,
      name: data.name || 'Untitled Workflow',
      data: typeof data.data === 'string' ? data.data : JSON.stringify(data.data || { nodes: [], connections: [] }),
      tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags || []),
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      createdByName: userName,
    };
    await this.workflowRepo.create(workflow);
    return workflow;
  }

  async updateWorkflow(id, orgId, data, userId, userName) {
    const now = new Date().toISOString();
    await this.workflowRepo.update(id, orgId, {
      name: data.name,
      data: typeof data.data === 'string' ? data.data : JSON.stringify(data.data),
      tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags || []),
      updatedAt: now,
      lastEditedBy: userId,
      lastEditedByName: userName,
    });
    return { id, updatedAt: now };
  }

  async deleteWorkflow(id, orgId) {
    const workflow = await this.workflowRepo.findNameByIdAndOrg(id, orgId);
    if (!workflow) throw new Error('Workflow not found');
    await this.workflowRepo.delete(id, orgId);
    return workflow;
  }

  // Overview stats
  async getOverviewStats(orgId) {
    const workflowCount = await this.workflowRepo.countByOrg(orgId);
    const executionCount = await this.executionRepo.countByOrg(orgId);
    
    // Daily executions for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyExecutions = await this.executionRepo.dailyExecutionsByOrg(orgId, sevenDaysAgo.toISOString());
    
    // Recent workflows
    let recentWorkflows;
    try {
      recentWorkflows = await this.workflowRepo.findRecentWithExecutionStats(orgId);
    } catch {
      const basic = await this.workflowRepo.findAllByOrg(orgId);
      recentWorkflows = basic.slice(0, 10).map(w => ({
        ...w, executionCount: 0, lastExecutionAt: null,
        runningCount: 0, completedCount: 0, failedCount: 0,
      }));
    }

    const runningCount = await this.executionRepo.countByOrgAndStatus(orgId, 'running');
    const completedCount = await this.executionRepo.countByOrgAndStatus(orgId, 'completed');

    return {
      activeWorkflows: workflowCount?.count || 0,
      eventsTriggered: executionCount?.count || 0,
      eventsChange: 0,
      dailyExecutions,
      recentWorkflows,
      runningExecutions: runningCount?.count || 0,
      completedExecutions: completedCount?.count || 0,
    };
  }

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { WorkflowService };
