/**
 * PdfConfigPanel
 * Extracted from Workflows.tsx lines 11306-11402
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { FileText, CloudArrowUp, ChatText, Upload } from '@phosphor-icons/react';

interface PdfConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
  handlePdfFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pdfFile: File | null;
  pdfPreviewData: any;
  isParsingPdf: boolean;
}

export const PdfConfigPanel: React.FC<PdfConfigPanelProps> = ({
  nodeId, node, nodes, onSave, onClose, openFeedbackPopup,
  handlePdfFileChange, pdfFile, pdfPreviewData, isParsingPdf
}) => {
  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={onClose}
        title="PDF Input"
        icon={FileText}
        footer={
            <button
                onClick={onClose}
                disabled={!pdfFile && !nodes.find(n => n.id === nodeId)?.config?.fileName}
                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Done
            </button>
        }
    >
        <div className="space-y-5">
            {/* File Upload Area */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Upload PDF File
                </label>
                <div className="relative">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfFileChange}
                        className="hidden"
                        id="pdf-file-input"
                        disabled={isParsingPdf}
                    />
                    <label
                        htmlFor="pdf-file-input"
                        className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            isParsingPdf
                                ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)] cursor-wait'
                                : 'border-[var(--border-medium)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        {isParsingPdf ? (
                            <>
                                <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-[var(--text-secondary)]">Parsing PDF...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="text-[var(--text-secondary)]" size={18} />
                                <div className="text-center">
                                    <span className="text-xs text-[var(--text-primary)] font-medium">Click to upload</span>
                                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">PDF files supported</p>
                                </div>
                            </>
                        )}
                    </label>
                </div>
            </div>

            {/* Preview Section */}
            {pdfPreviewData && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-[var(--text-primary)]">
                            Extracted Text Preview
                        </label>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                            {pdfPreviewData.pages} pages
                        </span>
                    </div>
                    <div className="border border-[var(--border-light)] rounded-lg p-3 max-h-64 overflow-y-auto">
                        <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
                            {pdfPreviewData.text.substring(0, 1000)}
                            {pdfPreviewData.text.length > 1000 && '\n\n... (text truncated for preview)'}
                        </pre>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                        Full text ({pdfPreviewData.text.length} characters) will be available to the workflow
                    </p>
                </div>
            )}

            {/* Current File Info */}
            {nodes.find(n => n.id === nodeId)?.config?.fileName && !pdfFile && (
                <div className="p-3 border border-[var(--border-light)] rounded-lg">
                    <div className="flex items-center gap-2">
                        <FileText className="text-[var(--text-secondary)]" size={14} />
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                            {nodes.find(n => n.id === nodeId)?.config?.fileName}
                        </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {nodes.find(n => n.id === nodeId)?.config?.pages} pages • {nodes.find(n => n.id === nodeId)?.config?.pdfText?.length || 0} characters
                    </p>
                </div>
            )}
        </div>
    </NodeConfigSidePanel>

  );
};
