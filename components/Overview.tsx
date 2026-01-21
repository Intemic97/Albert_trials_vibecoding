import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    TrendingUp, 
    TrendingDown,
    Settings, 
    Plus, 
    X, 
    Bell, 
    CheckCircle, 
    XCircle,
    Clock,
    Workflow,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    Hash,
    Calculator,
    AlertTriangle,
    Leaf,
    DollarSign,
    Target,
    Info,
    Bot,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Sparkles,
    MessageSquare
} from 'lucide-react';
import { Entity } from '../types';
import { API_BASE } from '../config';
import { DynamicChart } from './DynamicChart';

interface KPIConfig {
    id: string;
    title: string;
    entityId: string;
    propertyName: string;
    operation: 'sum' | 'average' | 'count' | 'min' | 'max';
    icon?: string;
    color?: string;
    target?: number;
    description?: string;
}

interface PendingApproval {
    id: string;
    workflowId: string;
    workflowName: string;
    nodeId: string;
    nodeLabel: string;
    assignedUserId: string;
    assignedUserName: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    inputDataPreview?: any;
}

interface OverviewProps {
    entities: Entity[];
    entitiesLoading?: boolean;
    onViewChange?: (view: string) => void;
}

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const KPI_COLORS = [
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-500' },
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
];

// Default KPIs that appear on first load
const DEFAULT_KPIS: KPIConfig[] = [
    {
        id: 'default-defective-batches',
        title: 'Defective Batches',
        entityId: '',
        propertyName: '',
        operation: 'count',
        icon: 'alert-triangle',
        color: 'bg-rose-50',
        description: 'Number of production batches that did not meet quality standards'
    },
    {
        id: 'default-cost-per-unit',
        title: 'Cost per Unit of Product',
        entityId: '',
        propertyName: '',
        operation: 'average',
        icon: 'dollar-sign',
        color: 'bg-emerald-50',
        description: 'Average manufacturing cost to produce one unit of product'
    },
    {
        id: 'default-environmental-impact',
        title: 'Environmental Impact per Unit',
        entityId: '',
        propertyName: '',
        operation: 'average',
        icon: 'leaf',
        color: 'bg-green-50',
        description: 'Average environmental footprint (CO₂ emissions) per unit produced'
    }
];

export const Overview: React.FC<OverviewProps> = ({ entities, entitiesLoading = false, onViewChange }) => {
    const navigate = useNavigate();
    const [kpis, setKpis] = useState<KPIConfig[]>([]);
    const [kpiValues, setKpiValues] = useState<Record<string, number | null>>({});
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [isLoadingKpis, setIsLoadingKpis] = useState(true);
    const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
    const [copilots, setCopilots] = useState<Array<{ id: string; title: string; updatedAt: string; messageCount?: number }>>([]);
    const [isLoadingCopilots, setIsLoadingCopilots] = useState(true);
    
    // Modal states
    const [showAddKpiModal, setShowAddKpiModal] = useState(false);
    const [editingKpi, setEditingKpi] = useState<KPIConfig | null>(null);
    
    // Form states
    const [kpiTitle, setKpiTitle] = useState('');
    const [kpiEntityId, setKpiEntityId] = useState('');
    const [kpiPropertyName, setKpiPropertyName] = useState('');
    const [kpiOperation, setKpiOperation] = useState<'sum' | 'average' | 'count' | 'min' | 'max'>('sum');
    const [kpiTarget, setKpiTarget] = useState<string>('');
    const [kpiDescription, setKpiDescription] = useState('');

    // Load KPIs from localStorage on mount
    useEffect(() => {
        loadKpis();
        loadPendingApprovals();
        loadOverviewStats();
        loadCopilots();
    }, []);

    const loadCopilots = async () => {
        try {
            setIsLoadingCopilots(true);
            const res = await fetch(`${API_BASE}/copilot/chats`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const chats = data.chats || [];
                setCopilots(chats.slice(0, 4).map((chat: any) => ({
                    id: chat.id,
                    title: chat.title || 'New Copilot',
                    updatedAt: chat.updatedAt || chat.createdAt,
                    messageCount: chat.messages?.length || 0
                })));
            }
        } catch (error) {
            console.error('Error loading copilots:', error);
        } finally {
            setIsLoadingCopilots(false);
        }
    };

    const loadOverviewStats = async () => {
        try {
            setIsLoadingStats(true);
            const res = await fetch(`${API_BASE}/overview/stats`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                console.log('[Overview] Stats loaded:', data);
                // Ensure recentWorkflows is always an array
                setOverviewStats({
                    ...data,
                    recentWorkflows: data.recentWorkflows || []
                });
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('[Overview] Failed to load stats:', res.status, res.statusText, errorData);
                // Set empty stats instead of null to show "No workflows yet"
                setOverviewStats({
                    activeWorkflows: 0,
                    eventsTriggered: 0,
                    eventsChange: 0,
                    dailyExecutions: [],
                    recentWorkflows: []
                });
            }
        } catch (e) {
            console.error('Error loading overview stats:', e);
            // Set empty stats on error
            setOverviewStats({
                activeWorkflows: 0,
                eventsTriggered: 0,
                eventsChange: 0,
                dailyExecutions: [],
                recentWorkflows: []
            });
        } finally {
            setIsLoadingStats(false);
        }
    };

    // Recalculate KPI values when KPIs or entities change
    useEffect(() => {
        if (kpis.length > 0) {
            calculateKpiValues();
        }
    }, [kpis, entities]);

    const loadKpis = () => {
        try {
            const saved = localStorage.getItem('overview_kpis');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate that it's an array of valid KPIs
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const validKpis = parsed.filter((kpi: any) => 
                        kpi && typeof kpi === 'object' && kpi.id
                    );
                    if (validKpis.length > 0) {
                        setKpis(validKpis);
                        setIsLoadingKpis(false);
                        return;
                    }
                }
            }
            // No valid KPIs found, set default ones
            setKpis(DEFAULT_KPIS);
            localStorage.setItem('overview_kpis', JSON.stringify(DEFAULT_KPIS));
        } catch (e) {
            console.error('Error loading KPIs:', e);
            // Clear corrupted data and set defaults
            localStorage.removeItem('overview_kpis');
            setKpis(DEFAULT_KPIS);
            localStorage.setItem('overview_kpis', JSON.stringify(DEFAULT_KPIS));
        }
        setIsLoadingKpis(false);
    };

    const saveKpis = (newKpis: KPIConfig[]) => {
        setKpis(newKpis);
        localStorage.setItem('overview_kpis', JSON.stringify(newKpis));
    };

    const loadPendingApprovals = async () => {
        try {
            const res = await fetch(`${API_BASE}/pending-approvals`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setPendingApprovals(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error('Error loading pending approvals:', e);
        }
        setIsLoadingApprovals(false);
    };

    const calculateKpiValues = async () => {
        const values: Record<string, number | null> = {};
        
        for (const kpi of kpis) {
            if (!kpi || !kpi.id || !kpi.entityId) {
                continue;
            }
            
            try {
                const res = await fetch(`${API_BASE}/entities/${kpi.entityId}/records`, { credentials: 'include' });
                if (!res.ok) {
                    values[kpi.id] = null;
                    continue;
                }
                
                const records = await res.json();
                if (!Array.isArray(records) || records.length === 0) {
                    values[kpi.id] = kpi.operation === 'count' ? 0 : null;
                    continue;
                }

                // For count operation, we don't need a property
                if (kpi.operation === 'count') {
                    values[kpi.id] = records.length;
                    continue;
                }

                // For other operations, we need a valid property
                if (!kpi.propertyName) {
                    values[kpi.id] = null;
                    continue;
                }

                const numericValues = records
                    .map((r: any) => {
                        const val = r[kpi.propertyName];
                        return typeof val === 'number' ? val : parseFloat(val);
                    })
                    .filter((v: number) => typeof v === 'number' && !isNaN(v));

                switch (kpi.operation) {
                    case 'sum':
                        values[kpi.id] = numericValues.reduce((a: number, b: number) => a + b, 0);
                        break;
                    case 'average':
                        values[kpi.id] = numericValues.length > 0 
                            ? numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length 
                            : null;
                        break;
                    case 'min':
                        values[kpi.id] = numericValues.length > 0 ? Math.min(...numericValues) : null;
                        break;
                    case 'max':
                        values[kpi.id] = numericValues.length > 0 ? Math.max(...numericValues) : null;
                        break;
                    default:
                        values[kpi.id] = null;
                }
            } catch (e) {
                console.error(`Error calculating KPI ${kpi.id}:`, e);
                values[kpi.id] = null;
            }
        }
        
        setKpiValues(values);
    };

    const handleAddKpi = () => {
        if (!kpiTitle || !kpiEntityId || !kpiPropertyName) return;
        
        const newKpi: KPIConfig = {
            id: generateUUID(),
            title: kpiTitle,
            entityId: kpiEntityId,
            propertyName: kpiPropertyName,
            operation: kpiOperation,
            color: KPI_COLORS[kpis.length % KPI_COLORS.length].bg,
            target: kpiTarget ? parseFloat(kpiTarget) : undefined,
            description: kpiDescription || undefined
        };
        
        saveKpis([...kpis, newKpi]);
        resetForm();
        setShowAddKpiModal(false);
    };

    const handleEditKpi = () => {
        if (!editingKpi || !kpiTitle || !kpiEntityId || (!kpiPropertyName && kpiOperation !== 'count')) return;
        
        const updatedKpis = kpis.map(k => 
            k.id === editingKpi.id 
                ? { 
                    ...k, 
                    title: kpiTitle, 
                    entityId: kpiEntityId, 
                    propertyName: kpiPropertyName, 
                    operation: kpiOperation,
                    target: kpiTarget ? parseFloat(kpiTarget) : undefined,
                    description: kpiDescription || undefined
                }
                : k
        );
        
        saveKpis(updatedKpis);
        resetForm();
        setEditingKpi(null);
    };

    const handleDeleteKpi = (kpiId: string) => {
        if (!confirm('Are you sure you want to delete this KPI?')) return;
        saveKpis(kpis.filter(k => k.id !== kpiId));
    };

    const resetForm = () => {
        setKpiTitle('');
        setKpiEntityId('');
        setKpiPropertyName('');
        setKpiOperation('sum');
        setKpiTarget('');
        setKpiDescription('');
    };

    const openEditModal = (kpi: KPIConfig) => {
        setEditingKpi(kpi);
        setKpiTitle(kpi.title);
        setKpiEntityId(kpi.entityId);
        setKpiPropertyName(kpi.propertyName);
        setKpiOperation(kpi.operation);
        setKpiTarget(kpi.target !== undefined ? String(kpi.target) : '');
        setKpiDescription(kpi.description || '');
    };

    const handleApproval = async (approvalId: string, action: 'approve' | 'reject') => {
        try {
            const res = await fetch(`${API_BASE}/pending-approvals/${approvalId}/${action}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (res.ok) {
                setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
            }
        } catch (e) {
            console.error(`Error ${action}ing approval:`, e);
        }
    };

    const getNumericProperties = (entityId: string) => {
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return [];
        return entity.properties.filter(p => p.type === 'number');
    };

    const getEntityName = (entityId: string) => {
        return entities.find(e => e.id === entityId)?.name || 'Unknown';
    };

    const formatValue = (value: number | null | undefined, operation: string) => {
        if (value === null || value === undefined) return '—';
        if (typeof value !== 'number' || isNaN(value)) return '—';
        if (operation === 'count') return value.toLocaleString();
        if (Number.isInteger(value)) return value.toLocaleString();
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getOperationLabel = (op: string) => {
        switch (op) {
            case 'sum': return 'Sum';
            case 'average': return 'Average';
            case 'count': return 'Count';
            case 'min': return 'Min';
            case 'max': return 'Max';
            default: return op;
        }
    };

    const [overviewStats, setOverviewStats] = useState<{
        activeWorkflows: number;
        eventsTriggered: number;
        eventsChange: number;
        dailyExecutions: Array<{ date: string; count: number }>;
        recentWorkflows: Array<{
            id: string;
            name: string;
            executionCount: number;
            lastExecutionAt: string | null;
            status: string;
        }>;
    } | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    
    // Pagination for workflows table
    const [workflowsPage, setWorkflowsPage] = useState(1);
    const workflowsPerPage = 10;

    // Generate chart data from daily executions
    const getChartData = () => {
        if (!overviewStats || !overviewStats.dailyExecutions.length) {
            return {
                type: 'area' as const,
                title: 'Events Triggered vs Copilot Interactions',
                description: 'Daily activity',
                data: [],
                xAxisKey: 'date',
                dataKey: ['events', 'copilotInteractions'],
                colors: ['#10b981', '#94a3b8']
            };
        }
        
        // Map dates to day names and prepare data
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = overviewStats.dailyExecutions.map(row => {
            const date = new Date(row.date);
            return {
                date: dayNames[date.getDay()],
                events: row.count,
                copilotInteractions: 0
            };
        });
        
        return {
            type: 'area' as const,
            title: 'Events Triggered vs Copilot Interactions',
            description: 'Daily activity',
            data,
            xAxisKey: 'date',
            dataKey: ['events', 'copilotInteractions'],
            colors: ['#10b981', '#94a3b8']
        };
    };

    const overviewChartConfig = getChartData();

    const formatTimeAgo = (dateString: string | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const severityStyles: Record<string, string> = {
        critical: 'bg-red-50 text-red-700 border-red-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        info: 'bg-slate-100 text-slate-600 border-slate-200'
    };

    const statusStyles: Record<string, string> = {
        running: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        paused: 'bg-amber-50 text-amber-700 border-amber-200',
        error: 'bg-red-50 text-red-700 border-red-200'
    };

    // Show loading state when entities are being fetched
    if (entitiesLoading) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Overview</h1>
                    </div>
                    <div />
                </header>
                {/* Loading state */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm text-slate-500">Loading your data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50" data-tutorial="overview-content">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Overview</h1>
                </div>
                <div />
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Active Workflows */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600">
                                        <Workflow size={18} />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-slate-500 mb-1">Active Workflows</p>
                                    <p className="text-2xl font-normal text-slate-900">
                                        {isLoadingStats ? '...' : (overviewStats?.activeWorkflows || 0)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Events Triggered */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600">
                                        <Activity size={18} />
                                    </div>
                                    {overviewStats && overviewStats.eventsChange !== 0 && (
                                        <div className={`flex items-center gap-1 text-xs font-medium ${overviewStats.eventsChange > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {overviewStats.eventsChange > 0 ? (
                                                <ArrowUpRight size={12} />
                                            ) : (
                                                <ArrowDownRight size={12} />
                                            )}
                                            {overviewStats.eventsChange > 0 ? '+' : ''}{overviewStats.eventsChange.toFixed(1)}%
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-slate-500 mb-1">Events Triggered</p>
                                    <p className="text-2xl font-normal text-slate-900">
                                        {isLoadingStats ? '...' : (overviewStats?.eventsTriggered || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Copilot Sessions */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600">
                                        <Bot size={18} />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-slate-500 mb-1">Copilot Sessions</p>
                                    <p className="text-2xl font-normal text-slate-900">—</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-normal text-slate-900">Overview</h2>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                        Events Triggered
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                                        Copilot Interactions
                                    </div>
                                </div>
                            </div>
                            <DynamicChart config={overviewChartConfig} />
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-normal text-slate-900">Your Copilots</h2>
                                <button 
                                    onClick={() => navigate('/copilots')}
                                    className="text-xs text-slate-500 hover:text-slate-700"
                                >
                                    View all
                                </button>
                            </div>
                            <div className="space-y-3">
                                {isLoadingCopilots ? (
                                    <div className="text-center py-4 text-sm text-slate-500">Loading...</div>
                                ) : copilots.length > 0 ? (
                                    copilots.map(copilot => (
                                        <div key={copilot.id} className="flex items-start gap-3 border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/copilots?chatId=${copilot.id}`)}>
                                            <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
                                                <Sparkles size={16} className="text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-normal text-slate-900 truncate">{copilot.title}</p>
                                                <p className="text-xs text-slate-500 truncate">{copilot.messageCount || 0} messages</p>
                                                <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(copilot.updatedAt)}</p>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/copilots?chatId=${copilot.id}`);
                                                }}
                                                className="text-xs text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                                            >
                                                Open
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-sm text-slate-500">
                                        <p className="mb-2">No copilots yet</p>
                                        <button
                                            onClick={() => navigate('/copilots')}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                        >
                                            Create your first copilot
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <h2 className="text-base font-normal text-slate-900">Workflows</h2>
                            <button 
                                onClick={() => navigate('/logs')}
                                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                View all
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="text-slate-500">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-4 py-2 font-medium">Name</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-4 py-2 font-medium">Last Run</th>
                                        <th className="px-4 py-2 font-medium">Data Points</th>
                                        <th className="px-4 py-2 font-medium">Owner</th>
                                        <th className="px-4 py-2 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingStats ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                                Loading workflows...
                                            </td>
                                        </tr>
                                    ) : overviewStats && overviewStats.recentWorkflows && overviewStats.recentWorkflows.length > 0 ? (
                                        overviewStats.recentWorkflows
                                            .slice((workflowsPage - 1) * workflowsPerPage, workflowsPage * workflowsPerPage)
                                            .map(workflow => (
                                            <tr key={workflow.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                <td className="px-4 py-2 text-slate-900 font-medium">{workflow.name}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusStyles[workflow.status] || statusStyles.paused}`}>
                                                        {workflow.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-slate-600">{formatTimeAgo(workflow.lastExecutionAt)}</td>
                                                <td className="px-4 py-2 text-slate-600">{workflow.executionCount.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-slate-600">—</td>
                                                <td className="px-4 py-2 text-right">
                                                    <button 
                                                        onClick={() => navigate(`/workflow/${workflow.id}`)}
                                                        className="text-xs text-emerald-600 hover:text-emerald-700"
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                                {overviewStats ? 'No workflows yet' : 'Failed to load workflows'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination for Workflows */}
                        {overviewStats && overviewStats.recentWorkflows && overviewStats.recentWorkflows.length > workflowsPerPage && (
                            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing {(workflowsPage - 1) * workflowsPerPage + 1} to {Math.min(workflowsPage * workflowsPerPage, overviewStats.recentWorkflows.length)} of {overviewStats.recentWorkflows.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setWorkflowsPage(prev => Math.max(1, prev - 1))}
                                        disabled={workflowsPage === 1}
                                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-sm text-slate-600 px-2">
                                        Page {workflowsPage} of {Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage)}
                                    </span>
                                    <button
                                        onClick={() => setWorkflowsPage(prev => Math.min(Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage), prev + 1))}
                                        disabled={workflowsPage === Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage)}
                                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </div>

            {/* Add/Edit KPI Modal */}
            {(showAddKpiModal || editingKpi) && (
                <div 
                    className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" 
                    onClick={() => { setShowAddKpiModal(false); setEditingKpi(null); resetForm(); }}
                >
                    <div 
                        className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[450px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                <Hash size={20} className="text-teal-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-normal text-slate-800">
                                    {editingKpi ? 'Edit KPI' : 'New KPI'}
                                </h3>
                                <p className="text-sm text-slate-500">Configure a company metric</p>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    KPI Name
                                </label>
                                <input
                                    type="text"
                                    value={kpiTitle}
                                    onChange={(e) => setKpiTitle(e.target.value)}
                                    placeholder="e.g., Total Sales, Active Customers..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Description <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={kpiDescription}
                                    onChange={(e) => setKpiDescription(e.target.value)}
                                    placeholder="Explain what this KPI measures and why it matters..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Entity
                                </label>
                                <select
                                    value={kpiEntityId}
                                    onChange={(e) => {
                                        setKpiEntityId(e.target.value);
                                        setKpiPropertyName('');
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">Select an entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                                    ))}
                                </select>
                            </div>

                            {kpiEntityId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Property (numeric)
                                    </label>
                                    {getNumericProperties(kpiEntityId).length > 0 ? (
                                        <select
                                            value={kpiPropertyName}
                                            onChange={(e) => setKpiPropertyName(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                        >
                                            <option value="">Select a property...</option>
                                            {getNumericProperties(kpiEntityId).map(prop => (
                                                <option key={prop.id} value={prop.name}>{prop.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            This entity has no numeric properties
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Operation
                                </label>
                                <select
                                    value={kpiOperation}
                                    onChange={(e) => setKpiOperation(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="sum">Sum (total)</option>
                                    <option value="average">Average</option>
                                    <option value="count">Count (number of records)</option>
                                    <option value="min">Minimum</option>
                                    <option value="max">Maximum</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Target Value <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <Target size={16} className="text-slate-400" />
                                    <input
                                        type="number"
                                        value={kpiTarget}
                                        onChange={(e) => setKpiTarget(e.target.value)}
                                        placeholder="e.g., 100, 5.5, 0"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Set a target to track performance. Values at or below target are shown as "On target".
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => { setShowAddKpiModal(false); setEditingKpi(null); resetForm(); }}
                                className="btn-3d btn-secondary-3d text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingKpi ? handleEditKpi : handleAddKpi}
                                disabled={!kpiTitle || !kpiEntityId || (!kpiPropertyName && kpiOperation !== 'count')}
                                className="btn-3d btn-primary-3d disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                            >
                                {editingKpi ? 'Save changes' : 'Create KPI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

