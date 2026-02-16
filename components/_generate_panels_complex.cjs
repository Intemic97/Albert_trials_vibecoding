/**
 * Complex Panel Generator - Handles IIFE and special panels
 * 
 * Usage: node components/_generate_panels_complex.cjs
 */

const fs = require('fs');
const path = require('path');

const PANELS_DIR = path.join(__dirname, 'Workflows', 'panels');
const RAW_DIR = path.join(PANELS_DIR, '_raw');
const WORKFLOWS_PATH = path.join(__dirname, 'Workflows.tsx');

const source = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
const srcLines = source.split('\n');

// Helper: extract JSX block from source
function extractBlock(startLine, endLine) {
  return srcLines.slice(startLine - 1, endLine).join('\n');
}

// Helper: extract inner JSX (remove outer conditional, normalize indent)
function extractInnerJSX(startLine, endLine, isIIFE) {
  const block = srcLines.slice(startLine - 1, endLine);
  const inner = block.slice(1, -1); // Remove first/last line
  const firstContent = inner.find(l => l.trim().length > 0);
  if (!firstContent) return '';
  const baseIndent = firstContent.match(/^(\s*)/)[1].length;
  return inner.map(line => {
    if (line.trim().length === 0) return '';
    const curr = line.match(/^(\s*)/)[1].length;
    const newIndent = Math.max(0, curr - baseIndent + 4);
    return ' '.repeat(newIndent) + line.trim();
  }).join('\n');
}

// ============================================================================
// Generate each complex panel
// ============================================================================

const files = {};

// 1. WebhookResponseConfigPanel - immediate config updates
files['WebhookResponseConfigPanel.tsx'] = `/**
 * WebhookResponseConfigPanel
 * Extracted from Workflows.tsx lines 7624-7822
 */

import React from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ArrowRight, MessageSquare } from '@phosphor-icons/react';

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
  const responseTemplate = node?.config?.webhookResponseTemplate || '{\\n  "result": "{{response}}",\\n  "status": "ok"\\n}';
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
          className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
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
              <MessageSquare size={12} /> What would you like this node to do?
            </button>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
`;

// 2-4. Email, SMS, WhatsApp - IIFE with connections lookup
// These follow the same pattern, I'll generate them from raw extracts with transformations

function generateCommPanel(name, rawFile, startLine, endLine, stateVars, saveConfig, labelTemplate, icon, title, extraIcons, smtpState) {
  const raw = fs.readFileSync(path.join(RAW_DIR, rawFile), 'utf-8');
  const rawLines = raw.split('\n').filter(l => !l.startsWith('//') || l.trim() === '');
  
  const stateDecls = stateVars.map(s => 
    `  const [${s.name}, ${s.setter}] = useState(node?.config?.${s.configKey} || ${s.default});`
  ).join('\n');
  
  const smtpDecl = smtpState ? `  const [${smtpState.name}, ${smtpState.setter}] = useState(${smtpState.default});` : '';
  
  const saveKeys = Object.entries(saveConfig).map(([k,v]) => `${k}: ${v || k}`).join(', ');
  
  return `/**
 * ${name}
 * Extracted from Workflows.tsx lines ${startLine}-${endLine}
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ${[icon, 'MessageSquare', ...extraIcons].filter((v,i,a) => a.indexOf(v) === i).sort().join(', ')} } from '@phosphor-icons/react';

interface ${name}Props {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const ${name}: React.FC<${name}Props> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  // Local state initialized from node config
${stateDecls}
${smtpDecl}

  // Get input data from parent node for @ mentions
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let inputData: any[] = [];
  if (parentNode) {
    if (parentNode.type === 'splitColumns' && parentNode.outputData) {
      inputData = parentConnection.outputType === 'B'
        ? parentNode.outputData.outputB || []
        : parentNode.outputData.outputA || [];
    } else {
      inputData = parentNode.outputData || parentNode.config?.parsedData || [];
    }
  }
  const availableColumns = Array.isArray(inputData) && inputData.length > 0 && typeof inputData[0] === 'object'
    ? Object.keys(inputData[0]) : [];

  const handleSave = () => {
    onSave(nodeId, { ${saveKeys} }${labelTemplate ? `, ${labelTemplate}` : ''});
  };

  // Note: Full JSX is extracted from Workflows.tsx and may reference variables above
  // For @ mentions in body fields, use availableColumns
  return null; // PLACEHOLDER - needs manual JSX from raw extract
};
`;
}

// For each IIFE communication panel, I'll create a simpler version
// that captures the essential functionality

// Email
files['EmailConfigPanel.tsx'] = generateCommPanel(
  'EmailConfigPanel', 'EmailConfigPanel.raw.tsx', 8901, 9083,
  [
    { name: 'emailTo', setter: 'setEmailTo', configKey: 'emailTo', default: "''" },
    { name: 'emailSubject', setter: 'setEmailSubject', configKey: 'emailSubject', default: "''" },
    { name: 'emailBody', setter: 'setEmailBody', configKey: 'emailBody', default: "''" },
    { name: 'emailSmtpHost', setter: 'setEmailSmtpHost', configKey: 'emailSmtpHost', default: "'smtp.gmail.com'" },
    { name: 'emailSmtpPort', setter: 'setEmailSmtpPort', configKey: 'emailSmtpPort', default: "'587'" },
    { name: 'emailSmtpUser', setter: 'setEmailSmtpUser', configKey: 'emailSmtpUser', default: "''" },
    { name: 'emailSmtpPass', setter: 'setEmailSmtpPass', configKey: 'emailSmtpPass', default: "''" },
  ],
  { emailTo: null, emailSubject: null, emailBody: null, emailSmtpHost: 'emailSmtpHost || undefined', emailSmtpPort: 'emailSmtpPort || undefined', emailSmtpUser: 'emailSmtpUser || undefined', emailSmtpPass: 'emailSmtpPass || undefined' },
  "`Email to: ${emailTo.split('@')[0]}...`",
  'EnvelopeSimple', 'Send Email', ['Eye', 'EyeSlash', 'CaretDown'],
  { name: 'showEmailSmtpSettings', setter: 'setShowEmailSmtpSettings', default: 'false' }
);

// SMS  
files['SMSConfigPanel.tsx'] = generateCommPanel(
  'SMSConfigPanel', 'SMSConfigPanel.raw.tsx', 9086, 9238,
  [
    { name: 'smsTo', setter: 'setSmsTo', configKey: 'smsTo', default: "''" },
    { name: 'smsBody', setter: 'setSmsBody', configKey: 'smsBody', default: "''" },
    { name: 'twilioAccountSid', setter: 'setTwilioAccountSid', configKey: 'twilioAccountSid', default: "''" },
    { name: 'twilioAuthToken', setter: 'setTwilioAuthToken', configKey: 'twilioAuthToken', default: "''" },
    { name: 'twilioFromNumber', setter: 'setTwilioFromNumber', configKey: 'twilioFromNumber', default: "''" },
  ],
  { smsTo: null, smsBody: null, twilioAccountSid: null, twilioAuthToken: null, twilioFromNumber: null },
  "`SMS to: ...${smsTo.slice(-4)}`",
  'Phone', 'Send SMS', ['Eye', 'EyeSlash', 'CaretDown'],
  { name: 'showSMSTwilioSettings', setter: 'setShowSMSTwilioSettings', default: 'false' }
);

// WhatsApp
files['WhatsAppConfigPanel.tsx'] = generateCommPanel(
  'WhatsAppConfigPanel', 'WhatsAppConfigPanel.raw.tsx', 9241, 9393,
  [
    { name: 'whatsappTo', setter: 'setWhatsappTo', configKey: 'whatsappTo', default: "''" },
    { name: 'whatsappBody', setter: 'setWhatsappBody', configKey: 'whatsappBody', default: "''" },
    { name: 'whatsappTwilioAccountSid', setter: 'setWhatsappTwilioAccountSid', configKey: 'whatsappTwilioAccountSid', default: "''" },
    { name: 'whatsappTwilioAuthToken', setter: 'setWhatsappTwilioAuthToken', configKey: 'whatsappTwilioAuthToken', default: "''" },
    { name: 'whatsappTwilioFromNumber', setter: 'setWhatsappTwilioFromNumber', configKey: 'whatsappTwilioFromNumber', default: "''" },
  ],
  { whatsappTo: null, whatsappBody: null, whatsappTwilioAccountSid: null, whatsappTwilioAuthToken: null, whatsappTwilioFromNumber: null },
  "`WhatsApp to: ...${whatsappTo.slice(-4)}`",
  'WhatsappLogo', 'Send WhatsApp', ['Eye', 'EyeSlash', 'CaretDown'],
  { name: 'showWhatsAppTwilioSettings', setter: 'setShowWhatsAppTwilioSettings', default: 'false' }
);

// ============================================================================
// REMAINING PANELS - Generate from raw extracts with transformations
// ============================================================================

// For each remaining panel, I'll read the raw extract JSX and create
// a component that uses the raw JSX with minimal transformation

function readRawJSX(rawFile) {
  const raw = fs.readFileSync(path.join(RAW_DIR, rawFile), 'utf-8');
  // Skip comment lines at top
  const lines = raw.split('\n');
  const codeStart = lines.findIndex(l => !l.startsWith('//') && l.trim().length > 0);
  return lines.slice(codeStart >= 0 ? codeStart : 0).join('\n');
}

// Condition Panel
files['ConditionConfigPanel.tsx'] = `/**
 * ConditionConfigPanel
 * Extracted from Workflows.tsx lines 10400-10736
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { GitBranch, Trash, Plus, MessageSquare } from '@phosphor-icons/react';

interface ConditionConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

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

  const handleSave = () => {
    if (!conditionField) return;
    const finalLabel = nodeCustomTitle.trim() || 'If / Else';
    onSave(nodeId, {
      conditionField, conditionOperator, conditionValue,
      processingMode: conditionProcessingMode,
      additionalConditions, logicalOperator: conditionLogicalOperator,
      customName: nodeCustomTitle.trim() || undefined
    }, finalLabel);
  };

  const generateId = () => Math.random().toString(36).substring(2, 11);

  // Note: Full JSX extracted from Workflows.tsx - this is a placeholder
  // The actual JSX will be copied from the raw extract
  return null; // PLACEHOLDER
};
`;

// Join Panel
files['JoinConfigPanel.tsx'] = `/**
 * JoinConfigPanel
 * Extracted from Workflows.tsx lines 10793-10971
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { GitBranch, MessageSquare } from '@phosphor-icons/react';

interface JoinConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const JoinConfigPanel: React.FC<JoinConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [joinStrategy, setJoinStrategy] = useState(node?.config?.joinStrategy || 'concat');
  const [joinType, setJoinType] = useState(node?.config?.joinType || 'inner');
  const [joinKey, setJoinKey] = useState(node?.config?.joinKey || '');

  const handleSave = () => {
    onSave(nodeId, { joinStrategy, joinType, joinKey });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// SplitColumns Panel  
files['SplitColumnsConfigPanel.tsx'] = `/**
 * SplitColumnsConfigPanel
 * Extracted from Workflows.tsx lines 10974-11190
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Columns, MessageSquare } from '@phosphor-icons/react';

interface SplitColumnsConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const SplitColumnsConfigPanel: React.FC<SplitColumnsConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  // Initialize columns from parent node data
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let parentOutputData: any[] = [];
  if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
    parentOutputData = parentConnection?.outputType === 'B' ? parentNode.outputData.outputB || [] : parentNode.outputData.outputA || [];
  } else {
    parentOutputData = parentNode?.outputData || parentNode?.data || [];
  }
  const allColumns: string[] = [];
  if (Array.isArray(parentOutputData) && parentOutputData.length > 0 && typeof parentOutputData[0] === 'object') {
    Object.keys(parentOutputData[0]).forEach(key => { if (!allColumns.includes(key)) allColumns.push(key); });
  }

  const existingA = node?.config?.columnsOutputA || [];
  const existingB = node?.config?.columnsOutputB || [];
  const [splitColumnsOutputA, setSplitColumnsOutputA] = useState<string[]>(
    existingA.length > 0 ? existingA.filter((c: string) => allColumns.includes(c)) : allColumns
  );
  const [splitColumnsOutputB, setSplitColumnsOutputB] = useState<string[]>(
    existingB.filter((c: string) => allColumns.includes(c))
  );
  const [splitColumnsAvailable, setSplitColumnsAvailable] = useState<string[]>(
    existingA.length > 0 ? allColumns.filter(c => !existingA.includes(c) && !existingB.includes(c)) : []
  );
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const handleSave = () => {
    onSave(nodeId, { columnsOutputA: splitColumnsOutputA, columnsOutputB: splitColumnsOutputB });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// RenameColumns Panel
files['RenameColumnsConfigPanel.tsx'] = `/**
 * RenameColumnsConfigPanel  
 * Extracted from Workflows.tsx lines 9396-9570
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Swap, Plus, Trash, MessageSquare } from '@phosphor-icons/react';

interface RenameColumnsConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const RenameColumnsConfigPanel: React.FC<RenameColumnsConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [columnRenames, setColumnRenames] = useState<{ oldName: string; newName: string }[]>(
    node?.config?.columnRenames || [{ oldName: '', newName: '' }]
  );

  // Get available columns from parent
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let parentOutputData: any[] = [];
  if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
    parentOutputData = parentConnection?.outputType === 'B' ? parentNode.outputData.outputB || [] : parentNode.outputData.outputA || [];
  } else {
    parentOutputData = parentNode?.outputData || parentNode?.data || [];
  }
  const availableColumns = Array.isArray(parentOutputData) && parentOutputData.length > 0 && typeof parentOutputData[0] === 'object'
    ? Object.keys(parentOutputData[0]) : [];

  const handleSave = () => {
    const filtered = columnRenames.filter(r => r.oldName.trim() && r.newName.trim());
    if (filtered.length === 0) return;
    onSave(nodeId, { columnRenames: filtered });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// Visualization Panel
files['VisualizationConfigPanel.tsx'] = `/**
 * VisualizationConfigPanel
 * Extracted from Workflows.tsx lines 9573-9739
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChartBar, Sparkle, MessageSquare } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface VisualizationConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  token: string;
}

export const VisualizationConfigPanel: React.FC<VisualizationConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup, token
}) => {
  const [visualizationPrompt, setVisualizationPrompt] = useState(node?.config?.visualizationPrompt || '');
  const [generatedWidget, setGeneratedWidget] = useState<any>(node?.config?.generatedWidget || null);
  const [isGeneratingWidget, setIsGeneratingWidget] = useState(false);
  const [showWidgetExplanation, setShowWidgetExplanation] = useState(false);

  const handleSave = () => {
    onSave(nodeId, { visualizationPrompt, generatedWidget });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// Climatiq Panel
files['ClimatiqConfigPanel.tsx'] = `/**
 * ClimatiqConfigPanel
 * Extracted from Workflows.tsx lines 9812-9939
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Leaf, MagnifyingGlass, MessageSquare } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface ClimatiqConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  token: string;
}

export const ClimatiqConfigPanel: React.FC<ClimatiqConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup, token
}) => {
  const [climatiqQuery, setClimatiqQuery] = useState(node?.config?.climatiqQuery || 'Passenger Car');
  const [climatiqSearchResults, setClimatiqSearchResults] = useState<any[]>([]);
  const [climatiqSelectedIndex, setClimatiqSelectedIndex] = useState<number | null>(null);
  const [climatiqSearching, setClimatiqSearching] = useState(false);

  const handleSave = () => {
    const selectedFactor = climatiqSelectedIndex !== null ? climatiqSearchResults[climatiqSelectedIndex] : null;
    onSave(nodeId, {
      climatiqQuery,
      climatiqSelectedFactor: selectedFactor,
      climatiqEmissionFactor: selectedFactor?.id || null,
    });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// HumanApproval Panel
files['HumanApprovalConfigPanel.tsx'] = `/**
 * HumanApprovalConfigPanel
 * Extracted from Workflows.tsx lines 9942-10008
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { HandPalm, User, MessageSquare } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface HumanApprovalConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  token: string;
  organizationId: string;
}

export const HumanApprovalConfigPanel: React.FC<HumanApprovalConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup, token, organizationId
}) => {
  const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
  const [selectedApproverUserId, setSelectedApproverUserId] = useState(node?.config?.approverUserId || '');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch(\`\${API_BASE}/api/organizations/\${organizationId}/members\`, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizationUsers(data.members || []);
        }
      } catch (err) { console.error('Failed to load users:', err); }
      finally { setIsLoadingUsers(false); }
    };
    loadUsers();
  }, [organizationId, token]);

  const handleSave = () => {
    const approver = organizationUsers.find(u => u.userId === selectedApproverUserId);
    onSave(nodeId, {
      approverUserId: selectedApproverUserId,
      approverName: approver ? (approver.name || approver.email) : 'Unknown',
    });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// Excel Panel
files['ExcelConfigPanel.tsx'] = `/**
 * ExcelConfigPanel
 * Extracted from Workflows.tsx lines 11193-11303
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Table, CloudArrowUp, MessageSquare } from '@phosphor-icons/react';

interface ExcelConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  handleExcelFileChange: (file: File) => void;
  excelFile: File | null;
  excelPreviewData: any;
  isParsingExcel: boolean;
}

export const ExcelConfigPanel: React.FC<ExcelConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup,
  handleExcelFileChange, excelFile, excelPreviewData, isParsingExcel
}) => {
  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// PDF Panel
files['PdfConfigPanel.tsx'] = `/**
 * PdfConfigPanel
 * Extracted from Workflows.tsx lines 11306-11402
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { FileText, CloudArrowUp, MessageSquare } from '@phosphor-icons/react';

interface PdfConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  handlePdfFileChange: (file: File) => void;
  pdfFile: File | null;
  pdfPreviewData: any;
  isParsingPdf: boolean;
}

export const PdfConfigPanel: React.FC<PdfConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup,
  handlePdfFileChange, pdfFile, pdfPreviewData, isParsingPdf
}) => {
  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// SaveRecords Panel
files['SaveRecordsConfigPanel.tsx'] = `/**
 * SaveRecordsConfigPanel
 * Extracted from Workflows.tsx lines 11405-11544
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { FloppyDisk, Plus, MessageSquare } from '@phosphor-icons/react';

interface SaveRecordsConfigPanelProps {
  nodeId: string;
  node: any;
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  token: string;
  organizationId: string;
}

export const SaveRecordsConfigPanel: React.FC<SaveRecordsConfigPanelProps> = ({
  nodeId, node, entities, onSave, onClose, openFeedbackPopup, token, organizationId
}) => {
  const [saveEntityId, setSaveEntityId] = useState(node?.config?.entityId || '');
  const [isCreatingNewEntity, setIsCreatingNewEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [localCreatedEntities, setLocalCreatedEntities] = useState<Array<{ id: string; name: string }>>([]);

  const allEntities = [...entities, ...localCreatedEntities];

  const handleSave = () => {
    const entity = allEntities.find(e => e.id === saveEntityId);
    onSave(nodeId, {
      entityId: saveEntityId,
      targetEntityName: entity?.name || '',
    }, entity ? \`Save to: \${entity.name}\` : 'Save Records');
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// LLM Panel
files['LLMConfigPanel.tsx'] = `/**
 * LLMConfigPanel
 * Extracted from Workflows.tsx lines 11548-11681
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Robot, MessageSquare } from '@phosphor-icons/react';

interface LLMConfigPanelProps {
  nodeId: string;
  node: any;
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const LLMConfigPanel: React.FC<LLMConfigPanelProps> = ({
  nodeId, node, entities, onSave, onClose, openFeedbackPopup
}) => {
  const [llmPrompt, setLlmPrompt] = useState(node?.config?.llmPrompt || '');
  const [llmContextEntities, setLlmContextEntities] = useState<string[]>(node?.config?.llmContextEntities || []);
  const [llmIncludeInput, setLlmIncludeInput] = useState(node?.config?.llmIncludeInput !== false);
  const [llmProcessingMode, setLlmProcessingMode] = useState<'batch' | 'perRow'>(node?.config?.llmProcessingMode || 'batch');

  const handleSave = () => {
    onSave(nodeId, { llmPrompt, llmContextEntities, llmIncludeInput, llmProcessingMode });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// Python Panel
files['PythonConfigPanel.tsx'] = `/**
 * PythonConfigPanel
 * Extracted from Workflows.tsx lines 11684-11805
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Code, Sparkle, MessageSquare } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface PythonConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  token: string;
}

export const PythonConfigPanel: React.FC<PythonConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup, token
}) => {
  const [pythonCode, setPythonCode] = useState(node?.config?.pythonCode || 'def process(data):\\n    # Modify data here\\n    return data');
  const [pythonAiPrompt, setPythonAiPrompt] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isDebuggingPython, setIsDebuggingPython] = useState(false);
  const [debugSuggestion, setDebugSuggestion] = useState<string | null>(null);

  const handleSave = () => {
    onSave(nodeId, { pythonCode });
  };

  return null; // PLACEHOLDER - needs JSX from raw extract
};
`;

// Schedule Panel (modal style, not NodeConfigSidePanel)
files['ScheduleConfigPanel.tsx'] = `/**
 * ScheduleConfigPanel
 * Extracted from Workflows.tsx lines 13044-13093
 */

import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

interface ScheduleConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
}

export const ScheduleConfigPanel: React.FC<ScheduleConfigPanelProps> = ({
  nodeId, node, onSave, onClose
}) => {
  const [scheduleIntervalValue, setScheduleIntervalValue] = useState(node?.config?.scheduleInterval?.toString() || '5');
  const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<'minutes' | 'hours' | 'days'>(node?.config?.scheduleUnit || 'minutes');
  const [scheduleEnabled, setScheduleEnabled] = useState(node?.config?.scheduleEnabled !== false);

  const handleSave = () => {
    onSave(nodeId, {
      scheduleInterval: parseInt(scheduleIntervalValue) || 5,
      scheduleUnit: scheduleIntervalUnit,
      scheduleEnabled,
    }, \`Schedule: \${scheduleIntervalValue} \${scheduleIntervalUnit}\`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl p-6 w-[400px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-[var(--text-primary)]">Schedule Workflow</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors">
            <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Run workflow every</label>
            <div className="flex gap-2">
              <input type="number" min={1} max={999} value={scheduleIntervalValue}
                onChange={(e) => setScheduleIntervalValue(e.target.value)}
                className="w-20 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65]" />
              <select value={scheduleIntervalUnit}
                onChange={(e) => setScheduleIntervalUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65]">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} className="rounded border-[var(--border-light)]" />
            <span className="text-sm text-[var(--text-primary)]">Schedule is active</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium">Save</button>
            <button onClick={onClose} className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};
`;

// ============================================================================
// WRITE ALL FILES
// ============================================================================

let count = 0;
for (const [fileName, content] of Object.entries(files)) {
  const filePath = path.join(PANELS_DIR, fileName);
  fs.writeFileSync(filePath, content);
  count++;
  console.log(`  Generated: ${fileName} (${content.split('\n').length} lines)`);
}

// Update index.ts with ALL panels
const allPanelNames = [
  'HttpConfigPanel', 'WebhookConfigPanel', 'WebhookResponseConfigPanel',
  'MySQLConfigPanel', 'SAPConfigPanel', 'OsiPiConfigPanel',
  'FranmitConfigPanel', 'ConveyorConfigPanel', 'LIMSConfigPanel',
  'StatisticalConfigPanel', 'AlertAgentConfigPanel', 'PdfReportConfigPanel',
  'EsiosConfigPanel', 'AddFieldConfigPanel', 'ManualInputConfigPanel',
  'EmailConfigPanel', 'SMSConfigPanel', 'WhatsAppConfigPanel',
  'ConditionConfigPanel', 'JoinConfigPanel', 'SplitColumnsConfigPanel',
  'RenameColumnsConfigPanel', 'VisualizationConfigPanel', 'ClimatiqConfigPanel',
  'HumanApprovalConfigPanel', 'ExcelConfigPanel', 'PdfConfigPanel',
  'SaveRecordsConfigPanel', 'LLMConfigPanel', 'PythonConfigPanel',
  'ScheduleConfigPanel', 'WebhookConfigPanel',
];

// Remove duplicates
const uniquePanels = [...new Set(allPanelNames)];

const indexContent = `/**
 * Config Panel Components
 * Extracted from Workflows.tsx - each panel self-manages its own state
 */

${uniquePanels.map(p => `export { ${p} } from './${p}';`).join('\n')}
`;

fs.writeFileSync(path.join(PANELS_DIR, 'index.ts'), indexContent);

console.log(`\\n=== SUMMARY ===`);
console.log(`Generated: ${count} complex panel files`);
console.log(`Updated: panels/index.ts with ${uniquePanels.length} exports`);
console.log(`\\nNOTE: Panels marked with "PLACEHOLDER" need their JSX copied from raw extracts.`);
console.log(`Panels with full JSX: WebhookResponseConfigPanel, ScheduleConfigPanel`);

