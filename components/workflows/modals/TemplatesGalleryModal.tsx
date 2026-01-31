/**
 * Templates Gallery Modal
 * Displays workflow templates with preview and copy functionality
 */

import React, { useState, useMemo } from 'react';
import { 
    X, 
    BookOpen,
    Copy,
    Eye,
    ArrowRight,
    Workflow,
    Shield,
    Zap,
    Calendar,
    BarChart as BarChart3,
    CheckCircle
} from '@phosphor-icons/react';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from '../templates';
import { getNodeIcon, getNodeIconBg, TEMPLATE_CATEGORY_COLORS, TEMPLATE_TEXT_COLORS } from '../utils/nodeHelpers';

// ============================================================================
// TYPES
// ============================================================================

interface TemplatesGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopyTemplate: (template: WorkflowTemplate) => Promise<void>;
    isCopying: boolean;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORIES = [
    { name: 'All', icon: <Workflow size={14} weight="light" />, color: 'from-slate-500 to-slate-600' },
    { name: 'Compliance', icon: <Shield size={14} weight="light" />, color: 'from-blue-500 to-blue-600' },
    { name: 'Process Optimization', icon: <Zap size={14} weight="light" />, color: 'from-amber-500 to-orange-500' },
    { name: 'Planning', icon: <Calendar size={14} weight="light" />, color: 'from-purple-500 to-purple-600' },
    { name: 'Reporting', icon: <BarChart3 size={14} weight="light" />, color: 'from-emerald-500 to-teal-500' },
    { name: 'Quality Assurance', icon: <CheckCircle size={14} weight="light" />, color: 'from-rose-500 to-pink-500' }
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TemplateCardProps {
    template: WorkflowTemplate;
    onPreview: () => void;
    onCopy: () => void;
    isCopying: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onPreview, onCopy, isCopying }) => {
    const categoryColors = TEMPLATE_CATEGORY_COLORS[template.category] || 'from-slate-500/10 to-slate-600/5 border-slate-500/20';
    const textColor = TEMPLATE_TEXT_COLORS[template.category] || 'text-slate-600';

    return (
        <div
            className={`bg-gradient-to-br ${categoryColors} border rounded-xl p-4 group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
            onClick={onPreview}
        >
            {/* Category badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${textColor}`}>
                    {template.category}
                </span>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    {template.nodes.length} nodes
                </div>
            </div>

            {/* Title */}
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 line-clamp-2 min-h-[40px]">
                {template.name}
            </h4>
            
            {/* Description */}
            <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 min-h-[32px]">
                {template.description}
            </p>

            {/* Visual workflow preview */}
            <div className="bg-[var(--bg-card)]/60 backdrop-blur-sm rounded-lg p-2.5 mb-3 border border-[var(--border-light)]">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {template.nodes.slice(0, 5).map((node, idx) => (
                        <React.Fragment key={idx}>
                            <div className="flex-shrink-0 w-6 h-6 rounded bg-[var(--bg-tertiary)] border border-[var(--border-light)] flex items-center justify-center" title={node.label}>
                                <Workflow size={10} className="text-[var(--text-tertiary)]" weight="light" />
                            </div>
                            {idx < Math.min(template.nodes.length - 1, 4) && (
                                <ArrowRight size={10} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                            )}
                        </React.Fragment>
                    ))}
                    {template.nodes.length > 5 && (
                        <span className="text-[10px] text-[var(--text-tertiary)] ml-1">+{template.nodes.length - 5}</span>
                    )}
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onCopy();
                }}
                disabled={isCopying}
                className="w-full py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
                {isCopying ? (
                    <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Copying...
                    </>
                ) : (
                    <>
                        <Copy size={14} weight="light" />
                        Use Template
                    </>
                )}
            </button>
        </div>
    );
};

interface TemplatePreviewProps {
    template: WorkflowTemplate;
    onClose: () => void;
    onCopy: () => void;
    isCopying: boolean;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template, onClose, onCopy, isCopying }) => {
    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-5 border-b border-[var(--border-light)] shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                                <Eye size={20} className="text-[var(--text-secondary)]" weight="light" />
                            </div>
                            <div>
                                <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Template Preview</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{template.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                        >
                            <X size={20} weight="light" />
                        </button>
                    </div>
                </div>

                {/* Preview Canvas */}
                <div className="overflow-hidden bg-[var(--bg-tertiary)] relative border-b border-[var(--border-light)]" style={{ height: '450px' }}>
                    <div 
                        className="absolute inset-0 overflow-auto p-8 custom-scrollbar"
                        style={{
                            backgroundImage: `
                                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                            `,
                            backgroundSize: '20px 20px'
                        }}
                    >
                        {/* SVG Connections */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '900px', minHeight: '500px' }}>
                            {template.connections.map(conn => {
                                const fromNode = template.nodes.find(n => n.id === conn.fromNodeId);
                                const toNode = template.nodes.find(n => n.id === conn.toNodeId);
                                if (!fromNode || !toNode) return null;
                                
                                const padding = 32;
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
                        <div className="relative" style={{ minWidth: '900px', minHeight: '500px' }}>
                            {template.nodes.map(node => {
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
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={onCopy}
                            disabled={isCopying}
                            className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                        >
                            {isCopying ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Copying...
                                </>
                            ) : (
                                <>
                                    <Copy size={14} weight="light" />
                                    Use This Template
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TemplatesGalleryModal: React.FC<TemplatesGalleryModalProps> = ({
    isOpen,
    onClose,
    onCopyTemplate,
    isCopying
}) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [previewingTemplate, setPreviewingTemplate] = useState<WorkflowTemplate | null>(null);

    const filteredTemplates = useMemo(() => {
        if (selectedCategory === 'All') return WORKFLOW_TEMPLATES;
        return WORKFLOW_TEMPLATES.filter(t => t.category === selectedCategory);
    }, [selectedCategory]);

    const handleCopy = async (template: WorkflowTemplate) => {
        await onCopyTemplate(template);
        setPreviewingTemplate(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !isCopying && onClose()}>
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-[var(--border-light)] shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#256A65] to-[#84C4D1] flex items-center justify-center">
                                    <BookOpen size={24} className="text-white" weight="light" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium text-[var(--text-primary)]">Template Gallery</h3>
                                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">Start with a pre-built workflow and customize it</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isCopying}
                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                            >
                                <X size={20} weight="light" />
                            </button>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="px-6 py-4 border-b border-[var(--border-light)] shrink-0 bg-[var(--bg-tertiary)]/30">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {CATEGORIES.map(({ name, icon, color }) => (
                                <button
                                    key={name}
                                    onClick={() => setSelectedCategory(name)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                        selectedCategory === name
                                            ? `bg-gradient-to-r ${color} text-white shadow-md`
                                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    {icon}
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Templates Grid */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map(template => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onPreview={() => setPreviewingTemplate(template)}
                                    onCopy={() => handleCopy(template)}
                                    isCopying={isCopying}
                                />
                            ))}
                        </div>

                        {filteredTemplates.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
                                    <BookOpen size={32} className="text-[var(--text-tertiary)]" weight="light" />
                                </div>
                                <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">No templates found</h3>
                                <p className="text-sm text-[var(--text-secondary)]">Try selecting a different category</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0 bg-[var(--bg-tertiary)]/30">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-[var(--text-secondary)]">
                                Showing {filteredTemplates.length} of {WORKFLOW_TEMPLATES.length} templates
                            </p>
                            <button
                                onClick={onClose}
                                disabled={isCopying}
                                className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Preview Modal */}
            {previewingTemplate && (
                <TemplatePreview
                    template={previewingTemplate}
                    onClose={() => setPreviewingTemplate(null)}
                    onCopy={() => handleCopy(previewingTemplate)}
                    isCopying={isCopying}
                />
            )}
        </>
    );
};

export default TemplatesGalleryModal;
