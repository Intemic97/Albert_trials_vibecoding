/**
 * EmailConfigPanel
 * Extracted from Workflows.tsx lines 8901-9083
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { CaretDown, EnvelopeSimple, Eye, EyeSlash, ChatText } from '@phosphor-icons/react';
import { PromptInput } from '../../PromptInput';

interface EmailConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const EmailConfigPanel: React.FC<EmailConfigPanelProps> = ({
  nodeId, node, nodes, connections, entities, onSave, onClose, openFeedbackPopup
}) => {
  // Local state initialized from node config
  const [emailTo, setEmailTo] = useState(node?.config?.emailTo || '');
  const [emailSubject, setEmailSubject] = useState(node?.config?.emailSubject || '');
  const [emailBody, setEmailBody] = useState(node?.config?.emailBody || '');
  const [emailSmtpHost, setEmailSmtpHost] = useState(node?.config?.emailSmtpHost || 'smtp.gmail.com');
  const [emailSmtpPort, setEmailSmtpPort] = useState(node?.config?.emailSmtpPort || '587');
  const [emailSmtpUser, setEmailSmtpUser] = useState(node?.config?.emailSmtpUser || '');
  const [emailSmtpPass, setEmailSmtpPass] = useState(node?.config?.emailSmtpPass || '');
  const [showEmailSmtpSettings, setShowEmailSmtpSettings] = useState(false);

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
    onSave(nodeId, { emailTo: emailTo, emailSubject: emailSubject, emailBody: emailBody, emailSmtpHost: emailSmtpHost || undefined, emailSmtpPort: emailSmtpPort || undefined, emailSmtpUser: emailSmtpUser || undefined, emailSmtpPass: emailSmtpPass || undefined }, `Email to: ${emailTo.split('@')[0]}...`);
  };

  // Note: Full JSX is extracted from Workflows.tsx and may reference variables above
  // For @ mentions in body fields, use availableColumns
  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Send Email"
        icon={EnvelopeSimple}
        width="w-[550px]"
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
                    disabled={!emailTo.trim()}
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
                        To (recipient email)
                    </label>
                    <div className="h-16">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => {}}
                            isGenerating={false}
                            initialValue={emailTo}
                            placeholder="recipient@example.com — Use @ to mention Input Data or entities"
                            hideButton={true}
                            onChange={(val) => setEmailTo(val)}
                            className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                            inputData={inputDataForEmail}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Subject
                    </label>
                    <div className="h-16">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => {}}
                            isGenerating={false}
                            initialValue={emailSubject}
                            placeholder="Email subject — Use @ to mention data"
                            hideButton={true}
                            onChange={(val) => setEmailSubject(val)}
                            className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                            inputData={inputDataForEmail}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Body
                    </label>
                    <div className="h-48">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => {}}
                            isGenerating={false}
                            initialValue={emailBody}
                            placeholder="Write your email body here...&#10;&#10;Use @ to mention Input Data or entities."
                            hideButton={true}
                            onChange={(val) => setEmailBody(val)}
                            className="h-full"
                            inputData={inputDataForEmail}
                        />
                    </div>
                </div>

                {/* SMTP Settings (collapsible) */}
                <div className="border border-[var(--border-light)] rounded-lg">
                    <button
                        type="button"
                        onClick={() => setShowEmailSmtpSettings(!showEmailSmtpSettings)}
                        className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                        <span>⚙️ SMTP Settings</span>
                        <span>{showEmailSmtpSettings ? '▲' : '▼'}</span>
                    </button>

                    {showEmailSmtpSettings && (
                        <div className="p-4 border-t border-[var(--border-light)] space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                        SMTP Host
                                    </label>
                                    <input
                                        type="text"
                                        value={emailSmtpHost}
                                        onChange={(e) => setEmailSmtpHost(e.target.value)}
                                        placeholder="smtp.gmail.com"
                                        className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                        SMTP Port
                                    </label>
                                    <input
                                        type="text"
                                        value={emailSmtpPort}
                                        onChange={(e) => setEmailSmtpPort(e.target.value)}
                                        placeholder="587"
                                        className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                    SMTP Username (email)
                                </label>
                                <input
                                    type="text"
                                    value={emailSmtpUser}
                                    onChange={(e) => setEmailSmtpUser(e.target.value)}
                                    placeholder="your-email@gmail.com"
                                    className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                    SMTP Password / App Password
                                </label>
                                <input
                                    type="password"
                                    value={emailSmtpPass}
                                    onChange={(e) => setEmailSmtpPass(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                />
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                    For Gmail, use an App Password (not your regular password)
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('sendEmail', 'Send Email')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} weight="light" />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>
  );
};
