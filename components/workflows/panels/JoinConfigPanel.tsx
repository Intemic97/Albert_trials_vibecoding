/**
 * JoinConfigPanel
 * Extracted from Workflows.tsx lines 10793-10971
 */

import React, { useState, useMemo } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { GitBranch, GitMerge, ChatText } from '@phosphor-icons/react';

interface JoinConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const JoinConfigPanel: React.FC<JoinConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [joinStrategy, setJoinStrategy] = useState(node?.config?.joinStrategy || 'concat');
  const [joinType, setJoinType] = useState(node?.config?.joinType || 'inner');
  const [joinKey, setJoinKey] = useState(node?.config?.joinKey || '');

  // Derive allFields and commonFields from parent nodes' output data
  const { allFields, commonFields } = useMemo(() => {
    const parentConns = connections.filter(c => c.toNodeId === nodeId);
    const fieldSets: Set<string>[] = [];

    for (const conn of parentConns) {
      const parentNode = nodes.find(n => n.id === conn.fromNodeId);
      if (parentNode) {
        let data = parentNode.outputData || parentNode.inputDataA || null;
        if (parentNode.type === 'splitColumns' && parentNode.outputData) {
          data = conn.outputType === 'B' ? parentNode.outputData.outputB : parentNode.outputData.outputA;
        }
        if (data && Array.isArray(data) && data.length > 0) {
          fieldSets.push(new Set(Object.keys(data[0])));
        }
      }
    }

    const all = new Set<string>();
    fieldSets.forEach(s => s.forEach(f => all.add(f)));

    const common = fieldSets.length >= 2
      ? [...fieldSets[0]].filter(f => fieldSets.every(s => s.has(f)))
      : [];

    return { allFields: [...all], commonFields: common };
  }, [nodeId, nodes, connections]);

  const handleSave = () => {
    onSave(nodeId, { joinStrategy, joinType, joinKey });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure Join"
        icon={GitMerge}
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
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Join Strategy
                    </label>
                    <select
                        value={joinStrategy}
                        onChange={(e) => setJoinStrategy(e.target.value as 'concat' | 'mergeByKey')}
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                    >
                        <option value="concat">Concatenate (combine all records)</option>
                        <option value="mergeByKey">Merge by common key</option>
                    </select>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
                        {joinStrategy === 'concat'
                            ? 'All records from A and B will be combined into one list'
                            : 'Records with matching key values will be merged together'}
                    </p>
                </div>

                {joinStrategy === 'mergeByKey' && (
                    <>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Join Type
                        </label>
                        <div className="space-y-2">
                            <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'inner' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                <input
                                    type="radio"
                                    name="joinType"
                                    value="inner"
                                    checked={joinType === 'inner'}
                                    onChange={() => setJoinType('inner')}
                                    className="mt-0.5 mr-3"
                                />
                                <div>
                                    <span className="font-medium text-xs text-[var(--text-primary)]">Inner Join</span>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                        Only records that match in both inputs
                                    </p>
                                </div>
                            </label>
                            <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'outer' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                <input
                                    type="radio"
                                    name="joinType"
                                    value="outer"
                                    checked={joinType === 'outer'}
                                    onChange={() => setJoinType('outer')}
                                    className="mt-0.5 mr-3"
                                />
                                <div>
                                    <span className="font-medium text-xs text-[var(--text-primary)]">Outer Join</span>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                        All records from both inputs (empty where no match)
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Common Key Field
                        </label>
                        {allFields.length > 0 ? (
                            <>
                                <select
                                    value={joinKey}
                                    onChange={(e) => setJoinKey(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                >
                                    <option value="">Select a field...</option>
                                    {commonFields.length > 0 && (
                                        <optgroup label="Common fields (recommended)">
                                            {commonFields.map(field => (
                                                <option key={field} value={field}>{field}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="All fields">
                                        {allFields.map(field => (
                                            <option key={field} value={field}>{field}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                {commonFields.length > 0 && (
                                    <p className="text-xs text-[#256A65] mt-1.5">
                                        ✓ {commonFields.length} common field(s) found
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={joinKey}
                                    onChange={(e) => setJoinKey(e.target.value)}
                                    placeholder="e.g., id, name"
                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                />
                                <p className="text-xs text-amber-600 mt-1.5">
                                    ⚠️ Run the input nodes first to see available fields
                                </p>
                            </>
                        )}
                    </div>
                    </>
                )}
        </div>
    </NodeConfigSidePanel>
  );
};
