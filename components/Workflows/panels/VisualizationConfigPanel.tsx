/**
 * VisualizationConfigPanel
 * Extracted from Workflows.tsx lines 9573-9739
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ChartBar, Sparkle, ChatText } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';
import { DynamicChart } from '../../DynamicChart';

interface VisualizationConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const VisualizationConfigPanel: React.FC<VisualizationConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [visualizationPrompt, setVisualizationPrompt] = useState(node?.config?.visualizationPrompt || '');
  const [generatedWidget, setGeneratedWidget] = useState<any>(node?.config?.generatedWidget || null);
  const [isGeneratingWidget, setIsGeneratingWidget] = useState(false);
  const [showWidgetExplanation, setShowWidgetExplanation] = useState(false);

  // Get input data from parent node
  const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
  const parentNode = parentConnection ? nodes.find((n: any) => n.id === parentConnection.fromNodeId) : null;
  let inputDataForViz: any[] = [];
  if (parentNode) {
    if (parentNode.type === 'splitColumns' && parentNode.outputData) {
      inputDataForViz = parentConnection.outputType === 'B'
        ? parentNode.outputData.outputB || []
        : parentNode.outputData.outputA || [];
    } else {
      inputDataForViz = parentNode.outputData || parentNode.config?.parsedData || [];
    }
  }
  const hasInputData = Array.isArray(inputDataForViz) && inputDataForViz.length > 0;
  const dataFields = hasInputData && typeof inputDataForViz[0] === 'object'
    ? Object.keys(inputDataForViz[0]) : [];

  const handleSave = () => {
    onSave(nodeId, { visualizationPrompt, generatedWidget });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => { onClose(); setGeneratedWidget(null); }}
        title="Data Visualization"
        icon={ChartBar}
        width="w-[700px]"
        footer={
            <>
                <button
                    onClick={() => { onClose(); setGeneratedWidget(null); }}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!generatedWidget}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save Visualization
                </button>
            </>
        }
    >
            {/* Data Preview */}
            {hasInputData && (
                <div className="mb-4 border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="bg-[var(--bg-tertiary)] px-3 py-2 border-b border-[var(--border-light)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                            📊 Available Data ({inputDataForViz.length} rows, {dataFields.length} columns)
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">Preview</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[var(--bg-tertiary)]">
                                <tr>
                                    {dataFields.map((field, idx) => (
                                        <th key={idx} className="px-3 py-2 text-left font-normal text-[var(--text-primary)] whitespace-nowrap border-b border-[var(--border-light)]">
                                            {field}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {inputDataForViz.slice(0, 4).map((row: any, rowIdx: number) => (
                                    <tr key={rowIdx} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]">
                                        {dataFields.map((field, colIdx) => (
                                            <td key={colIdx} className="px-3 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                                {row[field] !== undefined && row[field] !== null ? String(row[field]) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {inputDataForViz.length > 4 && (
                        <div className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] text-center border-t border-[var(--border-light)]">
                            ... and {inputDataForViz.length - 4} more rows
                        </div>
                    )}
                </div>
            )}

            {/* Prompt Input with Generate Button */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                        Describe the visualization you want
                    </label>
                    <button
                        onClick={generateWidgetFromPrompt}
                        disabled={!visualizationPrompt.trim() || !hasInputData || isGeneratingWidget}
                        className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                    >
                        {isGeneratingWidget ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkle size={14} weight="light" />
                                Generate
                            </>
                        )}
                    </button>
                </div>
                <textarea
                    value={visualizationPrompt}
                    onChange={(e) => setVisualizationPrompt(e.target.value)}
                    placeholder="e.g., 'Show a bar chart of sales by month' or 'Create a pie chart showing the distribution of categories'"
                    className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)]"
                    rows={3}
                />
                {!hasInputData && (
                    <p className="text-xs text-amber-600 mt-1">
                        ⚠️ No input data available. Run the workflow first.
                    </p>
                )}
            </div>

            {/* Generated Widget Preview */}
            {generatedWidget && (
                <div className="mb-4 border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="bg-[var(--bg-tertiary)] px-4 py-2 border-b border-[var(--border-light)]">
                        <h4 className="font-medium text-xs text-[var(--text-primary)]">{generatedWidget.title}</h4>
                        <p className="text-xs text-[var(--text-secondary)]">{generatedWidget.description}</p>
                    </div>
                    <div className="p-4 bg-[var(--bg-card)]">
                        <DynamicChart config={generatedWidget} />
                    </div>

                    {/* Explanation Toggle */}
                    {generatedWidget.explanation && (
                        <div className="border-t border-[var(--border-light)]">
                            <button
                                onClick={() => setShowWidgetExplanation(!showWidgetExplanation)}
                                className="w-full px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                            >
                                <span>How was this created?</span>
                                <span>{showWidgetExplanation ? '▲' : '▼'}</span>
                            </button>
                            {showWidgetExplanation && (
                                <div className="px-4 pb-4 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                                    {generatedWidget.explanation}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('dataVisualization', 'Data Visualization')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} weight="light" />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>
  );
};
