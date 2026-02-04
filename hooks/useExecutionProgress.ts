/**
 * Hook for tracking workflow execution progress via WebSocket
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const WS_URL = API_BASE.replace('http', 'ws').replace('/api', '') + '/ws';

export interface ExecutionProgress {
    executionId: string;
    workflowId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: {
        totalNodes: number;
        completedNodes: number;
        failedNodes: number;
        percentage: number;
    };
    currentNodeId?: string;
    error?: string;
    logs?: Array<{
        nodeId: string;
        nodeType: string;
        nodeLabel: string;
        status: string;
        timestamp: string;
    }>;
}

interface UseExecutionProgressOptions {
    onProgress?: (progress: ExecutionProgress) => void;
    onComplete?: (progress: ExecutionProgress) => void;
    onError?: (error: string, executionId: string) => void;
}

export function useExecutionProgress(options: UseExecutionProgressOptions = {}) {
    const { token, currentOrg } = useAuth();
    const [activeExecutions, setActiveExecutions] = useState<Map<string, ExecutionProgress>>(new Map());
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

    // Connect to WebSocket
    useEffect(() => {
        if (!token || !currentOrg?.id) return;

        const connectWs = () => {
            try {
                const ws = new WebSocket(WS_URL);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('[ExecutionProgress] WebSocket connected');
                    // Authenticate
                    ws.send(JSON.stringify({
                        type: 'auth',
                        token
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        switch (data.type) {
                            case 'execution_progress':
                                handleProgress(data);
                                break;
                            case 'execution_complete':
                                handleComplete(data);
                                break;
                            case 'execution_error':
                                handleError(data);
                                break;
                        }
                    } catch (e) {
                        console.error('[ExecutionProgress] Error parsing message:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('[ExecutionProgress] WebSocket error:', error);
                };

                ws.onclose = () => {
                    console.log('[ExecutionProgress] WebSocket closed, reconnecting...');
                    reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
                };
            } catch (error) {
                console.error('[ExecutionProgress] Failed to connect WebSocket:', error);
                reconnectTimeoutRef.current = setTimeout(connectWs, 5000);
            }
        };

        connectWs();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [token, currentOrg?.id]);

    const handleProgress = useCallback((data: any) => {
        const progress: ExecutionProgress = {
            executionId: data.executionId,
            workflowId: data.workflowId,
            status: data.status,
            progress: data.progress,
            currentNodeId: data.currentNodeId,
            error: data.error,
            logs: data.logs
        };

        setActiveExecutions(prev => {
            const next = new Map(prev);
            next.set(data.executionId, progress);
            return next;
        });

        options.onProgress?.(progress);
    }, [options.onProgress]);

    const handleComplete = useCallback((data: any) => {
        const progress: ExecutionProgress = {
            executionId: data.executionId,
            workflowId: data.workflowId,
            status: data.status,
            progress: data.progress,
            error: data.error
        };

        setActiveExecutions(prev => {
            const next = new Map(prev);
            next.delete(data.executionId);
            return next;
        });

        options.onComplete?.(progress);
    }, [options.onComplete]);

    const handleError = useCallback((data: any) => {
        setActiveExecutions(prev => {
            const next = new Map(prev);
            next.delete(data.executionId);
            return next;
        });

        options.onError?.(data.error, data.executionId);
    }, [options.onError]);

    // Get progress for a specific execution
    const getExecution = useCallback((executionId: string): ExecutionProgress | undefined => {
        return activeExecutions.get(executionId);
    }, [activeExecutions]);

    // Get progress for a specific workflow
    const getWorkflowExecution = useCallback((workflowId: string): ExecutionProgress | undefined => {
        for (const execution of activeExecutions.values()) {
            if (execution.workflowId === workflowId) {
                return execution;
            }
        }
        return undefined;
    }, [activeExecutions]);

    // Check if a workflow is currently executing
    const isExecuting = useCallback((workflowId: string): boolean => {
        for (const execution of activeExecutions.values()) {
            if (execution.workflowId === workflowId && 
                ['pending', 'running'].includes(execution.status)) {
                return true;
            }
        }
        return false;
    }, [activeExecutions]);

    return {
        activeExecutions: Array.from(activeExecutions.values()),
        getExecution,
        getWorkflowExecution,
        isExecuting
    };
}

export default useExecutionProgress;
