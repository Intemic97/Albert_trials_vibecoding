/**
 * EsiosConfigPanel
 * Extracted from Workflows.tsx lines 9742-9809
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Leaf, Lightning, ChatText } from '@phosphor-icons/react';

interface EsiosConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const EsiosConfigPanel: React.FC<EsiosConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [esiosArchiveId, setEsiosArchiveId] = useState(node?.config?.esiosArchiveId || '1001');
  const [esiosDate, setEsiosDate] = useState(node?.config?.esiosDate || new Date().toISOString().split('T')[0]);

  const handleSave = () => {
    onSave(nodeId, { esiosArchiveId, esiosDate });
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure ESIOS Energy Prices"
        icon={Leaf}
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
                    disabled={!esiosArchiveId.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-5">
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Indicator ID
                </label>
                <input
                    type="text"
                    value={esiosArchiveId}
                    onChange={(e) => setEsiosArchiveId(e.target.value)}
                    placeholder="e.g., 1001 for PVPC"
                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    1001 = PVPC prices, 1739 = Spot prices, 10211 = Market price
                </p>
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Date
                </label>
                <input
                    type="date"
                    value={esiosDate}
                    onChange={(e) => setEsiosDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                />
            </div>
            <div className="p-3 border border-[var(--border-light)] rounded-lg">
                <p className="text-xs text-[var(--text-primary)] font-medium mb-1">Using Token:</p>
                <code className="text-[10px] text-[var(--text-secondary)] break-all">d668...da64</code>
            </div>
            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('esios', 'ESIOS Energy Prices')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
            </div>
    </NodeConfigSidePanel>
  );
};
