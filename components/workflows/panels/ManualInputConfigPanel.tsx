/**
 * ManualInputConfigPanel
 * Extracted from Workflows.tsx lines 11808-11862
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChatText, PencilSimple } from '@phosphor-icons/react';

interface ManualInputConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const ManualInputConfigPanel: React.FC<ManualInputConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [manualInputVarName, setManualInputVarName] = useState(node?.config?.manualInputVarName || '');
  const [manualInputVarValue, setManualInputVarValue] = useState(node?.config?.manualInputVarValue || '');

  const handleSave = () => {
    onSave(nodeId, { manualInputVarName, manualInputVarValue });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure Manual Data Input"
        icon={PencilSimple}
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
                    disabled={!manualInputVarName.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Variable Name
                    </label>
                    <input
                        type="text"
                        value={manualInputVarName}
                        onChange={(e) => setManualInputVarName(e.target.value)}
                        placeholder="e.g., temperature, count, status"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Value
                    </label>
                    <input
                        type="text"
                        value={manualInputVarValue}
                        onChange={(e) => setManualInputVarValue(e.target.value)}
                        placeholder="e.g., 25, Active, Hello World"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Numbers will be parsed automatically.
                    </p>
                </div>
            </div>
    </NodeConfigSidePanel>
  );
};
