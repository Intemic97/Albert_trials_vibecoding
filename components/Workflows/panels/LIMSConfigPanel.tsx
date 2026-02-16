/**
 * LIMSConfigPanel
 * Extracted from Workflows.tsx lines 8579-8665
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Database, Flask, ChatText } from '@phosphor-icons/react';

interface LIMSConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const LIMSConfigPanel: React.FC<LIMSConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [limsServerUrl, setLimsServerUrl] = useState(node?.config?.limsServerUrl || '');
  const [limsApiKey, setLimsApiKey] = useState(node?.config?.limsApiKey || '');
  const [limsEndpoint, setLimsEndpoint] = useState(node?.config?.limsEndpoint || 'materials');
  const [limsQuery, setLimsQuery] = useState(node?.config?.limsQuery || '');

  const handleSave = () => {
    onSave(nodeId, { limsServerUrl, limsApiKey, limsEndpoint, limsQuery });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="LIMS Connector"
        description="Fetch data from Laboratory Information Management System"
        icon={Flask}
        width="w-[500px]"
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
                    disabled={!limsServerUrl.trim() || !limsApiKey.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Connection Settings</h4>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            LIMS Server URL
                        </label>
                        <input
                            type="text"
                            value={limsServerUrl}
                            onChange={(e) => setLimsServerUrl(e.target.value)}
                            placeholder="https://lims.company.com/api"
                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            API Key
                        </label>
                        <input
                            type="password"
                            value={limsApiKey}
                            onChange={(e) => setLimsApiKey(e.target.value)}
                            placeholder="Enter API key"
                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Endpoint
                        </label>
                        <select
                            value={limsEndpoint}
                            onChange={(e) => setLimsEndpoint(e.target.value)}
                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                        >
                            <option value="materials">Materials (Raw Materials)</option>
                            <option value="batches">Batches</option>
                            <option value="qc">Quality Control Results</option>
                            <option value="analyses">Analyses</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Query (Optional)
                        </label>
                        <textarea
                            value={limsQuery}
                            onChange={(e) => setLimsQuery(e.target.value)}
                            placeholder='{"batchId": "BATCH123", "status": "approved"}'
                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                            rows={3}
                        />
                        <p className="text-xs text-[var(--text-secondary)] mt-1">JSON query parameters</p>
                    </div>
                </div>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
