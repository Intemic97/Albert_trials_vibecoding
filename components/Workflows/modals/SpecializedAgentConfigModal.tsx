/**
 * Specialized Agent Node Configuration Modal
 * Allows selecting an agent from the library and configuring task, memory, and context.
 */

import React, { useState, useEffect } from 'react';
import { Brain, Robot, BookOpen, Lightning } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { API_BASE } from '../../../config';

interface Agent {
  id: string;
  name: string;
  description?: string;
  icon: string;
  instructions?: string;
}

interface SpecializedAgentConfigModalProps {
  isOpen: boolean;
  config: {
    agentId?: string;
    task?: string;
    includeInput?: boolean;
    memoryEnabled?: boolean;
    maxMemoryMessages?: number;
    model?: string;
    language?: 'auto' | 'es' | 'en';
    contextEntities?: string[];
  };
  entities: { id: string; name: string; type: string }[];
  onSave: (config: any) => void;
  onClose: () => void;
}

export const SpecializedAgentConfigModal: React.FC<SpecializedAgentConfigModalProps> = ({
  isOpen,
  config,
  entities,
  onSave,
  onClose,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState(config.agentId || '');
  const [task, setTask] = useState(config.task || '');
  const [includeInput, setIncludeInput] = useState(config.includeInput !== false);
  const [memoryEnabled, setMemoryEnabled] = useState(config.memoryEnabled !== false);
  const [maxMemoryMessages, setMaxMemoryMessages] = useState(config.maxMemoryMessages || 10);
  const [model, setModel] = useState(config.model || 'gpt-4o-mini');
  const [language, setLanguage] = useState(config.language || 'auto');
  const [contextEntities, setContextEntities] = useState<string[]>(config.contextEntities || []);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
    }
  }, [isOpen]);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/copilot/agents`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntity = (entityId: string) => {
    setContextEntities(prev =>
      prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]
    );
  };

  const selectedAgent = agents.find(a => a.id === agentId);
  const canSave = agentId && task.trim();

  if (!isOpen) return null;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Specialized Agent"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ agentId, task, includeInput, memoryEnabled, maxMemoryMessages, model, language, contextEntities })}
            disabled={!canSave}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Agent selector */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2">
            <Brain size={16} weight="duotone" />
            Agent <span className="text-red-400">*</span>
          </label>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            Select which agent from your library will handle this task
          </p>
          {loading ? (
            <div className="text-xs text-[var(--text-tertiary)] py-4 text-center">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="text-xs text-[var(--text-tertiary)] py-4 text-center border border-dashed border-[var(--border-light)] rounded-lg">
              No agents found. Create one in Copilots first.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setAgentId(agent.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    agentId === agent.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Robot size={16} weight="duotone" className={agentId === agent.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${agentId === agent.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                        {agent.name}
                      </p>
                      {agent.description && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{agent.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected agent preview */}
        {selectedAgent?.instructions && (
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Agent instructions</p>
            <p className="text-xs text-[var(--text-tertiary)] line-clamp-3">{selectedAgent.instructions}</p>
          </div>
        )}

        {/* Task / Prompt */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Task <span className="text-red-400">*</span>
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe the specific task for this agent to perform..."
            rows={4}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Use <code className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)] font-mono">{'{{input}}'}</code> to reference the workflow input data
          </p>
        </div>

        {/* Include Input Data */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInput}
              onChange={(e) => setIncludeInput(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Include input data</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Automatically include the workflow input as additional context
              </p>
            </div>
          </label>
        </div>

        {/* Memory */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={memoryEnabled}
              onChange={(e) => setMemoryEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Enable memory</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Agent retains context from previous workflow executions
              </p>
            </div>
          </label>
          {memoryEnabled && (
            <div className="pl-7">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Max messages to remember
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxMemoryMessages}
                onChange={(e) => setMaxMemoryMessages(Number(e.target.value))}
                className="w-24 px-2.5 py-1.5 border border-[var(--border-light)] rounded-lg text-sm bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          )}
        </div>

        {/* Model selection */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2">
            <Lightning size={16} weight="duotone" />
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (fast)</option>
            <option value="gpt-4o">GPT-4o (balanced)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo (powerful)</option>
          </select>
        </div>

        {/* Response language */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Response language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'auto' | 'es' | 'en')}
            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          >
            <option value="auto">Auto</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Knowledge Base Context */}
        {entities.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2">
              <BookOpen size={16} weight="light" />
              Knowledge Base Context
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              Select entities to provide additional context to the agent
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {entities.map(entity => (
                <label
                  key={entity.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    contextEntities.includes(entity.id)
                      ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contextEntities.includes(entity.id)}
                    onChange={() => toggleEntity(entity.id)}
                    className="w-4 h-4 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{entity.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
