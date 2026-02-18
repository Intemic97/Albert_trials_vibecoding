/**
 * Execution History Modal
 * Unified timeline showing workflow executions AND version publish events
 * Two-column layout: left = timeline list, right = details
 */

import React, { useState, useEffect, useCallback } from 'react';
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
    CaretRight,
    Rocket,
    GitBranch,
    Circle,
    ArrowCounterClockwise,
    Tag
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
    /** Which version was active when this execution happened (null = Draft) */
    versionNumber?: number | null;
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

interface VersionRecord {
    id: string;
    workflowId: string;
    version: number;
    name: string;
    description: string | null;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    isProduction: number;
}

// A timeline item is either an execution or a version event
type TimelineItem = 
    | { type: 'execution'; data: ExecutionRecord; date: string }
    | { type: 'version'; data: VersionRecord; date: string };

interface ExecutionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
    workflowName: string;
    onRerun?: (executionId: string) => void;
    onPublish?: (versionId: string) => void;
    onUnpublish?: (versionId: string) => void;
    onRestore?: (data: { nodes: any[]; connections: any[] }, version: number) => void;
    publishedVersionId?: string | null;
    onPublishedVersionChange?: (versionId: string | null) => void;
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

// --- Execution List Item ---
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
                    {/* Status, trigger and version badges */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label.toLowerCase()}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
                            {triggerConfig.label.toLowerCase()}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
                            {execution.versionNumber ? `v${execution.versionNumber}` : 'Draft'}
                        </span>
                    </div>
                    
                    {/* Date */}
                    <p className="text-sm text-[var(--text-primary)] mb-0.5">
                        {formatFullDate(execution.startedAt)}
                    </p>

                    {/* Triggered by */}
                    {execution.triggeredByName && (
                        <div className="flex items-center gap-1 mb-0.5">
                            <User size={10} className="text-[var(--text-tertiary)]" weight="light" />
                            <span className="text-[11px] text-[var(--text-tertiary)]">{execution.triggeredByName}</span>
                        </div>
                    )}
                    
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

// --- Version List Item ---
interface VersionListItemProps {
    version: VersionRecord;
    isSelected: boolean;
    onClick: () => void;
}

const VersionListItem: React.FC<VersionListItemProps> = ({
    version,
    isSelected,
    onClick
}) => {
    const isProduction = version.isProduction === 1;

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 border-b border-[var(--border-light)] transition-all ${
                isSelected 
                    ? 'bg-purple-500/5 border-l-2 border-l-purple-400' 
                    : 'hover:bg-[var(--bg-tertiary)]/50 border-l-2 border-l-transparent'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Version icon */}
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Rocket size={12} className="text-purple-400" weight="fill" />
                </div>
                
                <div className="flex-1 min-w-0">
                    {/* Version label and badge */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-purple-400">
                            v{version.version} published
                        </span>
                        {isProduction && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-400 flex items-center gap-0.5">
                                <Circle size={5} weight="fill" /> LIVE
                            </span>
                        )}
                    </div>
                    
                    {/* Version name if different from default */}
                    {version.name && version.name !== `v${version.version}` && (
                        <p className="text-[11px] text-[var(--text-secondary)] mb-0.5 truncate">
                            "{version.name}"
                        </p>
                    )}
                    
                    {/* Date */}
                    <p className="text-sm text-[var(--text-primary)] mb-0.5">
                        {formatFullDate(version.createdAt)}
                    </p>
                    
                    {/* Author */}
                    <div className="flex items-center gap-1">
                        <User size={10} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[11px] text-[var(--text-tertiary)]">{version.createdByName}</span>
                    </div>
                </div>

                <CaretRight 
                    size={14} 
                    className={`shrink-0 mt-1 transition-colors ${
                        isSelected ? 'text-purple-400' : 'text-[var(--text-tertiary)]'
                    }`} 
                />
            </div>
        </button>
    );
};

// --- Execution Detail Panel ---
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

    if (!execution) return null;

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
                        <span className="text-[var(--text-secondary)]">{execution.triggeredByName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <GitBranch size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">
                            {execution.versionNumber ? `v${execution.versionNumber}` : 'Draft'}
                        </span>
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

// --- Version Detail Panel ---
interface VersionDetailProps {
    version: VersionRecord;
    workflowId: string;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onRestore?: () => void;
    actionLoading: boolean;
}

const VersionDetail: React.FC<VersionDetailProps> = ({ 
    version, workflowId, onPublish, onUnpublish, onRestore, actionLoading 
}) => {
    const isProduction = version.isProduction === 1;
    const [previewData, setPreviewData] = useState<any>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        const loadPreview = async () => {
            setLoadingPreview(true);
            try {
                const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${version.id}`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setPreviewData(data.data);
                }
            } catch (error) {
                console.error('Failed to load version preview:', error);
            } finally {
                setLoadingPreview(false);
            }
        };
        loadPreview();
    }, [version.id, workflowId]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-light)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Rocket size={20} className="text-purple-400" weight="fill" />
                        <span className="text-sm font-semibold text-purple-400">
                            Version {version.version}
                        </span>
                        {isProduction && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-400 flex items-center gap-0.5">
                                <Circle size={5} weight="fill" /> LIVE
                            </span>
                        )}
                    </div>
                </div>

                {/* Version name */}
                {version.name && (
                    <p className="text-sm text-[var(--text-primary)] font-medium mb-3">
                        {version.name}
                    </p>
                )}

                {/* Description */}
                {version.description && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3 italic bg-[var(--bg-tertiary)] p-2 rounded-lg">
                        "{version.description}"
                    </p>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs">
                        <Calendar size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">{formatFullDate(version.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <User size={14} className="text-[var(--text-tertiary)]" weight="light" />
                        <span className="text-[var(--text-secondary)]">{version.createdByName}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4">
                    {isProduction ? (
                        onUnpublish && (
                            <button
                                onClick={onUnpublish}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Unpublish
                            </button>
                        )
                    ) : (
                        onPublish && (
                            <button
                                onClick={onPublish}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Rocket size={12} weight="bold" />
                                Publish
                            </button>
                        )
                    )}
                    {onRestore && (
                        <button
                            onClick={onRestore}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                        >
                            <ArrowCounterClockwise size={12} />
                            Restore
                        </button>
                    )}
                </div>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                    Version Snapshot
                </h4>
                
                {loadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                        <SpinnerGap size={20} className="animate-spin text-purple-400" weight="light" />
                    </div>
                ) : previewData ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-3 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-light)]">
                                <p className="text-lg font-semibold text-[var(--text-primary)]">
                                    {previewData.nodes?.length || 0}
                                </p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">Nodes</p>
                            </div>
                            <div className="text-center p-3 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-light)]">
                                <p className="text-lg font-semibold text-[var(--text-primary)]">
                                    {previewData.connections?.length || 0}
                                </p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">Connections</p>
                            </div>
                        </div>
                        
                        {previewData.nodes && previewData.nodes.length > 0 && (
                            <div>
                                <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-2">Nodes in this version:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {previewData.nodes.map((n: any, i: number) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[10px] text-[var(--text-secondary)]"
                                        >
                                            {n.label || n.type}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-xs text-[var(--text-tertiary)]">No preview data available</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Empty Detail Panel ---
const EmptyDetail: React.FC = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
            <Eye size={28} className="text-[var(--text-tertiary)]" weight="light" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-1">Select an item to view details</p>
        <p className="text-xs text-[var(--text-tertiary)]">Click on any execution or version event</p>
    </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExecutionHistoryModal: React.FC<ExecutionHistoryModalProps> = ({
    isOpen,
    onClose,
    workflowId,
    workflowName,
    onRerun,
    onRestore,
    publishedVersionId,
    onPublishedVersionChange,
}) => {
    const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
    const [versions, setVersions] = useState<VersionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'executions' | 'versions'>('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const [execRes, versRes] = await Promise.all([
                fetch(`${API_BASE}/workflow/${workflowId}/executions`, { credentials: 'include' }),
                fetch(`${API_BASE}/workflows/${workflowId}/versions`, { credentials: 'include' }),
            ]);
            
            if (execRes.ok) {
                const data = await execRes.json();
                const parsed = Array.isArray(data) ? data : data.executions || [];
                setExecutions(parsed.map((e: any) => ({
                    ...e,
                    workflowId: e.workflowId || workflowId,
                    workflowName: e.workflowName || workflowName,
                    triggeredBy: e.triggeredBy || 'unknown',
                    triggeredByName: e.triggeredByName || null,
                    startedAt: e.startedAt || e.createdAt,
                    duration: e.duration ?? (e.startedAt && e.completedAt
                        ? new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()
                        : undefined),
                })));
            } else {
                const errText = await execRes.text();
                setFetchError(errText || `HTTP ${execRes.status}`);
                setExecutions([]);
            }

            if (versRes.ok) {
                const versData = await versRes.json();
                setVersions(Array.isArray(versData) ? versData : []);
            } else {
                setVersions([]);
            }
        } catch (error) {
            console.error('Failed to fetch timeline data:', error);
            setFetchError(error instanceof Error ? error.message : 'Network error');
            setExecutions([]);
            setVersions([]);
        } finally {
            setIsLoading(false);
        }
    }, [workflowId, workflowName]);

    useEffect(() => {
        if (isOpen && workflowId) {
            fetchData();
        }
    }, [isOpen, workflowId, fetchData]);

    // Build unified timeline
    const timeline: TimelineItem[] = React.useMemo(() => {
        const items: TimelineItem[] = [];
        
        if (filter !== 'versions') {
            executions.forEach(e => {
                items.push({ type: 'execution', data: e, date: e.startedAt || e.completedAt || '' });
            });
        }
        
        if (filter !== 'executions') {
            versions.forEach(v => {
                items.push({ type: 'version', data: v, date: v.createdAt });
            });
        }
        
        // Sort by date descending (newest first)
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return items;
    }, [executions, versions, filter]);

    // Auto-select first item when loaded
    useEffect(() => {
        if (timeline.length > 0 && !selectedItemKey) {
            const first = timeline[0];
            setSelectedItemKey(first.type === 'execution' ? `exec-${first.data.id}` : `ver-${(first.data as VersionRecord).id}`);
        }
    }, [timeline, selectedItemKey]);

    // Find selected item
    const selectedItem = React.useMemo(() => {
        if (!selectedItemKey) return null;
        return timeline.find(item => {
            if (item.type === 'execution') return `exec-${item.data.id}` === selectedItemKey;
            return `ver-${(item.data as VersionRecord).id}` === selectedItemKey;
        }) || null;
    }, [timeline, selectedItemKey]);

    // Version actions
    const handlePublish = async (version: VersionRecord) => {
        setActionLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/workflows/${workflowId}/versions/${version.id}/publish`,
                { method: 'PUT', credentials: 'include' }
            );
            if (res.ok) {
                onPublishedVersionChange?.(version.id);
                await fetchData();
            }
        } catch (error) {
            console.error('Failed to publish version:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnpublish = async (version: VersionRecord) => {
        setActionLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/workflows/${workflowId}/versions/${version.id}/unpublish`,
                { method: 'PUT', credentials: 'include' }
            );
            if (res.ok) {
                onPublishedVersionChange?.(null);
                await fetchData();
            }
        } catch (error) {
            console.error('Failed to unpublish version:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestore = async (version: VersionRecord) => {
        if (!onRestore) return;
        setActionLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/workflows/${workflowId}/versions/${version.id}/restore`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }
            );
            if (res.ok) {
                const result = await res.json();
                onRestore(result.data, version.version);
            }
        } catch (error) {
            console.error('Failed to restore version:', error);
        } finally {
            setActionLoading(false);
        }
    };

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setFetchError(null);
            setSelectedItemKey(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const totalCount = timeline.length;
    const execCount = executions.length;
    const verCount = versions.length;

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
                            <h2 className="text-sm font-semibold text-[var(--text-primary)]">History</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{workflowName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchData}
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
                    {/* Left column - Timeline list */}
                    <div className="w-[340px] shrink-0 border-r border-[var(--border-light)] flex flex-col bg-[var(--bg-primary)]">
                        {/* Filter tabs */}
                        <div className="px-3 py-2 border-b border-[var(--border-light)] bg-[var(--bg-card)] flex items-center gap-1">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                    filter === 'all' 
                                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' 
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                All <span className="ml-0.5 opacity-60">{totalCount}</span>
                            </button>
                            <button
                                onClick={() => setFilter('executions')}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                    filter === 'executions' 
                                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' 
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                Executions <span className="ml-0.5 opacity-60">{execCount}</span>
                            </button>
                            <button
                                onClick={() => setFilter('versions')}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                    filter === 'versions' 
                                        ? 'bg-purple-500/10 text-purple-400' 
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                Versions <span className="ml-0.5 opacity-60">{verCount}</span>
                            </button>
                        </div>
                        
                        {/* Timeline list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                                </div>
                            ) : fetchError ? (
                                <div className="text-center py-12 px-4">
                                    <XCircle size={28} className="mx-auto text-red-400 mb-3" weight="fill" />
                                    <p className="text-sm font-medium text-red-400">Error loading history</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{fetchError}</p>
                                </div>
                            ) : timeline.length === 0 ? (
                                <div className="text-center py-12 px-4">
                                    <Clock size={28} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                                    <p className="text-sm text-[var(--text-secondary)]">No history yet</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Run this workflow or publish a version to see history</p>
                                </div>
                            ) : (
                                timeline.map((item) => {
                                    if (item.type === 'execution') {
                                        const key = `exec-${item.data.id}`;
                                        return (
                                    <ExecutionListItem
                                                key={key}
                                                execution={item.data as ExecutionRecord}
                                                isSelected={selectedItemKey === key}
                                                onClick={() => setSelectedItemKey(key)}
                                            />
                                        );
                                    } else {
                                        const ver = item.data as VersionRecord;
                                        const key = `ver-${ver.id}`;
                                        return (
                                            <VersionListItem
                                                key={key}
                                                version={ver}
                                                isSelected={selectedItemKey === key}
                                                onClick={() => setSelectedItemKey(key)}
                                            />
                                        );
                                    }
                                })
                            )}
                        </div>
                    </div>

                    {/* Right column - Detail */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-card)]">
                        {selectedItem ? (
                            selectedItem.type === 'execution' ? (
                        <ExecutionDetail
                                    execution={selectedItem.data as ExecutionRecord}
                                    onRerun={onRerun && (selectedItem.data as ExecutionRecord).status !== 'running' 
                                        ? () => onRerun((selectedItem.data as ExecutionRecord).id) 
                                        : undefined}
                                />
                            ) : (
                                <VersionDetail
                                    version={selectedItem.data as VersionRecord}
                                    workflowId={workflowId}
                                    onPublish={() => handlePublish(selectedItem.data as VersionRecord)}
                                    onUnpublish={() => handleUnpublish(selectedItem.data as VersionRecord)}
                                    onRestore={onRestore ? () => handleRestore(selectedItem.data as VersionRecord) : undefined}
                                    actionLoading={actionLoading}
                                />
                            )
                        ) : (
                            <EmptyDetail />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionHistoryModal;
