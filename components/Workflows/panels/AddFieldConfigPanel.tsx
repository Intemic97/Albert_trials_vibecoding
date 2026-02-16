/**
 * AddFieldConfigPanel
 * Extracted from Workflows.tsx lines 10739-10790
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChatText, Plus } from '@phosphor-icons/react';

interface AddFieldConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const AddFieldConfigPanel: React.FC<AddFieldConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [addFieldName, setAddFieldName] = useState(node?.config?.addFieldName || '');
  const [addFieldValue, setAddFieldValue] = useState(node?.config?.addFieldValue || '');

  const handleSave = () => {
    onSave(nodeId, { addFieldName, addFieldValue });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Add Field to Records"
        icon={Plus}
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
                    disabled={!addFieldName}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Field Name
                </label>
                <input
                    type="text"
                    value={addFieldName}
                    onChange={(e) => setAddFieldName(e.target.value)}
                    placeholder="e.g., Nombre, Category"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Field Value
                </label>
                <input
                    type="text"
                    value={addFieldValue}
                    onChange={(e) => setAddFieldValue(e.target.value)}
                    placeholder="e.g., Albert, Active"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
