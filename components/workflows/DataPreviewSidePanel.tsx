/**
 * DataPreviewSidePanel - Panel para previsualizar datos de nodos
 * 
 * Muestra los datos de entrada y salida de un nodo en formato tabla.
 */

import React, { useState } from 'react';
import {
  X,
  Table,
  ArrowRight,
  CaretLeft,
  CaretRight,
  Download,
  Copy,
  Check,
} from '@phosphor-icons/react';
import { useWorkflowStore, useNodeConfigStore } from '../../stores';

// ============================================================================
// TYPES
// ============================================================================

interface DataPreviewSidePanelProps {
  isOpen: boolean;
  nodeId: string | null;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DataPreviewSidePanel: React.FC<DataPreviewSidePanelProps> = ({
  isOpen,
  nodeId,
  onClose,
}) => {
  const nodes = useWorkflowStore(state => state.nodes);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('output');
  const [currentPage, setCurrentPage] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const pageSize = 10;
  
  const node = nodes.find(n => n.id === nodeId);
  
  if (!isOpen || !node) return null;
  
  const inputData = node.inputData || node.data || [];
  const outputData = node.outputData || node.data || [];
  const currentData = activeTab === 'input' ? inputData : outputData;
  
  // Convert to array if needed
  const dataArray = Array.isArray(currentData) ? currentData : [currentData];
  const totalPages = Math.ceil(dataArray.length / pageSize);
  const pageData = dataArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  
  // Get columns from first row
  const columns = pageData.length > 0 && typeof pageData[0] === 'object'
    ? Object.keys(pageData[0])
    : [];
  
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${node.label || node.type}-${activeTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="fixed right-0 top-[63px] bottom-0 w-[500px] bg-[var(--bg-card)] border-l border-[var(--border-light)] flex flex-col z-40 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <Table size={18} className="text-[#256A65]" />
          <span className="font-medium text-[var(--text-primary)]">
            {node.label || node.type}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
            {dataArray.length} rows
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check size={16} className="text-emerald-500" />
            ) : (
              <Copy size={16} className="text-[var(--text-secondary)]" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Download JSON"
          >
            <Download size={16} className="text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors ml-2"
          >
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-light)]">
        <button
          onClick={() => { setActiveTab('input'); setCurrentPage(0); }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'input'
              ? 'text-[#256A65] border-b-2 border-[#256A65] bg-[#256A65]/5'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Input Data
        </button>
        <button
          onClick={() => { setActiveTab('output'); setCurrentPage(0); }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'output'
              ? 'text-[#256A65] border-b-2 border-[#256A65] bg-[#256A65]/5'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Output Data
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {dataArray.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Table size={48} className="text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">
              No data available
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Run the workflow to see {activeTab} data
            </p>
          </div>
        ) : columns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] border-b border-[var(--border-light)] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row: any, idx: number) => (
                  <tr
                    key={idx}
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-[var(--text-primary)] border-b border-[var(--border-light)] max-w-[200px] truncate"
                        title={String(row[col])}
                      >
                        {typeof row[col] === 'object'
                          ? JSON.stringify(row[col])
                          : String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] p-4 rounded-lg overflow-auto">
            {JSON.stringify(currentData, null, 2)}
          </pre>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-light)]">
          <span className="text-xs text-[var(--text-tertiary)]">
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, dataArray.length)} of {dataArray.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors disabled:opacity-50"
            >
              <CaretLeft size={16} className="text-[var(--text-secondary)]" />
            </button>
            <span className="text-xs text-[var(--text-secondary)] px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors disabled:opacity-50"
            >
              <CaretRight size={16} className="text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPreviewSidePanel;
