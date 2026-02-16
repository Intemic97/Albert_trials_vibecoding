import { useState, useCallback, useRef } from 'react';
import { WorkflowNode, Connection, WorkflowExecution } from '../types';

interface ExecutionState {
  isRunning: boolean;
  isPaused: boolean;
  currentNodeId: string | null;
  progress: number;
  startTime: number | null;
  error: string | null;
}

interface UseWorkflowExecutionReturn {
  executionState: ExecutionState;
  executionHistory: WorkflowExecution[];
  startExecution: () => Promise<void>;
  pauseExecution: () => void;
  resumeExecution: () => void;
  stopExecution: () => void;
  resetExecution: () => void;
  setExecutionError: (error: string | null) => void;
  addToHistory: (execution: WorkflowExecution) => void;
  clearHistory: () => void;
}

interface UseWorkflowExecutionOptions {
  nodes: WorkflowNode[];
  connections: Connection[];
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, result: any) => void;
  onNodeError?: (nodeId: string, error: string) => void;
  onExecutionComplete?: (duration: number) => void;
  onExecutionError?: (error: string) => void;
}

/**
 * Hook for managing workflow execution state
 */
export const useWorkflowExecution = (options: UseWorkflowExecutionOptions): UseWorkflowExecutionReturn => {
  const {
    nodes,
    connections,
    onNodeStart,
    onNodeComplete,
    onNodeError,
    onExecutionComplete,
    onExecutionError,
  } = options;

  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    isPaused: false,
    currentNodeId: null,
    progress: 0,
    startTime: null,
    error: null,
  });

  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);

  // Get execution order (topological sort)
  const getExecutionOrder = useCallback((): WorkflowNode[] => {
    const visited = new Set<string>();
    const order: WorkflowNode[] = [];
    
    // Find root nodes (no incoming connections)
    const rootNodes = nodes.filter(node => 
      !connections.some(conn => conn.toNodeId === node.id)
    );

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // Visit all nodes that this node connects to
      const outgoing = connections
        .filter(conn => conn.fromNodeId === nodeId)
        .map(conn => conn.toNodeId);
      
      outgoing.forEach(visit);
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) order.unshift(node);
    };

    rootNodes.forEach(node => visit(node.id));
    
    return order;
  }, [nodes, connections]);

  // Start workflow execution
  const startExecution = useCallback(async () => {
    abortControllerRef.current = new AbortController();
    pausedRef.current = false;
    
    setExecutionState({
      isRunning: true,
      isPaused: false,
      currentNodeId: null,
      progress: 0,
      startTime: Date.now(),
      error: null,
    });

    const executionOrder = getExecutionOrder();
    const totalNodes = executionOrder.length;

    try {
      for (let i = 0; i < executionOrder.length; i++) {
        // Check for abort
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Execution aborted');
        }

        // Wait while paused
        while (pausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Execution aborted');
          }
        }

        const node = executionOrder[i];
        
        setExecutionState(prev => ({
          ...prev,
          currentNodeId: node.id,
          progress: ((i + 1) / totalNodes) * 100,
        }));

        onNodeStart?.(node.id);

        // Simulate node execution (actual execution logic would go here)
        await new Promise(resolve => setTimeout(resolve, 100));

        onNodeComplete?.(node.id, null);
      }

      const duration = Date.now() - (executionState.startTime || Date.now());
      onExecutionComplete?.(duration);

      setExecutionState(prev => ({
        ...prev,
        isRunning: false,
        currentNodeId: null,
        progress: 100,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setExecutionState(prev => ({
        ...prev,
        isRunning: false,
        error: errorMessage,
      }));

      onExecutionError?.(errorMessage);
    }
  }, [getExecutionOrder, onNodeStart, onNodeComplete, onExecutionComplete, onExecutionError, executionState.startTime]);

  // Pause execution
  const pauseExecution = useCallback(() => {
    pausedRef.current = true;
    setExecutionState(prev => ({ ...prev, isPaused: true }));
  }, []);

  // Resume execution
  const resumeExecution = useCallback(() => {
    pausedRef.current = false;
    setExecutionState(prev => ({ ...prev, isPaused: false }));
  }, []);

  // Stop execution
  const stopExecution = useCallback(() => {
    abortControllerRef.current?.abort();
    setExecutionState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      currentNodeId: null,
    }));
  }, []);

  // Reset execution state
  const resetExecution = useCallback(() => {
    abortControllerRef.current?.abort();
    setExecutionState({
      isRunning: false,
      isPaused: false,
      currentNodeId: null,
      progress: 0,
      startTime: null,
      error: null,
    });
  }, []);

  // Set execution error
  const setExecutionError = useCallback((error: string | null) => {
    setExecutionState(prev => ({ ...prev, error }));
  }, []);

  // Add execution to history
  const addToHistory = useCallback((execution: WorkflowExecution) => {
    setExecutionHistory(prev => [execution, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  // Clear execution history
  const clearHistory = useCallback(() => {
    setExecutionHistory([]);
  }, []);

  return {
    executionState,
    executionHistory,
    startExecution,
    pauseExecution,
    resumeExecution,
    stopExecution,
    resetExecution,
    setExecutionError,
    addToHistory,
    clearHistory,
  };
};
