/**
 * Execution Service
 * Business logic for workflow execution orchestration.
 * 
 * State machine:
 *   pending -> running -> completed | failed | cancelled
 *   running -> paused (human approval) -> running
 * 
 * Delegates actual execution to Prefect (preferred) or WorkflowExecutor (fallback).
 */

const EXECUTION_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
};

const VALID_TRANSITIONS = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled', 'paused'],
  paused: ['running', 'cancelled'],
  // Terminal states: completed, failed, cancelled
};

class ExecutionService {
  constructor(repos, { prefectClient, workflowExecutor, pollingService } = {}) {
    this.executionRepo = repos.execution;
    this.workflowRepo = repos.workflow;
    this.prefectClient = prefectClient;
    this.workflowExecutor = workflowExecutor;
    this.pollingService = pollingService;
  }

  /**
   * Start workflow execution.
   * Tries Prefect first, falls back to Node.js executor.
   */
  async executeWorkflow(workflowId, orgId, { triggerType = 'manual', inputs = null, userId } = {}) {
    const executionId = this._generateId();
    const now = new Date().toISOString();

    // Create execution record
    await this.executionRepo.create({
      id: executionId,
      workflowId,
      organizationId: orgId,
      status: EXECUTION_STATES.PENDING,
      triggerType,
      inputs,
      createdAt: now,
    });

    // Try Prefect first
    const usePrefect = this.prefectClient && await this._isPrefectAvailable();
    
    if (usePrefect) {
      try {
        await this.prefectClient.executeWorkflow(workflowId, {
          executionId,
          inputs,
          orgId,
          triggerType,
        });
        
        // Start polling for status updates
        if (this.pollingService) {
          this.pollingService.startPolling(executionId);
        }
      } catch (error) {
        console.error('[ExecutionService] Prefect execution failed, falling back:', error.message);
        await this._executeFallback(executionId, workflowId, inputs);
      }
    } else {
      await this._executeFallback(executionId, workflowId, inputs);
    }

    return { executionId, status: EXECUTION_STATES.PENDING };
  }

  /**
   * Execute a single node (for testing).
   */
  async executeSingleNode(workflowId, nodeId, inputData, orgId) {
    const usePrefect = this.prefectClient && await this._isPrefectAvailable();
    
    if (usePrefect) {
      try {
        return await this.prefectClient.executeNode(workflowId, nodeId, inputData);
      } catch {}
    }

    // Fallback
    if (this.workflowExecutor) {
      return this.workflowExecutor.executeSingleNode(workflowId, nodeId, inputData);
    }

    throw new Error('No execution engine available');
  }

  /**
   * Get execution status.
   */
  async getExecutionStatus(executionId) {
    // Try Prefect first for live status
    const usePrefect = this.prefectClient && await this._isPrefectAvailable();
    
    if (usePrefect) {
      try {
        const prefectStatus = await this.prefectClient.getExecutionStatus(executionId);
        if (prefectStatus) return prefectStatus;
      } catch {}
    }

    // Fallback to database
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) throw new Error('Execution not found');

    const logs = await this.executionRepo.findLogsByExecutionId(executionId);
    return { ...execution, logs };
  }

  /**
   * Get execution history for a workflow.
   */
  async getExecutionHistory(workflowId, limit = 20) {
    return this.executionRepo.findByWorkflowId(workflowId, limit);
  }

  /**
   * Cancel a running execution.
   */
  async cancelExecution(executionId, userId) {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) throw new Error('Execution not found');

    this._validateTransition(execution.status, EXECUTION_STATES.CANCELLED);

    await this.executionRepo.cancel(executionId);

    // Try to cancel in Prefect too
    if (this.prefectClient) {
      try { await this.prefectClient.cancelExecution(executionId); } catch {}
    }

    return { executionId, status: EXECUTION_STATES.CANCELLED };
  }

  /**
   * Resume a paused execution (after human approval).
   */
  async resumeExecution(executionId, approved, userId) {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) throw new Error('Execution not found');
    if (execution.status !== EXECUTION_STATES.PAUSED) {
      throw new Error(`Cannot resume execution in status: ${execution.status}`);
    }

    if (!approved) {
      await this.executionRepo.updateStatus(executionId, EXECUTION_STATES.FAILED, {
        error: 'Rejected by user',
        completedAt: new Date().toISOString(),
      });
      return { executionId, status: EXECUTION_STATES.FAILED };
    }

    // Resume execution
    await this.executionRepo.updateStatus(executionId, EXECUTION_STATES.RUNNING);

    // Continue execution in backend
    if (this.workflowExecutor) {
      const workflow = await this.workflowRepo.findByIdUnsafe(execution.workflowId);
      if (workflow) {
        // Continue from paused node...
        // This would need the workflowExecutor to support resume
      }
    }

    return { executionId, status: EXECUTION_STATES.RUNNING };
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  async _isPrefectAvailable() {
    try {
      return await this.prefectClient.isAvailable();
    } catch {
      return false;
    }
  }

  async _executeFallback(executionId, workflowId, inputs) {
    if (!this.workflowExecutor) {
      await this.executionRepo.updateStatus(executionId, EXECUTION_STATES.FAILED, {
        error: 'No execution engine available',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      // Node.js fallback executor
      await this.workflowExecutor.executeWorkflow(workflowId, {
        executionId,
        inputs,
      });
    } catch (error) {
      await this.executionRepo.updateStatus(executionId, EXECUTION_STATES.FAILED, {
        error: error.message,
        completedAt: new Date().toISOString(),
      });
    }
  }

  _validateTransition(currentStatus, newStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed) {
      throw new Error(`Cannot transition from terminal state: ${currentStatus}`);
    }
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition: ${currentStatus} -> ${newStatus}. Allowed: ${allowed.join(', ')}`);
    }
  }

  _generateId() {
    return Math.random().toString(36).substr(2, 12);
  }
}

module.exports = { ExecutionService, EXECUTION_STATES, VALID_TRANSITIONS };
