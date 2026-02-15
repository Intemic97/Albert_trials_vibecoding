/**
 * WebhookResponseConfigPanel
 * Extracted from Workflows.tsx lines 7624-7822
 */

import React from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ArrowRight, ChatText } from '@phosphor-icons/react';

interface WebhookResponseConfigPanelProps {
  nodeId: string;
  nodes: any[];
  onUpdateConfig: (nodeId: string, config: Record<string, any>) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const WebhookResponseConfigPanel: React.FC<WebhookResponseConfigPanelProps> = ({
  nodeId, nodes, onUpdateConfig, onClose, openFeedbackPopup
}) => {
  const node = nodes.find(n => n.id === nodeId);
  const responseMode = node?.config?.webhookResponseMode || 'passthrough';
  const statusCode = node?.config?.webhookResponseStatusCode || 200;
  const selectedFields = node?.config?.webhookResponseFields || [];
  const responseTemplate = node?.config?.webhookResponseTemplate || '{\n  "result": "{{response}}",\n  "status": "ok"\n}';
  const responseHeaders = node?.config?.webhookResponseHeaders || [];

  const updateConfig = (field: string, value: any) => {
    onUpdateConfig(nodeId, { [field]: value });
  };

  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Webhook Response"
      icon={ArrowRight}
      footer={
        <button
          onClick={onClose}
          className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5">
        {/* Status Code */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">HTTP Status Code</label>
          <select
            value={statusCode}
            onChange={(e) => updateConfig('webhookResponseStatusCode', parseInt(e.target.value))}
            className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)]"
          >
            <option value={200}>200 - OK</option>
            <option value={201}>201 - Created</option>
            <option value={202}>202 - Accepted</option>
            <option value={204}>204 - No Content</option>
            <option value={400}>400 - Bad Request</option>
            <option value={404}>404 - Not Found</option>
            <option value={500}>500 - Server Error</option>
          </select>
        </div>

        {/* Response Mode */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">Response Mode</label>
          <div className="space-y-2">
            {[
              { value: 'passthrough', label: 'Pass-through', desc: 'Return all input data as-is' },
              { value: 'selected', label: 'Selected Fields', desc: 'Choose which fields to include' },
              { value: 'template', label: 'JSON Template', desc: 'Define a custom JSON response with placeholders' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="responseMode" value={opt.value}
                  checked={responseMode === opt.value}
                  onChange={() => updateConfig('webhookResponseMode', opt.value)}
                  className="text-orange-600" />
                <div>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{opt.label}</span>
                  <p className="text-[10px] text-[var(--text-secondary)]">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Selected Fields */}
        {responseMode === 'selected' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">Fields to include (comma-separated)</label>
            <input type="text" value={selectedFields.join(', ')}
              onChange={(e) => updateConfig('webhookResponseFields', e.target.value.split(',').map((f: string) => f.trim()).filter(Boolean))}
              placeholder="field1, field2, response"
              className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Only these fields from the input data will be returned</p>
          </div>
        )}

        {/* Template */}
        {responseMode === 'template' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">JSON Response Template</label>
            <textarea value={responseTemplate}
              onChange={(e) => updateConfig('webhookResponseTemplate', e.target.value)}
              rows={8}
              className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] font-mono resize-y" />
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">{'Use {{fieldName}} to insert values from input data'}</p>
          </div>
        )}

        {/* Custom Headers */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">Custom Response Headers</label>
          {responseHeaders.map((header: { key: string; value: string }, idx: number) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" value={header.key}
                onChange={(e) => { const u = [...responseHeaders]; u[idx] = { ...u[idx], key: e.target.value }; updateConfig('webhookResponseHeaders', u); }}
                placeholder="Header-Name" className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
              <input type="text" value={header.value}
                onChange={(e) => { const u = [...responseHeaders]; u[idx] = { ...u[idx], value: e.target.value }; updateConfig('webhookResponseHeaders', u); }}
                placeholder="value" className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
              <button onClick={() => updateConfig('webhookResponseHeaders', responseHeaders.filter((_: any, i: number) => i !== idx))}
                className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs">x</button>
            </div>
          ))}
          <button onClick={() => updateConfig('webhookResponseHeaders', [...responseHeaders, { key: '', value: '' }])}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium">+ Add Header</button>
        </div>

        {/* Info */}
        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg p-3">
          <p className="font-medium text-[var(--text-primary)] mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-primary)]">
            <li>Place this node at the end of a webhook-triggered workflow</li>
            <li>The data flowing into this node will be returned as the HTTP response</li>
            <li>The external system that called the webhook receives the processed data</li>
          </ol>
        </div>

        {openFeedbackPopup && (
          <div className="pt-3 border-t border-[var(--border-light)]">
            <button onClick={() => openFeedbackPopup('webhookResponse', 'Webhook Response')}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors">
              <ChatText size={12} /> What would you like this node to do?
            </button>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
