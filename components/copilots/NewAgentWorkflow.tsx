import React, { useState, useEffect } from 'react';
import { X, Robot, ArrowRight, ArrowLeft, Check, Database, Folder, Sparkle, SpinnerGap, Info, Factory, Wine, CurrencyDollar, ChartBar, Gear, Flask, Truck, Lightning, ShieldCheck, TrendUp, Users, Scales, Target, Wrench, Package, Globe, Lightbulb, Barcode, FileText, Buildings, Atom, Cpu, ChartLine } from '@phosphor-icons/react';
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

const AGENT_ICONS = [
  { icon: Factory, name: 'Factory', label: 'Producción/Industrial' },
  { icon: Wine, name: 'Wine', label: 'Alimentación/Bebidas' },
  { icon: CurrencyDollar, name: 'CurrencyDollar', label: 'Finanzas' },
  { icon: ChartBar, name: 'ChartBar', label: 'Analytics/Datos' },
  { icon: Gear, name: 'Gear', label: 'Operaciones' },
  { icon: Flask, name: 'Flask', label: 'Laboratorio/I+D' },
  { icon: Truck, name: 'Truck', label: 'Logística' },
  { icon: Lightning, name: 'Lightning', label: 'Energía' },
  { icon: ShieldCheck, name: 'ShieldCheck', label: 'Seguridad' },
  { icon: TrendUp, name: 'TrendUp', label: 'Ventas' },
  { icon: Users, name: 'Users', label: 'RRHH' },
  { icon: Scales, name: 'Scales', label: 'Legal/Compliance' },
  { icon: Target, name: 'Target', label: 'Estrategia' },
  { icon: Wrench, name: 'Wrench', label: 'Mantenimiento' },
  { icon: Package, name: 'Package', label: 'Inventario' },
  { icon: Globe, name: 'Globe', label: 'Sostenibilidad' },
  { icon: Robot, name: 'Robot', label: 'General' },
  { icon: Lightbulb, name: 'Lightbulb', label: 'Innovación' },
  { icon: Barcode, name: 'Barcode', label: 'Códigos/SKU' },
  { icon: FileText, name: 'FileText', label: 'Documentación' },
  { icon: Buildings, name: 'Buildings', label: 'Real Estate' },
  { icon: Atom, name: 'Atom', label: 'Química' },
  { icon: Cpu, name: 'Cpu', label: 'IT/Tech' },
  { icon: ChartLine, name: 'ChartLine', label: 'Forecasting' }
];

export const NewAgentWorkflow: React.FC<NewAgentWorkflowProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Robot');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getIconComponent = (iconName: string) => {
    const iconData = AGENT_ICONS.find(i => i.name === iconName);
    return iconData?.icon || Robot;
  };

  const IconComponent = getIconComponent(icon);

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
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/copilot/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon: icon || 'Robot',
          instructions: instructions.trim() || null,
          allowedEntities: selectedEntities.length > 0 ? selectedEntities : null,
          folderIds: selectedFolders.length > 0 ? selectedFolders : null
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Agente creado:', data);
      onComplete();
    } catch (err) {
      console.error('Error creando agente:', err);
      setError(err instanceof Error ? err.message : 'No se pudo crear el agente');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-card)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-selected)] flex items-center justify-center">
              <Robot size={24} className="text-white" weight="light" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Crear Nuevo Agente</h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Paso {step} de {totalSteps}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[var(--bg-tertiary)]">
          <div className="h-full bg-[var(--bg-selected)] transition-all duration-300 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }}></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Información básica</h4>
                <p className="text-sm text-[var(--text-secondary)]">Dale identidad a tu agente especializado</p>
              </div>
              
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Icono</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="w-20 h-20 flex items-center justify-center border-2 border-[var(--border-light)] rounded-xl bg-[var(--bg-tertiary)]/30 hover:border-[var(--border-medium)] transition-all cursor-pointer group"
                    >
                      <IconComponent size={32} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" weight="light" />
                    </button>
                    {showIconPicker && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowIconPicker(false)} />
                        <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-2xl z-20 p-4">
                          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">Selecciona icono</p>
                          <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {AGENT_ICONS.map(({ icon: IconComp, name: iconName, label }) => (
                              <button
                                key={iconName}
                                onClick={() => {
                                  setIcon(iconName);
                                  setShowIconPicker(false);
                                }}
                                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                                  icon === iconName 
                                    ? 'bg-[var(--bg-selected)] text-white ring-2 ring-[var(--bg-selected)]/30' 
                                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                                title={label}
                              >
                                <IconComp size={20} weight="light" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Nombre del Agente</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-[var(--border-light)] rounded-lg bg-[var(--bg-card)] focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] transition-all text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                      placeholder="ej. Agente Repsol, Especialista Producción..."
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Descripción</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-[var(--border-light)] rounded-lg bg-[var(--bg-card)] resize-none focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] transition-all text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
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
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Instrucciones y contexto</h4>
                <p className="text-sm text-[var(--text-secondary)]">Define cómo debe comportarse y responder este agente</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Instrucciones base</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-[var(--border-light)] rounded-lg bg-[var(--bg-card)] resize-none focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] transition-all text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                  placeholder={`Ejemplo para Agente Repsol:

Eres un experto en plantas industriales de producción. Tu objetivo es ayudar con:
- Análisis de métricas de producción y seguridad
- Optimización de procesos respetando normativas EU
- Interpretación de datos de mantenimiento preventivo

Prioriza siempre la seguridad y menciona unidades de medida cuando analices datos.`}
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-3 flex items-start gap-2">
                  <Info size={14} className="mt-0.5 shrink-0" weight="light" />
                  <span>Estas instrucciones se usarán como base para todas las conversaciones con este agente.</span>
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Acceso a datos</h4>
                <p className="text-sm text-[var(--text-secondary)]">Selecciona qué entidades puede consultar este agente</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Database size={16} weight="light" />
                  Entidades permitidas ({selectedEntities.length} seleccionadas)
                </label>
                {entities.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-[var(--border-light)] rounded-xl text-center">
                    <Database size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" weight="light" />
                    <p className="text-sm text-[var(--text-secondary)]">No hay entidades creadas</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Crea entidades en Knowledge Base primero</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-[var(--border-light)] rounded-lg p-3 bg-[var(--bg-tertiary)]/30 space-y-2 custom-scrollbar">
                    <button
                      onClick={() => setSelectedEntities(selectedEntities.length === entities.length ? [] : entities.map(e => e.id))}
                      className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium text-[var(--text-primary)]"
                    >
                      {selectedEntities.length === entities.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </button>
                    {entities.map(e => (
                      <label key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] rounded-lg cursor-pointer transition-all border border-transparent hover:border-[var(--border-light)] group">
                        <input
                          type="checkbox"
                          checked={selectedEntities.includes(e.id)}
                          onChange={() => setSelectedEntities(prev =>
                            prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
                          )}
                          className="rounded w-4 h-4 border-[var(--border-medium)] text-[var(--bg-selected)] focus:ring-[var(--bg-selected)]/20"
                        />
                        <Database size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" weight="light" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-[var(--text-primary)]">{e.name}</p>
                          {e.description && <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{e.description}</p>}
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)] shrink-0">{e.properties?.length || 0} campos</span>
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
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Base de conocimiento</h4>
                <p className="text-sm text-[var(--text-secondary)]">Conecta carpetas de documentos y PDFs para enriquecer las respuestas</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Folder size={16} weight="light" />
                  Carpetas de conocimiento ({selectedFolders.length} seleccionadas)
                </label>
                {folders.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-[var(--border-light)] rounded-xl text-center">
                    <Folder size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" weight="light" />
                    <p className="text-sm text-[var(--text-secondary)]">No hay carpetas de conocimiento</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Crea carpetas en Knowledge Base primero</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-[var(--border-light)] rounded-lg p-3 bg-[var(--bg-tertiary)]/30 space-y-2 custom-scrollbar">
                    {folders.map(f => (
                      <label key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] rounded-lg cursor-pointer transition-all border border-transparent hover:border-[var(--border-light)] group">
                        <input
                          type="checkbox"
                          checked={selectedFolders.includes(f.id)}
                          onChange={() => setSelectedFolders(prev =>
                            prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                          )}
                          className="rounded w-4 h-4 border-[var(--border-medium)] text-[var(--bg-selected)] focus:ring-[var(--bg-selected)]/20"
                        />
                        <Folder size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" weight="light" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-[var(--text-primary)]">{f.name}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-3 flex items-start gap-2">
                  <Info size={14} className="mt-0.5 shrink-0" weight="light" />
                  <span>Los documentos de estas carpetas estarán disponibles para el agente al responder preguntas.</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-[var(--border-light)] bg-[var(--bg-card)]">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <X size={16} className="text-red-600 mt-0.5 flex-shrink-0" weight="bold" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-800 font-medium">Error al crear agente</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft size={14} weight="light" />
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i + 1 === step ? 'bg-[var(--bg-selected)] w-6' : i + 1 < step ? 'bg-[var(--bg-selected)]/50' : 'bg-[var(--border-medium)]'
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
            className="flex items-center gap-2 px-6 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-95"
          >
            {step === totalSteps ? (
              <>
                {loading ? <SpinnerGap size={16} className="animate-spin" weight="light" /> : <Check size={16} weight="bold" />}
                Crear Agente
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight size={14} weight="bold" />
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};
