/**
 * SaveRecordsConfigPanel
 * Extracted from Workflows.tsx lines 11405-11544
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Database, FloppyDisk, Plus, ChatText } from '@phosphor-icons/react';

interface SaveRecordsConfigPanelProps {
  nodeId: string;
  node: any;
  entities: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const SaveRecordsConfigPanel: React.FC<SaveRecordsConfigPanelProps> = ({
  nodeId, node, entities, onSave, onClose, openFeedbackPopup
}) => {
  const [saveEntityId, setSaveEntityId] = useState(node?.config?.entityId || '');
  const [isCreatingNewEntity, setIsCreatingNewEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [localCreatedEntities, setLocalCreatedEntities] = useState<Array<{ id: string; name: string }>>([]);

  const allEntities = [...entities, ...localCreatedEntities];

  const handleSave = () => {
    const entity = allEntities.find(e => e.id === saveEntityId);
    onSave(nodeId, {
      entityId: saveEntityId,
      targetEntityName: entity?.name || '',
    }, entity ? `Save to: ${entity.name}` : 'Save Records');
    onClose();
  };

  return (
    <NodeConfigSidePanel
            isOpen={!!nodeId}
        onClose={() => { onClose(); setIsCreatingNewEntity(false); setNewEntityName(''); }}
        title="Save to Database"
        icon={Database}
        footer={
            <>
                <button
                    onClick={() => { onClose(); setIsCreatingNewEntity(false); setNewEntityName(''); }}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!saveEntityId}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Select Entity
                </label>
                <select
                    value={saveEntityId}
                    onChange={(e) => { setSaveEntityId(e.target.value); setIsCreatingNewEntity(false); }}
                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                >
                    <option value="">Choose entity...</option>
                    {allEntities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                </select>
            </div>

            {/* + New Database */}
            {!isCreatingNewEntity ? (
                <button
                    onClick={() => { setIsCreatingNewEntity(true); setSaveEntityId(''); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] font-medium transition-colors"
                >
                    <Plus size={14} weight="bold" />
                    New database
                </button>
            ) : (
                <div className="border border-[var(--border-light)] rounded-lg p-3 space-y-3 bg-[var(--bg-tertiary)]">
                    <label className="block text-xs font-medium text-[var(--text-primary)]">
                        New Database Name
                    </label>
                    <input
                        type="text"
                        value={newEntityName}
                        onChange={(e) => setNewEntityName(e.target.value)}
                        placeholder="e.g. Viticultors Output"
                        autoFocus
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                        onKeyDown={(e) => { if (e.key === 'Enter' && newEntityName.trim()) handleCreateNewEntity(); }}
                    />

                    {/* Preview detected columns */}
                    {(() => {
                        const parentData = nodeId ? getParentNodeOutputData(nodeId) : null;
                        if (!parentData || parentData.length === 0) return null;
                        const sample = parentData[0];
                        const keys = Object.keys(sample).filter(k => !['id', 'createdAt', 'updatedAt', 'entityId', 'metadata', 'raw', '__index'].includes(k));
                        if (keys.length === 0) return null;
                        return (
                            <div>
                                <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">
                                    {keys.length} properties detected from upstream data:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {keys.slice(0, 20).map(k => (
                                        <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-secondary)] font-mono">
                                            {k}
                                        </span>
                                    ))}
                                    {keys.length > 20 && (
                                        <span className="text-[10px] text-[var(--text-tertiary)]">+{keys.length - 20} more</span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setIsCreatingNewEntity(false); setNewEntityName(''); }}
                            className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateNewEntity}
                            disabled={!newEntityName.trim() || isCreatingEntity}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreatingEntity ? (
                                <>
                                    <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus size={12} weight="bold" />
                                    Create
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Show selected entity info */}
            {saveEntityId && !isCreatingNewEntity && (() => {
                const selectedEntity = allEntities.find(e => e.id === saveEntityId);
                if (!selectedEntity) return null;
                const propCount = selectedEntity.properties?.length || 0;
                return (
                    <div className="p-2.5 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)]">
                        <div className="flex items-center gap-2 mb-1">
                            <Database size={12} className="text-[var(--text-secondary)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">{selectedEntity.name}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                            {propCount} {propCount === 1 ? 'property' : 'properties'}
                            {selectedEntity.description ? ` · ${selectedEntity.description}` : ''}
                        </p>
                    </div>
                );
            })()}
        </div>
    </NodeConfigSidePanel>

  );
};
