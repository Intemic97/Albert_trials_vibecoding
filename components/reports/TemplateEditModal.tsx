/**
 * Template Edit Modal
 * Modal for editing report templates with sections and items
 */

import React, { useState } from 'react';
import {
  X, Plus, Trash, CaretDown, CaretRight,
  DotsSixVertical, FloppyDisk, SpinnerGap, FileText, Flask,
  Clipboard, Wrench, Warning, Sparkle
} from '@phosphor-icons/react';

// ============================================================================
// TYPES
// ============================================================================

export interface ModalTemplateSection {
  id?: string;
  title: string;
  content?: string;
  generationRules?: string;
  items: ModalTemplateItem[];
  isExpanded?: boolean;
}

export interface ModalTemplateItem {
  id?: string;
  title: string;
  content: string;
  generationRules: string;
}

export interface TemplateData {
  name: string;
  description: string;
  icon: string;
  sections: Array<{
    id?: string;
    title: string;
    content: string;
    generationRules: string;
    items: Array<{
      id?: string;
      title: string;
      content: string;
      generationRules: string;
    }>;
  }>;
}

export interface TemplateUsage {
  inUse: boolean;
  reportCount: number;
  reports: Array<{ id: string; name: string }>;
}

export interface TemplateEditModalProps {
  template: any;
  onSave: (template: TemplateData) => Promise<void>;
  onClose: () => void;
  usage?: TemplateUsage | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ICON_OPTIONS = [
  { value: 'FileText', label: 'Document', Icon: FileText },
  { value: 'FlaskConical', label: 'Flask', Icon: Flask },
  { value: 'Clipboard', label: 'Clipboard', Icon: Clipboard },
  { value: 'Wrench', label: 'Wrench', Icon: Wrench },
  { value: 'AlertTriangle', label: 'Alert', Icon: Warning },
  { value: 'Sparkles', label: 'Sparkles', Icon: Sparkle }
];

// ============================================================================
// COMPONENT
// ============================================================================

export const TemplateEditModal: React.FC<TemplateEditModalProps> = ({
  template,
  onSave,
  onClose,
  usage
}) => {
  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [icon, setIcon] = useState(template?.icon || 'FileText');
  const [sections, setSections] = useState<ModalTemplateSection[]>(() => {
    if (template?.sections && template.sections.length > 0) {
      return template.sections.map((s: any) => ({
        id: s.id,
        title: s.title || '',
        content: s.content || '',
        generationRules: s.generationRules || '',
        items: Array.isArray(s.items) ? s.items.map((item: any) => ({
          id: item.id,
          title: item.title || '',
          content: item.content || '',
          generationRules: item.generationRules || ''
        })) : [],
        isExpanded: true
      }));
    }
    return [{ title: '', content: '', generationRules: '', items: [], isExpanded: true }];
  });
  const [isSaving, setIsSaving] = useState(false);

  // Section handlers
  const addSection = () => {
    setSections([...sections, { title: '', content: '', generationRules: '', items: [], isExpanded: true }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, updates: Partial<ModalTemplateSection>) => {
    setSections(sections.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const toggleSection = (index: number) => {
    setSections(sections.map((s, i) => i === index ? { ...s, isExpanded: !s.isExpanded } : s));
  };

  // Item handlers
  const addItem = (sectionIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].items.push({ title: '', content: '', generationRules: '' });
    setSections(newSections);
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].items = newSections[sectionIndex].items.filter((_, i) => i !== itemIndex);
    setSections(newSections);
  };

  const updateItem = (sectionIndex: number, itemIndex: number, updates: Partial<ModalTemplateItem>) => {
    const newSections = [...sections];
    newSections[sectionIndex].items[itemIndex] = { ...newSections[sectionIndex].items[itemIndex], ...updates };
    setSections(newSections);
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        icon,
        sections: sections.filter(s => s.title.trim()).map(s => ({
          id: s.id,
          title: s.title,
          content: s.content || '',
          generationRules: s.generationRules || '',
          items: s.items.filter(i => i.title.trim()).map(item => ({
            id: item.id,
            title: item.title,
            content: item.content || '',
            generationRules: item.generationRules || ''
          }))
        }))
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0">
          <h2 className="text-xl font-normal text-[var(--text-primary)]">Edit Template</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <X size={20} weight="light" className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Usage Warning */}
        {usage?.inUse && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 rounded-lg">
                <Warning className="text-amber-600" size={18} weight="fill" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Template in use
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  This template is used in {usage.reportCount} document{usage.reportCount !== 1 ? 's' : ''}. Changes to sections may affect existing documents.
                </p>
                {usage.reports.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-500 font-medium mb-1.5">Affected documents</p>
                    <div className="flex flex-wrap gap-1.5">
                      {usage.reports.slice(0, 5).map((report) => (
                        <span key={report.id} className="px-2 py-1 bg-white border border-amber-200 text-amber-700 rounded-md text-xs font-medium shadow-sm">
                          {report.name}
                        </span>
                      ))}
                      {usage.reports.length > 5 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-600 rounded-md text-xs">
                          +{usage.reports.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-[1fr,auto] gap-6">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Template Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Report, Analysis Template..."
                className="w-full px-3 py-2.5 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Icon</label>
              <div className="flex gap-1.5">
                {ICON_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setIcon(value)}
                    className={`p-2.5 rounded-lg border-2 transition-all ${
                      icon === value
                        ? 'border-teal-500 bg-teal-50 text-teal-600'
                        : 'border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={label}
                  >
                    <Icon size={18} weight={icon === value ? 'fill' : 'light'} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this template is for..."
              rows={2}
              className="w-full px-3 py-2.5 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
            />
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Sections</label>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Define the structure of your template</p>
              </div>
              <button onClick={addSection} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg font-medium transition-colors">
                <Plus size={16} weight="bold" />
                Add Section
              </button>
            </div>

            <div className="space-y-4">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-[var(--border-light)] rounded-xl overflow-hidden bg-[var(--bg-card)]">
                  {/* Section Header */}
                  <div className="bg-[var(--bg-tertiary)] px-4 py-3 flex items-center gap-3 border-b border-[var(--border-light)]">
                    <button onClick={() => toggleSection(sIdx)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded transition-colors">
                      {section.isExpanded ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
                    </button>
                    <span className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider shrink-0">Section {sIdx + 1}</span>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                      placeholder="Section title..."
                      className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <button onClick={() => addItem(sIdx)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Add item">
                      <Plus size={16} weight="bold" />
                    </button>
                    <button onClick={() => removeSection(sIdx)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove section">
                      <Trash size={16} weight="light" />
                    </button>
                  </div>

                  {/* Section Content */}
                  {section.isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Section Content and Generation Rules */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] font-medium mb-1.5 block">Section Content</label>
                          <textarea
                            value={section.content || ''}
                            onChange={(e) => updateSection(sIdx, { content: e.target.value })}
                            placeholder="What should this section contain..."
                            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] font-medium mb-1.5 block">
                            AI Generation Rules <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                          </label>
                          <textarea
                            value={section.generationRules || ''}
                            onChange={(e) => updateSection(sIdx, { generationRules: e.target.value })}
                            placeholder="Special instructions for AI..."
                            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                            rows={3}
                          />
                        </div>
                      </div>

                      {/* Section Items */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[var(--text-secondary)] font-medium">Items</label>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{section.items.length} item{section.items.length !== 1 ? 's' : ''}</span>
                        </div>
                        {section.items.length > 0 ? (
                          <div className="space-y-2">
                            {section.items.map((item, iIdx) => (
                              <div key={iIdx} className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-light)]">
                                <div className="flex items-start gap-2">
                                  <DotsSixVertical size={16} weight="light" className="text-[var(--text-tertiary)] mt-2.5 shrink-0 cursor-grab" />
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => updateItem(sIdx, iIdx, { title: e.target.value })}
                                        placeholder="Item title..."
                                        className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                      />
                                      <button onClick={() => removeItem(sIdx, iIdx)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 transition-colors" title="Remove item">
                                        <Trash size={14} weight="light" />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <textarea
                                        value={item.content}
                                        onChange={(e) => updateItem(sIdx, iIdx, { content: e.target.value })}
                                        placeholder="Item content..."
                                        rows={2}
                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-xs resize-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                      />
                                      <textarea
                                        value={item.generationRules}
                                        onChange={(e) => updateItem(sIdx, iIdx, { generationRules: e.target.value })}
                                        placeholder="AI rules (optional)..."
                                        rows={2}
                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-xs resize-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 border-2 border-dashed border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)]/50">
                            <p className="text-sm text-[var(--text-tertiary)]">No items in this section</p>
                            <button onClick={() => addItem(sIdx)} className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium">
                              + Add item
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-between shrink-0 bg-[var(--bg-tertiary)]/50">
          <p className="text-xs text-[var(--text-tertiary)]">
            {sections.filter(s => s.title.trim()).length} section{sections.filter(s => s.title.trim()).length !== 1 ? 's' : ''} · {sections.reduce((acc, s) => acc + s.items.filter(i => i.title.trim()).length, 0)} items
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || !name.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <SpinnerGap size={16} weight="light" className="animate-spin" /> : <FloppyDisk size={16} weight="light" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditModal;
