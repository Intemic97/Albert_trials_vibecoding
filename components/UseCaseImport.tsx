import React, { useMemo, useState, useRef } from 'react';
import { API_BASE } from '../config';
import {
  UploadSimple, FileCode, CheckCircle, WarningCircle, SpinnerGap,
  Database, FlowArrow, Flask, SquaresFour, Table, Eye, ArrowRight,
  CloudArrowUp, ClipboardText, X
} from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';

type ImportResult = {
  message?: string;
  entities?: number;
  records?: number;
  workflow?: boolean;
  simulation?: boolean;
  dashboard?: boolean;
  dryRun?: boolean;
  warnings?: string[];
  valid?: boolean;
  errors?: string[];
  error?: string;
};

type ImportMode = 'paste' | 'file';

export const UseCaseImport: React.FC = () => {
  const [mode, setMode] = useState<ImportMode>('file');
  const [jsonText, setJsonText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiRoot = API_BASE.startsWith('http')
    ? API_BASE
    : `/${API_BASE.replace(/^\/+/, '')}`;

  const parsedPreview = useMemo(() => {
    if (!jsonText.trim()) return null;
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }, [jsonText]);

  const previewSummary = useMemo(() => {
    const pkg = parsedPreview;
    if (!pkg || typeof pkg !== 'object') return null;
    return {
      name: pkg.name || null,
      entities: Array.isArray(pkg.entities) ? pkg.entities.length : 0,
      records: Array.isArray(pkg.records) ? pkg.records.length : 0,
      workflow: !!(pkg.workflow?.id && pkg.workflow?.data),
      simulation: !!(pkg.simulation?.id),
      dashboard: !!(pkg.dashboard?.id && pkg.dashboard?.name),
    };
  }, [parsedPreview]);

  // Read file content into jsonText for preview
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text || '');
    };
    reader.readAsText(file);
  };

  const validateJson = async () => {
    if (!parsedPreview) {
      setResult({ error: 'El JSON no es válido.' });
      return;
    }
    setValidating(true);
    setResult(null);
    try {
      const res = await fetch(`${apiRoot}/use-case/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPreview)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo validar');
      setResult(data);
    } catch (e: any) {
      setResult({ error: e?.message || 'Error validando' });
    } finally {
      setValidating(false);
    }
  };

  const runImport = async () => {
    if (!parsedPreview) {
      setResult({ error: 'El JSON no es válido.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${apiRoot}/use-case/import${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPreview)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo importar');
      setResult(data);
    } catch (e: any) {
      setResult({ error: e?.message || 'Error importando' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.json') || file.type === 'application/json')) {
      handleFileSelect(file);
      setMode('file');
    }
  };

  const hasContent = mode === 'paste' ? !!jsonText.trim() : !!selectedFile;
  const isJsonValid = !!parsedPreview;

  const summaryItems = previewSummary ? [
    { icon: Database, label: 'Entities', value: previewSummary.entities, active: previewSummary.entities > 0 },
    { icon: Table, label: 'Records', value: previewSummary.records, active: previewSummary.records > 0 },
    { icon: FlowArrow, label: 'Workflow', value: previewSummary.workflow ? 'Yes' : 'No', active: previewSummary.workflow },
    { icon: Flask, label: 'Simulation', value: previewSummary.simulation ? 'Yes' : 'No', active: previewSummary.simulation },
    { icon: SquaresFour, label: 'Dashboard', value: previewSummary.dashboard ? 'Yes' : 'No', active: previewSummary.dashboard },
  ] : [];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <PageHeader title="Import Package" subtitle="Import a use case package to create entities, workflows, simulations and dashboards" />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-xl w-fit">
            {[
              { id: 'file' as const, label: 'Upload File', icon: CloudArrowUp },
              { id: 'paste' as const, label: 'Paste JSON', icon: ClipboardText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === tab.id
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border-light)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <tab.icon size={16} weight="light" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
            {mode === 'file' ? (
              <label
                className={`flex flex-col items-center justify-center p-12 cursor-pointer transition-all ${
                  isDragOver
                    ? 'bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]'
                    : selectedFile
                      ? 'bg-[var(--bg-tertiary)]/50'
                      : 'hover:bg-[var(--bg-tertiary)]/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                      <FileCode size={24} className="text-[var(--accent-primary)]" weight="light" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{selectedFile.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFile(null);
                        setJsonText('');
                        setResult(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-light)] flex items-center justify-center">
                      <CloudArrowUp size={28} className="text-[var(--text-tertiary)]" weight="light" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-[var(--text-primary)]">
                        Drop a <span className="font-medium">.json</span> file here or click to browse
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Use case package with entities, workflows, simulations
                      </p>
                    </div>
                  </div>
                )}
              </label>
            ) : (
              <div className="p-4">
                <textarea
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setSelectedFile(null); }}
                  placeholder='{\n  "name": "My Use Case",\n  "entities": [...],\n  "workflow": {...},\n  "simulation": {...}\n}'
                  className="w-full h-64 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 transition-all resize-none"
                  style={{ fontFamily: "'Berkeley Mono', 'SF Mono', Consolas, monospace", fontSize: '12px', lineHeight: '1.6' }}
                />
                {jsonText.trim() && !parsedPreview && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
                    <WarningCircle size={14} /> JSON inválido — revisa la sintaxis
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preview Summary */}
          {previewSummary && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-[var(--text-tertiary)]" weight="light" />
                  <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Package Preview</h3>
                </div>
                {previewSummary.name && (
                  <span className="text-sm text-[var(--text-primary)] font-medium">{previewSummary.name}</span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-3">
                {summaryItems.map(item => (
                  <div
                    key={item.label}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                      item.active
                        ? 'bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]/20'
                        : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-light)]'
                    }`}
                  >
                    <item.icon
                      size={20}
                      weight="light"
                      className={item.active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}
                    />
                    <div className="text-center">
                      <p className={`text-sm font-medium tabular-nums ${item.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                        {item.value}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mt-0.5">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {hasContent && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] select-none cursor-pointer">
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${dryRun ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-selected)]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dryRun ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="sr-only" />
                  </div>
                  Dry run (validar sin escribir en DB)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={validateJson}
                  disabled={validating || !isJsonValid}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 border border-[var(--border-light)] hover:border-[var(--accent-primary)] rounded-lg text-sm font-medium text-[var(--text-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {validating ? <SpinnerGap size={16} className="animate-spin" /> : <Eye size={16} weight="light" />}
                  {validating ? 'Validando...' : 'Validar'}
                </button>
                <button
                  onClick={runImport}
                  disabled={loading || !isJsonValid}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <SpinnerGap size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} weight="bold" />
                  )}
                  {loading
                    ? (dryRun ? 'Validando...' : 'Importando...')
                    : (dryRun ? 'Probar import (dry run)' : 'Importar package')
                  }
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`border rounded-xl overflow-hidden ${result.error ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
              <div className={`flex items-center gap-2.5 px-5 py-3 ${result.error ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                {result.error ? (
                  <WarningCircle size={18} className="text-red-500" weight="fill" />
                ) : (
                  <CheckCircle size={18} className="text-emerald-500" weight="fill" />
                )}
                <p className={`text-sm font-medium ${result.error ? 'text-red-600' : 'text-emerald-600'}`}>
                  {result.error || result.message || 'Importación completada'}
                </p>
                {result.dryRun && !result.error && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">dry run</span>
                )}
              </div>
              {!result.error && (
                <div className="px-5 py-3 bg-[var(--bg-card)] space-y-2">
                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                    <span>Entities: <strong className="text-[var(--text-primary)]">{result.entities ?? 0}</strong></span>
                    <span>Records: <strong className="text-[var(--text-primary)]">{result.records ?? 0}</strong></span>
                    <span>Workflow: <strong className="text-[var(--text-primary)]">{result.workflow ? 'Yes' : 'No'}</strong></span>
                    <span>Simulation: <strong className="text-[var(--text-primary)]">{result.simulation ? 'Yes' : 'No'}</strong></span>
                    <span>Dashboard: <strong className="text-[var(--text-primary)]">{result.dashboard ? 'Yes' : 'No'}</strong></span>
                  </div>
                  {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border-light)]">
                      <p className="text-[10px] uppercase tracking-wider text-amber-600 mb-1 font-medium">Warnings</p>
                      <ul className="text-xs text-[var(--text-secondary)] space-y-0.5">
                        {result.warnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(result.errors) && result.errors.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border-light)]">
                      <p className="text-[10px] uppercase tracking-wider text-red-600 mb-1 font-medium">Errors</p>
                      <ul className="text-xs text-red-600 space-y-0.5">
                        {result.errors.map((e, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
