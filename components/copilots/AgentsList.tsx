import React, { useState, useEffect } from 'react';
import { Plus, Robot, Sparkle, GearSix } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface Agent {
  id: string;
  name: string;
  description?: string;
  icon: string;
  allowedEntities?: string[];
  folderIds?: string[];
}

interface AgentsListProps {
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
}

export const AgentsList: React.FC<AgentsListProps> = ({ onSelectAgent, onCreateAgent }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/copilot/agents`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setAgents(data.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium mb-2" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                Organismo de Inteligencias
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Selecciona o crea un agente especializado para empezar
              </p>
            </div>
            <button
              onClick={onCreateAgent}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={16} weight="bold" />
              Nuevo Agente
            </button>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">Cargando agentes...</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Robot size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" weight="light" />
              <p className="text-[var(--text-secondary)] mb-4">No hay agentes configurados</p>
              <button
                onClick={onCreateAgent}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-xl text-sm"
              >
                <Plus size={16} />
                Crear primer agente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className="group p-6 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl hover:border-[var(--border-medium)] hover:shadow-lg transition-all duration-200 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl shrink-0 group-hover:scale-110 transition-transform">
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--text-primary)] mb-1 truncate">{agent.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 min-h-[2.5rem]">
                        {agent.description || 'Agente especializado para consultas'}
                      </p>
                      {agent.allowedEntities && agent.allowedEntities.length > 0 && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                          <Sparkle size={12} weight="light" />
                          {agent.allowedEntities.length} entidad{agent.allowedEntities.length > 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
