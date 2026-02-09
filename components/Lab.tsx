/**
 * Lab - Workflow-Powered Interactive Dashboard
 * 
 * Cada experimento usa un workflow como motor de cálculo.
 * Los parámetros del workflow se convierten en controles interactivos.
 * Un chatbot ayuda a ajustar parámetros y entender resultados.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Plus, Trash, PencilSimple, FloppyDisk, Sparkle, CaretRight, 
    CaretDown, MagnifyingGlass, Play, Flask, ArrowLeft, 
    SpinnerGap, ChartLine, Table, Sliders, Robot, PaperPlaneTilt,
    Gear, Eye, Copy, Check, X, ArrowsClockwise, BookmarkSimple,
    CaretUp, ChartBar, ChartPie, Gauge, NumberSquareOne, FlowArrow,
    FolderOpen, Clock, DotsThree, Export, Share, Info,
    ArrowCounterClockwise, FileCsv, FileImage, Keyboard, DotsSixVertical,
    Lightning, Tag, Calendar
} from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import { generateUUID } from '../utils/uuid';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface Workflow {
    id: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
}

interface WorkflowNode {
    id: string;
    type: string;
    label: string;
    config?: Record<string, any>;
    data?: any;
}

interface ParameterConfig {
    id: string;
    nodeId: string;
    variableName: string;
    label: string;
    description?: string;
    controlType: 'slider' | 'number' | 'select' | 'toggle' | 'text' | 'date';
    config: {
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        prefix?: string;
        options?: { value: any; label: string }[];
        defaultValue: any;
    };
    group?: string;
    order?: number;
}

interface VisualizationConfig {
    id: string;
    type: 'kpi' | 'line' | 'bar' | 'area' | 'pie' | 'table' | 'gauge';
    title: string;
    dataMapping: {
        source: string;
        valueKey?: string;
        labelKey?: string;
        xAxis?: string;
        yAxis?: string[];
        format?: 'number' | 'currency' | 'percent';
    };
    position: { x: number; y: number; w: number; h: number };
    color?: string;
}

interface SavedScenario {
    id: string;
    name: string;
    description?: string;
    parameterValues: Record<string, any>;
    createdAt: string;
}

interface SimulationRun {
    id: string;
    parameterValues: Record<string, any>;
    result: any;
    executedAt: string;
    duration: number;
}

interface Simulation {
    id: string;
    name: string;
    description?: string;
    workflowId: string;
    workflowName?: string;
    parameters: ParameterConfig[];
    visualizations: VisualizationConfig[];
    savedScenarios: SavedScenario[];
    runs: SimulationRun[];
    createdAt: string;
    updatedAt: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    action?: {
        type: 'set_parameter' | 'run_simulation' | 'compare_scenarios';
        data: any;
    };
}

interface LabProps {
    entities?: any[];
    onNavigate?: (entityId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CHART_COLORS = ['#256A65', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#EC4899'];

const VISUALIZATION_TYPES = [
    { type: 'kpi', label: 'KPI', icon: NumberSquareOne, description: 'Single value metric' },
    { type: 'line', label: 'Line Chart', icon: ChartLine, description: 'Trends over time' },
    { type: 'bar', label: 'Bar Chart', icon: ChartBar, description: 'Compare categories' },
    { type: 'area', label: 'Area Chart', icon: ChartLine, description: 'Cumulative trends' },
    { type: 'pie', label: 'Pie Chart', icon: ChartPie, description: 'Part of whole' },
    { type: 'table', label: 'Table', icon: Table, description: 'Detailed data' },
];

const CONTROL_TYPES = [
    { type: 'slider', label: 'Slider' },
    { type: 'number', label: 'Number' },
    { type: 'select', label: 'Dropdown' },
    { type: 'toggle', label: 'Toggle' },
    { type: 'text', label: 'Text' },
];

const FORMAT_OPTIONS = [
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency ($)' },
    { value: 'percent', label: 'Percentage (%)' },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

// Parameter Control Component
const ParameterControl: React.FC<{
    param: ParameterConfig;
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
}> = ({ param, value, onChange, disabled }) => {
    const { controlType, config, label, description } = param;
    
    const formatValue = (val: number) => {
        if (config.prefix) return `${config.prefix}${val.toLocaleString()}`;
        if (config.unit) return `${val.toLocaleString()}${config.unit}`;
        return val.toLocaleString();
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                    {label}
                </label>
                {controlType === 'slider' && (
                    <span className="text-sm font-mono text-[var(--accent-primary)]">
                        {formatValue(value)}
                    </span>
                )}
            </div>
            
            {description && (
                <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
            )}
            
            {controlType === 'slider' && (
                <div className="space-y-1">
                    <input
                        type="range"
                        min={config.min ?? 0}
                        max={config.max ?? 100}
                        step={config.step ?? 1}
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        disabled={disabled}
                        className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)] disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                        <span>{formatValue(config.min ?? 0)}</span>
                        <span>{formatValue(config.max ?? 100)}</span>
                    </div>
                </div>
            )}
            
            {controlType === 'number' && (
                <div className="relative">
                    {config.prefix && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                            {config.prefix}
                        </span>
                    )}
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        disabled={disabled}
                        className={`w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-50 ${config.prefix ? 'pl-8' : ''}`}
                    />
                    {config.unit && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                            {config.unit}
                        </span>
                    )}
                </div>
            )}
            
            {controlType === 'select' && (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-50"
                >
                    {config.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            )}
            
            {controlType === 'toggle' && (
                <button
                    onClick={() => onChange(!value)}
                    disabled={disabled}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                        value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
                    } disabled:opacity-50`}
                >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        value ? 'left-7' : 'left-1'
                    }`} />
                </button>
            )}
            
            {controlType === 'text' && (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-50"
                />
            )}
        </div>
    );
};

// KPI Card Component
const KPICard: React.FC<{
    title: string;
    value: any;
    format?: 'number' | 'currency' | 'percent';
    change?: number;
    color?: string;
    isLoading?: boolean;
}> = ({ title, value, format = 'number', change, color, isLoading }) => {
    const [displayValue, setDisplayValue] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const prevValueRef = useRef<number | null>(null);

    const formatValue = (val: any) => {
        if (val === null || val === undefined) return '—';
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return val;
        
        switch (format) {
            case 'currency':
                return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            case 'percent':
                return `${num.toFixed(1)}%`;
            default:
                return num.toLocaleString();
        }
    };

    // Animate value changes
    useEffect(() => {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(numValue) || value === null || value === undefined) {
            setDisplayValue(null);
            return;
        }

        const prevValue = prevValueRef.current;
        prevValueRef.current = numValue;

        if (prevValue === null || prevValue === numValue) {
            setDisplayValue(numValue);
            return;
        }

        // Animate from prev to new value
        setIsAnimating(true);
        const duration = 600;
        const steps = 30;
        const stepDuration = duration / steps;
        const increment = (numValue - prevValue) / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            if (currentStep >= steps) {
                setDisplayValue(numValue);
                setIsAnimating(false);
                clearInterval(interval);
            } else {
                setDisplayValue(prevValue + increment * currentStep);
            }
        }, stepDuration);

        return () => clearInterval(interval);
    }, [value]);

    // Skeleton loading
    if (isLoading) {
        return (
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 animate-pulse">
                <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded mb-3" />
                <div className="h-7 w-20 bg-[var(--bg-tertiary)] rounded" />
            </div>
        );
    }

    return (
        <div className={`bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 transition-all duration-200 hover:border-[var(--border-medium)] ${isAnimating ? 'border-[var(--accent-primary)]/30' : ''}`}>
            <p className="text-xs text-[var(--text-secondary)] mb-2">{title}</p>
            <p 
                className={`text-2xl font-normal transition-colors duration-300 tabular-nums`}
                style={{ 
                    fontFamily: "'Berkeley Mono', monospace",
                    color: isAnimating ? 'var(--accent-primary)' : (color || 'var(--text-primary)')
                }}
            >
                {displayValue !== null ? formatValue(displayValue) : formatValue(value)}
            </p>
            {change !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {change >= 0 ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                    <span>{change >= 0 ? '+' : ''}{Math.abs(change).toFixed(1)}%</span>
                </div>
            )}
        </div>
    );
};

// Visualization Component
const VisualizationCard: React.FC<{
    config: VisualizationConfig;
    data: any;
    dateRange?: { start: string; end: string };
}> = ({ config, data, dateRange }) => {
    const { type, title, dataMapping, color } = config;
    
    // Extract and filter data based on mapping and date range
    const chartData = useMemo(() => {
        if (!data) return [];
        
        // Navigate to the data source
        const source = dataMapping.source.split('.').reduce((obj, key) => obj?.[key], data);
        let result = [];
        if (Array.isArray(source)) result = source;
        else if (typeof source === 'object') result = [source];
        else return [];
        
        // Filter by date range if applicable
        if (dateRange && result.length > 0) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999); // Include end date fully
            
            // Try to find a date field in the data
            const dateFields = ['date', 'fecha', 'timestamp', 'time', 'created_at', 'createdAt', 'month', 'day'];
            const dateField = dateFields.find(field => result[0]?.[field] !== undefined);
            
            if (dateField) {
                result = result.filter(item => {
                    const itemDate = new Date(item[dateField]);
                    return itemDate >= startDate && itemDate <= endDate;
                });
            }
        }
        
        return result;
    }, [data, dataMapping.source, dateRange]);

    const getValue = () => {
        if (!data) return null;
        if (dataMapping.valueKey) {
            return dataMapping.source.split('.').reduce((obj, key) => obj?.[key], data)?.[dataMapping.valueKey];
        }
        return dataMapping.source.split('.').reduce((obj, key) => obj?.[key], data);
    };

    if (type === 'kpi') {
        return (
            <KPICard
                title={title}
                value={getValue()}
                format={dataMapping.format}
                color={color}
            />
        );
    }

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4 h-full">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-3">{title}</p>
            
            {type === 'line' && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200} minWidth={100} minHeight={100}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey={dataMapping.xAxis} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-card)', 
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }} 
                        />
                        {dataMapping.yAxis?.map((key, i) => (
                            <Line 
                                key={key} 
                                type="monotone" 
                                dataKey={key} 
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}
            
            {type === 'bar' && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200} minWidth={100} minHeight={100}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey={dataMapping.xAxis} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-card)', 
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }} 
                        />
                        {dataMapping.yAxis?.map((key, i) => (
                            <Bar 
                                key={key} 
                                dataKey={key} 
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )}
            
            {type === 'area' && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200} minWidth={100} minHeight={100}>
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey={dataMapping.xAxis} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-card)', 
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }} 
                        />
                        {dataMapping.yAxis?.map((key, i) => (
                            <Area 
                                key={key} 
                                type="monotone" 
                                dataKey={key} 
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                fillOpacity={0.3}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            )}
            
            {type === 'pie' && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200} minWidth={100} minHeight={100}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey={dataMapping.valueKey || 'value'}
                            nameKey={dataMapping.labelKey || 'name'}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                        >
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-card)', 
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }} 
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
            
            {type === 'table' && (
                <div className="overflow-auto max-h-[200px] custom-scrollbar">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[var(--border-light)]">
                                {chartData[0] && Object.keys(chartData[0]).map(key => (
                                    <th key={key} className="text-left py-2 px-2 text-[var(--text-tertiary)] font-medium">
                                        {key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.slice(0, 10).map((row, i) => (
                                <tr key={i} className="border-b border-[var(--border-light)]/50">
                                    {Object.values(row).map((val: any, j) => (
                                        <td key={j} className="py-2 px-2 text-[var(--text-primary)]">
                                            {typeof val === 'number' ? val.toLocaleString() : val}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {chartData.length === 0 && (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                    No data available
                </div>
            )}
        </div>
    );
};

// Chat Message Component
const ChatMessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                isUser 
                    ? 'bg-[var(--accent-primary)] text-white rounded-br-sm' 
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm'
            }`}>
                {message.content}
                {message.action && (
                    <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
                        {message.action.type === 'set_parameter' && '✓ Parameter adjusted'}
                        {message.action.type === 'run_simulation' && '▶ Experiment executed'}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Lab: React.FC<LabProps> = ({ entities, onNavigate }) => {
    const { simulationId } = useParams();
    const navigate = useNavigate();
    
    // State
    const [simulations, setSimulations] = useState<Simulation[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Parameter values (current state)
    const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
    
    // Execution state
    const [isRunning, setIsRunning] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);
    const [runHistory, setRunHistory] = useState<SimulationRun[]>([]);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<'parameters' | 'scenarios' | 'history'>('parameters');
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [showAddVisualization, setShowAddVisualization] = useState(false);
    const [vizMenuOpen, setVizMenuOpen] = useState<string | null>(null); // Track which viz menu is open
    const [showExportModal, setShowExportModal] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    
    // Drag & Drop state
    const [draggedVizId, setDraggedVizId] = useState<string | null>(null);
    const [dragOverVizId, setDragOverVizId] = useState<string | null>(null);
    
    // Undo state
    const [undoStack, setUndoStack] = useState<{ type: string; data: any }[]>([]);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const [lastUndoAction, setLastUndoAction] = useState<string>('');
    
    // Quick bookmark
    const [quickBookmarkName, setQuickBookmarkName] = useState('');
    const [showQuickBookmark, setShowQuickBookmark] = useState(false);
    const [bookmarkSaved, setBookmarkSaved] = useState(false);
    
    // Date range state
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePreset, setDatePreset] = useState<string>('7d');
    
    const [newVisualization, setNewVisualization] = useState({
        type: 'kpi' as VisualizationConfig['type'],
        title: '',
        source: '',
        format: 'number' as 'number' | 'currency' | 'percent',
        xAxis: '',
        yAxis: ''
    });
    
    // Config panel state
    const [configTab, setConfigTab] = useState<'general' | 'parameters'>('general');
    const [editingParam, setEditingParam] = useState<ParameterConfig | null>(null);
    const [showAddParam, setShowAddParam] = useState(false);
    const [newParam, setNewParam] = useState({
        label: '',
        variableName: '',
        controlType: 'slider' as ParameterConfig['controlType'],
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        unit: '',
        prefix: '',
        group: ''
    });
    
    // Create modal state
    const [newSimulation, setNewSimulation] = useState({
        name: '',
        description: '',
        workflowId: ''
    });

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    useEffect(() => {
        fetchSimulations();
        fetchWorkflows();
    }, []);

    useEffect(() => {
        if (simulationId && simulations.length > 0) {
            const sim = simulations.find(s => s.id === simulationId);
            if (sim) {
                setSelectedSimulation(sim);
                initializeParameters(sim);
            }
        }
    }, [simulationId, simulations]);

    const fetchSimulations = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/simulations`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                // Always include demo experiment + user's simulations
                const hasDemo = data.some((s: Simulation) => s.id === 'demo-experiment');
                if (hasDemo) {
                    setSimulations(data);
                } else {
                    setSimulations([demoExperiment, ...data]);
                }
            } else {
                // If API fails, show demo anyway
                setSimulations([demoExperiment]);
            }
        } catch (error) {
            console.error('Error fetching simulations:', error);
            // Show demo on error
            setSimulations([demoExperiment]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWorkflows = async () => {
        try {
            const res = await fetch(`${API_BASE}/workflows`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setWorkflows(data);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
        }
    };

    // Demo experiment data
    const demoExperiment: Simulation = {
        id: 'demo-experiment',
        name: 'Revenue Calculator',
        description: 'Calculate projected revenue based on pricing and volume',
        workflowId: 'demo-workflow',
        workflowName: 'Revenue Projection',
            parameters: [
                {
                    id: 'param-price',
                    nodeId: 'node-1',
                    variableName: 'unit_price',
                    label: 'Unit Price',
                    description: 'Price per unit sold',
                    controlType: 'slider',
                    config: {
                        min: 10,
                        max: 500,
                        step: 5,
                        prefix: '$',
                        defaultValue: 99
                    },
                    group: 'Pricing',
                    order: 0
                },
                {
                    id: 'param-volume',
                    nodeId: 'node-2',
                    variableName: 'monthly_volume',
                    label: 'Monthly Volume',
                    description: 'Units sold per month',
                    controlType: 'slider',
                    config: {
                        min: 100,
                        max: 10000,
                        step: 100,
                        defaultValue: 1000
                    },
                    group: 'Volume',
                    order: 1
                },
                {
                    id: 'param-growth',
                    nodeId: 'node-3',
                    variableName: 'growth_rate',
                    label: 'Growth Rate',
                    description: 'Monthly growth percentage',
                    controlType: 'slider',
                    config: {
                        min: 0,
                        max: 50,
                        step: 1,
                        unit: '%',
                        defaultValue: 10
                    },
                    group: 'Growth',
                    order: 2
                },
                {
                    id: 'param-cost',
                    nodeId: 'node-4',
                    variableName: 'cost_ratio',
                    label: 'Cost Ratio',
                    description: 'Cost as percentage of revenue',
                    controlType: 'slider',
                    config: {
                        min: 10,
                        max: 80,
                        step: 5,
                        unit: '%',
                        defaultValue: 35
                    },
                    group: 'Costs',
                    order: 3
                }
            ],
            visualizations: [
                {
                    id: 'viz-revenue',
                    type: 'kpi',
                    title: 'Monthly Revenue',
                    dataMapping: { source: 'revenue', format: 'currency' },
                    position: { x: 0, y: 0, w: 1, h: 1 },
                    color: '#256A65'
                },
                {
                    id: 'viz-profit',
                    type: 'kpi',
                    title: 'Monthly Profit',
                    dataMapping: { source: 'profit', format: 'currency' },
                    position: { x: 1, y: 0, w: 1, h: 1 },
                    color: '#10B981'
                },
                {
                    id: 'viz-margin',
                    type: 'kpi',
                    title: 'Profit Margin',
                    dataMapping: { source: 'margin', format: 'percent' },
                    position: { x: 2, y: 0, w: 1, h: 1 },
                    color: '#3B82F6'
                },
                {
                    id: 'viz-annual',
                    type: 'kpi',
                    title: 'Annual Revenue',
                    dataMapping: { source: 'annualRevenue', format: 'currency' },
                    position: { x: 3, y: 0, w: 1, h: 1 },
                    color: '#8B5CF6'
                },
                {
                    id: 'viz-projection',
                    type: 'line',
                    title: '12-Month Revenue Projection',
                    dataMapping: { 
                        source: 'monthlyProjection',
                        xAxis: 'month',
                        yAxis: ['revenue', 'profit']
                    },
                    position: { x: 0, y: 1, w: 2, h: 1 }
                },
                {
                    id: 'viz-breakdown',
                    type: 'bar',
                    title: 'Cost Breakdown',
                    dataMapping: { 
                        source: 'costBreakdown',
                        xAxis: 'category',
                        yAxis: ['amount']
                    },
                    position: { x: 2, y: 1, w: 2, h: 1 }
                }
            ],
            savedScenarios: [
                {
                    id: 'scenario-1',
                    name: 'Conservative',
                    parameterValues: {
                        'param-price': 79,
                        'param-volume': 500,
                        'param-growth': 5,
                        'param-cost': 40
                    },
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'scenario-2',
                    name: 'Aggressive Growth',
                    parameterValues: {
                        'param-price': 149,
                        'param-volume': 2000,
                        'param-growth': 25,
                        'param-cost': 30
                    },
                    createdAt: new Date().toISOString()
                }
            ],
            runs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
    };

    // Run demo simulation (mock calculation)
    const runDemoSimulation = () => {
        if (!selectedSimulation || selectedSimulation.id !== 'demo-experiment') return null;
        
        const price = parameterValues['param-price'] || 99;
        const volume = parameterValues['param-volume'] || 1000;
        const growth = parameterValues['param-growth'] || 10;
        const costRatio = parameterValues['param-cost'] || 35;

        const revenue = price * volume;
        const costs = revenue * (costRatio / 100);
        const profit = revenue - costs;
        const margin = (profit / revenue) * 100;
        const annualRevenue = revenue * 12;

        // Generate 12-month projection
        const monthlyProjection = [];
        let projectedVolume = volume;
        for (let i = 1; i <= 12; i++) {
            const monthRevenue = price * projectedVolume;
            const monthProfit = monthRevenue * (1 - costRatio / 100);
            monthlyProjection.push({
                month: `M${i}`,
                revenue: Math.round(monthRevenue),
                profit: Math.round(monthProfit)
            });
            projectedVolume = Math.round(projectedVolume * (1 + growth / 100));
        }

        // Cost breakdown
        const costBreakdown = [
            { category: 'COGS', amount: Math.round(costs * 0.5) },
            { category: 'Marketing', amount: Math.round(costs * 0.25) },
            { category: 'Operations', amount: Math.round(costs * 0.15) },
            { category: 'Other', amount: Math.round(costs * 0.1) }
        ];

        return {
            revenue: Math.round(revenue),
            profit: Math.round(profit),
            margin: Math.round(margin * 10) / 10,
            annualRevenue: Math.round(annualRevenue),
            monthlyProjection,
            costBreakdown
        };
    };

    const initializeParameters = (sim: Simulation) => {
        const values: Record<string, any> = {};
        sim.parameters.forEach(param => {
            values[param.id] = param.config.defaultValue;
        });
        setParameterValues(values);
        
        // Initialize chat with welcome message
        setChatMessages([{
            id: generateUUID(),
            role: 'assistant',
                            content: `Hi! I'm your assistant for "${sim.name}". I can help you:\n\n• Adjust parameters ("increase revenue to 200k")\n• Run experiments ("run with these values")\n• Analyze results ("what's the best scenario?")\n\nHow can I help you?`,
            timestamp: new Date().toISOString()
        }]);
    };

    // ========================================================================
    // SIMULATION EXECUTION
    // ========================================================================

    const pollExecution = async (executionId: string, maxAttempts = 60): Promise<any> => {
        const POLL_INTERVAL = 2000; // 2 seconds
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            try {
                const pollRes = await fetch(`${API_BASE}/executions/${executionId}`, {
                    credentials: 'include'
                });
                if (pollRes.ok) {
                    const execData = await pollRes.json();
                    if (execData.status === 'completed') {
                        return execData.nodeResults || execData.finalOutput || execData;
                    }
                    if (execData.status === 'failed' || execData.status === 'cancelled') {
                        console.error('Workflow execution failed:', execData.error);
                        return null;
                    }
                    // Still running, continue polling
                }
            } catch (e) {
                console.error('Error polling execution:', e);
            }
        }
        console.error('Polling timed out for execution:', executionId);
        return null;
    };

    const runSimulation = async () => {
        if (!selectedSimulation) return;
        
        setIsRunning(true);
        const startTime = Date.now();
        
        try {
            let result;
            
            // Check if this is the demo experiment
            if (selectedSimulation.id === 'demo-experiment') {
                // Use mock calculation
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
                result = runDemoSimulation();
            } else {
                // Real workflow execution
                // Map parameter values using nodeId (backend expects node IDs, not variable names)
                const inputs: Record<string, any> = {};
                selectedSimulation.parameters.forEach(param => {
                    inputs[param.nodeId] = parameterValues[param.id];
                });

                const res = await fetch(`${API_BASE}/workflow/${selectedSimulation.workflowId}/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ inputs, usePrefect: false })
                });

                if (res.ok) {
                    const data = await res.json();

                    if (data.backgroundExecution && data.executionId) {
                        // Background execution (Prefect) - poll until complete
                        result = await pollExecution(data.executionId);
                    } else {
                        // Synchronous execution - extract results
                        result = data.result || data;
                    }

                    // Flatten outputData from workflow nodes so visualizations can read properties directly
                    if (result && typeof result === 'object') {
                        const flatResult: Record<string, any> = {};
                        let hasOutputData = false;
                        Object.values(result).forEach((nodeResult: any) => {
                            if (nodeResult?.outputData) {
                                hasOutputData = true;
                                Object.assign(flatResult, nodeResult.outputData);
                            }
                        });
                        if (hasOutputData) {
                            result = flatResult;
                        }
                    }
                } else {
                    console.error('Workflow execution failed:', res.status, await res.text());
                }
            }
            
            if (result) {
                setLastResult(result);
                
                // Add to run history
                const run: SimulationRun = {
                    id: generateUUID(),
                    parameterValues: { ...parameterValues },
                    result,
                    executedAt: new Date().toISOString(),
                    duration: Date.now() - startTime
                };
                setRunHistory(prev => [run, ...prev].slice(0, 50));
            }
        } catch (error) {
            console.error('Error running simulation:', error);
        } finally {
            setIsRunning(false);
        }
    };

    // ========================================================================
    // CHAT FUNCTIONALITY
    // ========================================================================

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || !selectedSimulation) return;
        
        const userMessage: ChatMessage = {
            id: generateUUID(),
            role: 'user',
            content: chatInput.trim(),
            timestamp: new Date().toISOString()
        };
        
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsChatLoading(true);

        try {
            // Build context for the AI
            const context = {
                simulationName: selectedSimulation.name,
                parameters: selectedSimulation.parameters.map(p => ({
                    name: p.label,
                    variable: p.variableName,
                    currentValue: parameterValues[p.id],
                    min: p.config.min,
                    max: p.config.max,
                    unit: p.config.unit
                })),
                lastResult,
                userQuery: chatInput.trim()
            };

            const res = await fetch(`${API_BASE}/simulations/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(context)
            });

            if (res.ok) {
                const data = await res.json();
                
                const assistantMessage: ChatMessage = {
                    id: generateUUID(),
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date().toISOString(),
                    action: data.action
                };
                
                setChatMessages(prev => [...prev, assistantMessage]);
                
                // Execute action if present
                if (data.action) {
                    if (data.action.type === 'set_parameter') {
                        const param = selectedSimulation.parameters.find(
                            p => p.variableName === data.action.data.variable
                        );
                        if (param) {
                            setParameterValues(prev => ({
                                ...prev,
                                [param.id]: data.action.data.value
                            }));
                        }
                    } else if (data.action.type === 'run_simulation') {
                        await runSimulation();
                    }
                }
            }
        } catch (error) {
            console.error('Error in chat:', error);
            setChatMessages(prev => [...prev, {
                id: generateUUID(),
                role: 'assistant',
                content: 'Sorry, there was an error processing your message. Please try again.',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ========================================================================
    // CRUD OPERATIONS
    // ========================================================================

    const [isCreating, setIsCreating] = useState(false);

    const createSimulation = async () => {
        if (!newSimulation.name || !newSimulation.workflowId) return;
        
        const workflow = workflows.find(w => w.id === newSimulation.workflowId);
        if (!workflow) return;

        setIsCreating(true);

        try {
            // Fetch full workflow data to get nodes
            let workflowNodes: WorkflowNode[] = [];
            try {
                const wfRes = await fetch(`${API_BASE}/workflows/${newSimulation.workflowId}`, {
                    credentials: 'include'
                });
                if (wfRes.ok) {
                    const wfData = await wfRes.json();
                    // Parse nodes from workflow data
                    if (wfData.data) {
                        const parsed = typeof wfData.data === 'string' ? JSON.parse(wfData.data) : wfData.data;
                        workflowNodes = parsed.nodes || [];
                    }
                }
            } catch (e) {
                console.error('Error fetching workflow details:', e);
            }

            // Extract parameters from workflow nodes (Manual Input nodes)
            const parameters: ParameterConfig[] = [];
            const manualInputNodes = workflowNodes.filter(n => n.type === 'manualInput');
            
            manualInputNodes.forEach((node, index) => {
                parameters.push({
                    id: generateUUID(),
                    nodeId: node.id,
                    variableName: node.config?.variableName || node.label || `param_${index}`,
                    label: node.label || node.config?.variableName || `Parámetro ${index + 1}`,
                    description: '',
                    controlType: 'slider',
                    config: {
                        min: 0,
                        max: 1000000,
                        step: 1,
                        defaultValue: node.config?.value || 0
                    },
                    order: index
                });
            });

            // If no manual input nodes, create a default parameter
            if (parameters.length === 0) {
                parameters.push({
                    id: generateUUID(),
                    nodeId: 'default',
                    variableName: 'input_value',
                    label: 'Input Value',
                    description: 'Default input parameter for the experiment',
                    controlType: 'slider',
                    config: {
                        min: 0,
                        max: 100000,
                        step: 100,
                        defaultValue: 10000
                    },
                    order: 0
                });
            }

            // Default visualizations
            const visualizations: VisualizationConfig[] = [
                {
                    id: generateUUID(),
                    type: 'kpi',
                    title: 'Resultado',
                    dataMapping: { source: 'result', format: 'number' },
                    position: { x: 0, y: 0, w: 1, h: 1 }
                }
            ];

            const simulation: Simulation = {
                id: generateUUID(),
                name: newSimulation.name,
                description: newSimulation.description,
                workflowId: newSimulation.workflowId,
                workflowName: workflow.name,
                parameters,
                visualizations,
                savedScenarios: [],
                runs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/simulations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(simulation)
            });

            if (res.ok) {
                setSimulations(prev => [...prev, simulation]);
                setShowCreateModal(false);
                setNewSimulation({ name: '', description: '', workflowId: '' });
                navigate(`/lab/${simulation.id}`);
            } else {
                console.error('Error creating simulation:', await res.text());
            }
        } catch (error) {
            console.error('Error creating simulation:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const deleteSimulation = async (id: string) => {
        if (!confirm('Are you sure you want to delete this experiment?')) return;
        
        try {
            await fetch(`${API_BASE}/simulations/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            setSimulations(prev => prev.filter(s => s.id !== id));
            if (selectedSimulation?.id === id) {
                setSelectedSimulation(null);
                navigate('/lab');
            }
        } catch (error) {
            console.error('Error deleting simulation:', error);
        }
    };

    const saveScenario = async () => {
        if (!selectedSimulation) return;
        
        const name = prompt('Scenario name:');
        if (!name) return;

        const scenario: SavedScenario = {
            id: generateUUID(),
            name,
            parameterValues: { ...parameterValues },
            createdAt: new Date().toISOString()
        };

        const updatedSim = {
            ...selectedSimulation,
            savedScenarios: [...selectedSimulation.savedScenarios, scenario],
            updatedAt: new Date().toISOString()
        };

        try {
            await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedSim)
            });
            setSelectedSimulation(updatedSim);
            setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        } catch (error) {
            console.error('Error saving scenario:', error);
        }
    };

    const loadScenario = (scenario: SavedScenario) => {
        setParameterValues(scenario.parameterValues);
    };

    const addVisualization = async () => {
        if (!selectedSimulation || !newVisualization.title || !newVisualization.source) return;

        const viz: VisualizationConfig = {
            id: generateUUID(),
            type: newVisualization.type,
            title: newVisualization.title,
            dataMapping: {
                source: newVisualization.source,
                format: newVisualization.format,
                ...(newVisualization.type !== 'kpi' && {
                    xAxis: newVisualization.xAxis,
                    yAxis: newVisualization.yAxis.split(',').map(y => y.trim()).filter(Boolean)
                })
            },
            position: { x: 0, y: 0, w: 1, h: 1 },
            color: CHART_COLORS[selectedSimulation.visualizations.length % CHART_COLORS.length]
        };

        const updatedSim = {
            ...selectedSimulation,
            visualizations: [...selectedSimulation.visualizations, viz],
            updatedAt: new Date().toISOString()
        };

        // Update locally first for immediate feedback
        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        
        // Reset form and close modal
        setNewVisualization({
            type: 'kpi',
            title: '',
            source: '',
            format: 'number',
            xAxis: '',
            yAxis: ''
        });
        setShowAddVisualization(false);

        // Persist to backend (skip for demo)
        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error saving visualization:', error);
            }
        }
    };

    const removeVisualization = async (vizId: string) => {
        if (!selectedSimulation) return;

        // Save to undo stack
        const removedViz = selectedSimulation.visualizations.find(v => v.id === vizId);
        if (removedViz) {
            setUndoStack(prev => [...prev.slice(-9), { type: 'remove_viz', data: removedViz }]);
            setLastUndoAction('Widget deleted');
            setShowUndoToast(true);
            setTimeout(() => setShowUndoToast(false), 4000);
        }

        const updatedSim = {
            ...selectedSimulation,
            visualizations: selectedSimulation.visualizations.filter(v => v.id !== vizId),
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));

        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error removing visualization:', error);
            }
        }
    };

    const duplicateVisualization = async (vizId: string) => {
        if (!selectedSimulation) return;

        const vizToDuplicate = selectedSimulation.visualizations.find(v => v.id === vizId);
        if (!vizToDuplicate) return;

        const newViz: VisualizationConfig = {
            ...vizToDuplicate,
            id: generateUUID(),
            title: `${vizToDuplicate.title} (copy)`
        };

        const updatedSim = {
            ...selectedSimulation,
            visualizations: [...selectedSimulation.visualizations, newViz],
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));

        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error duplicating visualization:', error);
            }
        }
    };

    const [editingViz, setEditingViz] = useState<VisualizationConfig | null>(null);

    const updateVisualization = async (updatedViz: VisualizationConfig) => {
        if (!selectedSimulation) return;

        const updatedSim = {
            ...selectedSimulation,
            visualizations: selectedSimulation.visualizations.map(v => 
                v.id === updatedViz.id ? updatedViz : v
            ),
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        setEditingViz(null);

        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error updating visualization:', error);
            }
        }
    };

    // ========================================================================
    // UNDO FUNCTIONALITY
    // ========================================================================
    
    const handleUndo = useCallback(async () => {
        if (undoStack.length === 0 || !selectedSimulation) return;
        
        const lastAction = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        
        if (lastAction.type === 'remove_viz') {
            const restoredViz = lastAction.data;
            const updatedSim = {
                ...selectedSimulation,
                visualizations: [...selectedSimulation.visualizations, restoredViz],
                updatedAt: new Date().toISOString()
            };
            
            setSelectedSimulation(updatedSim);
            setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
            
            if (selectedSimulation.id !== 'demo-experiment') {
                try {
                    await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(updatedSim)
                    });
                } catch (error) {
                    console.error('Error restoring visualization:', error);
                }
            }
        }
        
        setShowUndoToast(false);
    }, [undoStack, selectedSimulation]);

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modKey = isMac ? e.metaKey : e.ctrlKey;
            
            // Cmd/Ctrl + R - Run experiment
            if (modKey && e.key === 'r' && selectedSimulation) {
                e.preventDefault();
                if (!isRunning) {
                    runSimulation();
                }
            }
            
            // Cmd/Ctrl + Z - Undo
            if (modKey && e.key === 'z' && undoStack.length > 0) {
                e.preventDefault();
                handleUndo();
            }
            
            // Cmd/Ctrl + S - Quick bookmark
            if (modKey && e.key === 's' && selectedSimulation) {
                e.preventDefault();
                setShowQuickBookmark(true);
            }
            
            // Cmd/Ctrl + E - Export
            if (modKey && e.key === 'e' && selectedSimulation && lastResult) {
                e.preventDefault();
                setShowExportModal(true);
            }
            
            // ? - Show keyboard shortcuts
            if (e.key === '?' && !modKey) {
                setShowKeyboardShortcuts(prev => !prev);
            }
            
            // Escape - Close modals
            if (e.key === 'Escape') {
                setShowExportModal(false);
                setShowQuickBookmark(false);
                setShowKeyboardShortcuts(false);
                setVizMenuOpen(null);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSimulation, isRunning, undoStack, lastResult, handleUndo]);

    // ========================================================================
    // DRAG & DROP
    // ========================================================================
    
    const handleDragStart = (vizId: string) => {
        setDraggedVizId(vizId);
    };
    
    const handleDragOver = (e: React.DragEvent, vizId: string) => {
        e.preventDefault();
        if (vizId !== draggedVizId) {
            setDragOverVizId(vizId);
        }
    };
    
    const handleDragEnd = async () => {
        if (!draggedVizId || !dragOverVizId || !selectedSimulation) {
            setDraggedVizId(null);
            setDragOverVizId(null);
            return;
        }
        
        const vizs = [...selectedSimulation.visualizations];
        const draggedIndex = vizs.findIndex(v => v.id === draggedVizId);
        const targetIndex = vizs.findIndex(v => v.id === dragOverVizId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = vizs.splice(draggedIndex, 1);
            vizs.splice(targetIndex, 0, removed);
            
            const updatedSim = {
                ...selectedSimulation,
                visualizations: vizs,
                updatedAt: new Date().toISOString()
            };
            
            setSelectedSimulation(updatedSim);
            setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
            
            if (selectedSimulation.id !== 'demo-experiment') {
                try {
                    await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(updatedSim)
                    });
                } catch (error) {
                    console.error('Error reordering visualizations:', error);
                }
            }
        }
        
        setDraggedVizId(null);
        setDragOverVizId(null);
    };

    // ========================================================================
    // EXPORT FUNCTIONALITY
    // ========================================================================
    
    const exportAsCSV = () => {
        if (!lastResult) return;
        
        const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
            return Object.keys(obj).reduce((acc, key) => {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.assign(acc, flattenObject(value, newKey));
                } else if (Array.isArray(value)) {
                    acc[newKey] = JSON.stringify(value);
                } else {
                    acc[newKey] = value;
                }
                return acc;
            }, {} as Record<string, any>);
        };
        
        const flatData = flattenObject(lastResult);
        const headers = Object.keys(flatData);
        const values = Object.values(flatData);
        
        const csv = [headers.join(','), values.map(v => `"${v}"`).join(',')].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedSimulation?.name || 'experiment'}_results_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };
    
    const exportAsPNG = async () => {
        // Export the visualization area as PNG
        const vizArea = document.getElementById('visualization-area');
        if (!vizArea) return;
        
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(vizArea, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary'),
                scale: 2
            });
            
            const link = document.createElement('a');
            link.download = `${selectedSimulation?.name || 'experiment'}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error exporting as PNG:', error);
            // Fallback message
            alert('PNG export requires html2canvas. Install with: npm install html2canvas');
        }
        setShowExportModal(false);
    };
    
    const exportAsJSON = () => {
        if (!lastResult) return;
        
        const data = {
            experiment: selectedSimulation?.name,
            parameters: parameterValues,
            results: lastResult,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedSimulation?.name || 'experiment'}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };

    // ========================================================================
    // QUICK BOOKMARK
    // ========================================================================
    
    const saveQuickBookmark = async () => {
        if (!selectedSimulation || !quickBookmarkName.trim()) return;
        
        const newScenario: SavedScenario = {
            id: generateUUID(),
            name: quickBookmarkName.trim(),
            description: `Saved on ${new Date().toLocaleDateString()}`,
            parameterValues: { ...parameterValues },
            createdAt: new Date().toISOString()
        };
        
        const updatedSim = {
            ...selectedSimulation,
            savedScenarios: [...selectedSimulation.savedScenarios, newScenario],
            updatedAt: new Date().toISOString()
        };
        
        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        
        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error saving bookmark:', error);
            }
        }
        
        setQuickBookmarkName('');
        setShowQuickBookmark(false);
        setBookmarkSaved(true);
        setTimeout(() => setBookmarkSaved(false), 2000);
    };

    // Config panel functions
    const updateExperimentInfo = async (name: string, description: string) => {
        if (!selectedSimulation) return;

        const updatedSim = {
            ...selectedSimulation,
            name,
            description,
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));

        if (selectedSimulation.id !== 'demo-experiment') {
            try {
                await fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatedSim)
                });
            } catch (error) {
                console.error('Error updating experiment:', error);
            }
        }
    };

    const addParameter = () => {
        if (!selectedSimulation || !newParam.label || !newParam.variableName) return;

        const param: ParameterConfig = {
            id: generateUUID(),
            nodeId: 'custom',
            variableName: newParam.variableName,
            label: newParam.label,
            controlType: newParam.controlType,
            config: {
                min: newParam.min,
                max: newParam.max,
                step: newParam.step,
                defaultValue: newParam.defaultValue,
                unit: newParam.unit || undefined,
                prefix: newParam.prefix || undefined
            },
            group: newParam.group || undefined,
            order: selectedSimulation.parameters.length
        };

        const updatedSim = {
            ...selectedSimulation,
            parameters: [...selectedSimulation.parameters, param],
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        setParameterValues(prev => ({ ...prev, [param.id]: param.config.defaultValue }));
        
        // Reset form
        setNewParam({
            label: '',
            variableName: '',
            controlType: 'slider',
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 50,
            unit: '',
            prefix: '',
            group: ''
        });
        setShowAddParam(false);

        // Persist
        if (selectedSimulation.id !== 'demo-experiment') {
            fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedSim)
            }).catch(console.error);
        }
    };

    const updateParameter = (paramId: string, updates: Partial<ParameterConfig>) => {
        if (!selectedSimulation) return;

        const updatedSim = {
            ...selectedSimulation,
            parameters: selectedSimulation.parameters.map(p => 
                p.id === paramId ? { ...p, ...updates } : p
            ),
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        setEditingParam(null);

        if (selectedSimulation.id !== 'demo-experiment') {
            fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedSim)
            }).catch(console.error);
        }
    };

    const removeParameter = (paramId: string) => {
        if (!selectedSimulation) return;

        const updatedSim = {
            ...selectedSimulation,
            parameters: selectedSimulation.parameters.filter(p => p.id !== paramId),
            updatedAt: new Date().toISOString()
        };

        setSelectedSimulation(updatedSim);
        setSimulations(prev => prev.map(s => s.id === updatedSim.id ? updatedSim : s));
        
        // Remove from values
        const newValues = { ...parameterValues };
        delete newValues[paramId];
        setParameterValues(newValues);

        if (selectedSimulation.id !== 'demo-experiment') {
            fetch(`${API_BASE}/simulations/${selectedSimulation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedSim)
            }).catch(console.error);
        }
    };

    // Duplicate experiment
    const duplicateSimulation = async (sim: Simulation) => {
        const newSim: Simulation = {
            ...sim,
            id: generateUUID(),
            name: `${sim.name} (Copy)`,
            parameters: sim.parameters.map(p => ({ ...p, id: generateUUID() })),
            visualizations: sim.visualizations.map(v => ({ ...v, id: generateUUID() })),
            savedScenarios: [],
            runs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add locally
        setSimulations(prev => [...prev, newSim]);

        // Persist to backend
        try {
            await fetch(`${API_BASE}/simulations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newSim)
            });
        } catch (error) {
            console.error('Error duplicating simulation:', error);
        }

        // Navigate to the new experiment
        navigate(`/lab/${newSim.id}`);
    };

    // Load values from history run
    const loadFromHistory = (run: SimulationRun) => {
        // Map the run's parameter values back to current param IDs
        if (!selectedSimulation) return;
        
        const newValues: Record<string, any> = {};
        selectedSimulation.parameters.forEach(param => {
            if (run.parameterValues[param.id] !== undefined) {
                newValues[param.id] = run.parameterValues[param.id];
            } else {
                // Fallback to current value
                newValues[param.id] = parameterValues[param.id];
            }
        });
        
        setParameterValues(newValues);
        setLastResult(run.result);
    };

    // ========================================================================
    // FILTERED DATA
    // ========================================================================

    const filteredSimulations = useMemo(() => {
        if (!searchQuery) return simulations;
        const q = searchQuery.toLowerCase();
        return simulations.filter(s => 
            s.name.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
    }, [simulations, searchQuery]);

    // Group parameters by group
    const groupedParameters = useMemo(() => {
        if (!selectedSimulation) return {};
        
        const groups: Record<string, ParameterConfig[]> = { 'General': [] };
        selectedSimulation.parameters.forEach(param => {
            const group = param.group || 'General';
            if (!groups[group]) groups[group] = [];
            groups[group].push(param);
        });
        
        return groups;
    }, [selectedSimulation]);

    // ========================================================================
    // RENDER - SIMULATION LIST
    // ========================================================================

    if (!selectedSimulation) {
        return (
            <div className="flex flex-col h-full bg-[var(--bg-primary)]">
                <PageHeader 
                    title="Lab"
                    subtitle="Interactive experiments powered by workflows"
                    icon={Flask}
                    action={{
                        label: 'New Experiment',
                        icon: Plus,
                        onClick: () => setShowCreateModal(true)
                    }}
                />
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-6xl mx-auto">
                        {/* Search */}
                        <div className="relative mb-6">
                            <MagnifyingGlass 
                                size={18} 
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" 
                            />
                            <input
                                type="text"
                                placeholder="Search experiments..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                            />
                        </div>

                        {/* Simulations Grid */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <SpinnerGap size={32} className="animate-spin text-[var(--text-tertiary)]" />
                            </div>
                        ) : filteredSimulations.length === 0 ? (
                            <div className="text-center py-20">
                                <Flask size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                                    {searchQuery ? 'No results' : 'No experiments yet'}
                                </h3>
                                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                                    {searchQuery 
                                        ? 'Try different search terms'
                                        : 'Create your first experiment connected to a workflow'
                                    }
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus size={16} />
                                        New Experiment
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredSimulations.map(sim => (
                                    <div
                                        key={sim.id}
                                        onClick={() => navigate(`/lab/${sim.id}`)}
                                        className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-5 cursor-pointer hover:border-[var(--accent-primary)] transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                                    <Flask size={20} className="text-[var(--accent-primary)]" />
                                                </div>
                                                {sim.id === 'demo-experiment' && (
                                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full">
                                                        DEMO
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        duplicateSimulation(sim);
                                                    }}
                                                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                                                    title="Duplicate"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                {sim.id !== 'demo-experiment' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteSimulation(sim.id);
                                                        }}
                                                        className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-medium text-[var(--text-primary)] mb-1">
                                            {sim.name}
                                        </h3>
                                        {sim.description && (
                                            <p className="text-sm text-[var(--text-tertiary)] mb-3 line-clamp-2">
                                                {sim.description}
                                            </p>
                                        )}
                                        
                                        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                                            <span className="flex items-center gap-1">
                                                <FlowArrow size={12} />
                                                {sim.workflowName || 'Workflow'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Sliders size={12} />
                                                {sim.parameters.length} params
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Create New Experiment Card */}
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="bg-[var(--bg-card)] border-2 border-dashed border-[var(--border-light)] rounded-xl p-5 cursor-pointer hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-all flex flex-col items-center justify-center min-h-[160px] group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Plus size={24} className="text-[var(--accent-primary)]" />
                                    </div>
                                    <span className="font-medium text-[var(--text-primary)] mb-1">
                                        New Experiment
                                    </span>
                                    <span className="text-xs text-[var(--text-tertiary)]">
                                        Connect to a workflow
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--border-light)]">
                                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                    New Experiment
                                </h2>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newSimulation.name}
                                        onChange={(e) => setNewSimulation(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="My experiment..."
                                        className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={newSimulation.description}
                                        onChange={(e) => setNewSimulation(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe what this experiment calculates..."
                                        rows={3}
                                        className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                        Base Workflow
                                    </label>
                                    <select
                                        value={newSimulation.workflowId}
                                        onChange={(e) => setNewSimulation(prev => ({ ...prev, workflowId: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    >
                                        <option value="">Select a workflow...</option>
                                        {workflows.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                                        Workflow inputs will become interactive controls
                                    </p>
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createSimulation}
                                    disabled={!newSimulation.name || !newSimulation.workflowId || isCreating}
                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating && <SpinnerGap size={16} className="animate-spin" />}
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========================================================================
    // RENDER - SIMULATION DASHBOARD
    // ========================================================================

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setSelectedSimulation(null);
                            navigate('/lab');
                        }}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    
                    <div>
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                            {selectedSimulation.name}
                        </h1>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            Workflow: {selectedSimulation.workflowName}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Date Range Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors"
                        >
                            <Calendar size={14} className="text-[var(--text-tertiary)]" />
                            <span>
                                {new Date(dateRange.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {new Date(dateRange.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <CaretDown size={12} className="text-[var(--text-tertiary)]" />
                        </button>
                        
                        {showDatePicker && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl z-50 overflow-hidden">
                                    {/* Presets */}
                                    <div className="p-3 border-b border-[var(--border-light)]">
                                        <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">Quick Select</p>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {[
                                                { id: '7d', label: '7D', days: 7 },
                                                { id: '14d', label: '14D', days: 14 },
                                                { id: '30d', label: '30D', days: 30 },
                                                { id: '90d', label: '90D', days: 90 },
                                            ].map(preset => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => {
                                                        const end = new Date();
                                                        const start = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000);
                                                        setDateRange({
                                                            start: start.toISOString().split('T')[0],
                                                            end: end.toISOString().split('T')[0]
                                                        });
                                                        setDatePreset(preset.id);
                                                    }}
                                                    className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                        datePreset === preset.id
                                                            ? 'bg-[var(--accent-primary)] text-white'
                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-selected)]'
                                                    }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Custom Range */}
                                    <div className="p-3">
                                        <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">Custom Range</p>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="date"
                                                value={dateRange.start}
                                                onChange={(e) => {
                                                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                                                    setDatePreset('custom');
                                                }}
                                                className="flex-1 px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)]"
                                            />
                                            <span className="text-xs text-[var(--text-tertiary)]">→</span>
                                            <input
                                                type="date"
                                                value={dateRange.end}
                                                onChange={(e) => {
                                                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                                                    setDatePreset('custom');
                                                }}
                                                className="flex-1 px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)]"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Apply */}
                                    <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                        <button
                                            onClick={() => setShowDatePicker(false)}
                                            className="w-full px-3 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-primary-hover)] transition-colors"
                                        >
                                            Apply Range
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    
                    <div className="w-px h-6 bg-[var(--border-light)]" />
                    
                    {/* Quick Bookmark */}
                    <div className="relative">
                        <button
                            onClick={() => setShowQuickBookmark(!showQuickBookmark)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                bookmarkSaved 
                                    ? 'text-emerald-500 bg-emerald-500/10' 
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                            title="Quick save (⌘S)"
                        >
                            {bookmarkSaved ? <Check size={16} /> : <Tag size={16} />}
                            <span className="hidden sm:inline">{bookmarkSaved ? 'Saved!' : 'Bookmark'}</span>
                        </button>
                        
                        {showQuickBookmark && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowQuickBookmark(false)} />
                                <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl z-50 p-3">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-2">Quick save current parameters</p>
                                    <input
                                        type="text"
                                        value={quickBookmarkName}
                                        onChange={(e) => setQuickBookmarkName(e.target.value)}
                                        placeholder="Bookmark name..."
                                        className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm mb-2"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && saveQuickBookmark()}
                                    />
                                    <button
                                        onClick={saveQuickBookmark}
                                        disabled={!quickBookmarkName.trim()}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                    >
                                        <BookmarkSimple size={14} />
                                        Save
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Export Button */}
                    <button
                        onClick={() => setShowExportModal(true)}
                        disabled={!lastResult}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                        title="Export results (⌘E)"
                    >
                        <Export size={16} />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    
                    <div className="w-px h-6 bg-[var(--border-light)]" />
                    
                    <button
                        onClick={() => setShowConfigPanel(!showConfigPanel)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <Gear size={16} />
                        <span className="hidden sm:inline">Configure</span>
                    </button>
                    
                    <button
                        onClick={runSimulation}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        title="Run experiment (⌘R)"
                    >
                        {isRunning ? (
                            <SpinnerGap size={16} className="animate-spin" />
                        ) : (
                            <Play size={16} weight="fill" />
                        )}
                        {isRunning ? 'Running...' : 'Run'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Parameters & Chat */}
                <div className="w-80 border-r border-[var(--border-light)] flex flex-col bg-[var(--bg-card)]">
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--border-light)]">
                        {[
                            { id: 'parameters', label: 'Parameters', icon: Sliders },
                            { id: 'scenarios', label: 'Scenarios', icon: BookmarkSimple },
                            { id: 'history', label: 'History', icon: Clock }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {activeTab === 'parameters' && (
                            <div className="space-y-6">
                                {Object.entries(groupedParameters).map(([group, params]) => (
                                    <div key={group}>
                                        {Object.keys(groupedParameters).length > 1 && (
                                            <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                                                {group}
                                            </h3>
                                        )}
                                        <div className="space-y-4">
                                            {params.map(param => (
                                                <ParameterControl
                                                    key={param.id}
                                                    param={param}
                                                    value={parameterValues[param.id]}
                                                    onChange={(value) => setParameterValues(prev => ({
                                                        ...prev,
                                                        [param.id]: value
                                                    }))}
                                                    disabled={isRunning}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                
                                {selectedSimulation.parameters.length === 0 && (
                                    <div className="text-center py-8">
                                        <Sliders size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                                        <p className="text-sm text-[var(--text-tertiary)]">
                                            No parameters configured
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'scenarios' && (
                            <div className="space-y-2">
                                {selectedSimulation.savedScenarios.map(scenario => (
                                    <button
                                        key={scenario.id}
                                        onClick={() => loadScenario(scenario)}
                                        className="w-full p-3 text-left bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-lg transition-colors"
                                    >
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {scenario.name}
                                        </p>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                            {new Date(scenario.createdAt).toLocaleDateString()}
                                        </p>
                                    </button>
                                ))}
                                
                                {selectedSimulation.savedScenarios.length === 0 && (
                                    <div className="text-center py-8">
                                        <BookmarkSimple size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                                        <p className="text-sm text-[var(--text-tertiary)]">
                                            No saved scenarios
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'history' && (
                            <div className="space-y-3">
                                {/* Mini Sparkline Chart */}
                                {runHistory.length > 1 && (
                                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl mb-4">
                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                                            Result Trend
                                        </p>
                                        <ResponsiveContainer width="100%" height={60}>
                                            <AreaChart data={runHistory.slice(0, 20).reverse().map((run, idx) => ({
                                                idx,
                                                value: run.result?.revenue || run.result?.result || 0
                                            }))}>
                                                <defs>
                                                    <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="value" 
                                                    stroke="var(--accent-primary)" 
                                                    strokeWidth={2}
                                                    fill="url(#sparklineGradient)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Run List */}
                                {runHistory.map((run, idx) => {
                                    const mainResult = run.result?.revenue || run.result?.profit || run.result?.result;
                                    const prevRun = runHistory[idx + 1];
                                    const prevResult = prevRun?.result?.revenue || prevRun?.result?.profit || prevRun?.result?.result;
                                    const change = prevResult ? ((mainResult - prevResult) / prevResult * 100) : null;
                                    
                                    return (
                                        <button
                                            key={run.id}
                                            onClick={() => loadFromHistory(run)}
                                            className="w-full p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-xl transition-colors text-left group"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-xs text-[var(--text-tertiary)]">
                                                        {new Date(run.executedAt).toLocaleTimeString()}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-tertiary)] ml-2">
                                                        {run.duration}ms
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {change !== null && (
                                                        <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                                                            change >= 0 ? 'text-emerald-500' : 'text-red-500'
                                                        }`}>
                                                            {change >= 0 ? <CaretUp size={10} weight="fill" /> : <CaretDown size={10} weight="fill" />}
                                                            {Math.abs(change).toFixed(1)}%
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Load →
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Result preview */}
                                            {mainResult && (
                                                <p className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                                    ${typeof mainResult === 'number' ? mainResult.toLocaleString() : mainResult}
                                                </p>
                                            )}
                                            
                                            {/* Parameters summary */}
                                            <div className="flex flex-wrap gap-1">
                                                {selectedSimulation && selectedSimulation.parameters.slice(0, 3).map(param => (
                                                    <span key={param.id} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-[var(--text-tertiary)]">
                                                        {param.label}: {param.config.prefix}{run.parameterValues[param.id]}{param.config.unit}
                                                    </span>
                                                ))}
                                                {selectedSimulation && selectedSimulation.parameters.length > 3 && (
                                                    <span className="text-[10px] px-1.5 py-0.5 text-[var(--text-tertiary)]">
                                                        +{selectedSimulation.parameters.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                
                                {runHistory.length === 0 && (
                                    <div className="text-center py-8">
                                        <Clock size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                                        <p className="text-sm text-[var(--text-tertiary)] mb-1">
                                            No recent runs
                                        </p>
                                        <p className="text-xs text-[var(--text-tertiary)]">
                                            Run the experiment to see history
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Chat Section - Collapsible */}
                    <div className="border-t border-[var(--border-light)]">
                        <button
                            onClick={() => setIsChatExpanded(!isChatExpanded)}
                            className="w-full p-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                    <Robot size={14} className="text-[var(--accent-primary)]" />
                                </div>
                                <span className="text-sm font-medium text-[var(--text-primary)]">AI Assistant</span>
                            </div>
                            <div className={`transform transition-transform ${isChatExpanded ? 'rotate-180' : ''}`}>
                                <CaretDown size={16} className="text-[var(--text-tertiary)]" />
                            </div>
                        </button>
                        
                        {/* Collapsible Chat Content */}
                        <div className={`overflow-hidden transition-all duration-300 ${
                            isChatExpanded ? 'max-h-[400px]' : 'max-h-0'
                        }`}>
                            <div className="h-48 overflow-y-auto p-3 space-y-3 custom-scrollbar border-t border-[var(--border-light)]">
                                {chatMessages.map(msg => (
                                    <ChatMessageBubble key={msg.id} message={msg} />
                                ))}
                                {isChatLoading && (
                                    <div className="flex justify-start">
                                        <div className="px-3 py-2 bg-[var(--bg-tertiary)] rounded-xl rounded-bl-sm">
                                            <SpinnerGap size={16} className="animate-spin text-[var(--text-tertiary)]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            
                            <div className="p-3 border-t border-[var(--border-light)]">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                                        placeholder="Ask something..."
                                        className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    />
                                    <button
                                        onClick={handleChatSubmit}
                                        disabled={!chatInput.trim() || isChatLoading}
                                        className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <PaperPlaneTilt size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Visualizations */}
                <div id="visualization-area" className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Header with Add Button */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                            Visualizations
                        </h2>
                        <button
                            onClick={() => setShowAddVisualization(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition-colors"
                        >
                            <Plus size={14} />
                            Add Widget
                        </button>
                    </div>

                    {/* KPIs Row */}
                    {selectedSimulation.visualizations.filter(v => v.type === 'kpi').length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                            {selectedSimulation.visualizations
                                .filter(v => v.type === 'kpi')
                                .map(viz => (
                                    <div 
                                        key={viz.id} 
                                        className={`relative group transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                            draggedVizId === viz.id ? 'opacity-50 scale-95' : ''
                                        } ${dragOverVizId === viz.id ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2' : ''}`}
                                        draggable
                                        onDragStart={() => handleDragStart(viz.id)}
                                        onDragOver={(e) => handleDragOver(e, viz.id)}
                                        onDragEnd={handleDragEnd}
                                        onDragLeave={() => setDragOverVizId(null)}
                                    >
                                        <VisualizationCard config={viz} data={lastResult} dateRange={dateRange} />
                                        {/* Context Menu Button */}
                                        <div className="absolute top-2 right-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setVizMenuOpen(vizMenuOpen === viz.id ? null : viz.id);
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-primary)]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-all"
                                            >
                                                <DotsThree size={16} weight="bold" className="text-[var(--text-secondary)]" />
                                            </button>
                                            {vizMenuOpen === viz.id && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-40" 
                                                        onClick={() => setVizMenuOpen(null)}
                                                    />
                                                    <div className="absolute right-0 top-9 w-36 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl z-50 py-1">
                                                        <button
                                                            onClick={() => {
                                                                removeVisualization(viz.id);
                                                                setVizMenuOpen(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                        >
                                                            <Trash size={14} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                    
                    {/* Charts */}
                    {selectedSimulation.visualizations.filter(v => v.type !== 'kpi').length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {selectedSimulation.visualizations
                                .filter(v => v.type !== 'kpi')
                                .map(viz => (
                                    <div 
                                        key={viz.id} 
                                        className={`relative group transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                            draggedVizId === viz.id ? 'opacity-50 scale-95' : ''
                                        } ${dragOverVizId === viz.id ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2' : ''}`}
                                        draggable
                                        onDragStart={() => handleDragStart(viz.id)}
                                        onDragOver={(e) => handleDragOver(e, viz.id)}
                                        onDragEnd={handleDragEnd}
                                        onDragLeave={() => setDragOverVizId(null)}
                                    >
                                        <VisualizationCard config={viz} data={lastResult} dateRange={dateRange} />
                                        {/* Context Menu Button */}
                                        <div className="absolute top-3 right-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setVizMenuOpen(vizMenuOpen === viz.id ? null : viz.id);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-primary)]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-all"
                                            >
                                                <DotsThree size={18} weight="bold" className="text-[var(--text-secondary)]" />
                                            </button>
                                            {vizMenuOpen === viz.id && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-40" 
                                                        onClick={() => setVizMenuOpen(null)}
                                                    />
                                                    <div className="absolute right-0 top-10 w-40 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl z-50 py-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingViz(viz);
                                                                setVizMenuOpen(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                        >
                                                            <PencilSimple size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                duplicateVisualization(viz.id);
                                                                setVizMenuOpen(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                        >
                                                            <Copy size={14} />
                                                            Duplicate
                                                        </button>
                                                        <div className="border-t border-[var(--border-light)] my-1" />
                                                        <button
                                                            onClick={() => {
                                                                removeVisualization(viz.id);
                                                                setVizMenuOpen(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                        >
                                                            <Trash size={14} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                    
                    {/* Empty State */}
                    {selectedSimulation.visualizations.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                                <ChartLine size={24} className="text-[var(--text-tertiary)]" />
                            </div>
                            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                                No visualizations yet
                            </h3>
                            <p className="text-sm text-[var(--text-tertiary)] max-w-md mb-4">
                                Add charts, KPIs, and tables to visualize your experiment results.
                            </p>
                            <button
                                onClick={() => setShowAddVisualization(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                Add Visualization
                            </button>
                        </div>
                    )}

                    {/* Run prompt when no results */}
                    {!lastResult && selectedSimulation.visualizations.length > 0 && (
                        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center bg-[var(--bg-card)] border border-dashed border-[var(--border-light)] rounded-xl">
                            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center mb-3">
                                <Play size={20} className="text-[var(--accent-primary)]" />
                            </div>
                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">
                                Ready to run
                            </h3>
                            <p className="text-sm text-[var(--text-tertiary)] max-w-sm">
                                Click "Run" to execute the experiment and see your visualizations populate with data.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Visualization Modal */}
            {showAddVisualization && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                Add Visualization
                            </h2>
                            <button
                                onClick={() => setShowAddVisualization(false)}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            {/* Visualization Type */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
                                    Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {VISUALIZATION_TYPES.map(vt => {
                                        const Icon = vt.icon;
                                        const isSelected = newVisualization.type === vt.type;
                                        return (
                                            <button
                                                key={vt.type}
                                                onClick={() => setNewVisualization(prev => ({ ...prev, type: vt.type as any }))}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                                    isSelected
                                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                                        : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'
                                                }`}
                                            >
                                                <Icon size={20} className={isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'} />
                                                <span className={`text-xs font-medium ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                                    {vt.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={newVisualization.title}
                                    onChange={(e) => setNewVisualization(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g., Monthly Revenue"
                                    className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>

                            {/* Data Source */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Data Source
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newVisualization.source}
                                        onChange={(e) => setNewVisualization(prev => ({ ...prev, source: e.target.value }))}
                                        placeholder="Type or select from entities below..."
                                        className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#419CAF]"
                                    />
                                </div>
                                {/* Entity suggestions */}
                                {entities && entities.length > 0 && (
                                    <div className="mt-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {entities.slice(0, 6).map(entity => (
                                                <button
                                                    key={entity.id}
                                                    type="button"
                                                    onClick={() => setNewVisualization(prev => ({ 
                                                        ...prev, 
                                                        source: entity.name,
                                                        title: prev.title || entity.name
                                                    }))}
                                                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                                                        newVisualization.source === entity.name
                                                            ? 'bg-[#419CAF] text-white'
                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:border-[#419CAF]/50 hover:text-[#419CAF]'
                                                    }`}
                                                >
                                                    {entity.name}
                                                </button>
                                            ))}
                                            {entities.length > 6 && (
                                                <span className="px-2.5 py-1 text-xs text-[var(--text-tertiary)]">
                                                    +{entities.length - 6} more
                                                </span>
                                            )}
                                        </div>
                                        {/* Show entity properties if one is selected */}
                                        {newVisualization.source && entities.find(e => e.name === newVisualization.source)?.properties && (
                                            <div className="mt-3 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
                                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
                                                    Properties
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {entities.find(e => e.name === newVisualization.source)?.properties?.map((prop: any, idx: number) => (
                                                        <span 
                                                            key={idx}
                                                            className="px-2 py-0.5 text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded border border-[var(--border-light)]"
                                                        >
                                                            {prop.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Format (for KPI) */}
                            {newVisualization.type === 'kpi' && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                        Format
                                    </label>
                                    <div className="flex gap-1.5">
                                        {FORMAT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setNewVisualization(prev => ({ ...prev, format: opt.value as any }))}
                                                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                                                    newVisualization.format === opt.value
                                                        ? 'bg-[#419CAF] text-white'
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:border-[#419CAF]/50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Axis config (for charts) */}
                            {newVisualization.type !== 'kpi' && newVisualization.type !== 'table' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            X-Axis Key
                                        </label>
                                        <input
                                            type="text"
                                            value={newVisualization.xAxis}
                                            onChange={(e) => setNewVisualization(prev => ({ ...prev, xAxis: e.target.value }))}
                                            placeholder="e.g., month, category"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Y-Axis Keys
                                        </label>
                                        <input
                                            type="text"
                                            value={newVisualization.yAxis}
                                            onChange={(e) => setNewVisualization(prev => ({ ...prev, yAxis: e.target.value }))}
                                            placeholder="e.g., revenue, profit (comma separated)"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                        />
                                        <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
                                            Separate multiple keys with commas
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddVisualization(false)}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addVisualization}
                                disabled={!newVisualization.title || !newVisualization.source}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Configuration Panel */}
            {showConfigPanel && selectedSimulation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50">
                    <div 
                        className="h-full w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border-light)] shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                    Configure Experiment
                                </h2>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                    Edit settings and parameters
                                </p>
                            </div>
                            <button
                                onClick={() => setShowConfigPanel(false)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[var(--border-light)]">
                            {[
                                { id: 'general', label: 'General', icon: Info },
                                { id: 'parameters', label: 'Parameters', icon: Sliders }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setConfigTab(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                                        configTab === tab.id
                                            ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                    }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {configTab === 'general' && (
                                <div className="space-y-5">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue={selectedSimulation.name}
                                            onBlur={(e) => updateExperimentInfo(e.target.value, selectedSimulation.description || '')}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            defaultValue={selectedSimulation.description}
                                            onBlur={(e) => updateExperimentInfo(selectedSimulation.name, e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                                        />
                                    </div>

                                    {/* Workflow Info */}
                                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                                <FlowArrow size={18} className="text-[var(--accent-primary)]" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[var(--text-tertiary)]">Base Workflow</p>
                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                    {selectedSimulation.workflowName || 'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                                            <p className="text-lg font-semibold text-[var(--text-primary)]">
                                                {selectedSimulation.parameters.length}
                                            </p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Parameters</p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                                            <p className="text-lg font-semibold text-[var(--text-primary)]">
                                                {selectedSimulation.visualizations.length}
                                            </p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Widgets</p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                                            <p className="text-lg font-semibold text-[var(--text-primary)]">
                                                {selectedSimulation.savedScenarios.length}
                                            </p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Scenarios</p>
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="pt-4 border-t border-[var(--border-light)]">
                                        <h3 className="text-sm font-medium text-red-500 mb-3">Danger Zone</h3>
                                        <button
                                            onClick={() => {
                                                if (confirm('Are you sure? This cannot be undone.')) {
                                                    deleteSimulation(selectedSimulation.id);
                                                    setShowConfigPanel(false);
                                                }
                                            }}
                                            className="w-full px-4 py-2.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Delete Experiment
                                        </button>
                                    </div>
                                </div>
                            )}

                            {configTab === 'parameters' && (
                                <div className="space-y-4">
                                    {/* Add Parameter Button */}
                                    <button
                                        onClick={() => setShowAddParam(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--border-light)] hover:border-[var(--accent-primary)] rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                                    >
                                        <Plus size={16} />
                                        Add Parameter
                                    </button>

                                    {/* Parameter List */}
                                    {selectedSimulation.parameters.map((param, idx) => (
                                        <div 
                                            key={param.id}
                                            className="p-4 bg-[var(--bg-tertiary)] rounded-xl group"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-sm font-medium text-[var(--accent-primary)]">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                                            {param.label}
                                                        </p>
                                                        <p className="text-xs text-[var(--text-tertiary)] font-mono">
                                                            {param.variableName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingParam(param)}
                                                        className="p-1.5 hover:bg-[var(--bg-card)] rounded-lg transition-colors"
                                                    >
                                                        <PencilSimple size={14} className="text-[var(--text-tertiary)]" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeParameter(param.id)}
                                                        className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash size={14} className="text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                                                <span className="px-2 py-1 bg-[var(--bg-card)] rounded">
                                                    {param.controlType}
                                                </span>
                                                {param.config.min !== undefined && (
                                                    <span>
                                                        Range: {param.config.prefix}{param.config.min} - {param.config.prefix}{param.config.max}{param.config.unit}
                                                    </span>
                                                )}
                                                {param.group && (
                                                    <span className="px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded">
                                                        {param.group}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {selectedSimulation.parameters.length === 0 && !showAddParam && (
                                        <div className="text-center py-8">
                                            <Sliders size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                                            <p className="text-sm text-[var(--text-tertiary)]">
                                                No parameters yet
                                            </p>
                                        </div>
                                    )}

                                    {/* Add Parameter Form */}
                                    {showAddParam && (
                                        <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">New Parameter</h4>
                                                <button
                                                    onClick={() => setShowAddParam(false)}
                                                    className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                                                >
                                                    <X size={14} className="text-[var(--text-tertiary)]" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Label</label>
                                                    <input
                                                        type="text"
                                                        value={newParam.label}
                                                        onChange={(e) => setNewParam(p => ({ ...p, label: e.target.value }))}
                                                        placeholder="Unit Price"
                                                        className="w-full px-2.5 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Variable Name</label>
                                                    <input
                                                        type="text"
                                                        value={newParam.variableName}
                                                        onChange={(e) => setNewParam(p => ({ ...p, variableName: e.target.value }))}
                                                        placeholder="unit_price"
                                                        className="w-full px-2.5 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Control Type</label>
                                                <div className="flex gap-2">
                                                    {CONTROL_TYPES.map(ct => (
                                                        <button
                                                            key={ct.type}
                                                            onClick={() => setNewParam(p => ({ ...p, controlType: ct.type as any }))}
                                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                                newParam.controlType === ct.type
                                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                                            }`}
                                                        >
                                                            {ct.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {(newParam.controlType === 'slider' || newParam.controlType === 'number') && (
                                                <div className="grid grid-cols-4 gap-2">
                                                    <div>
                                                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Min</label>
                                                        <input
                                                            type="number"
                                                            value={newParam.min}
                                                            onChange={(e) => setNewParam(p => ({ ...p, min: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Max</label>
                                                        <input
                                                            type="number"
                                                            value={newParam.max}
                                                            onChange={(e) => setNewParam(p => ({ ...p, max: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Step</label>
                                                        <input
                                                            type="number"
                                                            value={newParam.step}
                                                            onChange={(e) => setNewParam(p => ({ ...p, step: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Default</label>
                                                        <input
                                                            type="number"
                                                            value={newParam.defaultValue}
                                                            onChange={(e) => setNewParam(p => ({ ...p, defaultValue: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Prefix</label>
                                                    <input
                                                        type="text"
                                                        value={newParam.prefix}
                                                        onChange={(e) => setNewParam(p => ({ ...p, prefix: e.target.value }))}
                                                        placeholder="$"
                                                        className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Unit</label>
                                                    <input
                                                        type="text"
                                                        value={newParam.unit}
                                                        onChange={(e) => setNewParam(p => ({ ...p, unit: e.target.value }))}
                                                        placeholder="%"
                                                        className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Group</label>
                                                    <input
                                                        type="text"
                                                        value={newParam.group}
                                                        onChange={(e) => setNewParam(p => ({ ...p, group: e.target.value }))}
                                                        placeholder="Pricing"
                                                        className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={addParameter}
                                                disabled={!newParam.label || !newParam.variableName}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                <Plus size={16} />
                                                Add Parameter
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)]">
                            <button
                                onClick={() => setShowConfigPanel(false)}
                                className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Visualization Modal */}
            {editingViz && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                Edit Widget
                            </h2>
                            <button
                                onClick={() => setEditingViz(null)}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={editingViz.title}
                                    onChange={(e) => setEditingViz({ ...editingViz, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                    Type
                                </label>
                                <select
                                    value={editingViz.type}
                                    onChange={(e) => setEditingViz({ ...editingViz, type: e.target.value as VisualizationConfig['type'] })}
                                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                >
                                    <option value="kpi">KPI</option>
                                    <option value="line">Line Chart</option>
                                    <option value="bar">Bar Chart</option>
                                    <option value="area">Area Chart</option>
                                    <option value="pie">Pie Chart</option>
                                    <option value="table">Table</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                    Data Source
                                </label>
                                <input
                                    type="text"
                                    value={editingViz.dataMapping.source}
                                    onChange={(e) => setEditingViz({ 
                                        ...editingViz, 
                                        dataMapping: { ...editingViz.dataMapping, source: e.target.value }
                                    })}
                                    placeholder="e.g., results.revenue"
                                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                />
                            </div>
                            
                            {editingViz.type === 'kpi' && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                        Format
                                    </label>
                                    <select
                                        value={editingViz.dataMapping.format || 'number'}
                                        onChange={(e) => setEditingViz({ 
                                            ...editingViz, 
                                            dataMapping: { ...editingViz.dataMapping, format: e.target.value as 'number' | 'currency' | 'percent' }
                                        })}
                                        className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                    >
                                        <option value="number">Number</option>
                                        <option value="currency">Currency ($)</option>
                                        <option value="percent">Percentage (%)</option>
                                    </select>
                                </div>
                            )}
                            
                            {editingViz.type !== 'kpi' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                            X Axis Key
                                        </label>
                                        <input
                                            type="text"
                                            value={editingViz.dataMapping.xAxis || ''}
                                            onChange={(e) => setEditingViz({ 
                                                ...editingViz, 
                                                dataMapping: { ...editingViz.dataMapping, xAxis: e.target.value }
                                            })}
                                            placeholder="e.g., month"
                                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                            Y Axis Keys (comma separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={editingViz.dataMapping.yAxis?.join(', ') || ''}
                                            onChange={(e) => setEditingViz({ 
                                                ...editingViz, 
                                                dataMapping: { ...editingViz.dataMapping, yAxis: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                                            })}
                                            placeholder="e.g., revenue, cost"
                                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-3">
                            <button
                                onClick={() => setEditingViz(null)}
                                className="flex-1 px-4 py-2 border border-[var(--border-light)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateVisualization(editingViz)}
                                className="flex-1 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                Export Results
                            </h2>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <button
                                onClick={exportAsCSV}
                                className="w-full flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <FileCsv size={20} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--text-primary)]">CSV</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">Spreadsheet format</p>
                                </div>
                            </button>
                            <button
                                onClick={exportAsPNG}
                                className="w-full flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <FileImage size={20} className="text-blue-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--text-primary)]">PNG</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">Screenshot of dashboard</p>
                                </div>
                            </button>
                            <button
                                onClick={exportAsJSON}
                                className="w-full flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <FloppyDisk size={20} className="text-purple-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--text-primary)]">JSON</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">Raw data with parameters</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Modal */}
            {showKeyboardShortcuts && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowKeyboardShortcuts(false)}>
                    <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Keyboard size={20} className="text-[var(--accent-primary)]" />
                                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                    Keyboard Shortcuts
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowKeyboardShortcuts(false)}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {[
                                { keys: ['⌘', 'R'], description: 'Run experiment' },
                                { keys: ['⌘', 'S'], description: 'Quick bookmark' },
                                { keys: ['⌘', 'E'], description: 'Export results' },
                                { keys: ['⌘', 'Z'], description: 'Undo last action' },
                                { keys: ['?'], description: 'Show shortcuts' },
                                { keys: ['Esc'], description: 'Close modals' },
                            ].map((shortcut, i) => (
                                <div key={i} className="flex items-center justify-between py-2">
                                    <span className="text-sm text-[var(--text-secondary)]">{shortcut.description}</span>
                                    <div className="flex items-center gap-1">
                                        {shortcut.keys.map((key, j) => (
                                            <kbd 
                                                key={j}
                                                className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-xs font-mono text-[var(--text-primary)]"
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                            <p className="text-xs text-[var(--text-tertiary)] text-center">
                                Use Ctrl instead of ⌘ on Windows/Linux
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Undo Toast */}
            {showUndoToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl">
                        <ArrowCounterClockwise size={18} className="text-[var(--text-tertiary)]" />
                        <span className="text-sm text-[var(--text-primary)]">{lastUndoAction}</span>
                        <button
                            onClick={handleUndo}
                            className="px-3 py-1 text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition-colors"
                        >
                            Undo
                        </button>
                        <button
                            onClick={() => setShowUndoToast(false)}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                        >
                            <X size={14} className="text-[var(--text-tertiary)]" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Lab;
