/**
 * Condition Node Configuration Modal
 * Allows configuring filter conditions for data routing
 * Supports multiple conditions with AND/OR logic
 */

import React, { useState, useEffect } from 'react';
import { Warning, Plus, Trash, CaretDown } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { WorkflowNode, Connection } from '../types';

// Single condition structure
export interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ConditionConfigModalProps {
  isOpen: boolean;
  nodeId: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  processingMode: 'batch' | 'perRow';
  // New props for multiple conditions
  additionalConditions?: ConditionRule[];
  logicalOperator?: 'AND' | 'OR';
  onConditionFieldChange: (value: string) => void;
  onConditionOperatorChange: (value: string) => void;
  onConditionValueChange: (value: string) => void;
  onProcessingModeChange: (value: 'batch' | 'perRow') => void;
  onAdditionalConditionsChange?: (conditions: ConditionRule[]) => void;
  onLogicalOperatorChange?: (operator: 'AND' | 'OR') => void;
  onSave: () => void;
  onClose: () => void;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_or_equal', label: 'Greater or Equal' },
  { value: 'less_or_equal', label: 'Less or Equal' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export const ConditionConfigModal: React.FC<ConditionConfigModalProps> = ({
  isOpen,
  nodeId,
  nodes,
  connections,
  conditionField,
  conditionOperator,
  conditionValue,
  processingMode,
  additionalConditions = [],
  logicalOperator = 'AND',
  onConditionFieldChange,
  onConditionOperatorChange,
  onConditionValueChange,
  onProcessingModeChange,
  onAdditionalConditionsChange,
  onLogicalOperatorChange,
  onSave,
  onClose,
}) => {
  // Local state for additional conditions
  const [localConditions, setLocalConditions] = useState<ConditionRule[]>(additionalConditions);
  const [localLogicalOperator, setLocalLogicalOperator] = useState<'AND' | 'OR'>(logicalOperator);

  // Sync local state with props
  useEffect(() => {
    setLocalConditions(additionalConditions);
    setLocalLogicalOperator(logicalOperator);
  }, [additionalConditions, logicalOperator, isOpen]);

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

  const needsValue = (op: string) => !['is_empty', 'is_not_empty'].includes(op);

  const addCondition = () => {
    const newCondition: ConditionRule = {
      id: generateId(),
      field: availableFields[0] || '',
      operator: 'equals',
      value: ''
    };
    const updated = [...localConditions, newCondition];
    setLocalConditions(updated);
    onAdditionalConditionsChange?.(updated);
  };

  const removeCondition = (id: string) => {
    const updated = localConditions.filter(c => c.id !== id);
    setLocalConditions(updated);
    onAdditionalConditionsChange?.(updated);
  };

  const updateCondition = (id: string, field: keyof ConditionRule, value: string) => {
    const updated = localConditions.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
    setLocalConditions(updated);
    onAdditionalConditionsChange?.(updated);
  };

  const handleLogicalOperatorChange = (op: 'AND' | 'OR') => {
    setLocalLogicalOperator(op);
    onLogicalOperatorChange?.(op);
  };

  // Render a single condition row
  const renderConditionRow = (
    field: string,
    operator: string,
    value: string,
    onFieldChange: (v: string) => void,
    onOperatorChange: (v: string) => void,
    onValueChange: (v: string) => void,
    onRemove?: () => void,
    isFirst: boolean = false
  ) => (
    <div className="relative">
      {/* AND/OR connector */}
      {!isFirst && localConditions.length > 0 && (
        <div className="flex items-center justify-center mb-3">
          <div className="flex-1 h-px bg-[var(--border-light)]" />
          <button
            onClick={() => handleLogicalOperatorChange(localLogicalOperator === 'AND' ? 'OR' : 'AND')}
            className={`mx-3 px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              localLogicalOperator === 'AND'
                ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
            }`}
          >
            {localLogicalOperator}
          </button>
          <div className="flex-1 h-px bg-[var(--border-light)]" />
        </div>
      )}
      
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)] relative">
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
            title="Remove condition"
          >
            <Trash size={14} />
          </button>
        )}
        
        <div className="space-y-3">
          {/* Field */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Field Name
            </label>
            {availableFields.length > 0 ? (
              <div className="relative">
                <select
                  value={field}
                  onChange={(e) => onFieldChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] appearance-none cursor-pointer"
                >
                  <option value="">Select a field...</option>
                  {availableFields.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
              </div>
            ) : (
              <input
                type="text"
                value={field}
                onChange={(e) => onFieldChange(e.target.value)}
                placeholder="e.g., status, amount"
                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            )}
          </div>
          
          {/* Operator */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Operator
            </label>
            <div className="relative">
              <select
                value={operator}
                onChange={(e) => onOperatorChange(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] appearance-none cursor-pointer"
              >
                {OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            </div>
          </div>
          
          {/* Value */}
          {needsValue(operator) && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Value
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder="Enter value..."
                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Build preview string
  const buildPreview = () => {
    const conditions: string[] = [];
    
    if (conditionField) {
      const op = OPERATORS.find(o => o.value === conditionOperator)?.label || conditionOperator;
      const val = needsValue(conditionOperator) ? ` "${conditionValue || '...'}"` : '';
      conditions.push(`${conditionField} ${op}${val}`);
    }
    
    localConditions.forEach(c => {
      if (c.field) {
        const op = OPERATORS.find(o => o.value === c.operator)?.label || c.operator;
        const val = needsValue(c.operator) ? ` "${c.value || '...'}"` : '';
        conditions.push(`${c.field} ${op}${val}`);
      }
    });
    
    return conditions.join(` ${localLogicalOperator} `);
  };

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Condition"
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
            disabled={!conditionField}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Field source info */}
        {availableFields.length > 0 && parentNode?.config?.fileName && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Fields from {parentNode.config.fileName}
          </p>
        )}
        
        {/* No fields warning */}
        {availableFields.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg">
            <Warning size={16} className="text-amber-400 shrink-0" weight="fill" />
            <p className="text-xs text-amber-400">
              Run the previous node first to see available fields
            </p>
          </div>
        )}

        {/* Primary Condition */}
        {renderConditionRow(
          conditionField,
          conditionOperator,
          conditionValue,
          onConditionFieldChange,
          onConditionOperatorChange,
          onConditionValueChange,
          undefined,
          true
        )}

        {/* Additional Conditions */}
        {localConditions.map((condition) => (
          <div key={condition.id}>
            {renderConditionRow(
              condition.field,
              condition.operator,
              condition.value,
              (v) => updateCondition(condition.id, 'field', v),
              (v) => updateCondition(condition.id, 'operator', v),
              (v) => updateCondition(condition.id, 'value', v),
              () => removeCondition(condition.id),
              false
            )}
          </div>
        ))}

        {/* Add Condition Button */}
        <button
          onClick={addCondition}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-[var(--border-light)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all"
        >
          <Plus size={16} weight="bold" />
          Add Condition
        </button>

        {/* Processing Mode */}
        <div className="pt-4 border-t border-[var(--border-light)]">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
            Processing Mode
          </label>
          <div className="space-y-2">
            <label className={`flex items-start p-3 rounded-lg cursor-pointer transition-all ${
              processingMode === 'perRow' 
                ? 'bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]' 
                : 'bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-light)]'
            }`}>
              <input
                type="radio"
                name="processingMode"
                value="perRow"
                checked={processingMode === 'perRow'}
                onChange={() => onProcessingModeChange('perRow')}
                className="mt-0.5 mr-3 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <div>
                <span className="font-medium text-sm text-[var(--text-primary)]">Per Row (Filter)</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Evaluate each row → matching rows to TRUE, others to FALSE
                </p>
              </div>
            </label>
            <label className={`flex items-start p-3 rounded-lg cursor-pointer transition-all ${
              processingMode === 'batch' 
                ? 'bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]' 
                : 'bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-light)]'
            }`}>
              <input
                type="radio"
                name="processingMode"
                value="batch"
                checked={processingMode === 'batch'}
                onChange={() => onProcessingModeChange('batch')}
                className="mt-0.5 mr-3 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <div>
                <span className="font-medium text-sm text-[var(--text-primary)]">Batch (all rows)</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Evaluate first row → route ALL data to TRUE or FALSE
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Preview */}
        {conditionField && (
          <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 font-medium">
              Condition Preview
            </p>
            <code className="text-sm text-[var(--accent-primary)] font-mono break-all leading-relaxed">
              {buildPreview()}
            </code>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
