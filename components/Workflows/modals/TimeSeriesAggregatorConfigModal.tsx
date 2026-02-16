/**
 * Time-Series Aggregator Node Configuration Modal
 * Allows configuring time-series data aggregation parameters
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';

interface TimeSeriesAggregatorConfigModalProps {
  isOpen: boolean;
  aggregationType?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  interval?: string;
  fields?: string[];
  availableFields?: string[];
  onSave: (config: {
    timeSeriesAggregationType: 'avg' | 'min' | 'max' | 'sum' | 'count';
    timeSeriesInterval: string;
    timeSeriesFields?: string[];
  }) => void;
  onClose: () => void;
}

export const TimeSeriesAggregatorConfigModal: React.FC<TimeSeriesAggregatorConfigModalProps> = ({
  isOpen,
  aggregationType = 'avg',
  interval = '5m',
  fields = [],
  availableFields = [],
  onSave,
  onClose,
}) => {
  const [aggType, setAggType] = useState<'avg' | 'min' | 'max' | 'sum' | 'count'>(aggregationType);
  const [intervalValue, setIntervalValue] = useState(interval);
  const [fieldsList, setFieldsList] = useState<string[]>(fields);
  const [fieldInput, setFieldInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAggType(aggregationType || 'avg');
      setIntervalValue(interval || '5m');
      setFieldsList(fields || []);
    }
  }, [isOpen, aggregationType, interval, fields]);

  const handleAddField = () => {
    if (fieldInput.trim() && !fieldsList.includes(fieldInput.trim())) {
      setFieldsList([...fieldsList, fieldInput.trim()]);
      setFieldInput('');
    }
  };

  const handleRemoveField = (field: string) => {
    setFieldsList(fieldsList.filter(f => f !== field));
  };

  const handleSelectAvailableField = (field: string) => {
    if (!fieldsList.includes(field)) {
      setFieldsList([...fieldsList, field]);
    }
  };

  const handleSave = () => {
    if (intervalValue.trim()) {
      onSave({
        timeSeriesAggregationType: aggType,
        timeSeriesInterval: intervalValue.trim(),
        timeSeriesFields: fieldsList.length > 0 ? fieldsList : undefined,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = intervalValue.trim() && /^\d+[smhd]$/.test(intervalValue.trim());

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Time-Series Aggregator"
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
            Aggregation Type
          </label>
          <select
            value={aggType}
            onChange={(e) => setAggType(e.target.value as 'avg' | 'min' | 'max' | 'sum' | 'count')}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="avg">Average - Mean value per interval</option>
            <option value="min">Minimum - Lowest value per interval</option>
            <option value="max">Maximum - Highest value per interval</option>
            <option value="sum">Sum - Total value per interval</option>
            <option value="count">Count - Number of data points per interval</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            How to aggregate multiple data points within each time interval
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Time Interval
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={intervalValue}
              onChange={(e) => setIntervalValue(e.target.value)}
              placeholder="5m"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <div className="flex gap-1">
              {['1m', '5m', '15m', '1h', '1d'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setIntervalValue(preset)}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                    intervalValue === preset
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          {!isValid && intervalValue && (
            <p className="text-xs text-red-400 mt-1.5">
              Format: number + unit (s=seconds, m=minutes, h=hours, d=days). Example: 5m, 1h, 30s
            </p>
          )}
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Time interval for aggregation (e.g., 5m = 5 minutes, 1h = 1 hour)
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Fields to Aggregate (Optional)
          </label>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">
            Leave empty to aggregate all numeric fields. Specify fields to aggregate only selected ones.
          </p>
          
          {availableFields.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-[var(--text-secondary)] mb-1.5">Available fields from input:</p>
              <div className="flex flex-wrap gap-1.5">
                {availableFields.map((field) => (
                  <button
                    key={field}
                    onClick={() => handleSelectAvailableField(field)}
                    disabled={fieldsList.includes(field)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      fieldsList.includes(field)
                        ? 'bg-[var(--accent-primary)] text-white cursor-not-allowed'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)]'
                    }`}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={fieldInput}
              onChange={(e) => setFieldInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddField()}
              placeholder="temperature"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={handleAddField}
              disabled={!fieldInput.trim()}
              className="px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {fieldsList.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {fieldsList.map((field, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]"
                >
                  <code className="text-xs text-[var(--text-secondary)] font-mono flex-1 truncate">
                    {field}
                  </code>
                  <button
                    onClick={() => handleRemoveField(field)}
                    className="ml-2 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node aggregates time-series data points
            within the specified time intervals. Use this to reduce data volume, calculate statistics, or prepare data for visualization.
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
