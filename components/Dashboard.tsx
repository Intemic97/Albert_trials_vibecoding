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

type ExamplePresetId = 'hdpe_transition_monitoring' | 'hdpe_transition_economics';

const EXAMPLE_PRESETS: Array<{
    id: ExamplePresetId;
    name: string;
    description: string;
}> = [
    {
        id: 'hdpe_transition_monitoring',
        name: 'Example - HDPE Transition Monitoring',
        description: 'Monitor dual-reactor HDPE transitions, out-of-spec windows, and material flow in near real time.'
    },
    {
        id: 'hdpe_transition_economics',
        name: 'Example - HDPE Transition Economics',
        description: 'Estimate yearly value from reducing transition time using model-assisted quality monitoring.'
    }
];

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
const GridWidgetCard: React.FC<{
    widget: SavedWidget;
    onRemove: () => void;
    onEdit?: (widget: SavedWidget) => void;
    onDrillDown?: (widget: SavedWidget) => void;
    onSourceClick?: (widget: SavedWidget) => void;
    entities?: Entity[];
    dateRange?: { start: string; end: string };
}> = React.memo(({ widget, onRemove, onEdit, onDrillDown, onSourceClick, entities, dateRange }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const sourceEntity = entities?.find((entity) => entity.id === widget.dataConfig?.entityId);
    const relatedEntityNames = Array.from(
        new Set(
            (widget.dataConfig?.relatedEntityIds || [])
                .map((id: string) => entities?.find((entity) => entity.id === id)?.name)
                .filter(Boolean)
        )
    ) as string[];
    const sourceLabel = useMemo(() => {
        const sources = Array.from(
            new Set(
                [
                    sourceEntity?.name,
                    widget.dataConfig?.entityName,
                    ...relatedEntityNames
                ].filter(Boolean) as string[]
            )
        );

        if (sources.length > 0) {
            return `Source: ${sources.join(' + ')}`;
        }

        if (!widget.dataConfig?.entityId && relatedEntityNames.length === 0) {
            return 'Source: Synthetic';
        }

        if (sourceEntity?.entityType === 'example') return 'Source: Example entity';
        return 'Source: Entity';
    }, [
        sourceEntity?.name,
        sourceEntity?.entityType,
        widget.dataConfig?.entityId,
        widget.dataConfig?.entityName,
        relatedEntityNames
    ]);

    const analyticalConfidence = useMemo(() => {
        const rows = Array.isArray(widget.data) ? widget.data : [];
        if (rows.length === 0) return { label: 'Analytical confidence: Low', color: 'text-red-600', bg: 'bg-red-500/10' };
        const sample = rows.slice(0, Math.min(rows.length, 40));
        const primaryValueKey = Array.isArray(widget.dataKey) ? widget.dataKey[0] : widget.dataKey;
        const validPrimaryValues = sample.filter((row: any) => {
            const value = row?.[primaryValueKey as string];
            return value !== undefined && value !== null && `${value}`.trim() !== '';
        }).length;
        const validDates = sample.filter((row: any) => {
            const candidate = row?.date || row?.fecha || row?.start || row?.timestamp || row?.name;
            if (!candidate) return false;
            return !Number.isNaN(new Date(candidate).getTime());
        }).length;
        const valueCoverage = validPrimaryValues / sample.length;
        const dateCoverage = validDates / sample.length;
        const numericValues = sample
            .map((row: any) => Number(row?.[primaryValueKey as string]))
            .filter((value: number) => Number.isFinite(value));
        const hasSignalVariance = numericValues.length > 2
            ? Math.max(...numericValues) - Math.min(...numericValues) > 0
            : true;
        const score = Math.round((valueCoverage * 0.55 + dateCoverage * 0.25 + (hasSignalVariance ? 0.2 : 0)) * 100);
        if (score >= 80) return { label: 'Analytical confidence: High', color: 'text-emerald-600', bg: 'bg-emerald-500/10' };
        if (score >= 55) return { label: 'Analytical confidence: Medium', color: 'text-amber-600', bg: 'bg-amber-500/10' };
        return { label: 'Analytical confidence: Low', color: 'text-red-600', bg: 'bg-red-500/10' };
    }, [widget.data, widget.dataKey]);
    
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
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onDrillDown && Array.isArray(widget.data) && widget.data.length > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onDrillDown(widget);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors flex-shrink-0 z-10"
                                title="Drill down into data"
                            >
                                <ArrowSquareOut size={14} weight="light" />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onEdit(widget);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors flex-shrink-0 z-10"
                                title="Edit Widget"
                            >
                                <GearSix size={14} weight="light" />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onRemove();
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0 z-10"
                            title="Delete Widget"
                        >
                            <X size={14} weight="light" />
                        </button>
                    </div>
                </div>
                {/* Chart container - takes all remaining space */}
                <div className="flex-1 flex flex-col min-h-0" style={{ overflow: 'hidden' }}>
                    <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
                        <span
                            onClick={(e) => {
                                if (!onSourceClick || !widget.dataConfig?.entityId) return;
                                e.stopPropagation();
                                e.preventDefault();
                                onSourceClick(widget);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)] ${widget.dataConfig?.entityId && onSourceClick ? 'cursor-pointer hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors' : ''}`}
                        >
                            {sourceLabel}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-[var(--border-light)] ${analyticalConfidence.bg} ${analyticalConfidence.color}`}>
                            {analyticalConfidence.label}
                        </span>
                        {widget.dataConfig?.xAxisColumn && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-light)]">
                                X: {widget.xAxisKey || 'n/a'}
                            </span>
                        )}
                        {widget.dataConfig?.yAxisColumn && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-light)]">
                                Y: {Array.isArray(widget.dataKey) ? widget.dataKey.join(', ') : widget.dataKey}
                            </span>
                        )}
                    </div>
                    {widget.description && (
                        <div className="px-3 pt-2 pb-1 flex-shrink-0">
                            <p className="text-xs text-[var(--text-secondary)]">{widget.description}</p>
                        </div>
                    )}
                    <div className="flex-1 p-3" style={{ minHeight: 0 }}>
                        <DynamicChart config={widget} dateRange={dateRange} height="100%" />
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

            <DynamicChart config={widget} dateRange={dateRange} height="100%" />

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
    const [editingSavedWidget, setEditingSavedWidget] = useState<SavedWidget | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('last_30d');
    const [refreshInterval, setRefreshInterval] = useState(0); // 0 = disabled
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSavingDashboard, setIsSavingDashboard] = useState(false);
    const [isCreatingExample, setIsCreatingExample] = useState(false);
    const [creatingExamplePresetId, setCreatingExamplePresetId] = useState<ExamplePresetId | null>(null);
    const [showExamplesMenu, setShowExamplesMenu] = useState(false);
    const examplesMenuRef = useRef<HTMLDivElement>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [drillDownWidget, setDrillDownWidget] = useState<SavedWidget | null>(null);
    
    // Auto refresh effect
    useEffect(() => {
        if (refreshInterval > 0 && selectedDashboardId) {
            const intervalId = setInterval(() => {
                handleRefreshDashboard();
            }, refreshInterval * 1000);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, selectedDashboardId]);

    useEffect(() => {
        if (!showExamplesMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!examplesMenuRef.current) return;
            if (!examplesMenuRef.current.contains(event.target as Node)) {
                setShowExamplesMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExamplesMenu]);
    
    const handleRefreshDashboard = async () => {
        if (!selectedDashboardId || isRefreshing) return;
        setIsRefreshing(true);
        await fetchWidgets(selectedDashboardId);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleCreateProcessExampleDashboard = async (
        presetId: ExamplePresetId = 'hdpe_transition_monitoring',
        autoSelect: boolean = true
    ) => {
        if (isCreatingExample) return;
        const selectedPreset = EXAMPLE_PRESETS.find((preset) => preset.id === presetId) || EXAMPLE_PRESETS[0];
        const exampleName = selectedPreset.name;
        const existing = dashboards.find(d => d.name === exampleName);

        setIsCreatingExample(true);
        setCreatingExamplePresetId(selectedPreset.id);
        try {
            const normalizeText = (value: string = '') =>
                value
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase();
            const includesAny = (value: string, tokens: string[]) => {
                const normalized = normalizeText(value);
                return tokens.some((token) => normalized.includes(normalizeText(token)));
            };
            const fetchEntitiesSnapshot = async (): Promise<Entity[]> => {
                const res = await fetch(`${API_BASE}/entities`, { credentials: 'include' });
                if (!res.ok) return entities;
                const data = await res.json();
                return Array.isArray(data) ? data : entities;
            };
            const fetchRecords = async (entity?: Entity) => {
                if (!entity) return [];
                const res = await fetch(`${API_BASE}/entities/${entity.id}/records`, { credentials: 'include' });
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data) ? data : [];
            };

            let workingEntities: Entity[] = entities;
            let createdEntitiesCount = 0;
            let seededEntitiesCount = 0;

            const ensureEntity = async (blueprint: {
                name: string;
                description: string;
                entityType: string;
                matchTokens: string[];
                properties: Array<{ name: string; type: 'text' | 'number'; unit?: string; defaultValue?: string | number }>;
                records?: Array<Record<string, string | number>>;
            }) => {
                let entity = workingEntities.find((candidate) =>
                    normalizeText(candidate.name) === normalizeText(blueprint.name) ||
                    includesAny(candidate.name, blueprint.matchTokens)
                );

                if (!entity) {
                    const entityId = generateUUID();
                    const createEntityRes = await fetch(`${API_BASE}/entities`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            id: entityId,
                            name: blueprint.name,
                            description: blueprint.description,
                            author: 'Preset generator',
                            lastEdited: 'Just now',
                            entityType: blueprint.entityType,
                            properties: blueprint.properties.map((prop) => ({
                                id: generateUUID(),
                                name: prop.name,
                                type: prop.type,
                                defaultValue: prop.defaultValue ?? (prop.type === 'number' ? '0' : ''),
                                unit: prop.unit
                            }))
                        })
                    });
                    if (!createEntityRes.ok) {
                        throw new Error(`Failed to create required preset entity: ${blueprint.name}`);
                    }
                    createdEntitiesCount += 1;
                    workingEntities = await fetchEntitiesSnapshot();
                    entity = workingEntities.find((candidate) => candidate.id === entityId)
                        || workingEntities.find((candidate) => normalizeText(candidate.name) === normalizeText(blueprint.name));
                }

                if (entity && blueprint.records && blueprint.records.length > 0) {
                    const currentRecords = await fetchRecords(entity);
                    if (currentRecords.length === 0) {
                        for (const row of blueprint.records) {
                            await fetch(`${API_BASE}/entities/${entity.id}/records`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(row)
                            });
                        }
                        seededEntitiesCount += 1;
                    }
                }

                return entity;
            };

            const extrusionEntity = await ensureEntity({
                name: 'Example - Extrusion Lines',
                description: 'Extrusion line capabilities and baseline efficiency.',
                entityType: 'process',
                matchTokens: ['extrus', 'linea', 'line'],
                properties: [
                    { name: 'Line', type: 'text' },
                    { name: 'OEE', type: 'number', unit: '%' },
                    { name: 'Capacity (t/day)', type: 'number', unit: 't/day' }
                ],
                records: [
                    { Line: 'R1', OEE: 91.5, 'Capacity (t/day)': 280 },
                    { Line: 'R2', OEE: 88.2, 'Capacity (t/day)': 250 },
                    { Line: 'R3', OEE: 86.9, 'Capacity (t/day)': 235 }
                ]
            });
            const productionEntity = await ensureEntity({
                name: 'Example - Daily Production',
                description: 'Daily production and quality indicators by line and shift.',
                entityType: 'process',
                matchTokens: ['produccion', 'production', 'throughput'],
                properties: [
                    { name: 'Date', type: 'text' },
                    { name: 'Line', type: 'text' },
                    { name: 'Production (ton)', type: 'number', unit: 'ton' },
                    { name: 'Scrap (%)', type: 'number', unit: '%' },
                    { name: 'Energy (kWh)', type: 'number', unit: 'kWh' },
                    { name: 'Shift', type: 'text' },
                    { name: 'Quality', type: 'text' },
                    { name: 'Product', type: 'text' }
                ],
                records: [
                    { Date: '2026-02-01', Line: 'R1', 'Production (ton)': 265, 'Scrap (%)': 1.3, 'Energy (kWh)': 13840, Shift: 'A', Quality: 'A', Product: 'M5309' },
                    { Date: '2026-02-02', Line: 'R1', 'Production (ton)': 258, 'Scrap (%)': 1.6, 'Energy (kWh)': 13910, Shift: 'B', Quality: 'A', Product: 'M5309' },
                    { Date: '2026-02-03', Line: 'R2', 'Production (ton)': 236, 'Scrap (%)': 3.1, 'Energy (kWh)': 14730, Shift: 'A', Quality: 'B', Product: '5803' },
                    { Date: '2026-02-04', Line: 'R2', 'Production (ton)': 242, 'Scrap (%)': 2.2, 'Energy (kWh)': 14450, Shift: 'B', Quality: 'A', Product: '5803' },
                    { Date: '2026-02-05', Line: 'R3', 'Production (ton)': 221, 'Scrap (%)': 2.8, 'Energy (kWh)': 14220, Shift: 'C', Quality: 'B', Product: 'R4805' },
                    { Date: '2026-02-06', Line: 'R3', 'Production (ton)': 229, 'Scrap (%)': 1.9, 'Energy (kWh)': 14010, Shift: 'A', Quality: 'A', Product: 'R4805' }
                ]
            });
            const rawMaterialEntity = await ensureEntity({
                name: 'Example - Raw Materials',
                description: 'Material family and available stock for HDPE production.',
                entityType: 'material',
                matchTokens: ['materia prima', 'material', 'feedstock', 'resina'],
                properties: [
                    { name: 'Type', type: 'text' },
                    { name: 'Material', type: 'text' },
                    { name: 'Stock (t)', type: 'number', unit: 't' }
                ],
                records: [
                    { Type: 'Virgin', Material: 'Ethylene feed', 'Stock (t)': 920 },
                    { Type: 'Additives', Material: 'Stabilizer package', 'Stock (t)': 62 },
                    { Type: 'Recycled', Material: 'Reprocessed HDPE', 'Stock (t)': 180 }
                ]
            });
            const ordersEntity = await ensureEntity({
                name: 'Example - Production Orders',
                description: 'Open order portfolio and operational urgency.',
                entityType: 'generic',
                matchTokens: ['orden', 'order'],
                properties: [
                    { name: 'Order code', type: 'text' },
                    { name: 'Due date', type: 'text' },
                    { name: 'Priority', type: 'text' },
                    { name: 'Status', type: 'text' }
                ],
                records: [
                    { 'Order code': 'PO-4012', 'Due date': '2026-02-07', Priority: 'High', Status: 'In progress' },
                    { 'Order code': 'PO-4016', 'Due date': '2026-02-09', Priority: 'Medium', Status: 'Planned' },
                    { 'Order code': 'PO-4021', 'Due date': '2026-02-11', Priority: 'Low', Status: 'Planned' },
                    { 'Order code': 'PO-4025', 'Due date': '2026-02-12', Priority: 'High', Status: 'At risk' }
                ]
            });

            if (createdEntitiesCount > 0 || seededEntitiesCount > 0) {
                success(
                    'Preset entities prepared',
                    `Created ${createdEntitiesCount} and seeded ${seededEntitiesCount} entities for this dashboard.`
                );
            }

            const findProp = (entity: Entity | undefined, tokens: string[], preferredType?: string) => {
                if (!entity?.properties?.length) return undefined;
                const typedCandidate = preferredType
                    ? entity.properties.find((prop: any) => prop.type === preferredType && includesAny(prop.name, tokens))
                    : undefined;
                return typedCandidate || entity.properties.find((prop: any) => includesAny(prop.name, tokens));
            };

            const [extrusionRecords, productionRecords, rawMaterialRecords, orderRecords] = await Promise.all([
                fetchRecords(extrusionEntity),
                fetchRecords(productionEntity),
                fetchRecords(rawMaterialEntity),
                fetchRecords(ordersEntity)
            ]);

            const toNum = (value: any) => {
                const parsed = parseFloat(value);
                return Number.isFinite(parsed) ? parsed : 0;
            };

            const extrusionNameProp = findProp(extrusionEntity, ['nombre', 'linea', 'line', 'name']);
            const extrusionEffProp = findProp(extrusionEntity, ['eficiencia', 'oee']);
            const extrusionCapacityProp = findProp(extrusionEntity, ['capacidad', 'capacity']);

            const productionDateProp = findProp(productionEntity, ['fecha', 'date', 'timestamp']);
            const productionLineProp =
                findProp(productionEntity, ['linea', 'line', 'extrusora'], 'relation') ||
                findProp(productionEntity, ['linea', 'line', 'extrusora']);
            const productionTonsProp = findProp(productionEntity, ['produccion', 'ton', 'output']);
            const productionScrapProp = findProp(productionEntity, ['scrap', 'merma', 'rechazo']);
            const productionEnergyProp = findProp(productionEntity, ['energia', 'kwh', 'consumo']);
            const productionShiftProp = findProp(productionEntity, ['turno', 'shift']);
            const productionQualityProp = findProp(productionEntity, ['calidad', 'quality', 'grade']);
            const productionProductProp = findProp(productionEntity, ['producto', 'product', 'sku']);

            const materialTypeProp = findProp(rawMaterialEntity, ['tipo', 'type', 'familia']);
            const materialNameProp = findProp(rawMaterialEntity, ['material', 'nombre', 'name']);
            const materialStockProp = findProp(rawMaterialEntity, ['stock', 'inventario', 'inventory']);

            const orderDueDateProp = findProp(ordersEntity, ['entrega', 'due', 'fecha', 'date']);
            const orderPriorityProp = findProp(ordersEntity, ['prioridad', 'priority']);
            const orderCodeProp = findProp(ordersEntity, ['codigo', 'code', 'orden', 'order']);
            const orderStatusProp = findProp(ordersEntity, ['estado', 'status']);

            const extrusionNameById = new Map<string, string>();
            const extrusionRows = extrusionRecords.map((record: any) => {
                const lineName = String(record.values?.[extrusionNameProp?.id || ''] || `Line ${record.id}`);
                extrusionNameById.set(record.id, lineName);
                return {
                    name: lineName,
                    oee: toNum(record.values?.[extrusionEffProp?.id || '']),
                    capacity: toNum(record.values?.[extrusionCapacityProp?.id || ''])
                };
            });

            const avgOee = extrusionRows.length > 0
                ? extrusionRows.reduce((sum, row) => sum + row.oee, 0) / extrusionRows.length
                : 0;

            const productionNormalized = productionRecords.map((record: any) => {
                let lineValue = record.values?.[productionLineProp?.id || ''];
                try {
                    const parsed = JSON.parse(lineValue);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        lineValue = parsed[0];
                    }
                } catch {
                    // keep raw value
                }
                const relatedLineId = String(lineValue || '');
                const lineNameFromMap = extrusionNameById.get(relatedLineId);
                const fallbackLineName = String(
                    record.values?.[productionLineProp?.id || ''] ||
                    record.values?.[extrusionNameProp?.id || ''] ||
                    ''
                ).trim();
                const lineName = lineNameFromMap || fallbackLineName || `Line ${record.id.slice(-4)}`;
                const date = String(record.values?.[productionDateProp?.id || ''] || '').slice(0, 10) || 'Unknown date';
                const tons = toNum(record.values?.[productionTonsProp?.id || '']);
                const scrap = toNum(record.values?.[productionScrapProp?.id || '']);
                const energy = toNum(record.values?.[productionEnergyProp?.id || '']);
                const shift = String(record.values?.[productionShiftProp?.id || ''] || 'Unknown shift');
                const quality = String(record.values?.[productionQualityProp?.id || ''] || 'A');
                const product = String(record.values?.[productionProductProp?.id || ''] || 'Product');
                return { date, lineName, tons, scrap, energy, shift, quality, product };
            });

            const scrapByLineMap = new Map<string, number[]>();
            const tonsByDateMap = new Map<string, number>();
            const scrapByDateMap = new Map<string, number[]>();
            const heatMapAgg = new Map<string, number[]>();
            for (const row of productionNormalized) {
                if (!scrapByLineMap.has(row.lineName)) scrapByLineMap.set(row.lineName, []);
                scrapByLineMap.get(row.lineName)!.push(row.scrap);

                tonsByDateMap.set(row.date, (tonsByDateMap.get(row.date) || 0) + row.tons);
                if (!scrapByDateMap.has(row.date)) scrapByDateMap.set(row.date, []);
                scrapByDateMap.get(row.date)!.push(row.scrap);

                const key = `${row.date}||${row.shift}`;
                if (!heatMapAgg.has(key)) heatMapAgg.set(key, []);
                heatMapAgg.get(key)!.push(row.scrap);
            }

            const scrapByLine = Array.from(scrapByLineMap.entries()).map(([name, values]) => ({
                name,
                value: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0
            })).sort((a, b) => b.value - a.value);

            const tonsByDate = Array.from(tonsByDateMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const latestProductionDate =
                tonsByDate.length > 0
                    ? tonsByDate[tonsByDate.length - 1].name
                    : new Date().toISOString().slice(0, 10);

            const scrapTrend = Array.from(scrapByDateMap.entries())
                .map(([name, values]) => ({
                    name,
                    value: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const heatmapData = Array.from(heatMapAgg.entries()).map(([key, values]) => {
                const [date, shift] = key.split('||');
                const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                return {
                    [productionDateProp?.name || 'Date']: date,
                    [productionShiftProp?.name || 'Shift']: shift,
                    [productionScrapProp?.name || 'Scrap']: Number(avg.toFixed(2)),
                    name: date,
                    category: shift,
                    value: Number(avg.toFixed(2))
                };
            });

            const bubbleData = productionNormalized.map((row) => ({
                [productionTonsProp?.name || 'Production (ton)']: row.tons,
                [productionEnergyProp?.name || 'Energy (kWh)']: row.energy,
                [productionScrapProp?.name || 'Scrap (%)']: row.scrap,
                date: row.date,
                name: `${row.product} • ${row.date}`,
                value: row.energy
            }));

            const sankeyData = rawMaterialRecords.map((record: any) => {
                const source = String(record.values?.[materialTypeProp?.id || ''] || 'Raw material');
                const target = String(record.values?.[materialNameProp?.id || ''] || 'Material');
                const value = Math.max(0, toNum(record.values?.[materialStockProp?.id || '']));
                return { source, target, value, date: latestProductionDate };
            }).filter((row) => row.source && row.target && row.value > 0);

            const scrapSeries = productionNormalized.map((row) => row.scrap).filter((value) => Number.isFinite(value));
            const avgScrap = scrapSeries.length ? scrapSeries.reduce((sum, value) => sum + value, 0) / scrapSeries.length : 0;
            const timelineData = productionNormalized
                .filter((row) => row.date && row.scrap >= 0)
                .map((row) => ({
                    start: row.date,
                    severity: row.scrap >= Math.max(4, avgScrap + 1.2)
                        ? 'high'
                        : row.scrap >= Math.max(2.5, avgScrap + 0.5)
                            ? 'medium'
                            : 'low',
                    label: `${row.lineName} | ${row.product} | scrap ${row.scrap.toFixed(1)}% | ${row.tons.toFixed(0)} t`
                }))
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            // Transition intelligence (grade/product change impact)
            const productionOrdered = [...productionNormalized]
                .filter((row) => row.date && row.product)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const qualityIsStable = (row: typeof productionOrdered[number]) =>
                row.scrap <= avgScrap + 0.3 && ['A', 'A+'].includes((row.quality || '').toUpperCase());
            const transitionComparisonData: Array<{
                name: string;
                date: string;
                fromProduct: string;
                toProduct: string;
                labSafeHours: number;
                modelEstimatedHours: number;
                savingHours: number;
            }> = [];
            for (let index = 1; index < productionOrdered.length; index++) {
                const previous = productionOrdered[index - 1];
                const current = productionOrdered[index];
                if (previous.product === current.product) continue;

                const followup = productionOrdered.slice(index, index + 6);
                let firstStableAt = followup.findIndex((row) => qualityIsStable(row));
                if (firstStableAt < 0) firstStableAt = Math.min(followup.length, 3);
                const modelEstimatedHours = Math.max(2, firstStableAt * 2 || 2);
                const labSafeHours = Math.max(modelEstimatedHours + 2, Math.round(modelEstimatedHours * 1.8));
                const savingHours = Math.max(0.5, Number((labSafeHours - modelEstimatedHours).toFixed(1)));

                transitionComparisonData.push({
                    name: `${previous.product} -> ${current.product}`,
                    date: current.date,
                    fromProduct: previous.product,
                    toProduct: current.product,
                    labSafeHours: Number(labSafeHours.toFixed(1)),
                    modelEstimatedHours: Number(modelEstimatedHours.toFixed(1)),
                    savingHours
                });
            }
            const transitionInsights = transitionComparisonData.length > 0
                ? transitionComparisonData
                : [
                    {
                        name: 'Grade A -> Grade B',
                        date: productionOrdered[0]?.date || new Date().toISOString().slice(0, 10),
                        fromProduct: 'Grade A',
                        toProduct: 'Grade B',
                        labSafeHours: 8,
                        modelEstimatedHours: 4,
                        savingHours: 4
                    }
                ];
            const avgLabTransitionHours = transitionInsights.reduce((sum, row) => sum + row.labSafeHours, 0) / transitionInsights.length;
            const avgModelTransitionHours = transitionInsights.reduce((sum, row) => sum + row.modelEstimatedHours, 0) / transitionInsights.length;
            const avgSavedTransitionHours = transitionInsights.reduce((sum, row) => sum + row.savingHours, 0) / transitionInsights.length;

            const specBandDates = tonsByDate.length > 0
                ? tonsByDate.map((d) => d.name).sort((a, b) => a.localeCompare(b))
                : Array.from({ length: 6 }).map((_, idx) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - idx));
                    return date.toISOString().slice(0, 10);
                });
            const specBandData = specBandDates.map((date, idx) => {
                const isSecondPhase = idx >= Math.floor(specBandDates.length / 2);
                const targetMi = isSecondPhase ? 0.28 : 0.60;
                const lowerSpec = Number((targetMi - 0.06).toFixed(3));
                const upperSpec = Number((targetMi + 0.06).toFixed(3));
                const predictedMI = Number((targetMi + ((idx % 3) - 1) * 0.018).toFixed(3));
                const labMI = idx % 2 === 0 ? Number((predictedMI + (idx % 4 === 0 ? 0.012 : -0.008)).toFixed(3)) : null;
                return {
                    name: date,
                    predictedMI,
                    labMI,
                    lowerSpec,
                    upperSpec
                };
            });
            const outOfSpecCount = specBandData.filter((row) => row.predictedMI < row.lowerSpec || row.predictedMI > row.upperSpec).length;
            const avgTransitionSavingHours = transitionInsights.reduce((sum, row) => sum + row.savingHours, 0) / transitionInsights.length;
            const transitionsPerYear = 365 / 4; // average 4-day cycle between transitions
            const productionRateKgH = 14000; // representative production rate
            const primaryPriceEurKg = 1.45;
            const secondaryPriceEurKg = 1.05;
            const priceDeltaEurKg = primaryPriceEurKg - secondaryPriceEurKg;
            const yearlyTransitionGainEur = avgTransitionSavingHours * transitionsPerYear * productionRateKgH * priceDeltaEurKg;
            const transitionValueGauge = [{
                name: 'Annual value',
                value: Number(yearlyTransitionGainEur.toFixed(0)),
                date: latestProductionDate
            }];
            const transitionFlowSankeyData = transitionInsights.map((transition) => ({
                // Use explicit "from/to" lanes to avoid cyclic depth collapse in simplified Sankey layout
                source: `From: ${transition.fromProduct}`,
                target: `To: ${transition.toProduct}`,
                value: Number(Math.max(1, transition.savingHours).toFixed(2)),
                date: transition.date
            }));

            const today = new Date();
            const orderEvents = orderRecords.map((record: any, idx: number) => {
                const rawDate = String(record.values?.[orderDueDateProp?.id || ''] || '').slice(0, 10);
                const parsedDate = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
                // Keep example readable with past-oriented ranges: clamp far-future dates to recent timeline window
                const fallbackDate = new Date(today.getTime() - idx * 2 * 24 * 60 * 60 * 1000);
                const plottedDate = parsedDate
                    ? (parsedDate.getTime() > today.getTime() ? fallbackDate : parsedDate)
                    : fallbackDate;
                const date = plottedDate.toISOString().slice(0, 10);
                const priority = String(record.values?.[orderPriorityProp?.id || ''] || 'Normal').toLowerCase();
                const status = String(record.values?.[orderStatusProp?.id || ''] || 'Planned');
                const code = String(record.values?.[orderCodeProp?.id || ''] || `Order ${record.id}`);
                const severity = /alta|high|urgent/.test(priority)
                    ? 'high'
                    : /baja|low/.test(priority)
                        ? 'low'
                        : 'medium';
                return { date, priority, status, code, severity };
            }).filter((event) => event.date && !Number.isNaN(new Date(event.date).getTime()));

            const trackMap = new Map<string, any[]>();
            for (const event of orderEvents) {
                if (!trackMap.has(event.status)) trackMap.set(event.status, []);
                trackMap.get(event.status)!.push({
                    start: event.date,
                    severity: event.severity,
                    label: event.code
                });
            }
            const tracks = Array.from(trackMap.entries()).map(([id, events]) => ({
                id,
                title: id,
                subtitle: `${events.length} orders`,
                events
            }));

            const entityIds = {
                extrusion: extrusionEntity?.id,
                production: productionEntity?.id,
                materials: rawMaterialEntity?.id,
                orders: ordersEntity?.id
            };

            let targetDashboardId = existing?.id;
            const wasExistingDashboard = Boolean(existing);
            if (!targetDashboardId) {
                const dashboardId = generateUUID();
                const createDashboardRes = await fetch(`${API_BASE}/dashboards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        id: dashboardId,
                        name: exampleName,
                        description: selectedPreset.description
                    })
                });
                if (!createDashboardRes.ok) {
                    throw new Error('Failed to create example dashboard');
                }
                const createdDashboard = await createDashboardRes.json();
                targetDashboardId = createdDashboard.id;
            }

            const widgetCatalog: Record<string, { title: string; description: string; config: any; gridX: number; gridY: number; gridWidth: number; gridHeight: number }> = {
                oeeGauge: {
                    title: 'Plant OEE (avg)',
                    description: 'Average operational efficiency across extrusion lines.',
                    config: {
                        type: 'gauge',
                        title: 'Plant OEE (avg)',
                        description: '',
                        data: [{ name: 'OEE', value: Number(avgOee.toFixed(1)), date: latestProductionDate }],
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: 100,
                        subtitle: 'Target >= 90%',
                        dataConfig: {
                            entityId: entityIds.extrusion,
                            entityName: extrusionEntity?.name || 'Extrusion',
                            relatedEntityIds: [entityIds.extrusion].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 0, gridWidth: 3, gridHeight: 3
                },
                efficiencyByLine: {
                    title: 'Efficiency by line',
                    description: 'Performance benchmark by extrusion line.',
                    config: {
                        type: 'bar',
                        title: 'Efficiency by line',
                        description: '',
                        data: extrusionRows.map(r => ({ name: r.name, value: r.oee, date: latestProductionDate })),
                        xAxisKey: 'name',
                        dataKey: 'value',
                        dataConfig: {
                            entityId: entityIds.extrusion,
                            entityName: extrusionEntity?.name || 'Extrusion',
                            relatedEntityIds: [entityIds.extrusion].filter(Boolean)
                        }
                    },
                    gridX: 3, gridY: 0, gridWidth: 5, gridHeight: 4
                },
                scrapByLine: {
                    title: 'Scrap by line',
                    description: 'Average scrap rate by line (higher is worse).',
                    config: {
                        type: 'bar',
                        title: 'Scrap by line',
                        description: '',
                        data: scrapByLine.map((row) => ({ ...row, date: latestProductionDate })),
                        xAxisKey: 'name',
                        dataKey: 'value',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production, entityIds.extrusion].filter(Boolean)
                        }
                    },
                    gridX: 8, gridY: 0, gridWidth: 4, gridHeight: 4
                },
                throughputTrend: {
                    title: 'Daily production throughput',
                    description: 'Total production output trend (ton/day).',
                    config: {
                        type: 'line',
                        title: 'Daily production throughput',
                        description: '',
                        data: tonsByDate,
                        xAxisKey: 'name',
                        dataKey: 'value',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 4, gridWidth: 6, gridHeight: 4
                },
                scrapTrend: {
                    title: 'Scrap trend',
                    description: 'Average scrap evolution by day.',
                    config: {
                        type: 'line',
                        title: 'Scrap trend',
                        description: '',
                        data: scrapTrend,
                        xAxisKey: 'name',
                        dataKey: 'value',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production].filter(Boolean)
                        }
                    },
                    gridX: 6, gridY: 4, gridWidth: 6, gridHeight: 4
                },
                scrapHeatmap: {
                    title: 'Scrap heatmap (date x shift)',
                    description: 'Scrap intensity by day and shift to detect unstable windows.',
                    config: {
                        type: 'heatmap',
                        title: 'Scrap heatmap',
                        description: '',
                        data: heatmapData,
                        xAxisKey: productionDateProp?.name || 'Date',
                        yKey: productionShiftProp?.name || 'Shift',
                        dataKey: productionScrapProp?.name || 'Scrap',
                        valueKey: productionScrapProp?.name || 'Scrap',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 8, gridWidth: 6, gridHeight: 5
                },
                energyBubble: {
                    title: 'Energy vs throughput vs scrap',
                    description: 'Bubble view to identify inefficient production runs.',
                    config: {
                        type: 'bubble',
                        title: 'Energy vs throughput vs scrap',
                        description: '',
                        data: bubbleData,
                        xAxisKey: productionTonsProp?.name || 'Production (ton)',
                        yKey: productionEnergyProp?.name || 'Energy (kWh)',
                        dataKey: productionEnergyProp?.name || 'Energy (kWh)',
                        sizeKey: productionScrapProp?.name || 'Scrap (%)',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production].filter(Boolean)
                        }
                    },
                    gridX: 6, gridY: 8, gridWidth: 6, gridHeight: 5
                },
                materialFlow: {
                    title: 'Material stock flow',
                    description: 'Current raw material inventory by family and material.',
                    config: {
                        type: 'sankey',
                        title: 'Material stock flow',
                        description: '',
                        data: sankeyData,
                        xAxisKey: 'source',
                        dataKey: 'value',
                        valueKey: 'value',
                        dataConfig: {
                            entityId: entityIds.materials,
                            entityName: rawMaterialEntity?.name || 'Materials',
                            relatedEntityIds: [entityIds.materials].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 13, gridWidth: 6, gridHeight: 5
                },
                qualityTimeline: {
                    title: 'Quality risk timeline',
                    description: 'Daily quality anomalies detected from scrap excursions vs plant baseline.',
                    config: {
                        type: 'timeline',
                        title: 'Quality risk timeline',
                        description: '',
                        subtitle: `Baseline scrap: ${avgScrap.toFixed(2)}%`,
                        data: timelineData,
                        xAxisKey: 'start',
                        dataKey: 'severity',
                        events: timelineData,
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production, entityIds.extrusion].filter(Boolean)
                        }
                    },
                    gridX: 6, gridY: 13, gridWidth: 6, gridHeight: 4
                },
                transitionDurationCompare: {
                    title: 'Transition duration (lab-safe vs model-assisted)',
                    description: 'Estimated time per grade/product transition under conservative lab-safe criteria vs model-assisted monitoring.',
                    config: {
                        type: 'line',
                        title: 'Transition duration (h)',
                        description: '',
                        data: transitionInsights,
                        xAxisKey: 'name',
                        dataKey: ['labSafeHours', 'modelEstimatedHours'],
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production, entityIds.orders].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 18, gridWidth: 7, gridHeight: 5
                },
                transitionLabGauge: {
                    title: 'Avg transition time (LAB-safe)',
                    description: 'Average transition duration using conservative laboratory-based decision point.',
                    config: {
                        type: 'gauge',
                        title: 'LAB-safe transition (h)',
                        description: '',
                        data: [{ name: 'LAB-safe', value: Number(avgLabTransitionHours.toFixed(2)), date: latestProductionDate }],
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: 12,
                        subtitle: 'Hours'
                    },
                    gridX: 0, gridY: 23, gridWidth: 3, gridHeight: 4
                },
                transitionModelGauge: {
                    title: 'Avg transition time (model-assisted)',
                    description: 'Average transition duration with online model-assisted quality monitoring.',
                    config: {
                        type: 'gauge',
                        title: 'Model transition (h)',
                        description: '',
                        data: [{ name: 'Model', value: Number(avgModelTransitionHours.toFixed(2)), date: latestProductionDate }],
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: 12,
                        subtitle: 'Hours'
                    },
                    gridX: 3, gridY: 23, gridWidth: 3, gridHeight: 4
                },
                transitionSavedGauge: {
                    title: 'Avg hours saved per transition',
                    description: 'Expected transition-time reduction enabled by model-assisted tracking.',
                    config: {
                        type: 'gauge',
                        title: 'Hours saved',
                        description: '',
                        data: [{ name: 'Saved', value: Number(avgSavedTransitionHours.toFixed(2)), date: latestProductionDate }],
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: 8,
                        subtitle: 'h / transition'
                    },
                    gridX: 6, gridY: 23, gridWidth: 3, gridHeight: 4
                },
                outOfSpecGauge: {
                    title: 'Out-of-spec checkpoints',
                    description: 'Predicted checkpoints outside MI specification bounds.',
                    config: {
                        type: 'gauge',
                        title: 'Out-of-spec checkpoints',
                        description: '',
                        data: [{ name: 'Out-of-spec', value: outOfSpecCount, date: latestProductionDate }],
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: Math.max(6, specBandData.length),
                        subtitle: 'count'
                    },
                    gridX: 9, gridY: 23, gridWidth: 3, gridHeight: 4
                },
                transitionValue: {
                    title: 'Estimated annual value from faster transitions',
                    description: 'Potential annual value from reducing secondary-quality production time during grade transitions.',
                    config: {
                        type: 'gauge',
                        title: 'Annual transition value',
                        description: '',
                        data: transitionValueGauge,
                        xAxisKey: 'name',
                        dataKey: 'value',
                        min: 0,
                        max: Math.max(100000, Number((yearlyTransitionGainEur * 1.5).toFixed(0))),
                        subtitle: 'EUR/year (scenario)',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production, entityIds.orders].filter(Boolean)
                        }
                    },
                    gridX: 7, gridY: 18, gridWidth: 5, gridHeight: 5
                },
                specBandComparison: {
                    title: 'MI specification tracking (LAB vs model)',
                    description: 'Model prediction and periodic laboratory checkpoints against lower/upper specification bounds.',
                    config: {
                        type: 'line',
                        title: 'MI tracking with spec band',
                        description: '',
                        data: specBandData,
                        xAxisKey: 'name',
                        dataKey: ['predictedMI', 'labMI', 'lowerSpec', 'upperSpec'],
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 27, gridWidth: 12, gridHeight: 5
                },
                gradeTransitionFlow: {
                    title: 'Grade transition flow (saving-weighted)',
                    description: 'Flow between produced grades; link weight is proportional to transition hours saved with model-assisted monitoring.',
                    config: {
                        type: 'sankey',
                        title: 'Grade transition flow',
                        description: '',
                        data: transitionFlowSankeyData,
                        xAxisKey: 'source',
                        dataKey: 'value',
                        valueKey: 'value',
                        dataConfig: {
                            entityId: entityIds.production,
                            entityName: productionEntity?.name || 'Production',
                            relatedEntityIds: [entityIds.production, entityIds.orders].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 32, gridWidth: 12, gridHeight: 5
                },
                orderPortfolio: {
                    title: 'Order portfolio by status',
                    description: 'Multi-track due-date timeline grouped by order status.',
                    config: {
                        type: 'multi_timeline',
                        title: 'Order portfolio by status',
                        description: '',
                        data: orderEvents,
                        xAxisKey: 'date',
                        dataKey: 'severity',
                        tracks,
                        dataConfig: {
                            entityId: entityIds.orders,
                            entityName: ordersEntity?.name || 'Orders',
                            relatedEntityIds: [entityIds.orders].filter(Boolean)
                        }
                    },
                    gridX: 0, gridY: 37, gridWidth: 12, gridHeight: 5
                }
            };

            const presetWidgetKeys: Record<ExamplePresetId, Array<keyof typeof widgetCatalog>> = {
                hdpe_transition_monitoring: [
                    'oeeGauge',
                    'efficiencyByLine',
                    'scrapByLine',
                    'throughputTrend',
                    'scrapTrend',
                    'scrapHeatmap',
                    'energyBubble',
                    'materialFlow',
                    'qualityTimeline',
                    'transitionDurationCompare',
                    'transitionLabGauge',
                    'transitionModelGauge',
                    'transitionSavedGauge',
                    'outOfSpecGauge',
                    'specBandComparison',
                    'gradeTransitionFlow',
                    'orderPortfolio'
                ],
                hdpe_transition_economics: [
                    'transitionDurationCompare',
                    'transitionValue',
                    'transitionSavedGauge',
                    'specBandComparison',
                    'gradeTransitionFlow',
                    'materialFlow',
                    'energyBubble',
                    'scrapTrend',
                    'throughputTrend',
                    'orderPortfolio'
                ]
            };
            const widgetDefs = presetWidgetKeys[presetId].map((key) => widgetCatalog[key]);

            const existingWidgetsRes = await fetch(`${API_BASE}/dashboards/${targetDashboardId}/widgets`, { credentials: 'include' });
            const existingWidgetsData = existingWidgetsRes.ok ? await existingWidgetsRes.json() : [];
            const existingTitles = new Set(
                Array.isArray(existingWidgetsData)
                    ? existingWidgetsData.map((widget: any) => widget?.title).filter(Boolean)
                    : []
            );

            for (let index = 0; index < widgetDefs.length; index++) {
                const widget = widgetDefs[index];
                if (existingTitles.has(widget.title)) continue;
                await fetch(`${API_BASE}/dashboards/${targetDashboardId}/widgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        id: generateUUID(),
                        title: widget.title,
                        description: widget.description,
                        config: widget.config,
                        gridX: widget.gridX,
                        gridY: widget.gridY,
                        gridWidth: widget.gridWidth,
                        gridHeight: widget.gridHeight
                    })
                });
            }

            const refreshed = await fetch(`${API_BASE}/dashboards`, { credentials: 'include' });
            const refreshedDashboards = await refreshed.json();
            if (Array.isArray(refreshedDashboards)) {
                setDashboards(refreshedDashboards);
            }
            if (autoSelect) {
                selectDashboard(targetDashboardId);
            }
            success(
                wasExistingDashboard ? 'Example dashboard updated' : 'Example dashboard created',
                `${selectedPreset.name} is ready.`
            );
            setShowExamplesMenu(false);
        } catch (error) {
            console.error('Error creating process example dashboard:', error);
            showError('Failed to create example dashboard', 'Please try again');
        } finally {
            setIsCreatingExample(false);
            setCreatingExamplePresetId(null);
        }
    };
    
    const handleExportPdf = async () => {
        if (isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const container = document.getElementById('dashboard-grid-area');
            if (!container) {
                showError('Export failed', 'Dashboard container not found');
                return;
            }
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(container, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#0f1117',
                scale: 2,
                useCORS: true,
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            const { default: jsPDF } = await import('jspdf');
            const pdfWidth = canvas.width;
            const pdfHeight = canvas.height;
            const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [pdfWidth / 2, pdfHeight / 2]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth / 2, pdfHeight / 2);
            const dashName = selectedDashboard?.name || 'dashboard';
            pdf.save(`${dashName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            success('PDF exported', `${dashName} saved as PDF.`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showError('Export failed', 'Could not generate PDF. Make sure html2canvas and jspdf are installed.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleSourceClick = (widget: SavedWidget) => {
        const entityId = widget.dataConfig?.entityId;
        if (entityId && onViewChange) {
            navigate(`/database`);
        } else if (entityId) {
            navigate(`/database`);
        }
    };

    const handleWidgetTemplateSelect = (template: WidgetTemplate) => {
        setShowWidgetGallery(false);
        if (template.id === 'ai_generated') {
            // For AI generated, show the old modal
            setShowAddWidgetModal(true);
        } else {
            // For data-driven widgets, show configurator
            setEditingSavedWidget(null);
            setSelectedWidgetTemplate(template);
        }
    };

    const handleEditSavedWidget = (widget: SavedWidget) => {
        const widgetTypeToTemplate: Record<string, WidgetTemplate['id']> = {
            bar: 'bar_chart',
            line: 'line_chart',
            area: 'area_chart',
            pie: 'pie_chart',
            donut: 'pie_chart',
            radial: 'gauge',
            gauge: 'gauge',
            parallel: 'parallel',
            heatmap: 'heatmap',
            scatter_matrix: 'scatter_matrix',
            sankey: 'sankey',
            bubble: 'bubble',
            timeline: 'timeline',
            multi_timeline: 'multi_timeline'
        };
        const templateId = widgetTypeToTemplate[widget.type] || 'bar_chart';
        const template = WIDGET_TEMPLATES.find((item) => item.id === templateId);
        if (!template) {
            warning('This widget type is not editable yet from configurator');
            return;
        }
        setEditingSavedWidget(widget);
        setSelectedWidgetTemplate(template);
    };
    
    const handleSaveConfiguredWidget = async (config: WidgetFullConfig) => {
        if (!selectedDashboardId) return;
        
        try {
            const id = editingSavedWidget?.id || generateUUID();
            const template = selectedWidgetTemplate || WIDGET_TEMPLATES.find(t => t.id === config.type);
            const selectedEntity = entities.find(e => e.id === config.dataConfig?.entityId);
            const findColumnName = (columnId?: string, fallback?: string) => {
                if (!columnId) return fallback || '';
                const col = selectedEntity?.properties?.find(p => p.id === columnId);
                return col?.name || fallback || columnId;
            };
            
            // Find position for new widget (or keep current on edit)
            const maxY = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0;
            const currentLayoutItem = editingSavedWidget
                ? layout.find((item) => item.i === editingSavedWidget.id)
                : undefined;
            const gridX = currentLayoutItem?.x ?? 0;
            const gridY = currentLayoutItem?.y ?? maxY;
            const gridW = currentLayoutItem?.w ?? template?.defaultWidth ?? 6;
            const gridH = currentLayoutItem?.h ?? template?.defaultHeight ?? 4;

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

            const usedColumnIds = [
                config.dataConfig?.xAxisColumn,
                config.dataConfig?.yAxisColumn,
                config.dataConfig?.groupBy,
                config.dataConfig?.sizeColumn,
                config.dataConfig?.sourceColumn,
                config.dataConfig?.targetColumn,
                config.dataConfig?.dateColumn,
                config.dataConfig?.severityColumn,
                config.dataConfig?.labelColumn,
                config.dataConfig?.trackColumn
            ].filter(Boolean) as string[];
            const relatedEntityIds = Array.from(
                new Set(
                    [
                        config.dataConfig?.entityId,
                        ...(config.dataConfig?.relatedEntityIds || []),
                        ...usedColumnIds
                            .map((columnId) => selectedEntity?.properties?.find((p) => p.id === columnId))
                            .filter((property: any) => property?.type === 'relation' && property?.relatedEntityId)
                            .map((property: any) => property.relatedEntityId)
                    ].filter(Boolean)
                )
            ) as string[];
            const enrichedDataConfig = config.dataConfig
                ? {
                    ...config.dataConfig,
                    relatedEntityIds
                }
                : undefined;
            
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
                dataConfig: enrichedDataConfig as any
            };
            
            const endpoint = editingSavedWidget
                ? `${API_BASE}/widgets/${editingSavedWidget.id}`
                : `${API_BASE}/dashboards/${selectedDashboardId}/widgets`;
            const method = editingSavedWidget ? 'PUT' : 'POST';
            const payload = editingSavedWidget
                ? {
                    title: config.title,
                    description: config.description,
                    config: widgetConfig
                }
                : {
                    id,
                    title: config.title,
                    description: config.description,
                    config: widgetConfig,
                    gridX,
                    gridY,
                    gridWidth: gridW,
                    gridHeight: gridH
                };
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });
            
            if (res.ok) {
                await fetchWidgets(selectedDashboardId);
                success(editingSavedWidget ? 'Widget updated successfully' : 'Widget added successfully');
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            showError(editingSavedWidget ? 'Failed to update widget' : 'Failed to add widget');
        }
        
        setEditingSavedWidget(null);
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
                    await handleCreateProcessExampleDashboard('hdpe_transition_monitoring', true);
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

    // Threshold alert checker — runs whenever widgets change
    const thresholdAlertsFired = useRef(new Set<string>());
    useEffect(() => {
        if (savedWidgets.length === 0) return;
        const gaugeWidgets = savedWidgets.filter((w) => w.type === 'gauge');
        for (const widget of gaugeWidgets) {
            const dataRow = Array.isArray(widget.data) ? widget.data[0] : null;
            if (!dataRow) continue;
            const value = typeof dataRow.value === 'number' ? dataRow.value : parseFloat(dataRow.value);
            if (!Number.isFinite(value)) continue;
            const maxVal = typeof widget.max === 'number' ? widget.max : 100;
            const threshold = maxVal * 0.9;
            const alertKey = `${widget.id}_${value}`;
            if (thresholdAlertsFired.current.has(alertKey)) continue;
            if (value >= threshold || value <= maxVal * 0.1) {
                thresholdAlertsFired.current.add(alertKey);
                const severity = value >= threshold ? 'warning' : 'error';
                const msg = `${widget.title}: value ${value.toLocaleString()} ${value >= threshold ? 'exceeds' : 'below'} threshold (${threshold.toLocaleString()})`;
                fetch(`${API_BASE}/ot-alerts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        severity,
                        message: msg,
                        fieldName: widget.title,
                        value,
                        threshold: String(threshold),
                        metadata: { widgetId: widget.id, dashboardId: selectedDashboardId }
                    })
                }).catch(() => {});
                warning(`${widget.title}`, msg);
            }
        }
    }, [savedWidgets, selectedDashboardId]);

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

    const handleSaveDashboard = async () => {
        if (!selectedDashboardId || isSavingDashboard) return;
        setIsSavingDashboard(true);
        try {
            const dashboardName = (isEditingTitle ? editingTitle : (selectedDashboard?.name || '')).trim();
            const dashboardDescription = (isEditingDescription ? editingDescription : (selectedDashboard?.description || '')).trim();

            await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: dashboardName || selectedDashboard?.name || 'Dashboard',
                    description: dashboardDescription
                }),
                credentials: 'include'
            });

            for (const item of layout) {
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
            }

            setDashboards(prev => prev.map(d =>
                d.id === selectedDashboardId
                    ? { ...d, name: dashboardName || d.name, description: dashboardDescription }
                    : d
            ));
            setIsEditingTitle(false);
            setIsEditingDescription(false);
            success('Dashboard saved');
        } catch (error) {
            console.error('Error saving dashboard:', error);
            showError('Failed to save dashboard', 'Please try again');
        } finally {
            setIsSavingDashboard(false);
        }
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreateDashboard}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <Plus size={14} weight="light" className="mr-2" />
                                    Create Dashboard
                                </button>
                                <div className="relative" ref={examplesMenuRef}>
                                    <button
                                        onClick={() => setShowExamplesMenu((prev) => !prev)}
                                        disabled={isCreatingExample}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isCreatingExample ? 'Creating example...' : 'Examples'}
                                        <CaretDown size={12} weight="bold" />
                                    </button>
                                    {showExamplesMenu && (
                                        <div className="absolute right-0 top-10 z-20 w-80 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl p-2">
                                            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                                Example dashboards
                                            </div>
                                            {EXAMPLE_PRESETS.map((preset) => {
                                                const exists = dashboards.some((d) => d.name === preset.name);
                                                const isCreatingThis = creatingExamplePresetId === preset.id;
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => handleCreateProcessExampleDashboard(preset.id, true)}
                                                        disabled={isCreatingExample}
                                                        className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-60"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-medium text-[var(--text-primary)]">{preset.name.replace('Example - ', '')}</span>
                                                            <span className="text-[10px] text-[var(--text-tertiary)]">
                                                                {isCreatingThis ? 'Creating...' : exists ? 'Open existing' : 'Create'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                                            {preset.description}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
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
                        onSave={handleSaveDashboard}
                        isSaving={isSavingDashboard}
                        onExportPdf={handleExportPdf}
                        isExportingPdf={isExportingPdf}
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
                            <div id="dashboard-grid-area" className="relative min-h-[400px] w-full">
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
                                                    onEdit={handleEditSavedWidget}
                                                    onDrillDown={(w) => setDrillDownWidget(w)}
                                                    onSourceClick={handleSourceClick}
                                                    entities={entities}
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
                                    onCancel={() => {
                                        setSelectedWidgetTemplate(null);
                                        setEditingSavedWidget(null);
                                    }}
                                    initialConfig={editingSavedWidget || undefined}
                                    submitLabel={editingSavedWidget ? 'Save changes' : 'Add Widget'}
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
            
            {/* Drill-down Panel */}
            {drillDownWidget && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrillDownWidget(null)}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div
                        className="relative w-full max-w-xl bg-[var(--bg-card)] border-l border-[var(--border-light)] shadow-2xl flex flex-col animate-slide-in-right"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{drillDownWidget.title}</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                    {Array.isArray(drillDownWidget.data) ? drillDownWidget.data.length : 0} records
                                </p>
                            </div>
                            <button
                                onClick={() => setDrillDownWidget(null)}
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <X size={16} weight="light" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar p-4">
                            {Array.isArray(drillDownWidget.data) && drillDownWidget.data.length > 0 ? (
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                                        <tr className="border-b border-[var(--border-light)]">
                                            {Object.keys(drillDownWidget.data[0]).map((key) => (
                                                <th key={key} className="text-left py-2 px-2 text-[var(--text-tertiary)] font-medium whitespace-nowrap">
                                                    {key.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drillDownWidget.data.slice(0, 100).map((row: any, rowIdx: number) => (
                                            <tr key={rowIdx} className="border-b border-[var(--border-light)]/30 hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                                                {Object.values(row).map((cellValue: any, colIdx: number) => (
                                                    <td key={colIdx} className="py-1.5 px-2 text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                                                        {typeof cellValue === 'number'
                                                            ? cellValue.toLocaleString()
                                                            : cellValue === null || cellValue === undefined
                                                                ? '—'
                                                                : String(cellValue)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No underlying data available.</p>
                            )}
                            {Array.isArray(drillDownWidget.data) && drillDownWidget.data.length > 100 && (
                                <p className="text-[10px] text-[var(--text-tertiary)] text-center py-2">
                                    Showing first 100 of {drillDownWidget.data.length} records.
                                </p>
                            )}
                        </div>
                        {drillDownWidget.dataConfig?.entityId && (
                            <div className="px-5 py-3 border-t border-[var(--border-light)]">
                                <button
                                    onClick={() => {
                                        setDrillDownWidget(null);
                                        navigate('/database');
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                                >
                                    <ArrowSquareOut size={12} weight="light" />
                                    Open source entity in Database
                                </button>
                            </div>
                        )}
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

