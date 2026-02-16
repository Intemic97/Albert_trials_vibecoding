/**
 * Python Code Node Configuration Modal
 * Allows writing custom Python code for data transformation
 */

import React, { useState } from 'react';
import { Code, Sparkle, SpinnerGap } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';

interface PythonConfigModalProps {
  isOpen: boolean;
  pythonCode: string;
  pythonAiPrompt: string;
  onPythonCodeChange: (value: string) => void;
  onPythonAiPromptChange: (value: string) => void;
  onGenerateCode?: (prompt: string) => Promise<string>;
  onSave: () => void;
  onClose: () => void;
}

const DEFAULT_CODE = `# Transform the input data
# Available variables:
#   - input_data: list of dictionaries from previous node
#   - pd: pandas library (if needed)
#
# Return the transformed data as a list of dictionaries

def transform(input_data):
    # Your code here
    result = input_data
    return result

# Execute transformation
output_data = transform(input_data)
`;

export const PythonConfigModal: React.FC<PythonConfigModalProps> = ({
  isOpen,
  pythonCode,
  pythonAiPrompt,
  onPythonCodeChange,
  onPythonAiPromptChange,
  onGenerateCode,
  onSave,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'ai'>('code');

  if (!isOpen) return null;

  const handleGenerateCode = async () => {
    if (!pythonAiPrompt.trim() || !onGenerateCode) return;
    
    setIsGenerating(true);
    try {
      const generatedCode = await onGenerateCode(pythonAiPrompt);
      onPythonCodeChange(generatedCode);
      setActiveTab('code');
    } catch (error) {
      console.error('Failed to generate code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const insertTemplate = () => {
    onPythonCodeChange(DEFAULT_CODE);
  };

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Python Code"
      width="lg"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!pythonCode.trim()}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'code'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Code size={16} weight="light" />
            Write Code
          </button>
          {onGenerateCode && (
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'ai'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Sparkle size={16} weight="light" />
              AI Generate
            </button>
          )}
        </div>

        {activeTab === 'code' ? (
          <>
            {/* Code Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Python Code
                </label>
                <button
                  onClick={insertTemplate}
                  className="text-xs text-[var(--accent-primary)] hover:underline"
                >
                  Insert template
                </button>
              </div>
              <textarea
                value={pythonCode}
                onChange={(e) => onPythonCodeChange(e.target.value)}
                placeholder={DEFAULT_CODE}
                rows={15}
                className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                spellCheck={false}
              />
            </div>

            {/* Help */}
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Available Variables</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono text-xs">input_data</code>
                  <span className="text-[var(--text-tertiary)] text-xs">Data from previous node</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono text-xs">pd</code>
                  <span className="text-[var(--text-tertiary)] text-xs">Pandas library</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono text-xs">np</code>
                  <span className="text-[var(--text-tertiary)] text-xs">NumPy library</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono text-xs">json</code>
                  <span className="text-[var(--text-tertiary)] text-xs">JSON library</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* AI Prompt */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                Describe what you want the code to do
              </label>
              <textarea
                value={pythonAiPrompt}
                onChange={(e) => onPythonAiPromptChange(e.target.value)}
                placeholder="E.g., Filter rows where the 'status' column equals 'active' and calculate the sum of the 'amount' column"
                rows={5}
                className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
              />
            </div>

            <button
              onClick={handleGenerateCode}
              disabled={!pythonAiPrompt.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <SpinnerGap size={18} weight="light" className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkle size={18} weight="light" />
                  Generate Code
                </>
              )}
            </button>

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">Tip:</span> Be specific about the input data structure
                and the expected output format for better results.
              </p>
            </div>
          </>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
