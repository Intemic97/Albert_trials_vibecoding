/**
 * Condition Node Configuration Modal
 * Allows configuring filter conditions for data routing
 */

import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { WorkflowNode, Connection } from '../types';

interface ConditionConfigModalProps {
  isOpen: boolean;
  nodeId: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  processingMode: 'batch' | 'perRow';
  onConditionFieldChange: (value: string) => void;
  onConditionOperatorChange: (value: string) => void;
  onConditionValueChange: (value: string) => void;
  onProcessingModeChange: (value: 'batch' | 'perRow') => void;
  onSave: () => void;
  onClose: () => void;
}

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'greater_or_equal', label: 'greater or equal' },
  { value: 'less_or_equal', label: 'less or equal' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

export const ConditionConfigModal: React.FC<ConditionConfigModalProps> = ({
  isOpen,
  nodeId,
  nodes,
  connections,
  conditionField,
  conditionOperator,
  conditionValue,
  processingMode,
  onConditionFieldChange,
  onConditionOperatorChange,
  onConditionValueChange,
  onProcessingModeChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  // Get available fields from parent node's output
  const incomingConn = connections.find(c => c.toNodeId === nodeId);
  const parentNode = incomingConn ? nodes.find(n => n.id === incomingConn.fromNodeId) : null;
  
  let availableFields: string[] = [];
  if (parentNode?.outputData && Array.isArray(parentNode.outputData) && parentNode.outputData.length > 0) {
    availableFields = Object.keys(parentNode.outputData[0]);
  } else if (parentNode?.data && Array.isArray(parentNode.data) && parentNode.data.length > 0) {
    availableFields = Object.keys(parentNode.data[0]);
  }

  const needsValue = !['is_empty', 'is_not_empty'].includes(conditionOperator);

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Condition"
      icon={WarningCircle}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!conditionField}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Processing Mode */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
            Processing Mode
          </label>
          <div className="space-y-2">
            <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${processingMode === 'perRow' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
              <input
                type="radio"
                name="processingMode"
                value="perRow"
                checked={processingMode === 'perRow'}
                onChange={() => onProcessingModeChange('perRow')}
                className="mt-0.5 mr-3"
              />
              <div>
                <span className="font-medium text-xs text-[var(--text-primary)]">Per Row (Filter)</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Evaluate condition for each row. Matching rows go to TRUE, others to FALSE.
                </p>
              </div>
            </label>
            <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${processingMode === 'batch' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
              <input
                type="radio"
                name="processingMode"
                value="batch"
                checked={processingMode === 'batch'}
                onChange={() => onProcessingModeChange('batch')}
                className="mt-0.5 mr-3"
              />
              <div>
                <span className="font-medium text-xs text-[var(--text-primary)]">Batch (All or Nothing)</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Check if ANY row matches. All data goes to TRUE or FALSE branch.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Field Selection */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
            Field to Check
          </label>
          {availableFields.length > 0 ? (
            <select
              value={conditionField}
              onChange={(e) => onConditionFieldChange(e.target.value)}
              className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
            >
              <option value="">Select a field...</option>
              {availableFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="text"
                value={conditionField}
                onChange={(e) => onConditionFieldChange(e.target.value)}
                placeholder="e.g., status, type, amount"
                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
              />
              <p className="text-xs text-amber-600 mt-1.5">
                ⚠️ Run the previous node first to see available fields
              </p>
            </>
          )}
        </div>

        {/* Operator */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
            Operator
          </label>
          <select
            value={conditionOperator}
            onChange={(e) => onConditionOperatorChange(e.target.value)}
            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>

        {/* Value */}
        {needsValue && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
              Value
            </label>
            <input
              type="text"
              value={conditionValue}
              onChange={(e) => onConditionValueChange(e.target.value)}
              placeholder="Enter value to compare..."
              className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        )}

        {/* Preview */}
        {conditionField && (
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Condition:</span>{' '}
              <code className="px-1 py-0.5 bg-[var(--bg-card)] rounded text-[var(--text-primary)]">
                {conditionField}
              </code>{' '}
              {OPERATORS.find(o => o.value === conditionOperator)?.label}{' '}
              {needsValue && (
                <code className="px-1 py-0.5 bg-[var(--bg-card)] rounded text-[var(--text-primary)]">
                  {conditionValue || '(empty)'}
                </code>
              )}
            </p>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
