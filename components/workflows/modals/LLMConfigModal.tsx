/**
 * LLM/AI Generation Node Configuration Modal
 * Allows configuring AI generation parameters
 */

import React from 'react';
import { BookOpen, FileText } from '@phosphor-icons/react';
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
            disabled={!llmPrompt.trim()}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Prompt */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Prompt <span className="text-red-400">*</span>
          </label>
          <textarea
            value={llmPrompt}
            onChange={(e) => onLLMPromptChange(e.target.value)}
            placeholder="Describe what you want the AI to generate..."
            rows={5}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Use <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono">{'{{input}}'}</code> to reference the input data
          </p>
        </div>

        {/* Include Input Data */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={llmIncludeInput}
              onChange={(e) => onLLMIncludeInputChange(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Include input data</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Automatically include the workflow input as context
              </p>
            </div>
          </label>
        </div>

        {/* Knowledge Base Context */}
        {entities.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2">
              <BookOpen size={16} weight="light" />
              Knowledge Base Context
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              Select entities to provide additional context for the AI
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {entities.map(entity => (
                <label
                  key={entity.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    llmContextEntities.includes(entity.id)
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-light)] hover:border-[var(--border-medium)] bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={llmContextEntities.includes(entity.id)}
                    onChange={() => toggleEntity(entity.id)}
                    className="w-4 h-4 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <FileText size={16} weight="light" className="text-[var(--text-tertiary)]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
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
          <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Summary</p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                Prompt: {llmPrompt.length} characters
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                Input data: {llmIncludeInput ? 'Included' : 'Not included'}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                Context entities: {llmContextEntities.length} selected
              </li>
            </ul>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
