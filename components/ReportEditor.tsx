import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FileText, ArrowLeft, Eye, UploadSimple, Sparkle, Check, Clock, PaperPlaneTilt,
    CaretRight, CaretDown, CaretLeft, SpinnerGap, X, File, Trash, CheckCircle, Circle,
    FloppyDisk, WarningCircle, User, Calendar, ChatCircle, DotsThreeVertical,
    PencilSimple, Checks, ArrowElbowDownRight, Plus, DotsSixVertical, Clipboard,
    Flask, Wrench, Warning, Robot, SidebarSimple, DownloadSimple, GitBranch,
    ArrowRight, UserCircle
} from '@phosphor-icons/react';
import { Entity } from '../types';
import { PromptInput } from './PromptInput';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

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
    workflowStatus: 'draft' | 'review' | 'ready_to_send';
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

// AI Assistant interfaces
interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suggestion?: {
        sectionId: string;
        sectionTitle: string;
        originalContent: string;
        suggestedContent: string;
        status: 'pending' | 'accepted' | 'rejected';
    };
    files?: { name: string; id: string }[];
}

interface AIContextFile {
    id: string;
    name: string;
    size: number;
    uploadedAt: Date;
}

interface AuditLogEntry {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    action: string;
    resourceType: string;
    resourceId: string;
    resourceName: string;
    details: string | null;
    createdAt: string;
}

const statusConfig = {
    draft: { label: 'Draft', color: 'text-amber-500', bg: 'bg-amber-500/15', icon: Clock },
    review: { label: 'Review', color: 'text-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]/15', icon: Eye },
    ready_to_send: { label: 'Done', color: 'text-emerald-500', bg: 'bg-emerald-500/15', icon: PaperPlaneTilt }
};

export const ReportEditor: React.FC<ReportEditorProps> = ({ entities, companyInfo, onViewChange }) => {
    const { reportId } = useParams<{ reportId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
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
    const [isEditMode, setIsEditMode] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState<'comments' | 'assistant'>('comments');
    const [templateData, setTemplateData] = useState<any>(null);
    const [templateUsage, setTemplateUsage] = useState<any>(null);
    
    // AI Assistant states
    const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [aiContextFiles, setAiContextFiles] = useState<AIContextFile[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isUploadingAiFile, setIsUploadingAiFile] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<{
        messageId: string;
        sectionId: string;
        sectionTitle: string;
        originalContent: string;
        suggestedContent: string;
    } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    
    // Audit Trail state
    const [showAuditTrail, setShowAuditTrail] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const aiFileInputRef = useRef<HTMLInputElement>(null);
    const aiMessagesEndRef = useRef<HTMLDivElement>(null);
    const generatedContentRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (reportId) {
            fetchReport();
            fetchComments();
        }
    }, [reportId]);

    // Scroll Spy for Preview tab - detect which section is visible
    useEffect(() => {
        if (activeTab !== 'preview' || !report) return;

        const handleScroll = () => {
            const scrollContainer = document.getElementById('preview-scroll-container');
            if (!scrollContainer) return;

            const sections = report.sections;
            let currentSectionId = selectedSectionId;

            // Find which section is currently most visible in viewport
            // We check from top to bottom and select the first section that's visible
            for (const section of sections) {
                const element = document.getElementById(`preview-section-${section.id}`);
                if (!element) continue;

                const rect = element.getBoundingClientRect();
                // Activate when section's top is within the upper 30% of viewport (more aggressive)
                // This means it highlights earlier as you scroll down
                if (rect.top <= 250 && rect.bottom >= 250) {
                    currentSectionId = section.id;
                    break;
                }
            }

            if (currentSectionId && currentSectionId !== selectedSectionId) {
                setSelectedSectionId(currentSectionId);
            }
        };

        const scrollContainer = document.getElementById('preview-scroll-container');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            // Run once on mount
            handleScroll();
        }

        return () => {
            if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', handleScroll);
            }
        };
    }, [activeTab, report, selectedSectionId]);

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
                navigate('/documents');
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            navigate('/documents');
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

    // Transform flat sections array to nested structure for the modal
    const transformSectionsToNested = (flatSections: any[]) => {
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

    const handleOpenTemplateModal = async () => {
        if (!report) return;
        try {
            // Fetch template data
            const templateRes = await fetch(`${API_BASE}/report-templates/${report.templateId}`, {
                credentials: 'include'
            });
            if (templateRes.ok) {
                const template = await templateRes.json();
                // Transform flat sections to nested structure
                const transformedTemplate = {
                    ...template,
                    sections: transformSectionsToNested(template.sections || [])
                };
                setTemplateData(transformedTemplate);
            }
            
            // Fetch usage data
            const usageRes = await fetch(`${API_BASE}/report-templates/${report.templateId}/usage`, {
                credentials: 'include'
            });
            if (usageRes.ok) {
                const usage = await usageRes.json();
                setTemplateUsage(usage);
            }
            
            setShowTemplateModal(true);
        } catch (error) {
            console.error('Error fetching template:', error);
        }
    };

    const handleSaveTemplate = async (templateUpdate: any) => {
        if (!templateData) return;
        try {
            const res = await fetch(`${API_BASE}/report-templates/${templateData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateUpdate),
                credentials: 'include'
            });
            if (res.ok) {
                setShowTemplateModal(false);
                // Refresh the report to get updated sections
                fetchReport();
            }
        } catch (error) {
            console.error('Error saving template:', error);
        }
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

    const handleSectionWorkflowStatusChange = async (sectionId: string, newStatus: 'draft' | 'review' | 'ready_to_send') => {
        if (!report) return;
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/sections/${sectionId}/workflow-status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowStatus: newStatus }),
                credentials: 'include'
            });
            if (res.ok) {
                setReport({
                    ...report,
                    sections: report.sections.map(s =>
                        s.id === sectionId ? { ...s, workflowStatus: newStatus } : s
                    )
                });
                if (showAuditTrail) {
                    fetchAuditTrail();
                }
            }
        } catch (error) {
            console.error('Error updating section workflow status:', error);
        }
    };

    const fetchAuditTrail = async () => {
        if (!report) return;
        setAuditLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/audit-trail`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data);
            }
        } catch (error) {
            console.error('Error fetching audit trail:', error);
        } finally {
            setAuditLoading(false);
        }
    };

    const toggleAuditTrail = () => {
        const newState = !showAuditTrail;
        setShowAuditTrail(newState);
        if (newState) {
            fetchAuditTrail();
        }
    };

    const getActionLabel = (action: string): string => {
        const labels: Record<string, string> = {
            'create': 'Created document',
            'status_change': 'Status changed',
            'update': 'Updated document',
            'delete': 'Deleted document',
            'generate_content': 'Generated content with AI',
            'upload_context': 'Uploaded context file',
            'add_comment': 'Added comment',
            'resolve_comment': 'Resolved comment',
            'reopen_comment': 'Reopened comment',
            'section_status_change': 'Section status changed',
        };
        return labels[action] || action;
    };

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            'draft': 'Draft',
            'review': 'In Review',
            'ready_to_send': 'Done',
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            'draft': 'text-amber-500',
            'review': 'text-[var(--accent-primary)]',
            'ready_to_send': 'text-emerald-500',
        };
        return colors[status] || 'text-[var(--text-secondary)]';
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'create': return <Plus size={14} weight="bold" />;
            case 'status_change': return <ArrowRight size={14} weight="bold" />;
            case 'section_status_change': return <ArrowRight size={14} weight="bold" />;
            case 'update': return <PencilSimple size={14} weight="bold" />;
            case 'generate_content': return <Sparkle size={14} weight="bold" />;
            case 'add_comment': return <ChatCircle size={14} weight="bold" />;
            case 'resolve_comment': return <CheckCircle size={14} weight="bold" />;
            case 'reopen_comment': return <ChatCircle size={14} weight="bold" />;
            default: return <Circle size={14} weight="fill" />;
        }
    };

    const getActionColor = (action: string): string => {
        switch (action) {
            case 'create': return 'bg-emerald-500';
            case 'status_change': return 'bg-[var(--accent-primary)]';
            case 'section_status_change': return 'bg-[var(--accent-primary)]';
            case 'update': return 'bg-blue-500';
            case 'generate_content': return 'bg-purple-500';
            case 'add_comment': return 'bg-amber-500';
            case 'resolve_comment': return 'bg-emerald-500';
            case 'reopen_comment': return 'bg-amber-500';
            default: return 'bg-[var(--text-secondary)]';
        }
    };

    const formatAuditDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatAuditDateTime = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
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

    // AI Assistant functions
    const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !report) return;
        
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploadingAiFile(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/assistant/files`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if (res.ok) {
                const newFile = await res.json();
                setAiContextFiles(prev => [...prev, {
                    id: newFile.id,
                    name: newFile.fileName,
                    size: newFile.fileSize || 0,
                    uploadedAt: new Date()
                }]);
            }
        } catch (error) {
            console.error('Error uploading AI context file:', error);
        } finally {
            setIsUploadingAiFile(false);
            if (aiFileInputRef.current) {
                aiFileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteAiFile = async (fileId: string) => {
        if (!report) return;
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/assistant/files/${fileId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setAiContextFiles(prev => prev.filter(f => f.id !== fileId));
            }
        } catch (error) {
            console.error('Error deleting AI context file:', error);
        }
    };

    const handleSendAiMessage = async () => {
        if (!report || !aiInput.trim()) return;
        
        const userMessage: AIMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: aiInput,
            timestamp: new Date()
        };
        
        setAiMessages(prev => [...prev, userMessage]);
        setAiInput('');
        setIsAiLoading(true);
        
        // Scroll to bottom
        setTimeout(() => {
            aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        // Determine if we should apply to content based on active tab
        // Only in Generate tab, we apply suggestions to the content area
        const shouldApplyToContent = activeTab === 'generate';
        
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/assistant/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: aiInput,
                    sectionId: selectedSectionId,
                    contextFileIds: aiContextFiles.map(f => f.id),
                    applyToContent: shouldApplyToContent // true only in Generate tab
                }),
                credentials: 'include'
            });
            
            if (res.ok) {
                const data = await res.json();
                
                const messageId = `msg-${Date.now()}-response`;
                const assistantMessage: AIMessage = {
                    id: messageId,
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date(),
                    suggestion: data.suggestion ? {
                        sectionId: data.suggestion.sectionId,
                        sectionTitle: data.suggestion.sectionTitle,
                        originalContent: data.suggestion.originalContent,
                        suggestedContent: data.suggestion.suggestedContent,
                        status: 'pending'
                    } : undefined
                };
                setAiMessages(prev => [...prev, assistantMessage]);
                
                // If there's a suggestion AND we're in Generate tab, show it in the content area
                if (data.suggestion && activeTab === 'generate') {
                    setPendingSuggestion({
                        messageId,
                        sectionId: data.suggestion.sectionId,
                        sectionTitle: data.suggestion.sectionTitle,
                        originalContent: data.suggestion.originalContent,
                        suggestedContent: data.suggestion.suggestedContent
                    });
                    
                    // Scroll to the content area to show the suggestion
                    setTimeout(() => {
                        generatedContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            } else {
                // Error message
                console.error('[AI Assistant] Backend returned error:', res.status, res.statusText);
                const errorText = await res.text();
                console.error('[AI Assistant] Error details:', errorText);
                const errorMessage: AIMessage = {
                    id: `msg-${Date.now()}-error`,
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date()
                };
                setAiMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error('Error sending AI message:', error);
            const errorMessage: AIMessage = {
                id: `msg-${Date.now()}-error`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setAiMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAiLoading(false);
            setTimeout(() => {
                aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    // Show toast notification
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAcceptSuggestion = async (messageId: string) => {
        if (!pendingSuggestion || !report) return;
        
        const { sectionId, suggestedContent } = pendingSuggestion;
        
        try {
            const res = await fetch(`${API_BASE}/reports/${report.id}/sections/${sectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: suggestedContent }),
                credentials: 'include'
            });
            
            if (res.ok) {
                // Update the message suggestion status
                setAiMessages(prev => prev.map(m => 
                    m.id === messageId 
                        ? { ...m, suggestion: { ...m.suggestion!, status: 'accepted' as const } }
                        : m
                ));
                
                // Update the section content
                setReport({
                    ...report,
                    sections: report.sections.map(s =>
                        s.id === sectionId
                            ? { ...s, generatedContent: suggestedContent, sectionStatus: 'edited' as const }
                            : s
                    )
                });
                
                // Update editing content if it's the current section
                if (sectionId === selectedSectionId) {
                    setEditingContent(suggestedContent);
                }
                
                // Clear pending suggestion and show toast
                setPendingSuggestion(null);
                showToast('Changes saved successfully!', 'success');
            } else {
                console.error('[Accept] Failed to save:', res.status);
                showToast('Failed to save changes', 'error');
            }
        } catch (error) {
            console.error('Error accepting suggestion:', error);
            showToast('Failed to save changes', 'error');
        }
    };

    const handleRejectSuggestion = (messageId: string) => {
        setAiMessages(prev => prev.map(m => 
            m.id === messageId && m.suggestion
                ? { ...m, suggestion: { ...m.suggestion, status: 'rejected' as const } }
                : m
        ));
        setPendingSuggestion(null);
        showToast('Suggestion rejected', 'info');
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
                
                // Scroll to generated content after a short delay
                setTimeout(() => {
                    generatedContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            } else {
                const errorText = await res.text();
                console.error('[Generate] Error response:', errorText);
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
    
    const getSectionStatus = (section: TemplateSection) => {
        const ws = section.workflowStatus || 'draft';
        if (ws === 'ready_to_send') {
            return { icon: PaperPlaneTilt, color: 'text-emerald-500' };
        }
        if (ws === 'review') {
            return { icon: Eye, color: 'text-[var(--accent-primary)]' };
        }
        // draft
        if (section.sectionStatus === 'generated' || section.sectionStatus === 'edited') {
            return { icon: CheckCircle, color: 'text-amber-500' };
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
            <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
                <SpinnerGap className="animate-spin text-[var(--accent-primary)]" size={32} weight="light" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
                <p className="text-[var(--text-secondary)]">Report not found</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="bg-[var(--bg-card)]/95 border-b border-[var(--border-light)] backdrop-blur-sm z-10 shrink-0">
                <div className="px-6 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/documents')}
                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-secondary)]"
                            >
                                <ArrowLeft size={20} weight="light" />
                            </button>
                            <div>
                                <h1 className="text-xl font-normal text-[var(--text-primary)]">{report.name}</h1>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {report.templateName} • Created by {report.createdByName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleAuditTrail}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    showAuditTrail 
                                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30' 
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                                }`}
                                title="Audit Trail"
                            >
                                <GitBranch size={18} weight="bold" />
                                <span className="hidden sm:inline">Audit Trail</span>
                            </button>
                        </div>
                    </div>

                    {/* Status Progress removed - now per-section */}

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-[var(--border-light)] -mb-px">
                        {[
                            { id: 'preview' as const, label: 'Preview', icon: Eye },
                            { id: 'context' as const, label: 'Context', icon: UploadSimple, badge: report.contexts.length },
                            { id: 'generate' as const, label: 'Generate', icon: Sparkle },
                            { id: 'review' as const, label: 'Review', icon: ChatCircle, badge: openCommentsCount }
                        ].map(tab => {
                            const TabIcon = tab.icon;
                            return (
                                <div key={tab.id} className="relative group">
                                    <button
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === tab.id
                                                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <TabIcon size={18} />
                                        {tab.label}
                                        {tab.badge !== undefined && tab.badge > 0 && (
                                            <span className="px-1.5 py-0.5 text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-full">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Sidebar - Sections */}
                <aside className="w-72 bg-[var(--bg-card)] border-r border-[var(--border-light)] overflow-y-auto shrink-0">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-medium tracking-wider text-[var(--text-tertiary)] uppercase">Sections</h3>
                            <button
                                onClick={handleOpenTemplateModal}
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition-colors"
                                title="Edit template"
                            >
                                <PencilSimple size={16} weight="light" />
                            </button>
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
                                                
                                                // In preview mode, scroll to the section
                                                if (activeTab === 'preview') {
                                                    setTimeout(() => {
                                                        const element = document.getElementById(`preview-section-${section.id}`);
                                                        if (element) {
                                                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }
                                                    }, 100);
                                                }
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-l-4 border-[var(--accent-primary)]'
                                                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                            }`}
                                        >
                                            <StatusIcon size={16} className={status.color} />
                                            <span className="flex-1 truncate text-sm">{section.title}</span>
                                            {sectionCommentCount > 0 && (
                                                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full font-medium">
                                                    {sectionCommentCount}
                                                </span>
                                            )}
                                        </button>
                                        
                                        {subsections.length > 0 && (
                                            <div className="ml-4 pl-3 border-l border-[var(--border-light)] mt-1 space-y-1">
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
                                                                
                                                                // In preview mode, scroll to the section
                                                                if (activeTab === 'preview') {
                                                                    setTimeout(() => {
                                                                        const element = document.getElementById(`preview-section-${sub.id}`);
                                                                        if (element) {
                                                                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                        }
                                                                    }, 100);
                                                                }
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                                                                isSubSelected
                                                                    ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                                                                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                                            }`}
                                                        >
                                                            <SubStatusIcon size={14} className={subStatus.color} />
                                                            <span className="flex-1 truncate">{sub.title}</span>
                                                            {subCommentCount > 0 && (
                                                                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full font-medium">
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
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] custom-scrollbar" id="main-content-area">
                    {/* Preview Tab */}
                    {activeTab === 'preview' && (
                        <div className="flex gap-6 h-full">
                            {/* Main Content - All Sections */}
                            <div className="flex-1 overflow-y-auto space-y-6" id="preview-scroll-container">
                                {/* Export Button */}
                                <div className="max-w-4xl mx-auto flex justify-end">
                                    <button
                                        onClick={() => {
                                            // Create a printable version
                                            const printContent = document.getElementById('preview-scroll-container');
                                            if (!printContent) return;
                                            
                                            const printWindow = window.open('', '_blank');
                                            if (!printWindow) return;
                                            
                                            printWindow.document.write(`
                                                <!DOCTYPE html>
                                                <html>
                                                <head>
                                                    <title>${report?.name || 'Report'}</title>
                                                    <style>
                                                        body { 
                                                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                                            padding: 40px;
                                                            max-width: 800px;
                                                            margin: 0 auto;
                                                            color: #1e293b;
                                                        }
                                                        h1 { font-size: 24px; margin-bottom: 8px; }
                                                        h2 { font-size: 18px; margin-top: 32px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
                                                        p { line-height: 1.6; margin-bottom: 12px; }
                                                        .section { margin-bottom: 24px; page-break-inside: avoid; }
                                                        .header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #0d9488; }
                                                        .meta { color: #64748b; font-size: 14px; }
                                                        @media print {
                                                            body { padding: 20px; }
                                                        }
                                                    </style>
                                                </head>
                                                <body>
                                                    <div class="header">
                                                        <h1>${report?.name || 'Report'}</h1>
                                                        <p class="meta">${report?.trail || ''} • Created by ${report?.createdByName || 'Unknown'}</p>
                                                    </div>
                                                    ${parentSections.map(parentSection => {
                                                        const subsections = getSubsections(parentSection.id);
                                                        const allSections = [parentSection, ...subsections];
                                                        return allSections.map(section => `
                                                            <div class="section">
                                                                <h2>${section.title}</h2>
                                                                ${section.generatedContent ? `<p>${section.generatedContent.replace(/\n/g, '</p><p>')}</p>` : '<p style="color: #94a3b8; font-style: italic;">No content generated</p>'}
                                                            </div>
                                                        `).join('');
                                                    }).join('')}
                                                </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                            printWindow.print();
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors text-sm font-medium"
                                    >
                                        <DownloadSimple size={16} weight="light" />
                                        Export as PDF
                                    </button>
                                </div>
                                <div className="max-w-4xl mx-auto space-y-8">
                                    {parentSections.map((parentSection) => {
                                        const subsections = getSubsections(parentSection.id);
                                        const allSections = [parentSection, ...subsections];
                                        
                                        return allSections.map((section) => (
                                            <div 
                                                key={section.id}
                                                id={`preview-section-${section.id}`}
                                                data-section-id={section.id}
                                                className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden scroll-mt-6"
                                            >
                                                <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                                                    <div>
                                                        <h2 className="text-lg font-normal text-[var(--text-primary)]">
                                                            {section.title}
                                                        </h2>
                                                        {section.content && (
                                                            <p className="text-sm text-[var(--text-secondary)] mt-1">{section.content}</p>
                                                        )}
                                                    </div>
                                                    {/* Per-section workflow status */}
                                                    {section.sectionStatus !== 'empty' && (
                                                        <div className="flex items-center gap-1">
                                                            {(['draft', 'review', 'ready_to_send'] as const).map((ws, wsIdx) => {
                                                                const wsConfig = statusConfig[ws];
                                                                const WsIcon = wsConfig.icon;
                                                                const currentWs = section.workflowStatus || 'draft';
                                                                const isActiveWs = currentWs === ws;
                                                                const currentWsIdx = ['draft', 'review', 'ready_to_send'].indexOf(currentWs);
                                                                const isPastWs = currentWsIdx > wsIdx;
                                                                
                                                                // Disable if trying to skip steps
                                                                const sectionOpenComments = comments.filter(c => c.sectionId === section.id && c.status === 'open').length;
                                                                let wsDisabled = false;
                                                                if (ws === 'ready_to_send' && currentWs === 'draft') wsDisabled = true;
                                                                if (ws === 'ready_to_send' && sectionOpenComments > 0) wsDisabled = true;

                                                                return (
                                                                    <React.Fragment key={ws}>
                                                                        {wsIdx > 0 && (
                                                                            <div className={`w-4 h-px ${isPastWs || isActiveWs ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-light)]'}`} />
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); if (!wsDisabled) handleSectionWorkflowStatusChange(section.id, ws); }}
                                                                            disabled={wsDisabled}
                                                                            title={wsDisabled ? (ws === 'ready_to_send' && sectionOpenComments > 0 ? `Resolve ${sectionOpenComments} open comment(s) first` : 'Move to Review first') : wsConfig.label}
                                                                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                                                                wsDisabled
                                                                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                                                                                    : isActiveWs
                                                                                        ? `${wsConfig.bg} ${wsConfig.color} ring-1 ring-offset-1 ring-current/20`
                                                                                        : isPastWs
                                                                                            ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-pointer'
                                                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer'
                                                                            }`}
                                                                        >
                                                                            <WsIcon size={12} />
                                                                            {wsConfig.label}
                                                                        </button>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-6 min-h-[200px]">
                                                    {section.generatedContent ? (
                                                        <div className="prose prose-slate max-w-none whitespace-pre-wrap">
                                                            {section.generatedContent}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-40 text-[var(--text-tertiary)]">
                                                            <FileText size={40} weight="light" className="mb-2 opacity-50" />
                                                            <p className="text-sm">No content generated yet</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ));
                                    })}
                                </div>
                            </div>

                            {/* Collapsible Right Panel */}
                            <div className={`shrink-0 flex transition-all duration-300 ${rightPanelOpen ? 'w-80' : 'w-12'}`}>
                                {/* Tab buttons when closed */}
                                {!rightPanelOpen && (
                                    <div className="flex flex-col gap-2 p-1">
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('comments'); }}
                                            className={`p-2.5 rounded-lg border transition-all relative ${
                                                comments.filter(c => c.sectionId === selectedSectionId && c.status === 'open').length > 0
                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25'
                                                    : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="Comments"
                                        >
                                            <ChatCircle size={18} weight="light" />
                                            {comments.filter(c => c.sectionId === selectedSectionId && c.status === 'open').length > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                                                    {comments.filter(c => c.sectionId === selectedSectionId && c.status === 'open').length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('assistant'); }}
                                            className="p-2.5 rounded-lg border bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                            title="AI Assistant"
                                        >
                                            <Robot size={18} weight="light" />
                                        </button>
                                    </div>
                                )}

                                {/* Expanded Panel */}
                                {rightPanelOpen && (
                                    <div className="flex-1 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden flex flex-col">
                                        {/* Panel Header with Tabs */}
                                        <div className="flex items-center border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                            <button
                                                onClick={() => setRightPanelTab('comments')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                                                    rightPanelTab === 'comments'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <ChatCircle size={16} weight="light" />
                                                Comments
                                                {comments.filter(c => c.sectionId === selectedSectionId && c.status === 'open').length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded-full">
                                                        {comments.filter(c => c.sectionId === selectedSectionId && c.status === 'open').length}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setRightPanelTab('assistant')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                                    rightPanelTab === 'assistant'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <Robot size={16} weight="light" />
                                                AI Assistant
                                            </button>
                                            <button
                                                onClick={() => setRightPanelOpen(false)}
                                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                                                title="Close panel"
                                            >
                                                <CaretRight size={18} weight="light" />
                                            </button>
                                        </div>

                                        {/* Panel Content */}
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {rightPanelTab === 'comments' && (
                                                <>
                                                    {comments.filter(c => c.sectionId === selectedSectionId).length === 0 ? (
                                                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                                                            <ChatCircle size={32} weight="light" className="mx-auto mb-2 opacity-50" />
                                                            <p className="text-sm">No comments for this section</p>
                                                            <p className="text-xs mt-1">Select a section to view comments</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {comments.filter(c => c.sectionId === selectedSectionId).map(comment => (
                                                                <div 
                                                                    key={comment.id}
                                                                    className={`p-3 rounded-lg border transition-all ${
                                                                        comment.status === 'resolved'
                                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-light)] opacity-60'
                                                                            : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[#84C4D1]'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-normal">
                                                                                {comment.userName.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-medium text-[var(--text-primary)]">{comment.userName}</p>
                                                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                                                    {new Date(comment.createdAt).toLocaleString()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {comment.status === 'resolved' && (
                                                                            <CheckCircle size={14} weight="light" className="text-[var(--text-tertiary)]" />
                                                                        )}
                                                                    </div>

                                                                    {comment.selectedText && (
                                                                        <div className="mb-2 p-2 bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent-primary)] text-xs italic text-[var(--text-secondary)]">
                                                                            "{comment.selectedText}"
                                                                        </div>
                                                                    )}

                                                                    <p className="text-sm text-[var(--text-primary)] mb-2">{comment.commentText}</p>

                                                                    {comment.suggestionText && (
                                                                        <div className="mt-2 p-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded text-xs">
                                                                            <p className="font-medium text-[var(--accent-primary)] mb-1">Suggestion:</p>
                                                                            <p className="text-[var(--text-secondary)]">{comment.suggestionText}</p>
                                                                        </div>
                                                                    )}

                                                                    {comment.status === 'open' && comment.userId === user?.id && (
                                                                        <button
                                                                            onClick={() => handleResolveComment(comment.id, true)}
                                                                            className="mt-2 text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium"
                                                                        >
                                                                            Mark as resolved
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {rightPanelTab === 'assistant' && (
                                                <div className="flex flex-col h-full">
                                                    {/* AI Context Files */}
                                                    {aiContextFiles.length > 0 && (
                                                        <div className="mb-4 pb-3 border-b border-[var(--border-light)]">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <File size={14} weight="light" className="text-[var(--text-secondary)]" />
                                                                <span className="text-xs font-medium text-[var(--text-secondary)]">Context Files</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {aiContextFiles.map(file => (
                                                                    <div key={file.id} className="flex items-center gap-2 text-xs bg-[var(--bg-tertiary)] rounded p-1.5">
                                                                        <File size={12} weight="light" className="text-red-500" />
                                                                        <span className="flex-1 truncate text-[var(--text-primary)]">{file.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Chat Messages */}
                                                    <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                                                        {aiMessages.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
                                                                <Robot size={40} weight="light" className="mb-2 opacity-50" />
                                                                <p className="text-sm text-center">AI Assistant ready</p>
                                                                <p className="text-xs text-center mt-1 px-4">Ask me to improve, translate, or modify content</p>
                                                            </div>
                                                        ) : (
                                                            aiMessages.map((msg) => (
                                                                <div
                                                                    key={msg.id}
                                                                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                                >
                                                                    {msg.role === 'assistant' && (
                                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                                                            <Robot size={14} weight="light" className="text-white" />
                                                                        </div>
                                                                    )}
                                                                    <div className={`max-w-[85%] rounded-lg p-2.5 text-sm ${
                                                                        msg.role === 'user'
                                                                            ? 'bg-[var(--accent-primary)] text-white'
                                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                                                    }`}>
                                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                                        {msg.suggestion && (
                                                                            <div className="mt-2 pt-2 border-t border-[var(--border-light)]">
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        onClick={() => handleAcceptSuggestion(msg.id)}
                                                                                        disabled={msg.suggestion.status !== 'pending'}
                                                                                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                                                                            msg.suggestion.status === 'accepted'
                                                                                                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] cursor-default'
                                                                                                : msg.suggestion.status === 'rejected'
                                                                                                ? 'bg-[var(--bg-selected)] text-[var(--text-tertiary)] cursor-default'
                                                                                                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] cursor-pointer'
                                                                                        }`}
                                                                                    >
                                                                                        {msg.suggestion.status === 'accepted' ? (
                                                                                            <><Check size={12} weight="light" /> Accepted</>
                                                                                        ) : (
                                                                                            <><Check size={12} weight="light" /> Accept</>
                                                                                        )}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleRejectSuggestion(msg.id)}
                                                                                        disabled={msg.suggestion.status !== 'pending'}
                                                                                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                                                                            msg.suggestion.status === 'rejected'
                                                                                                ? 'bg-[var(--bg-selected)] text-[var(--text-secondary)] cursor-default'
                                                                                                : msg.suggestion.status === 'accepted'
                                                                                                ? 'bg-[var(--bg-selected)] text-[var(--text-tertiary)] cursor-default'
                                                                                                : 'bg-[var(--bg-card)] border border-[var(--border-medium)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer'
                                                                                        }`}
                                                                                    >
                                                                                        {msg.suggestion.status === 'rejected' ? (
                                                                                            <><X size={12} weight="light" /> Rejected</>
                                                                                        ) : (
                                                                                            <><X size={12} weight="light" /> Reject</>
                                                                                        )}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {msg.role === 'user' && (
                                                                        <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 text-white text-xs font-normal">
                                                                            {user?.name?.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                        <div ref={aiMessagesEndRef} />
                                                    </div>

                                                    {/* Input Area */}
                                                    <div className="border-t border-[var(--border-light)] pt-3">
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={aiInput}
                                                                onChange={(e) => setAiInput(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && !isAiLoading && handleSendAiMessage()}
                                                                placeholder="Ask me anything..."
                                                                disabled={!selectedSectionId}
                                                                className="flex-1 px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)]"
                                                            />
                                                            <button
                                                                onClick={handleSendAiMessage}
                                                                disabled={!aiInput.trim() || isAiLoading || !selectedSectionId}
                                                                className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:bg-slate-300 text-white rounded-lg transition-colors"
                                                            >
                                                                {isAiLoading ? (
                                                                    <SpinnerGap size={18} weight="light" className="animate-spin" />
                                                                ) : (
                                                                    <PaperPlaneTilt size={18} weight="light" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Context Tab */}
                    {activeTab === 'context' && (
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-normal text-[var(--text-primary)]">Context Documents</h2>
                                        <p className="text-sm text-[var(--text-secondary)]">Upload PDFs to provide context for AI generation</p>
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <div 
                                    className="border-2 border-dashed border-[var(--border-light)] rounded-lg p-8 text-center hover:border-[var(--accent-primary)] transition-colors cursor-pointer mb-6"
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
                                        <SpinnerGap className="mx-auto animate-spin text-[var(--accent-primary)]" size={32} weight="light" />
                                    ) : (
                                        <UploadSimple className="mx-auto text-slate-300" size={32} weight="light" />
                                    )}
                                    <p className="mt-2 text-[var(--text-secondary)] font-medium">
                                        {isUploading ? 'Uploading...' : 'Click to upload PDF'}
                                    </p>
                                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                        The text will be extracted and used as context
                                    </p>
                                </div>

                                {/* Uploaded Files */}
                                {report.contexts.length > 0 ? (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Uploaded Documents</h3>
                                        {report.contexts.map(ctx => (
                                            <div 
                                                key={ctx.id} 
                                                className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg group"
                                            >
                                                <File className="text-red-500" size={20} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{ctx.fileName}</p>
                                                    <p className="text-xs text-[var(--text-tertiary)]">
                                                        {formatFileSize(ctx.fileSize)} • {new Date(ctx.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteContext(ctx.id)}
                                                    className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash size={16} weight="light" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-[var(--text-tertiary)] text-sm">
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
                                <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-lg font-normal text-[var(--text-primary)]">
                                                {selectedSection?.title || 'Select a section'}
                                            </h2>
                                            {selectedSection?.content && (
                                                <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedSection.content}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {report.contexts.length > 0 && (
                                                <span className="px-2 py-1 text-xs bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] rounded-full">
                                                    {report.contexts.length} context doc{report.contexts.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {selectedSection && selectedSection.sectionStatus !== 'empty' && (
                                                <div className="flex items-center gap-1">
                                                    {(['draft', 'review', 'ready_to_send'] as const).map((ws, wsIdx) => {
                                                        const wsConfig = statusConfig[ws];
                                                        const WsIcon = wsConfig.icon;
                                                        const currentWs = selectedSection.workflowStatus || 'draft';
                                                        const isActiveWs = currentWs === ws;
                                                        const currentWsIdx = ['draft', 'review', 'ready_to_send'].indexOf(currentWs);
                                                        const isPastWs = currentWsIdx > wsIdx;
                                                        
                                                        const sectionOpenComments = comments.filter(c => c.sectionId === selectedSection.id && c.status === 'open').length;
                                                        let wsDisabled = false;
                                                        if (ws === 'ready_to_send' && currentWs === 'draft') wsDisabled = true;
                                                        if (ws === 'ready_to_send' && sectionOpenComments > 0) wsDisabled = true;

                                                        return (
                                                            <React.Fragment key={ws}>
                                                                {wsIdx > 0 && (
                                                                    <div className={`w-4 h-px ${isPastWs || isActiveWs ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-light)]'}`} />
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); if (!wsDisabled) handleSectionWorkflowStatusChange(selectedSection.id, ws); }}
                                                                    disabled={wsDisabled}
                                                                    title={wsDisabled ? (ws === 'ready_to_send' && sectionOpenComments > 0 ? `Resolve ${sectionOpenComments} open comment(s) first` : 'Move to Review first') : wsConfig.label}
                                                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                                                        wsDisabled
                                                                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                                                                            : isActiveWs
                                                                                ? `${wsConfig.bg} ${wsConfig.color} ring-1 ring-offset-1 ring-current/20`
                                                                                : isPastWs
                                                                                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-pointer'
                                                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer'
                                                                    }`}
                                                                >
                                                                    <WsIcon size={12} />
                                                                    {wsConfig.label}
                                                                </button>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selectedSection?.generationRules && (
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                <strong className="text-amber-500">Generation Rules:</strong> {selectedSection.generationRules}
                                            </p>
                                        </div>
                                    )}

                                    {/* Prompt Input */}
                                    {selectedSection?.workflowStatus === 'ready_to_send' ? (
                                        <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <PaperPlaneTilt size={18} weight="light" />
                                                <span className="text-sm font-medium">This section is Done</span>
                                            </div>
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                Change the status back to Draft to edit the prompt or content.
                                            </p>
                                        </div>
                                    ) : selectedSection?.workflowStatus === 'review' ? (
                                        <div className="border border-[var(--accent-primary)]/30 rounded-lg p-4 bg-[var(--accent-primary)]/5">
                                            <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                                                <Eye size={18} weight="light" />
                                                <span className="text-sm font-medium">This section is in Review</span>
                                            </div>
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                Change the status back to Draft to edit the prompt or content.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="border border-[var(--border-light)] rounded-lg p-4 bg-[var(--bg-tertiary)]">
                                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
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
                                    )}
                                </div>

                                {/* AI Suggestion Preview */}
                                {pendingSuggestion && pendingSuggestion.sectionId === selectedSectionId && (
                                    <div ref={generatedContentRef} className="bg-gradient-to-r from-[#84C4D1]/20 to-[var(--accent-primary)]/10 rounded-xl shadow-sm border-2 border-[var(--accent-primary)]/30 overflow-hidden">
                                        <div className="px-6 py-4 bg-gradient-to-r from-[#84C4D1]/30 to-[var(--accent-primary)]/20 border-b border-[var(--accent-primary)]/20 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-[var(--accent-primary)] rounded-lg">
                                                    <Robot size={20} weight="light" className="text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-normal text-[var(--accent-primary)]">AI Suggestion</h3>
                                                    <p className="text-xs text-[var(--accent-primary)]/70">Review the suggested changes below</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAcceptSuggestion(pendingSuggestion.messageId)}
                                                    className="px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-medium"
                                                >
                                                    <Check size={16} weight="light" />
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleRejectSuggestion(pendingSuggestion.messageId)}
                                                    className="px-4 py-2 text-sm bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors flex items-center gap-2 font-medium border border-[var(--border-medium)] shadow-sm"
                                                >
                                                    <X size={16} />
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6">
                                            <div className="min-h-[200px] p-4 bg-[var(--bg-card)] border border-[var(--accent-primary)]/20 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
                                                {pendingSuggestion.suggestedContent}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Generated Content with Highlighted Comments */}
                                {(editingContent || selectedSection?.generatedContent) && !(pendingSuggestion && pendingSuggestion.sectionId === selectedSectionId) && (
                                    <div ref={generatedContentRef} className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)]">
                                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                                            <div>
                                                <h3 className="font-normal text-[var(--text-primary)]">Generated Content</h3>
                                                {sectionComments.filter(c => c.status === 'open').length > 0 && (
                                                    <p className="text-xs text-amber-500 mt-0.5">
                                                        {sectionComments.filter(c => c.status === 'open').length} comment{sectionComments.filter(c => c.status === 'open').length !== 1 ? 's' : ''} to address
                                                    </p>
                                                )}
                                            </div>
                                            {selectedSection?.workflowStatus === 'draft' && (
                                                <div className="flex items-center gap-2">
                                                    {/* Toggle View/Edit Mode */}
                                                    <button
                                                        onClick={() => setIsEditMode(!isEditMode)}
                                                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                                                            isEditMode 
                                                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' 
                                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                                        }`}
                                                    >
                                                        <PencilSimple size={16} weight="light" />
                                                        {isEditMode ? 'Editing' : 'Edit'}
                                                    </button>
                                                    <button
                                                        onClick={handleSaveSection}
                                                        disabled={isSaving}
                                                        className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {isSaving ? (
                                                            <SpinnerGap size={16} weight="light" className="animate-spin" />
                                                        ) : (
                                                            <FloppyDisk size={16} weight="light" />
                                                        )}
                                                        Save
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="p-6">
                                            {isEditMode && selectedSection?.workflowStatus === 'draft' ? (
                                                <textarea
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    className="w-full min-h-[300px] p-4 border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none resize-y font-mono text-sm"
                                                    placeholder="Generated content will appear here..."
                                                    autoFocus
                                                />
                                            ) : (
                                                <div 
                                                    className={`min-h-[300px] p-4 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm whitespace-pre-wrap leading-relaxed ${
                                                        selectedSection?.workflowStatus === 'draft'
                                                            ? 'cursor-pointer hover:bg-[var(--bg-hover)] transition-colors'
                                                            : 'cursor-default'
                                                    }`}
                                                    dangerouslySetInnerHTML={{ __html: highlightedHtml || editingContent }}
                                                    onClick={() => selectedSection?.workflowStatus === 'draft' && setIsEditMode(true)}
                                                    title={selectedSection?.workflowStatus === 'draft' ? 'Click to edit' : `Section is locked (${selectedSection?.workflowStatus === 'ready_to_send' ? 'Done' : 'Review'})`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Collapsible Right Panel */}
                            <div className={`shrink-0 flex transition-all duration-300 ${rightPanelOpen ? 'w-80' : 'w-12'}`}>
                                {/* Tab buttons when closed */}
                                {!rightPanelOpen && (
                                    <div className="flex flex-col gap-2 p-1">
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('comments'); }}
                                            className={`p-2.5 rounded-lg border transition-all relative ${
                                                sectionComments.filter(c => c.status === 'open').length > 0
                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25'
                                                    : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="Comments"
                                        >
                                            <ChatCircle size={18} weight="light" />
                                            {sectionComments.filter(c => c.status === 'open').length > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                                                    {sectionComments.filter(c => c.status === 'open').length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('assistant'); }}
                                            className="p-2.5 rounded-lg border bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                            title="AI Assistant"
                                        >
                                            <Robot size={18} weight="light" />
                                        </button>
                                    </div>
                                )}

                                {/* Expanded Panel */}
                                {rightPanelOpen && (
                                    <div className="flex-1 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden flex flex-col">
                                        {/* Panel Header with Tabs */}
                                        <div className="flex items-center border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                            <button
                                                onClick={() => setRightPanelTab('comments')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                                                    rightPanelTab === 'comments'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <ChatCircle size={16} weight="light" />
                                                Comments
                                                {sectionComments.filter(c => c.status === 'open').length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded-full">
                                                        {sectionComments.filter(c => c.status === 'open').length}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setRightPanelTab('assistant')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                                    rightPanelTab === 'assistant'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <Robot size={16} weight="light" />
                                                AI Assistant
                                            </button>
                                            <button
                                                onClick={() => setRightPanelOpen(false)}
                                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                                                title="Close panel"
                                            >
                                                <CaretRight size={18} weight="light" />
                                            </button>
                                        </div>

                                        {/* Panel Content */}
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {rightPanelTab === 'comments' && (
                                                <>
                                                    {sectionComments.length === 0 ? (
                                                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                                                            <ChatCircle size={32} weight="light" className="mx-auto mb-2 opacity-50" />
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
                                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-light)] opacity-60'
                                                                            : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[#84C4D1]'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center">
                                                                                <User size={12} weight="light" className="text-[var(--accent-primary)]" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-medium text-[var(--text-primary)]">{comment.userName}</p>
                                                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {comment.status === 'open' && (
                                                                            <button
                                                                                onClick={() => handleResolveComment(comment.id, true)}
                                                                                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded"
                                                                                title="Mark as resolved"
                                                                            >
                                                                                <Checks size={14} weight="light" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="mb-2 px-2 py-1 bg-yellow-100 rounded text-xs text-[var(--text-secondary)] italic">
                                                                        "{comment.selectedText.slice(0, 60)}{comment.selectedText.length > 60 ? '...' : ''}"
                                                                    </div>
                                                                    <p className={`text-sm ${comment.status === 'resolved' ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}`}>
                                                                        {comment.commentText}
                                                                    </p>
                                                                    {comment.status === 'resolved' && (
                                                                        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                                                                            <CheckCircle size={12} weight="light" />
                                                                            Resolved
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {rightPanelTab === 'assistant' && (
                                                <div className="flex flex-col h-full -m-4">
                                                    {/* AI Context Files */}
                                                    {aiContextFiles.length > 0 && (
                                                        <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)]">Context Files</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {aiContextFiles.map(file => (
                                                                    <div key={file.id} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] rounded border border-[var(--border-light)] text-xs">
                                                                        <File size={12} className="text-[var(--text-tertiary)]" />
                                                                        <span className="truncate max-w-[100px]">{file.name}</span>
                                                                        <button
                                                                            onClick={() => handleDeleteAiFile(file.id)}
                                                                            className="p-0.5 text-[var(--text-tertiary)] hover:text-red-500"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Messages */}
                                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                        {aiMessages.length === 0 ? (
                                                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                                                                <Robot size={40} weight="light" className="mx-auto mb-3 opacity-50" />
                                                                <p className="text-sm font-medium text-[var(--text-secondary)]">AI Assistant</p>
                                                                <p className="text-xs mt-1">Ask questions about your document</p>
                                                                <p className="text-xs mt-2 text-[var(--text-tertiary)]">
                                                                    I can help you review content, suggest improvements, and answer questions about all sections.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {aiMessages.map(message => (
                                                                    <div
                                                                        key={message.id}
                                                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                                    >
                                                                        <div className={`max-w-[85%] rounded-lg p-3 ${
                                                                            message.role === 'user'
                                                                                ? 'bg-[var(--accent-primary)] text-white'
                                                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                                                        }`}>
                                                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                                            
                                                                            {/* Suggestion Card */}
                                                                            {message.suggestion && (
                                                                                <div className="mt-3 p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm">
                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                        <Sparkle size={14} weight="light" className="text-amber-500" />
                                                                                        <span className="text-xs font-medium text-[var(--text-primary)]">
                                                                                            Suggestion for: {message.suggestion.sectionTitle}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded p-2 mb-2 max-h-32 overflow-y-auto">
                                                                                        {message.suggestion.suggestedContent.slice(0, 300)}
                                                                                        {message.suggestion.suggestedContent.length > 300 && '...'}
                                                                                    </div>
                                                                                    
                                                                                    {message.suggestion.status === 'pending' ? (
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => handleAcceptSuggestion(message.id)}
                                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--accent-primary)] text-white rounded text-xs font-medium hover:bg-[var(--accent-primary-hover)] transition-colors"
                                                                                            >
                                                                                                <Check size={12} />
                                                                                                Accept
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleRejectSuggestion(message.id)}
                                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--bg-selected)] text-[var(--text-primary)] rounded text-xs font-medium hover:bg-slate-300 transition-colors"
                                                                                            >
                                                                                                <X size={12} />
                                                                                                Reject
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className={`text-xs font-medium flex items-center gap-1 ${
                                                                                            message.suggestion.status === 'accepted' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                                                                                        }`}>
                                                                                            {message.suggestion.status === 'accepted' ? (
                                                                                                <><CheckCircle size={12} weight="light" /> Accepted</>
                                                                                            ) : (
                                                                                                <><X size={12} weight="light" /> Rejected</>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            <p className="text-xs opacity-60 mt-1">
                                                                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {isAiLoading && (
                                                                    <div className="flex justify-start">
                                                                        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <SpinnerGap size={14} weight="light" className="animate-spin text-[var(--text-secondary)]" />
                                                                                <span className="text-sm text-[var(--text-secondary)]">Thinking...</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div ref={aiMessagesEndRef} />
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Input Area */}
                                                    <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-card)]">
                                                        <div className="flex items-end gap-2">
                                                            <input
                                                                type="file"
                                                                ref={aiFileInputRef}
                                                                onChange={handleAiFileUpload}
                                                                className="hidden"
                                                                accept=".pdf,.doc,.docx,.txt"
                                                            />
                                                            <button
                                                                onClick={() => aiFileInputRef.current?.click()}
                                                                disabled={isUploadingAiFile}
                                                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                                                title="Upload file for context"
                                                            >
                                                                {isUploadingAiFile ? (
                                                                    <SpinnerGap size={18} weight="light" className="animate-spin" />
                                                                ) : (
                                                                    <UploadSimple size={18} weight="light" />
                                                                )}
                                                            </button>
                                                            <div className="flex-1">
                                                                <textarea
                                                                    value={aiInput}
                                                                    onChange={(e) => setAiInput(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleSendAiMessage();
                                                                        }
                                                                    }}
                                                                    placeholder="Escribe qué cambios quieres en esta sección..."
                                                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm resize-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                                                                    rows={1}
                                                                    style={{ minHeight: '40px', maxHeight: '100px' }}
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={handleSendAiMessage}
                                                                disabled={!aiInput.trim() || isAiLoading}
                                                                className="p-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <PaperPlaneTilt size={18} weight="light" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Review Tab */}
                    {activeTab === 'review' && (
                        <div className="flex gap-6 h-full">
                            {/* Main Content with Comments */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden">
                                    {/* Section Header */}
                                    <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-tertiary)]">
                                        <div>
                                            <h2 className="text-lg font-normal text-[var(--text-primary)]">
                                                {selectedSection?.title || 'Select a section'}
                                            </h2>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                {selectedSection?.workflowStatus === 'ready_to_send' 
                                                    ? 'This section is locked (Done)'
                                                    : `Select text to add comments • ${sectionComments.filter(c => c.status === 'open').length} open comment${sectionComments.filter(c => c.status === 'open').length !== 1 ? 's' : ''}`
                                                }
                                            </p>
                                        </div>
                                        {selectedSection && selectedSection.sectionStatus !== 'empty' && (
                                            <div className="flex items-center gap-1">
                                                {(['draft', 'review', 'ready_to_send'] as const).map((ws, wsIdx) => {
                                                    const wsConfig = statusConfig[ws];
                                                    const WsIcon = wsConfig.icon;
                                                    const currentWs = selectedSection.workflowStatus || 'draft';
                                                    const isActiveWs = currentWs === ws;
                                                    const currentWsIdx = ['draft', 'review', 'ready_to_send'].indexOf(currentWs);
                                                    const isPastWs = currentWsIdx > wsIdx;
                                                    
                                                    const sectionOpenComments = comments.filter(c => c.sectionId === selectedSection.id && c.status === 'open').length;
                                                    let wsDisabled = false;
                                                    if (ws === 'ready_to_send' && currentWs === 'draft') wsDisabled = true;
                                                    if (ws === 'ready_to_send' && sectionOpenComments > 0) wsDisabled = true;

                                                    return (
                                                        <React.Fragment key={ws}>
                                                            {wsIdx > 0 && (
                                                                <div className={`w-4 h-px ${isPastWs || isActiveWs ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-light)]'}`} />
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); if (!wsDisabled) handleSectionWorkflowStatusChange(selectedSection.id, ws); }}
                                                                disabled={wsDisabled}
                                                                title={wsDisabled ? (ws === 'ready_to_send' && sectionOpenComments > 0 ? `Resolve ${sectionOpenComments} open comment(s) first` : 'Move to Review first') : wsConfig.label}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                                                    wsDisabled
                                                                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                                                                        : isActiveWs
                                                                            ? `${wsConfig.bg} ${wsConfig.color} ring-1 ring-offset-1 ring-current/20`
                                                                            : isPastWs
                                                                                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-pointer'
                                                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer'
                                                                }`}
                                                            >
                                                                <WsIcon size={12} />
                                                                {wsConfig.label}
                                                            </button>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        </div>

                                    {/* Content Area */}
                                    <div 
                                        ref={contentRef}
                                        className={`p-6 min-h-[400px] prose prose-slate max-w-none relative ${selectedSection?.workflowStatus === 'ready_to_send' ? 'cursor-default' : 'cursor-text'}`}
                                        onMouseUp={selectedSection?.workflowStatus !== 'ready_to_send' ? handleTextSelection : undefined}
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
                                            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-tertiary)]">
                                                <FileText size={48} className="mb-3 opacity-50" />
                                                <p>No content in this section</p>
                                            </div>
                                        )}

                                        </div>

                                    {/* Add Comment Input Panel (appears after clicking Add Comment button) */}
                                    {showCommentInput && selectedText && selectedSection?.workflowStatus !== 'ready_to_send' && (
                                        <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--accent-primary)]/10">
                                            <div className="flex items-start gap-3">
                                                <ChatCircle className="text-[var(--accent-primary)] mt-1 shrink-0" size={18} weight="light" />
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-sm text-[var(--text-secondary)]">
                                                        <span className="font-medium">Selected:</span> "{selectedText.text.slice(0, 80)}{selectedText.text.length > 80 ? '...' : ''}"
                                                    </p>
                                                    <textarea
                                                        value={newCommentText}
                                                        onChange={(e) => setNewCommentText(e.target.value)}
                                                        placeholder="Add your comment..."
                                                        className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none resize-none"
                                                        rows={2}
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleAddComment}
                                                            disabled={!newCommentText.trim()}
                                                            className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--accent-primary)]/50 text-white rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            Add Comment
                                                        </button>
                                                        <button
                                                            onClick={handleCancelComment}
                                                            className="px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium transition-colors"
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

                            {/* Collapsible Right Panel */}
                            <div className={`shrink-0 flex transition-all duration-300 ${rightPanelOpen ? 'w-80' : 'w-12'}`}>
                                {/* Tab buttons when closed */}
                                {!rightPanelOpen && (
                                    <div className="flex flex-col gap-2 p-1">
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('comments'); }}
                                            className={`p-2.5 rounded-lg border transition-all relative ${
                                                sectionComments.filter(c => c.status === 'open').length > 0
                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25'
                                                    : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="Comments"
                                        >
                                            <ChatCircle size={18} weight="light" />
                                            {sectionComments.filter(c => c.status === 'open').length > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                                                    {sectionComments.filter(c => c.status === 'open').length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setRightPanelOpen(true); setRightPanelTab('assistant'); }}
                                            className="p-2.5 rounded-lg border bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                            title="AI Assistant"
                                        >
                                            <Robot size={18} weight="light" />
                                        </button>
                                    </div>
                                )}

                                {/* Expanded Panel */}
                                {rightPanelOpen && (
                                    <div className="flex-1 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden flex flex-col">
                                        {/* Panel Header with Tabs */}
                                        <div className="flex items-center border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                            <button
                                                onClick={() => setRightPanelTab('comments')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                                                    rightPanelTab === 'comments'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <ChatCircle size={16} weight="light" />
                                                Comments
                                                {sectionComments.filter(c => c.status === 'open').length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded-full">
                                                        {sectionComments.filter(c => c.status === 'open').length}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setRightPanelTab('assistant')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                                    rightPanelTab === 'assistant'
                                                        ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <Robot size={16} weight="light" />
                                                AI Assistant
                                            </button>
                                            <button
                                                onClick={() => setRightPanelOpen(false)}
                                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                                                title="Close panel"
                                            >
                                                <CaretRight size={18} weight="light" />
                                            </button>
                                        </div>

                                        {/* Panel Content */}
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {rightPanelTab === 'comments' && (
                                                <>
                                                    {sectionComments.length === 0 ? (
                                                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                                                            <ChatCircle size={32} weight="light" className="mx-auto mb-2 opacity-50" />
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
                                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-light)] opacity-60'
                                                                            : activeCommentId === comment.id
                                                                                ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200'
                                                                                : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[#84C4D1]'
                                                                    }`}
                                                                    onClick={() => setActiveCommentId(comment.id)}
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center">
                                                                                <User size={12} weight="light" className="text-[var(--accent-primary)]" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-medium text-[var(--text-primary)]">{comment.userName}</p>
                                                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            {comment.status === 'open' ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleResolveComment(comment.id, true); }}
                                                                                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded"
                                                                                        title="Resolve"
                                                                                    >
                                                                                        <Checks size={14} weight="light" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setEditingCommentId(comment.id); setEditCommentText(comment.commentText); }}
                                                                                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded"
                                                                                        title="Edit"
                                                                                    >
                                                                                        <PencilSimple size={14} weight="light" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                                                                        className="p-1 text-[var(--text-tertiary)] hover:text-red-600 hover:bg-red-50 rounded"
                                                                                        title="Delete"
                                                                                    >
                                                                                        <Trash size={14} weight="light" />
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleResolveComment(comment.id, false); }}
                                                                                    className="p-1 text-[var(--text-tertiary)] hover:text-amber-500 hover:bg-amber-500/10 rounded"
                                                                                    title="Reopen"
                                                                                >
                                                                                    <ArrowElbowDownRight size={14} weight="light" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mb-2 px-2 py-1 bg-yellow-100 rounded text-xs text-[var(--text-secondary)] italic">
                                                                        "{comment.selectedText.slice(0, 60)}{comment.selectedText.length > 60 ? '...' : ''}"
                                                                    </div>
                                                                    {editingCommentId === comment.id ? (
                                                                        <div className="space-y-2">
                                                                            <textarea
                                                                                value={editCommentText}
                                                                                onChange={(e) => setEditCommentText(e.target.value)}
                                                                                className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                                                                rows={2}
                                                                                autoFocus
                                                                            />
                                                                            <div className="flex gap-2">
                                                                                <button onClick={() => handleUpdateComment(comment.id)} className="px-2 py-1 bg-[var(--accent-primary)] text-white rounded text-xs">Save</button>
                                                                                <button onClick={() => { setEditingCommentId(null); setEditCommentText(''); }} className="px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded text-xs">Cancel</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className={`text-sm ${comment.status === 'resolved' ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}`}>
                                                                            {comment.commentText}
                                                                        </p>
                                                                    )}
                                                                    {comment.status === 'resolved' && (
                                                                        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                                                                            <CheckCircle size={12} weight="light" />
                                                                            Resolved
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {rightPanelTab === 'assistant' && (
                                                <div className="flex flex-col h-full -m-4">
                                                    {/* AI Context Files */}
                                                    {aiContextFiles.length > 0 && (
                                                        <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)]">Context Files</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {aiContextFiles.map(file => (
                                                                    <div key={file.id} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] rounded border border-[var(--border-light)] text-xs">
                                                                        <File size={12} className="text-[var(--text-tertiary)]" />
                                                                        <span className="truncate max-w-[100px]">{file.name}</span>
                                                                        <button
                                                                            onClick={() => handleDeleteAiFile(file.id)}
                                                                            className="p-0.5 text-[var(--text-tertiary)] hover:text-red-500"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Messages */}
                                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                        {aiMessages.length === 0 ? (
                                                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                                                                <Robot size={40} weight="light" className="mx-auto mb-3 opacity-50" />
                                                                <p className="text-sm font-medium text-[var(--text-secondary)]">AI Assistant</p>
                                                                <p className="text-xs mt-1">Ask questions about your document</p>
                                                                <p className="text-xs mt-2 text-[var(--text-tertiary)]">
                                                                    I can help you review content, suggest improvements, and answer questions about all sections.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {aiMessages.map(message => (
                                                                    <div
                                                                        key={message.id}
                                                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                                    >
                                                                        <div className={`max-w-[85%] rounded-lg p-3 ${
                                                                            message.role === 'user'
                                                                                ? 'bg-[var(--accent-primary)] text-white'
                                                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                                                        }`}>
                                                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                                            
                                                                            {/* Suggestion Card */}
                                                                            {message.suggestion && (
                                                                                <div className="mt-3 p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm">
                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                        <Sparkle size={14} weight="light" className="text-amber-500" />
                                                                                        <span className="text-xs font-medium text-[var(--text-primary)]">
                                                                                            Suggestion for: {message.suggestion.sectionTitle}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded p-2 mb-2 max-h-32 overflow-y-auto">
                                                                                        {message.suggestion.suggestedContent.slice(0, 300)}
                                                                                        {message.suggestion.suggestedContent.length > 300 && '...'}
                                                                                    </div>
                                                                                    
                                                                                    {message.suggestion.status === 'pending' ? (
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => handleAcceptSuggestion(message.id)}
                                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--accent-primary)] text-white rounded text-xs font-medium hover:bg-[var(--accent-primary-hover)] transition-colors"
                                                                                            >
                                                                                                <Check size={12} />
                                                                                                Accept
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleRejectSuggestion(message.id)}
                                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--bg-selected)] text-[var(--text-primary)] rounded text-xs font-medium hover:bg-slate-300 transition-colors"
                                                                                            >
                                                                                                <X size={12} />
                                                                                                Reject
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className={`text-xs font-medium flex items-center gap-1 ${
                                                                                            message.suggestion.status === 'accepted' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                                                                                        }`}>
                                                                                            {message.suggestion.status === 'accepted' ? (
                                                                                                <><CheckCircle size={12} weight="light" /> Accepted</>
                                                                                            ) : (
                                                                                                <><X size={12} weight="light" /> Rejected</>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            <p className="text-xs opacity-60 mt-1">
                                                                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {isAiLoading && (
                                                                    <div className="flex justify-start">
                                                                        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <SpinnerGap size={14} weight="light" className="animate-spin text-[var(--text-secondary)]" />
                                                                                <span className="text-sm text-[var(--text-secondary)]">Thinking...</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div ref={aiMessagesEndRef} />
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Input Area */}
                                                    <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-card)]">
                                                        <div className="flex items-end gap-2">
                                                            <input
                                                                type="file"
                                                                ref={aiFileInputRef}
                                                                onChange={handleAiFileUpload}
                                                                className="hidden"
                                                                accept=".pdf,.doc,.docx,.txt"
                                                            />
                                                            <button
                                                                onClick={() => aiFileInputRef.current?.click()}
                                                                disabled={isUploadingAiFile}
                                                                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                                                title="Upload file for context"
                                                            >
                                                                {isUploadingAiFile ? (
                                                                    <SpinnerGap size={18} weight="light" className="animate-spin" />
                                                                ) : (
                                                                    <UploadSimple size={18} weight="light" />
                                                                )}
                                                            </button>
                                                            <div className="flex-1">
                                                                <textarea
                                                                    value={aiInput}
                                                                    onChange={(e) => setAiInput(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleSendAiMessage();
                                                                        }
                                                                    }}
                                                                    placeholder="Escribe qué cambios quieres en esta sección..."
                                                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm resize-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                                                                    rows={1}
                                                                    style={{ minHeight: '40px', maxHeight: '100px' }}
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={handleSendAiMessage}
                                                                disabled={!aiInput.trim() || isAiLoading}
                                                                className="p-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <PaperPlaneTilt size={18} weight="light" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Template Edit Modal */}
            {showTemplateModal && templateData && (
                <TemplateEditModal
                    template={templateData}
                    onSave={handleSaveTemplate}
                    onClose={() => setShowTemplateModal(false)}
                    usage={templateUsage}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 duration-300 ${
                    toast.type === 'success' ? 'bg-[var(--accent-primary)] text-white' :
                    toast.type === 'error' ? 'bg-red-600 text-white' :
                    'bg-slate-800 text-white'
                }`}>
                    {toast.type === 'success' && <CheckCircle size={20} weight="light" />}
                    {toast.type === 'error' && <WarningCircle size={20} weight="light" />}
                    {toast.type === 'info' && <X size={20} weight="light" />}
                    <span className="font-medium">{toast.message}</span>
                </div>
            )}

            {/* Audit Trail Slide-Over Panel */}
            {showAuditTrail && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
                        onClick={() => setShowAuditTrail(false)}
                    />
                    {/* Panel */}
                    <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-[var(--bg-card)] border-l border-[var(--border-light)] shadow-2xl z-50 flex flex-col"
                        style={{ animation: 'slideInRight 0.25s ease-out' }}
                    >
                        {/* Panel Header */}
                        <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg">
                                    <GitBranch size={20} weight="bold" className="text-[var(--accent-primary)]" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Audit Trail</h2>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        {auditLogs.length} event{auditLogs.length !== 1 ? 's' : ''} recorded
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAuditTrail(false)}
                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {auditLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <SpinnerGap className="animate-spin text-[var(--accent-primary)]" size={28} weight="light" />
                                    <span className="text-sm text-[var(--text-secondary)]">Loading history...</span>
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <GitBranch size={40} weight="light" className="text-[var(--text-secondary)] opacity-40" />
                                    <p className="text-sm text-[var(--text-secondary)]">No events recorded yet</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* Git-style vertical line */}
                                    <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-[var(--border-light)]" />

                                    {auditLogs.map((log, idx) => {
                                        const details = log.details ? JSON.parse(log.details) : null;
                                        const isStatusChange = log.action === 'status_change' || log.action === 'section_status_change';
                                        const isFirst = idx === 0;

                                        return (
                                            <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0 group">
                                                {/* Git-style node dot */}
                                                <div className={`relative z-10 flex items-center justify-center w-[32px] h-[32px] rounded-full shrink-0 ${
                                                    isFirst 
                                                        ? `${getActionColor(log.action)} text-white shadow-lg`
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-2 border-[var(--border-light)]'
                                                }`}>
                                                    {getActionIcon(log.action)}
                                                </div>

                                                {/* Content */}
                                                <div className={`flex-1 min-w-0 pt-1 ${isFirst ? '' : 'opacity-80 group-hover:opacity-100 transition-opacity'}`}>
                                                    {/* Action label */}
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                                                            {getActionLabel(log.action)}
                                                        </span>
                                                        <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap shrink-0" title={formatAuditDateTime(log.createdAt)}>
                                                            {formatAuditDate(log.createdAt)}
                                                        </span>
                                                    </div>

                                                    {/* Status change details */}
                                                    {isStatusChange && details && (
                                                        <div className="flex items-center gap-2 mt-1.5 mb-1.5 flex-wrap">
                                                            {details.sectionTitle && (
                                                                <span className="text-xs text-[var(--text-secondary)] mr-1">
                                                                    {details.sectionTitle}:
                                                                </span>
                                                            )}
                                                            {details.previousStatus && (
                                                                <>
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                                                        details.previousStatus === 'draft' ? 'bg-amber-500/15 text-amber-500' :
                                                                        details.previousStatus === 'review' ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' :
                                                                        'bg-emerald-500/15 text-emerald-500'
                                                                    }`}>
                                                                        {getStatusLabel(details.previousStatus)}
                                                                    </span>
                                                                    <ArrowRight size={12} weight="bold" className="text-[var(--text-secondary)]" />
                                                                </>
                                                            )}
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                                                details.newStatus === 'draft' ? 'bg-amber-500/15 text-amber-500' :
                                                                details.newStatus === 'review' ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' :
                                                                'bg-emerald-500/15 text-emerald-500'
                                                            }`}>
                                                                {getStatusLabel(details.newStatus)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Generation details */}
                                                    {log.action === 'generate_content' && details && (
                                                        <div className="mt-1.5 mb-1.5 p-2 bg-purple-500/5 border border-purple-500/15 rounded-lg">
                                                            {details.sectionTitle && (
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <FileText size={12} weight="light" className="text-purple-400 shrink-0" />
                                                                    <span className="text-[11px] font-medium text-purple-400 truncate">
                                                                        {details.sectionTitle}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {details.prompt && (
                                                                <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed line-clamp-2">
                                                                    "{details.prompt}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Comment details */}
                                                    {log.action === 'add_comment' && details?.commentText && (
                                                        <div className="mt-1.5 mb-1.5 p-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                                                            <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed line-clamp-2">
                                                                "{details.commentText}"
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* User info */}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <UserCircle size={14} weight="light" className="text-[var(--text-secondary)]" />
                                                        <span className="text-xs text-[var(--text-secondary)]">
                                                            {log.userName || log.userEmail}
                                                        </span>
                                                    </div>

                                                    {/* Full timestamp on hover */}
                                                    <div className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-0 group-hover:opacity-70 transition-opacity">
                                                        {formatAuditDateTime(log.createdAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Panel Footer */}
                        <div className="px-5 py-3 border-t border-[var(--border-light)] shrink-0">
                            <button
                                onClick={fetchAuditTrail}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <SpinnerGap size={14} weight="light" className={auditLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Keyframe animation */}
                    <style>{`
                        @keyframes slideInRight {
                            from { transform: translateX(100%); }
                            to { transform: translateX(0); }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
};

// Template Edit Modal Component
interface ModalTemplateSection {
    id?: string;
    title: string;
    content?: string;
    generationRules?: string;
    items: ModalTemplateItem[];
    isExpanded?: boolean;
}

interface ModalTemplateItem {
    id?: string;
    title: string;
    content: string;
    generationRules: string;
}

interface TemplateEditModalProps {
    template: any;
    onSave: (template: any) => void;
    onClose: () => void;
    usage?: { inUse: boolean; reportCount: number; reports: any[] } | null;
}

const TemplateEditModal: React.FC<TemplateEditModalProps> = ({ template, onSave, onClose, usage }) => {
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

    const iconOptions = [
        { value: 'FileText', label: 'Document', Icon: FileText },
        { value: 'FlaskConical', label: 'Flask', Icon: Flask },
        { value: 'Clipboard', label: 'Clipboard', Icon: Clipboard },
        { value: 'Wrench', label: 'Wrench', Icon: Wrench },
        { value: 'AlertTriangle', label: 'Alert', Icon: Warning },
        { value: 'Sparkles', label: 'Sparkles', Icon: Sparkle }
    ];

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
                    id: s.id, // Preserve existing section ID
                    title: s.title,
                    content: s.content || '',
                    generationRules: s.generationRules || '',
                    items: s.items.filter(i => i.title.trim()).map(item => ({
                        id: item.id, // Preserve existing item ID
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
                    <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20">
                        <div className="flex items-start gap-3">
                            <Warning className="text-amber-500 shrink-0 mt-0.5" size={20} weight="light" />
                            <div>
                                <p className="text-sm font-medium text-amber-500">
                                    This template is used in {usage.reportCount} document{usage.reportCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-500 mt-1">
                                    Modifying sections may affect existing documents.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {usage.reports.slice(0, 5).map((report: any) => (
                                        <span key={report.id} className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded text-xs">
                                            {report.name}
                                        </span>
                                    ))}
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
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Template Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Icon</label>
                            <div className="flex gap-2">
                                {iconOptions.map(({ value, label, Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => setIcon(value)}
                                        className={`p-2 rounded-lg border-2 transition-all ${
                                            icon === value
                                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
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
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none"
                        />
                    </div>

                    {/* Sections */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Sections</label>
                            <button onClick={addSection} className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium">
                                <Plus size={16} weight="light" />
                                Add Section
                            </button>
                        </div>

                        <div className="space-y-4">
                            {sections.map((section, sIdx) => (
                                <div key={sIdx} className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                    <div className="bg-[var(--bg-tertiary)] px-4 py-3 flex items-center gap-3">
                                        <button onClick={() => toggleSection(sIdx)} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                                            {section.isExpanded ? <CaretDown size={18} weight="light" /> : <CaretRight size={18} weight="light" />}
                                        </button>
                                        <span className="text-sm text-[var(--text-secondary)] font-medium">Section {sIdx + 1} Title</span>
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                                            className="flex-1 px-2 py-1 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm"
                                        />
                                        <button onClick={() => addItem(sIdx)} className="p-1 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded" title="Add item">
                                            <Plus size={18} />
                                        </button>
                                        <button onClick={() => removeSection(sIdx)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove section">
                                            <Trash size={18} weight="light" />
                                        </button>
                                    </div>

                                    {section.isExpanded && (
                                        <div className="p-4 space-y-3">
                                            {/* Section Content and Generation Rules */}
                                            <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-light)] space-y-3 mb-4">
                                                <div>
                                                    <label className="text-xs text-[var(--text-secondary)] font-medium">Content</label>
                                                    <textarea
                                                        value={section.content || ''}
                                                        onChange={(e) => updateSection(sIdx, { content: e.target.value })}
                                                        placeholder="Description of what this section should contain..."
                                                        className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm resize-none"
                                                        rows={2}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[var(--text-secondary)] font-medium">Generation Rules (optional)</label>
                                                    <textarea
                                                        value={section.generationRules || ''}
                                                        onChange={(e) => updateSection(sIdx, { generationRules: e.target.value })}
                                                        placeholder="Special instructions for AI generation..."
                                                        className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm resize-none"
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>

                                            {/* Section Items */}
                                            {section.items.length > 0 ? (
                                                <div className="space-y-3">
                                                    {section.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-light)]">
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <DotsSixVertical size={16} weight="light" className="text-slate-300 mt-2 shrink-0" />
                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Item Title</label>
                                                                        <input
                                                                            type="text"
                                                                            value={item.title}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { title: e.target.value })}
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Content</label>
                                                                        <textarea
                                                                            value={item.content}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { content: e.target.value })}
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm resize-none"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-[var(--text-secondary)]">Generation Rules <span className="text-[var(--text-tertiary)]">(optional)</span></label>
                                                                        <textarea
                                                                            value={item.generationRules}
                                                                            onChange={(e) => updateItem(sIdx, iIdx, { generationRules: e.target.value })}
                                                                            rows={2}
                                                                            className="w-full px-2 py-1.5 border border-[var(--border-light)] rounded focus:ring-1 focus:ring-[var(--accent-primary)] outline-none text-sm resize-none"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => removeItem(sIdx, iIdx)} className="p-1 text-red-400 hover:bg-red-50 rounded shrink-0" title="Remove item">
                                                                    <Trash size={16} weight="light" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 border-2 border-dashed border-[var(--border-light)] rounded-lg">
                                                    <p className="text-sm text-[var(--text-tertiary)]">No items in this section</p>
                                                    <button onClick={() => addItem(sIdx)} className="mt-2 text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium">
                                                        + Add item
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg font-medium transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? <SpinnerGap size={16} weight="light" className="animate-spin" /> : <FloppyDisk size={16} weight="light" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

