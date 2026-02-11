import React, { useState, useEffect } from 'react';
import { X, Robot, Plus, Sparkle, GearSix, Trash, Database, Folder } from '@phosphor-icons/react';
import { API_BASE } from '../../config';
import { AgentConfigModal } from './AgentConfigModal';

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

interface AgentLibraryProps {
  onClose: () => void;
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
}

export const AgentLibrary: React.FC<AgentLibraryProps> = ({ onClose, onSelectAgent, selectedAgentId }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🤖');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/copilot/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          icon: newIcon || '🤖'
        })
      });
      if (res.ok) {
        await loadAgents();
        setShowCreateModal(false);
        setNewName('');
        setNewDescription('');
        setNewIcon('🤖');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este agente? Los chats que lo usan seguirán funcionando pero sin configuración específica.')) return;
    try {
      const res = await fetch(`${API_BASE}/copilot/agents/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await loadAgents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfig = (agent: Agent) => {
    setEditingAgent(agent);
    setShowConfigModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium mb-1" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Librería de Agentes</h3>
            <p className="text-xs text-[var(--text-secondary)]">Templates compartidos con conocimiento y contexto de la empresa</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={16} weight="bold" />
              Nuevo Agente
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">Cargando agentes...</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Robot size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" weight="light" />
              <p className="text-[var(--text-secondary)] mb-4">No hay agentes configurados</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm"
              >
                <Plus size={16} />
                Crear primer agente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={`group p-5 bg-[var(--bg-tertiary)]/30 border rounded-xl transition-all ${
                    selectedAgentId === agent.id
                      ? 'border-teal-500 shadow-md'
                      : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{agent.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1 truncate">{agent.name}</h4>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 min-h-[2rem]">
                          {agent.description || 'Agente especializado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(agent.allowedEntities && agent.allowedEntities.length > 0) || (agent.folderIds && agent.folderIds.length > 0) ? (
                    <div className="flex items-center gap-3 mb-3 text-xs text-[var(--text-tertiary)]">
                      {agent.allowedEntities && agent.allowedEntities.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Database size={12} weight="light" />
                          {agent.allowedEntities.length}
                        </div>
                      )}
                      {agent.folderIds && agent.folderIds.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Folder size={12} weight="light" />
                          {agent.folderIds.length}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    {onSelectAgent && (
                      <button
                        onClick={() => {
                          onSelectAgent(agent.id);
                          onClose();
                        }}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selectedAgentId === agent.id
                            ? 'bg-teal-600 text-white'
                            : 'bg-[var(--bg-selected)] hover:bg-[#555555] text-white'
                        }`}
                      >
                        {selectedAgentId === agent.id ? 'Seleccionado' : 'Usar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleConfig(agent)}
                      className="px-3 py-1.5 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-xs transition-colors"
                      title="Configurar"
                    >
                      <GearSix size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs transition-colors"
                      title="Eliminar"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border-light)]">
              <h3 className="text-lg font-medium" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Nuevo Agente</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Icono</label>
                <input
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  className="w-20 px-3 py-2 border border-[var(--border-medium)] rounded-lg text-2xl text-center bg-[var(--bg-card)]"
                  placeholder="🤖"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nombre</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)]"
                  placeholder="ej. Agente Repsol, Especialista Producción..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg bg-[var(--bg-card)] resize-none text-sm"
                  placeholder="Especializado en producción industrial, seguridad y optimización..."
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Después de crear, podrás configurar entidades, knowledge base y prompts personalizados.
              </p>
            </div>
            <div className="p-6 border-t border-[var(--border-light)] flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && editingAgent && (
        <AgentConfigModal
          agent={editingAgent}
          onClose={() => {
            setShowConfigModal(false);
            setEditingAgent(null);
          }}
          onSave={async () => {
            await loadAgents();
            setShowConfigModal(false);
            setEditingAgent(null);
          }}
        />
      )}
    </div>
  );
};
