/**
 * ScheduleConfigPanel
 * Extracted from Workflows.tsx lines 13044-13093
 */

import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

interface ScheduleConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
}

export const ScheduleConfigPanel: React.FC<ScheduleConfigPanelProps> = ({
  nodeId, node, onSave, onClose
}) => {
  const [scheduleIntervalValue, setScheduleIntervalValue] = useState(node?.config?.scheduleInterval?.toString() || '5');
  const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<'minutes' | 'hours' | 'days'>(node?.config?.scheduleUnit || 'minutes');
  const [scheduleEnabled, setScheduleEnabled] = useState(node?.config?.scheduleEnabled !== false);

  const handleSave = () => {
    onSave(nodeId, {
      scheduleInterval: parseInt(scheduleIntervalValue) || 5,
      scheduleUnit: scheduleIntervalUnit,
      scheduleEnabled,
    }, `Schedule: ${scheduleIntervalValue} ${scheduleIntervalUnit}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl p-6 w-[400px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-[var(--text-primary)]">Schedule Workflow</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors">
            <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Run workflow every</label>
            <div className="flex gap-2">
              <input type="number" min={1} max={999} value={scheduleIntervalValue}
                onChange={(e) => setScheduleIntervalValue(e.target.value)}
                className="w-20 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]" />
              <select value={scheduleIntervalUnit}
                onChange={(e) => setScheduleIntervalUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} className="rounded border-[var(--border-light)]" />
            <span className="text-sm text-[var(--text-primary)]">Schedule is active</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium">Save</button>
            <button onClick={onClose} className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};
