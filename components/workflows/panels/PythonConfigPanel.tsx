/**
 * PythonConfigPanel
 * Extracted from Workflows.tsx lines 11684-11805
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Bug, Check, Code, Sparkle, ChatText, X } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';
import { AIPromptSection } from '../../AIPromptSection';

interface PythonConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const PythonConfigPanel: React.FC<PythonConfigPanelProps> = ({
  nodeId, node, nodes, connections, onSave, onClose, openFeedbackPopup
}) => {
  const [pythonCode, setPythonCode] = useState(node?.config?.pythonCode || 'def process(data):\n    # Modify data here\n    return data');
  const [pythonAiPrompt, setPythonAiPrompt] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isDebuggingPython, setIsDebuggingPython] = useState(false);
  const [debugSuggestion, setDebugSuggestion] = useState<string | null>(null);

  const generatePythonCode = async () => {
    if (!pythonAiPrompt.trim()) return;

    setIsGeneratingCode(true);
    try {
      // Get input data schema from parent node
      let inputDataSchema: { columns: string[], sampleData?: any[] } | null = null;

      const parentConnection = connections.find((c: any) => c.toNodeId === nodeId);
      if (parentConnection) {
        const parentNode = nodes.find((n: any) => n.id === parentConnection.fromNodeId);
        if (parentNode) {
          // Try to get data from different sources
          let parentData = parentNode.outputData || parentNode.inputDataA || null;

          // Handle splitColumns parent node
          if (parentNode.type === 'splitColumns' && parentNode.outputData) {
            parentData = parentConnection.outputType === 'B'
              ? parentNode.outputData.outputB
              : parentNode.outputData.outputA;
          }

          // Handle manualInput node
          if (parentNode.type === 'manualInput' && parentNode.config) {
            const varName = parentNode.config.inputVarName || 'value';
            const varValue = parentNode.config.inputVarValue;
            parentData = [{ [varName]: varValue }];
          }

          if (parentData && Array.isArray(parentData) && parentData.length > 0) {
            const columns = Object.keys(parentData[0]);
            inputDataSchema = {
              columns,
              sampleData: parentData.slice(0, 3) // Send first 3 records as sample
            };
            console.log('Python AI - Input data schema:', inputDataSchema);
          }
        }
      }

      console.log('Python AI - Sending to API:', { prompt: pythonAiPrompt, inputDataSchema });
      const response = await fetch(`${API_BASE}/python/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: pythonAiPrompt,
          inputDataSchema
        }),
        credentials: 'include'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON:', text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      setPythonCode(data.code);
    } catch (error: any) {
      console.error('Error generating python code:', error);
      alert(`Failed to generate code: ${error.message}`);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleSave = () => {
    onSave(nodeId, { pythonCode });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure Python Code"
        icon={Code}
        width="w-[600px]"
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
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-5">
                {/* AI Debug Suggestion - shown when debugging */}
                {(isDebuggingPython || debugSuggestion) && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Bug size={16} className="text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">AI Debug Assistant</span>
                        </div>
                        {isDebuggingPython ? (
                            <div className="flex items-center gap-2 text-sm text-amber-700">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent" />
                                Analyzing error and generating fix...
                            </div>
                        ) : debugSuggestion ? (
                            <div className="space-y-3">
                                <p className="text-xs text-amber-700">
                                    AI has analyzed the error and suggests a fix. Review and apply if it looks correct.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setPythonCode(debugSuggestion);
                                            setDebugSuggestion(null);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700 transition-colors"
                                    >
                                        <Check size={14} />
                                        Apply Fix
                                    </button>
                                    <button
                                        onClick={() => setDebugSuggestion(null)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-50 transition-colors"
                                    >
                                        <X size={14} />
                                        Dismiss
                                    </button>
                                </div>
                                {/* Preview of the fix */}
                                <details className="mt-2">
                                    <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-800">
                                        Preview suggested code
                                    </summary>
                                    <pre className="mt-2 p-2 bg-slate-800 text-slate-100 text-xs rounded overflow-x-auto max-h-40">
                                        {debugSuggestion}
                                    </pre>
                                </details>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* AI Assistant Section */}
                <AIPromptSection
                    label="Ask AI to write code"
                    placeholder="e.g., Filter records where price > 100"
                    value={pythonAiPrompt}
                    onChange={setPythonAiPrompt}
                    onGenerate={generatePythonCode}
                    isGenerating={isGeneratingCode}
                    generatingText="Generating..."
                    icon={Sparkle}
                    buttonText="Generate"
                />

                {/* Code Editor */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Python Code
                    </label>
                    <div className="relative">
                        <textarea
                            value={pythonCode}
                            onChange={(e) => setPythonCode(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--bg-selected)] text-slate-50 font-mono text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-64 resize-none"
                            spellCheck={false}
                        />
                        <div className="absolute top-2 right-2 text-xs text-[var(--text-secondary)] bg-slate-800 px-2 py-1 rounded">
                            Python 3
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Function must be named <code>process(data)</code> and return a list.
                    </p>
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup?.('python', 'Python Code')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>

  );
};
