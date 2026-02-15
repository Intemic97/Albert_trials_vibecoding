/**
 * ExcelConfigPanel
 * Extracted from Workflows.tsx lines 11193-11303
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Table, CloudArrowUp, ChatText, Upload } from '@phosphor-icons/react';

interface ExcelConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  handleExcelFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  excelFile: File | null;
  excelPreviewData: any;
  isParsingExcel: boolean;
}

export const ExcelConfigPanel: React.FC<ExcelConfigPanelProps> = ({
  nodeId, node, nodes, onSave, onClose, openFeedbackPopup,
  handleExcelFileChange, excelFile, excelPreviewData, isParsingExcel
}) => {
  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={onClose}
        title="Excel/CSV Input"
        icon={Table}
        width="w-[400px]"
    >
        <div className="space-y-5">
            {/* File Upload Area */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Upload File
                </label>
                <div className="relative">
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleExcelFileChange}
                        className="hidden"
                        id="excel-file-input"
                        disabled={isParsingExcel}
                    />
                    <label
                        htmlFor="excel-file-input"
                        className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            isParsingExcel
                                ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)] cursor-wait'
                                : 'border-[var(--border-medium)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        {isParsingExcel ? (
                            <>
                                <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-[var(--text-secondary)]">Parsing file...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="text-[var(--text-secondary)]" size={18} />
                                <div className="text-center">
                                    <span className="text-xs text-[var(--text-primary)] font-medium">Click to upload</span>
                                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">CSV, XLS, XLSX supported</p>
                                </div>
                            </>
                        )}
                    </label>
                </div>
            </div>

            {/* Preview Section */}
            {excelPreviewData && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-[var(--text-primary)]">
                            Preview
                        </label>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                            {excelPreviewData.rowCount} total rows • {excelPreviewData.headers.length} columns
                        </span>
                    </div>
                    <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-48">
                            <table className="w-full text-xs">
                                <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                                    <tr>
                                        {excelPreviewData.headers.map((header, i) => (
                                            <th key={i} className="px-2 py-1.5 text-left font-medium text-[var(--text-primary)] whitespace-nowrap text-xs">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {excelPreviewData.data.map((row, i) => (
                                        <tr key={i} className="hover:bg-[var(--bg-tertiary)]">
                                            {excelPreviewData.headers.map((header, j) => (
                                                <td key={j} className="px-2 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate text-xs">
                                                    {row[header] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {excelPreviewData.rowCount > 5 && (
                            <div className="px-3 py-1.5 border-t border-[var(--border-light)] text-[10px] text-[var(--text-secondary)] text-center">
                                Showing first 5 of {excelPreviewData.rowCount} rows
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Current File Info */}
            {nodes.find(n => n.id === nodeId)?.config?.fileName && !excelFile && (
                <div className="p-3 border border-[var(--border-light)] rounded-lg">
                    <div className="flex items-center gap-2">
                        <Table className="text-[var(--text-secondary)]" size={14} />
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                            {nodes.find(n => n.id === nodeId)?.config?.fileName}
                        </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {nodes.find(n => n.id === nodeId)?.config?.rowCount} rows loaded
                    </p>
                </div>
            )}
        </div>
    </NodeConfigSidePanel>

  );
};
