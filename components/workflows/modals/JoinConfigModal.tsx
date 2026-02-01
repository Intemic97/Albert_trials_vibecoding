/**
 * Join Node Configuration Modal
 * Allows configuring how two data sources are merged
 */

import React from 'react';
import { Warning, CheckCircle } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { WorkflowNode, Connection } from '../types';

interface JoinConfigModalProps {
  isOpen: boolean;
  nodeId: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  joinStrategy: 'concat' | 'mergeByKey';
  joinType: 'inner' | 'outer';
  joinKey: string;
  onJoinStrategyChange: (value: 'concat' | 'mergeByKey') => void;
  onJoinTypeChange: (value: 'inner' | 'outer') => void;
  onJoinKeyChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const JoinConfigModal: React.FC<JoinConfigModalProps> = ({
  isOpen,
  nodeId,
  nodes,
  connections,
  joinStrategy,
  joinType,
  joinKey,
  onJoinStrategyChange,
  onJoinTypeChange,
  onJoinKeyChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  // Find input nodes to get available fields
  const joinNode = nodes.find(n => n.id === nodeId);
  
  // Try to get data from inputDataA/B first, then from parent nodes
  let inputAData = joinNode?.inputDataA;
  let inputBData = joinNode?.inputDataB;
  
  // If inputDataA/B not available, look at parent nodes' outputData
  if (!inputAData || !inputBData) {
    const incomingConns = connections.filter(c => c.toNodeId === nodeId);
    for (const conn of incomingConns) {
      const parentNode = nodes.find(n => n.id === conn.fromNodeId);
      if (parentNode?.outputData) {
        // Handle splitColumns parent node
        let parentData;
        if (parentNode.type === 'splitColumns') {
          parentData = conn.outputType === 'B' 
            ? parentNode.outputData.outputB 
            : parentNode.outputData.outputA;
        } else {
          parentData = parentNode.outputData;
        }
        
        if (conn.inputPort === 'A' && !inputAData) {
          inputAData = parentData;
        } else if (conn.inputPort === 'B' && !inputBData) {
          inputBData = parentData;
        }
      }
    }
  }
  
  // Extract common fields from both inputs
  const fieldsA = inputAData && Array.isArray(inputAData) && inputAData.length > 0 
    ? Object.keys(inputAData[0]) 
    : [];
  const fieldsB = inputBData && Array.isArray(inputBData) && inputBData.length > 0 
    ? Object.keys(inputBData[0]) 
    : [];
  const commonFields = fieldsA.filter(f => fieldsB.includes(f));
  const allFields = [...new Set([...fieldsA, ...fieldsB])];

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Join"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Join Strategy
          </label>
          <select
            value={joinStrategy}
            onChange={(e) => onJoinStrategyChange(e.target.value as 'concat' | 'mergeByKey')}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="concat">Concatenate (combine all records)</option>
            <option value="mergeByKey">Merge by common key</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            {joinStrategy === 'concat' 
              ? 'All records from A and B will be combined into one list'
              : 'Records with matching key values will be merged together'}
          </p>
        </div>
        
        {joinStrategy === 'mergeByKey' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                Join Type
              </label>
              <div className="space-y-2">
                <label className={`flex items-start p-3 rounded-lg cursor-pointer transition-all ${
                  joinType === 'inner' 
                    ? 'bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]' 
                    : 'bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-light)]'
                }`}>
                  <input
                    type="radio"
                    name="joinType"
                    value="inner"
                    checked={joinType === 'inner'}
                    onChange={() => onJoinTypeChange('inner')}
                    className="mt-0.5 mr-3 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <div>
                    <span className="font-medium text-sm text-[var(--text-primary)]">Inner Join</span>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      Only records that match in both inputs
                    </p>
                  </div>
                </label>
                <label className={`flex items-start p-3 rounded-lg cursor-pointer transition-all ${
                  joinType === 'outer' 
                    ? 'bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]' 
                    : 'bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-light)]'
                }`}>
                  <input
                    type="radio"
                    name="joinType"
                    value="outer"
                    checked={joinType === 'outer'}
                    onChange={() => onJoinTypeChange('outer')}
                    className="mt-0.5 mr-3 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <div>
                    <span className="font-medium text-sm text-[var(--text-primary)]">Outer Join</span>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      All records from both inputs (empty where no match)
                    </p>
                  </div>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                Common Key Field
              </label>
              {allFields.length > 0 ? (
                <>
                  <select
                    value={joinKey}
                    onChange={(e) => onJoinKeyChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
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
                    <div className="flex items-center gap-2 mt-2 p-2 bg-emerald-500/10 rounded-lg">
                      <CheckCircle size={14} className="text-emerald-400 shrink-0" weight="fill" />
                      <p className="text-xs text-emerald-400">
                        {commonFields.length} common field(s) found
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={joinKey}
                    onChange={(e) => onJoinKeyChange(e.target.value)}
                    placeholder="e.g., id, name"
                    className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                  />
                  <div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/10 rounded-lg">
                    <Warning size={14} className="text-amber-400 shrink-0" weight="fill" />
                    <p className="text-xs text-amber-400">
                      Run the input nodes first to see available fields
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
