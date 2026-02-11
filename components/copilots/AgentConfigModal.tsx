import React, { useState, useEffect } from 'react';
import { X, Robot, Sparkle, Database, Folder, Factory, Wine, CurrencyDollar, ChartBar, Gear, FlaskConical, Truck, Lightning, ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe, Lightbulb } from '@phosphor-icons/react';
import { API_BASE } from '../../config';
import { Entity } from '../../types';

interface KnowledgeFolder {
  id: string;
  name: string;
  color?: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  icon: string;
  instructions?: string;
  allowedEntities?: string[];
  folderIds?: string[];
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
  Factory, Wine, CurrencyDollar, ChartBar, Gear, FlaskConical, Truck, Lightning,
  ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe, Lightbulb, Robot
};

const getIconComponent = (iconName: string) => {
  return ICON_MAP[iconName] || Robot;
};

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ agent, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'orchestrator' | 'analyst' | 'specialist' | 'synthesis'>('general');
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [icon, setIcon] = useState(agent.icon);
  const [instructions, setInstructions] = useState(agent.instructions || '');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(agent.allowedEntities || []);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(agent.folderIds || []);
  const [orchestratorPrompt, setOrchestratorPrompt] = useState(agent.orchestratorPrompt || '');
  const [analystPrompt, setAnalystPrompt] = useState(agent.analystPrompt || '');
  const [specialistPrompt, setSpecialistPrompt] = useState(agent.specialistPrompt || '');
  const [synthesisPrompt, setSynthesisPrompt] = useState(agent.synthesisPrompt || '');
  
  const [entities, setEntities] = useState<Entity[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entities`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/knowledge/folders`, { credentials: 'include' }).then(r => r.ok ? r.json() : [])
    ]).then(([ents, folds]) => {
      setEntities(ents);
      setFolders(folds);
    });
  }, []);

  const handleSave = async () => {
    const updated = {
      ...agent,
      name,
      description,
      icon,
      instructions,
      allowedEntities: selectedEntities,
      folderIds: selectedFolders,
      orchestratorPrompt,
      analystPrompt,
      specialistPrompt,
      synthesisPrompt
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

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'orchestrator', label: 'Orquestador' },
    { id: 'analyst', label: 'Analista' },
    { id: 'specialist', label: 'Especialista' },
    { id: 'synthesis', label: 'Síntesis' }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const IconComponent = getIconComponent(icon);
              return (
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-selected)] flex items-center justify-center">
                  <IconComponent size={24} className="text-white" weight="light" />
                </div>
              );
            })()}
            <div>
              <h3 className="text-lg font-medium" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Configurar Agente</h3>
              <p className="text-xs text-[var(--text-secondary)]">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-[var(--border-light)] flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-b-2 border-teal-500'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'general' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Nombre</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] focus:ring-1 focus:ring-teal-500"
                  placeholder="ej. Agente Repsol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Icono</label>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">El icono no se puede cambiar después de crear el agente</p>
                {(() => {
                  const IconComponent = getIconComponent(icon);
                  return (
                    <div className="w-16 h-16 rounded-xl bg-[var(--bg-tertiary)]/50 flex items-center justify-center">
                      <IconComponent size={28} className="text-[var(--text-secondary)]" weight="light" />
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] resize-none"
                  placeholder="Especializado en análisis de producción y optimización..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Instrucciones base</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] resize-none text-sm"
                  placeholder="Eres un experto en producción industrial. Prioriza métricas de seguridad y eficiencia..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Database size={16} />
                  Entidades permitidas ({selectedEntities.length})
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
                        className="rounded"
                      />
                      <span className="text-sm">{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Folder size={16} />
                  Carpetas de conocimiento ({selectedFolders.length})
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
                        className="rounded"
                      />
                      <span className="text-sm">{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeTab === 'orchestrator' && (
            <PromptEditor
              title="Prompt del Orquestador"
              description="Decide qué agentes internos usar y cómo coordinarlos"
              value={orchestratorPrompt}
              onChange={setOrchestratorPrompt}
              placeholder="Analiza si la pregunta necesita datos (analyst), estrategia (specialist), o ambos..."
            />
          )}
          {activeTab === 'analyst' && (
            <PromptEditor
              title="Prompt del Analista"
              description="Consulta entidades, hace agregaciones y cruces"
              value={analystPrompt}
              onChange={setAnalystPrompt}
              placeholder="Cuando analices datos, prioriza métricas de producción y menciona siempre las unidades..."
            />
          )}
          {activeTab === 'specialist' && (
            <PromptEditor
              title="Prompt del Especialista"
              description="Aporta expertise del dominio, recomendaciones y mejores prácticas"
              value={specialistPrompt}
              onChange={setSpecialistPrompt}
              placeholder="Eres un experto en refinería. Cuando sugieras optimizaciones, considera seguridad y normativa..."
            />
          )}
          {activeTab === 'synthesis' && (
            <PromptEditor
              title="Prompt de Síntesis"
              description="Combina outputs de otros agentes en una respuesta coherente"
              value={synthesisPrompt}
              onChange={setSynthesisPrompt}
              placeholder="Al combinar respuestas, prioriza claridad y destaca insights clave..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border-light)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const PromptEditor: React.FC<{ title: string; description: string; value: string; onChange: (v: string) => void; placeholder: string }> = ({ title, description, value, onChange, placeholder }) => (
  <div>
    <h4 className="font-medium mb-1">{title}</h4>
    <p className="text-xs text-[var(--text-secondary)] mb-3">{description}</p>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={8}
      className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] text-sm resize-none font-mono"
      placeholder={placeholder}
    />
    <p className="text-xs text-[var(--text-tertiary)] mt-2">
      Si está vacío, se usa el prompt base del rol. Añade instrucciones específicas para personalizar.
    </p>
  </div>
);
