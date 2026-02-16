/**
 * ConditionConfigPanel
 * Extracted from Workflows.tsx - Condition (If/Else) node configuration
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { GitBranch, Trash, Plus, ChatText, WarningCircle } from '@phosphor-icons/react';

interface ConditionConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

const OPERATORS = [
  { value: 'equals', label: '==' },
  { value: 'notEquals', label: '!=' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'greaterOrEqual', label: '>=' },
  { value: 'lessOrEqual', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'not contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

export const ConditionConfigPanel: React.FC<ConditionConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [conditionField, setConditionField] = useState(node?.config?.conditionField || '');
  const [conditionOperator, setConditionOperator] = useState(node?.config?.conditionOperator || 'equals');
  const [conditionValue, setConditionValue] = useState(node?.config?.conditionValue || '');
  const [conditionProcessingMode, setConditionProcessingMode] = useState<'batch' | 'perRow'>(node?.config?.processingMode || 'batch');
  const [additionalConditions, setAdditionalConditions] = useState<Array<{id: string; field: string; operator: string; value: string}>>(node?.config?.additionalConditions || []);
  const [conditionLogicalOperator, setConditionLogicalOperator] = useState<'AND' | 'OR'>(node?.config?.logicalOperator || 'AND');
  const [nodeCustomTitle, setNodeCustomTitle] = useState(node?.config?.customName || '');

  // Get available fields from parent node
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let parentOutputData: any[] = [];
  if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
    parentOutputData = parentConnection?.outputType === 'B' ? parentNode.outputData.outputB || [] : parentNode.outputData.outputA || [];
  } else {
    parentOutputData = parentNode?.outputData || parentNode?.data || [];
  }
  const availableFields: string[] = [];
  if (Array.isArray(parentOutputData) && parentOutputData.length > 0) {
    const firstRecord = parentOutputData[0];
    if (firstRecord && typeof firstRecord === 'object') {
      Object.keys(firstRecord).forEach(key => { if (!availableFields.includes(key)) availableFields.push(key); });
    }
  }
  const hasAvailableFields = availableFields.length > 0;

  const handleSave = () => {
    if (!conditionField) return;
    const finalLabel = nodeCustomTitle.trim() || 'If / Else';
    onSave(nodeId, {
      conditionField, conditionOperator, conditionValue,
      processingMode: conditionProcessingMode,
      additionalConditions, logicalOperator: conditionLogicalOperator,
      customName: nodeCustomTitle.trim() || undefined
    }, finalLabel);
    onClose();
  };

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const addCondition = () => {
    setAdditionalConditions(prev => [...prev, { id: generateId(), field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (id: string) => {
    setAdditionalConditions(prev => prev.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, key: string, value: string) => {
    setAdditionalConditions(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const getOperatorLabel = (op: string) => {
    const found = OPERATORS.find(o => o.value === op);
    return found ? found.label : op;
  };

  const buildPreview = () => {
    let preview = `${conditionField} ${getOperatorLabel(conditionOperator)}`;
    if (!['isEmpty', 'isNotEmpty'].includes(conditionOperator)) {
      preview += ` "${conditionValue}"`;
    }
    for (const cond of additionalConditions) {
      if (cond.field) {
        preview += ` ${conditionLogicalOperator} ${cond.field} ${getOperatorLabel(cond.operator)}`;
        if (!['isEmpty', 'isNotEmpty'].includes(cond.operator)) {
          preview += ` "${cond.value}"`;
        }
      }
    }
    return preview;
  };

  const renderConditionRow = (
    field: string, operator: string, value: string,
    setField: (v: string) => void, setOperator: (v: string) => void, setValue: (v: string) => void,
    onRemove?: () => void, isPrimary?: boolean
  ) => (
    <div className="space-y-2">
      {!isPrimary && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-0.5">
            <button
              onClick={() => setConditionLogicalOperator('AND')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${conditionLogicalOperator === 'AND' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >AND</button>
            <button
              onClick={() => setConditionLogicalOperator('OR')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${conditionLogicalOperator === 'OR' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >OR</button>
          </div>
          {onRemove && (
            <button onClick={onRemove} className="ml-auto p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors">
              <Trash size={12} />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="flex-1 px-2 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
        >
          <option value="">Select field...</option>
          {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
          {!availableFields.includes(field) && field && <option value={field}>{field}</option>}
        </select>
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          className="w-28 px-2 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
        >
          {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
        {!['isEmpty', 'isNotEmpty'].includes(operator) && (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
            className="flex-1 px-2 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
          />
        )}
      </div>
    </div>
  );

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure Condition"
        icon={GitBranch}
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
                    disabled={!conditionField}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-4">
            {/* Custom Title */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Node Title</label>
                <input
                    type="text"
                    value={nodeCustomTitle}
                    onChange={(e) => setNodeCustomTitle(e.target.value)}
                    placeholder="If / Else"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
            </div>

            {/* No fields warning */}
            {!hasAvailableFields && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 rounded-lg">
                    <WarningCircle size={14} className="text-amber-500 shrink-0" weight="fill" />
                    <p className="text-xs text-amber-500">
                        Run the previous node first to see available fields
                    </p>
                </div>
            )}

            {hasAvailableFields && parentNode?.config?.fileName && (
                <p className="text-xs text-[var(--text-tertiary)]">
                    Fields from {parentNode.config.fileName}
                </p>
            )}

            {/* Primary Condition */}
            {renderConditionRow(
                conditionField,
                conditionOperator,
                conditionValue,
                setConditionField,
                setConditionOperator,
                setConditionValue,
                undefined,
                true
            )}

            {/* Additional Conditions */}
            {additionalConditions.map((condition) => (
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all"
            >
                <Plus size={14} weight="bold" />
                Add Condition
            </button>

            {/* Processing Mode */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Processing Mode
                </label>
                <div className="space-y-2">
                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'batch' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                        <input
                            type="radio"
                            name="processingMode"
                            value="batch"
                            checked={conditionProcessingMode === 'batch'}
                            onChange={() => setConditionProcessingMode('batch')}
                            className="mt-0.5 mr-3"
                        />
                        <div>
                            <span className="font-medium text-sm text-[var(--text-primary)]">Batch (all rows)</span>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                Evaluate first row → route ALL data to TRUE or FALSE
                            </p>
                        </div>
                    </label>
                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'perRow' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                        <input
                            type="radio"
                            name="processingMode"
                            value="perRow"
                            checked={conditionProcessingMode === 'perRow'}
                            onChange={() => setConditionProcessingMode('perRow')}
                            className="mt-0.5 mr-3"
                        />
                        <div>
                            <span className="font-medium text-sm text-[var(--text-primary)]">Per Row (filter)</span>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                Evaluate each row → matching to TRUE, non-matching to FALSE
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Preview */}
            {conditionField && (
                <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 font-medium">
                        Condition Preview
                    </p>
                    <code className="text-xs text-[var(--accent-primary)] font-mono break-all leading-relaxed">
                        {buildPreview()}
                    </code>
                </div>
            )}

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup?.('condition', 'Condition')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} weight="light" />
                    What would you like this node to do?
                </button>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
