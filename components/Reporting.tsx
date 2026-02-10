import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useLocation } from 'react-router-dom';
import { Entity } from '../types';
import { 
    Sparkles, FileText, FlaskConical, Clipboard, Wrench, AlertTriangle, Download,
    Plus, Trash2, Edit3, X, ChevronDown, ChevronRight, GripVertical, Save, Loader2,
    Clock, User, Calendar, FileCheck, MoreVertical, Search, Bot, Send
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PromptInput } from './PromptInput';
import { API_BASE } from '../config';

interface ReportingProps {
    entities: Entity[];
    companyInfo?: any;
    onViewChange?: (view: string) => void;
    view?: 'templates' | 'documents' | 'reports';
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
    suggestedDocument?: {
        name: string;
        description?: string;
    };
    suggestedEntities?: Array<{
        name: string;
        description?: string;
        entityType?: string;
        properties?: Array<{
            name: string;
            type: string;
            unit?: string;
            defaultValue?: string;
        }>;
    }>;
    createdAt?: string;
    updatedAt?: string;
}

// Saved report from database
interface SavedReport {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'review' | 'ready_to_send';
    templateId: string;
    templateName: string;
    createdBy: string;
    createdByName: string;
    createdByEmail: string;
    reviewerId?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    deadline?: string;
    createdAt: string;
    updatedAt: string;
}

// Organization user for reviewer dropdown
interface OrgUser {
    id: string;
    name: string;
    email: string;
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

const statusConfig = {
    draft: { label: 'Draft', color: 'text-amber-500', bg: 'bg-amber-500/15', borderColor: 'border-[var(--border-light)]' },
    review: { label: 'In Review', color: 'text-[var(--text-primary)]', bg: 'bg-[var(--bg-tertiary)]', borderColor: 'border-[var(--border-light)]' },
    ready_to_send: { label: 'Ready', color: 'text-emerald-500', bg: 'bg-emerald-500/15', borderColor: 'border-[var(--border-light)]' }
};

export const Reporting: React.FC<ReportingProps> = ({ entities, companyInfo, onViewChange, view = 'documents' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Determine view from URL if not provided
    const currentView = view || (location.pathname.startsWith('/templates') ? 'templates' : 
                                 location.pathname.startsWith('/documents') ? 'documents' : 
                                 location.pathname.startsWith('/reports') ? 'reports' : 'documents');
    
    // Templates state
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
    const [templateUsage, setTemplateUsage] = useState<{ inUse: boolean; reportCount: number; reports: any[] } | null>(null);
    
    // Reports state
    const [reports, setReports] = useState<SavedReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [showNewReportModal, setShowNewReportModal] = useState(false);
    
    // Organization users for reviewer dropdown
    const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
    
    // Search/filter state
    const [documentsSearch, setDocumentsSearch] = useState('');
    const [templatesSearch, setTemplatesSearch] = useState('');
    
    // AI Template Assistant state
    const [showAiAssistant, setShowAiAssistant] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [isApplyingAiBundle, setIsApplyingAiBundle] = useState(false);
    const [aiGeneratedTemplate, setAiGeneratedTemplate] = useState<ReportTemplate | null>(null);

    // Fetch all data on mount
    useEffect(() => {
        fetchTemplates();
        fetchReports();
        fetchOrgUsers();
    }, []);

    const fetchTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/report-templates`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
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

    const fetchReports = async () => {
        setReportsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setReports(data);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setReportsLoading(false);
        }
    };

    const fetchOrgUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/organization/users`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setOrgUsers(data);
            }
        } catch (error) {
            console.error('Error fetching org users:', error);
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

    const handleCreateTemplate = () => {
        setEditingTemplate(null);
        setShowTemplateModal(true);
    };

    const handleCreateWithAI = () => {
        setShowAiAssistant(true);
        setAiPrompt('');
        setAiGeneratedTemplate(null);
    };

    const handleGenerateTemplate = async () => {
        if (!aiPrompt.trim() || isGeneratingTemplate) return;

        setIsGeneratingTemplate(true);
        try {
            const res = await fetch(`${API_BASE}/report-templates/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ prompt: aiPrompt })
            });

            if (res.ok) {
                const data = await res.json();
                const generatedTemplate: ReportTemplate = {
                    ...data,
                    sections: transformSectionsToNested(data.sections || [])
                };
                setAiGeneratedTemplate(generatedTemplate);
            } else {
                const errorText = await res.text();
                alert(`Error generating template: ${errorText || 'Please try again.'}`);
            }
        } catch (error) {
            console.error('Error generating template:', error);
            alert('Error generating template. Please try again.');
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    const handleUseGeneratedTemplate = () => {
        if (aiGeneratedTemplate) {
            setEditingTemplate(aiGeneratedTemplate);
            setShowAiAssistant(false);
            setShowTemplateModal(true);
            setAiPrompt('');
            setAiGeneratedTemplate(null);
        }
    };

    const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

    const handleCreateAllWithAI = async () => {
        if (!aiGeneratedTemplate || isApplyingAiBundle) return;

        setIsApplyingAiBundle(true);
        try {
            const templatePayload = {
                name: aiGeneratedTemplate.name,
                description: aiGeneratedTemplate.description || '',
                icon: aiGeneratedTemplate.icon || 'Sparkles',
                sections: aiGeneratedTemplate.sections
                    .filter(section => section.title?.trim())
                    .map(section => ({
                        title: section.title.trim(),
                        content: section.content || '',
                        generationRules: section.generationRules || '',
                        items: (section.items || [])
                            .filter(item => item.title?.trim())
                            .map(item => ({
                                title: item.title.trim(),
                                content: item.content || '',
                                generationRules: item.generationRules || ''
                            }))
                    }))
            };

            const templateRes = await fetch(`${API_BASE}/report-templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(templatePayload)
            });

            if (!templateRes.ok) {
                const errorText = await templateRes.text();
                throw new Error(errorText || 'Failed to create template');
            }

            const createdTemplate = await templateRes.json();
            const suggestedEntities = aiGeneratedTemplate.suggestedEntities || [];
            let createdEntities = 0;

            for (const suggestion of suggestedEntities) {
                if (!suggestion.name?.trim()) continue;

                const entityPayload = {
                    id: makeId('ent'),
                    name: suggestion.name.trim(),
                    description: suggestion.description || '',
                    author: 'AI Assistant',
                    lastEdited: new Date().toISOString(),
                    entityType: suggestion.entityType || 'generic',
                    properties: (suggestion.properties || [])
                        .filter(prop => prop.name?.trim())
                        .map(prop => ({
                            id: makeId('prop'),
                            name: prop.name.trim(),
                            type: prop.type || 'text',
                            unit: prop.unit || '',
                            defaultValue: prop.defaultValue || ''
                        }))
                };

                const entityRes = await fetch(`${API_BASE}/entities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(entityPayload)
                });

                if (entityRes.ok) {
                    createdEntities += 1;
                } else {
                    console.warn('Failed to create suggested entity:', suggestion.name);
                }
            }

            const suggestedDoc = aiGeneratedTemplate.suggestedDocument;
            const reportPayload = {
                name: suggestedDoc?.name?.trim() || `${aiGeneratedTemplate.name} - Draft`,
                description: suggestedDoc?.description || '',
                templateId: createdTemplate.id,
                reviewerId: null,
                deadline: null
            };

            const reportRes = await fetch(`${API_BASE}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(reportPayload)
            });

            if (!reportRes.ok) {
                const errorText = await reportRes.text();
                throw new Error(errorText || 'Template created, but failed to create document');
            }

            const createdReport = await reportRes.json();
            await Promise.all([fetchTemplates(), fetchReports()]);

            setShowAiAssistant(false);
            setAiPrompt('');
            setAiGeneratedTemplate(null);
            alert(`Template and document created. Suggested entities created: ${createdEntities}.`);
            if (createdReport?.id) {
                navigate(`/documents/${createdReport.id}`);
            }
        } catch (error: any) {
            console.error('Error creating AI bundle:', error);
            alert(`Error creating from AI output: ${error?.message || 'Please try again.'}`);
        } finally {
            setIsApplyingAiBundle(false);
        }
    };

    const handleEditTemplate = async (template: ReportTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Check if template is in use
        try {
            const res = await fetch(`${API_BASE}/report-templates/${template.id}/usage`, {
                credentials: 'include'
            });
            if (res.ok) {
                const usage = await res.json();
                setTemplateUsage(usage);
            } else {
                setTemplateUsage(null);
            }
        } catch (error) {
            console.error('Error checking template usage:', error);
            setTemplateUsage(null);
        }
        
        setEditingTemplate(template);
        setShowTemplateModal(true);
    };

    const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Use setTimeout to escape the click event chain before showing confirm
        setTimeout(async () => {
            if (!window.confirm('Are you sure you want to delete this template?')) return;

            try {
                const res = await fetch(`${API_BASE}/report-templates/${templateId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (res.ok) {
                    setTemplates(prev => prev.filter(t => t.id !== templateId));
                } else {
                    const errData = await res.json().catch(() => ({}));
                    console.error('Delete failed:', res.status, errData);
                    window.alert(`Failed to delete template: ${errData.error || res.statusText}`);
                }
            } catch (error) {
                console.error('Error deleting template:', error);
                window.alert('Failed to delete template. Please try again.');
            }
        }, 0);
    };

    const handleSaveTemplate = async (templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (editingTemplate) {
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
            setTemplateUsage(null);
        } catch (error) {
            console.error('Error saving template:', error);
        }
    };

    const handleCreateReport = async (reportData: {
        name: string;
        description: string;
        templateId: string;
        reviewerId: string | null;
        deadline: string | null;
    }) => {
        try {
            const res = await fetch(`${API_BASE}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData),
                credentials: 'include'
            });
            if (res.ok) {
                const { id } = await res.json();
                navigate(`/documents/${id}`);
            }
        } catch (error) {
            console.error('Error creating report:', error);
        }
    };

    const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            const res = await fetch(`${API_BASE}/reports/${reportId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setReports(prev => prev.filter(r => r.id !== reportId));
            }
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    };

    const getIconComponent = (iconName: string) => {
        return iconMap[iconName] || FileText;
    };

    // Get header info based on view
    const getHeaderInfo = () => {
        switch (currentView) {
            case 'templates':
                return { title: 'Templates', subtitle: 'Create and manage report templates' };
            case 'documents':
                return { title: 'Documents', subtitle: 'Create and manage your documents' };
            case 'reports':
                return { title: 'Reports', subtitle: 'View and manage generated reports' };
            default:
                return { title: 'Documents', subtitle: 'Create and manage your documents' };
        }
    };

    const headerInfo = getHeaderInfo();

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] relative" data-tutorial="reports-content">
            {/* Header */}
            <header className="h-16 bg-[var(--bg-card)] border-b border-[var(--border-light)] flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div>
                    <h1 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>{headerInfo.title}</h1>
                    <p className="text-[11px] text-[var(--text-secondary)]">{headerInfo.subtitle}</p>
                </div>
                <div />
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto">

                    {/* Documents View */}
                    {currentView === 'documents' && (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>My Documents</h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">{reports.length} document{reports.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button
                                onClick={() => setShowNewReportModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={14} />
                                New Document
                            </button>
                        </div>

                        {/* Search Documents */}
                        {reports.length > 0 && (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    placeholder="Search by name, creator or reviewer..."
                                    value={documentsSearch}
                                    onChange={(e) => setDocumentsSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                />
                            </div>
                        )}

                        {reportsLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="animate-spin text-[var(--text-tertiary)]" size={24} />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="bg-[var(--bg-card)] rounded-lg border border-dashed border-[var(--border-light)] p-12 text-center">
                                <FileText className="mx-auto text-[var(--text-tertiary)]" size={48} />
                                <p className="text-[var(--text-secondary)] mt-4 text-sm font-medium">No documents yet</p>
                                <p className="text-[var(--text-tertiary)] text-xs mt-1">Create your first document to get started</p>
                                <button
                                    onClick={() => setShowNewReportModal(true)}
                                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                                >
                                    <Plus size={16} />
                                    Create Document
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {reports
                                    .filter(report => {
                                        if (!documentsSearch.trim()) return true;
                                        const search = documentsSearch.toLowerCase();
                                        return (
                                            report.name.toLowerCase().includes(search) ||
                                            report.createdByName?.toLowerCase().includes(search) ||
                                            report.reviewerName?.toLowerCase().includes(search)
                                        );
                                    })
                                    .map((report) => {
                                    const status = statusConfig[report.status];
                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => navigate(`/documents/${report.id}`)}
                                            className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer flex flex-col justify-between min-h-[200px] hover:border-[var(--border-medium)] hover:shadow-sm transition-all"
                                        >
                                            {/* Header with Status and Actions */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1 min-w-0 pr-12">
                                                    <h3 className="text-base font-normal text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors truncate mb-1" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                        {report.name}
                                                    </h3>
                                                    <p className="text-xs text-[var(--text-secondary)] truncate">
                                                        {report.templateName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {/* Status Badge */}
                                                    <div className={`px-2 py-0.5 text-xs font-medium rounded ${status.bg} ${status.color}`}>
                                                        {status.label}
                                                    </div>
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteReport(report.id, e);
                                                        }}
                                                        className="text-[var(--text-tertiary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                    <User size={12} className="text-[var(--text-tertiary)]" />
                                                    <span className="truncate">{report.createdByName}</span>
                                                </div>
                                                {report.reviewerName && (
                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                        <User size={12} className="text-[var(--text-tertiary)]" />
                                                        <span className="truncate">{report.reviewerName}</span>
                                                    </div>
                                                )}
                                                {report.deadline && (
                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                        <Calendar size={12} className="text-[var(--text-tertiary)]" />
                                                        <span>{new Date(report.deadline).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="mt-5 pt-4 border-t border-[var(--border-light)] flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                                                <span>Updated {new Date(report.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Templates View */}
                    {currentView === 'templates' && (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Report Templates</h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">Templates define the structure of your documents</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreateWithAI}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Bot size={14} />
                                    Create with AI
                                </button>
                                <button
                                    onClick={handleCreateTemplate}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Plus size={14} />
                                    New Template
                                </button>
                            </div>
                        </div>

                        {/* Search Templates */}
                        {templates.length > 0 && (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    placeholder="Search templates by name..."
                                    value={templatesSearch}
                                    onChange={(e) => setTemplatesSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--border-medium)] outline-none placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                />
                            </div>
                        )}

                        {templatesLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="animate-spin text-[var(--text-tertiary)]" size={24} />
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="bg-[var(--bg-card)] rounded-lg border border-dashed border-[var(--border-light)] p-12 text-center">
                                <FileText className="mx-auto text-[var(--text-tertiary)]" size={48} />
                                <p className="text-[var(--text-secondary)] mt-4 text-sm font-medium">No templates yet</p>
                                <p className="text-[var(--text-tertiary)] text-xs mt-1">Create your first template to structure your documents</p>
                                <button
                                    onClick={handleCreateTemplate}
                                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                                >
                                    <Plus size={16} />
                                    Create Template
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {templates
                                    .filter(template => {
                                        if (!templatesSearch.trim()) return true;
                                        return template.name.toLowerCase().includes(templatesSearch.toLowerCase());
                                    })
                                    .map((template) => {
                                    const IconComponent = getIconComponent(template.icon);
                                    const totalItems = template.sections.reduce((sum, section) => sum + section.items.length, 0);
                                    return (
                                        <div
                                            key={template.id}
                                            className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 hover:border-[var(--border-medium)] hover:shadow-md transition-all cursor-pointer flex flex-col"
                                            onClick={(e) => {
                                                if (!(e.target as HTMLElement).closest('button')) {
                                                    handleEditTemplate(template, e);
                                                }
                                            }}
                                        >
                                            {/* Action buttons */}
                                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button
                                                    onClick={(e) => handleEditTemplate(template, e)}
                                                    className="p-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-secondary)] transition-colors shadow-sm"
                                                    title="Edit template"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteTemplate(template.id, e)}
                                                    className="p-1.5 bg-[var(--bg-card)] border border-red-200 hover:bg-red-50 rounded-md text-red-600 transition-colors shadow-sm"
                                                    title="Delete template"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Header with icon and title */}
                                            <div className="flex items-start gap-3 pr-12 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 group-hover:bg-[var(--bg-hover)] transition-all">
                                                    <IconComponent size={20} className="text-[var(--text-secondary)]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-normal text-sm text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors leading-tight" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                        {template.name}
                                                    </h3>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            {template.description && (
                                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-4 leading-relaxed">
                                                    {template.description}
                                                </p>
                                            )}
                                            
                                            {/* Footer stats */}
                                            <div className="mt-auto pt-3 border-t border-[var(--border-light)] flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                                <div className="flex items-center gap-1.5">
                                                    <FileText size={12} className="text-[var(--text-tertiary)]" />
                                                    <span className="font-medium text-[var(--text-secondary)]">{template.sections.length}</span>
                                                    <span>section{template.sections.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                {totalItems > 0 && (
                                                    <>
                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clipboard size={12} className="text-[var(--text-tertiary)]" />
                                                            <span className="font-medium text-[var(--text-secondary)]">{totalItems}</span>
                                                            <span>item{totalItems !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Reports View */}
                    {currentView === 'reports' && (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div>
                            <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Generated Reports</h2>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
                        </div>

                        {reportsLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="animate-spin text-[var(--text-tertiary)]" size={24} />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="bg-[var(--bg-card)] rounded-lg border border-dashed border-[var(--border-light)] p-12 text-center">
                                <FileText className="mx-auto text-[var(--text-tertiary)]" size={48} />
                                <p className="text-[var(--text-secondary)] mt-4 text-sm font-medium">No reports yet</p>
                                <p className="text-[var(--text-tertiary)] text-xs mt-1">Generated reports will appear here</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {reports.map((report) => {
                                    const status = statusConfig[report.status];
                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => navigate(`/documents/${report.id}`)}
                                            className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer flex flex-col justify-between min-h-[200px] hover:border-[var(--border-medium)] hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1 min-w-0 pr-12">
                                                    <h3 className="text-base font-normal text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors truncate mb-1">
                                                        {report.name}
                                                    </h3>
                                                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                                                        {report.templateName}
                                                    </p>
                                                </div>
                                                <div className={`px-2 py-0.5 text-xs font-medium rounded ${status.bg} ${status.color}`}>
                                                    {status.label}
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                    <User size={12} className="text-[var(--text-tertiary)]" />
                                                    <span className="truncate">{report.createdByName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                                                    <Calendar size={12} />
                                                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
                        setTemplateUsage(null);
                    }}
                    usage={templateUsage}
                />
            )}

            {/* New Report Modal */}
            {showNewReportModal && (
                <NewReportModal
                    templates={templates}
                    orgUsers={orgUsers}
                    onSave={handleCreateReport}
                    onClose={() => setShowNewReportModal(false)}
                />
            )}

            {/* AI Template Assistant Modal */}
            {showAiAssistant && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40 backdrop-blur-sm pointer-events-none" onClick={() => setShowAiAssistant(false)}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                                    <Bot size={18} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                        Create Template with AI
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Describe the template you want to create</p>
                                </div>
                                <button
                                    onClick={() => setShowAiAssistant(false)}
                                    className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            {!aiGeneratedTemplate ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            What kind of report template do you need?
                                        </label>
                                        <textarea
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            placeholder="Example: Create a production quality report template with sections for batch records, quality checks, deviations, and corrective actions..."
                                            rows={5}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                            autoFocus
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-2">
                                            Be specific about sections, document goal, and entity data model you want included
                                        </p>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setShowAiAssistant(false)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleGenerateTemplate}
                                            disabled={!aiPrompt.trim() || isGeneratingTemplate}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isGeneratingTemplate ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={14} />
                                                    Generate Template
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-light)]">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                                                {React.createElement(getIconComponent(aiGeneratedTemplate.icon), { size: 20, className: "text-[var(--text-secondary)]" })}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">{aiGeneratedTemplate.name}</h4>
                                                {aiGeneratedTemplate.description && (
                                                    <p className="text-xs text-[var(--text-secondary)]">{aiGeneratedTemplate.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)]">
                                            <span className="font-medium">{aiGeneratedTemplate.sections.length}</span> sections •{' '}
                                            <span className="font-medium">
                                                {aiGeneratedTemplate.sections.reduce((sum, s) => sum + s.items.length, 0)}
                                            </span>{' '}
                                            items • <span className="font-medium">{aiGeneratedTemplate.suggestedEntities?.length || 0}</span> entities
                                        </div>
                                        {aiGeneratedTemplate.suggestedDocument?.name && (
                                            <p className="text-xs text-[var(--text-secondary)] mt-2">
                                                Suggested document: <span className="font-medium">{aiGeneratedTemplate.suggestedDocument.name}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => {
                                                setAiGeneratedTemplate(null);
                                                setAiPrompt('');
                                            }}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                        >
                                            Try Again
                                        </button>
                                        <button
                                            onClick={handleUseGeneratedTemplate}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                        >
                                            Use This Template
                                        </button>
                                        <button
                                            onClick={handleCreateAllWithAI}
                                            disabled={isApplyingAiBundle}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isApplyingAiBundle ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>Create Template + Document + Entities</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// New Report Modal Component
interface NewReportModalProps {
    templates: ReportTemplate[];
    orgUsers: OrgUser[];
    onSave: (data: { name: string; description: string; templateId: string; reviewerId: string | null; deadline: string | null }) => void;
    onClose: () => void;
}

const NewReportModal: React.FC<NewReportModalProps> = ({ templates, orgUsers, onSave, onClose }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [reviewerId, setReviewerId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            alert('Please enter a document name');
            return;
        }
        if (!templateId) {
            alert('Please select a template');
            return;
        }

        setIsCreating(true);
        await onSave({
            name: name.trim(),
            description: description.trim(),
            templateId,
            reviewerId: reviewerId || null,
            deadline: deadline || null
        });
        setIsCreating(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-lg">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-secondary)]/50">
                    <h2 className="text-sm font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>New Document</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                    >
                        <X size={20} className="text-[var(--text-secondary)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                            Document Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q4 Production Audit"
                            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--border-medium)] outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Description <span className="text-[var(--text-tertiary)]">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this document..."
                            rows={2}
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Template *
                        </label>
                        <select
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-[var(--bg-card)]"
                        >
                            <option value="">Select a template...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {templates.length === 0 && (
                            <p className="text-sm text-amber-600 mt-1">
                                No templates available. Create a template first.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Reviewer <span className="text-[var(--text-tertiary)]">(optional)</span>
                        </label>
                        <select
                            value={reviewerId}
                            onChange={(e) => setReviewerId(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-[var(--bg-card)]"
                        >
                            <option value="">No reviewer assigned</option>
                            {orgUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Deadline <span className="text-[var(--text-tertiary)]">(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating || templates.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-[#256A65] hover:bg-[#1e554f] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:shadow-none"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Create Document
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Template Edit Modal Component
interface TemplateEditModalProps {
    template: ReportTemplate | null;
    onSave: (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onClose: () => void;
    usage?: { inUse: boolean; reportCount: number; reports: any[] } | null;
}

const TemplateEditModal: React.FC<TemplateEditModalProps> = ({ template, onSave, onClose, usage }) => {
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [icon, setIcon] = useState(template?.icon || 'FileText');
    const [sections, setSections] = useState<TemplateSection[]>(
        template?.sections || [{ title: '', items: [], isExpanded: true }]
    );
    const [isSaving, setIsSaving] = useState(false);
    const [showUsageWarning, setShowUsageWarning] = useState(false);

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
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0 bg-[var(--bg-secondary)]/50">
                    <h2 className="text-sm font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                        {template ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                    >
                        <X size={20} className="text-[var(--text-secondary)]" />
                    </button>
                </div>

                {/* Usage Warning */}
                {usage?.inUse && (
                    <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-medium text-amber-500">
                                    This template is used in {usage.reportCount} document{usage.reportCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-500/70 mt-1">
                                    Modifying sections may affect existing documents. Changes to section structure will be applied.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {usage.reports.slice(0, 5).map((report: any) => (
                                        <span key={report.id} className="px-2 py-0.5 bg-amber-500/15 text-amber-500 rounded text-xs">
                                            {report.name}
                                        </span>
                                    ))}
                                    {usage.reports.length > 5 && (
                                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-500 rounded text-xs">
                                            +{usage.reports.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                                Template Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Monthly Production Report"
                                className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
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
                                                : 'border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-secondary)]'
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
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this template"
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>

                    {/* Sections */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Sections</label>
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
                                <div key={sIdx} className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                    {/* Section Header */}
                                    <div className="bg-[var(--bg-secondary)] px-4 py-3 flex items-center gap-3">
                                        <button
                                            onClick={() => toggleSection(sIdx)}
                                            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                        >
                                            {section.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        <span className="text-sm text-[var(--text-secondary)] font-medium">Section {sIdx + 1} Title</span>
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                                            placeholder="e.g., 1. Executive summary"
                                            className="flex-1 px-2 py-1 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
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
                                                        <div key={iIdx} className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-light)]">
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <GripVertical size={16} className="text-[var(--text-tertiary)] mt-2 shrink-0" />
                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Item Title</label>
                                                                        <input
                                                                            type="text"
                                                                            value={item.title}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { title: e.target.value })}
                                                                            placeholder="e.g., Audit key compliance indicators"
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Content</label>
                                                                        <textarea
                                                                            value={item.content}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { content: e.target.value })}
                                                                            placeholder="Description or details for this item..."
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Generation Rules <span className="text-[var(--text-tertiary)]">(optional)</span></label>
                                                                        <textarea
                                                                            value={item.generationRules}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { generationRules: e.target.value })}
                                                                            placeholder="e.g., Use formal tone, include specific examples, max 200 words..."
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
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
                                                <div className="text-center py-4 border-2 border-dashed border-[var(--border-light)] rounded-lg">
                                                    <p className="text-sm text-[var(--text-tertiary)]">No items in this section</p>
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
                                <div className="text-center py-8 border-2 border-dashed border-[var(--border-light)] rounded-lg">
                                    <p className="text-[var(--text-secondary)]">No sections yet</p>
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
                <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-2 bg-[#256A65] hover:bg-[#1e554f] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:shadow-none"
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
