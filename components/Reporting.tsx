import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { 
    Sparkles, FileText, FlaskConical, Clipboard, Wrench, AlertTriangle, Download,
    Plus, Trash2, Edit3, X, ChevronDown, ChevronRight, GripVertical, Save, Loader2,
    Clock, User, Calendar, FileCheck, MoreVertical, Search
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
    draft: { label: 'Draft', color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-200' },
    review: { label: 'In Review', color: 'text-blue-600', bg: 'bg-blue-50', borderColor: 'border-blue-200' },
    ready_to_send: { label: 'Ready', color: 'text-teal-600', bg: 'bg-teal-50', borderColor: 'border-teal-200' }
};

export const Reporting: React.FC<ReportingProps> = ({ entities, companyInfo, onViewChange }) => {
    const navigate = useNavigate();
    
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
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const res = await fetch(`${API_BASE}/report-templates/${templateId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setTemplates(prev => prev.filter(t => t.id !== templateId));
            }
        } catch (error) {
            console.error('Error deleting template:', error);
        }
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
                navigate(`/reports/${id}`);
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

    return (
        <div className="flex flex-col h-full bg-slate-50 relative" data-tutorial="reports-content">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <Sparkles className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
                        <p className="text-xs text-slate-500">Create and manage your documents</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu onNavigate={onViewChange} />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* My Documents Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileCheck className="text-teal-600" size={20} />
                            <h2 className="text-lg font-semibold text-slate-800">My Documents</h2>
                            <span className="text-xs text-slate-400 ml-2">{reports.length} document{reports.length !== 1 ? 's' : ''}</span>
                            <button
                                onClick={() => setShowNewReportModal(true)}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                New Document
                            </button>
                        </div>

                        {/* Search Documents */}
                        {reports.length > 0 && (
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, creator or reviewer..."
                                    value={documentsSearch}
                                    onChange={(e) => setDocumentsSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                            </div>
                        )}

                        {reportsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-teal-600" size={24} />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                <FileText className="mx-auto text-slate-300" size={48} />
                                <p className="text-slate-500 mt-2">No documents yet</p>
                                <p className="text-slate-400 text-sm mt-1">Create your first document to get started</p>
                                <button
                                    onClick={() => setShowNewReportModal(true)}
                                    className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Create Document
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                            onClick={() => navigate(`/reports/${report.id}`)}
                                            className={`group relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md cursor-pointer bg-white ${status.borderColor} hover:border-teal-400`}
                                        >
                                            {/* Status Badge */}
                                            <div className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => handleDeleteReport(report.id, e)}
                                                className="absolute top-3 right-20 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>

                                            <div className="pr-16">
                                                <h3 className="font-semibold text-slate-800 mb-1 truncate">
                                                    {report.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 mb-3">
                                                    {report.templateName}
                                                </p>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <User size={14} className="text-slate-400" />
                                                    <span className="truncate">Creator: {report.createdByName}</span>
                                                </div>
                                                {report.reviewerName && (
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <User size={14} className="text-blue-400" />
                                                        <span className="truncate">Reviewer: {report.reviewerName}</span>
                                                    </div>
                                                )}
                                                {report.deadline && (
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Calendar size={14} className="text-amber-500" />
                                                        <span>{new Date(report.deadline).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                                <span>Updated {new Date(report.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Templates Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="text-teal-600" size={20} />
                            <h2 className="text-lg font-semibold text-slate-800">Report Templates</h2>
                            <span className="text-xs text-slate-400 ml-2">Templates define the structure of your documents</span>
                            <button
                                onClick={handleCreateTemplate}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                New Template
                            </button>
                        </div>

                        {/* Search Templates */}
                        {templates.length > 0 && (
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search templates by name..."
                                    value={templatesSearch}
                                    onChange={(e) => setTemplatesSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                            </div>
                        )}

                        {templatesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-teal-600" size={24} />
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                <FileText className="mx-auto text-slate-300" size={48} />
                                <p className="text-slate-500 mt-2">No templates yet</p>
                                <p className="text-slate-400 text-sm mt-1">Create your first template to structure your documents</p>
                                <button
                                    onClick={handleCreateTemplate}
                                    className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Create Template
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {templates
                                    .filter(template => {
                                        if (!templatesSearch.trim()) return true;
                                        return template.name.toLowerCase().includes(templatesSearch.toLowerCase());
                                    })
                                    .map((template) => {
                                    const IconComponent = getIconComponent(template.icon);
                                    return (
                                        <div
                                            key={template.id}
                                            className="group relative p-4 rounded-lg border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm transition-all"
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
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                                    <IconComponent size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-sm text-slate-800 truncate">
                                                        {template.name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                                        {template.description}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        {template.sections.length} section{template.sections.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">New Document</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Document Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q4 Production Audit"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description <span className="text-slate-400">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this document..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Template *
                        </label>
                        <select
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Reviewer <span className="text-slate-400">(optional)</span>
                        </label>
                        <select
                            value={reviewerId}
                            onChange={(e) => setReviewerId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                        >
                            <option value="">No reviewer assigned</option>
                            {orgUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Deadline <span className="text-slate-400">(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating || templates.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg font-medium transition-colors"
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

                {/* Usage Warning */}
                {usage?.inUse && (
                    <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-medium text-amber-800">
                                    This template is used in {usage.reportCount} document{usage.reportCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Modifying sections may affect existing documents. Changes to section structure will be applied.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {usage.reports.slice(0, 5).map((report: any) => (
                                        <span key={report.id} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                            {report.name}
                                        </span>
                                    ))}
                                    {usage.reports.length > 5 && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
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
