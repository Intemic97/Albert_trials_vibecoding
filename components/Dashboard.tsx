import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { Database, Sparkles, X, Info, Plus, Share2, ChevronDown, Copy, Check, Trash2, Link, ExternalLink, LayoutDashboard, Search, ArrowLeft, Calendar, Clock, ChevronRight, Sliders, GripVertical, Maximize2 } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { Tabs } from './Tabs';
import { Pagination } from './Pagination';
import { API_BASE } from '../config';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

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
    gridX?: number;
    gridY?: number;
    gridWidth?: number;
    gridHeight?: number;
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

// Grid Widget Card Component (for use in GridLayout)
const GridWidgetCard: React.FC<{ widget: SavedWidget; onRemove: () => void }> = ({ widget, onRemove }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    
    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="drag-handle cursor-move p-2 border-b border-slate-100 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                    <h3 className="text-sm font-medium text-slate-900">{widget.title}</h3>
                </div>
                <button
                    onClick={onRemove}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Widget"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
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
                            <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed">
                                {widget.explanation}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

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
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'dashboards' | 'simulations'>('dashboards');
    
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
    
    // Grid layout state
    const [layout, setLayout] = useState<Layout[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [gridWidth, setGridWidth] = useState(1200);
    
    // Modal state for adding widgets
    const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
    
    // Update grid width on window resize
    useEffect(() => {
        const updateGridWidth = () => {
            if (typeof window !== 'undefined') {
                const container = document.getElementById('dashboard-container');
                if (container) {
                    setGridWidth(container.clientWidth);
                } else {
                    setGridWidth(window.innerWidth - 320);
                }
            }
        };
        
        updateGridWidth();
        window.addEventListener('resize', updateGridWidth);
        return () => window.removeEventListener('resize', updateGridWidth);
    }, [selectedDashboardId]);
    
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
                const widgets = data.map((w: any) => ({
                    ...w.config,
                    id: w.id,
                    position: w.position,
                    gridX: w.gridX || 0,
                    gridY: w.gridY || 0,
                    gridWidth: w.gridWidth || 4,
                    gridHeight: w.gridHeight || 3
                }));
                setSavedWidgets(widgets);
                
                // Update layout for react-grid-layout
                const newLayout = widgets.map((w: SavedWidget, index: number) => ({
                    i: w.id,
                    x: w.gridX || (index % 2) * 6,
                    y: w.gridY || Math.floor(index / 2) * 3,
                    w: w.gridWidth || 4,
                    h: w.gridHeight || 3,
                    minW: 2,
                    minH: 2,
                    maxW: 12,
                    maxH: 8
                }));
                setLayout(newLayout);
            } else {
                setSavedWidgets([]);
                setLayout([]);
            }
        } catch (error) {
            console.error('Error fetching widgets:', error);
            setSavedWidgets([]);
            setLayout([]);
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

    const handleSaveWidget = async (widget: WidgetConfig, gridPosition?: { x: number; y: number; w: number; h: number }) => {
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
                    config: widget,
                    gridX: gridPosition?.x || 0,
                    gridY: gridPosition?.y || 0,
                    gridWidth: gridPosition?.w || 4,
                    gridHeight: gridPosition?.h || 3
                }),
                credentials: 'include'
            });

            if (res.ok) {
                await fetchWidgets(selectedDashboardId);
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
                await fetchWidgets(selectedDashboardId!);
            } catch (error) {
                console.error('Error deleting widget:', error);
            }
        }
    };

    // Handle layout change (drag & resize)
    const handleLayoutChange = useCallback(async (newLayout: Layout[]) => {
        setLayout(newLayout);
        
        // Update widget positions in backend
        if (!selectedDashboardId || isDragging) return;
        
        for (const item of newLayout) {
            try {
                await fetch(`${API_BASE}/widgets/${item.i}/grid`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        gridX: item.x,
                        gridY: item.y,
                        gridWidth: item.w,
                        gridHeight: item.h
                    })
                });
            } catch (error) {
                console.error('Error updating widget position:', error);
            }
        }
    }, [selectedDashboardId, isDragging]);
    
    const handleDragStart = () => {
        setIsDragging(true);
    };
    
    const handleDragStop = () => {
        setIsDragging(false);
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
    const [currentDashboardPage, setCurrentDashboardPage] = useState(1);
    const dashboardsPerPage = 6;
    
    const filteredDashboards = dashboards.filter(d => 
        d.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase())
    );
    
    const totalDashboardPages = Math.ceil(filteredDashboards.length / dashboardsPerPage);
    const paginatedDashboards = filteredDashboards.slice(
        (currentDashboardPage - 1) * dashboardsPerPage,
        currentDashboardPage * dashboardsPerPage
    );
    
    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentDashboardPage(1);
    }, [dashboardSearchQuery]);

    // Interactive Dashboard state
    const [interactiveDashboards, setInteractiveDashboards] = useState<any[]>([]);
    const [selectedInteractiveDashboardId, setSelectedInteractiveDashboardId] = useState<string | null>(null);
    const [scenarioVariables, setScenarioVariables] = useState<Record<string, any>>({});

    return (
        <div className="flex flex-col h-full bg-slate-50" data-tutorial="dashboard-content">
            {/* Top Header - Only show when no dashboard is selected */}
            {!selectedDashboardId && (
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <div>
                        <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Dashboards</h1>
                        <p className="text-[11px] text-slate-500">Create and manage your data visualizations</p>
                    </div>
                    <div />
                </header>
            )}

            {/* Content with Tabs */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Tabs - Only show when no dashboard is selected */}
                {!selectedDashboardId && (
                    <div className="px-8 pt-6">
                        <Tabs
                            items={[
                                { 
                                    id: 'dashboards', 
                                    label: 'Dashboards', 
                                    icon: LayoutDashboard,
                                    badge: dashboards.length
                                },
                                { 
                                    id: 'simulations', 
                                    label: 'Simulations', 
                                    icon: Sliders,
                                    badge: interactiveDashboards.length
                                }
                            ]}
                            activeTab={activeTab}
                            onChange={(tabId) => {
                                if (tabId === 'dashboards') {
                                    setActiveTab('dashboards');
                                    setSelectedDashboardId(null);
                                    setSelectedInteractiveDashboardId(null);
                                    navigate('/dashboard', { replace: true });
                                } else {
                                    setActiveTab('simulations');
                                    setSelectedDashboardId(null);
                                    setSelectedInteractiveDashboardId(null);
                                }
                            }}
                        />
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'dashboards' && !selectedDashboardId ? (
                /* Dashboards List View */
                <>
                    {/* Content Area */}
                    <div className="p-8">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search dashboards..."
                                        value={dashboardSearchQuery}
                                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                                    />
                                </div>
                                <p className="text-sm text-slate-500">
                                    {filteredDashboards.length} {filteredDashboards.length === 1 ? 'dashboard' : 'dashboards'}
                                </p>
                            </div>
                            <button
                                onClick={handleCreateDashboard}
                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={14} className="mr-2" />
                                Create Dashboard
                            </button>
                        </div>

                        {/* Dashboards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                            {paginatedDashboards.map((dashboard) => (
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
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-slate-900">Open dashboard</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Create New Card - Only show if no pagination */}
                            {totalDashboardPages <= 1 && (
                                <div
                                    onClick={handleCreateDashboard}
                                    className="border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center min-h-[200px] text-slate-400 cursor-pointer group"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                                        <Plus size={24} className="text-slate-400" />
                                    </div>
                                    <span className="font-medium text-sm">Create new dashboard</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Pagination */}
                        {totalDashboardPages > 1 && (
                            <div className="mt-6">
                                <Pagination
                                    currentPage={currentDashboardPage}
                                    totalPages={totalDashboardPages}
                                    onPageChange={setCurrentDashboardPage}
                                    itemsPerPage={dashboardsPerPage}
                                    totalItems={filteredDashboards.length}
                                />
                            </div>
                        )}
                    </div>
                </>
            ) : activeTab === 'dashboards' && selectedDashboardId ? (
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
                        <div className="max-w-7xl mx-auto space-y-6" id="dashboard-container">

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

                            {/* Grid Layout for Widgets */}
                            <div className="relative min-h-[400px]">
                                {savedWidgets.length > 0 ? (
                                    <GridLayout
                                        className="layout"
                                        layout={layout}
                                        cols={12}
                                        rowHeight={60}
                                        width={gridWidth}
                                        onLayoutChange={handleLayoutChange}
                                        onDragStart={handleDragStart}
                                        onDragStop={handleDragStop}
                                        onResizeStop={handleLayoutChange}
                                        isDraggable={true}
                                        isResizable={true}
                                        draggableHandle=".drag-handle"
                                        margin={[16, 16]}
                                        containerPadding={[0, 0]}
                                    >
                                        {savedWidgets.map((widget) => (
                                            <GridWidgetCard
                                                key={widget.id}
                                                widget={widget}
                                                onRemove={() => removeWidget(widget.id)}
                                            />
                                        ))}
                                    </GridLayout>
                                ) : (
                                    <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-12 text-center">
                                        <Database className="mx-auto text-slate-300 mb-3" size={40} />
                                        <h3 className="text-base font-normal text-slate-700 mb-2">No widgets yet</h3>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                                            Click the + button to add widgets and create custom visualizations.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Generated Widgets Preview Section (temporary, before adding to grid) */}
                            {generatedWidgets.length > 0 && (
                                <div ref={generatedWidgetsRef} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
                                    <h3 className="text-base font-normal text-slate-900 flex items-center gap-2">
                                        <Sparkles size={14} className="text-slate-500" />
                                        New Widgets
                                        <span className="text-xs font-normal text-slate-500">(click + to add to dashboard)</span>
                                    </h3>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {generatedWidgets.map((widget, index) => (
                                            <WidgetCard
                                                key={index}
                                                widget={widget}
                                                onSave={(w) => {
                                                    // Find next available position in grid
                                                    const maxY = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0;
                                                    handleSaveWidget(w, { x: 0, y: maxY, w: 4, h: 3 });
                                                }}
                                                onRemove={() => removeWidget('', true, index)}
                                                onNavigate={onNavigate}
                                                entities={entities}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Floating Add Widget Button */}
                            {selectedDashboard && (
                                <button
                                    onClick={() => setShowAddWidgetModal(true)}
                                    className="fixed bottom-8 right-8 bg-slate-900 text-white rounded-full p-4 shadow-lg hover:bg-slate-800 transition-colors z-50 flex items-center gap-2 group"
                                    title="Add Widget"
                                >
                                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-200" />
                                    <span className="text-sm font-medium pr-2 hidden sm:inline">Add Widget</span>
                                </button>
                            )}

                            {/* Add Widget Modal */}
                            {showAddWidgetModal && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddWidgetModal(false)}>
                                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                                        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-normal text-slate-900">Add Widget</h2>
                                                <p className="text-xs text-slate-500 mt-1">Describe what you want to visualize and how</p>
                                            </div>
                                            <button
                                                onClick={() => setShowAddWidgetModal(false)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6">
                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <PromptInput
                                                    entities={entities}
                                                    onGenerate={(prompt, mentionedEntityIds) => {
                                                        handleGenerateWidget(prompt, mentionedEntityIds);
                                                        setShowAddWidgetModal(false);
                                                    }}
                                                    isGenerating={isGenerating}
                                                    placeholder="Describe a chart... e.g. 'Bar chart of @Customers by total orders' or 'Connect to workflow output SalesReport and show as line chart'"
                                                    buttonLabel="Generate Widget"
                                                    className="text-slate-800"
                                                />
                                            </div>
                                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="flex items-start gap-3">
                                                    <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                                    <div className="text-xs text-blue-800">
                                                        <p className="font-medium mb-1">Tips:</p>
                                                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                                                            <li>Use @ to mention entities (e.g., @Customers)</li>
                                                            <li>Use . to access attributes (e.g., @Customers.totalOrders)</li>
                                                            <li>Describe the visualization type (bar chart, line chart, pie chart, etc.)</li>
                                                            <li>You can connect to workflow outputs by mentioning the workflow name</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                                </>
                            )}

                        </div>
                    </div>
                </>
            ) : activeTab === 'simulations' ? (
                <InteractiveDashboardsView
                    entities={entities}
                    interactiveDashboards={interactiveDashboards}
                    setInteractiveDashboards={setInteractiveDashboards}
                    selectedInteractiveDashboardId={selectedInteractiveDashboardId}
                    setSelectedInteractiveDashboardId={setSelectedInteractiveDashboardId}
                    scenarioVariables={scenarioVariables}
                    setScenarioVariables={setScenarioVariables}
                    onNavigate={onNavigate}
                />
            ) : null}
                </div>
            </div>

            {/* Share Dashboard Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg">
                                    <Share2 size={18} className="text-slate-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-normal text-slate-900">Share Dashboard</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Anyone with this link can view your dashboard</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                />
                                <button
                                    onClick={copyShareUrl}
                                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
                                        copied 
                                            ? 'bg-green-50 text-green-700 border border-green-200' 
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <ExternalLink size={14} />
                                <span>Open in new tab</span>
                            </a>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between gap-3">
                            {selectedDashboard?.isPublic ? (
                                <button
                                    onClick={handleUnshareDashboard}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Stop Sharing
                                </button>
                            ) : (
                                <div />
                            )}
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
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

// Simulations Component
interface InteractiveDashboardsViewProps {
    entities: Entity[];
    interactiveDashboards: any[];
    setInteractiveDashboards: (dashboards: any[]) => void;
    selectedInteractiveDashboardId: string | null;
    setSelectedInteractiveDashboardId: (id: string | null) => void;
    scenarioVariables: Record<string, any>;
    setScenarioVariables: (vars: Record<string, any>) => void;
    onNavigate?: (entityId: string) => void;
}

const InteractiveDashboardsView: React.FC<InteractiveDashboardsViewProps> = ({
    entities,
    interactiveDashboards,
    setInteractiveDashboards,
    selectedInteractiveDashboardId,
    setSelectedInteractiveDashboardId,
    scenarioVariables,
    setScenarioVariables,
    onNavigate
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
    const [variableValues, setVariableValues] = useState<Record<string, number>>({});

    const selectedDashboard = interactiveDashboards.find(d => d.id === selectedInteractiveDashboardId);

    const handleCreateInteractiveDashboard = async () => {
        if (!newDashboardName.trim()) {
            alert('Please enter a dashboard name');
            return;
        }

        const id = generateUUID();
        const newDashboard = {
            id,
            name: newDashboardName.trim(),
            variables: selectedVariables,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setInteractiveDashboards([...interactiveDashboards, newDashboard]);
        setSelectedInteractiveDashboardId(id);
        setNewDashboardName('');
        setIsCreating(false);
        setSelectedVariables([]);
    };

    const handleAddVariable = (entityId: string, propertyId: string) => {
        const key = `${entityId}_${propertyId}`;
        if (!selectedVariables.includes(key)) {
            setSelectedVariables([...selectedVariables, key]);
            setVariableValues({ ...variableValues, [key]: 0 });
        }
    };

    const handleUpdateVariable = (key: string, value: number) => {
        setVariableValues({ ...variableValues, [key]: value });
        setScenarioVariables({ ...scenarioVariables, [key]: value });
    };

    const getEntityPropertyName = (key: string) => {
        const [entityId, propertyId] = key.split('_');
        const entity = entities.find(e => e.id === entityId);
        const property = entity?.properties?.find(p => p.id === propertyId);
        return `${entity?.name || 'Unknown'}.${property?.name || 'Unknown'}`;
    };

    if (selectedInteractiveDashboardId && selectedDashboard) {
        return (
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-normal text-slate-900 mb-1">{selectedDashboard.name}</h2>
                            <p className="text-sm text-slate-500">Simulation for what-if scenarios</p>
                        </div>
                        <button
                            onClick={() => setSelectedInteractiveDashboardId(null)}
                            className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-sm"
                        >
                            <ArrowLeft size={14} />
                            <span className="font-medium">Back</span>
                        </button>
                    </div>

                    {/* Scenario Variables Panel */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6">
                        <h3 className="text-base font-normal text-slate-900 mb-4 flex items-center gap-2">
                            <Sliders size={16} className="text-slate-600" />
                            Scenario Variables
                        </h3>
                        <div className="space-y-4">
                            {selectedDashboard.variables && selectedDashboard.variables.length > 0 ? (
                                selectedDashboard.variables.map((key: string) => (
                                    <div key={key} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                                                {getEntityPropertyName(key)}
                                            </label>
                                            <input
                                                type="number"
                                                value={variableValues[key] || 0}
                                                onChange={(e) => handleUpdateVariable(key, parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                                placeholder="Enter value"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const updatedVars = selectedDashboard.variables.filter((v: string) => v !== key);
                                                setInteractiveDashboards(interactiveDashboards.map(d => 
                                                    d.id === selectedDashboard.id 
                                                        ? { ...d, variables: updatedVars }
                                                        : d
                                                ));
                                                const newValues = { ...variableValues };
                                                delete newValues[key];
                                                setVariableValues(newValues);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">
                                    No variables added yet. Add variables from entities below.
                                </p>
                            )}
                        </div>

                        {/* Add Variable Section */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Add Variable</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {entities.map(entity => (
                                    <div key={entity.id} className="border border-slate-200 rounded-lg p-4">
                                        <h5 className="text-sm font-medium text-slate-900 mb-2">{entity.name}</h5>
                                        <div className="space-y-2">
                                            {entity.properties?.filter(p => p.type === 'number' || p.type === 'integer').map(property => {
                                                const key = `${entity.id}_${property.id}`;
                                                const isSelected = selectedDashboard.variables?.includes(key);
                                                return (
                                                    <button
                                                        key={property.id}
                                                        onClick={() => {
                                                            if (!isSelected) {
                                                                handleAddVariable(entity.id, property.id);
                                                                const updatedVars = [...(selectedDashboard.variables || []), key];
                                                                setInteractiveDashboards(interactiveDashboards.map(d => 
                                                                    d.id === selectedDashboard.id 
                                                                        ? { ...d, variables: updatedVars }
                                                                        : d
                                                                ));
                                                            }
                                                        }}
                                                        disabled={isSelected}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                                                            isSelected
                                                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                                        }`}
                                                    >
                                                        {property.name} ({property.type})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* What-If Scenarios */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6">
                        <h3 className="text-base font-normal text-slate-900 mb-4">What-If Scenarios</h3>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-sm text-slate-600 mb-4">
                                Adjust the variables above to see how changes affect your data visualizations.
                            </p>
                            <div className="space-y-2">
                                {Object.keys(scenarioVariables).length > 0 ? (
                                    Object.entries(scenarioVariables).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between p-2 bg-white rounded">
                                            <span className="text-sm text-slate-700">{getEntityPropertyName(key)}</span>
                                            <span className="text-sm font-medium text-slate-900">{value}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500 text-center py-4">
                                        Add variables and adjust their values to create scenarios
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Placeholder for widgets/charts */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6">
                        <h3 className="text-base font-normal text-slate-900 mb-4">Visualizations</h3>
                        <div className="bg-slate-50 rounded-lg p-8 text-center border-2 border-dashed border-slate-300">
                            <Database className="mx-auto text-slate-300 mb-3" size={40} />
                            <p className="text-sm text-slate-500">
                                Charts and visualizations will appear here based on your scenario variables
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-normal text-slate-900 mb-1">Simulations</h2>
                        <p className="text-sm text-slate-500">Create simulations for what-if scenario analysis</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus size={14} className="mr-2" />
                        Create Simulation
                    </button>
                </div>

                {/* Create Modal */}
                {isCreating && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIsCreating(false)}>
                        <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[500px]" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-normal text-slate-800 mb-4">Create Simulation</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Dashboard Name</label>
                                    <input
                                        type="text"
                                        value={newDashboardName}
                                        onChange={(e) => setNewDashboardName(e.target.value)}
                                        placeholder="e.g., Sales Forecast Scenarios"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                                    <button
                                        onClick={() => {
                                            setIsCreating(false);
                                            setNewDashboardName('');
                                        }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateInteractiveDashboard}
                                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dashboards Grid */}
                {interactiveDashboards.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {interactiveDashboards.map((dashboard) => (
                            <div
                                key={dashboard.id}
                                onClick={() => setSelectedInteractiveDashboardId(dashboard.id)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                                            <Sliders size={18} className="text-teal-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-normal text-slate-900">{dashboard.name}</h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {dashboard.variables?.length || 0} variables
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-slate-900">Open dashboard</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                        <Sliders className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-base font-normal text-slate-700 mb-2">No Simulations</h3>
                        <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                            Create a simulation to explore what-if scenarios by adjusting variables and seeing how they affect your data.
                        </p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                        >
                            Create Your First Simulation
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
