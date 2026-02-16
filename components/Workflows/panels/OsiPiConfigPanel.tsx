/**
 * OsiPiConfigPanel
 * Extracted from Workflows.tsx lines 8096-8251
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChartLine, Eye, EyeSlash, ChatText, Plus, Trash, WarningCircle } from '@phosphor-icons/react';

interface OsiPiConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const OsiPiConfigPanel: React.FC<OsiPiConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [osiPiHost, setOsiPiHost] = useState(node?.config?.osiPiHost || '');
  const [osiPiApiKey, setOsiPiApiKey] = useState(node?.config?.osiPiApiKey || '');
  const [osiPiGranularityValue, setOsiPiGranularityValue] = useState(node?.config?.osiPiGranularityValue || '5');
  const [osiPiGranularityUnit, setOsiPiGranularityUnit] = useState(node?.config?.osiPiGranularityUnit || 'seconds');
  const [osiPiWebIds, setOsiPiWebIds] = useState(node?.config?.osiPiWebIds || ['', '']);
  const [showOsiPiApiKey, setShowOsiPiApiKey] = useState(false);

  const handleSave = () => {
    onSave(nodeId, { osiPiHost, osiPiApiKey, osiPiGranularityValue, osiPiGranularityUnit, osiPiWebIds }, `OSI PI: ${osiPiHost || 'config'}`);
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="OSIsoft PI"
        description="AVEVA PI Connector"
        icon={ChartLine}
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
                    disabled={!osiPiHost.trim() || !osiPiApiKey.trim() || osiPiWebIds.filter(id => id.trim()).length === 0}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            {/* Host */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Host
                </label>
                <input
                    type="text"
                    value={osiPiHost}
                    onChange={(e) => setOsiPiHost(e.target.value)}
                    placeholder="https://myserver/piwebapi/"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
            </div>

            {/* API Key Secret */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    API Key Secret
                </label>
                <div className="relative">
                    <input
                        type={showOsiPiApiKey ? 'text' : 'password'}
                        value={osiPiApiKey}
                        onChange={(e) => setOsiPiApiKey(e.target.value)}
                        placeholder="########"
                        className="w-full px-3 py-1.5 pr-10 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <button
                        type="button"
                        onClick={() => setShowOsiPiApiKey(!showOsiPiApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        title={showOsiPiApiKey ? 'Hide' : 'Show'}
                    >
                        <Eye size={14} />
                    </button>
                </div>
            </div>

            {/* Data Collection Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Data collection</h4>

                {/* Granularity */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2 flex items-center gap-1">
                        Granularity
                        <span className="text-[var(--text-tertiary)] cursor-help" title="Polling interval for data collection from PI Web API">
                            <WarningCircle size={12} />
                        </span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="1"
                            value={osiPiGranularityValue}
                            onChange={(e) => setOsiPiGranularityValue(e.target.value)}
                            placeholder="Value"
                            className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                        <select
                            value={osiPiGranularityUnit}
                            onChange={(e) => setOsiPiGranularityUnit(e.target.value as 'seconds' | 'minutes' | 'hours' | 'days')}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] bg-[var(--bg-card)]"
                        >
                            <option value="seconds">seconds</option>
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Web IDs */}
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Web IDs</h4>
                <div className="space-y-2">
                    {osiPiWebIds.map((webId, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--text-tertiary)] w-8 flex-shrink-0">Id {index + 1}</span>
                            <input
                                type="text"
                                value={webId}
                                onChange={(e) => {
                                    const newWebIds = [...osiPiWebIds];
                                    newWebIds[index] = e.target.value;
                                    setOsiPiWebIds(newWebIds);
                                }}
                                placeholder="Web Id"
                                className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                            {osiPiWebIds.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newWebIds = osiPiWebIds.filter((_, i) => i !== index);
                                        setOsiPiWebIds(newWebIds);
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                    title="Remove"
                                >
                                    <Trash size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setOsiPiWebIds([...osiPiWebIds, ''])}
                    className="mt-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-colors"
                >
                    Add web id
                </button>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('osiPi', 'OSIsoft PI')}
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
