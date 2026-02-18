/**
 * FranmitConfigPanel
 * Extracted from Workflows.tsx lines 8254-8363
 * Enhanced with input column mapping for FranMIT required parameters.
 */

import React, { useState, useMemo } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Eye, EyeSlash, Factory, Flask, ChatText, ArrowRight, Info } from '@phosphor-icons/react';

// FranMIT model required & optional input parameters
const FRANMIT_REQUIRED_PARAMS = [
  { key: 'Q_cat', label: 'Q_cat', description: 'Catalyst flow (mol/s)' },
  { key: 'Q_cocat', label: 'Q_cocat', description: 'Co-catalyst flow (mol/s)' },
  { key: 'Q_but', label: 'Q_but', description: 'Butene flow (mol/s)' },
  { key: 'Q_et', label: 'Q_et', description: 'Ethylene flow (mol/s)' },
  { key: 'Q_H2', label: 'Q_H2', description: 'Hydrogen flow (mol/s)' },
  { key: 'Q_hx', label: 'Q_hx', description: 'Hexane flow (mol/s)' },
  { key: 'T', label: 'T', description: 'Temperature (K)' },
  { key: 'ratio_h2_et', label: 'ratio_h2_et', description: 'H₂/Ethylene ratio' },
];

const FRANMIT_OPTIONAL_PARAMS = [
  { key: 'grado', label: 'grado', description: 'Product grade (e.g. M5206)' },
  { key: 'pureza_LM', label: 'pureza_LM', description: 'Solvent purity (0-1)' },
];

interface FranmitConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  /** Available input columns from the previous node (if known) */
  inputColumns?: string[];
}

export const FranmitConfigPanel: React.FC<FranmitConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup, inputColumns }) => {
  const [franmitApiSecretId, setFranmitApiSecretId] = useState(node?.config?.franmitApiSecretId || '');
  const [franmitReactorVolume, setFranmitReactorVolume] = useState(node?.config?.franmitReactorVolume || '');
  const [franmitReactionVolume, setFranmitReactionVolume] = useState(node?.config?.franmitReactionVolume || '');
  const [franmitCatalystScaleFactor, setFranmitCatalystScaleFactor] = useState(node?.config?.franmitCatalystScaleFactor || '');
  const [showFranmitApiSecret, setShowFranmitApiSecret] = useState(false);

  // Column mapping: { franmitParamKey: inputColumnName }
  // Default: each param maps to its own name (identity mapping)
  const defaultMapping: Record<string, string> = {};
  [...FRANMIT_REQUIRED_PARAMS, ...FRANMIT_OPTIONAL_PARAMS].forEach(p => {
    defaultMapping[p.key] = p.key;
  });
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    node?.config?.franmitColumnMapping || defaultMapping
  );

  // Combine input columns + any custom values already in the mapping
  const availableColumns = useMemo(() => {
    const cols = new Set<string>(inputColumns || []);
    // Also add any values already set in the mapping (user may have typed them before)
    Object.values(columnMapping).forEach(v => { if (v) cols.add(v); });
    // Add the default param names so they always appear
    [...FRANMIT_REQUIRED_PARAMS, ...FRANMIT_OPTIONAL_PARAMS].forEach(p => cols.add(p.key));
    return Array.from(cols).sort();
  }, [inputColumns, columnMapping]);

  const updateMapping = (paramKey: string, inputCol: string) => {
    setColumnMapping(prev => ({ ...prev, [paramKey]: inputCol }));
  };

  const handleSave = () => {
    onSave(nodeId, {
      franmitApiSecretId,
      franmitReactorVolume,
      franmitReactionVolume,
      franmitCatalystScaleFactor,
      franmitColumnMapping: columnMapping,
    });
    onClose();
  };

  const renderMappingRow = (param: { key: string; label: string; description: string }, isRequired: boolean) => {
    const currentValue = columnMapping[param.key] || '';
    const isDefault = currentValue === param.key;

    return (
      <div key={param.key} className="flex items-center gap-2 py-1.5">
        {/* Input column (source) */}
        <div className="flex-1 relative">
          <input
            list={`franmit-cols-${param.key}`}
            value={currentValue}
            onChange={(e) => updateMapping(param.key, e.target.value)}
            placeholder="Select or type column..."
            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] ${
              !currentValue && isRequired
                ? 'border-red-300 bg-red-50/50'
                : 'border-[var(--border-light)]'
            } text-[var(--text-primary)]`}
          />
          <datalist id={`franmit-cols-${param.key}`}>
            {availableColumns.map(col => (
              <option key={col} value={col} />
            ))}
          </datalist>
        </div>

        {/* Arrow */}
        <ArrowRight size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />

        {/* Target param (destination) */}
        <div className="flex-1 flex items-center gap-1.5">
          <code className="text-xs font-mono bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">
            {param.label}
          </code>
          {isRequired && (
            <span className="text-[10px] text-red-500 font-medium">*</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="FranMIT Reactor"
        description="Configure reactor parameters and input column mapping"
        icon={Flask}
        width="w-[540px]"
        footer={
            <>
                <button
                    onClick={() => onClose()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            {/* API Credentials Secret ID */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    API Credentials Secret ID
                </label>
                <div className="relative">
                    <input
                        type={showFranmitApiSecret ? 'text' : 'password'}
                        value={franmitApiSecretId}
                        onChange={(e) => setFranmitApiSecretId(e.target.value)}
                        placeholder="Enter secret ID..."
                        className="w-full px-3 py-1.5 pr-10 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <button
                        type="button"
                        onClick={() => setShowFranmitApiSecret(!showFranmitApiSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        title={showFranmitApiSecret ? 'Hide' : 'Show'}
                    >
                        <Eye size={14} />
                    </button>
                </div>
            </div>

            {/* Parameters Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Reactor Parameters</h4>

                {/* Reactor Volume */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Reactor Volume (m³)
                    </label>
                    <input
                        type="text"
                        value={franmitReactorVolume}
                        onChange={(e) => setFranmitReactorVolume(e.target.value)}
                        placeholder="53"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Reaction Volume */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Reaction Volume (m³)
                    </label>
                    <input
                        type="text"
                        value={franmitReactionVolume}
                        onChange={(e) => setFranmitReactionVolume(e.target.value)}
                        placeholder="Reaction Volume"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Catalyst Scale Factor */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Catalyst Scale Factor
                    </label>
                    <input
                        type="text"
                        value={franmitCatalystScaleFactor}
                        onChange={(e) => setFranmitCatalystScaleFactor(e.target.value)}
                        placeholder="1"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
            </div>

            {/* Column Mapping Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-medium text-[var(--text-secondary)]">Input Column Mapping</h4>
                    <div className="group relative">
                        <Info size={13} className="text-[var(--text-tertiary)] cursor-help" />
                        <div className="hidden group-hover:block absolute left-0 top-5 z-50 w-64 p-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg text-[10px] text-[var(--text-secondary)]">
                            Map your input data columns to the parameters expected by the FranMIT reactor model.
                            If your input columns already have the exact names (e.g. <code className="font-mono bg-[var(--bg-tertiary)] px-1 rounded">Q_cat</code>), no changes needed.
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mb-3">
                    Your column <ArrowRight size={10} className="inline mx-0.5" /> FranMIT parameter
                </p>

                {/* Column headers */}
                <div className="flex items-center gap-2 pb-1.5 mb-1 border-b border-[var(--border-light)]">
                    <span className="flex-1 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Input Column</span>
                    <span className="w-[14px]" />
                    <span className="flex-1 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Model Parameter</span>
                </div>

                {/* Required params */}
                <div className="mb-2">
                    <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Required</span>
                    {FRANMIT_REQUIRED_PARAMS.map(p => renderMappingRow(p, true))}
                </div>

                {/* Optional params */}
                <div>
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Optional</span>
                    {FRANMIT_OPTIONAL_PARAMS.map(p => renderMappingRow(p, false))}
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup?.('franmit', 'FranMIT')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
