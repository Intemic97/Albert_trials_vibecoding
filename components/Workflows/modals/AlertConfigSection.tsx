/**
 * Alert Configuration Section Component
 * Reusable component for configuring alerts in OT node modals
 */

import React, { useState } from 'react';
import { Plus, X, Warning, Trash } from '@phosphor-icons/react';

interface ThresholdConfig {
  min?: number;
  max?: number;
  operator: 'gt' | 'lt' | 'range' | 'warning_gt' | 'warning_lt';
}

interface AlertConfig {
  enabled: boolean;
  cooldown?: number;
  thresholds?: Record<string, ThresholdConfig>;
}

interface AlertConfigSectionProps {
  config: AlertConfig | undefined;
  availableFields: string[]; // Field names that can have alerts (e.g., nodeIds, topics, addresses)
  onChange: (config: AlertConfig) => void;
}

export const AlertConfigSection: React.FC<AlertConfigSectionProps> = ({
  config,
  availableFields,
  onChange,
}) => {
  const [enabled, setEnabled] = useState(config?.enabled || false);
  const [cooldown, setCooldown] = useState(config?.cooldown || 60000);
  const [thresholds, setThresholds] = useState<Record<string, ThresholdConfig>>(
    config?.thresholds || {}
  );
  const [newField, setNewField] = useState('');
  const [showAddThreshold, setShowAddThreshold] = useState(false);

  const handleToggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    onChange({
      enabled: newEnabled,
      cooldown,
      thresholds: newEnabled ? thresholds : undefined,
    });
  };

  const handleCooldownChange = (value: number) => {
    const newCooldown = Math.max(1000, value); // Minimum 1 second
    setCooldown(newCooldown);
    onChange({
      enabled,
      cooldown: newCooldown,
      thresholds,
    });
  };

  const handleAddThreshold = () => {
    if (newField && !thresholds[newField]) {
      const newThresholds = {
        ...thresholds,
        [newField]: {
          operator: 'range',
          min: 0,
          max: 100,
        },
      };
      setThresholds(newThresholds);
      setNewField('');
      setShowAddThreshold(false);
      onChange({
        enabled,
        cooldown,
        thresholds: newThresholds,
      });
    }
  };

  const handleRemoveThreshold = (fieldName: string) => {
    const newThresholds = { ...thresholds };
    delete newThresholds[fieldName];
    setThresholds(newThresholds);
    onChange({
      enabled,
      cooldown,
      thresholds: newThresholds,
    });
  };

  const handleThresholdChange = (
    fieldName: string,
    updates: Partial<ThresholdConfig>
  ) => {
    const newThresholds = {
      ...thresholds,
      [fieldName]: {
        ...thresholds[fieldName],
        ...updates,
      },
    };
    setThresholds(newThresholds);
    onChange({
      enabled,
      cooldown,
      thresholds: newThresholds,
    });
  };

  return (
    <div className="border-t border-[var(--border-light)] pt-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Warning size={18} className="text-amber-500" weight="fill" />
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            Alert Configuration
          </label>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggleEnabled}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
        </label>
      </div>

      {enabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Alert Cooldown (ms)
            </label>
            <input
              type="number"
              value={cooldown}
              onChange={(e) => handleCooldownChange(parseInt(e.target.value) || 60000)}
              min="1000"
              step="1000"
              className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Minimum time between alerts for the same condition (default: 60 seconds)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Thresholds
              </label>
              {!showAddThreshold && (
                <button
                  onClick={() => setShowAddThreshold(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors"
                >
                  <Plus size={14} />
                  Add Threshold
                </button>
              )}
            </div>

            {showAddThreshold && (
              <div className="flex gap-2 mb-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                <select
                  value={newField}
                  onChange={(e) => setNewField(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                >
                  <option value="">Select field...</option>
                  {availableFields
                    .filter((f) => !thresholds[f])
                    .map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddThreshold}
                  disabled={!newField}
                  className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddThreshold(false);
                    setNewField('');
                  }}
                  className="px-2 py-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {Object.keys(thresholds).length === 0 && !showAddThreshold && (
              <p className="text-xs text-[var(--text-tertiary)] py-2">
                No thresholds configured. Click "Add Threshold" to set up alerts.
              </p>
            )}

            {Object.entries(thresholds).map(([fieldName, threshold]) => (
              <div
                key={fieldName}
                className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {fieldName}
                  </span>
                  <button
                    onClick={() => handleRemoveThreshold(fieldName)}
                    className="p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Operator
                  </label>
                  <select
                    value={threshold.operator}
                    onChange={(e) =>
                      handleThresholdChange(fieldName, {
                        operator: e.target.value as ThresholdConfig['operator'],
                      })
                    }
                    className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  >
                    <option value="range">Range (min ≤ value ≤ max)</option>
                    <option value="gt">Greater Than (value &gt; max)</option>
                    <option value="lt">Less Than (value &lt; min)</option>
                    <option value="warning_gt">Warning: Approaching Max (value &gt; 80% max)</option>
                    <option value="warning_lt">Warning: Approaching Min (value &lt; 120% min)</option>
                  </select>
                </div>

                {(threshold.operator === 'range' ||
                  threshold.operator === 'lt' ||
                  threshold.operator === 'warning_lt') && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Minimum Value
                    </label>
                    <input
                      type="number"
                      value={threshold.min || ''}
                      onChange={(e) =>
                        handleThresholdChange(fieldName, {
                          min: parseFloat(e.target.value) || undefined,
                        })
                      }
                      step="any"
                      className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    />
                  </div>
                )}

                {(threshold.operator === 'range' ||
                  threshold.operator === 'gt' ||
                  threshold.operator === 'warning_gt') && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Maximum Value
                    </label>
                    <input
                      type="number"
                      value={threshold.max || ''}
                      onChange={(e) =>
                        handleThresholdChange(fieldName, {
                          max: parseFloat(e.target.value) || undefined,
                        })
                      }
                      step="any"
                      className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <span className="font-medium">Note:</span> Alerts will be triggered when values exceed
              the configured thresholds. Notifications will be sent and alerts will be saved to the
              database for review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
