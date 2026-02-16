/**
 * Save Records Node Configuration Modal
 * Enhanced with time-series detection and auto-entity creation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Database, Clock, Sparkle } from '@phosphor-icons/react';

interface SaveRecordsConfigModalProps {
  isOpen: boolean;
  entityId?: string;
  saveMode?: 'insert' | 'upsert' | 'update';
  availableEntities?: Array<{ id: string; name: string }>;
  inputDataPreview?: any; // Preview of data that will be saved
  onSave: (config: {
    entityId: string;
    saveMode: 'insert' | 'upsert' | 'update';
    autoCreateEntity?: boolean;
    entityName?: string;
  }) => void;
  onClose: () => void;
}

/**
 * Detect if data appears to be time-series format
 */
function detectTimeSeriesFormat(data: any): { isTimeSeries: boolean; format?: string; fields?: string[] } {
  if (!data) return { isTimeSeries: false };
  
  const sample = Array.isArray(data) ? data[0] : data;
  if (!sample) return { isTimeSeries: false };
  
  // Check for timestamp
  const hasTimestamp = sample.timestamp || sample.createdAt || sample.time;
  
  // Check for OT node output structures
  const hasValues = sample.values && typeof sample.values === 'object';
  const hasTags = sample.tags && typeof sample.tags === 'object';
  const hasRegisters = sample.registers && typeof sample.registers === 'object';
  const hasTopicData = sample.topicData && typeof sample.topicData === 'object';
  const hasRaw = sample.raw && Array.isArray(sample.raw);
  const hasMetadata = sample.metadata && sample.metadata.connectionId;
  
  if (hasTimestamp && (hasValues || hasTags || hasRegisters || hasTopicData || hasRaw || hasMetadata)) {
    let format = 'Generic Time-Series';
    let fields: string[] = [];
    
    if (hasValues) {
      format = 'OPC UA Format';
      fields = Object.keys(sample.values);
    } else if (hasTags) {
      format = 'SCADA Format';
      fields = Object.keys(sample.tags);
    } else if (hasRegisters) {
      format = 'Modbus Format';
      fields = Object.keys(sample.registers);
    } else if (hasTopicData) {
      format = 'MQTT Format';
      fields = Object.keys(sample.topicData);
    } else if (hasRaw) {
      format = 'Raw Time-Series';
      fields = sample.raw.map((item: any) => item.nodeId || item.tag || item.address).filter(Boolean);
    }
    
    return { isTimeSeries: true, format, fields };
  }
  
  return { isTimeSeries: false };
}

export const SaveRecordsConfigModal: React.FC<SaveRecordsConfigModalProps> = ({
  isOpen,
  entityId,
  saveMode = 'insert',
  availableEntities = [],
  inputDataPreview,
  onSave,
  onClose,
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState(entityId || '');
  const [selectedSaveMode, setSelectedSaveMode] = useState<'insert' | 'upsert' | 'update'>(saveMode);
  const [autoCreateEntity, setAutoCreateEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');

  // Detect time-series format from preview data
  const timeSeriesInfo = useMemo(() => {
    return detectTimeSeriesFormat(inputDataPreview);
  }, [inputDataPreview]);

  useEffect(() => {
    if (isOpen) {
      setSelectedEntityId(entityId || '');
      setSelectedSaveMode(saveMode || 'insert');
      setAutoCreateEntity(false);
      
      // Auto-suggest entity name if time-series detected
      if (timeSeriesInfo.isTimeSeries && !entityId) {
        setNewEntityName(`${timeSeriesInfo.format || 'TimeSeries'} Data`);
      }
    }
  }, [isOpen, entityId, saveMode, timeSeriesInfo]);

  const handleSave = () => {
    if (autoCreateEntity) {
      if (!newEntityName.trim()) {
        return; // Entity name required
      }
      onSave({
        entityId: '', // Will be created
        saveMode: selectedSaveMode,
        autoCreateEntity: true,
        entityName: newEntityName.trim(),
      });
    } else {
      if (!selectedEntityId) {
        return; // Entity selection required
      }
      onSave({
        entityId: selectedEntityId,
        saveMode: selectedSaveMode,
        autoCreateEntity: false,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = autoCreateEntity 
    ? newEntityName.trim().length > 0 
    : selectedEntityId.length > 0;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Save to Database"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Time-Series Detection Banner */}
        {timeSeriesInfo.isTimeSeries && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock size={18} className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  Time-Series Data Detected
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  Format: {timeSeriesInfo.format}
                  {timeSeriesInfo.fields && timeSeriesInfo.fields.length > 0 && (
                    <span className="ml-2">
                      ({timeSeriesInfo.fields.length} field{timeSeriesInfo.fields.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
                {timeSeriesInfo.fields && timeSeriesInfo.fields.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {timeSeriesInfo.fields.slice(0, 5).map((field, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded"
                      >
                        {field}
                      </span>
                    ))}
                    {timeSeriesInfo.fields.length > 5 && (
                      <span className="px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                        +{timeSeriesInfo.fields.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Entity Selection */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Save To
          </label>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="existing-entity"
                checked={!autoCreateEntity}
                onChange={() => setAutoCreateEntity(false)}
                className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <label htmlFor="existing-entity" className="flex-1 text-sm text-[var(--text-primary)] cursor-pointer">
                Existing Entity
              </label>
            </div>
            
            {!autoCreateEntity && (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] ml-7"
              >
                <option value="">Select an entity...</option>
                {availableEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="create-entity"
                checked={autoCreateEntity}
                onChange={() => setAutoCreateEntity(true)}
                className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <label htmlFor="create-entity" className="flex-1 text-sm text-[var(--text-primary)] cursor-pointer flex items-center gap-2">
                <Sparkle size={14} className="text-[var(--accent-primary)]" />
                Create New Entity {timeSeriesInfo.isTimeSeries && <span className="text-xs text-[var(--text-tertiary)]">(Time-Series Optimized)</span>}
              </label>
            </div>
            
            {autoCreateEntity && (
              <div className="ml-7 space-y-2">
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="Entity name..."
                  className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                />
                {timeSeriesInfo.isTimeSeries && (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    A time-series optimized entity will be created with timestamp and detected fields.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Mode */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Save Mode
          </label>
          <select
            value={selectedSaveMode}
            onChange={(e) => setSelectedSaveMode(e.target.value as 'insert' | 'upsert' | 'update')}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="insert">Insert - Always create new records</option>
            <option value="upsert">Upsert - Update if exists, insert if not</option>
            <option value="update">Update - Only update existing records</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            {selectedSaveMode === 'insert' && 'New records will always be created, even if duplicates exist.'}
            {selectedSaveMode === 'upsert' && 'Records will be updated if they exist (by ID), or created if they don\'t.'}
            {selectedSaveMode === 'update' && 'Only existing records will be updated. New records will be skipped.'}
          </p>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> {
              timeSeriesInfo.isTimeSeries
                ? 'Time-series data will be automatically normalized and optimized for storage. Timestamp will be preserved.'
                : 'Data will be saved as records in the selected entity. Make sure the entity has matching properties.'
            }
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
