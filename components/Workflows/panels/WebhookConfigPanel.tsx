/**
 * WebhookConfigPanel
 * Extracted from Workflows.tsx lines 7540-7621
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Copy, Globe, SpinnerGap } from '@phosphor-icons/react';

interface WebhookConfigPanelProps {
  nodeId: string;
  node: any;
  workflowId: string;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  showToast: (message: string, type: string) => void;
  generateId: () => string;
  API_BASE: string;
}

export const WebhookConfigPanel: React.FC<WebhookConfigPanelProps> = ({ nodeId, node, workflowId: workflowIdProp, onSave, onClose, showToast, generateId, API_BASE }) => {
  const { workflowId: urlWorkflowId } = useParams<{ workflowId: string }>();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Use prop first, fallback to URL param
  const workflowId = workflowIdProp || urlWorkflowId || '';

  // Fetch webhook URL from backend on mount
  useEffect(() => {
    const fetchWebhookUrl = async () => {
      console.log('[WebhookConfigPanel] workflowId:', workflowId, 'workflowIdProp:', workflowIdProp, 'urlWorkflowId:', urlWorkflowId, 'API_BASE:', API_BASE);
      if (!workflowId) {
        console.warn('[WebhookConfigPanel] No workflowId, skipping fetch');
        // Final fallback: construct URL locally
        const baseUrl = window.location.origin.replace(':5173', ':3001');
        setWebhookUrl(`${baseUrl}/api/webhook/unknown`);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const url = `${API_BASE}/workflow/${workflowId}/webhook-url`;
        console.log('[WebhookConfigPanel] Fetching:', url);
        const res = await fetch(url, {
          credentials: 'include'
        });
        console.log('[WebhookConfigPanel] Response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('[WebhookConfigPanel] Response data:', data);
          setWebhookUrl(data.webhookUrl || '');
          setWebhookToken(data.token || '');
        } else {
          console.warn('[WebhookConfigPanel] Non-OK response, using fallback');
          // Fallback to constructed URL
          const baseUrl = window.location.origin.replace(':5173', ':3001');
          setWebhookUrl(`${baseUrl}/api/webhook/${workflowId}`);
        }
      } catch (e) {
        console.error('[WebhookConfigPanel] Failed to fetch webhook URL:', e);
        const baseUrl = window.location.origin.replace(':5173', ':3001');
        setWebhookUrl(`${baseUrl}/api/webhook/${workflowId}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebhookUrl();
  }, [workflowId, workflowIdProp, urlWorkflowId, API_BASE]);

  const webhookUrlWithToken = webhookToken ? `${webhookUrl}/${webhookToken}` : webhookUrl;

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={onClose}
        title="Webhook Configuration"
        icon={Globe}
        footer={
            <button
                onClick={onClose}
                className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
            >
                Close
            </button>
        }
    >
        <div className="space-y-5">
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <SpinnerGap size={20} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">Loading webhook URL…</span>
                </div>
            ) : (
                <>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Your Webhook URL
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={webhookUrl}
                                className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(webhookUrl);
                                    showToast('Webhook URL copied!', 'success');
                                }}
                                className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    {webhookToken && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                URL with Token <span className="text-emerald-600">(more secure)</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrlWithToken}
                                    className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(webhookUrlWithToken);
                                        showToast('Secure webhook URL copied!', 'success');
                                    }}
                                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg p-3">
                        <p className="font-medium text-[var(--text-primary)] mb-1">How to use:</p>
                        <ol className="list-decimal list-inside space-y-1 text-[var(--text-primary)]">
                            <li>Copy the webhook URL above</li>
                            <li>Configure your external service to POST data to this URL</li>
                            <li>The workflow will execute automatically when data is received</li>
                        </ol>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)]">
                        <p className="font-medium mb-1">Example cURL:</p>
                        <pre className="bg-slate-800 text-[var(--accent-primary)] p-2 rounded overflow-x-auto">
{`curl -X POST ${webhookUrl} \\
-H "Content-Type: application/json" \\
-d '{"key": "value"}'`}
                        </pre>
                    </div>
                </>
            )}
        </div>
    </NodeConfigSidePanel>
  );
};
