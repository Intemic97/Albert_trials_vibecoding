import React, { useState, useEffect } from 'react';
import { X, Robot, Database, Folder, FlowArrow, Wrench, Brain, Factory, Wine, CurrencyDollar, ChartBar, Gear, Flask, Truck, Lightning, ShieldCheck, TrendUp, Users, Scales, Target, Package, Globe, Lightbulb } from '@phosphor-icons/react';
import { API_BASE } from '../../config';
import { Entity } from '../../types';
import { useTranslation } from 'react-i18next';

interface KnowledgeFolder {
  id: string;
  name: string;
  color?: string;
}

interface Workflow {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  icon: string;
  instructions?: string;
  allowedEntities?: string[];
  folderIds?: string[];
  allowedWorkflowIds?: string[];
  toolsEnabled?: string[];
  memoryEnabled?: boolean;
  orchestratorPrompt?: string;
  analystPrompt?: string;
  specialistPrompt?: string;
  synthesisPrompt?: string;
}

interface AgentConfigModalProps {
  agent: Agent;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

const ICON_MAP: Record<string, any> = {
  Factory, Wine, CurrencyDollar, ChartBar, Gear, Flask, Truck, Lightning,
  ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe, Lightbulb, Robot
};

const getIconComponent = (iconName: string) => ICON_MAP[iconName] || Robot;

const TOOL_OPTIONS = [
  { id: 'create_entity', labelKey: 'agents.toolCreateEntity', descKey: 'agents.toolCreateEntityDesc', icon: Database },
  { id: 'create_workflow', labelKey: 'agents.toolCreateWorkflow', descKey: 'agents.toolCreateWorkflowDesc', icon: FlowArrow },
] as const;

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ agent, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [icon] = useState(agent.icon);
  const [instructions, setInstructions] = useState(agent.instructions || '');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(agent.allowedEntities || []);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(agent.folderIds || []);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>(agent.allowedWorkflowIds || []);
  const [toolsEnabled, setToolsEnabled] = useState<string[]>(agent.toolsEnabled || []);
  const [memoryEnabled, setMemoryEnabled] = useState(agent.memoryEnabled !== false);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entities`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/knowledge/folders`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/workflows`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ]).then(([ents, folds, wfs]) => {
      setEntities(ents);
      setFolders(folds);
      setWorkflows(wfs);
    });
  }, []);

  const toggleTool = (toolId: string) => {
    setToolsEnabled(prev =>
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleSave = async () => {
    const updated = {
      ...agent,
      name,
      description,
      instructions,
      allowedEntities: selectedEntities,
      folderIds: selectedFolders,
      allowedWorkflowIds: selectedWorkflows,
      toolsEnabled,
      memoryEnabled,
    };
    try {
      const res = await fetch(`${API_BASE}/copilot/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const saved = await res.json();
        onSave(saved);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const IconComponent = getIconComponent(icon);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center">
              <IconComponent size={24} className="text-white" weight="light" />
            </div>
            <div>
              <h3 className="text-lg font-medium" style={{ fontFamily: "'Berkeley Mono', monospace" }}>{t('agents.configureAgent')}</h3>
              <p className="text-xs text-[var(--text-secondary)]">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">{t('agents.general')}</h4>
            <div>
              <label className="block text-sm font-medium mb-2">{t('common.name')}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                placeholder="e.g. Asistente Producción"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('agents.description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] resize-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                placeholder={t('agents.descriptionPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('agents.instructions')}</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] resize-none text-sm focus:ring-1 focus:ring-[var(--accent-primary)]"
                placeholder={t('agents.instructionsPlaceholder')}
              />
            </div>
          </div>

          {/* Data access */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">{t('agents.dataAccess')}</h4>
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Database size={16} />
                {t('agents.allowedEntities')} ({selectedEntities.length})
              </label>
              <div className="max-h-32 overflow-y-auto border border-[var(--border-light)] rounded-lg p-2 bg-[var(--bg-tertiary)]/30 space-y-1">
                {entities.map(e => (
                  <label key={e.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--bg-hover)] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEntities.includes(e.id)}
                      onChange={() => setSelectedEntities(prev =>
                        prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
                      )}
                      className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                    />
                    <span className="text-sm">{e.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Folder size={16} />
                {t('agents.knowledgeFolders')} ({selectedFolders.length})
              </label>
              <div className="max-h-32 overflow-y-auto border border-[var(--border-light)] rounded-lg p-2 bg-[var(--bg-tertiary)]/30 space-y-1">
                {folders.map(f => (
                  <label key={f.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--bg-hover)] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFolders.includes(f.id)}
                      onChange={() => setSelectedFolders(prev =>
                        prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                      )}
                      className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                    />
                    <span className="text-sm">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow access */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
              <FlowArrow size={16} />
              {t('agents.workflowAccess')}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">{t('agents.workflowAccessDesc')}</p>
            <div className="max-h-32 overflow-y-auto border border-[var(--border-light)] rounded-lg p-2 bg-[var(--bg-tertiary)]/30 space-y-1">
              {workflows.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] px-2 py-1">{t('agents.noWorkflows')}</p>
              ) : (
                workflows.map(w => (
                  <label key={w.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--bg-hover)] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWorkflows.includes(w.id)}
                      onChange={() => setSelectedWorkflows(prev =>
                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                      )}
                      className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                    />
                    <span className="text-sm">{w.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Brain size={16} />
              {t('agents.memory')}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">{t('agents.memoryDesc')}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={e => setMemoryEnabled(e.target.checked)}
                className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <span className="text-sm">{t('agents.memoryEnabled')}</span>
            </label>
          </div>

          {/* Tools */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Wrench size={16} />
              {t('agents.tools')}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">{t('agents.toolsDesc')}</p>
            <div className="space-y-2">
              {TOOL_OPTIONS.map(({ id, labelKey, descKey, icon: Icon }) => (
                <label
                  key={id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    toolsEnabled.includes(id)
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-light)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={toolsEnabled.includes(id)}
                    onChange={() => toggleTool(id)}
                    className="mt-1 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon size={18} className="text-[var(--accent-primary)]" weight="light" />
                      <span className="text-sm font-medium">{t(labelKey)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t(descKey)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border-light)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
