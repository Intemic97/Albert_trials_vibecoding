/**
 * Workflow Runner Modal
 * Allows users to run a workflow with input parameters
 * Supports real-time progress tracking via WebSocket
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, 
    Play, 
    SpinnerGap,
    CheckCircle,
    XCircle,
    FileText,
    Database,
    CaretRight,
    CaretDown,
    CircleNotch,
    Lightning
} from '@phosphor-icons/react';
import { WorkflowNode } from '../types';
import { useExecutionProgress, ExecutionProgress } from '../../../hooks';

// ============================================================================
// TYPES
// ============================================================================

interface WorkflowRunnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
    workflowName: string;
    nodes: WorkflowNode[];
    onRun: (inputs: Record<string, any>) => Promise<{ executionId?: string; backgroundExecution?: boolean }>;
}

interface NodeInput {
    nodeId: string;
    nodeType: string;
    nodeName: string;
    inputType: 'text' | 'file' | 'json';
    required: boolean;
    placeholder?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInputNodesFromWorkflow = (nodes: WorkflowNode[]): NodeInput[] => {
    const inputNodes: NodeInput[] = [];
    
    for (const node of nodes) {
        if (node.type === 'manualInput') {
            inputNodes.push({
                nodeId: node.id,
                nodeType: node.type,
                nodeName: node.label || 'Manual Input',
                inputType: 'text',
                required: true,
                placeholder: node.config?.inputVarName || 'Enter value'
            });
        } else if (node.type === 'excel' || node.type === 'pdf') {
            inputNodes.push({
                nodeId: node.id,
                nodeType: node.type,
                nodeName: node.label || (node.type === 'excel' ? 'Excel Input' : 'PDF Input'),
                inputType: 'file',
                required: true,
                placeholder: node.type === 'excel' ? 'Select Excel/CSV file' : 'Select PDF file'
            });
        } else if (node.type === 'webhook') {
            inputNodes.push({
                nodeId: node.id,
                nodeType: node.type,
                nodeName: node.label || 'Webhook Input',
                inputType: 'json',
                required: false,
                placeholder: '{ "key": "value" }'
            });
        }
    }
    
    return inputNodes;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface InputFieldProps {
    input: NodeInput;
    value: any;
    onChange: (value: any) => void;
}

const InputField: React.FC<InputFieldProps> = ({ input, value, onChange }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const getIcon = () => {
        switch (input.nodeType) {
            case 'excel':
            case 'pdf':
                return FileText;
            default:
                return Database;
        }
    };
    
    const Icon = getIcon();

    return (
        <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[var(--text-tertiary)]" weight="light" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">{input.nodeName}</span>
                    {input.required && (
                        <span className="text-red-500 text-xs">*</span>
                    )}
                </div>
                {isExpanded ? (
                    <CaretDown size={14} className="text-[var(--text-tertiary)]" />
                ) : (
                    <CaretRight size={14} className="text-[var(--text-tertiary)]" />
                )}
            </button>

            {isExpanded && (
                <div className="p-3 bg-[var(--bg-card)]">
                    {input.inputType === 'text' && (
                        <input
                            type="text"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={input.placeholder}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[#256A65] transition-colors"
                        />
                    )}

                    {input.inputType === 'file' && (
                        <div className="space-y-2">
                            <input
                                type="file"
                                accept={input.nodeType === 'excel' ? '.xlsx,.xls,.csv' : '.pdf'}
                                onChange={(e) => onChange(e.target.files?.[0] || null)}
                                className="w-full text-sm text-[var(--text-secondary)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#256A65]/10 file:text-[#256A65] hover:file:bg-[#256A65]/20 file:cursor-pointer cursor-pointer"
                            />
                            {value && (
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    Selected: {value.name}
                                </p>
                            )}
                        </div>
                    )}

                    {input.inputType === 'json' && (
                        <textarea
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={input.placeholder}
                            rows={4}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[#256A65] transition-colors font-mono resize-none"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkflowRunnerModal: React.FC<WorkflowRunnerModalProps> = ({
    isOpen,
    onClose,
    workflowId,
    workflowName,
    nodes,
    onRun
}) => {
    const [inputs, setInputs] = useState<Record<string, any>>({});
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [executionId, setExecutionId] = useState<string | null>(null);
    const [isBackgroundExecution, setIsBackgroundExecution] = useState(false);
    const [progress, setProgress] = useState<ExecutionProgress | null>(null);

    const inputNodes = getInputNodesFromWorkflow(nodes);
    const hasInputs = inputNodes.length > 0;

    // Real-time progress tracking
    const handleProgress = useCallback((p: ExecutionProgress) => {
        if (p.workflowId === workflowId || p.executionId === executionId) {
            setProgress(p);
        }
    }, [workflowId, executionId]);

    const handleComplete = useCallback((p: ExecutionProgress) => {
        if (p.workflowId === workflowId || p.executionId === executionId) {
            setProgress(p);
            setIsRunning(false);
            if (p.status === 'completed') {
                setStatus('success');
            } else if (p.status === 'failed') {
                setStatus('error');
                setError(p.error || 'Workflow execution failed');
            }
        }
    }, [workflowId, executionId]);

    const handleProgressError = useCallback((err: string, execId: string) => {
        if (execId === executionId) {
            setError(err);
            setStatus('error');
            setIsRunning(false);
        }
    }, [executionId]);

    useExecutionProgress({
        onProgress: handleProgress,
        onComplete: handleComplete,
        onError: handleProgressError
    });

    useEffect(() => {
        if (isOpen) {
            setInputs({});
            setStatus('idle');
            setError(null);
            setExecutionId(null);
            setIsBackgroundExecution(false);
            setProgress(null);
        }
    }, [isOpen]);

    const handleRun = async () => {
        // Validate required inputs
        for (const input of inputNodes) {
            if (input.required && !inputs[input.nodeId]) {
                setError(`Please provide input for "${input.nodeName}"`);
                return;
            }
        }

        setIsRunning(true);
        setStatus('running');
        setError(null);

        try {
            const result = await onRun(inputs);
            
            if (result?.executionId) {
                setExecutionId(result.executionId);
            }
            
            if (result?.backgroundExecution) {
                // Background execution - keep modal open to show progress
                setIsBackgroundExecution(true);
            } else {
                // Synchronous execution completed
                setStatus('success');
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Workflow execution failed');
            setIsRunning(false);
        }
    };

    const updateInput = (nodeId: string, value: any) => {
        setInputs(prev => ({ ...prev, [nodeId]: value }));
        setError(null);
    };

    const progressPercentage = progress?.progress?.percentage || 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => !isRunning && onClose()}
            />
            
            {/* Modal */}
            <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            status === 'success' ? 'bg-green-500/10' :
                            status === 'error' ? 'bg-red-500/10' :
                            'bg-[#256A65]/10'
                        }`}>
                            {status === 'running' ? (
                                <SpinnerGap size={20} className="text-[#256A65] animate-spin" weight="light" />
                            ) : status === 'success' ? (
                                <CheckCircle size={20} className="text-green-500" weight="fill" />
                            ) : status === 'error' ? (
                                <XCircle size={20} className="text-red-500" weight="fill" />
                            ) : (
                                <Play size={20} className="text-[#256A65]" weight="fill" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Run Workflow</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{workflowName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isRunning}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X size={18} weight="light" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Status message */}
                    {status === 'success' && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-500" weight="fill" />
                            <span className="text-sm text-green-600">Workflow completed successfully!</span>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <XCircle size={16} className="text-red-500" weight="fill" />
                            <span className="text-sm text-red-600">{error}</span>
                        </div>
                    )}

                    {/* Progress bar for background execution */}
                    {isBackgroundExecution && isRunning && (
                        <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Lightning size={14} className="text-[#256A65]" weight="fill" />
                                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                                        Running in background
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--text-tertiary)]">
                                    {progress?.progress?.completedNodes || 0} / {progress?.progress?.totalNodes || '?'} nodes
                                </span>
                            </div>
                            <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-[#256A65] h-2 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            {progress?.currentNodeId && (
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    Processing: {progress.currentNodeId}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Execution logs */}
                    {isBackgroundExecution && progress?.logs && progress.logs.length > 0 && (
                        <div className="mb-4 max-h-32 overflow-y-auto border border-[var(--border-light)] rounded-lg">
                            <div className="p-2 space-y-1">
                                {progress.logs.map((log, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                        {log.status === 'completed' ? (
                                            <CheckCircle size={12} className="text-green-500 flex-shrink-0" weight="fill" />
                                        ) : log.status === 'error' || log.status === 'failed' ? (
                                            <XCircle size={12} className="text-red-500 flex-shrink-0" weight="fill" />
                                        ) : (
                                            <CircleNotch size={12} className="text-[#256A65] flex-shrink-0 animate-spin" weight="light" />
                                        )}
                                        <span className="text-[var(--text-secondary)] truncate">
                                            {log.nodeLabel || log.nodeType}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input fields */}
                    {!isBackgroundExecution && (hasInputs ? (
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                                Workflow Inputs
                            </p>
                            {inputNodes.map((input) => (
                                <InputField
                                    key={input.nodeId}
                                    input={input}
                                    value={inputs[input.nodeId]}
                                    onChange={(value) => updateInput(input.nodeId, value)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Play size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">This workflow has no input nodes</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">Click "Run" to execute the workflow</p>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isRunning}
                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning || status === 'success'}
                        className="flex items-center gap-2 px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRunning ? (
                            <>
                                <SpinnerGap size={16} className="animate-spin" weight="light" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={16} weight="fill" />
                                Run Workflow
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkflowRunnerModal;
