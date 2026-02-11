/**
 * Execution History Modal
 * Shows the history of workflow executions with their status and details
 * Redesigned with two-column layout for better UX
 */

import React, { useState, useEffect } from 'react';
import { 
    X, 
    Clock, 
    CheckCircle, 
    XCircle, 
    SpinnerGap,
    Play,
    Warning,
    Eye,
    ArrowClockwise,
    Timer,
    User,
    Calendar,
    Lightning,
    ArrowRight,
    Copy,
    CaretRight
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
    triggerType?: 'manual' | 'scheduled' | 'webhook' | 'api';
    nodeResults?: {
        nodeId: string;
        nodeName: string;
        nodeType?: string;
        status: 'success' | 'error' | 'skipped' | 'running';
        duration?: number;
        error?: string;
        outputPreview?: string;
        inputPreview?: string;
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
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${(ms / 3600000).toFixed(1)}h`;
};

const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatRelativeDate = (dateString: string): string => {
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
    
    return date.toLocaleDateString('es-ES', { 
        month: 'short', 
        day: 'numeric'
    });
};

const getStatusConfig = (status: ExecutionRecord['status']) => {
    const configs = {
        running: {
            icon: SpinnerGap,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            label: 'Running',
            dotColor: 'bg-blue-400'
        },
        completed: {
            icon: CheckCircle,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            label: 'Completed',
            dotColor: 'bg-emerald-400'
        },
        failed: {
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            label: 'Failed',
            dotColor: 'bg-red-400'
        },
        cancelled: {
            icon: Warning,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            label: 'Cancelled',
            dotColor: 'bg-amber-400'
        }
    };
    return configs[status] || configs.completed;
};

const getTriggerConfig = (type?: string) => {
    const configs: Record<string, { icon: typeof Lightning; label: string; color: string }> = {
        manual: { icon: Play, label: 'Manual', color: 'text-[var(--text-tertiary)]' },
        scheduled: { icon: Clock, label: 'Scheduled', color: 'text-purple-400' },
        webhook: { icon: Lightning, label: 'Webhook', color: 'text-orange-400' },
        api: { icon: ArrowRight, label: 'API', color: 'text-blue-400' }
    };
    return configs[type || 'manual'] || configs.manual;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ExecutionListItemProps {
    execution: ExecutionRecord;
    isSelected: boolean;
    onClick: () => void;
}

const ExecutionListItem: React.FC<ExecutionListItemProps> = ({
    execution,
    isSelected,
    onClick
}) => {
    const statusConfig = getStatusConfig(execution.status);
    const triggerConfig = getTriggerConfig(execution.triggerType);

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 border-b border-[var(--border-light)] transition-all ${
                isSelected 
                    ? 'bg-[var(--accent-primary)]/5 border-l-2 border-l-[var(--accent-primary)]' 
                    : 'hover:bg-[var(--bg-tertiary)]/50 border-l-2 border-l-transparent'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusConfig.dotColor} ${
                    execution.status === 'running' ? 'animate-pulse' : ''
                }`} />
                
                <div className="flex-1 min-w-0">
                    {/* Status and trigger badges */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label.toLowerCase()}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
                            {triggerConfig.label.toLowerCase()}
                        </span>
                    </div>
                    
                    {/* Date */}
                    <p className="text-sm text-[var(--text-primary)] mb-0.5">
                        {formatFullDate(execution.startedAt)}
                    </p>
                    
                    {/* ID */}
                    <p className="text-[11px] text-[var(--text-tertiary)] font-mono truncate">
                        {execution.id}
                    </p>
                </div>

                {/* Arrow indicator */}
                <CaretRight 
                    size={14} 
                    className={`shrink-0 mt-1 transition-colors ${
                        isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                    }`} 
                />
            </div>
        </button>
    );
};

interface ExecutionDetailProps {
    execution: ExecutionRecord | null;
    onRerun?: () => void;
}

const ExecutionDetail: React.FC<ExecutionDetailProps> = ({ execution, onRerun }) => {
    const [copiedId, setCopiedId] = useState(false);

    const copyId = () => {
        if (execution) {
            navigator.clipboard.writeText(execution.id);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        }
    };

    if (!execution) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                    <Eye size={28} className="text-[var(--text-tertiary)]" weight="light" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Select an execution to view details</p>
                <p className="text-xs text-[var(--text-tertiary)]">Click on any execution from the list</p>
            </div>
        );
    }

    const statusConfig = getStatusConfig(execution.status);
    const StatusIcon = statusConfig.icon;
    const triggerConfig = getTriggerConfig(execution.triggerType);
    const TriggerIcon = triggerConfig.icon;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail Header */}
            <div className="p-4 border-b border-[var(--border-light)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <StatusIcon 
                            size={20} 
                            className={`${statusConfig.color} ${execution.status === 'running' ? 'animate-spin' : ''}`} 
                            weight={execution.status === 'running' ? 'regular' : 'fill'}
                        />
                        <span className={`text-sm font-semibold ${statusConfig.color}`}>
                            {statusConfig.label}
                        </span>
                    </div>
                    {onRerun && execution.status !== 'running' && (
                        <button
                            onClick={onRerun}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition-colors"
                        >
                            <ArrowClockwise size={14} weight="bold" />
                            Re-run
                        </button>
                    )}
                </div>

                {/* Execution ID */}
                <div className="flex items-center gap-2 mb-4">
                    <code className="flex-1 text-[11px] text-[var(--text-tertiary)] font-mono bg-[var(--bg-tertiary)] px-2 py-1 rounded truncate">
                        {execution.id}
                    </code>
                    <button
                        onClick={copyId}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                        title="Copy ID"
                    >
                        <Copy size={14} weight={copiedId ? 'fill' : 'regular'} className={copiedId ? 'text-emerald-400' : ''} />
                    </button>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs">
                        <Calendar size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">{formatFullDate(execution.startedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <Timer size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">
                            {execution.duration ? formatDuration(execution.duration) : 'In progress...'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <TriggerIcon size={14} className={triggerConfig.color} weight="light" />
                        <span className="text-[var(--text-secondary)]">{triggerConfig.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <User size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">{execution.triggeredByName}</span>
                    </div>
                </div>
            </div>

            {/* Error Section */}
            {execution.error && (
                <div className="mx-4 mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" weight="fill" />
                        <div>
                            <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                            <p className="text-xs text-red-300/80 font-mono leading-relaxed">{execution.error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Node Results */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                    Execution Flow
                </h4>
                
                {execution.nodeResults && execution.nodeResults.length > 0 ? (
                    <div className="space-y-2">
                        {execution.nodeResults.map((node, idx) => {
                            const nodeStatus = getStatusConfig(node.status === 'success' ? 'completed' : node.status === 'error' ? 'failed' : 'running');
                            const NodeIcon = nodeStatus.icon;
                            
                            return (
                                <div 
                                    key={idx}
                                    className={`p-3 rounded-lg border transition-all ${
                                        node.status === 'error' 
                                            ? 'bg-red-500/5 border-red-500/20' 
                                            : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-light)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <NodeIcon 
                                                size={14} 
                                                className={nodeStatus.color}
                                                weight={node.status === 'running' ? 'regular' : 'fill'}
                                            />
                                            <span className="text-sm font-medium text-[var(--text-primary)]">
                                                {node.nodeName}
                                            </span>
                                            {node.nodeType && (
                                                <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-card)] rounded">
                                                    {node.nodeType}
                                                </span>
                                            )}
                                        </div>
                                        {node.duration !== undefined && (
                                            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                                                {formatDuration(node.duration)}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {node.error && (
                                        <p className="text-xs text-red-400 font-mono mt-2 pl-6">
                                            {node.error}
                                        </p>
                                    )}
                                    
                                    {node.outputPreview && (
                                        <div className="mt-2 pl-6">
                                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Output</p>
                                            <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-card)] p-2 rounded font-mono overflow-x-auto">
                                                {node.outputPreview}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-xs text-[var(--text-tertiary)]">No node execution data available</p>
                    </div>
                )}
            </div>
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
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && workflowId) {
            fetchExecutions();
        }
    }, [isOpen, workflowId]);

    // Auto-select first execution when loaded
    useEffect(() => {
        if (executions.length > 0 && !selectedId) {
            setSelectedId(executions[0].id);
        }
    }, [executions, selectedId]);

    const fetchExecutions = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`${API_BASE}/workflow/${workflowId}/executions`, {
                credentials: 'include'
            });
            
            if (res.ok) {
                const data = await res.json();
                const parsed = Array.isArray(data) ? data : data.executions || [];
                setExecutions(parsed.map((e: any) => ({
                    ...e,
                    workflowId: e.workflowId || workflowId,
                    workflowName: e.workflowName || workflowName,
                    triggeredBy: e.triggeredBy || 'unknown',
                    triggeredByName: e.triggeredByName || 'Unknown',
                    duration: e.duration ?? (e.startedAt && e.completedAt
                        ? new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()
                        : undefined),
                })));
            } else {
                const errText = await res.text();
                setFetchError(errText || `HTTP ${res.status}`);
                setExecutions([]);
            }
        } catch (error) {
            console.error('Failed to fetch executions:', error);
            setFetchError(error instanceof Error ? error.message : 'Network error');
            setExecutions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Reset error when modal closes
    useEffect(() => {
        if (!isOpen) setFetchError(null);
    }, [isOpen]);

    // Legacy mock generator (unused - kept for reference)
    const _generateMockExecutions = (): ExecutionRecord[] => {
        const now = Date.now();
        return [
            {
                id: 'f3be15b82e5b3992',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 5).toISOString(),
                completedAt: new Date(now - 1000 * 60 * 4).toISOString(),
                duration: 45000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                triggerType: 'manual',
                nodeResults: [
                    { nodeId: '1', nodeName: 'Manual Trigger', nodeType: 'trigger', status: 'success', duration: 10 },
                    { nodeId: '2', nodeName: 'HTTP Request', nodeType: 'http', status: 'success', duration: 2500, outputPreview: '{"status": 200, "data": [...]}' },
                    { nodeId: '3', nodeName: 'Transform Data', nodeType: 'code', status: 'success', duration: 150 }
                ]
            },
            {
                id: 'bbc75908b7ba3c4c',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 10).toISOString(),
                duration: 32000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                triggerType: 'manual',
                nodeResults: [
                    { nodeId: '1', nodeName: 'Manual Trigger', nodeType: 'trigger', status: 'success', duration: 8 },
                    { nodeId: '2', nodeName: 'HTTP Request', nodeType: 'http', status: 'success', duration: 1800 }
                ]
            },
            {
                id: '60b6641683a52131',
                workflowId,
                workflowName,
                status: 'failed',
                startedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
                completedAt: new Date(now - 1000 * 60 * 60 * 2 + 5000).toISOString(),
                duration: 5000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                triggerType: 'scheduled',
                error: 'Connection timeout: Failed to connect to external API after 5000ms',
                nodeResults: [
                    { nodeId: '1', nodeName: 'Scheduled Trigger', nodeType: 'trigger', status: 'success', duration: 10 },
                    { nodeId: '2', nodeName: 'HTTP Request', nodeType: 'http', status: 'error', duration: 5000, error: 'ETIMEDOUT' }
                ]
            },
            {
                id: 'c38247fa930544c6',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
                duration: 120000,
                triggeredBy: 'user-2',
                triggeredByName: 'Maria Garcia',
                triggerType: 'webhook'
            },
            {
                id: '44c31ab4ae842b43',
                workflowId,
                workflowName,
                status: 'completed',
                startedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
                duration: 89000,
                triggeredBy: 'user-1',
                triggeredByName: 'You',
                triggerType: 'api'
            }
        ];
    };

    const selectedExecution = executions.find(e => e.id === selectedId) || null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal - Two column layout */}
            <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                            <Clock size={18} className="text-[var(--accent-primary)]" weight="light" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Execution History</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{workflowName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchExecutions}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                        >
                            <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} weight="bold" />
                            Refresh
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            <X size={18} weight="light" />
                        </button>
                    </div>
                </div>

                {/* Content - Two columns */}
                <div className="flex-1 flex min-h-0">
                    {/* Left column - Execution list */}
                    <div className="w-[340px] shrink-0 border-r border-[var(--border-light)] flex flex-col bg-[var(--bg-primary)]">
                        {/* List header */}
                        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                                    Executions
                                </span>
                                <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded-full">
                                    {executions.length}
                                </span>
                            </div>
                        </div>
                        
                        {/* Execution list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                                </div>
                            ) : fetchError ? (
                                <div className="text-center py-12 px-4">
                                    <XCircle size={28} className="mx-auto text-red-400 mb-3" weight="fill" />
                                    <p className="text-sm font-medium text-red-400">Error al cargar historial</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{fetchError}</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-2">Verifica conexión con el API en producción.</p>
                                </div>
                            ) : executions.length === 0 ? (
                                <div className="text-center py-12 px-4">
                                    <Clock size={28} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                                    <p className="text-sm text-[var(--text-secondary)]">No executions yet</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Run this workflow to see history</p>
                                </div>
                            ) : (
                                executions.map((execution) => (
                                    <ExecutionListItem
                                        key={execution.id}
                                        execution={execution}
                                        isSelected={selectedId === execution.id}
                                        onClick={() => setSelectedId(execution.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right column - Execution detail */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-card)]">
                        <ExecutionDetail
                            execution={selectedExecution}
                            onRerun={onRerun && selectedExecution ? () => onRerun(selectedExecution.id) : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionHistoryModal;
