/**
 * LLM/AI Generation Node Configuration Modal
 * Allows configuring AI generation parameters
 */

import React from 'react';
import { Sparkle, BookOpen, FileText } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';

interface Entity {
  id: string;
  name: string;
  type: string;
}

interface LLMConfigModalProps {
  isOpen: boolean;
  llmPrompt: string;
  llmContextEntities: string[];
  llmIncludeInput: boolean;
  entities: Entity[];
  onLLMPromptChange: (value: string) => void;
  onLLMContextEntitiesChange: (value: string[]) => void;
  onLLMIncludeInputChange: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

export const LLMConfigModal: React.FC<LLMConfigModalProps> = ({
  isOpen,
  llmPrompt,
  llmContextEntities,
  llmIncludeInput,
  entities,
  onLLMPromptChange,
  onLLMContextEntitiesChange,
  onLLMIncludeInputChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const toggleEntity = (entityId: string) => {
    if (llmContextEntities.includes(entityId)) {
      onLLMContextEntitiesChange(llmContextEntities.filter(id => id !== entityId));
    } else {
      onLLMContextEntitiesChange([...llmContextEntities, entityId]);
    }
  };

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure AI Generation"
      icon={Sparkle}
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
            disabled={!llmPrompt.trim()}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Prompt */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
            Prompt *
          </label>
          <textarea
            value={llmPrompt}
            onChange={(e) => onLLMPromptChange(e.target.value)}
            placeholder="Describe what you want the AI to generate..."
            rows={5}
            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Use <code className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded">{'{{input}}'}</code> to reference the input data
          </p>
        </div>

        {/* Include Input Data */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={llmIncludeInput}
              onChange={(e) => onLLMIncludeInputChange(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-light)] text-teal-600 focus:ring-teal-500"
            />
            <div>
              <span className="text-xs font-medium text-[var(--text-primary)]">Include input data</span>
              <p className="text-xs text-[var(--text-tertiary)]">
                Automatically include the workflow input as context
              </p>
            </div>
          </label>
        </div>

        {/* Knowledge Base Context */}
        {entities.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
              <BookOpen size={14} weight="light" className="inline mr-1.5" />
              Knowledge Base Context
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              Select entities to provide additional context for the AI
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {entities.map(entity => (
                <label
                  key={entity.id}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                    llmContextEntities.includes(entity.id)
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={llmContextEntities.includes(entity.id)}
                    onChange={() => toggleEntity(entity.id)}
                    className="w-4 h-4 rounded border-[var(--border-light)] text-teal-600 focus:ring-teal-500"
                  />
                  <FileText size={14} weight="light" className="text-[var(--text-tertiary)]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
                      {entity.name}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">{entity.type}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {llmPrompt && (
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Configuration Summary</p>
            <ul className="text-xs text-[var(--text-tertiary)] space-y-1">
              <li>• Prompt: {llmPrompt.length} characters</li>
              <li>• Input data: {llmIncludeInput ? 'Included' : 'Not included'}</li>
              <li>• Context entities: {llmContextEntities.length} selected</li>
            </ul>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
