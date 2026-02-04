/**
 * Execution Polling Service
 * 
 * Polls Prefect service for execution status updates and broadcasts
 * progress via WebSocket to the relevant organization.
 */

const { prefectClient } = require('./prefectClient');

class ExecutionPollingService {
    constructor(broadcastFn) {
        this.broadcastToOrganization = broadcastFn;
        this.activePollers = new Map(); // executionId -> { intervalId, orgId, workflowId }
        this.pollInterval = 2000; // 2 seconds
    }

    /**
     * Start polling for an execution
     */
    startPolling(executionId, organizationId, workflowId) {
        if (this.activePollers.has(executionId)) {
            console.log(`[ExecutionPolling] Already polling execution ${executionId}`);
            return;
        }

        console.log(`[ExecutionPolling] Starting poll for execution ${executionId}`);

        const intervalId = setInterval(async () => {
            try {
                await this.pollExecution(executionId, organizationId, workflowId);
            } catch (error) {
                console.error(`[ExecutionPolling] Error polling ${executionId}:`, error.message);
            }
        }, this.pollInterval);

        this.activePollers.set(executionId, {
            intervalId,
            orgId: organizationId,
            workflowId,
            startedAt: new Date()
        });

        // Initial poll immediately
        this.pollExecution(executionId, organizationId, workflowId).catch(console.error);
    }

    /**
     * Stop polling for an execution
     */
    stopPolling(executionId) {
        const poller = this.activePollers.get(executionId);
        if (poller) {
            clearInterval(poller.intervalId);
            this.activePollers.delete(executionId);
            console.log(`[ExecutionPolling] Stopped polling execution ${executionId}`);
        }
    }

    /**
     * Poll a single execution
     */
    async pollExecution(executionId, organizationId, workflowId) {
        try {
            const status = await prefectClient.getExecutionStatus(executionId);

            // Broadcast update via WebSocket
            if (this.broadcastToOrganization) {
                this.broadcastToOrganization(organizationId, {
                    type: 'execution_progress',
                    executionId,
                    workflowId,
                    status: status.status,
                    progress: status.progress,
                    currentNodeId: status.currentNodeId,
                    error: status.error,
                    logs: status.logs || [],
                    timestamp: new Date().toISOString()
                });
            }

            // Stop polling if execution is complete
            if (['completed', 'failed', 'cancelled'].includes(status.status)) {
                console.log(`[ExecutionPolling] Execution ${executionId} finished with status: ${status.status}`);
                
                // Send final status
                if (this.broadcastToOrganization) {
                    this.broadcastToOrganization(organizationId, {
                        type: 'execution_complete',
                        executionId,
                        workflowId,
                        status: status.status,
                        finalOutput: status.finalOutput,
                        error: status.error,
                        progress: status.progress,
                        timestamp: new Date().toISOString()
                    });
                }

                this.stopPolling(executionId);
            }

            return status;

        } catch (error) {
            // If Prefect service is unavailable, stop polling after a few retries
            const poller = this.activePollers.get(executionId);
            if (poller) {
                const elapsed = (new Date() - poller.startedAt) / 1000;
                if (elapsed > 300) { // 5 minutes timeout
                    console.warn(`[ExecutionPolling] Timeout for execution ${executionId}, stopping poll`);
                    this.stopPolling(executionId);
                    
                    if (this.broadcastToOrganization) {
                        this.broadcastToOrganization(organizationId, {
                            type: 'execution_error',
                            executionId,
                            workflowId,
                            error: 'Execution polling timed out',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
            throw error;
        }
    }

    /**
     * Get all active executions
     */
    getActiveExecutions() {
        return Array.from(this.activePollers.entries()).map(([id, data]) => ({
            executionId: id,
            organizationId: data.orgId,
            workflowId: data.workflowId,
            startedAt: data.startedAt
        }));
    }

    /**
     * Stop all polling (for graceful shutdown)
     */
    stopAll() {
        console.log(`[ExecutionPolling] Stopping all ${this.activePollers.size} active pollers`);
        for (const [executionId] of this.activePollers) {
            this.stopPolling(executionId);
        }
    }
}

// Singleton instance (will be initialized with broadcast function)
let pollingService = null;

function initPollingService(broadcastFn) {
    if (!pollingService) {
        pollingService = new ExecutionPollingService(broadcastFn);
    }
    return pollingService;
}

function getPollingService() {
    return pollingService;
}

module.exports = {
    ExecutionPollingService,
    initPollingService,
    getPollingService
};
