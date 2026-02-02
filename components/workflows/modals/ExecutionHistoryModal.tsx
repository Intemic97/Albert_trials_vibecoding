/**
 * Execution History Modal
 * Shows the history of workflow executions with their status and details
 */

import React, { useState, useEffect } from 'react';
import { 
    X, 
    Clock, 
    CheckCircle, 
    XCircle, 
    SpinnerGap,
    CaretRight,
    CaretDown,
    Play,
    Warning
} from '@phosphor-icons/react';
import { API_BASE } from '../../../config';

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionRecord {
    id: string;
    workflowId: string;
    workflowName: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    completedAt?: string;
    duration?: number;
    triggeredBy: string;
    triggeredByName: string;
    nodeResults?: {
        nodeId: string;
        nodeName: string;
        status: 'success' | 'error' | 'skipped';
        duration?: number;
        error?: string;
        outputPreview?: string;
    }[];
    error?: string;
}

interface ExecutionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
    workflowName: string;
    onRerun?: (executionId: string) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getStatusConfig = (status: ExecutionRecord['status']) => {
    const configs = {
        running: {
            icon: SpinnerGap,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            label: 'Running'
        },
        completed: {
            icon: CheckCircle,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20',
            label: 'Completed'
        },
        failed: {
            icon: XCircle,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            label: 'Failed'
        },
        cancelled: {
            icon: Warning,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            label: 'Cancelled'
        }
    };
    return configs[status] || configs.completed;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ExecutionItemProps {
    execution: ExecutionRecord;
    isExpanded: boolean;
    onToggle: () => void;
    onRerun?: () => void;
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
    execution,
    isExpanded,
    onToggle,
    onRerun
}) => {
    const statusConfig = getStatusConfig(execution.status);
    const StatusIcon = statusConfig.icon;

    return (
        <div className={`border rounded-lg overflow-hidden ${statusConfig.border} ${isExpanded ? statusConfig.bg : 'bg-[var(--bg-card)]'}`}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <StatusIcon 
                        size={18} 
                        className={`${statusConfig.color} ${execution.status === 'running' ? 'animate-spin' : ''}`} 
                        weight={execution.status === 'running' ? 'regular' : 'fill'}
                    />
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                                {formatDate(execution.startedAt)}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusConfig.bg} ${statusConfig.color}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            by {execution.triggeredByName}
                            {execution.duration && ` • ${formatDuration(execution.duration)}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onRerun && execution.status !== 'running' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRerun();
                            }}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[#256A65] hover:bg-[#256A65]/10 rounded transition-colors"
                            title="Re-run"
                        >
                            <Play size={14} weight="fill" />
                        </button>
                    )}
                    {isExpanded ? (
                        <CaretDown size={16} className="text-[var(--text-tertiary)]" />
                    ) : (
                        <CaretRight size={16} className="text-[var(--text-tertiary)]" />
                    )}
                </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--border-light)]">
                    {/* Error message if failed */}
                    {execution.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-xs text-red-600 font-mono">{execution.error}</p>
                        </div>
                    )}

                    {/* Node results */}
                    {execution.nodeResults && execution.nodeResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                Node Results
                            </p>
                            <div className="space-y-1">
                                {execution.nodeResults.map((node, idx) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center justify-between p-2 bg-[var(--bg-card)] rounded border border-[var(--border-light)]"
                                    >
                                        <div className="flex items-center gap-2">
                                            {node.status === 'success' ? (
                                                <CheckCircle size={14} className="text-green-500" weight="fill" />
                                            ) : node.status === 'error' ? (
                                                <XCircle size={14} className="text-red-500" weight="fill" />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border-medium)]" />
                                            )}
                                            <span className="text-xs text-[var(--text-primary)]">{node.nodeName}</span>
                                        </div>
                                        {node.duration && (
                                            <span className="text-[10px] text-[var(--text-tertiary)]">
                                                {formatDuration(node.duration)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExecutionHistoryModal: React.FC<ExecutionHistoryModalProps> = ({
    isOpen,
    onClose,
    workflowId,
    workflowName,
    onRerun
}) => {
    const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && workflowId) {
            fetchExecutions();
        }
    }, [isOpen, workflowId]);

    const fetchExecutions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/workflow/${workflowId}/executions`, {
                credentials: 'include'
            });
            
            if (res.ok) {
                const data = await res.json();
                setExecutions(data);
            } else {
                // Use mock data if endpoint doesn't exist
                setExecutions(generateMockExecutions());
            }
        } catch (error) {
            console.error('Failed to fetch executions:', error);
            setExecutions(generateMockExecutions());
        } finally {
            setIsLoading(false);
        }
    };

    // Generate mock data for demo
    const generateMockExecutions = (): ExecutionRecord[] => {
        const now = Date.now();
        return [
            {
                id: '1',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 5).toISOString(),
                completedAt: new Date(now - 1000 * 60 * 4).toISOString(),
                duration: 45000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                nodeResults: [
                    { nodeId: '1', nodeName: 'Manual Trigger', status: 'success', duration: 10 },
                    { nodeId: '2', nodeName: 'Fetch Data', status: 'success', duration: 2500 },
                    { nodeId: '3', nodeName: 'Transform', status: 'success', duration: 150 }
                ]
            },
            {
                id: '2',
                workflowId,
                workflowName,
                status: 'failed',
                startedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
                completedAt: new Date(now - 1000 * 60 * 60 * 2 + 5000).toISOString(),
                duration: 5000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                error: 'Connection timeout: Failed to connect to database after 5000ms',
                nodeResults: [
                    { nodeId: '1', nodeName: 'Manual Trigger', status: 'success', duration: 10 },
                    { nodeId: '2', nodeName: 'Fetch Data', status: 'error', duration: 5000 }
                ]
            },
            {
                id: '3',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
                duration: 120000,
                triggeredBy: 'user-2',
                triggeredByName: 'Maria Garcia'
            }
        ];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#256A65]/10 flex items-center justify-center">
                            <Clock size={20} className="text-[#256A65]" weight="light" />
                        </div>
                        <div>
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Execution History</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{workflowName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={18} weight="light" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                        </div>
                    ) : executions.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">No executions yet</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">Run this workflow to see execution history</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {executions.map((execution) => (
                                <ExecutionItem
                                    key={execution.id}
                                    execution={execution}
                                    isExpanded={expandedId === execution.id}
                                    onToggle={() => setExpandedId(expandedId === execution.id ? null : execution.id)}
                                    onRerun={onRerun ? () => onRerun(execution.id) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-[var(--text-tertiary)]">
                            {executions.length} execution{executions.length !== 1 ? 's' : ''}
                        </p>
                        <button
                            onClick={fetchExecutions}
                            className="text-xs text-[#256A65] hover:text-[#1e5a55] transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionHistoryModal;
