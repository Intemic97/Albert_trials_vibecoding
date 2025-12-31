import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FileText, ArrowLeft, Eye, Upload, Sparkles, Check, Clock, Send,
    ChevronRight, Loader2, X, File, Trash2, CheckCircle2, Circle,
    Save, AlertCircle, User, Calendar, MessageSquare, MoreVertical,
    Edit3, CheckCheck, CornerDownRight
} from 'lucide-react';
import { Entity } from '../types';
import { PromptInput } from './PromptInput';
import { ProfileMenu } from './ProfileMenu';
import { API_BASE } from '../config';

interface ReportEditorProps {
    entities: Entity[];
    companyInfo?: any;
    onViewChange?: (view: string) => void;
}

interface TemplateSection {
    id: string;
    parentId: string | null;
    title: string;
    content: string;
    generationRules: string;
    sortOrder: number;
    // Merged from report_sections
    reportSectionId?: string;
    generatedContent?: string | null;
    userPrompt?: string | null;
    sectionStatus: 'empty' | 'generated' | 'edited';
    generatedAt?: string | null;
}

interface ReportContext {
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
}

interface Report {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'review' | 'ready_to_send';
    templateId: string;
    templateName: string;
    createdBy: string;
    createdByName: string;
    reviewerId?: string;
    reviewerName?: string;
    deadline?: string;
    createdAt: string;
    updatedAt: string;
    sections: TemplateSection[];
    contexts: ReportContext[];
}

interface Comment {
    id: string;
    reportId: string;
    sectionId: string;
    userId: string;
    userName: string;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    commentText: string;
    suggestionText?: string;
    status: 'open' | 'resolved';
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolvedByName?: string;
}

type TabType = 'preview' | 'context' | 'generate' | 'review';

const statusConfig = {
    draft: { label: 'Draft', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
    review: { label: 'Review', color: 'text-blue-600', bg: 'bg-blue-50', icon: Eye },
    ready_to_send: { label: 'Ready to Send', color: 'text-teal-600', bg: 'bg-teal-50', icon: Send }
};

export const ReportEditor: React.FC<ReportEditorProps> = ({ entities, companyInfo, onViewChange }) => {
    const { reportId } = useParams<{ reportId: string }>();
    const navigate = useNavigate();
    
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('preview');
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingContent, setEditingContent] = useState<string>('');
    
    // Comments state
    const [comments, setComments] = useState<Comment[]>([]);
    const [selectedText, setSelectedText] = useState<{ text: string; start: number; end: number } | null>(null);
    const [newCommentText, setNewCommentText] = useState('');
    const [newSuggestionText, setNewSuggestionText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (reportId) {
            fetchReport();
            fetchComments();
        }
    }, [reportId]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports/${reportId}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data);
                // Select first parent section by default
                const firstParent = data.sections.find((s: TemplateSection) => !s.parentId);
                if (firstParent) {
                    setSelectedSectionId(firstParent.id);
                    setEditingContent(firstParent.generatedContent || '');
                }
            } else {
                navigate('/reports');
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            navigate('/reports');
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            const res = await fetch(`${API_BASE}/reports/${reportId}/comments`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !contentRef.current) {
            setSelectedText(null);
            setShowCommentInput(false);
            return;
        }

        const text = selection.toString().trim();
        if (!text) {
            setSelectedText(null);
            return;
        }

        // Get the range and calculate offsets relative to the content
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(contentRef.current);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;

        setSelectedText({
            text,
            start,
            end: start + text.length
        });
        setShowCommentInput(true);
    };

    const handleAddComment = async () => {
        if (!report || !selectedSectionId || !selectedText || !newCommentText.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sectionId: selectedSectionId,
                    selectedText: selectedText.text,
                    startOffset: selectedText.start,
                    endOffset: selectedText.end,
                    commentText: newCommentText,
                    suggestionText: newSuggestionText || null
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const comment = await res.json();
                setComments(prev => [comment, ...prev]);
                setSelectedText(null);
                setNewCommentText('');
                setNewSuggestionText('');
                setShowCommentInput(false);
                window.getSelection()?.removeAllRanges();
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleCancelComment = () => {
        setSelectedText(null);
        setNewCommentText('');
        setNewSuggestionText('');
        setShowCommentInput(false);
        window.getSelection()?.removeAllRanges();
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!report || !editCommentText.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/comments/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentText: editCommentText }),
                credentials: 'include'
            });

            if (res.ok) {
                setComments(prev => prev.map(c => 
                    c.id === commentId ? { ...c, commentText: editCommentText } : c
                ));
                setEditingCommentId(null);
                setEditCommentText('');
            }
        } catch (error) {
            console.error('Error updating comment:', error);
        }
    };

    const handleResolveComment = async (commentId: string, resolved: boolean) => {
        if (!report) return;

        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/comments/${commentId}/resolve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolved }),
                credentials: 'include'
            });

            if (res.ok) {
                setComments(prev => prev.map(c => 
                    c.id === commentId ? { ...c, status: resolved ? 'resolved' : 'open' } : c
                ));
            }
        } catch (error) {
            console.error('Error resolving comment:', error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!report || !confirm('Are you sure you want to delete this comment?')) return;

        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/comments/${commentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    // Get comments for current section
    const sectionComments = comments.filter(c => c.sectionId === selectedSectionId);
    const openCommentsCount = comments.filter(c => c.status === 'open').length;

    const handleStatusChange = async (newStatus: 'draft' | 'review' | 'ready_to_send') => {
        if (!report) return;
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
                credentials: 'include'
            });
            if (res.ok) {
                setReport({ ...report, status: newStatus });
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !report) return;
        
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/context`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if (res.ok) {
                const newContext = await res.json();
                setReport({
                    ...report,
                    contexts: [newContext, ...report.contexts]
                });
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteContext = async (contextId: string) => {
        if (!report) return;
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/context/${contextId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setReport({
                    ...report,
                    contexts: report.contexts.filter(c => c.id !== contextId)
                });
            }
        } catch (error) {
            console.error('Error deleting context:', error);
        }
    };

    const handleGenerate = async (prompt: string, mentionedEntityIds: string[]) => {
        if (!report || !selectedSectionId || !prompt.trim()) return;
        
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/sections/${selectedSectionId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mentionedEntityIds }),
                credentials: 'include'
            });
            
            if (res.ok) {
                const { content, generatedAt } = await res.json();
                setEditingContent(content);
                
                // Update the section in state
                setReport({
                    ...report,
                    sections: report.sections.map(s => 
                        s.id === selectedSectionId 
                            ? { ...s, generatedContent: content, sectionStatus: 'generated' as const, generatedAt, userPrompt: prompt }
                            : s
                    )
                });
            }
        } catch (error) {
            console.error('Error generating content:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveSection = async () => {
        if (!report || !selectedSectionId) return;
        
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/sections/${selectedSectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editingContent }),
                credentials: 'include'
            });
            
            if (res.ok) {
                setReport({
                    ...report,
                    sections: report.sections.map(s => 
                        s.id === selectedSectionId 
                            ? { ...s, generatedContent: editingContent, sectionStatus: 'edited' as const }
                            : s
                    )
                });
            }
        } catch (error) {
            console.error('Error saving section:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedSection = report?.sections.find(s => s.id === selectedSectionId);
    const parentSections = report?.sections.filter(s => !s.parentId) || [];
    const getSubsections = (parentId: string) => report?.sections.filter(s => s.parentId === parentId) || [];

    // Function to highlight text with comments and current selection
    const getHighlightedContent = () => {
        if (!selectedSection?.generatedContent) return '';
        
        const text = selectedSection.generatedContent;
        const sectionId = selectedSection.id;
        const sectionComms = comments.filter(c => c.sectionId === sectionId && c.status === 'open');
        
        // Collect all highlights: existing comments + current selection
        const allHighlights: Array<{ start: number; end: number; id: string; isTemp: boolean }> = [];
        
        // Add existing comments
        sectionComms.forEach(c => {
            allHighlights.push({ start: c.startOffset, end: c.endOffset, id: c.id, isTemp: false });
        });
        
        // Add current selection if we're in the same section and have text selected
        if (selectedText && selectedSectionId === sectionId && showCommentInput) {
            allHighlights.push({ start: selectedText.start, end: selectedText.end, id: 'temp-selection', isTemp: true });
        }
        
        if (!allHighlights.length) return text;

        // Sort by start offset descending to replace from end to start (to avoid offset issues)
        const sorted = [...allHighlights].sort((a, b) => b.start - a.start);
        
        let result = text;
        for (const highlight of sorted) {
            const before = result.slice(0, highlight.start);
            const highlighted = result.slice(highlight.start, highlight.end);
            const after = result.slice(highlight.end);
            
            if (highlight.isTemp) {
                // Temporary selection highlight (cyan for current selection)
                result = `${before}<mark class="bg-cyan-200 ring-2 ring-cyan-400">${highlighted}</mark>${after}`;
            } else {
                // Existing comment highlight (yellow)
                result = `${before}<mark class="bg-yellow-200 cursor-pointer hover:bg-yellow-300" data-comment-id="${highlight.id}">${highlighted}</mark>${after}`;
            }
        }
        return result;
    };

    // Compute highlighted HTML - this will update when relevant state changes
    const highlightedHtml = getHighlightedContent();
    
    // Check if all parent sections have generated content
    const allSectionsComplete = parentSections.every(s => 
        s.sectionStatus === 'generated' || s.sectionStatus === 'edited'
    );
    const completedSectionsCount = parentSections.filter(s => 
        s.sectionStatus === 'generated' || s.sectionStatus === 'edited'
    ).length;

    const getSectionStatus = (section: TemplateSection) => {
        if (section.sectionStatus === 'generated' || section.sectionStatus === 'edited') {
            return { icon: CheckCircle2, color: 'text-teal-500' };
        }
        return { icon: Circle, color: 'text-slate-300' };
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50">
                <Loader2 className="animate-spin text-teal-600" size={32} />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50">
                <p className="text-slate-500">Report not found</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/reports')}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">{report.name}</h1>
                                <p className="text-sm text-slate-500">
                                    {report.templateName} • Created by {report.createdByName}
                                </p>
                            </div>
                        </div>
                        <ProfileMenu onNavigate={onViewChange} />
                    </div>

                    {/* Status Progress */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-500 mr-2">Status:</span>
                        {(['draft', 'review', 'ready_to_send'] as const).map((status, idx) => {
                            const config = statusConfig[status];
                            const StatusIcon = config.icon;
                            const isActive = report.status === status;
                            const currentStatusIndex = ['draft', 'review', 'ready_to_send'].indexOf(report.status);
                            const isPast = currentStatusIndex > idx;
                            // Line should be green if we've reached or passed that stage
                            const isLineComplete = currentStatusIndex >= idx;
                            // Review button is disabled if not all sections are complete
                            const isDisabled = status === 'review' && !allSectionsComplete && report.status === 'draft';
                            
                            return (
                                <React.Fragment key={status}>
                                    {idx > 0 && (
                                        <div className={`flex-1 h-0.5 ${isLineComplete ? 'bg-teal-400' : 'bg-slate-200'}`} />
                                    )}
                                    <div className="relative group">
                                        <button
                                            onClick={() => !isDisabled && handleStatusChange(status)}
                                            disabled={isDisabled}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                                isDisabled
                                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                    : isActive 
                                                        ? `${config.bg} ${config.color} ring-2 ring-offset-2 ring-teal-500/30`
                                                        : isPast
                                                            ? 'bg-teal-50 text-teal-600'
                                                            : 'bg-white text-slate-400 hover:bg-slate-100'
                                            }`}
                                        >
                                            <StatusIcon size={16} />
                                            {config.label}
                                        </button>
                                        {/* Tooltip for disabled Review button */}
                                        {isDisabled && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Complete all sections first ({completedSectionsCount}/{parentSections.length})
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-slate-200 -mb-px">
                        {[
                            { id: 'preview' as const, label: 'Preview', icon: Eye },
                            { id: 'context' as const, label: 'Context', icon: Upload, badge: report.contexts.length },
                            { id: 'generate' as const, label: 'Generate', icon: Sparkles },
                            { id: 'review' as const, label: 'Review', icon: MessageSquare, badge: openCommentsCount, disabled: report.status !== 'review' }
                        ].map(tab => {
                            const TabIcon = tab.icon;
                            const isDisabled = 'disabled' in tab && tab.disabled;
                            return (
                                <div key={tab.id} className="relative group">
                                    <button
                                        onClick={() => !isDisabled && setActiveTab(tab.id)}
                                        disabled={isDisabled}
                                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                            isDisabled
                                                ? 'border-transparent text-slate-300 cursor-not-allowed'
                                                : activeTab === tab.id
                                                    ? 'border-teal-500 text-teal-600'
                                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <TabIcon size={18} />
                                        {tab.label}
                                        {tab.badge !== undefined && tab.badge > 0 && (
                                            <span className="px-1.5 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                    {/* Tooltip for disabled Review tab */}
                                    {isDisabled && tab.id === 'review' && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                            {report.status === 'draft' ? 'Change status to Review first' : 'Document is ready to send'}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Sidebar - Sections */}
                <aside className="w-72 bg-white border-r border-slate-200 overflow-y-auto shrink-0">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-700">SECTIONS</h3>
                        </div>
                        <nav className="space-y-1">
                            {parentSections.map((section, idx) => {
                                const status = getSectionStatus(section);
                                const StatusIcon = status.icon;
                                const subsections = getSubsections(section.id);
                                const isSelected = selectedSectionId === section.id;
                                
                                const sectionCommentCount = comments.filter(c => c.sectionId === section.id && c.status === 'open').length;
                                
                                return (
                                    <div key={section.id}>
                                        <button
                                            onClick={() => {
                                                setSelectedSectionId(section.id);
                                                setEditingContent(section.generatedContent || '');
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-teal-50 text-teal-700 border-l-4 border-teal-500'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <StatusIcon size={16} className={status.color} />
                                            <span className="flex-1 truncate text-sm">{section.title}</span>
                                            {sectionCommentCount > 0 && (
                                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
                                                    {sectionCommentCount}
                                                </span>
                                            )}
                                        </button>
                                        
                                        {subsections.length > 0 && (
                                            <div className="ml-4 pl-3 border-l border-slate-200 mt-1 space-y-1">
                                                {subsections.map(sub => {
                                                    const subStatus = getSectionStatus(sub);
                                                    const SubStatusIcon = subStatus.icon;
                                                    const isSubSelected = selectedSectionId === sub.id;
                                                    const subCommentCount = comments.filter(c => c.sectionId === sub.id && c.status === 'open').length;
                                                    
                                                    return (
                                                        <button
                                                            key={sub.id}
                                                            onClick={() => {
                                                                setSelectedSectionId(sub.id);
                                                                setEditingContent(sub.generatedContent || '');
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                                                                isSubSelected
                                                                    ? 'bg-teal-50 text-teal-700'
                                                                    : 'hover:bg-slate-50 text-slate-600'
                                                            }`}
                                                        >
                                                            <SubStatusIcon size={14} className={subStatus.color} />
                                                            <span className="flex-1 truncate">{sub.title}</span>
                                                            {subCommentCount > 0 && (
                                                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
                                                                    {subCommentCount}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                    
                    {/* Report Info */}
                    <div className="p-4 border-t border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Document Info</h4>
                        {report.createdByName && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                <User size={14} />
                                <span>Creator: {report.createdByName}</span>
                            </div>
                        )}
                        {report.reviewerName && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                <User size={14} />
                                <span>Reviewer: {report.reviewerName}</span>
                            </div>
                        )}
                        {report.deadline && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar size={14} />
                                <span>Deadline: {new Date(report.deadline).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-6">
                    {/* Preview Tab */}
                    {activeTab === 'preview' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-800">
                                            {selectedSection?.title || 'Select a section'}
                                        </h2>
                                        {selectedSection && (
                                            <p className="text-sm text-slate-500 mt-1">
                                                {selectedSection.sectionStatus === 'empty' ? 'No content yet' : 
                                                 selectedSection.sectionStatus === 'generated' ? 'AI Generated' : 'Edited'}
                                            </p>
                                        )}
                                    </div>
                                    {selectedSection?.sectionStatus !== 'empty' && (
                                        <span className="px-2 py-1 text-xs bg-teal-50 text-teal-600 rounded-full flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            Content ready
                                        </span>
                                    )}
                                </div>
                                <div className="p-6 min-h-[400px]">
                                    {selectedSection?.generatedContent ? (
                                        <div className="prose prose-slate max-w-none whitespace-pre-wrap">
                                            {selectedSection.generatedContent}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                            <FileText size={48} className="mb-3 opacity-50" />
                                            <p>No content generated yet</p>
                                            <p className="text-sm mt-1">Go to Generate tab to create content</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Context Tab */}
                    {activeTab === 'context' && (
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-800">Context Documents</h2>
                                        <p className="text-sm text-slate-500">Upload PDFs to provide context for AI generation</p>
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <div 
                                    className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer mb-6"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {isUploading ? (
                                        <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
                                    ) : (
                                        <Upload className="mx-auto text-slate-300" size={32} />
                                    )}
                                    <p className="mt-2 text-slate-600 font-medium">
                                        {isUploading ? 'Uploading...' : 'Click to upload PDF'}
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        The text will be extracted and used as context
                                    </p>
                                </div>

                                {/* Uploaded Files */}
                                {report.contexts.length > 0 ? (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-slate-700 mb-2">Uploaded Documents</h3>
                                        {report.contexts.map(ctx => (
                                            <div 
                                                key={ctx.id} 
                                                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group"
                                            >
                                                <File className="text-red-500" size={20} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{ctx.fileName}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {formatFileSize(ctx.fileSize)} • {new Date(ctx.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteContext(ctx.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-400 text-sm">
                                        No context documents uploaded yet
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Generate Tab */}
                    {activeTab === 'generate' && (
                        <div className="flex gap-6 h-full">
                            {/* Main Content */}
                            <div className="flex-1 overflow-y-auto space-y-6">
                                {/* Section Info */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">
                                                {selectedSection?.title || 'Select a section'}
                                            </h2>
                                            {selectedSection?.content && (
                                                <p className="text-sm text-slate-500 mt-1">{selectedSection.content}</p>
                                            )}
                                        </div>
                                        {report.contexts.length > 0 && (
                                            <span className="px-2 py-1 text-xs bg-teal-50 text-teal-600 rounded-full">
                                                {report.contexts.length} context doc{report.contexts.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>

                                    {selectedSection?.generationRules && (
                                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
                                            <p className="text-sm text-amber-800">
                                                <strong>Generation Rules:</strong> {selectedSection.generationRules}
                                            </p>
                                        </div>
                                    )}

                                    {/* Prompt Input */}
                                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Write your prompt for this section
                                        </label>
                                        <PromptInput
                                            key={selectedSectionId}
                                            entities={entities}
                                            companyInfo={companyInfo}
                                            onGenerate={handleGenerate}
                                            isGenerating={isGenerating}
                                            initialValue={selectedSection?.userPrompt || ''}
                                            placeholder="Describe what you want in this section. Mention @entities to include data..."
                                            buttonLabel="Generate"
                                        />
                                    </div>
                                </div>

                                {/* Generated Content */}
                                {(editingContent || selectedSection?.generatedContent) && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                            <h3 className="font-semibold text-slate-800">Generated Content</h3>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setActiveTab('preview')}
                                                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <Eye size={16} className="inline mr-1" />
                                                    Preview
                                                </button>
                                                <button
                                                    onClick={handleSaveSection}
                                                    disabled={isSaving}
                                                    className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {isSaving ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <Save size={16} />
                                                    )}
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <textarea
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                className="w-full min-h-[300px] p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y font-mono text-sm"
                                                placeholder="Generated content will appear here..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Comments Panel */}
                            <div className="w-80 shrink-0 overflow-y-auto">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-800">Comments</h3>
                                        <span className="text-xs text-slate-500">
                                            {sectionComments.filter(c => c.status === 'open').length} open
                                        </span>
                                    </div>

                                    {sectionComments.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No comments for this section</p>
                                            <p className="text-xs mt-1">Comments from Review tab will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {sectionComments.map(comment => (
                                                <div 
                                                    key={comment.id}
                                                    className={`p-3 rounded-lg border transition-all ${
                                                        comment.status === 'resolved'
                                                            ? 'bg-slate-50 border-slate-200 opacity-60'
                                                            : 'bg-white border-slate-200 hover:border-blue-300'
                                                    }`}
                                                >
                                                    {/* Comment Header */}
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <User size={12} className="text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-700">{comment.userName}</p>
                                                                <p className="text-xs text-slate-400">
                                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Resolve Button */}
                                                        {comment.status === 'open' && (
                                                            <button
                                                                onClick={() => handleResolveComment(comment.id, true)}
                                                                className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                                                                title="Mark as resolved"
                                                            >
                                                                <CheckCheck size={14} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Selected Text Preview */}
                                                    <div className="mb-2 px-2 py-1 bg-yellow-100 rounded text-xs text-slate-600 italic">
                                                        "{comment.selectedText.slice(0, 60)}{comment.selectedText.length > 60 ? '...' : ''}"
                                                    </div>

                                                    {/* Comment Text */}
                                                    <p className={`text-sm ${comment.status === 'resolved' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                        {comment.commentText}
                                                    </p>

                                                    {/* Resolved Badge */}
                                                    {comment.status === 'resolved' && (
                                                        <div className="mt-2 flex items-center gap-1 text-xs text-teal-600">
                                                            <CheckCircle2 size={12} />
                                                            Resolved
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Review Tab */}
                    {activeTab === 'review' && (
                        <div className="flex gap-6 h-full">
                            {/* Main Content with Comments */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    {/* Section Header */}
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">
                                                {selectedSection?.title || 'Select a section'}
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Select text to add comments • {sectionComments.filter(c => c.status === 'open').length} open comment{sectionComments.filter(c => c.status === 'open').length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleStatusChange('ready_to_send')}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <Send size={14} />
                                                Ready to Send
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div 
                                        ref={contentRef}
                                        className="p-6 min-h-[400px] prose prose-slate max-w-none cursor-text relative"
                                        onMouseUp={handleTextSelection}
                                    >
                                        {selectedSection?.generatedContent ? (
                                            <div 
                                                className="whitespace-pre-wrap leading-relaxed select-text"
                                                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'MARK') {
                                                        const commentId = target.dataset.commentId;
                                                        if (commentId) setActiveCommentId(commentId);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                                <FileText size={48} className="mb-3 opacity-50" />
                                                <p>No content in this section</p>
                                            </div>
                                        )}

                                        </div>

                                    {/* Add Comment Input Panel (appears after clicking Add Comment button) */}
                                    {showCommentInput && selectedText && (
                                        <div className="px-6 py-4 border-t border-slate-200 bg-blue-50">
                                            <div className="flex items-start gap-3">
                                                <MessageSquare className="text-blue-500 mt-1 shrink-0" size={18} />
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-sm text-slate-600">
                                                        <span className="font-medium">Selected:</span> "{selectedText.text.slice(0, 80)}{selectedText.text.length > 80 ? '...' : ''}"
                                                    </p>
                                                    <textarea
                                                        value={newCommentText}
                                                        onChange={(e) => setNewCommentText(e.target.value)}
                                                        placeholder="Add your comment..."
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                                        rows={2}
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleAddComment}
                                                            disabled={!newCommentText.trim()}
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            Add Comment
                                                        </button>
                                                        <button
                                                            onClick={handleCancelComment}
                                                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Comments Panel */}
                            <div className="w-80 shrink-0 overflow-y-auto">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-800">Comments</h3>
                                        <span className="text-xs text-slate-500">
                                            {sectionComments.filter(c => c.status === 'open').length} open
                                        </span>
                                    </div>

                                    {sectionComments.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No comments yet</p>
                                            <p className="text-xs mt-1">Select text to add a comment</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {sectionComments.map(comment => (
                                                <div 
                                                    key={comment.id}
                                                    className={`p-3 rounded-lg border transition-all ${
                                                        comment.status === 'resolved'
                                                            ? 'bg-slate-50 border-slate-200 opacity-60'
                                                            : activeCommentId === comment.id
                                                                ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200'
                                                                : 'bg-white border-slate-200 hover:border-blue-300'
                                                    }`}
                                                    onClick={() => setActiveCommentId(comment.id)}
                                                >
                                                    {/* Comment Header */}
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <User size={12} className="text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-700">{comment.userName}</p>
                                                                <p className="text-xs text-slate-400">
                                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Actions Menu */}
                                                        <div className="flex items-center gap-1">
                                                            {comment.status === 'open' ? (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleResolveComment(comment.id, true);
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                                                                        title="Resolve"
                                                                    >
                                                                        <CheckCheck size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingCommentId(comment.id);
                                                                            setEditCommentText(comment.commentText);
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteComment(comment.id);
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleResolveComment(comment.id, false);
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                                                                    title="Reopen"
                                                                >
                                                                    <CornerDownRight size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Selected Text Preview */}
                                                    <div className="mb-2 px-2 py-1 bg-yellow-100 rounded text-xs text-slate-600 italic">
                                                        "{comment.selectedText.slice(0, 60)}{comment.selectedText.length > 60 ? '...' : ''}"
                                                    </div>

                                                    {/* Comment Text */}
                                                    {editingCommentId === comment.id ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                value={editCommentText}
                                                                onChange={(e) => setEditCommentText(e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                                                rows={2}
                                                                autoFocus
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateComment(comment.id)}
                                                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingCommentId(null);
                                                                        setEditCommentText('');
                                                                    }}
                                                                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className={`text-sm ${comment.status === 'resolved' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                            {comment.commentText}
                                                        </p>
                                                    )}

                                                    {/* Resolved Badge */}
                                                    {comment.status === 'resolved' && (
                                                        <div className="mt-2 flex items-center gap-1 text-xs text-teal-600">
                                                            <CheckCircle2 size={12} />
                                                            Resolved
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

