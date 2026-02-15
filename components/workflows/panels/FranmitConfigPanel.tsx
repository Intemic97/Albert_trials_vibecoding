/**
 * FranmitConfigPanel
 * Extracted from Workflows.tsx lines 8254-8363
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Eye, EyeSlash, Factory, Flask, ChatText } from '@phosphor-icons/react';

interface FranmitConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const FranmitConfigPanel: React.FC<FranmitConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [franmitApiSecretId, setFranmitApiSecretId] = useState(node?.config?.franmitApiSecretId || '');
  const [franmitReactorVolume, setFranmitReactorVolume] = useState(node?.config?.franmitReactorVolume || '');
  const [franmitReactionVolume, setFranmitReactionVolume] = useState(node?.config?.franmitReactionVolume || '');
  const [franmitCatalystScaleFactor, setFranmitCatalystScaleFactor] = useState(node?.config?.franmitCatalystScaleFactor || '');
  const [showFranmitApiSecret, setShowFranmitApiSecret] = useState(false);

  const handleSave = () => {
    onSave(nodeId, { franmitApiSecretId, franmitReactorVolume, franmitReactionVolume, franmitCatalystScaleFactor });
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Franmit Node"
        description="Franmit Node"
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
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            {/* API Credentials Secret ID */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    API Credentials Secret ID
                </label>
                <div className="relative">
                    <input
                        type={showFranmitApiSecret ? 'text' : 'password'}
                        value={franmitApiSecretId}
                        onChange={(e) => setFranmitApiSecretId(e.target.value)}
                        placeholder="Enter secret ID..."
                        className="w-full px-3 py-1.5 pr-10 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <button
                        type="button"
                        onClick={() => setShowFranmitApiSecret(!showFranmitApiSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        title={showFranmitApiSecret ? 'Hide' : 'Show'}
                    >
                        <Eye size={14} />
                    </button>
                </div>
            </div>

            {/* Parameters Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Parameters</h4>

                {/* Reactor Volume */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Reactor Volume (m³)
                    </label>
                    <input
                        type="text"
                        value={franmitReactorVolume}
                        onChange={(e) => setFranmitReactorVolume(e.target.value)}
                        placeholder="Reactor Volume"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Reaction Volume */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Reaction Volume (m³)
                    </label>
                    <input
                        type="text"
                        value={franmitReactionVolume}
                        onChange={(e) => setFranmitReactionVolume(e.target.value)}
                        placeholder="Reaction Volume"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Catalyst Scale Factor */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Catalyst Scale Factor
                    </label>
                    <input
                        type="text"
                        value={franmitCatalystScaleFactor}
                        onChange={(e) => setFranmitCatalystScaleFactor(e.target.value)}
                        placeholder="Catalyst Scale Factor"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('franmit', 'FranMIT')}
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
