import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Entity } from '../types';
import { 
    Sparkles, FileText, FlaskConical, Clipboard, Wrench, AlertTriangle, Download,
    Plus, Trash2, Edit3, X, ChevronDown, ChevronRight, GripVertical, Save, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PromptInput } from './PromptInput';
import { ProfileMenu } from './ProfileMenu';
import { API_BASE } from '../config';

interface ReportingProps {
    entities: Entity[];
    companyInfo?: any;
    onViewChange?: (view: string) => void;
}

// Template section item (subsection)
interface TemplateItem {
    id?: string;
    title: string;
    content: string;
    generationRules: string;
}

// Template section with items (subsections)
interface TemplateSection {
    id?: string;
    title: string;
    content?: string;
    generationRules?: string;
    items: TemplateItem[];
    isExpanded?: boolean;
}

// Report template from database
interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    sections: TemplateSection[];
    createdAt?: string;
    updatedAt?: string;
}

// Icon mapping for templates
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    FileText,
    FlaskConical,
    Clipboard,
    Wrench,
    AlertTriangle,
    Sparkles
};

// Default templates for new organizations (will be used if no templates exist)
const defaultTemplates: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        name: 'GMP Production Summary',
        description: 'Comprehensive production report covering batches, yields, and deviations',
        icon: 'FileText',
        sections: [
            {
                title: '1. Executive Summary',
                items: [
                    { title: 'Overview', content: 'Overview of production activities in the reporting period', generationRules: '' },
                    { title: 'Key Performance Indicators', content: 'Key performance indicators and metrics', generationRules: '' },
                    { title: 'Critical Findings', content: 'Critical findings and recommendations', generationRules: '' }
                ]
            },
            {
                title: '2. Batch Production Overview',
                items: [
                    { title: 'Batches Produced', content: 'List all batches produced with numbers, products, and quantities', generationRules: '' },
                    { title: 'Yield Analysis', content: 'Batch yield analysis and efficiency metrics', generationRules: '' }
                ]
            },
            {
                title: '3. Quality Metrics',
                items: [
                    { title: 'QC Results', content: 'In-process quality control results', generationRules: '' },
                    { title: 'Deviations', content: 'Summary of any deviations encountered', generationRules: '' }
                ]
            }
        ]
    },
    {
        name: 'Quality Control Report',
        description: 'Focus on testing, specifications, and quality events',
        icon: 'FlaskConical',
        sections: [
            {
                title: '1. QC Testing Summary',
                items: [
                    { title: 'Tests Performed', content: 'Overview of all quality control tests performed', generationRules: '' },
                    { title: 'Methods Used', content: 'Test methods and specifications used', generationRules: '' }
                ]
            },
            {
                title: '2. Results Analysis',
                items: [
                    { title: 'Results Summary', content: 'Summary of results by product/batch', generationRules: '' },
                    { title: 'OOS Events', content: 'List of any out-of-specification results', generationRules: '' }
                ]
            }
        ]
    }
];

export const Reporting: React.FC<ReportingProps> = ({ entities, companyInfo, onViewChange }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [templatePrompt, setTemplatePrompt] = useState('');
    
    // Templates management
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);

    const reportRef = useRef<HTMLDivElement>(null);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    // Fetch templates on mount
    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/report-templates`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                // Transform flat sections to nested structure
                const transformedTemplates = data.map((template: any) => ({
                    ...template,
                    sections: transformSectionsToNested(template.sections || [])
                }));
                setTemplates(transformedTemplates);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setTemplatesLoading(false);
        }
    };

    // Transform flat sections array to nested structure
    const transformSectionsToNested = (flatSections: any[]): TemplateSection[] => {
        const parentSections = flatSections.filter(s => !s.parentId);
        return parentSections.map(parent => ({
            id: parent.id,
            title: parent.title,
            content: parent.content || '',
            generationRules: parent.generationRules || '',
            items: flatSections
                .filter(s => s.parentId === parent.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(item => ({
                    id: item.id,
                    title: item.title,
                    content: item.content || '',
                    generationRules: item.generationRules || ''
                })),
            isExpanded: true
        })).sort((a, b) => {
            const aOrder = flatSections.find(s => s.id === a.id)?.sortOrder || 0;
            const bOrder = flatSections.find(s => s.id === b.id)?.sortOrder || 0;
            return aOrder - bOrder;
        });
    };

    // Generate prompt from template sections
    const generatePromptFromTemplate = (template: ReportTemplate): string => {
        let prompt = `Generate a comprehensive ${template.name} with the following sections:\n\n`;
        
        template.sections.forEach((section, sIdx) => {
            prompt += `${section.title}\n`;
            if (section.content) {
                prompt += `   - ${section.content}\n`;
            }
            if (section.generationRules) {
                prompt += `   [Rules: ${section.generationRules}]\n`;
            }
            section.items.forEach((item) => {
                prompt += `   - ${item.title}`;
                if (item.content) {
                    prompt += `: ${item.content}`;
                }
                prompt += '\n';
                if (item.generationRules) {
                    prompt += `     [Rules: ${item.generationRules}]\n`;
                }
            });
            prompt += '\n';
        });
        
        prompt += '\nPlease provide detailed analysis with data-driven insights. Reference relevant @Entity data where applicable.';
        return prompt;
    };

    // Auto-scroll to results when report is generated
    useEffect(() => {
        if (report && resultsContainerRef.current) {
            setTimeout(() => {
                resultsContainerRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
        }
    }, [report]);

    const handleTemplateSelect = (template: ReportTemplate) => {
        setSelectedTemplate(template);
        const prompt = generatePromptFromTemplate(template);
        setTemplatePrompt(prompt);
    };

    const handleCreateTemplate = () => {
        setEditingTemplate(null);
        setShowTemplateModal(true);
    };

    const handleEditTemplate = (template: ReportTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTemplate(template);
        setShowTemplateModal(true);
    };

    const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const res = await fetch(`${API_BASE}/report-templates/${templateId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setTemplates(prev => prev.filter(t => t.id !== templateId));
                if (selectedTemplate?.id === templateId) {
                    setSelectedTemplate(null);
                    setTemplatePrompt('');
                }
            }
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    };

    const handleSaveTemplate = async (templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (editingTemplate) {
                // Update existing
                const res = await fetch(`${API_BASE}/report-templates/${editingTemplate.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData),
                    credentials: 'include'
                });
                if (res.ok) {
                    fetchTemplates();
                }
            } else {
                // Create new
                const res = await fetch(`${API_BASE}/report-templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData),
                    credentials: 'include'
                });
                if (res.ok) {
                    fetchTemplates();
                }
            }
            setShowTemplateModal(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error('Error saving template:', error);
        }
    };

    const handleGenerate = async (prompt: string, mentionedEntityIds: string[]) => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setReport(null);

        try {
            await fetch(`${API_BASE}/node-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeType: 'report_prompt',
                    nodeLabel: 'Reports',
                    feedbackText: prompt
                }),
                credentials: 'include'
            });
        } catch (e) {
            // Silent fail
        }

        try {
            const res = await fetch(`${API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds
                }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.error) {
                throw new Error(data.error);
            }
            setReport(data.response);
        } catch (error) {
            console.error('Error generating report:', error);
            setReport('Failed to generate report. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!reportRef.current || !report) return;

        try {
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = '210mm';
            tempContainer.style.padding = '20mm';
            tempContainer.style.backgroundColor = 'white';
            tempContainer.style.fontFamily = 'Arial, sans-serif';

            const clonedReport = reportRef.current.cloneNode(true) as HTMLElement;
            tempContainer.appendChild(clonedReport);
            document.body.appendChild(tempContainer);

            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            document.body.removeChild(tempContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `report_${timestamp}.pdf`;

            pdf.save(filename);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const getIconComponent = (iconName: string) => {
        return iconMap[iconName] || FileText;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative" data-tutorial="reports-content">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <Sparkles className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">AI Reporting</h1>
                        <p className="text-xs text-slate-500">Generate insights from your data</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu onNavigate={onViewChange} />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Templates Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="text-teal-600" size={20} />
                            <h2 className="text-lg font-semibold text-slate-800">Report Templates</h2>
                            <span className="text-xs text-slate-500 ml-2">Select a template to get started</span>
                            <button
                                onClick={handleCreateTemplate}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                New Template
                            </button>
                        </div>

                        {templatesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-teal-600" size={24} />
                                <span className="ml-2 text-slate-500">Loading templates...</span>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                <FileText className="mx-auto text-slate-300" size={48} />
                                <p className="text-slate-500 mt-2">No templates yet</p>
                                <p className="text-slate-400 text-sm mt-1">Create your first template to get started</p>
                                <button
                                    onClick={handleCreateTemplate}
                                    className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Create Template
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map((template) => {
                                    const IconComponent = getIconComponent(template.icon);
                                    const isSelected = selectedTemplate?.id === template.id;
                                    return (
                                        <div
                                            key={template.id}
                                            onClick={() => handleTemplateSelect(template)}
                                            className={`group relative text-left p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                                                isSelected
                                                    ? 'border-teal-500 bg-teal-50 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-teal-300'
                                            }`}
                                        >
                                            {/* Action buttons */}
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleEditTemplate(template, e)}
                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
                                                    title="Edit template"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteTemplate(template.id, e)}
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 rounded-md text-red-600 transition-colors"
                                                    title="Delete template"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected
                                                        ? 'bg-teal-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-600'
                                                }`}>
                                                    <IconComponent size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`font-semibold text-sm mb-1 transition-colors ${
                                                        isSelected ? 'text-teal-700' : 'text-slate-800 group-hover:text-teal-700'
                                                    }`}>
                                                        {template.name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 line-clamp-2">
                                                        {template.description}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {template.sections.length} sections
                                                    </p>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="mt-3 flex items-center gap-1 text-xs text-teal-600 font-medium">
                                                    <Sparkles size={12} />
                                                    <span>Template loaded</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Template Preview */}
                    {selectedTemplate && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                <ChevronDown className="text-teal-600" size={20} />
                                <h2 className="text-lg font-semibold text-slate-800">Template Structure</h2>
                                <span className="text-xs text-slate-400 ml-2">{selectedTemplate.name}</span>
                            </div>
                            <div className="space-y-2">
                                {selectedTemplate.sections.map((section, idx) => (
                                    <div key={section.id || idx} className="border border-slate-100 rounded-lg overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2 font-medium text-slate-700 text-sm">
                                            {section.title}
                                        </div>
                                        {section.items.length > 0 && (
                                            <div className="px-4 py-2 space-y-1">
                                                {section.items.map((item, itemIdx) => (
                                                    <div key={item.id || itemIdx} className="text-sm text-slate-600 pl-4 border-l-2 border-teal-200">
                                                        <span className="font-medium">{item.title}</span>
                                                        {item.content && (
                                                            <span className="text-slate-400"> — {item.content}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Draft your query
                        </label>

                        <PromptInput
                            key={selectedTemplate?.id || 'empty'}
                            entities={entities}
                            companyInfo={companyInfo}
                            onGenerate={handleGenerate}
                            isGenerating={isLoading}
                            initialValue={templatePrompt}
                            placeholder="e.g. Analyze the capacity of @Factories and list any issues..."
                            buttonLabel="Generate Report"
                        />
                    </div>

                    {/* Results Area */}
                    {report && (
                        <div 
                            ref={resultsContainerRef}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                    <Sparkles className="text-teal-600" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-slate-800">Generated Insights</h2>
                                    <p className="text-sm text-slate-500">Based on your data context</p>
                                </div>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium shadow-sm transition-all"
                                >
                                    <Download size={16} />
                                    Download PDF
                                </button>
                            </div>
                            <div ref={reportRef} className="prose prose-slate max-w-none">
                                <ReactMarkdown>{report}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Template Edit Modal */}
            {showTemplateModal && (
                <TemplateEditModal
                    template={editingTemplate}
                    onSave={handleSaveTemplate}
                    onClose={() => {
                        setShowTemplateModal(false);
                        setEditingTemplate(null);
                    }}
                />
            )}
        </div>
    );
};

// Template Edit Modal Component
interface TemplateEditModalProps {
    template: ReportTemplate | null;
    onSave: (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onClose: () => void;
}

const TemplateEditModal: React.FC<TemplateEditModalProps> = ({ template, onSave, onClose }) => {
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [icon, setIcon] = useState(template?.icon || 'FileText');
    const [sections, setSections] = useState<TemplateSection[]>(
        template?.sections || [{ title: '', items: [], isExpanded: true }]
    );
    const [isSaving, setIsSaving] = useState(false);

    const iconOptions = [
        { value: 'FileText', label: 'Document', Icon: FileText },
        { value: 'FlaskConical', label: 'Flask', Icon: FlaskConical },
        { value: 'Clipboard', label: 'Clipboard', Icon: Clipboard },
        { value: 'Wrench', label: 'Wrench', Icon: Wrench },
        { value: 'AlertTriangle', label: 'Alert', Icon: AlertTriangle },
        { value: 'Sparkles', label: 'Sparkles', Icon: Sparkles }
    ];

    const addSection = () => {
        setSections([...sections, { title: '', items: [], isExpanded: true }]);
    };

    const removeSection = (index: number) => {
        setSections(sections.filter((_, i) => i !== index));
    };

    const updateSection = (index: number, updates: Partial<TemplateSection>) => {
        setSections(sections.map((s, i) => i === index ? { ...s, ...updates } : s));
    };

    const toggleSection = (index: number) => {
        setSections(sections.map((s, i) => i === index ? { ...s, isExpanded: !s.isExpanded } : s));
    };

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

    const updateItem = (sectionIndex: number, itemIndex: number, updates: Partial<TemplateItem>) => {
        const newSections = [...sections];
        newSections[sectionIndex].items[itemIndex] = { ...newSections[sectionIndex].items[itemIndex], ...updates };
        setSections(newSections);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            alert('Please enter a template name');
            return;
        }
        if (sections.length === 0 || !sections.some(s => s.title.trim())) {
            alert('Please add at least one section with a title');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                name: name.trim(),
                description: description.trim(),
                icon,
                sections: sections.filter(s => s.title.trim()).map(s => ({
                    ...s,
                    items: s.items.filter(i => i.title.trim())
                }))
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">
                        {template ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Template Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Monthly Production Report"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Icon
                            </label>
                            <div className="flex gap-2">
                                {iconOptions.map(({ value, label, Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => setIcon(value)}
                                        className={`p-2 rounded-lg border-2 transition-all ${
                                            icon === value
                                                ? 'border-teal-500 bg-teal-50 text-teal-600'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-500'
                                        }`}
                                        title={label}
                                    >
                                        <Icon size={20} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this template"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>

                    {/* Sections */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-slate-700">Sections</label>
                            <button
                                onClick={addSection}
                                className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
                            >
                                <Plus size={16} />
                                Add Section
                            </button>
                        </div>

                        <div className="space-y-4">
                            {sections.map((section, sIdx) => (
                                <div key={sIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                                    {/* Section Header */}
                                    <div className="bg-slate-50 px-4 py-3 flex items-center gap-3">
                                        <button
                                            onClick={() => toggleSection(sIdx)}
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            {section.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        <span className="text-sm text-slate-500 font-medium">Section {sIdx + 1} Title</span>
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                                            placeholder="e.g., 1. Executive summary"
                                            className="flex-1 px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
                                        />
                                        <button
                                            onClick={() => addItem(sIdx)}
                                            className="p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                                            title="Add item"
                                        >
                                            <Plus size={18} />
                                        </button>
                                        <button
                                            onClick={() => removeSection(sIdx)}
                                            className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Remove section"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    {/* Section Content */}
                                    {section.isExpanded && (
                                        <div className="p-4 space-y-3">
                                            {/* Items (Subsections) */}
                                            {section.items.length > 0 ? (
                                                <div className="space-y-3">
                                                    {section.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <GripVertical size={16} className="text-slate-300 mt-2 shrink-0" />
                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <label className="text-xs text-slate-500">Item Title</label>
                                                                        <input
                                                                            type="text"
                                                                            value={item.title}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { title: e.target.value })}
                                                                            placeholder="e.g., Audit key compliance indicators"
                                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-slate-500">Content</label>
                                                                        <textarea
                                                                            value={item.content}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { content: e.target.value })}
                                                                            placeholder="Description or details for this item..."
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-slate-500">Generation Rules <span className="text-slate-400">(optional)</span></label>
                                                                        <textarea
                                                                            value={item.generationRules}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { generationRules: e.target.value })}
                                                                            placeholder="e.g., Use formal tone, include specific examples, max 200 words..."
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeItem(sIdx, iIdx)}
                                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
                                                                    title="Remove item"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-lg">
                                                    <p className="text-sm text-slate-400">No items in this section</p>
                                                    <button
                                                        onClick={() => addItem(sIdx)}
                                                        className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                                                    >
                                                        + Add item
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {sections.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                                    <p className="text-slate-500">No sections yet</p>
                                    <button
                                        onClick={addSection}
                                        className="mt-2 text-teal-600 hover:text-teal-700 font-medium"
                                    >
                                        + Add your first section
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg font-medium transition-colors"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
