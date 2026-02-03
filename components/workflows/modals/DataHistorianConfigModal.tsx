/**
 * Data Historian Node Configuration Modal
 * Allows configuring Data Historian connection and historical queries
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';

interface DataHistorianConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  tags?: string[];
  startTime?: string;
  endTime?: string;
  aggregation?: string;
  availableConnections?: Array<{ id: string; name: string }>;
  onSave: (config: {
    dataHistorianConnectionId: string;
    dataHistorianTags: string[];
    dataHistorianStartTime: string;
    dataHistorianEndTime: string;
    dataHistorianAggregation: string;
  }) => void;
  onClose: () => void;
}

export const DataHistorianConfigModal: React.FC<DataHistorianConfigModalProps> = ({
  isOpen,
  connectionId,
  tags = [],
  startTime,
  endTime,
  aggregation = 'raw',
  availableConnections = [],
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [tagInput, setTagInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>(tags);
  const [startTimeValue, setStartTimeValue] = useState(startTime || '');
  const [endTimeValue, setEndTimeValue] = useState(endTime || '');
  const [aggregationValue, setAggregationValue] = useState(aggregation);

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setTagsList(tags || []);
      if (!startTime) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setStartTimeValue(yesterday.toISOString().slice(0, 16));
      } else {
        setStartTimeValue(startTime);
      }
      if (!endTime) {
        setEndTimeValue(new Date().toISOString().slice(0, 16));
      } else {
        setEndTimeValue(endTime);
      }
      setAggregationValue(aggregation || 'raw');
    }
  }, [isOpen, connectionId, tags, startTime, endTime, aggregation]);

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
    if (selectedConnectionId && tagsList.length > 0 && startTimeValue && endTimeValue) {
      onSave({
        dataHistorianConnectionId: selectedConnectionId,
        dataHistorianTags: tagsList,
        dataHistorianStartTime: new Date(startTimeValue).toISOString(),
        dataHistorianEndTime: new Date(endTimeValue).toISOString(),
        dataHistorianAggregation: aggregationValue,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && tagsList.length > 0 && startTimeValue && endTimeValue && new Date(startTimeValue) < new Date(endTimeValue);

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Data Historian Query"
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
            Data Historian Connection
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
              No Data Historian connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Tags to Query
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startTimeValue}
              onChange={(e) => setStartTimeValue(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              End Time
            </label>
            <input
              type="datetime-local"
              value={endTimeValue}
              onChange={(e) => setEndTimeValue(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Aggregation
          </label>
          <select
            value={aggregationValue}
            onChange={(e) => setAggregationValue(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="raw">Raw - No aggregation</option>
            <option value="avg">Average - Mean value per interval</option>
            <option value="min">Minimum - Lowest value per interval</option>
            <option value="max">Maximum - Highest value per interval</option>
            <option value="sum">Sum - Total value per interval</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            How to aggregate data points within each time interval
          </p>
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will query historical time-series data
            from the Data Historian system for the specified tags and time range. Use aggregation to reduce data volume for large queries.
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
