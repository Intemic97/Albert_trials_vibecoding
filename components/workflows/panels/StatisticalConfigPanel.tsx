/**
 * StatisticalConfigPanel
 * Extracted from Workflows.tsx lines 8668-8737
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChartBar, TrendUp, ChatText } from '@phosphor-icons/react';

interface StatisticalConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const StatisticalConfigPanel: React.FC<StatisticalConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [statisticalMethod, setStatisticalMethod] = useState(node?.config?.statisticalMethod || 'goldenBatch');
  const [statisticalParams, setStatisticalParams] = useState(node?.config?.statisticalParams || '{}');
  const [goldenBatchId, setGoldenBatchId] = useState(node?.config?.goldenBatchId || '');

  const handleSave = () => {
    onSave(nodeId, { statisticalMethod, statisticalParams, goldenBatchId });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Statistical Analysis"
        description="Perform PCA, SPC, or compare with golden batch"
        icon={TrendUp}
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
                    disabled={!statisticalMethod}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Analysis Method</h4>
                <select
                    value={statisticalMethod}
                    onChange={(e) => setStatisticalMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                >
                    <option value="goldenBatch">Compare with Golden Batch</option>
                    <option value="pca">Principal Component Analysis (PCA)</option>
                    <option value="spc">Statistical Process Control (SPC)</option>
                    <option value="regression">Regression Analysis</option>
                </select>
            </div>
            {statisticalMethod === 'goldenBatch' && (
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Golden Batch ID
                    </label>
                    <input
                        type="text"
                        value={goldenBatchId}
                        onChange={(e) => setGoldenBatchId(e.target.value)}
                        placeholder="BATCH_REF_001"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
            )}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Parameters (JSON)
                </label>
                <textarea
                    value={statisticalParams}
                    onChange={(e) => setStatisticalParams(e.target.value)}
                    placeholder='{"n_components": 3, "tolerance": 0.05}'
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                    rows={4}
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Analysis-specific parameters in JSON format</p>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
