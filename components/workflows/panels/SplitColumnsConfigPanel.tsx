/**
 * SplitColumnsConfigPanel
 * Extracted from Workflows.tsx lines 10974-11190
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Columns, DotsSixVertical, ChatText } from '@phosphor-icons/react';

interface SplitColumnsConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const SplitColumnsConfigPanel: React.FC<SplitColumnsConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  // Initialize columns from parent node data
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let parentOutputData: any[] = [];
  if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
    parentOutputData = parentConnection?.outputType === 'B' ? parentNode.outputData.outputB || [] : parentNode.outputData.outputA || [];
  } else {
    parentOutputData = parentNode?.outputData || parentNode?.data || [];
  }
  const allColumns: string[] = [];
  if (Array.isArray(parentOutputData) && parentOutputData.length > 0 && typeof parentOutputData[0] === 'object') {
    Object.keys(parentOutputData[0]).forEach(key => { if (!allColumns.includes(key)) allColumns.push(key); });
  }

  const existingA = node?.config?.columnsOutputA || [];
  const existingB = node?.config?.columnsOutputB || [];
  const [splitColumnsOutputA, setSplitColumnsOutputA] = useState<string[]>(
    existingA.length > 0 ? existingA.filter((c: string) => allColumns.includes(c)) : allColumns
  );
  const [splitColumnsOutputB, setSplitColumnsOutputB] = useState<string[]>(
    existingB.filter((c: string) => allColumns.includes(c))
  );
  const [splitColumnsAvailable, setSplitColumnsAvailable] = useState<string[]>(
    existingA.length > 0 ? allColumns.filter(c => !existingA.includes(c) && !existingB.includes(c)) : []
  );
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const handleSave = () => {
    onSave(nodeId, { columnsOutputA: splitColumnsOutputA, columnsOutputB: splitColumnsOutputB });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Split by Columns"
        description="Drag columns between outputs A and B"
        icon={Columns}
        width="w-[600px]"
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
                    disabled={splitColumnsOutputA.length === 0 && splitColumnsOutputB.length === 0}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save Configuration
                </button>
            </>
        }
    >
            {allColumns.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                    <Columns size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No columns available</p>
                    <p className="text-sm">Run the previous node first to detect columns</p>
                </div>
            ) : (
                <>
                    <div className="flex gap-4 flex-1 overflow-hidden">
                        {/* Output A Column */}
                        <div
                            className="flex-1 flex flex-col"
                            onDragOver={handleDragOver}
                            onDrop={handleDropOnOutputA}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                                    <span className="text-xs font-medium text-[var(--text-primary)]">Output A</span>
                                    <span className="text-xs text-[var(--text-secondary)]">({splitColumnsOutputA.length} cols)</span>
                                </div>
                                <button
                                    onClick={moveAllToA}
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                                >
                                    Move all here
                                </button>
                            </div>
                            <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputA.includes(draggedColumn) ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] bg-[var(--bg-card)]'}`}>
                                {splitColumnsOutputA.length === 0 ? (
                                    <div className="text-center py-8 text-[var(--text-tertiary)] text-xs">
                                        Drop columns here
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {splitColumnsOutputA.map(column => (
                                            <div
                                                key={column}
                                                draggable
                                                onDragStart={() => handleDragStart(column)}
                                                onDragEnd={handleDragEnd}
                                                className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-light)] cursor-grab group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <DotsSixVertical size={12} className="text-[var(--text-tertiary)]" />
                                                    <span className="text-xs font-medium text-[var(--text-primary)]">{column}</span>
                                                </div>
                                                <button
                                                    onClick={() => moveColumnToB(column)}
                                                    className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity"
                                                >
                                                    → B
                                                    </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Output B Column */}
                        <div
                            className="flex-1 flex flex-col"
                            onDragOver={handleDragOver}
                            onDrop={handleDropOnOutputB}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                                    <span className="text-xs font-medium text-[var(--text-primary)]">Output B</span>
                                    <span className="text-xs text-[var(--text-secondary)]">({splitColumnsOutputB.length} cols)</span>
                                </div>
                                <button
                                    onClick={moveAllToB}
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                                >
                                    Move all here
                                </button>
                            </div>
                            <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputB.includes(draggedColumn) ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] bg-[var(--bg-card)]'}`}>
                                {splitColumnsOutputB.length === 0 ? (
                                    <div className="text-center py-8 text-[var(--text-tertiary)] text-xs">
                                        Drop columns here
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {splitColumnsOutputB.map(column => (
                                            <div
                                                key={column}
                                                draggable
                                                onDragStart={() => handleDragStart(column)}
                                                onDragEnd={handleDragEnd}
                                                className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-light)] cursor-grab group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <DotsSixVertical size={12} className="text-[var(--text-tertiary)]" />
                                                    <span className="text-xs font-medium text-[var(--text-primary)]">{column}</span>
                                                </div>
                                                <button
                                                    onClick={() => moveColumnToA(column)}
                                                    className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity"
                                                >
                                                    ← A
                                                    </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                        <p className="text-xs text-[var(--text-secondary)]">
                            <span className="font-medium">Tip:</span> Drag columns between outputs, or use the arrow buttons. Each row will be split into two datasets with the selected columns.
                        </p>
                    </div>
                </>
            )}
    </NodeConfigSidePanel>
  );
};
