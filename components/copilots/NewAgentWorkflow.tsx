import React, { useState, useEffect } from 'react';
import { X, Robot, ArrowRight, ArrowLeft, Check, Database, Folder, Sparkle, SpinnerGap } from '@phosphor-icons/react';
import { API_BASE } from '../../config';
import { Entity } from '../../types';

interface KnowledgeFolder {
  id: string;
  name: string;
  color?: string;
}

interface NewAgentWorkflowProps {
  onClose: () => void;
  onComplete: () => void;
}

export const NewAgentWorkflow: React.FC<NewAgentWorkflowProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entities`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/knowledge/folders`, { credentials: 'include' }).then(r => r.ok ? r.json() : [])
    ]).then(([ents, folds]) => {
      setEntities(ents);
      setFolders(folds);
    });
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/copilot/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon: icon || '🤖',
          instructions: instructions.trim() || null,
          allowedEntities: selectedEntities.length > 0 ? selectedEntities : null,
          folderIds: selectedFolders.length > 0 ? selectedFolders : null
        })
      });
      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10">
              <Robot size={24} className="text-teal-600" weight="light" />
            </div>
            <div>
              <h3 className="text-lg font-medium" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Crear Nuevo Agente</h3>
              <p className="text-xs text-[var(--text-secondary)]">Paso {step} de {totalSteps}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[var(--bg-tertiary)]">
          <div className="h-full bg-teal-600 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }}></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium mb-2">Información básica</h4>
                <p className="text-sm text-[var(--text-secondary)]">Dale identidad a tu agente especializado</p>
              </div>
              
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm font-medium">Icono</label>
                  <input
                    value={icon}
                    onChange={e => setIcon(e.target.value)}
                    className="w-20 h-20 text-4xl text-center border-2 border-[var(--border-medium)] rounded-xl bg-[var(--bg-card)] hover:border-teal-500 focus:border-teal-500 transition-colors"
                    placeholder="🤖"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nombre del Agente</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-[var(--border-medium)] rounded-xl bg-[var(--bg-card)] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-base"
                      placeholder="ej. Agente Repsol, Especialista Producción..."
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Descripción</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-[var(--border-medium)] rounded-xl bg-[var(--bg-card)] resize-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-sm"
                      placeholder="Especializado en producción industrial, seguridad y optimización de procesos..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium mb-2">Instrucciones y contexto</h4>
                <p className="text-sm text-[var(--text-secondary)]">Define cómo debe comportarse y responder este agente</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Instrucciones base</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-[var(--border-medium)] rounded-xl bg-[var(--bg-card)] resize-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-sm font-mono"
                  placeholder={`Ejemplo para Agente Repsol:

Eres un experto en plantas industriales de producción. Tu objetivo es ayudar con:
- Análisis de métricas de producción y seguridad
- Optimización de procesos respetando normativas EU
- Interpretación de datos de mantenimiento preventivo

Prioriza siempre la seguridad y menciona unidades de medida cuando analices datos.`}
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  Estas instrucciones se usarán como base para todas las conversaciones con este agente.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium mb-2">Acceso a datos</h4>
                <p className="text-sm text-[var(--text-secondary)]">Selecciona qué entidades puede consultar este agente</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                  <Database size={16} />
                  Entidades permitidas ({selectedEntities.length} seleccionadas)
                </label>
                {entities.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-[var(--border-light)] rounded-xl text-center text-sm text-[var(--text-secondary)]">
                    No hay entidades creadas. Crea entidades en Knowledge Base primero.
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-[var(--border-light)] rounded-xl p-3 bg-[var(--bg-tertiary)]/20 space-y-2">
                    <button
                      onClick={() => setSelectedEntities(selectedEntities.length === entities.length ? [] : entities.map(e => e.id))}
                      className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium"
                    >
                      {selectedEntities.length === entities.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </button>
                    {entities.map(e => (
                      <label key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] rounded-lg cursor-pointer transition-colors border border-transparent hover:border-[var(--border-light)]">
                        <input
                          type="checkbox"
                          checked={selectedEntities.includes(e.id)}
                          onChange={() => setSelectedEntities(prev =>
                            prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
                          )}
                          className="rounded w-4 h-4"
                        />
                        <Database size={16} className="text-[var(--text-tertiary)]" weight="light" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          {e.description && <p className="text-xs text-[var(--text-tertiary)] truncate">{e.description}</p>}
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">{e.properties?.length || 0} campos</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium mb-2">Base de conocimiento</h4>
                <p className="text-sm text-[var(--text-secondary)]">Conecta carpetas de documentos y PDFs para enriquecer las respuestas</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                  <Folder size={16} />
                  Carpetas de conocimiento ({selectedFolders.length} seleccionadas)
                </label>
                {folders.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-[var(--border-light)] rounded-xl text-center text-sm text-[var(--text-secondary)]">
                    No hay carpetas de conocimiento. Crea carpetas en Knowledge Base primero.
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-[var(--border-light)] rounded-xl p-3 bg-[var(--bg-tertiary)]/20 space-y-2">
                    {folders.map(f => (
                      <label key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] rounded-lg cursor-pointer transition-colors border border-transparent hover:border-[var(--border-light)]">
                        <input
                          type="checkbox"
                          checked={selectedFolders.includes(f.id)}
                          onChange={() => setSelectedFolders(prev =>
                            prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                          )}
                          className="rounded w-4 h-4"
                        />
                        <Folder size={16} className="text-[var(--text-tertiary)]" weight="light" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-3">
                  Los documentos de estas carpetas estarán disponibles para el agente al responder preguntas.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border-light)] flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border-medium)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-colors"
          >
            <ArrowLeft size={14} />
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i + 1 === step ? 'bg-teal-600' : i + 1 < step ? 'bg-teal-600/50' : 'bg-[var(--border-medium)]'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step < totalSteps) {
                setStep(step + 1);
              } else {
                handleCreate();
              }
            }}
            disabled={!canAdvance() || loading}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === totalSteps ? (
              <>
                {loading ? <SpinnerGap size={16} className="animate-spin" /> : <Check size={16} />}
                Crear Agente
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
