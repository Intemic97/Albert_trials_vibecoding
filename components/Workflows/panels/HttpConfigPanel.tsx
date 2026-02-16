/**
 * HttpConfigPanel
 * Extracted from Workflows.tsx lines 7485-7537
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Globe, ChatText } from '@phosphor-icons/react';

interface HttpConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const HttpConfigPanel: React.FC<HttpConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [httpUrl, setHttpUrl] = useState(node?.config?.httpUrl || '');

  const handleSave = () => {
    if (!httpUrl.trim()) return;
    onSave(nodeId, { httpUrl });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure HTTP Request"
        icon={Globe}
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
                    disabled={!httpUrl.trim()}
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
                    URL
                </label>
                <input
                    type="text"
                    value={httpUrl}
                    onChange={(e) => setHttpUrl(e.target.value)}
                    placeholder="https://api.example.com/data"
                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                    Enter the full URL to fetch data from (GET request).
                </p>
            </div>
            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('http', 'HTTP Request')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
