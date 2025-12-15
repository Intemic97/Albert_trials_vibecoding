import React, { useState, useEffect } from 'react';
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
    AlertCircle,
    Hash,
    Calculator,
    AlertTriangle,
    Leaf,
    DollarSign,
    Target,
    Info
} from 'lucide-react';
import { Entity } from '../types';
import { ProfileMenu } from './ProfileMenu';
import { API_BASE } from '../config';

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

export const Overview: React.FC<OverviewProps> = ({ entities, onViewChange }) => {
    const [kpis, setKpis] = useState<KPIConfig[]>([]);
    const [kpiValues, setKpiValues] = useState<Record<string, number | null>>({});
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [isLoadingKpis, setIsLoadingKpis] = useState(true);
    const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
    
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
    }, []);

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

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-teal-600" size={24} />
                    <h1 className="text-xl font-bold text-slate-800">Overview</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu onNavigate={onViewChange} />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* KPIs Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <TrendingUp size={20} className="text-teal-600" />
                                Company KPIs
                            </h2>
                            {kpis.length < 6 && (
                                <button
                                    onClick={() => setShowAddKpiModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    Add KPI
                                </button>
                            )}
                        </div>

                        {isLoadingKpis ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
                                        <div className="h-8 bg-slate-200 rounded w-3/4"></div>
                                    </div>
                                ))}
                            </div>
                        ) : kpis.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                <Calculator className="mx-auto text-slate-300 mb-4" size={48} />
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">No KPIs configured</h3>
                                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                                    Add KPIs to monitor important metrics from your company based on your entity data.
                                </p>
                                <button
                                    onClick={() => setShowAddKpiModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                >
                                    <Plus size={18} />
                                    Create first KPI
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {kpis.map((kpi, index) => {
                                    const colors = KPI_COLORS[index % KPI_COLORS.length] || KPI_COLORS[0];
                                    const value = kpiValues[kpi.id] ?? null;
                                    const needsConfig = !kpi.entityId;
                                    
                                    // Determine target status
                                    const hasTarget = kpi.target !== undefined && kpi.target !== null;
                                    const targetMet = hasTarget && value !== null && value <= kpi.target!;
                                    const targetExceeded = hasTarget && value !== null && value > kpi.target!;
                                    
                                    // Choose icon based on KPI type
                                    const getKpiIcon = () => {
                                        if (kpi.icon === 'alert-triangle' || kpi.title.toLowerCase().includes('defect')) {
                                            return <AlertTriangle size={20} className={colors.icon} />;
                                        }
                                        if (kpi.icon === 'dollar-sign' || kpi.title.toLowerCase().includes('cost')) {
                                            return <DollarSign size={20} className={colors.icon} />;
                                        }
                                        if (kpi.icon === 'leaf' || kpi.title.toLowerCase().includes('environmental') || kpi.title.toLowerCase().includes('impact')) {
                                            return <Leaf size={20} className={colors.icon} />;
                                        }
                                        return <Hash size={20} className={colors.icon} />;
                                    };
                                    
                                    return (
                                        <div key={kpi.id} className="flex flex-col">
                                            <div 
                                                className={`${colors.bg} ${colors.border} border rounded-xl p-6 relative group transition-shadow hover:shadow-md ${needsConfig ? 'cursor-pointer' : ''} flex-1`}
                                                onClick={needsConfig ? () => openEditModal(kpi) : undefined}
                                            >
                                                {/* Action buttons */}
                                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(kpi); }}
                                                        className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Settings size={14} className="text-slate-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteKpi(kpi.id); }}
                                                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <X size={14} className="text-red-500" />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg bg-white/60`}>
                                                        {getKpiIcon()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-600 truncate">{kpi.title || 'Untitled'}</p>
                                                        {needsConfig ? (
                                                            <>
                                                                <p className={`text-lg font-semibold text-slate-400 mt-1`}>
                                                                    Not configured
                                                                </p>
                                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                                    <AlertCircle size={12} />
                                                                    Click to configure
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-baseline gap-2 mt-1">
                                                                    <p className={`text-2xl font-bold ${colors.text}`}>
                                                                        {formatValue(value, kpi.operation)}
                                                                    </p>
                                                                    {hasTarget && (
                                                                        <span className={`text-xs font-medium flex items-center gap-1 ${targetMet ? 'text-green-600' : 'text-red-500'}`}>
                                                                            {targetMet ? (
                                                                                <TrendingDown size={12} />
                                                                            ) : (
                                                                                <TrendingUp size={12} />
                                                                            )}
                                                                            {targetMet ? 'On target' : 'Above target'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {hasTarget && (
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <Target size={12} className="text-slate-400" />
                                                                        <span className="text-xs text-slate-500">
                                                                            Target: {formatValue(kpi.target!, kpi.operation)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    {getOperationLabel(kpi.operation)}{kpi.propertyName ? ` of ${kpi.propertyName}` : ''}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Description below the card */}
                                            {kpi.description && (
                                                <p className="text-xs text-slate-500 mt-2 px-1 flex items-start gap-1.5">
                                                    <Info size={12} className="text-slate-400 mt-0.5 shrink-0" />
                                                    <span>{kpi.description}</span>
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {/* Add KPI Card (if less than 3) */}
                                {kpis.length < 3 && (
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => setShowAddKpiModal(true)}
                                            className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors min-h-[140px] flex-1"
                                        >
                                            <Plus size={24} className="mb-2" />
                                            <span className="text-sm font-medium">Add KPI</span>
                                        </button>
                                        {/* Spacer for description area */}
                                        <div className="h-[24px] mt-2"></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>


                    {/* Pending Approvals Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Bell size={20} className="text-orange-500" />
                                Pending Approvals
                                {pendingApprovals.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full">
                                        {pendingApprovals.length}
                                    </span>
                                )}
                            </h2>
                        </div>

                        {isLoadingApprovals ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                <div className="space-y-4">
                                    {[1, 2].map(i => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                                            <div className="flex-1">
                                                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                                                <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : pendingApprovals.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                                <CheckCircle className="mx-auto text-green-400 mb-3" size={40} />
                                <h3 className="text-lg font-semibold text-slate-600 mb-1">All caught up</h3>
                                <p className="text-sm text-slate-500">
                                    You have no pending Human in the Loop approvals
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                {pendingApprovals.map((approval) => (
                                    <div key={approval.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-orange-100 rounded-lg shrink-0">
                                                <Workflow size={20} className="text-orange-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-slate-800 truncate">
                                                        {approval.workflowName}
                                                    </h4>
                                                    <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                                                        {approval.nodeLabel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <Clock size={12} />
                                                    {new Date(approval.createdAt).toLocaleString()}
                                                </p>
                                                {approval.inputDataPreview && (
                                                    <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 font-mono max-h-20 overflow-hidden">
                                                        {JSON.stringify(approval.inputDataPreview, null, 2).slice(0, 150)}...
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleApproval(approval.id, 'reject')}
                                                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <XCircle size={16} />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApproval(approval.id, 'approve')}
                                                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <CheckCircle size={16} />
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => onViewChange?.('workflows')}
                                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-teal-300 transition-all group"
                            >
                                <Workflow size={24} className="text-teal-600 mb-3" />
                                <h3 className="font-semibold text-slate-800 mb-1">Workflows</h3>
                                <p className="text-sm text-slate-500">Manage and run automations</p>
                                <ChevronRight size={16} className="text-slate-400 mt-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => onViewChange?.('database')}
                                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-teal-300 transition-all group"
                            >
                                <TrendingUp size={24} className="text-blue-600 mb-3" />
                                <h3 className="font-semibold text-slate-800 mb-1">Database</h3>
                                <p className="text-sm text-slate-500">Explore and manage your entities</p>
                                <ChevronRight size={16} className="text-slate-400 mt-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => onViewChange?.('dashboard')}
                                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-teal-300 transition-all group"
                            >
                                <LayoutDashboard size={24} className="text-purple-600 mb-3" />
                                <h3 className="font-semibold text-slate-800 mb-1">Dashboards</h3>
                                <p className="text-sm text-slate-500">Visualize your data with charts</p>
                                <ChevronRight size={16} className="text-slate-400 mt-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
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
                        className="bg-white rounded-xl shadow-xl p-6 w-[450px]" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                <Hash size={20} className="text-teal-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingKpi ? handleEditKpi : handleAddKpi}
                                disabled={!kpiTitle || !kpiEntityId || (!kpiPropertyName && kpiOperation !== 'count')}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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

