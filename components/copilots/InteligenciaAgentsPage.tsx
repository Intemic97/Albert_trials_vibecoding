import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Robot, Plus, GearSix, Trash, Database, Folder,
  MagnifyingGlass, ChartLine, Cpu, Copy, User
} from '@phosphor-icons/react';
import { API_BASE } from '../../config';
import { useTranslation } from 'react-i18next';
import { AgentConfigModal } from './AgentConfigModal';
import { NewAgentWorkflow } from './NewAgentWorkflow';
import {
  AGENT_TEMPLATES,
  POPULAR_TEMPLATE_IDS,
  TEMPLATE_CATEGORIES,
  type AgentTemplate
} from './agentTemplates';
import { Factory, Wine, CurrencyDollar, ChartBar, Gear, Flask, Truck, Lightning, ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe, Lightbulb, FileText } from '@phosphor-icons/react';

const ICON_MAP: Record<string, any> = {
  Factory, Wine, CurrencyDollar, ChartBar, Gear, Flask, Truck, Lightning,
  ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe,
  Lightbulb, Robot, ChartLine, Cpu, FileText
};

const getIconComponent = (iconName: string) => ICON_MAP[iconName] || Robot;

const ACCENT_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  green: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-600' }
};

interface Agent {
  id: string;
  name: string;
  description?: string;
  icon: string;
  instructions?: string;
  allowedEntities?: string[];
  folderIds?: string[];
  createdByName?: string;
}

export const InteligenciaAgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | undefined>();
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const popularTemplates = useMemo(
    () => POPULAR_TEMPLATE_IDS
      .map(id => AGENT_TEMPLATES.find(t => t.id === id))
      .filter(Boolean) as AgentTemplate[],
    []
  );

  const filteredTemplates = useMemo(() => {
    return AGENT_TEMPLATES.filter(t => {
      const matchName = !filterQuery || t.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(filterQuery.toLowerCase());
      const matchCat = filterCategory === 'all' || t.category === filterCategory;
      return matchName && matchCat;
    });
  }, [filterQuery, filterCategory]);

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/copilot/agents`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAgents(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este agente? Los chats que lo usan seguirán funcionando pero sin configuración específica.')) return;
    try {
      const res = await fetch(`${API_BASE}/copilot/agents/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) await loadAgents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfig = (agent: Agent) => {
    setEditingAgent(agent);
    setShowConfigModal(true);
  };
  
  const handleChat = (agent: Agent) => {
    navigate(`/copilots?agentId=${encodeURIComponent(agent.id)}`);
  };

  const openFromTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    setShowTemplatesModal(false);
    setShowCreateWorkflow(true);
  };

  const closeWorkflow = () => {
    setShowCreateWorkflow(false);
    setSelectedTemplate(undefined);
  };

  const TemplateCard = ({ template, compact = false }: { template: AgentTemplate; compact?: boolean }) => {
    const IconComp = getIconComponent(template.icon);
    const accent = ACCENT_COLORS[template.accentColor] || ACCENT_COLORS.blue;
    return (
      <div
        className={`group p-5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl hover:border-[var(--border-medium)] hover:shadow-md transition-all ${compact ? 'min-w-[280px]' : ''}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${accent.bg} ${accent.text}`}
          >
            <IconComp size={compact ? 20 : 24} weight="light" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-[var(--text-primary)] mb-1 truncate" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
              {template.name}
            </h4>
            <p className={`text-[var(--text-secondary)] line-clamp-2 ${compact ? 'text-xs' : 'text-xs'}`}>
              {template.description}
            </p>
          </div>
        </div>
        <button
          onClick={() => openFromTemplate(template)}
          className="w-full py-2 px-3 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
        >
          {t('agents.useTemplate')}
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="h-12 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inteligencia')}
            className="flex items-center gap-2 px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors text-sm"
          >
            <ArrowLeft size={14} weight="light" />
            <span className="font-medium">{t('agents.back')}</span>
          </button>
          <div className="h-6 w-px bg-[var(--border-light)]" />
          <h1 className="text-base font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
            {t('agents.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Copy size={16} weight="light" />
            {t('agents.templates')}
          </button>
          <button
            onClick={() => { setSelectedTemplate(undefined); setShowCreateWorkflow(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
          >
            <Plus size={16} weight="bold" />
            {t('agents.newAgent')}
          </button>
        </div>
      </div>

      {/* Contenido principal: Tus agentes */}
      <div className="flex-1 overflow-y-auto p-6">
        <section>
          {loading ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">{t('agents.loadingAgents')}</div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-light)]">
              <Robot size={48} className="mb-4 text-[var(--text-tertiary)]" weight="light" />
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{t('agents.noAgentsTitle')}</p>
              <p className="text-xs text-[var(--text-tertiary)] mb-6 max-w-sm text-center">
                {t('agents.noAgentsBody')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTemplatesModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium"
                >
                  <Copy size={16} weight="light" />
                  {t('agents.viewTemplates')}
                </button>
                <button
                  onClick={() => { setSelectedTemplate(undefined); setShowCreateWorkflow(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium"
                >
                  <Plus size={16} weight="bold" />
                  {t('agents.newAgent')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => {
                const AgentIcon = getIconComponent(agent.icon);
                return (
                  <div
                    key={agent.id}
                    className="group p-5 bg-[var(--bg-tertiary)]/30 border border-[var(--border-light)] rounded-xl hover:border-[var(--border-medium)] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-[var(--bg-hover)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-selected)] group-hover:text-white transition-colors">
                          <AgentIcon size={24} weight="light" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1 truncate flex items-center gap-1.5">
                            {agent.name}
                            {agent.id.startsWith('agent_default_') && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium uppercase tracking-wider shrink-0">
                                default
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 min-h-[2rem]">
                            {agent.description || t('agents.specializedAgent')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3 text-xs text-[var(--text-tertiary)]">
                      {agent.createdByName && (
                        <div className="flex items-center gap-1">
                          <User size={12} weight="light" />
                          <span className="truncate max-w-[120px]">{agent.createdByName}</span>
                        </div>
                      )}
                      {(agent.allowedEntities?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <Database size={12} weight="light" />
                          {agent.allowedEntities!.length}
                        </div>
                      )}
                      {(agent.folderIds?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <Folder size={12} weight="light" />
                          {agent.folderIds!.length}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleChat(agent)}
                        className="flex-1 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs transition-colors flex items-center justify-center"
                        title="Chat"
                      >
                        {t('agents.chat')}
                      </button>
                      <button
                        onClick={() => handleConfig(agent)}
                        className="flex-1 px-3 py-1.5 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-xs transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1"
                        title={t('agents.configure')}
                      >
                        <GearSix size={14} />
                        {t('agents.configure')}
                      </button>
                      {!agent.id.startsWith('agent_default_') && (
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs transition-colors"
                          title={t('agents.delete')}
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showCreateWorkflow && (
        <NewAgentWorkflow
          onClose={closeWorkflow}
          onComplete={async () => {
            await loadAgents();
            closeWorkflow();
          }}
          initialTemplate={selectedTemplate}
        />
      )}

      {showConfigModal && editingAgent && (
        <AgentConfigModal
          agent={editingAgent}
          onClose={() => { setShowConfigModal(false); setEditingAgent(null); }}
          onSave={async () => {
            await loadAgents();
            setShowConfigModal(false);
            setEditingAgent(null);
          }}
        />
      )}

      {/* Modal Plantillas (librería con solo instrucciones) */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTemplatesModal(false)}>
          <div
            className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-xl shadow-2xl m-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
              <h2 className="text-base font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                Plantillas
              </h2>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <section>
                <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">Populares</h3>
                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                  {popularTemplates.map(t => (
                    <TemplateCard key={t.id} template={t} compact />
                  ))}
                </div>
              </section>
              <section>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" weight="light" />
                    <input
                      type="text"
                      placeholder="Filtrar por nombre..."
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                    />
                  </div>
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                  >
                    {TEMPLATE_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map(t => (
                    <TemplateCard key={t.id} template={t} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
