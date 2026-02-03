/**
 * SCADA Node Configuration Modal
 * Allows configuring SCADA connection and tags
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';

interface ScadaConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  tags?: string[];
  pollingInterval?: number;
  availableConnections?: Array<{ id: string; name: string }>;
  onSave: (config: {
    scadaConnectionId: string;
    scadaTags: string[];
    scadaPollingInterval: number;
  }) => void;
  onClose: () => void;
}

export const ScadaConfigModal: React.FC<ScadaConfigModalProps> = ({
  isOpen,
  connectionId,
  tags = [],
  pollingInterval = 5000,
  availableConnections = [],
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [tagInput, setTagInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>(tags);
  const [pollInterval, setPollInterval] = useState(pollingInterval);

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setTagsList(tags || []);
      setPollInterval(pollingInterval || 5000);
    }
  }, [isOpen, connectionId, tags, pollingInterval]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tagsList.includes(tagInput.trim())) {
      setTagsList([...tagsList, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTagsList(tagsList.filter(t => t !== tag));
  };

  const handleSave = () => {
    if (selectedConnectionId && tagsList.length > 0) {
      onSave({
        scadaConnectionId: selectedConnectionId,
        scadaTags: tagsList,
        scadaPollingInterval: pollInterval,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && tagsList.length > 0 && pollInterval > 0;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure SCADA Data"
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
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            SCADA Connection
          </label>
          <select
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="">Select a connection</option>
            {availableConnections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
              </option>
            ))}
          </select>
          {availableConnections.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
              No SCADA connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            SCADA Tags
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Tank01.Level"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {tagsList.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {tagsList.map((tag, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]"
                >
                  <code className="text-xs text-[var(--text-secondary)] font-mono flex-1 truncate">
                    {tag}
                  </code>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Polling Interval (ms)
          </label>
          <input
            type="number"
            value={pollInterval}
            onChange={(e) => setPollInterval(parseInt(e.target.value) || 0)}
            min="100"
            step="100"
            placeholder="5000"
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            How often to poll the SCADA system (minimum 100ms)
          </p>
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will connect to the SCADA system
            and read the specified tags at the configured interval. Data will be output as time-series records.
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
