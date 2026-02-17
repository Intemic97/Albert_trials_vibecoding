/**
 * LLMConfigPanel
 * Extracted from Workflows.tsx lines 11548-11681
 */

import React, { useState, useRef, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Robot, Sparkle, ChatText, TextT, Hash, CalendarBlank, ListBullets, X, Plus } from '@phosphor-icons/react';
import { PromptInput } from '../../PromptInput';

type OutputType = 'text' | 'number' | 'date' | 'enum';

const OUTPUT_TYPES: { value: OutputType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'text', label: 'Text', icon: TextT },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: CalendarBlank },
  { value: 'enum', label: 'Enum (one of)', icon: ListBullets },
];

interface LLMConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  connections: any[];
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const LLMConfigPanel: React.FC<LLMConfigPanelProps> = ({
  nodeId, node, nodes, connections, entities, onSave, onClose, openFeedbackPopup
}) => {
  const [llmPrompt, setLlmPrompt] = useState(node?.config?.llmPrompt || '');
  const [llmContextEntities, setLlmContextEntities] = useState<string[]>(node?.config?.llmContextEntities || []);
  const [llmIncludeInput, setLlmIncludeInput] = useState(node?.config?.llmIncludeInput !== false);
  const [llmProcessingMode, setLlmProcessingMode] = useState<'batch' | 'perRow'>(node?.config?.llmProcessingMode || 'batch');
  const [outputType, setOutputType] = useState<OutputType>(node?.config?.outputType || 'text');
  const [enumOptions, setEnumOptions] = useState<string[]>(node?.config?.enumOptions || []);
  const [newEnumOption, setNewEnumOption] = useState('');
  const [showOutputDropdown, setShowOutputDropdown] = useState(false);
  const outputDropdownRef = useRef<HTMLDivElement>(null);
  const enumInputRef = useRef<HTMLInputElement>(null);

  // Close output dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (outputDropdownRef.current && !outputDropdownRef.current.contains(e.target as Node)) {
        setShowOutputDropdown(false);
      }
    };
    if (showOutputDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOutputDropdown]);

  const handleAddEnumOption = () => {
    const trimmed = newEnumOption.trim();
    if (trimmed && !enumOptions.includes(trimmed)) {
      setEnumOptions(prev => [...prev, trimmed]);
      setNewEnumOption('');
      enumInputRef.current?.focus();
    }
  };

  const handleRemoveEnumOption = (option: string) => {
    setEnumOptions(prev => prev.filter(o => o !== option));
  };

  const handleSave = () => {
    onSave(nodeId, { llmPrompt, llmContextEntities, llmIncludeInput, llmProcessingMode, outputType, enumOptions: outputType === 'enum' ? enumOptions : [] });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Configure AI Generation"
        icon={Sparkle}
        width="w-[500px]"
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
                    disabled={!llmPrompt.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Prompt
                    </label>
                    <div className="h-48">
                        <PromptInput
                            entities={entities}
                            onGenerate={() => { }} // Not used here
                            isGenerating={false}
                            initialValue={llmPrompt}
                            placeholder="Ask a question... Use @ to mention entities or Input Data."
                            hideButton={true}
                            onChange={(val, ids) => {
                                setLlmPrompt(val);
                                setLlmContextEntities(ids);
                                // Auto-enable include input if @Input Data is mentioned
                                if (val.includes('@Input Data')) {
                                    setLlmIncludeInput(true);
                                }
                            }}
                            className="h-full"
                            inputData={(() => {
                                // Get input data from parent node
                                const parentConnection = connections.find(c => c.toNodeId === nodeId);
                                if (parentConnection) {
                                    const parentNode = nodes.find(n => n.id === parentConnection.fromNodeId);
                                    // Handle splitColumns parent node
                                    if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
                                        return parentConnection.outputType === 'B'
                                            ? parentNode.outputData.outputB || []
                                            : parentNode.outputData.outputA || [];
                                    }
                                    return parentNode?.outputData || parentNode?.data || [];
                                }
                                return [];
                            })()}
                        />
                    </div>
                </div>

                {/* Output Type */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Output
                    </label>
                    <div className="relative" ref={outputDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setShowOutputDropdown(!showOutputDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                {(() => {
                                    const ot = OUTPUT_TYPES.find(t => t.value === outputType);
                                    const Icon = ot?.icon || TextT;
                                    return (
                                        <>
                                            <Icon size={15} weight="regular" className="text-[var(--text-secondary)]" />
                                            {ot?.label || 'Text'}
                                        </>
                                    );
                                })()}
                            </span>
                            <svg className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform ${showOutputDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {showOutputDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg z-50 overflow-hidden">
                                {OUTPUT_TYPES.map(ot => {
                                    const Icon = ot.icon;
                                    const isSelected = outputType === ot.value;
                                    return (
                                        <button
                                            key={ot.value}
                                            type="button"
                                            onClick={() => {
                                                setOutputType(ot.value);
                                                setShowOutputDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                                isSelected
                                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                            }`}
                                        >
                                            <Icon size={15} weight="regular" className="text-[var(--text-secondary)]" />
                                            {ot.label}
                                            {isSelected && (
                                                <span className="ml-auto text-emerald-500">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Enum Options */}
                    {outputType === 'enum' && (
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                Options
                            </label>
                            {/* Existing options as tags */}
                            {enumOptions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {enumOptions.map((opt, idx) => {
                                        const colors = [
                                            'bg-blue-100 text-blue-700 border-blue-200',
                                            'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            'bg-amber-100 text-amber-700 border-amber-200',
                                            'bg-purple-100 text-purple-700 border-purple-200',
                                            'bg-rose-100 text-rose-700 border-rose-200',
                                            'bg-cyan-100 text-cyan-700 border-cyan-200',
                                            'bg-orange-100 text-orange-700 border-orange-200',
                                            'bg-teal-100 text-teal-700 border-teal-200',
                                        ];
                                        const colorClass = colors[idx % colors.length];
                                        return (
                                            <span
                                                key={opt}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
                                            >
                                                {opt}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEnumOption(opt)}
                                                    className="hover:opacity-70 transition-opacity ml-0.5"
                                                >
                                                    <X size={10} weight="bold" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {/* New option input */}
                            <div className="flex items-center gap-2">
                                <input
                                    ref={enumInputRef}
                                    type="text"
                                    value={newEnumOption}
                                    onChange={(e) => setNewEnumOption(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddEnumOption();
                                        }
                                    }}
                                    placeholder="Type an option and press Enter..."
                                    className="flex-1 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddEnumOption}
                                    disabled={!newEnumOption.trim()}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--bg-selected)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus size={12} weight="bold" />
                                    Add
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <input
                        type="checkbox"
                        id="includeInput"
                        checked={llmIncludeInput}
                        onChange={(e) => setLlmIncludeInput(e.target.checked)}
                        className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="includeInput" className="text-sm text-[var(--text-primary)] cursor-pointer">
                        Include Input Data (from previous node)
                    </label>
                </div>

                {/* Processing Mode */}
                <div className="pt-3 border-t border-[var(--border-light)]">
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Processing Mode
                    </label>
                    <div className="space-y-2">
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'batch' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                            <input
                                type="radio"
                                name="llmProcessingMode"
                                value="batch"
                                checked={llmProcessingMode === 'batch'}
                                onChange={() => setLlmProcessingMode('batch')}
                                className="mt-0.5 mr-3"
                            />
                            <div>
                                <span className="font-medium text-sm">Batch (all rows)</span>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    Send all data in one AI call → single result
                                </p>
                            </div>
                        </label>
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'perRow' ? 'border-violet-500 bg-violet-50' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                            <input
                                type="radio"
                                name="llmProcessingMode"
                                value="perRow"
                                checked={llmProcessingMode === 'perRow'}
                                onChange={() => setLlmProcessingMode('perRow')}
                                className="mt-0.5 mr-3"
                            />
                            <div>
                                <span className="font-medium text-sm">Per Row</span>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    Call AI for each row → adds <code className="bg-[var(--bg-tertiary)] px-1 rounded">ai_result</code> field.
                                    Use <code className="bg-[var(--bg-tertiary)] px-1 rounded">{'{field}'}</code> in prompt for row values.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('llm', 'LLM / AI Generate')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
    </NodeConfigSidePanel>

  );
};
