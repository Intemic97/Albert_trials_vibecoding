/**
 * AlertAgentConfigPanel
 * Extracted from Workflows.tsx lines 8740-8827
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Bell, Info, ChatText, Warning } from '@phosphor-icons/react';

interface AlertAgentConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const AlertAgentConfigPanel: React.FC<AlertAgentConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [alertConditions, setAlertConditions] = useState(node?.config?.alertConditions || '[]');
  const [alertSeverity, setAlertSeverity] = useState(node?.config?.alertSeverity || 'warning');
  const [alertActions, setAlertActions] = useState(node?.config?.alertActions || ['email']);
  const [alertRecipients, setAlertRecipients] = useState(node?.config?.alertRecipients || '');

  const handleSave = () => {
    onSave(nodeId, { alertConditions, alertSeverity, alertActions, alertRecipients });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Alert Agent"
        description="Configure deterministic alerts with conditions and actions"
        icon={Bell}
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
                    disabled={!alertConditions.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Alert Severity</h4>
                <select
                    value={alertSeverity}
                    onChange={(e) => setAlertSeverity(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Alert Conditions (JSON)</h4>
                <textarea
                    value={alertConditions}
                    onChange={(e) => setAlertConditions(e.target.value)}
                    placeholder='[{"field": "temperature", "operator": ">", "value": 100, "message": "Temperature exceeded limit"}]'
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                    rows={6}
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Array of condition objects. Operators: &gt;, &lt;, &gt;=, &lt;=, ==, !=</p>
            </div>
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Actions</h4>
                <div className="space-y-2">
                    {['email', 'sms', 'webhook', 'stop'].map(action => (
                        <label key={action} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={alertActions.includes(action)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setAlertActions([...alertActions, action]);
                                    } else {
                                        setAlertActions(alertActions.filter(a => a !== action));
                                    }
                                }}
                                className="w-4 h-4 text-[var(--text-secondary)] border-[var(--border-medium)] rounded focus:ring-[var(--border-medium)]"
                            />
                            <span className="text-xs text-[var(--text-primary)] capitalize">{action}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Recipients (comma-separated)
                </label>
                <input
                    type="text"
                    value={alertRecipients}
                    onChange={(e) => setAlertRecipients(e.target.value)}
                    placeholder="email@example.com, +1234567890"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Emails or phone numbers</p>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
