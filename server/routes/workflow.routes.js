/**
 * Workflow Routes
 * Handles: workflows CRUD, execution, history
 * 
 * All routes use the service layer.
 */

const express = require('express');

function createWorkflowRoutes(authenticateToken, services, repos) {
  const router = express.Router();

  // GET /api/workflows - List workflows
  router.get('/workflows', authenticateToken, async (req, res) => {
    try {
      const workflows = await services.workflow.getAllWorkflows(req.user.orgId);
      res.json(workflows);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ error: 'Failed to fetch workflows' });
    }
  });

  // GET /api/workflows/:id - Get workflow by ID
  router.get('/workflows/:id', authenticateToken, async (req, res) => {
    try {
      const workflow = await services.workflow.getWorkflowById(req.params.id, req.user.orgId);
      if (!workflow) {
        // Check if workflow exists but user doesn't have access
        const exists = await repos.workflow.findByIdUnsafe(req.params.id);
        if (exists) {
          const orgName = await repos.user.findOrgName(exists.organizationId);
          return res.status(403).json({
            error: 'Access denied',
            workflowName: exists.name,
            organizationName: orgName?.name || 'Unknown',
          });
        }
        return res.status(404).json({ error: 'Workflow not found' });
      }
      res.json(workflow);
    } catch (error) {
      console.error('Error fetching workflow:', error);
      res.status(500).json({ error: 'Failed to fetch workflow' });
    }
  });

  // POST /api/workflows - Create workflow
  router.post('/workflows', authenticateToken, async (req, res) => {
    try {
      const workflow = await services.workflow.createWorkflow(
        req.body, req.user.orgId, req.user.sub, req.body.createdByName || req.user.email
      );
      res.status(201).json(workflow);
    } catch (error) {
      console.error('Error creating workflow:', error);
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  });

  // PUT /api/workflows/:id - Update workflow
  router.put('/workflows/:id', authenticateToken, async (req, res) => {
    try {
      const result = await services.workflow.updateWorkflow(
        req.params.id, req.user.orgId, req.body, req.user.sub, req.body.lastEditedByName || req.user.email
      );
      res.json(result);
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ error: 'Failed to update workflow' });
    }
  });

  // DELETE /api/workflows/:id - Delete workflow
  router.delete('/workflows/:id', authenticateToken, async (req, res) => {
    try {
      await services.workflow.deleteWorkflow(req.params.id, req.user.orgId);
      res.json({ message: 'Workflow deleted' });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ error: 'Failed to delete workflow' });
    }
  });

  // POST /api/workflow/:id/execute - Execute workflow
  router.post('/workflow/:id/execute', authenticateToken, async (req, res) => {
    try {
      const result = await services.execution.executeWorkflow(
        req.params.id, req.user.orgId,
        { triggerType: req.body.triggerType || 'manual', inputs: req.body.inputs, userId: req.user.sub }
      );
      res.json(result);
    } catch (error) {
      console.error('Error executing workflow:', error);
      res.status(500).json({ error: 'Failed to execute workflow' });
    }
  });

  // POST /api/workflow/:id/execute-node - Execute single node
  router.post('/workflow/:id/execute-node', authenticateToken, async (req, res) => {
    try {
      const result = await services.execution.executeSingleNode(
        req.params.id, req.body.nodeId, req.body.inputData, req.user.orgId
      );
      res.json(result);
    } catch (error) {
      console.error('Error executing node:', error);
      res.status(500).json({ error: 'Failed to execute node' });
    }
  });

  // GET /api/workflow/execution/:execId - Get execution status
  router.get('/workflow/execution/:execId', authenticateToken, async (req, res) => {
    try {
      const status = await services.execution.getExecutionStatus(req.params.execId);
      res.json(status);
    } catch (error) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      console.error('Error fetching execution:', error);
      res.status(500).json({ error: 'Failed to fetch execution status' });
    }
  });

  // GET /api/workflow/:id/executions - Get execution history
  router.get('/workflow/:id/executions', authenticateToken, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const executions = await services.execution.getExecutionHistory(req.params.id, limit);
      res.json(executions);
    } catch (error) {
      console.error('Error fetching executions:', error);
      res.status(500).json({ error: 'Failed to fetch execution history' });
    }
  });

  // POST /api/workflow/execution/:execId/cancel - Cancel execution
  router.post('/workflow/execution/:execId/cancel', authenticateToken, async (req, res) => {
    try {
      const result = await services.execution.cancelExecution(req.params.execId, req.user.sub);
      res.json(result);
    } catch (error) {
      console.error('Error cancelling execution:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/overview/stats - Overview stats
  router.get('/overview/stats', authenticateToken, async (req, res) => {
    try {
      const stats = await services.workflow.getOverviewStats(req.user.orgId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return router;
}

module.exports = { createWorkflowRoutes };
