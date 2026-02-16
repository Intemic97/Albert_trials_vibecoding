/**
 * RenameColumnsConfigPanel  
 * Extracted from Workflows.tsx lines 9396-9570
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ArrowRight, Swap, Plus, TextAa, Trash, ChatText } from '@phosphor-icons/react';

interface RenameColumnsConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const RenameColumnsConfigPanel: React.FC<RenameColumnsConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [columnRenames, setColumnRenames] = useState<{ oldName: string; newName: string }[]>(
    node?.config?.columnRenames || [{ oldName: '', newName: '' }]
  );

  // Get available columns from parent
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let parentOutputData: any[] = [];
  if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
    parentOutputData = parentConnection?.outputType === 'B' ? parentNode.outputData.outputB || [] : parentNode.outputData.outputA || [];
  } else {
    parentOutputData = parentNode?.outputData || parentNode?.data || [];
  }
  const availableColumns = Array.isArray(parentOutputData) && parentOutputData.length > 0 && typeof parentOutputData[0] === 'object'
    ? Object.keys(parentOutputData[0]) : [];

  const handleSave = () => {
    const filtered = columnRenames.filter(r => r.oldName.trim() && r.newName.trim());
    if (filtered.length === 0) return;
    onSave(nodeId, { columnRenames: filtered });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Rename Columns"
        icon={TextAa}
        width="w-[550px]"
        footer={
            <>
                <button
                    onClick={() => onClose()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!columnRenames.some(r => r.oldName.trim() && r.newName.trim())}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-4">
            {inputColumnsRC.length === 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        ⚠️ No input data detected. Run the parent node first to auto-detect available columns, or type column names manually.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {columnRenames.map((rename, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                            {idx === 0 && (
                                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                                    Original Column
                                </label>
                            )}
                            {inputColumnsRC.length > 0 ? (
                                <select
                                    value={rename.oldName}
                                    onChange={(e) => {
                                        const updated = [...columnRenames];
                                        updated[idx] = { ...updated[idx], oldName: e.target.value };
                                        setColumnRenames(updated);
                                    }}
                                    className="w-full px-2.5 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-medium)] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-[var(--text-primary)]"
                                >
                                    <option value="">Select column...</option>
                                    {inputColumnsRC.map(col => (
                                        <option key={col} value={col} disabled={columnRenames.some((r, i) => i !== idx && r.oldName === col)}>
                                            {col}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={rename.oldName}
                                    onChange={(e) => {
                                        const updated = [...columnRenames];
                                        updated[idx] = { ...updated[idx], oldName: e.target.value };
                                        setColumnRenames(updated);
                                    }}
                                    placeholder="Column name"
                                    className="w-full px-2.5 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-medium)] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-[var(--text-primary)]"
                                />
                            )}
                        </div>

                        <div className="flex items-center pt-4">
                            <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
                        </div>

                        <div className="flex-1">
                            {idx === 0 && (
                                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                                    New Name
                                </label>
                            )}
                            <input
                                type="text"
                                value={rename.newName}
                                onChange={(e) => {
                                    const updated = [...columnRenames];
                                    updated[idx] = { ...updated[idx], newName: e.target.value };
                                    setColumnRenames(updated);
                                }}
                                placeholder="New column name"
                                className="w-full px-2.5 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-medium)] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-[var(--text-primary)]"
                            />
                        </div>

                        {columnRenames.length > 1 && (
                            <button
                                onClick={() => {
                                    const updated = columnRenames.filter((_, i) => i !== idx);
                                    setColumnRenames(updated);
                                }}
                                className="flex items-center justify-center w-7 h-7 mt-4 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            >
                                <Trash size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={() => setColumnRenames(prev => [...prev, { oldName: '', newName: '' }])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-dashed border-[var(--border-medium)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors w-full justify-center"
            >
                <Plus size={12} />
                Add another column to rename
            </button>

            {/* Preview of configured renames */}
            {columnRenames.some(r => r.oldName.trim() && r.newName.trim()) && (
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Preview</p>
                    <div className="space-y-1">
                        {columnRenames
                            .filter(r => r.oldName.trim() && r.newName.trim())
                            .map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">{r.oldName}</span>
                                    <ArrowRight size={10} className="text-[var(--text-tertiary)]" />
                                    <span className="font-mono text-amber-600 dark:text-amber-400 bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">{r.newName}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>

        {/* Feedback Link */}
        <div className="pt-3 border-t border-[var(--border-light)]">
            <button
                onClick={() => openFeedbackPopup('action', 'Rename Columns')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} weight="light" />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>
  );
};
