import React, { useState, useEffect } from 'react';
import { X, Robot, Pencil, Check, Trash } from '@phosphor-icons/react';
import { API_BASE } from '../../config';

interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt?: string | null;
  isSystem: boolean;
  sortOrder: number;
}

export const AgentsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/copilot/agents`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setAgents(data.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (a: Agent) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditPrompt(a.systemPrompt || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${API_BASE}/copilot/agents/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName, systemPrompt: editPrompt || null })
      });
      if (res.ok) {
        const updated = await res.json();
        setAgents(prev => prev.map(a => a.id === editingId ? updated : a));
        setEditingId(null);
      }
    } catch (_) {}
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const roleLabels: Record<string, string> = {
    orchestrator: 'Orquestador',
    analyst: 'Analista de Datos',
    specialist: 'Especialista',
    synthesis: 'Síntesis',
    memory: 'Memoria'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border-light)] flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Agentes del Organismo</h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Cargando...</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No hay agentes configurados.</p>
          ) : (
            <div className="space-y-3">
              {agents.map(a => (
                <div key={a.id} className="p-4 border border-[var(--border-light)] rounded-xl bg-[var(--bg-tertiary)]/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-teal-500/10">
                        <Robot size={18} className="text-teal-600" weight="light" />
                      </div>
                      <div>
                        {editingId === a.id ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="text-sm font-medium border border-[var(--border-medium)] rounded px-2 py-1 bg-[var(--bg-card)] w-48"
                          />
                        ) : (
                          <p className="text-sm font-medium">{a.name}</p>
                        )}
                        <p className="text-xs text-[var(--text-tertiary)]">{roleLabels[a.role] || a.role}</p>
                      </div>
                    </div>
                    {!a.isSystem && (
                      <div className="flex gap-1">
                        {editingId === a.id ? (
                          <>
                            <button onClick={saveEdit} className="p-1.5 text-teal-600 hover:bg-teal-500/10 rounded">
                              <Check size={16} />
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] rounded">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(a)} className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] rounded">
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    {a.isSystem && <span className="text-xs text-[var(--text-tertiary)]">Sistema</span>}
                  </div>
                  {editingId === a.id ? (
                    <div className="mt-3">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">System prompt (editable)</label>
                      <textarea
                        value={editPrompt}
                        onChange={e => setEditPrompt(e.target.value)}
                        rows={4}
                        className="w-full text-xs border border-[var(--border-medium)] rounded-lg p-2 bg-[var(--bg-card)] resize-none"
                        placeholder="Instrucciones adicionales para este agente..."
                      />
                    </div>
                  ) : a.systemPrompt ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">{a.systemPrompt}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--text-tertiary)]">
            Los agentes del sistema (Orquestador, Analista, etc.) trabajan juntos para responder tus preguntas. Los agentes personalizados pueden editarse.
          </p>
        </div>
      </div>
    </div>
  );
};
