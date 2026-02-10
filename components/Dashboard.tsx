import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { Database, Sparkle, X, Info, Plus, Share, CaretDown, Copy, Check, Trash, Link, ArrowSquareOut, Layout, MagnifyingGlass, ArrowLeft, Calendar, Clock, CaretRight, DotsSixVertical, GearSix, ArrowsClockwise } from '@phosphor-icons/react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { Pagination } from './Pagination';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import GridLayout, { Layout as LayoutItem } from 'react-grid-layout';
import { useNotifications } from '../hooks/useNotifications';
import { ToastContainer } from './ui/Toast';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// New Grafana-style components
import { 
    WidgetGallery, 
    WidgetConfigurator, 
    DashboardToolbar,
    ChartWidget,
    WidgetTemplate,
    WidgetFullConfig,
    WIDGET_TEMPLATES
} from './dashboard/index';
import type { TimeRange } from './dashboard/index';

// Custom styles to ensure resize handles are visible
// Documentation: https://github.com/react-grid-layout/react-grid-layout
const gridLayoutStyles = `
  .react-grid-item {
    transition: all 200ms ease;
    transition-property: left, top, width, height;
  }
  .react-grid-item.cssTransforms {
    transition-property: transform, width, height;
  }
  .react-grid-item.resizing {
    z-index: 1;
    will-change: width, height;
  }
  .react-grid-item.react-draggable-dragging {
    transition: none;
    z-index: 3;
    will-change: transform;
  }
  .react-grid-item.dropping {
    visibility: hidden;
  }
  .react-grid-item > .react-resizable-handle {
    position: absolute;
    width: 20px;
    height: 20px;
    z-index: 10;
  }
  .react-grid-item > .react-resizable-handle::after {
    content: "";
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 6px;
    height: 6px;
    border-right: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-bottom: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
  }
  .react-grid-item:hover > .react-resizable-handle::after {
    border-color: var(--accent-primary, #2383E2);
  }
  .react-grid-item > .react-resizable-handle-se {
    bottom: 0;
    right: 0;
    cursor: se-resize;
  }
  .react-grid-item > .react-resizable-handle-s {
    bottom: 0;
    left: 50%;
    margin-left: -10px;
    cursor: s-resize;
  }
  .react-grid-item > .react-resizable-handle-s::after {
    left: 50%;
    margin-left: -3px;
    bottom: 3px;
    width: 6px;
    height: 2px;
    border: none;
    border-bottom: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
  }
  .react-grid-item > .react-resizable-handle-e {
    right: 0;
    top: 50%;
    margin-top: -10px;
    cursor: e-resize;
  }
  .react-grid-item > .react-resizable-handle-e::after {
    top: 50%;
    margin-top: -3px;
    right: 3px;
    width: 2px;
    height: 6px;
    border: none;
    border-right: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
  }
  .react-grid-item > .react-resizable-handle-w {
    left: 0;
    top: 50%;
    margin-top: -10px;
    cursor: w-resize;
  }
  .react-grid-item > .react-resizable-handle-w::after {
    top: 50%;
    margin-top: -3px;
    left: 3px;
    width: 2px;
    height: 6px;
    border: none;
    border-left: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
  }
  .react-grid-item > .react-resizable-handle-n {
    top: 0;
    left: 50%;
    margin-left: -10px;
    cursor: n-resize;
  }
  .react-grid-item > .react-resizable-handle-n::after {
    left: 50%;
    margin-left: -3px;
    top: 3px;
    width: 6px;
    height: 2px;
    border: none;
    border-top: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
  }
  .react-grid-item > .react-resizable-handle-ne {
    top: 0;
    right: 0;
    cursor: ne-resize;
  }
  .react-grid-item > .react-resizable-handle-ne::after {
    right: 3px;
    top: 3px;
    border-right: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-top: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-bottom: none;
    border-left: none;
  }
  .react-grid-item > .react-resizable-handle-nw {
    top: 0;
    left: 0;
    cursor: nw-resize;
  }
  .react-grid-item > .react-resizable-handle-nw::after {
    left: 3px;
    top: 3px;
    border-left: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-top: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-bottom: none;
    border-right: none;
  }
  .react-grid-item > .react-resizable-handle-sw {
    bottom: 0;
    left: 0;
    cursor: sw-resize;
  }
  .react-grid-item > .react-resizable-handle-sw::after {
    left: 3px;
    bottom: 3px;
    border-left: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-bottom: 2px solid var(--text-tertiary, rgba(0, 0, 0, 0.3));
    border-top: none;
    border-right: none;
  }
  .react-grid-item:hover > .react-resizable-handle {
    background: rgba(35, 131, 226, 0.05);
    border-radius: 4px;
  }
  .react-grid-placeholder {
    background: var(--accent-primary, #2383E2);
    opacity: 0.2;
    transition-duration: 100ms;
    z-index: 2;
    border-radius: 8px;
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

import { generateUUID } from '../utils/uuid';

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
    dateRange?: { start: string; end: string };
}

// Helper function to convert TimeRange to DateRange
const timeRangeToDateRange = (timeRange: TimeRange): { start: string; end: string } => {
    const end = new Date();
    let start = new Date();
    
    switch (timeRange) {
        case 'last_hour':
            start = new Date(end.getTime() - 60 * 60 * 1000);
            break;
        case 'last_24h':
            start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            break;
        case 'last_7d':
            start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'last_30d':
            start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'last_90d':
            start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'last_year':
            start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default:
            start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
};

// Grid Widget Card Component (for use in GridLayout)
const GridWidgetCard: React.FC<{ widget: SavedWidget; onRemove: () => void; dateRange?: { start: string; end: string } }> = React.memo(({ widget, onRemove, dateRange }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    
    return (
        <>
            <div 
                ref={cardRef}
                className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm flex flex-col relative group/card" 
                style={{ height: '100%', width: '100%', overflow: 'hidden' }}
            >
                {/* Drag Handle - Entire header is draggable */}
                <div className="drag-handle cursor-move px-3 py-2 border-b border-[var(--border-light)] flex items-center justify-between group hover:bg-[var(--bg-hover)] transition-all select-none flex-shrink-0 rounded-t-lg" style={{ pointerEvents: 'auto', touchAction: 'none' }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-[var(--bg-tertiary)] group-hover:bg-[var(--border-light)] transition-colors">
                            <DotsSixVertical size={12} weight="bold" className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                        </div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">{widget.title}</h3>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onRemove();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 z-10"
                        title="Delete Widget"
                    >
                        <X size={14} weight="light" />
                    </button>
                </div>
                {/* Chart container - takes all remaining space */}
                <div className="flex-1 flex flex-col min-h-0" style={{ overflow: 'hidden' }}>
                    {widget.description && (
                        <div className="px-3 pt-2 pb-1 flex-shrink-0">
                            <p className="text-xs text-[var(--text-secondary)]">{widget.description}</p>
                        </div>
                    )}
                    <div className="flex-1 p-3" style={{ minHeight: 0 }}>
                        <DynamicChart config={widget} dateRange={dateRange} />
                    </div>
                </div>
                
                {/* Explanation button - positioned absolutely at bottom to always be clickable */}
                {widget.explanation && (
                    <button
                        onClick={() => setShowExplanation(true)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)] to-transparent flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium border-t border-[var(--border-light)] z-20 cursor-pointer"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <Info size={12} weight="light" />
                        How was this prepared?
                    </button>
                )}
            </div>
            
            {/* Explanation Modal - renders outside the clipped container */}
            {showExplanation && widget.explanation && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowExplanation(false)}
                >
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
                    <div 
                        className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto animate-in fade-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border-light)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Info size={14} className="text-[var(--text-secondary)]" weight="light" />
                                <h3 className="text-xs font-medium text-[var(--text-primary)]">How was this prepared?</h3>
                            </div>
                            <button
                                onClick={() => setShowExplanation(false)}
                                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <X size={14} weight="light" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                                <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                                    {widget.explanation}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for memo - only re-render if widget data, onRemove, or dateRange changes
    return prevProps.widget.id === nextProps.widget.id &&
           prevProps.widget.title === nextProps.widget.title &&
           JSON.stringify(prevProps.widget.config) === JSON.stringify(nextProps.widget.config) &&
           JSON.stringify(prevProps.dateRange) === JSON.stringify(nextProps.dateRange);
});

const WidgetCard: React.FC<WidgetCardProps> = React.memo(({ widget, onSave, onRemove, isSaved, onNavigate, entities, dateRange }) => {
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
                            className="text-[var(--accent-primary)] font-medium cursor-pointer hover:underline"
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
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4 relative group">
            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {!isSaved && onSave && (
                    <button
                        onClick={() => onSave(widget)}
                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
                        title="Save to Dashboard"
                        aria-label="Save to Dashboard"
                    >
                        <Plus size={16} weight="light" aria-hidden="true" />
                    </button>
                )}
                <button
                    onClick={onRemove}
                    className="p-1 text-[var(--text-tertiary)] rounded transition-colors hover:text-red-500 hover:bg-red-50"
                    title={isSaved ? "Delete Widget" : "Remove"}
                    aria-label={isSaved ? "Delete Widget" : "Remove"}
                >
                    <X size={14} weight="light" aria-hidden="true" />
                </button>
            </div>

            <h3 className="text-base font-normal text-[var(--text-primary)] mb-1">{widget.title}</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-3">{widget.description}</p>

            <DynamicChart config={widget} dateRange={dateRange} />

            {widget.explanation && (
                <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-slate-800 font-medium"
                    >
                        <Info size={12} weight="light" />
                        How did I prepare this?
                    </button>

                    {showExplanation && (
                        <div className="mt-2 p-3 bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-primary)] leading-relaxed animate-in fade-in slide-in-from-top-1 whitespace-pre-wrap">
                            {renderExplanation(widget.explanation)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export const Dashboard: React.FC<DashboardProps> = ({ entities, onNavigate, onViewChange }) => {
    const { dashboardId: urlDashboardId } = useParams();
    const navigate = useNavigate();
    
    // Notifications
    const { notifications, removeNotification, success, error: showError, warning } = useNotifications(3000);
    
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
    const [layout, setLayout] = useState<LayoutItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [gridWidth, setGridWidth] = useState(1200);
    
    // Modal state for adding widgets
    const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
    const [selectedVisualizationType, setSelectedVisualizationType] = useState<string>('');
    
    // New Grafana-style states
    const [showWidgetGallery, setShowWidgetGallery] = useState(false);
    const [selectedWidgetTemplate, setSelectedWidgetTemplate] = useState<WidgetTemplate | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('last_30d');
    const [refreshInterval, setRefreshInterval] = useState(0); // 0 = disabled
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Auto refresh effect
    useEffect(() => {
        if (refreshInterval > 0 && selectedDashboardId) {
            const intervalId = setInterval(() => {
                handleRefreshDashboard();
            }, refreshInterval * 1000);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, selectedDashboardId]);
    
    const handleRefreshDashboard = async () => {
        if (!selectedDashboardId || isRefreshing) return;
        setIsRefreshing(true);
        await fetchWidgets(selectedDashboardId);
        setTimeout(() => setIsRefreshing(false), 500);
    };
    
    const handleWidgetTemplateSelect = (template: WidgetTemplate) => {
        setShowWidgetGallery(false);
        if (template.id === 'ai_generated') {
            // For AI generated, show the old modal
            setShowAddWidgetModal(true);
        } else {
            // For data-driven widgets, show configurator
            setSelectedWidgetTemplate(template);
        }
    };
    
    const handleSaveConfiguredWidget = async (config: WidgetFullConfig) => {
        if (!selectedDashboardId) return;
        
        try {
            const id = generateUUID();
            const template = selectedWidgetTemplate || WIDGET_TEMPLATES.find(t => t.id === config.type);
            const selectedEntity = entities.find(e => e.id === config.dataConfig?.entityId);
            const findColumnName = (columnId?: string, fallback?: string) => {
                if (!columnId) return fallback || '';
                const col = selectedEntity?.properties?.find(p => p.id === columnId);
                return col?.name || fallback || columnId;
            };
            
            // Find position for new widget
            const maxY = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0;
            const gridX = 0;
            const gridY = maxY;
            const gridW = template?.defaultWidth || 6;
            const gridH = template?.defaultHeight || 4;

            const typeMap: Record<string, WidgetConfig['type']> = {
                bar_chart: 'bar',
                line_chart: 'line',
                area_chart: 'area',
                pie_chart: 'pie',
                kpi: 'bar',
                stat: 'bar',
                table: 'bar',
                trend: 'line',
                gauge: 'gauge',
                parallel: 'parallel',
                heatmap: 'heatmap',
                scatter_matrix: 'scatter_matrix',
                sankey: 'sankey',
                bubble: 'bubble',
                timeline: 'timeline',
                multi_timeline: 'multi_timeline'
            };

            const resolvedType = typeMap[config.type] || 'bar';
            const xAxisKey = findColumnName(config.dataConfig?.xAxisColumn, 'name') || 'name';
            const valueKey = findColumnName(config.dataConfig?.yAxisColumn, 'value') || 'value';
            const yGroupKey = findColumnName(config.dataConfig?.groupBy, 'category') || 'category';
            const sizeKey = findColumnName(config.dataConfig?.sizeColumn, 'size') || 'size';
            const sourceKey = findColumnName(config.dataConfig?.sourceColumn, 'source') || 'source';
            const targetKey = findColumnName(config.dataConfig?.targetColumn, 'target') || 'target';
            const dateKey = findColumnName(config.dataConfig?.dateColumn, 'start') || 'start';
            const severityKey = findColumnName(config.dataConfig?.severityColumn, 'severity') || 'severity';
            const labelKey = findColumnName(config.dataConfig?.labelColumn, 'label') || 'label';
            const trackKey = findColumnName(config.dataConfig?.trackColumn, 'asset') || 'asset';
            const safeData = Array.isArray(config.data) ? config.data : [];
            
            const widgetConfig: WidgetConfig = {
                type: resolvedType,
                title: config.title,
                description: config.description || '',
                data: safeData,
                xAxisKey,
                dataKey: valueKey,
                colors: config.colors,
                ...(resolvedType === 'heatmap' && {
                    yKey: yGroupKey,
                    valueKey
                }),
                ...(resolvedType === 'bubble' && {
                    yKey: valueKey,
                    sizeKey
                }),
                ...(resolvedType === 'sankey' && {
                    valueKey,
                    nodes: Array.from(
                        new Set(
                            safeData.flatMap((row: any) => [
                                String(row.source || row[sourceKey] || ''),
                                String(row.target || row[targetKey] || '')
                            ]).filter(Boolean)
                        )
                    ).map((id) => ({ id })),
                    links: safeData
                        .map((row: any) => ({
                            source: String(row.source || row[sourceKey] || ''),
                            target: String(row.target || row[targetKey] || ''),
                            value: parseFloat(row.value || row[valueKey]) || 0
                        }))
                        .filter((link: any) => link.source && link.target && link.value >= 0)
                }),
                ...(resolvedType === 'timeline' && {
                    events: safeData.map((row: any) => ({
                        start: row.start || row[dateKey],
                        end: row.end,
                        severity: row.severity || row[severityKey] || 'medium',
                        label: row.label || row[labelKey] || row.name
                    }))
                }),
                ...(resolvedType === 'multi_timeline' && {
                    colorKey: trackKey
                }),
                ...(resolvedType === 'parallel' || resolvedType === 'scatter_matrix'
                    ? {
                        dimensions: (selectedEntity?.properties || [])
                            .filter(p => p.type === 'number')
                            .map(p => p.name)
                            .slice(0, resolvedType === 'parallel' ? 6 : 4)
                    }
                    : {}),
                dataConfig: config.dataConfig as any
            };
            
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: config.title,
                    description: config.description,
                    config: widgetConfig,
                    gridX,
                    gridY,
                    gridWidth: gridW,
                    gridHeight: gridH
                }),
                credentials: 'include'
            });
            
            if (res.ok) {
                await fetchWidgets(selectedDashboardId);
                success('Widget added successfully');
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            showError('Failed to add widget');
        }
        
        setSelectedWidgetTemplate(null);
    };
    
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
                    gridX: w.gridX ?? 0,
                    gridY: w.gridY ?? 0,
                    gridWidth: w.gridWidth ?? 6,
                    gridHeight: w.gridHeight ?? 4
                }));
                setSavedWidgets(widgets);
                
                // Update layout for react-grid-layout
                const newLayout = widgets.map((w: SavedWidget, index: number) => ({
                    i: w.id,
                    x: w.gridX ?? (index % 2) * 6,
                    y: w.gridY ?? Math.floor(index / 2) * 4,
                    w: w.gridWidth ?? 6,
                    h: w.gridHeight ?? 4,
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
            showError('Failed to create dashboard', 'Please try again');
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
            showError('Failed to delete dashboard', 'Please try again');
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
            showError('Failed to share dashboard', 'Please try again');
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

        // IMPORTANT: Always include entities so AI uses real data
        // If user mentioned specific entities, use those; otherwise, include ALL entities
        const entityIdsToUse = mentionedEntityIds.length > 0 
            ? mentionedEntityIds 
            : entities.map(e => e.id);
        
        // Build entity context for the AI - include schema info so it knows what data is available
        const entityContext = entities
            .filter(e => entityIdsToUse.includes(e.id))
            .map(e => ({
                id: e.id,
                name: e.name,
                properties: e.properties?.map((p: any) => ({ name: p.name, type: p.type })) || []
            }));

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
                    mentionedEntityIds: entityIdsToUse,
                    entityContext, // Include entity schemas so AI knows what data is available
                    forceRealData: true // Signal to backend to always use real entity data
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
            showError('Failed to generate widget', 'Please try again');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveWidget = async (widget: WidgetConfig, gridPosition?: { x: number; y: number; w: number; h: number }) => {
        if (!selectedDashboardId) {
            warning('No dashboard selected', 'Please select or create a dashboard first');
            return;
        }
        
        try {
            const id = generateUUID();
            
            // Calculate smart position if not provided
            let finalPosition = gridPosition;
            if (!finalPosition) {
                // Find the best position for the new widget
                const defaultWidth = 6; // Half width (6 of 12 columns)
                const defaultHeight = 4;
                
                if (layout.length === 0) {
                    // First widget goes at top-left
                    finalPosition = { x: 0, y: 0, w: defaultWidth, h: defaultHeight };
                } else {
                    // Find the last row and check for space
                    const lastWidget = layout.reduce((latest, item) => {
                        // Find the widget that was added most recently (highest y, or rightmost at highest y)
                        if (item.y > latest.y || (item.y === latest.y && item.x > latest.x)) {
                            return item;
                        }
                        return latest;
                    }, layout[0]);
                    
                    // Calculate the rightmost point in the last row
                    const lastRowY = lastWidget.y;
                    const widgetsInLastRow = layout.filter(item => 
                        item.y < lastRowY + lastWidget.h && item.y + item.h > lastRowY
                    );
                    const rightmostInRow = Math.max(...widgetsInLastRow.map(item => item.x + item.w));
                    
                    // Check if there's space to the right in the last row
                    if (rightmostInRow + defaultWidth <= 12) {
                        // Place next to the rightmost widget in the last row
                        finalPosition = { x: rightmostInRow, y: lastRowY, w: defaultWidth, h: defaultHeight };
                    } else {
                        // No space in the last row, create a new row
                        const maxY = Math.max(...layout.map(item => item.y + item.h));
                        finalPosition = { x: 0, y: maxY, w: defaultWidth, h: defaultHeight };
                    }
                }
            }
            
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: widget.title,
                    description: widget.description,
                    config: widget,
                    gridX: finalPosition.x,
                    gridY: finalPosition.y,
                    gridWidth: finalPosition.w,
                    gridHeight: finalPosition.h
                }),
                credentials: 'include'
            });

            if (res.ok) {
                await fetchWidgets(selectedDashboardId);
                setGeneratedWidgets(prev => prev.filter(w => w !== widget));
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            showError('Failed to save widget', 'Please try again');
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

    const handleLayoutChange = useCallback(async (newLayout: LayoutItem[]) => {
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
    
    const handleDragStop = useCallback((layout: LayoutItem[]) => {
        setIsDragging(false);
        // Force save layout after drag stops
        setLayout(layout);
        if (selectedDashboardId) {
            // Save immediately after drag stops
            setTimeout(async () => {
                let savedCount = 0;
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
                        savedCount++;
                    } catch (error) {
                        console.error('Error updating widget position:', error);
                    }
                }
                if (savedCount > 0) {
                    success('Layout saved');
                }
            }, 100);
        }
    }, [selectedDashboardId, success]);

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
    
    // Memoized filtered dashboards to avoid recalculating on every render
    const filteredDashboards = useMemo(() => 
        dashboards.filter(d => 
            d.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase())
        ), [dashboards, dashboardSearchQuery]
    );
    
    const totalDashboardPages = useMemo(() => 
        Math.ceil(filteredDashboards.length / dashboardsPerPage),
        [filteredDashboards.length]
    );
    
    const paginatedDashboards = useMemo(() => 
        filteredDashboards.slice(
            (currentDashboardPage - 1) * dashboardsPerPage,
            currentDashboardPage * dashboardsPerPage
        ), [filteredDashboards, currentDashboardPage]
    );
    
    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentDashboardPage(1);
    }, [dashboardSearchQuery]);


    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-tutorial="dashboard-content">
            {/* Top Header - Only show when no dashboard is selected */}
            {!selectedDashboardId && (
                <PageHeader title="Dashboards" subtitle="Create and manage your data visualizations" />
            )}

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
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
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" aria-hidden="true" />
                                    <input
                                        type="text"
                                        placeholder="Search dashboards..."
                                        value={dashboardSearchQuery}
                                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                                        aria-label="Search dashboards"
                                    />
                                </div>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {filteredDashboards.length} {filteredDashboards.length === 1 ? 'dashboard' : 'dashboards'}
                                </p>
                            </div>
                            <button
                                onClick={handleCreateDashboard}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                            >
                                <Plus size={14} weight="light" className="mr-2" />
                                Create Dashboard
                            </button>
                        </div>

                        {/* Dashboards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                            {paginatedDashboards.map((dashboard) => (
                                <div
                                    key={dashboard.id}
                                    onClick={() => selectDashboard(dashboard.id)}
                                    className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] overflow-hidden"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-light)] flex items-center justify-center flex-shrink-0 hover:bg-[var(--bg-selected)] transition-all">
                                                    <Layout size={18} weight="light" className="text-[var(--text-secondary)]" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-normal text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                            {dashboard.name}
                                                        </h3>
                                                        {dashboard.isPublic === 1 && (
                                                            <Link size={14} weight="light" className="text-[var(--text-tertiary)] flex-shrink-0" />
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
                                                aria-label={`Delete dashboard ${dashboard.name}`}
                                            >
                                                <Trash size={16} weight="light" aria-hidden="true" />
                                            </button>
                                        </div>

                                        {dashboard.description && (
                                            <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 leading-relaxed">
                                                {dashboard.description}
                                            </p>
                                        )}

                                        <div className="space-y-2 mt-5 pt-4 border-t border-[var(--border-light)]">
                                            {dashboard.createdAt && (
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                    <Calendar size={12} weight="light" className="text-[var(--text-tertiary)]" />
                                                    <span>Created {new Date(dashboard.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {dashboard.updatedAt && (
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                    <Clock size={12} weight="light" className="text-[var(--text-tertiary)]" />
                                                    <span>Updated {new Date(dashboard.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-light)]">
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                            <CaretRight size={14} weight="light" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[var(--text-primary)]">Open dashboard</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Create New Card - Only show if no pagination */}
                            {totalDashboardPages <= 1 && (
                                <div
                                    onClick={handleCreateDashboard}
                                    className="border border-dashed border-[var(--border-medium)] rounded-lg flex flex-col items-center justify-center min-h-[200px] text-[var(--text-tertiary)] cursor-pointer group"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                                        <Plus size={24} weight="light" className="text-[var(--text-tertiary)]" />
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
                    {/* Grafana-style Toolbar */}
                    <DashboardToolbar
                        dashboardName={selectedDashboard?.name || 'Dashboard'}
                        onBack={() => {
                            setSelectedDashboardId(null);
                            navigate('/dashboard', { replace: true });
                        }}
                        onShare={openShareModalIfShared}
                        onDelete={handleDeleteDashboard}
                        onAddWidget={() => setShowWidgetGallery(true)}
                        timeRange={timeRange}
                        onTimeRangeChange={setTimeRange}
                        refreshInterval={refreshInterval}
                        onRefreshIntervalChange={setRefreshInterval}
                        onRefresh={handleRefreshDashboard}
                        isRefreshing={isRefreshing}
                        isEditMode={isEditMode}
                        onToggleEditMode={() => setIsEditMode(!isEditMode)}
                    />

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
                                        className="text-base font-normal text-[var(--text-primary)] bg-transparent border-b border-[var(--border-medium)] focus:border-slate-400 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <h2 
                                        onClick={() => {
                                            setEditingTitle(selectedDashboard.name);
                                            setIsEditingTitle(true);
                                        }}
                                        className="text-base font-normal text-[var(--text-primary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
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
                                        className="text-sm text-[var(--text-secondary)] bg-transparent border-b border-[var(--border-light)] focus:border-slate-400 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <p 
                                        onClick={() => {
                                            setEditingDescription(selectedDashboard.description || '');
                                            setIsEditingDescription(true);
                                        }}
                                        className="text-sm text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
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
                                                    let savedCount = 0;
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
                                                            savedCount++;
                                                        } catch (error) {
                                                            console.error('Error updating widget size:', error);
                                                        }
                                                    }
                                                    if (savedCount > 0) {
                                                        success('Layout saved');
                                                    }
                                                }, 100);
                                            }
                                        }}
                                        isDraggable={isEditMode}
                                        isResizable={isEditMode}
                                        draggableHandle=".drag-handle"
                                        margin={[16, 16]}
                                        containerPadding={[16, 16]}
                                        compactType={null}
                                        preventCollision={true}
                                        useCSSTransforms={true}
                                        resizeHandles={['se', 's', 'e', 'sw', 'nw', 'ne', 'n', 'w']}
                                        allowOverlap={false}
                                        style={{ position: 'relative' }}
                                    >
                                        {savedWidgets.map((widget) => (
                                            <div key={widget.id} className="h-full">
                                                <GridWidgetCard
                                                    widget={widget}
                                                    onRemove={() => removeWidget(widget.id)}
                                                    dateRange={timeRangeToDateRange(timeRange)}
                                                />
                                            </div>
                                        ))}
                                    </GridLayout>
                                ) : (
                                    <div className="bg-[var(--bg-card)] rounded-lg border-2 border-dashed border-[var(--border-medium)] p-12 text-center">
                                        <Database className="mx-auto text-slate-300 mb-3" size={40} weight="light" />
                                        <h3 className="text-base font-normal text-[var(--text-primary)] mb-2">No widgets yet</h3>
                                        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mb-4">
                                            Click the + button to add widgets and create custom visualizations.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Generated Widgets Preview Section (temporary, before adding to grid) */}
                            {generatedWidgets.length > 0 && (
                                <div ref={generatedWidgetsRef} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
                                    <h3 className="text-base font-normal text-[var(--text-primary)] flex items-center gap-2">
                                        <Sparkle size={14} weight="light" className="text-[var(--text-secondary)]" />
                                        New Widgets
                                        <span className="text-xs font-normal text-[var(--text-secondary)]">(click + to add to dashboard)</span>
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
                                                dateRange={timeRangeToDateRange(timeRange)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Floating Add Widget Button */}
                            {selectedDashboard && (
                                <button
                                    onClick={() => setShowWidgetGallery(true)}
                                    className="fixed bottom-8 right-8 bg-[#256A65] text-white rounded-2xl px-5 py-3.5 shadow-xl hover:shadow-2xl hover:bg-[#1e5a55] transition-all duration-300 z-50 flex items-center gap-3 group hover:scale-105 active:scale-95"
                                    title="Add Widget"
                                >
                                    <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                        <Plus size={16} weight="bold" className="group-hover:rotate-90 transition-transform duration-300" />
                                    </div>
                                    <span className="text-sm font-medium hidden sm:inline">Add widget</span>
                                </button>
                            )}
                            
                            {/* Widget Gallery Modal */}
                            {showWidgetGallery && (
                                <WidgetGallery
                                    onSelect={handleWidgetTemplateSelect}
                                    onClose={() => setShowWidgetGallery(false)}
                                />
                            )}
                            
                            {/* Widget Configurator Modal */}
                            {selectedWidgetTemplate && (
                                <WidgetConfigurator
                                    template={selectedWidgetTemplate}
                                    entities={entities}
                                    onSave={handleSaveConfiguredWidget}
                                    onCancel={() => setSelectedWidgetTemplate(null)}
                                />
                            )}

                            {/* Add Widget Modal */}
                            {showAddWidgetModal && (
                                <div 
                                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                    role="dialog"
                                    aria-modal="true"
                                >
                                    {/* Overlay with blur */}
                                    <div 
                                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
                                        onClick={() => {
                                            setShowAddWidgetModal(false);
                                            setSelectedVisualizationType('');
                                        }}
                                    />
                                    
                                    {/* Modal Content */}
                                    <div 
                                        className="relative w-full max-w-2xl bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl transform transition-all duration-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between p-5 border-b border-[var(--border-light)] shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-[var(--bg-tertiary)] rounded-lg">
                                                    <Sparkle size={20} weight="light" className="text-[var(--text-secondary)]" />
                                                </div>
                                                <div>
                                                    <h2 
                                                        className="text-lg font-medium text-[var(--text-primary)]"
                                                        style={{ fontFamily: "'Berkeley Mono', monospace" }}
                                                    >
                                                        Add Widget
                                                    </h2>
                                                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                                                        Describe what you want to visualize
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowAddWidgetModal(false);
                                                    setSelectedVisualizationType('');
                                                }}
                                                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                                aria-label="Close modal"
                                            >
                                                <X size={18} weight="light" />
                                            </button>
                                        </div>
                                        
                                        {/* Body */}
                                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                            {/* Visualization Type Selector */}
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                                    Visualization Type
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedVisualizationType}
                                                        onChange={(e) => setSelectedVisualizationType(e.target.value)}
                                                        className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] appearance-none cursor-pointer transition-all"
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
                                                    <CaretDown size={16} weight="light" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Prompt Input */}
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                                    Describe your visualization
                                                </label>
                                                <PromptInput
                                                    entities={entities}
                                                    onGenerate={async (prompt, mentionedEntityIds) => {
                                                        await handleGenerateWidget(prompt, mentionedEntityIds, selectedVisualizationType);
                                                        setShowAddWidgetModal(false);
                                                        setSelectedVisualizationType('');
                                                    }}
                                                    isGenerating={isGenerating}
                                                    placeholder="e.g. '@Customers by total orders' or 'Monthly revenue trend'"
                                                    buttonLabel="Generate Widget"
                                                />
                                            </div>

                                            {/* Loading State */}
                                            {isGenerating && (
                                                <div className="flex flex-col items-center justify-center py-8 px-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                                                    <div className="relative mb-4">
                                                        <div className="w-12 h-12 border-3 border-[var(--border-light)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                                                        <Sparkle size={20} weight="fill" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent-primary)]" />
                                                    </div>
                                                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                                        Generating your visualization...
                                                    </p>
                                                    <p className="text-xs text-[var(--text-tertiary)] text-center">
                                                        AI is analyzing your data and creating the perfect chart
                                                    </p>
                                                </div>
                                            )}

                                            {/* Tips Section - hide when generating */}
                                            {!isGenerating && (
                                                <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                                                    <div className="flex items-start gap-3">
                                                        <Info size={16} weight="light" className="text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                                                        <div className="text-xs text-[var(--text-secondary)]">
                                                            <p className="font-medium text-[var(--text-primary)] mb-2">Quick Tips</p>
                                                            <ul className="space-y-1.5">
                                                                <li className="flex items-center gap-2">
                                                                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-[10px] font-mono">@</kbd>
                                                                    <span>Mention entities (e.g., @Customers)</span>
                                                                </li>
                                                                <li className="flex items-center gap-2">
                                                                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-[10px] font-mono">.</kbd>
                                                                    <span>Access attributes (e.g., @Customers.totalOrders)</span>
                                                                </li>
                                                                <li className="flex items-center gap-2">
                                                                    <span className="w-5 h-5 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-[10px]">↵</span>
                                                                    <span>Press Enter or click button to generate</span>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
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
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Overlay with blur */}
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
                        onClick={() => setShowShareModal(false)}
                    />
                    
                    {/* Modal Content */}
                    <div 
                        className="relative w-full max-w-md bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl transform transition-all duration-200 animate-in fade-in zoom-in-95 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-[var(--border-light)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[var(--bg-tertiary)] rounded-lg">
                                    <Share size={20} weight="light" className="text-[var(--text-secondary)]" />
                                </div>
                                <div>
                                    <h2 
                                        className="text-lg font-medium text-[var(--text-primary)]"
                                        style={{ fontFamily: "'Berkeley Mono', monospace" }}
                                    >
                                        Share Dashboard
                                    </h2>
                                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                                        Anyone with this link can view
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={18} weight="light" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Share Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                                    />
                                    <button
                                        onClick={copyShareUrl}
                                        className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shrink-0 ${
                                            copied 
                                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                                : 'bg-[var(--bg-selected)] text-white hover:bg-[#555555] shadow-sm hover:shadow-md'
                                        }`}
                                    >
                                        {copied ? <Check size={16} weight="light" /> : <Copy size={16} weight="light" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                            
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                            >
                                <ArrowSquareOut size={14} weight="light" />
                                <span>Open in new tab</span>
                            </a>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-[var(--border-light)] p-5 shrink-0 flex items-center justify-between gap-3">
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
                                className="px-4 py-2.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Toast Notifications */}
            <ToastContainer 
                notifications={notifications} 
                onDismiss={removeNotification}
                position="bottom-right"
            />
        </div>
    );
};

