import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { Database, Sparkles, X, Info, Plus, Share2, ChevronDown, Copy, Check, Trash2, Link, ExternalLink, LayoutDashboard, Search, ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { API_BASE } from '../config';

// Generate UUID that works in non-HTTPS contexts
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for HTTP contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface DashboardData {
    id: string;
    name: string;
    description?: string;
    isPublic?: number;
    shareToken?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface SavedWidget extends WidgetConfig {
    id: string;
    position?: number;
}

interface DashboardProps {
    entities: Entity[];
    onNavigate?: (entityId: string) => void;
    onViewChange?: (view: string) => void;
}

interface WidgetCardProps {
    widget: WidgetConfig;
    onSave?: (widget: WidgetConfig) => void;
    onRemove: () => void;
    isSaved?: boolean;
    onNavigate?: (entityId: string) => void;
    entities?: Entity[];
}

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, onSave, onRemove, isSaved, onNavigate, entities }) => {
    const [showExplanation, setShowExplanation] = useState(false);

    const renderExplanation = (text: string) => {
        if (!text) return null;

        const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const entityName = part.substring(1);
                const entity = entities?.find(e => e.name === entityName);

                if (entity && onNavigate) {
                    return (
                        <span
                            key={index}
                            onClick={() => onNavigate(entity.id)}
                            className="text-teal-600 font-medium cursor-pointer hover:underline"
                            title={`View ${entityName} details`}
                        >
                            {part}
                        </span>
                    );
                }
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 relative group">
            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {!isSaved && onSave && (
                    <button
                        onClick={() => onSave(widget)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Save to Dashboard"
                    >
                        <Plus size={16} />
                    </button>
                )}
                <button
                    onClick={onRemove}
                    className="p-1 text-slate-400 rounded transition-colors hover:text-red-500 hover:bg-red-50"
                    title={isSaved ? "Delete Widget" : "Remove"}
                >
                    <X size={14} />
                </button>
            </div>

            <h3 className="text-base font-normal text-slate-900 mb-1">{widget.title}</h3>
            <p className="text-xs text-slate-500 mb-3">{widget.description}</p>

            <DynamicChart config={widget} />

            {widget.explanation && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium"
                    >
                        <Info size={12} />
                        How did I prepare this?
                    </button>

                    {showExplanation && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-1 whitespace-pre-wrap">
                            {renderExplanation(widget.explanation)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ entities, onNavigate, onViewChange }) => {
    const { dashboardId: urlDashboardId } = useParams();
    const navigate = useNavigate();
    
    // Dashboard state
    const [dashboards, setDashboards] = useState<DashboardData[]>([]);
    const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
    
    // Sync URL param with state - load dashboard from URL when it changes
    useEffect(() => {
        if (urlDashboardId) {
            setSelectedDashboardId(urlDashboardId);
        } else {
            setSelectedDashboardId(null);
        }
    }, [urlDashboardId]);
    
    // Update URL when dashboard changes
    const selectDashboard = (id: string) => {
        setSelectedDashboardId(id);
        navigate(`/dashboard/${id}`, { replace: true });
    };
    
    // Modal states
    const [showShareModal, setShowShareModal] = useState(false);
    
    // Inline editing states
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingDescription, setEditingDescription] = useState('');
    
    // Widget state
    const [generatedWidgets, setGeneratedWidgets] = useState<WidgetConfig[]>([]);
    const [savedWidgets, setSavedWidgets] = useState<SavedWidget[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const generatedWidgetsRef = useRef<HTMLDivElement>(null);
    
    // Share state
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);

    // Fetch dashboards on mount
    useEffect(() => {
        fetchDashboards();
    }, []);

    // Fetch widgets when dashboard changes
    useEffect(() => {
        if (selectedDashboardId) {
            fetchWidgets(selectedDashboardId);
        } else {
            setSavedWidgets([]);
        }
    }, [selectedDashboardId]);

    // Auto-scroll to generated widgets when a new one is created
    useEffect(() => {
        if (generatedWidgets.length > 0 && generatedWidgetsRef.current) {
            setTimeout(() => {
                generatedWidgetsRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
        }
    }, [generatedWidgets.length]);

    const fetchDashboards = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboards`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setDashboards(data);
                // If there's a URL param, use it; otherwise auto-select first dashboard
                if (data.length > 0) {
                    if (urlDashboardId && data.find(d => d.id === urlDashboardId)) {
                        // URL has valid dashboard ID - just set it (don't navigate again)
                        setSelectedDashboardId(urlDashboardId);
                    } else if (urlDashboardId && !data.find(d => d.id === urlDashboardId)) {
                        // URL has invalid dashboard ID - reset to list view
                        setSelectedDashboardId(null);
                    }
                } else {
                    setSelectedDashboardId(null);
                }
            }
        } catch (error) {
            console.error('Error fetching dashboards:', error);
        }
    };

    const fetchWidgets = async (dashboardId: string) => {
        try {
            const res = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setSavedWidgets(data.map((w: any) => ({
                    ...w.config,
                    id: w.id,
                    position: w.position
                })));
            } else {
                setSavedWidgets([]);
            }
        } catch (error) {
            console.error('Error fetching widgets:', error);
            setSavedWidgets([]);
        }
    };

    const handleCreateDashboard = async () => {
        try {
            const id = generateUUID();
            const defaultName = `Dashboard ${dashboards.length + 1}`;
            const res = await fetch(`${API_BASE}/dashboards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    name: defaultName,
                    description: ''
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const newDashboard = await res.json();
                setDashboards(prev => [newDashboard, ...prev]);
                selectDashboard(newDashboard.id);
                // Start editing the title immediately
                setEditingTitle(defaultName);
                setIsEditingTitle(true);
            }
        } catch (error) {
            console.error('Error creating dashboard:', error);
            alert('Failed to create dashboard.');
        }
    };

    const handleSaveTitle = async () => {
        if (!selectedDashboardId || !editingTitle.trim()) {
            setIsEditingTitle(false);
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingTitle.trim(),
                    description: selectedDashboard?.description || ''
                }),
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, name: editingTitle.trim() }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
        setIsEditingTitle(false);
    };

    const handleSaveDescription = async () => {
        if (!selectedDashboardId) {
            setIsEditingDescription(false);
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: selectedDashboard?.name || '',
                    description: editingDescription.trim()
                }),
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, description: editingDescription.trim() }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
        setIsEditingDescription(false);
    };

    const handleDeleteDashboard = async () => {
        if (!selectedDashboardId) return;
        if (!confirm('Are you sure you want to delete this dashboard and all its widgets?')) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                const remaining = dashboards.filter(d => d.id !== selectedDashboardId);
                setDashboards(remaining);
                if (remaining.length > 0) {
                    selectDashboard(remaining[0].id);
                } else {
                    setSelectedDashboardId(null);
                    navigate('/dashboard', { replace: true });
                }
            }
        } catch (error) {
            console.error('Error deleting dashboard:', error);
            alert('Failed to delete dashboard.');
        }
    };

    const handleShareDashboard = async () => {
        if (!selectedDashboardId) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/share`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                const fullUrl = `${window.location.origin}/shared/${data.shareToken}`;
                setShareUrl(fullUrl);
                setShowShareModal(true);
                
                // Update local state
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, isPublic: 1, shareToken: data.shareToken }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error sharing dashboard:', error);
            alert('Failed to share dashboard.');
        }
    };

    const handleUnshareDashboard = async () => {
        if (!selectedDashboardId) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/unshare`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, isPublic: 0, shareToken: undefined }
                        : d
                ));
                setShowShareModal(false);
                setShareUrl('');
            }
        } catch (error) {
            console.error('Error unsharing dashboard:', error);
        }
    };

    const copyShareUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGenerateWidget = async (prompt: string, mentionedEntityIds: string[]) => {
        setIsGenerating(true);

        // Save prompt as feedback for analytics
        try {
            await fetch(`${API_BASE}/node-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeType: 'dashboard_prompt',
                    nodeLabel: 'Dashboard Widget',
                    feedbackText: prompt
                }),
                credentials: 'include'
            });
        } catch (e) {
            // Silent fail - don't block widget generation
        }

        try {
            const res = await fetch(`${API_BASE}/generate-widget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds
                }),
                credentials: 'include'
            });

            const widgetConfig = await res.json();
            if (widgetConfig.error) {
                throw new Error(widgetConfig.error);
            }

            setGeneratedWidgets(prev => [widgetConfig, ...prev]);
        } catch (error) {
            console.error('Error generating widget:', error);
            alert('Failed to generate widget. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveWidget = async (widget: WidgetConfig) => {
        if (!selectedDashboardId) {
            alert('Please select or create a dashboard first.');
            return;
        }
        
        try {
            const id = generateUUID();
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: widget.title,
                    description: widget.description,
                    config: widget
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const savedWidget = await res.json();
                setSavedWidgets(prev => [...prev, { ...widget, id: savedWidget.id, position: savedWidget.position }]);
                setGeneratedWidgets(prev => prev.filter(w => w !== widget));
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            alert('Failed to save widget.');
        }
    };

    const removeWidget = async (widgetId: string, isGenerated: boolean = false, index?: number) => {
        if (isGenerated && index !== undefined) {
            setGeneratedWidgets(prev => prev.filter((_, i) => i !== index));
        } else {
            try {
                await fetch(`${API_BASE}/widgets/${widgetId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                setSavedWidgets(prev => prev.filter(w => w.id !== widgetId));
            } catch (error) {
                console.error('Error deleting widget:', error);
            }
        }
    };

    const openShareModalIfShared = () => {
        if (selectedDashboard?.shareToken) {
            const fullUrl = `${window.location.origin}/shared/${selectedDashboard.shareToken}`;
            setShareUrl(fullUrl);
            setShowShareModal(true);
        } else {
            handleShareDashboard();
        }
    };

    const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
    const filteredDashboards = dashboards.filter(d => 
        d.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50" data-tutorial="dashboard-content">
            {!selectedDashboardId ? (
                /* Dashboards List View */
                <>
                    {/* Top Header */}
                    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
                        <div>
                            <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Dashboards</h1>
                            <p className="text-[11px] text-slate-500">Create and manage your data visualizations</p>
                        </div>
                        <div />
                    </header>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search dashboards..."
                                        value={dashboardSearchQuery}
                                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                                        className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-72 placeholder:text-slate-400 hover:border-slate-300 transition-colors"
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    {filteredDashboards.length} {filteredDashboards.length === 1 ? 'dashboard' : 'dashboards'}
                                </p>
                            </div>
                            <button
                                onClick={handleCreateDashboard}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] text-white rounded-lg hover:bg-[#1e554f] transition-colors text-sm font-medium"
                            >
                                <Plus size={14} />
                                Create Dashboard
                            </button>
                        </div>

                        {/* Dashboards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredDashboards.map((dashboard) => (
                                <div
                                    key={dashboard.id}
                                    onClick={() => selectDashboard(dashboard.id)}
                                    className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] overflow-hidden"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
                                                    <LayoutDashboard size={18} className="text-slate-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                            {dashboard.name}
                                                        </h3>
                                                        {dashboard.isPublic === 1 && (
                                                            <Link size={14} className="text-slate-400 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteDashboard(dashboard.id);
                                                }}
                                                className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {dashboard.description && (
                                            <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                                                {dashboard.description}
                                            </p>
                                        )}

                                        <div className="space-y-2 mt-5 pt-4 border-t border-slate-100">
                                            {dashboard.createdAt && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    <span>Created {new Date(dashboard.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {dashboard.updatedAt && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Clock size={12} className="text-slate-400" />
                                                    <span>Updated {new Date(dashboard.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-blue-600">Open dashboard</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Create New Card */}
                            <div
                                onClick={handleCreateDashboard}
                                className="border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center min-h-[200px] text-slate-400 cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                                    <Plus size={24} className="text-slate-400" />
                                </div>
                                <span className="font-medium text-sm">Create new dashboard</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Dashboard Editor View */
                <>
                    {/* Header */}
                    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    setSelectedDashboardId(null);
                                    navigate('/dashboard', { replace: true });
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-sm"
                            >
                                <ArrowLeft size={14} />
                                <span className="font-medium">Back</span>
                            </button>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <span className="font-medium text-slate-900 text-sm">
                                {selectedDashboard?.name || 'Dashboard'}
                            </span>
                            
                            {/* Dashboard Actions */}
                            {selectedDashboard && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={openShareModalIfShared}
                                        className={`p-1.5 rounded-md transition-colors ${
                                            selectedDashboard.isPublic 
                                                ? 'text-slate-700 hover:bg-slate-100' 
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                        title={selectedDashboard.isPublic ? "Manage Share Link" : "Share Dashboard"}
                                    >
                                        <Share2 size={16} />
                                    </button>
                                    <button
                                        onClick={handleDeleteDashboard}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                        title="Delete Dashboard"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div />
                    </header>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="max-w-7xl mx-auto space-y-6">

                            {/* Dashboard Content */}
                            {selectedDashboard && (
                                <>
                                            {/* Editable Title */}
                                    <div className="mb-2">
                                {isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={e => setEditingTitle(e.target.value)}
                                        onBlur={handleSaveTitle}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                                        className="text-base font-normal text-slate-900 bg-transparent border-b border-slate-300 focus:border-slate-400 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <h2 
                                        onClick={() => {
                                            setEditingTitle(selectedDashboard.name);
                                            setIsEditingTitle(true);
                                        }}
                                        className="text-base font-normal text-slate-900 cursor-pointer hover:text-slate-700 transition-colors"
                                        title="Click to edit"
                                    >
                                        {selectedDashboard.name}
                                    </h2>
                                )}
                            </div>

                                    {/* Editable Description */}
                                    <div className="mb-5">
                                {isEditingDescription ? (
                                    <input
                                        type="text"
                                        value={editingDescription}
                                        onChange={e => setEditingDescription(e.target.value)}
                                        onBlur={handleSaveDescription}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveDescription()}
                                        placeholder="Add a description..."
                                        className="text-sm text-slate-500 bg-transparent border-b border-slate-200 focus:border-slate-400 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <p 
                                        onClick={() => {
                                            setEditingDescription(selectedDashboard.description || '');
                                            setIsEditingDescription(true);
                                        }}
                                        className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 transition-colors"
                                        title="Click to edit"
                                    >
                                        {selectedDashboard.description || 'Click to add description...'}
                                    </p>
                                )}
                            </div>

                            {/* Saved Widgets Section */}
                            {savedWidgets.length > 0 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {savedWidgets.map((widget) => (
                                            <WidgetCard
                                                key={widget.id}
                                                widget={widget}
                                                onRemove={() => removeWidget(widget.id)}
                                                isSaved={true}
                                                onNavigate={onNavigate}
                                                entities={entities}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                                    {/* AI Widget Generator */}
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <PromptInput
                                        entities={entities}
                                        onGenerate={handleGenerateWidget}
                                        isGenerating={isGenerating}
                                        placeholder="Describe a chart... e.g. 'Bar chart of @Customers by total orders'"
                                        buttonLabel="Generate"
                                        className="text-slate-800"
                                    />
                                </div>
                            </div>

                                    {/* Generated Widgets Section */}
                                    {generatedWidgets.length > 0 && (
                                <div ref={generatedWidgetsRef} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <h3 className="text-base font-normal text-slate-900 flex items-center gap-2">
                                        <Sparkles size={14} className="text-slate-500" />
                                        New Widgets
                                        <span className="text-xs font-normal text-slate-500">(click + to save)</span>
                                    </h3>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {generatedWidgets.map((widget, index) => (
                                            <WidgetCard
                                                key={index}
                                                widget={widget}
                                                onSave={handleSaveWidget}
                                                onRemove={() => removeWidget('', true, index)}
                                                onNavigate={onNavigate}
                                                entities={entities}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                                    {/* Empty State when no widgets */}
                                    {savedWidgets.length === 0 && generatedWidgets.length === 0 && (
                                <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
                                    <Database className="mx-auto text-slate-300 mb-3" size={40} />
                                    <h3 className="text-base font-normal text-slate-700 mb-2">No widgets yet</h3>
                                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                                        Use the prompt below to create custom charts and visualizations from your data.
                                    </p>
                                </div>
                                    )}
                                </>
                            )}

                        </div>
                    </div>
                </>
            )}

            {/* Share Dashboard Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
                    <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[450px]" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-normal text-slate-800 mb-4 flex items-center gap-2">
                            <Share2 size={20} className="text-teal-600" />
                            Share Dashboard
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Anyone with this link can view your dashboard without logging in.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-600"
                            />
                            <button
                                onClick={copyShareUrl}
                                className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${
                                    copied 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-teal-600 text-white hover:bg-teal-700'
                                }`}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                            >
                                <ExternalLink size={14} />
                                Open in new tab
                            </a>
                        </div>
                        <div className="flex gap-2 justify-between border-t border-slate-100 pt-4">
                            <button
                                onClick={handleUnshareDashboard}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                            >
                                Stop Sharing
                            </button>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
