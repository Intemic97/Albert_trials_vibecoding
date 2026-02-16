/**
 * DataPreviewModal
 * Extracted from Workflows.tsx - Data Preview Modal (~388 lines)
 * Shows input/output data for a node in a table format with tabs for split/condition nodes.
 */

import React from 'react';
import { Database, WarningCircle as AlertCircle, X } from '@phosphor-icons/react';

interface DataPreviewModalProps {
  nodes: any[];
  viewingDataNodeId: string | null;
  onClose: () => void;
  dataViewTab: 'input' | 'output';
  setDataViewTab: (tab: 'input' | 'output') => void;
  splitViewTab: 'input' | 'outputA' | 'outputB';
  setSplitViewTab: (tab: 'input' | 'outputA' | 'outputB') => void;
}

// Helper function to normalize data to array format
const normalizeToArray = (data: any): any => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (data.outputA !== undefined || data.outputB !== undefined) {
      return data; // splitColumns format
    }
    return [data];
  }
  return [{ value: data }];
};

// Flatten nested objects into flat key-value pairs
const flattenObject = (obj: any, prefix: string = ''): Record<string, any> => {
  const flattened: Record<string, any> = {};

  if (obj === null || obj === undefined) {
    return { [prefix || 'value']: null };
  }

  if (Array.isArray(obj)) {
    flattened[prefix || 'value'] = `[${obj.length} items]`;
    if (obj.length > 0 && obj.length <= 5) {
      obj.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(flattened, flattenObject(item, `${prefix || 'item'}[${idx}].`));
        } else {
          flattened[`${prefix || 'item'}[${idx}]`] = item;
        }
      });
    }
    return flattened;
  }

  if (typeof obj !== 'object') {
    return { [prefix || 'value']: obj };
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}${key}` : key;
      const value = obj[key];

      if (value === null || value === undefined) {
        flattened[newKey] = null;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          flattened[newKey] = '[]';
        } else if (value.length <= 3 && value.every(v => typeof v !== 'object' || v === null)) {
          flattened[newKey] = `[${value.join(', ')}]`;
        } else {
          flattened[newKey] = `[${value.length} items]`;
        }
      } else if (typeof value === 'object') {
        Object.assign(flattened, flattenObject(value, `${newKey}.`));
      } else {
        flattened[newKey] = value;
      }
    }
  }

  return flattened;
};

const getAllKeys = (data: any[]): string[] => {
  const keysSet = new Set<string>();
  data.forEach(record => {
    if (record && typeof record === 'object') {
      Object.keys(record).forEach(key => keysSet.add(key));
    }
  });
  return Array.from(keysSet).sort();
};

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  nodes, viewingDataNodeId, onClose, dataViewTab, setDataViewTab, splitViewTab, setSplitViewTab
}) => {
  if (!viewingDataNodeId) return null;

  const node = nodes.find(n => n.id === viewingDataNodeId);
  if (!node) return null;

  const isSplitColumnsNode = node.type === 'splitColumns';
  const isConditionWithBranches = node.type === 'condition' &&
    node.outputData &&
    typeof node.outputData === 'object' &&
    (node.outputData.trueRecords !== undefined || node.outputData.falseRecords !== undefined);

  let rawInputData = node.inputData;
  let rawOutputData = node.outputData || node.data;

  const nodeInputData = normalizeToArray(rawInputData);
  const nodeOutputData = normalizeToArray(rawOutputData);

  const hasInput = rawInputData !== undefined && rawInputData !== null && Array.isArray(nodeInputData) && nodeInputData.length > 0;
  const hasOutput = !isSplitColumnsNode && !isConditionWithBranches && rawOutputData !== undefined && rawOutputData !== null && Array.isArray(nodeOutputData) && nodeOutputData.length > 0;
  const hasOutputA = isSplitColumnsNode && nodeOutputData?.outputA?.length > 0;
  const hasOutputB = isSplitColumnsNode && nodeOutputData?.outputB?.length > 0;

  const hasTrueRecords = isConditionWithBranches && Array.isArray(rawOutputData?.trueRecords) && rawOutputData.trueRecords.length > 0;
  const hasFalseRecords = isConditionWithBranches && Array.isArray(rawOutputData?.falseRecords) && rawOutputData.falseRecords.length > 0;

  if (!hasInput && !hasOutput && !hasOutputA && !hasOutputB && !hasTrueRecords && !hasFalseRecords) return null;

  const effectiveTab = !isSplitColumnsNode
    ? ((dataViewTab === 'input' && hasInput) || (dataViewTab === 'output' && hasOutput)
      ? dataViewTab
      : (hasOutput ? 'output' : (hasInput ? 'input' : 'output')))
    : dataViewTab;

  // Determine display data
  let displayData: any[];
  if (isSplitColumnsNode) {
    displayData = splitViewTab === 'input'
      ? nodeInputData
      : splitViewTab === 'outputA'
        ? nodeOutputData?.outputA
        : nodeOutputData?.outputB;
  } else if (isConditionWithBranches) {
    displayData = splitViewTab === 'input'
      ? nodeInputData
      : splitViewTab === 'outputA'
        ? rawOutputData?.trueRecords
        : rawOutputData?.falseRecords;
  } else {
    displayData = effectiveTab === 'input' ? nodeInputData : nodeOutputData;
  }

  if (!Array.isArray(displayData)) {
    if (displayData && typeof displayData === 'object') {
      displayData = [displayData];
    } else {
      displayData = [];
    }
  }

  const MAX_PREVIEW_ROWS = 500;
  const totalRows = displayData?.length || 0;
  const limitedData = displayData?.slice(0, MAX_PREVIEW_ROWS) || [];
  const isLimited = totalRows > MAX_PREVIEW_ROWS;

  const flattenedData = limitedData.map(record => flattenObject(record));
  const allKeys = getAllKeys(flattenedData);

  const tabButtonClass = (active: boolean) =>
    `flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${active
      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40 backdrop-blur-sm pointer-events-none" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-[95vw] h-[90vh] overflow-hidden flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
              <Database className="text-[var(--text-secondary)]" size={18} />
            </div>
            <div>
              <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                {node.label} - Data Preview
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">View node data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content with tabs */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          {/* Tabs */}
          {isSplitColumnsNode ? (
            <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
              {hasInput && (
                <button onClick={() => setSplitViewTab('input')} className={tabButtonClass(splitViewTab === 'input')}>
                  Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                </button>
              )}
              {hasOutputA && (
                <button onClick={() => setSplitViewTab('outputA')} className={tabButtonClass(splitViewTab === 'outputA')}>
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Output A ({nodeOutputData?.outputA?.length || 0})
                  </span>
                </button>
              )}
              {hasOutputB && (
                <button onClick={() => setSplitViewTab('outputB')} className={tabButtonClass(splitViewTab === 'outputB')}>
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Output B ({nodeOutputData?.outputB?.length || 0})
                  </span>
                </button>
              )}
            </div>
          ) : isConditionWithBranches ? (
            <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
              {hasInput && (
                <button onClick={() => setSplitViewTab('input')} className={tabButtonClass(splitViewTab === 'input')}>
                  Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                </button>
              )}
              {hasTrueRecords && (
                <button onClick={() => setSplitViewTab('outputA')} className={tabButtonClass(splitViewTab === 'outputA')}>
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    True ({rawOutputData?.trueRecords?.length || 0})
                  </span>
                </button>
              )}
              {hasFalseRecords && (
                <button onClick={() => setSplitViewTab('outputB')} className={tabButtonClass(splitViewTab === 'outputB')}>
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    False ({rawOutputData?.falseRecords?.length || 0})
                  </span>
                </button>
              )}
            </div>
          ) : (
            (hasInput && hasOutput) ? (
              <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
                <button onClick={() => setDataViewTab('input')} className={tabButtonClass(effectiveTab === 'input')}>
                  Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                </button>
                <button onClick={() => setDataViewTab('output')} className={tabButtonClass(effectiveTab === 'output')}>
                  Output ({Array.isArray(nodeOutputData) ? nodeOutputData.length : 0})
                </button>
              </div>
            ) : (
              <div className="mb-4 shrink-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {hasInput ? `Input (${Array.isArray(nodeInputData) ? nodeInputData.length : 0})` : `Output (${Array.isArray(nodeOutputData) ? nodeOutputData.length : 0})`}
                </div>
              </div>
            )
          )}

          {/* Table Container */}
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {displayData && displayData.length > 0 && allKeys.length > 0 ? (
              <>
                {isLimited && (
                  <div className="bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[var(--text-secondary)] px-4 py-2.5 rounded-lg mb-4 text-sm flex items-center gap-2 shrink-0">
                    <AlertCircle size={16} />
                    <span>Showing first {MAX_PREVIEW_ROWS.toLocaleString()} of {totalRows.toLocaleString()} rows</span>
                  </div>
                )}
                <div className="border border-[var(--border-light)] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-sm">
                  <div className="overflow-auto max-h-full">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-light)] sticky top-0 z-10">
                        <tr>
                          {allKeys.map(key => (
                            <th key={key} className="px-4 py-3 text-left font-medium text-[var(--text-primary)] whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {flattenedData.map((record: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                            {allKeys.map((key, vidx) => {
                              const value = record?.[key];
                              const displayValue = value === null || value === undefined
                                ? '—'
                                : typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value);

                              return (
                                <td key={`${idx}-${vidx}`} className="px-4 py-3 text-[var(--text-secondary)]">
                                  <div className="max-w-[400px] break-words" title={displayValue}>
                                    <span className={value === null || value === undefined ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>
                                      {displayValue}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {totalRows > 0 && (
                  <div className="mt-4 text-sm text-[var(--text-secondary)] text-center shrink-0">
                    <span className="font-medium">{totalRows.toLocaleString()}</span> {totalRows === 1 ? 'row' : 'rows'} total
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Database size={32} className="mx-auto text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

