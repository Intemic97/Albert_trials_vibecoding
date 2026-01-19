import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    XCircle, 
    Filter, 
    Search, 
    ChevronDown, 
    ChevronRight,
    RefreshCw,
    Calendar,
    Workflow,
    Loader2,
    Info,
    AlertCircle
} from 'lucide-react';
import { API_BASE } from '../config';

interface Execution {
    id: string;
    workflowId: string;
    workflowName?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    triggerType?: string;
    inputs?: any;
    error?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
}

interface ExecutionLog {
    id: string;
    executionId: string;
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    status: 'running' | 'completed' | 'error';
    inputData?: any;
    outputData?: any;
    error?: string;
    duration?: number;
    timestamp: string;
}

interface Alert {
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    workflowId?: string;
    workflowName?: string;
    executionId?: string;
    timestamp: string;
    read: boolean;
}

export const LogsAndAlerts: React.FC = () => {
    const navigate = useNavigate();
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
    const [executionLogs, setExecutionLogs] = useState<Record<string, ExecutionLog[]>>({});
    const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all'); // 'executions' | 'alerts'
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('all'); // 'all' | 'today' | 'week' | 'month'

    useEffect(() => {
        loadData();
        // Refresh every 10 seconds if viewing executions
        const interval = setInterval(() => {
            if (typeFilter === 'all' || typeFilter === 'executions') {
                loadExecutions();
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [typeFilter]);

    const loadData = async () => {
        setIsLoading(true);
        await Promise.all([loadExecutions(), loadAlerts()]);
        setIsLoading(false);
    };

    const loadExecutions = async () => {
        try {
            // First get all workflows for the organization
            const workflowsRes = await fetch(`${API_BASE}/workflows`, {
                credentials: 'include'
            });
            if (!workflowsRes.ok) return;
            
            const workflows = await workflowsRes.json();
            const allExecutions: Execution[] = [];
            
            // Get executions for each workflow
            for (const workflow of workflows.slice(0, 50)) { // Limit to 50 workflows
                try {
                    const execRes = await fetch(`${API_BASE}/workflow/${workflow.id}/executions?limit=20`, {
                        credentials: 'include'
                    });
                    if (execRes.ok) {
                        const execs = await execRes.json();
                        const executions = Array.isArray(execs) ? execs : execs.executions || [];
                        executions.forEach((exec: any) => {
                            allExecutions.push({
                                ...exec,
                                workflowName: workflow.name || workflow.id
                            });
                        });
                    }
                } catch (e) {
                    console.error(`Error loading executions for workflow ${workflow.id}:`, e);
                }
            }
            
            // Sort by creation date (newest first)
            allExecutions.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
            setExecutions(allExecutions.slice(0, 200)); // Limit to 200 most recent
        } catch (error) {
            console.error('Error loading executions:', error);
        }
    };

    const loadAlerts = async () => {
        try {
            // For now, generate alerts from failed executions
            // In the future, this could come from a dedicated alerts endpoint
            const res = await fetch(`${API_BASE}/workflow/executions?limit=100`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                const executions = data.executions || [];
                const generatedAlerts: Alert[] = executions
                    .filter((e: Execution) => e.status === 'failed')
                    .map((e: Execution) => ({
                        id: `alert-${e.id}`,
                        type: 'error' as const,
                        title: 'Workflow Execution Failed',
                        message: e.error || 'An error occurred during execution',
                        workflowId: e.workflowId,
                        workflowName: e.workflowName,
                        executionId: e.id,
                        timestamp: e.completedAt || e.createdAt,
                        read: false
                    }));
                setAlerts(generatedAlerts);
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
        }
    };

    const loadExecutionLogs = async (executionId: string) => {
        if (executionLogs[executionId]) return; // Already loaded
        
        try {
            const res = await fetch(`${API_BASE}/workflow/execution/${executionId}/logs`, {
                credentials: 'include'
            });
            if (res.ok) {
                const logs = await res.json();
                setExecutionLogs(prev => ({ ...prev, [executionId]: logs }));
            }
        } catch (error) {
            console.error('Error loading execution logs:', error);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
    };

    const toggleExecutionExpanded = (executionId: string) => {
        const newExpanded = new Set(expandedExecutions);
        if (newExpanded.has(executionId)) {
            newExpanded.delete(executionId);
        } else {
            newExpanded.add(executionId);
            loadExecutionLogs(executionId);
        }
        setExpandedExecutions(newExpanded);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 size={16} className="text-emerald-600" />;
            case 'running':
                return <Loader2 size={16} className="text-blue-600 animate-spin" />;
            case 'failed':
                return <XCircle size={16} className="text-red-600" />;
            case 'pending':
                return <Clock size={16} className="text-amber-600" />;
            default:
                return <Info size={16} className="text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            running: 'bg-blue-50 text-blue-700 border-blue-200',
            failed: 'bg-red-50 text-red-700 border-red-200',
            pending: 'bg-amber-50 text-amber-700 border-amber-200'
        };
        return styles[status as keyof typeof styles] || 'bg-slate-50 text-slate-700 border-slate-200';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '—';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const filterExecutions = () => {
        let filtered = executions;

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(e => e.status === statusFilter);
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(e => 
                e.id.toLowerCase().includes(query) ||
                e.workflowId.toLowerCase().includes(query) ||
                e.workflowName?.toLowerCase().includes(query) ||
                e.error?.toLowerCase().includes(query)
            );
        }

        // Date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(e => {
                const date = new Date(e.createdAt);
                switch (dateFilter) {
                    case 'today':
                        return date.toDateString() === now.toDateString();
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return date >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        return date >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        return filtered;
    };

    const filteredExecutions = filterExecutions();
    const filteredAlerts = alerts.filter(a => 
        !searchQuery || 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">Executions</h1>
                    <p className="text-[11px] text-slate-500">Monitor workflow executions and system alerts</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={`text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium text-slate-700">Refresh</span>
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Filters */}
                    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Type Filter */}
                            <div className="relative flex items-center gap-2">
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 appearance-none cursor-pointer pr-8 hover:border-slate-300 transition-colors"
                                >
                                    <option value="all">All</option>
                                    <option value="executions">Executions</option>
                                    <option value="alerts">Alerts</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Status Filter */}
                            {(typeFilter === 'all' || typeFilter === 'executions') && (
                                <div className="relative">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 appearance-none cursor-pointer pr-8 hover:border-slate-300 transition-colors"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="completed">Completed</option>
                                        <option value="running">Running</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            )}

                            {/* Date Filter */}
                            <div className="relative">
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 appearance-none cursor-pointer pr-8 hover:border-slate-300 transition-colors"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">Last 7 Days</option>
                                    <option value="month">Last 30 Days</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Search */}
                            <div className="flex-1 min-w-[240px]">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400 hover:border-slate-300 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executions List */}
                    {(typeFilter === 'all' || typeFilter === 'executions') && (
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-slate-200 bg-white">
                                <h2 className="text-base font-semibold text-slate-900">
                                    Workflow Executions ({filteredExecutions.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="animate-spin text-slate-400" size={24} />
                                    </div>
                                ) : filteredExecutions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Workflow className="mx-auto text-slate-300" size={40} />
                                        <p className="text-slate-500 mt-2 text-sm">No executions found</p>
                                    </div>
                                ) : (
                                    filteredExecutions.map((execution) => {
                                        const isExpanded = expandedExecutions.has(execution.id);
                                        const logs = executionLogs[execution.id] || [];
                                        return (
                                            <div key={execution.id} className="hover:bg-slate-50 transition-colors">
                                                <div
                                                    className="px-6 py-4 flex items-center justify-between cursor-pointer"
                                                    onClick={() => toggleExecutionExpanded(execution.id)}
                                                >
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <button className="text-slate-400 hover:text-slate-600">
                                                            {isExpanded ? (
                                                                <ChevronDown size={18} />
                                                            ) : (
                                                                <ChevronRight size={18} />
                                                            )}
                                                        </button>
                                                        {getStatusIcon(execution.status)}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-slate-900">
                                                                    {execution.workflowName || execution.workflowId}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-md border text-xs font-medium ${getStatusBadge(execution.status)}`}>
                                                                    {execution.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                                <span>ID: {execution.id.slice(0, 8)}...</span>
                                                                {execution.duration && (
                                                                    <span>Duration: {formatDuration(execution.duration)}</span>
                                                                )}
                                                                <span>{formatDate(execution.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {execution.error && (
                                                        <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                                                    )}
                                                </div>
                                                
                                                {/* Expanded Logs */}
                                                {isExpanded && (
                                                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                                                        {execution.error && (
                                                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                                <div className="flex items-start gap-2">
                                                                    <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-red-900">Error</p>
                                                                        <p className="text-xs text-red-700 mt-1">{execution.error}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {logs.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                                                    Execution Logs ({logs.length})
                                                                </p>
                                                                {logs.map((log) => (
                                                                    <div
                                                                        key={log.id}
                                                                        className="bg-white border border-slate-200 rounded-lg p-3"
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                {getStatusIcon(log.status)}
                                                                                <span className="text-sm font-medium text-slate-900">
                                                                                    {log.nodeLabel || log.nodeType}
                                                                                </span>
                                                                                <span className="text-xs text-slate-400">{log.nodeType}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                                                {log.duration && (
                                                                                    <span>{formatDuration(log.duration)}</span>
                                                                                )}
                                                                                <span>{formatDate(log.timestamp)}</span>
                                                                            </div>
                                                                        </div>
                                                                        {log.error && (
                                                                            <p className="text-xs text-red-600 mt-2">{log.error}</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-4">
                                                                <Loader2 className="animate-spin text-slate-400 mx-auto" size={20} />
                                                                <p className="text-xs text-slate-500 mt-2">Loading logs...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Alerts List */}
                    {(typeFilter === 'all' || typeFilter === 'alerts') && (
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-slate-200 bg-white">
                                <h2 className="text-base font-semibold text-slate-900">
                                    Alerts ({filteredAlerts.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {filteredAlerts.length === 0 ? (
                                    <div className="text-center py-12">
                                        <AlertCircle className="mx-auto text-slate-300" size={40} />
                                        <p className="text-slate-500 mt-2 text-sm">No alerts</p>
                                    </div>
                                ) : (
                                    filteredAlerts.map((alert) => {
                                        const alertIcons = {
                                            error: <XCircle size={16} className="text-red-600" />,
                                            warning: <AlertTriangle size={16} className="text-amber-600" />,
                                            info: <Info size={16} className="text-blue-600" />,
                                            success: <CheckCircle2 size={16} className="text-emerald-600" />
                                        };
                                        const alertStyles = {
                                            error: 'bg-red-50 border-red-200',
                                            warning: 'bg-amber-50 border-amber-200',
                                            info: 'bg-blue-50 border-blue-200',
                                            success: 'bg-emerald-50 border-emerald-200'
                                        };
                                        return (
                                            <div
                                                key={alert.id}
                                                className={`px-6 py-4 hover:bg-slate-50 transition-colors ${alertStyles[alert.type]}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {alertIcons[alert.type]}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                                                            {alert.workflowName && (
                                                                <span className="text-xs text-slate-500">• {alert.workflowName}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-600">{alert.message}</p>
                                                        <p className="text-xs text-slate-400 mt-2">{formatDate(alert.timestamp)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
