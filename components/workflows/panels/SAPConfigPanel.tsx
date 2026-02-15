/**
 * SAPConfigPanel
 * Extracted from Workflows.tsx lines 7939-8093
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Database, Eye, EyeSlash, ChatText } from '@phosphor-icons/react';

interface SAPConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const SAPConfigPanel: React.FC<SAPConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [sapConnectionName, setSapConnectionName] = useState(node?.config?.sapConnectionName || 'SAP_Production');
  const [sapAuthType, setSapAuthType] = useState(node?.config?.sapAuthType || 'OAuth2_Client_Credentials');
  const [sapClientId, setSapClientId] = useState(node?.config?.sapClientId || '');
  const [sapClientSecret, setSapClientSecret] = useState(node?.config?.sapClientSecret || '');
  const [sapTokenUrl, setSapTokenUrl] = useState(node?.config?.sapTokenUrl || '');
  const [sapBaseApiUrl, setSapBaseApiUrl] = useState(node?.config?.sapBaseApiUrl || '');
  const [sapServicePath, setSapServicePath] = useState(node?.config?.sapServicePath || '/sap/opu/odata/sap/');
  const [sapEntity, setSapEntity] = useState(node?.config?.sapEntity || '');

  const handleSave = () => {
    onSave(nodeId, { sapConnectionName, sapAuthType, sapClientId, sapClientSecret, sapTokenUrl, sapBaseApiUrl, sapServicePath, sapEntity }, `SAP: ${sapEntity || 'connection'}`);
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="SAP S/4HANA"
        description="Read data from SAP S/4HANA OData API"
        icon={Database}
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
                    disabled={!sapBaseApiUrl.trim() || !sapEntity.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-5">
                {/* Connection Settings */}
                <div className="border-b border-[var(--border-light)] pb-3">
                    <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Connection</h4>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Connection Name
                        </label>
                        <input
                            type="text"
                            value={sapConnectionName}
                            onChange={(e) => setSapConnectionName(e.target.value)}
                            placeholder="SAP_Production"
                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                </div>

                {/* Authentication */}
                <div className="border-b border-[var(--border-light)] pb-3">
                    <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Authentication</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Auth Type
                            </label>
                            <input
                                type="text"
                                value={sapAuthType}
                                onChange={(e) => setSapAuthType(e.target.value)}
                                placeholder="OAuth2_Client_Credentials"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Client ID
                            </label>
                            <input
                                type="text"
                                value={sapClientId}
                                onChange={(e) => setSapClientId(e.target.value)}
                                placeholder="sb-83f9a9..."
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Client Secret
                            </label>
                            <input
                                type="password"
                                value={sapClientSecret}
                                onChange={(e) => setSapClientSecret(e.target.value)}
                                placeholder="********"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Token URL
                            </label>
                            <input
                                type="text"
                                value={sapTokenUrl}
                                onChange={(e) => setSapTokenUrl(e.target.value)}
                                placeholder="https://company.authentication.eu10.hana.ondemand.com/oauth/token"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                    </div>
                </div>

                {/* API Configuration */}
                <div>
                    <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">API Configuration</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Base API URL
                            </label>
                            <input
                                type="text"
                                value={sapBaseApiUrl}
                                onChange={(e) => setSapBaseApiUrl(e.target.value)}
                                placeholder="https://company-api.s4hana.ondemand.com"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Service Path
                            </label>
                            <input
                                type="text"
                                value={sapServicePath}
                                onChange={(e) => setSapServicePath(e.target.value)}
                                placeholder="/sap/opu/odata/sap/API_PRODUCTION_ORDER_2_SRV"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                Entity
                            </label>
                            <input
                                type="text"
                                value={sapEntity}
                                onChange={(e) => setSapEntity(e.target.value)}
                                placeholder="A_ProductionOrder"
                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('sapFetch', 'SAP S/4HANA')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>
  );
};
