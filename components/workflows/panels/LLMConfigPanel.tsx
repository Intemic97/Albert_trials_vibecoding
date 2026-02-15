/**
 * LLMConfigPanel
 * Extracted from Workflows.tsx lines 11548-11681
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Robot, Sparkle, ChatText } from '@phosphor-icons/react';
import { PromptInput } from '../../PromptInput';

interface LLMConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const LLMConfigPanel: React.FC<LLMConfigPanelProps> = ({
  nodeId, node, nodes, connections, entities, onSave, onClose, openFeedbackPopup
}) => {
  const [llmPrompt, setLlmPrompt] = useState(node?.config?.llmPrompt || '');
  const [llmContextEntities, setLlmContextEntities] = useState<string[]>(node?.config?.llmContextEntities || []);
  const [llmIncludeInput, setLlmIncludeInput] = useState(node?.config?.llmIncludeInput !== false);
  const [llmProcessingMode, setLlmProcessingMode] = useState<'batch' | 'perRow'>(node?.config?.llmProcessingMode || 'batch');

  const handleSave = () => {
    onSave(nodeId, { llmPrompt, llmContextEntities, llmIncludeInput, llmProcessingMode });
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure AI Generation"
        icon={Sparkle}
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
                    disabled={!llmPrompt.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Prompt
                    </label>
                    <div className="h-48">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => { }} // Not used here
                            isGenerating={false}
                            initialValue={llmPrompt}
                            placeholder="Ask a question... Use @ to mention entities or Input Data."
                            hideButton={true}
                            onChange={(val, ids) => {
                                setLlmPrompt(val);
                                setLlmContextEntities(ids);
                                // Auto-enable include input if @Input Data is mentioned
                                if (val.includes('@Input Data')) {
                                    setLlmIncludeInput(true);
                                }
                            }}
                            className="h-full"
                            inputData={(() => {
                                // Get input data from parent node
                                const parentConnection = connections.find(c => c.toNodeId === nodeId);
                                if (parentConnection) {
                                    const parentNode = nodes.find(n => n.id === parentConnection.fromNodeId);
                                    // Handle splitColumns parent node
                                    if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
                                        return parentConnection.outputType === 'B'
                                            ? parentNode.outputData.outputB || []
                                            : parentNode.outputData.outputA || [];
                                    }
                                    return parentNode?.outputData || parentNode?.data || [];
                                }
                                return [];
                            })()}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <input
                        type="checkbox"
                        id="includeInput"
                        checked={llmIncludeInput}
                        onChange={(e) => setLlmIncludeInput(e.target.checked)}
                        className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="includeInput" className="text-sm text-[var(--text-primary)] cursor-pointer">
                        Include Input Data (from previous node)
                    </label>
                </div>

                {/* Processing Mode */}
                <div className="pt-3 border-t border-[var(--border-light)]">
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Processing Mode
                    </label>
                    <div className="space-y-2">
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'batch' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                            <input
                                type="radio"
                                name="llmProcessingMode"
                                value="batch"
                                checked={llmProcessingMode === 'batch'}
                                onChange={() => setLlmProcessingMode('batch')}
                                className="mt-0.5 mr-3"
                            />
                            <div>
                                <span className="font-medium text-sm">Batch (all rows)</span>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    Send all data in one AI call → single result
                                </p>
                            </div>
                        </label>
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'perRow' ? 'border-violet-500 bg-violet-50' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                            <input
                                type="radio"
                                name="llmProcessingMode"
                                value="perRow"
                                checked={llmProcessingMode === 'perRow'}
                                onChange={() => setLlmProcessingMode('perRow')}
                                className="mt-0.5 mr-3"
                            />
                            <div>
                                <span className="font-medium text-sm">Per Row</span>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    Call AI for each row → adds <code className="bg-[var(--bg-tertiary)] px-1 rounded">ai_result</code> field.
                                    Use <code className="bg-[var(--bg-tertiary)] px-1 rounded">{'{field}'}</code> in prompt for row values.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('llm', 'LLM / AI Generate')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>

  );
};
