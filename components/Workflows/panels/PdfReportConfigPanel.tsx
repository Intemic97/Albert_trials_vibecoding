/**
 * PdfReportConfigPanel
 * Extracted from Workflows.tsx lines 8830-8898
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { FilePdf, ChatText } from '@phosphor-icons/react';

interface PdfReportConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const PdfReportConfigPanel: React.FC<PdfReportConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [pdfTemplate, setPdfTemplate] = useState(node?.config?.pdfTemplate || 'standard');
  const [pdfReportData, setPdfReportData] = useState(node?.config?.pdfReportData || '{}');
  const [pdfOutputPath, setPdfOutputPath] = useState(node?.config?.pdfOutputPath || '');

  const handleSave = () => {
    onSave(nodeId, { pdfTemplate, pdfReportData, pdfOutputPath });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="PDF Report Generator"
        description="Generate structured PDF reports from data"
        icon={FilePdf}
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
                    disabled={!pdfTemplate.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Report Template</h4>
                <select
                    value={pdfTemplate}
                    onChange={(e) => setPdfTemplate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                >
                    <option value="standard">Standard Report</option>
                    <option value="goldenBatch">Golden Batch Analysis</option>
                    <option value="qc">Quality Control Report</option>
                    <option value="compliance">Compliance Report</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Report Data Structure (JSON)
                </label>
                <textarea
                    value={pdfReportData}
                    onChange={(e) => setPdfReportData(e.target.value)}
                    placeholder='{"title": "Batch Analysis", "sections": [...]}'
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                    rows={6}
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Optional: Customize report structure. Leave empty to use input data.</p>
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Output Path (Optional)
                </label>
                <input
                    type="text"
                    value={pdfOutputPath}
                    onChange={(e) => setPdfOutputPath(e.target.value)}
                    placeholder="/reports/batch_analysis.pdf"
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Leave empty for auto-generated path</p>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
