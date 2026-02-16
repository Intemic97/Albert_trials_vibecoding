/**
 * TemplatesGalleryInlineModal
 * Extracted from Workflows.tsx - Workflow Templates Modal (~185 lines)
 */

import React from 'react';
import { FlowArrow as Workflow, BookOpen, ShieldCheck as Shield, Lightning as Zap, Calendar, ChartBar as BarChart3, CheckCircle, Eye, Copy, ArrowRight, X } from '@phosphor-icons/react';

interface TemplatesGalleryInlineModalProps {
  show: boolean;
  onClose: () => void;
  filteredTemplates: any[];
  allTemplatesCount: number;
  selectedTemplateCategory: string;
  setSelectedTemplateCategory: (cat: string) => void;
  setPreviewingTemplate: (template: any) => void;
  copyTemplateToWorkflows: (template: any) => void;
  isCopyingTemplate: boolean;
}

export const TemplatesGalleryInlineModal: React.FC<TemplatesGalleryInlineModalProps> = ({
  show, onClose, filteredTemplates, allTemplatesCount,
  selectedTemplateCategory, setSelectedTemplateCategory,
  setPreviewingTemplate, copyTemplateToWorkflows, isCopyingTemplate
}) => {
  if (!show) return null;

  const categories = [
    { name: 'All', icon: <Workflow size={14} weight="light" />, color: 'from-slate-500 to-slate-600' },
    { name: 'Compliance', icon: <Shield size={14} weight="light" />, color: 'from-blue-500 to-blue-600' },
    { name: 'Process Optimization', icon: <Zap size={14} weight="light" />, color: 'from-amber-500 to-orange-500' },
    { name: 'Planning', icon: <Calendar size={14} weight="light" />, color: 'from-purple-500 to-purple-600' },
    { name: 'Reporting', icon: <BarChart3 size={14} weight="light" />, color: 'from-emerald-500 to-teal-500' },
    { name: 'Quality Assurance', icon: <CheckCircle size={14} weight="light" />, color: 'from-rose-500 to-pink-500' }
  ];

  const categoryColors: { [key: string]: string } = {
    'Compliance': 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    'Process Optimization': 'from-amber-500/10 to-orange-500/5 border-amber-500/20',
    'Planning': 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    'Reporting': 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20',
    'Quality Assurance': 'from-rose-500/10 to-pink-500/5 border-rose-500/20'
  };

  const categoryTextColors: { [key: string]: string } = {
    'Compliance': 'text-blue-600',
    'Process Optimization': 'text-amber-600',
    'Planning': 'text-purple-600',
    'Reporting': 'text-emerald-600',
    'Quality Assurance': 'text-rose-600'
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !isCopyingTemplate && onClose()}>
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
            <button onClick={onClose} disabled={isCopyingTemplate} className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50">
              <X size={20} weight="light" />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-4 border-b border-[var(--border-light)] shrink-0 bg-[var(--bg-tertiary)]/30">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map(({ name, icon, color }) => (
              <button
                key={name}
                onClick={() => setSelectedTemplateCategory(name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  selectedTemplateCategory === name
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
              <div
                key={template.id}
                className={`bg-gradient-to-br ${categoryColors[template.category] || 'from-slate-500/10 to-slate-600/5 border-slate-500/20'} border rounded-xl p-4 group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                onClick={() => setPreviewingTemplate(template)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${categoryTextColors[template.category] || 'text-slate-600'}`}>
                    {template.category}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    {template.nodes.length} nodes
                  </div>
                </div>
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 line-clamp-2 min-h-[40px]">{template.name}</h4>
                <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 min-h-[32px]">{template.description}</p>
                <div className="bg-[var(--bg-card)]/60 backdrop-blur-sm rounded-lg p-2.5 mb-3 border border-[var(--border-light)]">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {template.nodes.slice(0, 5).map((node: any, idx: number) => (
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
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewingTemplate(template); }}
                    className="flex-1 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={14} weight="light" />
                    Preview
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyTemplateToWorkflows(template); }}
                    disabled={isCopyingTemplate}
                    className="flex-1 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                  >
                    {isCopyingTemplate ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Copying...</>
                    ) : (
                      <><Copy size={14} weight="light" /> Use Template</>
                    )}
                  </button>
                </div>
              </div>
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
              Showing {filteredTemplates.length} of {allTemplatesCount} templates
            </p>
            <button
              onClick={onClose}
              disabled={isCopyingTemplate}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

