/**
 * SMSConfigPanel
 * Extracted from Workflows.tsx lines 9086-9238
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { CaretDown, DeviceMobile, Eye, EyeSlash, ChatText, Phone } from '@phosphor-icons/react';
import { PromptInput } from '../../PromptInput';

interface SMSConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const SMSConfigPanel: React.FC<SMSConfigPanelProps> = ({
  nodeId, node, nodes, connections, entities, onSave, onClose, openFeedbackPopup
}) => {
  // Local state initialized from node config
  const [smsTo, setSmsTo] = useState(node?.config?.smsTo || '');
  const [smsBody, setSmsBody] = useState(node?.config?.smsBody || '');
  const [twilioAccountSid, setTwilioAccountSid] = useState(node?.config?.twilioAccountSid || '');
  const [twilioAuthToken, setTwilioAuthToken] = useState(node?.config?.twilioAuthToken || '');
  const [twilioFromNumber, setTwilioFromNumber] = useState(node?.config?.twilioFromNumber || '');
  const [showSMSTwilioSettings, setShowSMSTwilioSettings] = useState(false);

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
    onSave(nodeId, { smsTo: smsTo, smsBody: smsBody, twilioAccountSid: twilioAccountSid, twilioAuthToken: twilioAuthToken, twilioFromNumber: twilioFromNumber }, `SMS to: ...${smsTo.slice(-4)}`);
  };

  // Note: Full JSX is extracted from Workflows.tsx and may reference variables above
  // For @ mentions in body fields, use availableColumns
  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Send SMS"
        icon={DeviceMobile}
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
                    disabled={!smsTo.trim()}
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
                        To (phone number with country code)
                    </label>
                    <div className="h-16">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => {}}
                            isGenerating={false}
                            initialValue={smsTo}
                            placeholder="+34612345678 — Use @ to mention Input Data"
                            hideButton={true}
                            onChange={(val) => setSmsTo(val)}
                            className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                            inputData={inputData}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Message Body
                    </label>
                    <div className="h-32">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => {}}
                            isGenerating={false}
                            initialValue={smsBody}
                            placeholder="Write your SMS message here...&#10;&#10;Use @ to mention Input Data or entities."
                            hideButton={true}
                            onChange={(val) => setSmsBody(val)}
                            className="h-full"
                            inputData={inputData}
                        />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        SMS messages are limited to 160 characters (or 70 with special characters)
                    </p>
                </div>

                {/* Twilio Settings (collapsible) */}
                <div className="border border-[var(--border-light)] rounded-lg">
                    <button
                        type="button"
                        onClick={() => setShowSMSTwilioSettings(!showSMSTwilioSettings)}
                        className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                        <span>⚙️ Twilio Settings</span>
                        <span>{showSMSTwilioSettings ? '▲' : '▼'}</span>
                    </button>

                    {showSMSTwilioSettings && (
                        <div className="p-4 border-t border-[var(--border-light)] space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    Account SID
                                </label>
                                <input
                                    type="text"
                                    value={twilioAccountSid}
                                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    Auth Token
                                </label>
                                <input
                                    type="password"
                                    value={twilioAuthToken}
                                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    From Number (Twilio phone number)
                                </label>
                                <input
                                    type="text"
                                    value={twilioFromNumber}
                                    onChange={(e) => setTwilioFromNumber(e.target.value)}
                                    placeholder="+1234567890"
                                    className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                />
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                    Get your credentials from twilio.com/console
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('sendSMS', 'Send SMS')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} weight="light" />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>
  );
};
