/**
 * TemplatePreviewModal
 * Extracted from Workflows.tsx - Template Preview Modal (~170 lines)
 */

import React from 'react';
import { Eye, X, Copy, ArrowRight } from '@phosphor-icons/react';

interface TemplatePreviewModalProps {
  template: any | null;
  onClose: () => void;
  copyTemplateToWorkflows: (template: any) => void;
  isCopyingTemplate: boolean;
  getNodeIcon: (type: string) => any;
  getNodeIconBg: (type: string) => string;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template, onClose, copyTemplateToWorkflows, isCopyingTemplate,
  getNodeIcon, getNodeIconBg
}) => {
  if (!template) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-light)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                <Eye size={20} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Template Preview</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{template.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview Canvas */}
        <div className="overflow-hidden bg-[var(--bg-tertiary)] relative border-b border-[var(--border-light)]" style={{ height: '400px' }}>
          <div
            className="absolute inset-0 overflow-auto pt-4 px-8 pb-8 custom-scrollbar"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          >
            {/* SVG Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '900px', minHeight: '400px' }}>
              {template.connections.map((conn: any) => {
                const fromNode = template.nodes.find((n: any) => n.id === conn.fromNodeId);
                const toNode = template.nodes.find((n: any) => n.id === conn.toNodeId);
                if (!fromNode || !toNode) return null;

                const padding = 16;
                const nodeHeight = 52;
                const nodeWidth = 140;

                const startX = fromNode.x + nodeWidth + padding;
                const startY = fromNode.y + (nodeHeight / 2) + padding;
                const endX = toNode.x + padding;
                const endY = toNode.y + (nodeHeight / 2) + padding;
                const midX = (startX + endX) / 2;

                let strokeColor = '#cbd5e1';
                if (conn.outputType === 'true') strokeColor = '#22c55e';
                if (conn.outputType === 'false') strokeColor = '#ef4444';

                return (
                  <g key={conn.id}>
                    <path
                      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                      stroke={strokeColor}
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray="5 4"
                    />
                    <circle cx={endX} cy={endY} r="4" fill={strokeColor} />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            <div className="relative" style={{ minWidth: '900px', minHeight: '400px' }}>
              {template.nodes.map((node: any) => {
                const IconComponent = getNodeIcon(node.type);
                const iconBg = getNodeIconBg(node.type);

                return (
                  <div
                    key={node.id}
                    className="absolute bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm p-3 w-[140px] hover:shadow-md transition-shadow"
                    style={{ left: node.x, top: node.y }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">
                        <IconComponent size={14} className={iconBg} />
                      </div>
                      <span className="text-xs font-normal text-[var(--text-primary)] truncate flex-1" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                        {node.label}
                      </span>
                    </div>
                    {node.type === 'condition' && (
                      <div className="flex gap-1 mt-2">
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">TRUE</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium">FALSE</span>
                      </div>
                    )}
                    {node.type === 'comment' && node.config?.commentText && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-2 line-clamp-2">
                        {node.config.commentText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Template Info */}
        <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="text-base font-normal text-[var(--text-primary)] mb-1" style={{ fontFamily: "'Berkeley Mono', monospace" }}>{template.name}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{template.description}</p>
            </div>
            <span className="px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs rounded ml-4 flex-shrink-0">
              {template.category}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
              {template.nodes.length} nodes
            </span>
            <span className="text-[var(--text-tertiary)]">•</span>
            <span className="flex items-center gap-1.5">
              <ArrowRight size={12} className="text-[var(--text-tertiary)]" weight="light" />
              {template.connections.length} connections
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0">
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors">
              Back
            </button>
            <button
              onClick={() => { copyTemplateToWorkflows(template); onClose(); }}
              disabled={isCopyingTemplate}
              className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              {isCopyingTemplate ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Copying...</>
              ) : (
                <><Copy size={14} weight="light" /> Use This Template</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

