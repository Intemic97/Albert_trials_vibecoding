import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Warning as AlertTriangle, 
    CheckCircle, 
    Clock, 
    XCircle, 
    Funnel as Filter, 
    MagnifyingGlass as Search, 
    CaretDown as ChevronDown, 
    CaretRight as ChevronRight,
    CaretLeft as ChevronLeft,
    ArrowsClockwise as RefreshCw,
    Calendar,
    FlowArrow as Workflow,
    SpinnerGap as Loader2,
    Info,
    WarningCircle as AlertCircle
} from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';
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
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [currentAlertsPage, setCurrentAlertsPage] = useState(1);
    const itemsPerPage = 20;

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
                return <CheckCircle size={16} weight="light" className="text-emerald-600" />;
            case 'running':
                return <Loader2 size={16} weight="light" className="text-[#256A65] animate-spin" />;
            case 'failed':
                return <XCircle size={16} weight="light" className="text-red-600" />;
            case 'pending':
                return <Clock size={16} weight="light" className="text-amber-600" />;
            default:
                return <Info size={16} weight="light" className="text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            running: 'bg-[#84C4D1]/20 text-[#256A65] border-[#84C4D1]/40',
            failed: 'bg-red-50 text-red-700 border-red-200',
            pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30'
        };
        return styles[status as keyof typeof styles] || 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-light)]';
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
    
    // Pagination calculations
    const totalExecutionsPages = Math.ceil(filteredExecutions.length / itemsPerPage);
    const totalAlertsPages = Math.ceil(filteredAlerts.length / itemsPerPage);
    const paginatedExecutions = filteredExecutions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const paginatedAlerts = filteredAlerts.slice(
        (currentAlertsPage - 1) * itemsPerPage,
        currentAlertsPage * itemsPerPage
    );
    
    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
        setCurrentAlertsPage(1);
    }, [statusFilter, typeFilter, searchQuery, dateFilter]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <PageHeader title="Executions" subtitle="Monitor workflow executions and system alerts">
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg border border-[var(--border-light)] transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} weight="light" className={`text-[var(--text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Refresh</span>
                </button>
            </PageHeader>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Filters */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Type Filter */}
                            <div className="relative flex items-center gap-2">
                                <Filter size={16} weight="light" className="text-slate-400" />
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer pr-8 hover:border-[var(--border-medium)] transition-colors"
                                >
                                    <option value="all">All</option>
                                    <option value="executions">Executions</option>
                                    <option value="alerts">Alerts</option>
                                </select>
                                <ChevronDown size={14} weight="light" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Status Filter */}
                            {(typeFilter === 'all' || typeFilter === 'executions') && (
                                <div className="relative">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer pr-8 hover:border-[var(--border-medium)] transition-colors"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="completed">Completed</option>
                                        <option value="running">Running</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                    <ChevronDown size={14} weight="light" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            )}

                            {/* Date Filter */}
                            <div className="relative">
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer pr-8 hover:border-[var(--border-medium)] transition-colors"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">Last 7 Days</option>
                                    <option value="month">Last 30 Days</option>
                                </select>
                                <ChevronDown size={14} weight="light" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Search */}
                            <div className="flex-1 min-w-[240px]">
                                <div className="relative">
                                    <Search size={16} weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-slate-400 hover:border-[var(--border-medium)] transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executions List */}
                    {(typeFilter === 'all' || typeFilter === 'executions') && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                                <h2 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                                    Workflow Executions ({filteredExecutions.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="animate-spin text-slate-400" size={24} weight="light" />
                                    </div>
                                ) : filteredExecutions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Workflow className="mx-auto text-slate-300" size={40} weight="light" />
                                        <p className="text-[var(--text-secondary)] mt-2 text-sm">No executions found</p>
                                    </div>
                                ) : (
                                    paginatedExecutions.map((execution) => {
                                        const isExpanded = expandedExecutions.has(execution.id);
                                        const logs = executionLogs[execution.id] || [];
                                        return (
                                            <div key={execution.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                                                <div
                                                    className="px-6 py-2.5 flex items-center justify-between cursor-pointer"
                                                    onClick={() => toggleExecutionExpanded(execution.id)}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <button className="text-slate-400 hover:text-[var(--text-secondary)]">
                                                            {isExpanded ? (
                                                                <ChevronDown size={16} weight="light" />
                                                            ) : (
                                                                <ChevronRight size={16} weight="light" />
                                                            )}
                                                        </button>
                                                        {getStatusIcon(execution.status)}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                                                    {execution.workflowName || execution.workflowId}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-md border text-xs font-medium ${getStatusBadge(execution.status)}`}>
                                                                    {execution.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-secondary)]">
                                                                <span>ID: {execution.id.slice(0, 8)}...</span>
                                                                {execution.duration && (
                                                                    <span>Duration: {formatDuration(execution.duration)}</span>
                                                                )}
                                                                <span>{formatDate(execution.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {execution.error && (
                                                        <AlertTriangle size={14} weight="light" className="text-red-500 flex-shrink-0" />
                                                    )}
                                                </div>
                                                
                                                {/* Expanded Logs */}
                                                {isExpanded && (
                                                    <div className="px-6 py-3 bg-[var(--bg-tertiary)] border-t border-[var(--border-light)]">
                                                        {execution.error && (
                                                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                                <div className="flex items-start gap-2">
                                                                    <XCircle size={16} weight="light" className="text-red-600 mt-0.5 flex-shrink-0" />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-red-900">Error</p>
                                                                        <p className="text-xs text-red-700 mt-1">{execution.error}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {logs.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                    Execution Logs ({logs.length})
                                                                </p>
                                                                {logs.map((log) => (
                                                                    <div
                                                                        key={log.id}
                                                                        className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-3"
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                {getStatusIcon(log.status)}
                                                                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                                                                    {log.nodeLabel || log.nodeType}
                                                                                </span>
                                                                                <span className="text-xs text-slate-400">{log.nodeType}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
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
                                                                <Loader2 className="animate-spin text-slate-400 mx-auto" size={20} weight="light" />
                                                                <p className="text-xs text-[var(--text-secondary)] mt-2">Loading logs...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {/* Pagination for Executions */}
                            {filteredExecutions.length > itemsPerPage && (
                                <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-between">
                                    <div className="text-sm text-[var(--text-secondary)]">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredExecutions.length)} of {filteredExecutions.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={16} weight="light" />
                                        </button>
                                        <span className="text-sm text-[var(--text-secondary)] px-2">
                                            Page {currentPage} of {totalExecutionsPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalExecutionsPages, prev + 1))}
                                            disabled={currentPage === totalExecutionsPages}
                                            className="px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={16} weight="light" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Alerts List */}
                    {(typeFilter === 'all' || typeFilter === 'alerts') && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                                <h2 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                    Alerts ({filteredAlerts.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {filteredAlerts.length === 0 ? (
                                    <div className="text-center py-12">
                                        <AlertCircle className="mx-auto text-slate-300" size={40} weight="light" />
                                        <p className="text-[var(--text-secondary)] mt-2 text-sm">No alerts</p>
                                    </div>
                                ) : (
                                    paginatedAlerts.map((alert) => {
                                        const alertIcons = {
                                            error: <XCircle size={16} weight="light" className="text-red-600" />,
                                            warning: <AlertTriangle size={16} weight="light" className="text-amber-600" />,
                                            info: <Info size={16} weight="light" className="text-[#256A65]" />,
                                            success: <CheckCircle size={16} weight="light" className="text-emerald-600" />
                                        };
                                        const alertStyles = {
                                            error: 'bg-red-50 border-red-200',
                                            warning: 'bg-amber-50 border-amber-200',
                                            info: 'bg-[#84C4D1]/20 border-[#84C4D1]/40',
                                            success: 'bg-emerald-50 border-emerald-200'
                                        };
                                        return (
                                            <div
                                                key={alert.id}
                                                className={`px-6 py-4 hover:bg-[var(--bg-tertiary)] transition-colors ${alertStyles[alert.type]}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {alertIcons[alert.type]}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-normal text-[var(--text-primary)]">{alert.title}</p>
                                                            {alert.workflowName && (
                                                                <span className="text-xs text-[var(--text-secondary)]">• {alert.workflowName}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-[var(--text-secondary)]">{alert.message}</p>
                                                        <p className="text-xs text-slate-400 mt-2">{formatDate(alert.timestamp)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {/* Pagination for Alerts */}
                            {filteredAlerts.length > itemsPerPage && (
                                <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-between">
                                    <div className="text-sm text-[var(--text-secondary)]">
                                        Showing {(currentAlertsPage - 1) * itemsPerPage + 1} to {Math.min(currentAlertsPage * itemsPerPage, filteredAlerts.length)} of {filteredAlerts.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentAlertsPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentAlertsPage === 1}
                                            className="px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={16} weight="light" />
                                        </button>
                                        <span className="text-sm text-[var(--text-secondary)] px-2">
                                            Page {currentAlertsPage} of {totalAlertsPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentAlertsPage(prev => Math.min(totalAlertsPages, prev + 1))}
                                            disabled={currentAlertsPage === totalAlertsPages}
                                            className="px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={16} weight="light" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
