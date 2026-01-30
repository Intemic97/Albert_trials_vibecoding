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
      icon={Code}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!pythonCode.trim()}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-[var(--border-light)]">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Code size={14} weight="light" className="inline mr-1.5" />
            Write Code
          </button>
          {onGenerateCode && (
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Sparkle size={14} weight="light" className="inline mr-1.5" />
              AI Generate
            </button>
          )}
        </div>

        {activeTab === 'code' ? (
          <>
            {/* Code Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  Python Code
                </label>
                <button
                  onClick={insertTemplate}
                  className="text-xs text-teal-600 hover:text-teal-700"
                >
                  Insert template
                </button>
              </div>
              <textarea
                value={pythonCode}
                onChange={(e) => onPythonCodeChange(e.target.value)}
                placeholder={DEFAULT_CODE}
                rows={15}
                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none"
                spellCheck={false}
              />
            </div>

            {/* Help */}
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
              <p className="text-xs font-medium text-[var(--text-primary)] mb-2">Available Variables</p>
              <ul className="text-xs text-[var(--text-tertiary)] space-y-1">
                <li><code className="text-[var(--text-secondary)]">input_data</code> - List of dictionaries from previous node</li>
                <li><code className="text-[var(--text-secondary)]">pd</code> - Pandas library</li>
                <li><code className="text-[var(--text-secondary)]">np</code> - NumPy library</li>
                <li><code className="text-[var(--text-secondary)]">json</code> - JSON library</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            {/* AI Prompt */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                Describe what you want the code to do
              </label>
              <textarea
                value={pythonAiPrompt}
                onChange={(e) => onPythonAiPromptChange(e.target.value)}
                placeholder="E.g., Filter rows where the 'status' column equals 'active' and calculate the sum of the 'amount' column"
                rows={5}
                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none"
              />
            </div>

            <button
              onClick={handleGenerateCode}
              disabled={!pythonAiPrompt.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <SpinnerGap size={16} weight="light" className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="light" />
                  Generate Code
                </>
              )}
            </button>

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
              <p className="text-xs text-[var(--text-secondary)]">
                <span className="font-medium">Tip:</span> Be specific about the input data structure
                and the expected output format for better results.
              </p>
            </div>
          </>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
