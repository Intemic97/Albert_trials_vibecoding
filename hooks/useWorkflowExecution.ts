/**
 * useWorkflowExecution Hook
 * 
 * Replaces frontend execution logic in Workflows.tsx.
 * All execution happens on the backend (Prefect or Node.js).
 * Frontend only calls API and polls for status updates.
 * 
 * Architecture:
 *   1. User clicks "Run" -> POST /api/workflow/:id/execute
 *   2. Backend creates execution record, delegates to Prefect/Node.js
 *   3. Frontend polls GET /api/workflow/execution/:execId every 2s
 *   4. Node status updates are reflected in UI from backend response
 *   5. Execution completes -> stop polling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../config';

export interface NodeStatus {
  nodeId: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
  result?: string;
  data?: any;
  error?: string;
  duration?: number;
}

export interface ExecutionState {
  executionId: string | null;
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  nodeStatuses: Map<string, NodeStatus>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  progress: number; // 0-100
}

const POLL_INTERVAL = 2000; // 2 seconds

export function useWorkflowExecution(workflowId: string | null) {
  const [state, setState] = useState<ExecutionState>({
    executionId: null,
    status: 'idle',
    nodeStatuses: new Map(),
    error: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Poll execution status
  const pollStatus = useCallback(async (execId: string) => {
    try {
      const res = await fetch(`${API_BASE}/workflow/execution/${execId}`, {
        credentials: 'include',
      });

      if (!res.ok) return;

      const data = await res.json();

      // Parse node results into status map
      const nodeStatuses = new Map<string, NodeStatus>();
      if (data.nodeResults) {
        const results = typeof data.nodeResults === 'string' 
          ? JSON.parse(data.nodeResults) 
          : data.nodeResults;
        
        if (typeof results === 'object') {
          for (const [nodeId, result] of Object.entries(results as Record<string, any>)) {
            nodeStatuses.set(nodeId, {
              nodeId,
              status: result.status || 'completed',
              result: result.result,
              data: result.data,
              error: result.error,
              duration: result.duration,
            });
          }
        }
      }

      // Parse logs for more detailed status
      if (data.logs && Array.isArray(data.logs)) {
        for (const log of data.logs) {
          if (!nodeStatuses.has(log.nodeId)) {
            nodeStatuses.set(log.nodeId, {
              nodeId: log.nodeId,
              status: log.status === 'completed' ? 'completed' : log.status === 'error' ? 'error' : 'running',
              result: log.outputData,
              error: log.error,
              duration: log.duration,
            });
          }
        }
      }

      // Calculate progress
      const totalNodes = nodeStatuses.size || 1;
      const completedNodes = Array.from(nodeStatuses.values()).filter(
        n => n.status === 'completed' || n.status === 'error'
      ).length;
      const progress = Math.round((completedNodes / totalNodes) * 100);

      setState(prev => ({
        ...prev,
        executionId: execId,
        status: data.status || prev.status,
        nodeStatuses,
        error: data.error || null,
        startedAt: data.startedAt || prev.startedAt,
        completedAt: data.completedAt || null,
        progress,
      }));

      // Stop polling if execution is done
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        stopPolling();
      }
    } catch (error) {
      console.error('[useWorkflowExecution] Poll error:', error);
    }
  }, [stopPolling]);

  // Start polling
  const startPolling = useCallback((execId: string) => {
    stopPolling();
    isPollingRef.current = true;

    // Poll immediately
    pollStatus(execId);

    // Then every 2 seconds
    pollingRef.current = setInterval(() => {
      if (isPollingRef.current) {
        pollStatus(execId);
      }
    }, POLL_INTERVAL);
  }, [pollStatus, stopPolling]);

  // Execute workflow
  const executeWorkflow = useCallback(async (inputs?: any) => {
    if (!workflowId) return null;

    setState({
      executionId: null,
      status: 'pending',
      nodeStatuses: new Map(),
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      progress: 0,
    });

    try {
      const res = await fetch(`${API_BASE}/workflow/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, triggerType: 'manual' }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        setState(prev => ({ ...prev, status: 'failed', error: error.error || 'Execution failed' }));
        return null;
      }

      const data = await res.json();
      const execId = data.executionId;

      setState(prev => ({
        ...prev,
        executionId: execId,
        status: 'running',
      }));

      // Start polling for status
      startPolling(execId);

      return execId;
    } catch (error: any) {
      setState(prev => ({ ...prev, status: 'failed', error: error.message }));
      return null;
    }
  }, [workflowId, startPolling]);

  // Execute single node (for testing)
  const executeSingleNode = useCallback(async (nodeId: string, inputData?: any) => {
    if (!workflowId) return null;

    setState(prev => {
      const nodeStatuses = new Map(prev.nodeStatuses);
      nodeStatuses.set(nodeId, { nodeId, status: 'running' });
      return { ...prev, nodeStatuses };
    });

    try {
      const res = await fetch(`${API_BASE}/workflow/${workflowId}/execute-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, inputData }),
        credentials: 'include',
      });

      const data = await res.json();

      setState(prev => {
        const nodeStatuses = new Map(prev.nodeStatuses);
        nodeStatuses.set(nodeId, {
          nodeId,
          status: res.ok ? 'completed' : 'error',
          result: data.result,
          data: data.data,
          error: data.error,
        });
        return { ...prev, nodeStatuses };
      });

      return data;
    } catch (error: any) {
      setState(prev => {
        const nodeStatuses = new Map(prev.nodeStatuses);
        nodeStatuses.set(nodeId, { nodeId, status: 'error', error: error.message });
        return { ...prev, nodeStatuses };
      });
      return null;
    }
  }, [workflowId]);

  // Cancel execution
  const cancelExecution = useCallback(async () => {
    if (!state.executionId) return;

    try {
      await fetch(`${API_BASE}/workflow/execution/${state.executionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      stopPolling();
      setState(prev => ({ ...prev, status: 'cancelled' }));
    } catch (error) {
      console.error('[useWorkflowExecution] Cancel error:', error);
    }
  }, [state.executionId, stopPolling]);

  // Reset state
  const reset = useCallback(() => {
    stopPolling();
    setState({
      executionId: null,
      status: 'idle',
      nodeStatuses: new Map(),
      error: null,
      startedAt: null,
      completedAt: null,
      progress: 0,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    // State
    ...state,
    isRunning: state.status === 'running' || state.status === 'pending',
    isComplete: state.status === 'completed',
    isFailed: state.status === 'failed',

    // Actions
    executeWorkflow,
    executeSingleNode,
    cancelExecution,
    reset,

    // Get node status
    getNodeStatus: (nodeId: string) => state.nodeStatuses.get(nodeId),
  };
}
