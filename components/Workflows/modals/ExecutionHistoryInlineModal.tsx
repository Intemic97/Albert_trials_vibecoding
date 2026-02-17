/**
 * ExecutionHistoryInlineModal
 * Extracted from Workflows.tsx - Execution History Modal (~180 lines)
 */

import React from 'react';
import { ClockCounterClockwise as History, X, ArrowRight, CheckCircle, XCircle, Eye, Check } from '@phosphor-icons/react';

interface ExecutionHistoryInlineModalProps {
  showExecutionHistory: boolean;
  onClose: () => void;
  executionHistory: any[];
  selectedExecution: any;
  setSelectedExecution: (exec: any) => void;
  loadExecutionHistory: () => void;
  loadingExecutions: boolean;
  nodes: any[];
  formatDate: (date: string) => string;
}

export const ExecutionHistoryInlineModal: React.FC<ExecutionHistoryInlineModalProps> = ({
  showExecutionHistory, onClose, executionHistory, selectedExecution, setSelectedExecution,
  loadExecutionHistory, loadingExecutions, nodes, formatDate
}) => {
  if (!showExecutionHistory) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 text-white rounded-t-xl shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History size={24} />
              <div>
                <h3 className="font-normal text-lg">Execution History</h3>
                <p className="text-teal-200 text-sm">View past workflow executions and their results</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Executions List */}
          <div className="w-1/3 border-r border-[var(--border-light)] overflow-y-auto">
            <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
              <button
                onClick={loadExecutionHistory}
                className="w-full px-3 py-2 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-lg text-sm font-medium hover:bg-[var(--accent-primary)]/20 transition-colors flex items-center justify-center gap-2"
              >
                {loadingExecutions ? (
                  <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <History size={14} />
                )}
                Refresh
              </button>
            </div>
            {loadingExecutions ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : executionHistory.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <History size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                <p>No executions yet</p>
                <p className="text-xs mt-1">Run the workflow or send a webhook to see executions here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {executionHistory.map((exec) => (
                  <button
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec)}
                    className={`w-full p-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors ${selectedExecution?.id === exec.id ? 'bg-[var(--accent-primary)]/5 border-l-2 border-[var(--accent-primary)]' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        exec.status === 'completed' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' :
                        exec.status === 'failed' ? 'bg-red-100 text-red-700' :
                        exec.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                      }`}>
                        {exec.status}
                      </span>
                      {exec.triggerType && (
                        <span className="text-xs text-[var(--text-tertiary)]">{exec.triggerType}</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{formatDate(exec.createdAt)}</p>
                    <p className="text-xs text-[var(--text-tertiary)] font-mono truncate">{exec.id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Execution Details */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedExecution ? (
              <div className="space-y-4">
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <h4 className="font-normal text-[var(--text-primary)] mb-2">Execution Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[var(--text-secondary)]">Status:</span>
                      <span className={`ml-2 font-medium ${
                        selectedExecution.status === 'completed' ? 'text-[var(--accent-primary)]' :
                        selectedExecution.status === 'failed' ? 'text-red-600' :
                        'text-[var(--text-secondary)]'
                      }`}>{selectedExecution.status}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Trigger:</span>
                      <span className="ml-2 font-medium text-[var(--text-primary)]">{selectedExecution.triggerType || 'manual'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Started:</span>
                      <span className="ml-2 text-[var(--text-primary)]">{formatDate(selectedExecution.startedAt)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Completed:</span>
                      <span className="ml-2 text-[var(--text-primary)]">{formatDate(selectedExecution.completedAt)}</span>
                    </div>
                  </div>
                </div>

                {selectedExecution.inputs && Object.keys(selectedExecution.inputs).length > 0 && (
                  <div className="bg-blue-500/10 rounded-lg p-4">
                    <h4 className="font-normal text-blue-500 mb-2 flex items-center gap-2">
                      <ArrowRight size={16} />
                      Inputs
                    </h4>
                    <pre className="text-xs bg-[var(--bg-card)] p-3 rounded border border-blue-100 overflow-x-auto max-h-40">
                      {JSON.stringify(selectedExecution.inputs, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedExecution.nodeResults && Object.keys(selectedExecution.nodeResults).length > 0 && (
                  <div className="bg-[var(--accent-primary)]/5 rounded-lg p-4">
                    <h4 className="font-normal text-[var(--accent-primary)] mb-2 flex items-center gap-2">
                      <CheckCircle size={16} />
                      Node Results
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedExecution.nodeResults).map(([nodeId, result]: [string, any]) => {
                        const node = nodes.find(n => n.id === nodeId);
                        const nodeLabel = node?.label || result.nodeLabel || result.label || `Node ${nodeId.substring(0, 8)}`;
                        const nodeType = node?.type || result.nodeType || '';
                        
                        return (
                          <div key={nodeId} className="bg-[var(--bg-card)] p-3 rounded border border-[var(--accent-primary)]/20">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-[var(--text-primary)]">{nodeLabel}</span>
                              {nodeType && <span className="text-xs text-[var(--text-tertiary)]">({nodeType})</span>}
                              {result.success && <Check size={14} className="text-[var(--accent-primary)]" />}
                            </div>
                            {result.message && (
                              <p className="text-xs text-[var(--text-secondary)] mb-1">{result.message}</p>
                            )}
                            {result.outputData && (
                              <pre className="text-xs bg-[var(--bg-tertiary)] p-2 rounded overflow-x-auto max-h-32">
                                {JSON.stringify(result.outputData, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedExecution.error && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <h4 className="font-normal text-red-800 mb-2 flex items-center gap-2">
                      <XCircle size={16} />
                      Error
                    </h4>
                    <pre className="text-xs bg-[var(--bg-card)] p-3 rounded border border-red-100 text-red-600 overflow-x-auto">
                      {selectedExecution.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
                <div className="text-center">
                  <Eye size={48} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
                  <p>Select an execution to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};




