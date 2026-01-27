import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { Database, Sparkles, X, Info, Plus, Share2, ChevronDown, Copy, Check, Trash2, Link, ExternalLink, LayoutDashboard, Search, ArrowLeft, Calendar, Clock, ChevronRight, Sliders, GripVertical, Maximize2, BarChart3, LineChart, PieChart, AreaChart, TrendingUp, Table2 } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { Pagination } from './Pagination';
import { API_BASE } from '../config';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Custom styles to ensure resize handles are visible
const gridLayoutStyles = `
  .react-grid-item {
    transition: none !important;
  }
  .react-grid-item > .react-resizable-handle {
    position: absolute;
    width: 20px;
    height: 20px;
    z-index: 1000;
  }
  .react-grid-item > .react-resizable-handle::after {
    content: "";
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 5px;
    height: 5px;
    border-right: 2px solid rgba(0, 0, 0, 0.4);
    border-bottom: 2px solid rgba(0, 0, 0, 0.4);
  }
  .react-grid-item > .react-resizable-handle-se {
    bottom: 0;
    right: 0;
    cursor: se-resize;
  }
  .react-grid-item > .react-resizable-handle-s {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    cursor: s-resize;
  }
  .react-grid-item > .react-resizable-handle-e {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: e-resize;
  }
  .react-grid-item > .react-resizable-handle-w {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: w-resize;
  }
  .react-grid-item > .react-resizable-handle-n {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    cursor: n-resize;
  }
  .react-grid-item > .react-resizable-handle-ne {
    top: 0;
    right: 0;
    cursor: ne-resize;
  }
  .react-grid-item > .react-resizable-handle-nw {
    top: 0;
    left: 0;
    cursor: nw-resize;
  }
  .react-grid-item > .react-resizable-handle-sw {
    bottom: 0;
    left: 0;
    cursor: sw-resize;
  }
  .react-grid-item:hover > .react-resizable-handle {
    background: rgba(59, 130, 246, 0.1);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleId = 'grid-layout-custom-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = gridLayoutStyles;
        document.head.appendChild(style);
    }
}

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
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full flex flex-col relative" style={{ overflow: 'visible', height: '100%' }}>
            {/* Drag Handle - Entire header is draggable */}
            <div className="drag-handle cursor-move p-1.5 border-b border-slate-100 flex items-center justify-between group hover:bg-slate-50 transition-colors select-none flex-shrink-0" style={{ pointerEvents: 'auto', touchAction: 'none' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GripVertical size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                    <h3 className="text-sm font-medium text-slate-900 truncate">{widget.title}</h3>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 z-10"
                    title="Delete Widget"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0" style={{ overflow: 'auto' }}>
                {widget.description && (
                    <div className="px-3 pt-2 pb-1 flex-shrink-0">
                        <p className="text-xs text-slate-500">{widget.description}</p>
                    </div>
                )}
                <div className="flex-1 min-h-0 px-3 pb-3" style={{ overflow: 'auto' }}>
                    <DynamicChart config={widget} />
                </div>
                {widget.explanation && (
                    <div className="px-3 pb-2 pt-1 border-t border-slate-100 flex-shrink-0">
                        <button
                            onClick={() => setShowExplanation(!showExplanation)}
                            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium"
                        >
                            <Info size={12} />
                            How did I prepare this?
                        </button>
                        {showExplanation && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed">
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
    const [selectedVisualizationType, setSelectedVisualizationType] = useState<string>('');
    
    // Update grid width on window resize
    useEffect(() => {
        const updateGridWidth = () => {
            if (typeof window !== 'undefined') {
                const container = document.getElementById('dashboard-container');
                if (container) {
                    // Subtract padding (32px total: 16px on each side)
                    setGridWidth(container.clientWidth - 32);
                } else {
                    // Fallback: sidebar (240px) + padding (32px) + margins
                    setGridWidth(window.innerWidth - 320);
                }
            }
        };
        
        // Initial calculation
        const timeoutId = setTimeout(updateGridWidth, 100);
        
        // Update on resize with debounce
        let resizeTimeout: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateGridWidth, 150);
        };
        
        window.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(timeoutId);
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', handleResize);
        };
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
            setLayout([]);
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
                    x: w.gridX ?? (index % 2) * 6,
                    y: w.gridY ?? Math.floor(index / 2) * 3,
                    w: w.gridWidth ?? 4,
                    h: w.gridHeight ?? 3,
                    minW: 2,
                    minH: 2,
                    maxW: 12,
                    maxH: 20,
                    isResizable: true,
                    isDraggable: true,
                    static: false
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

    const handleGenerateWidget = async (prompt: string, mentionedEntityIds: string[], visualizationType?: string) => {
        setIsGenerating(true);

        // Enhance prompt with visualization type if selected
        let enhancedPrompt = prompt;
        if (visualizationType && visualizationType !== 'auto') {
            enhancedPrompt = `${visualizationType} of ${prompt}`;
        }

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
                    prompt: enhancedPrompt,
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

    const handleLayoutChange = useCallback(async (newLayout: Layout[]) => {
        setLayout(newLayout);
        
        // Update widget positions in backend
        if (!selectedDashboardId) return;
        
        // Don't save during active drag/resize - wait for stop
        if (isDragging) {
            return;
        }
        
        // Debounce API calls to avoid too many requests
        const timeoutId = setTimeout(async () => {
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
        }, 300);
        
        return () => clearTimeout(timeoutId);
    }, [selectedDashboardId, isDragging]);

    const handleDragStart = () => {
        setIsDragging(true);
    };
    
    const handleDragStop = useCallback((layout: Layout[]) => {
        setIsDragging(false);
        // Force save layout after drag stops
        setLayout(layout);
        if (selectedDashboardId) {
            // Save immediately after drag stops
            setTimeout(async () => {
                for (const item of layout) {
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
            }, 100);
        }
    }, [selectedDashboardId]);

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

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!selectedDashboardId ? (
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
            ) : selectedDashboardId ? (
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
                            <div id="dashboard-container" className="relative min-h-[400px] w-full">
                                {savedWidgets.length > 0 ? (
                                    <GridLayout
                                        className="layout"
                                        layout={layout}
                                        cols={12}
                                        rowHeight={60}
                                        width={gridWidth || 1200}
                                        onLayoutChange={handleLayoutChange}
                                        onDragStart={handleDragStart}
                                        onDragStop={handleDragStop}
                                        onResizeStart={() => setIsDragging(true)}
                                        onResizeStop={(layout) => {
                                            setIsDragging(false);
                                            handleLayoutChange(layout);
                                            // Save immediately after resize stops
                                            if (selectedDashboardId) {
                                                setTimeout(async () => {
                                                    for (const item of layout) {
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
                                                            console.error('Error updating widget size:', error);
                                                        }
                                                    }
                                                }, 100);
                                            }
                                        }}
                                        isDraggable={true}
                                        isResizable={true}
                                        draggableHandle=".drag-handle"
                                        margin={[16, 16]}
                                        containerPadding={[16, 16]}
                                        compactType={null}
                                        preventCollision={false}
                                        useCSSTransforms={true}
                                        resizeHandles={['se', 's', 'e', 'sw', 'nw', 'ne', 'n', 'w']}
                                        allowOverlap={false}
                                        style={{ position: 'relative' }}
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
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
                                    setShowAddWidgetModal(false);
                                    setSelectedVisualizationType(''); // Reset when closing
                                }}>
                                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                                        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-normal text-slate-900">Add Widget</h2>
                                                <p className="text-xs text-slate-500 mt-1">Describe what you want to visualize and how</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowAddWidgetModal(false);
                                                    setSelectedVisualizationType(''); // Reset when closing
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                            {/* Visualization Type Selector */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    Visualization Type
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedVisualizationType}
                                                        onChange={(e) => setSelectedVisualizationType(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 appearance-none cursor-pointer"
                                                    >
                                                        <option value="auto">Auto (let AI decide)</option>
                                                        <option value="Bar chart">Bar Chart</option>
                                                        <option value="Line chart">Line Chart</option>
                                                        <option value="Area chart">Area Chart</option>
                                                        <option value="Pie chart">Pie Chart</option>
                                                        <option value="Table">Table</option>
                                                        <option value="Scatter plot">Scatter Plot</option>
                                                        <option value="Heatmap">Heatmap</option>
                                                        <option value="Gauge">Gauge</option>
                                                        <option value="Funnel chart">Funnel Chart</option>
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <PromptInput
                                                    entities={entities}
                                                    onGenerate={(prompt, mentionedEntityIds) => {
                                                        handleGenerateWidget(prompt, mentionedEntityIds, selectedVisualizationType);
                                                        setShowAddWidgetModal(false);
                                                        setSelectedVisualizationType(''); // Reset after generation
                                                    }}
                                                    isGenerating={isGenerating}
                                                    placeholder="Describe your data... e.g. '@Customers by total orders' or 'Connect to workflow output SalesReport'"
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

