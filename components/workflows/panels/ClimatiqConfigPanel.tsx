/**
 * ClimatiqConfigPanel
 * Extracted from Workflows.tsx lines 9812-9939
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Check, Leaf, MagnifyingGlass, Sparkle, ChatText } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';

interface ClimatiqConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const ClimatiqConfigPanel: React.FC<ClimatiqConfigPanelProps> = ({
  nodeId, node, onSave, onClose, openFeedbackPopup
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
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="🌱 Get Emission Factors"
        description="Search emission factors in the Climatiq database, to calculate your process and company emissions."
        icon={Leaf}
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
                    disabled={climatiqSelectedIndex === null}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Search
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={climatiqQuery}
                        onChange={(e) => setClimatiqQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchClimatiq()}
                        placeholder="e.g., Passenger diesel car"
                        className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <button
                        onClick={searchClimatiq}
                        disabled={climatiqSearching || !climatiqQuery.trim()}
                        className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                    >
                        {climatiqSearching ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Sparkle size={14} />
                                Search
                            </>
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                    Introduce your activity and click search
                </p>
            </div>

            {/* Results List */}
            {climatiqSearchResults.length > 0 && (
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Similar activities and its Emission factors
                    </label>
                    <div className="space-y-2">
                        {climatiqSearchResults.map((result, index) => (
                            <div
                                key={index}
                                onClick={() => setClimatiqSelectedIndex(index)}
                                className={`p-2.5 border rounded-lg cursor-pointer transition-all ${climatiqSelectedIndex === index
                                    ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]'
                                    : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${climatiqSelectedIndex === index
                                        ? 'border-slate-700 bg-slate-700'
                                        : 'border-[var(--border-medium)]'
                                        }`}>
                                        {climatiqSelectedIndex === index && (
                                            <Check size={10} className="text-white" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-xs text-[var(--text-primary)]">
                                            {result.factor} {result.unit}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                            {result.name} ({result.region_name || result.region})
                                        </p>
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                            Source: {result.source} • Year: {result.year}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No results message */}
            {!climatiqSearching && climatiqSearchResults.length === 0 && climatiqQuery && (
                <div className="p-3 border border-[var(--border-light)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)]">
                        Introduce your activity and click search
                    </p>
                </div>
            )}

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('climatiq', 'Climatiq Emissions')}
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
