import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FlowArrow,
    CaretRight,
    CaretLeft,
    Robot,
    ArrowUpRight,
    ArrowDownRight,
    Pulse,
    Sparkle,
    Database,
    FileText,
    Plus
} from '@phosphor-icons/react';
import { Entity } from '../types';
import { API_BASE } from '../config';
import { DynamicChart } from './DynamicChart';

interface OverviewProps {
    entities: Entity[];
    entitiesLoading?: boolean;
    onViewChange?: (view: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ entities, entitiesLoading = false, onViewChange }) => {
    const navigate = useNavigate();
    const [copilots, setCopilots] = useState<Array<{ id: string; title: string; updatedAt: string; messageCount?: number }>>([]);
    const [isLoadingCopilots, setIsLoadingCopilots] = useState(true);
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

    useEffect(() => {
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
                setOverviewStats({
                    ...data,
                    recentWorkflows: data.recentWorkflows || []
                });
            } else {
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

    // Generate chart data from daily executions
    const getChartData = () => {
        if (!overviewStats || !overviewStats.dailyExecutions.length) {
            // Generate mock data for empty state
            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const mockData = dayNames.map(day => ({
                date: day,
                executions: 0
            }));
            return {
                type: 'area' as const,
                title: 'Workflow Executions',
                description: 'Last 7 days',
                data: mockData,
                xAxisKey: 'date',
                dataKey: ['executions'],
                colors: ['#419CAF']
            };
        }
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = overviewStats.dailyExecutions.map(row => {
            const date = new Date(row.date);
            return {
                date: dayNames[date.getDay()],
                executions: row.count
            };
        });
        
        return {
            type: 'area' as const,
            title: 'Workflow Executions',
            description: 'Last 7 days',
            data,
            xAxisKey: 'date',
            dataKey: ['executions'],
            colors: ['#419CAF']
        };
    };
    
    // Calculate chart stats
    const chartStats = {
        total: overviewStats?.dailyExecutions?.reduce((sum, d) => sum + d.count, 0) || 0,
        average: overviewStats?.dailyExecutions?.length 
            ? Math.round(overviewStats.dailyExecutions.reduce((sum, d) => sum + d.count, 0) / overviewStats.dailyExecutions.length)
            : 0,
        max: overviewStats?.dailyExecutions?.length
            ? Math.max(...overviewStats.dailyExecutions.map(d => d.count))
            : 0
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

    const statusStyles: Record<string, string> = {
        running: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        paused: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-light)]',
        error: 'bg-red-500/10 text-red-500 border-red-500/20'
    };

    if (entitiesLoading) {
        return (
            <div className="flex flex-col h-full bg-[var(--bg-primary)]">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-[#256A65]/20 border-t-[#256A65] rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm text-[var(--text-secondary)]">Loading your data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-tutorial="overview-content">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Stats Cards */}
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Active Workflows */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                                        <FlowArrow size={18} weight="light" />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-[var(--text-secondary)] mb-1">Active Workflows</p>
                                    <p className="text-2xl font-normal text-[var(--text-primary)]">
                                        {isLoadingStats ? '...' : (overviewStats?.activeWorkflows || 0)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Events Triggered */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                                        <Pulse size={18} weight="light" />
                                    </div>
                                    {overviewStats && overviewStats.eventsChange !== 0 && (
                                        <div className={`flex items-center gap-1 text-xs font-medium ${overviewStats.eventsChange > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {overviewStats.eventsChange > 0 ? (
                                                <ArrowUpRight size={12} weight="bold" />
                                            ) : (
                                                <ArrowDownRight size={12} weight="bold" />
                                            )}
                                            {overviewStats.eventsChange > 0 ? '+' : ''}{overviewStats.eventsChange.toFixed(1)}%
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-[var(--text-secondary)] mb-1">Executions (7 days)</p>
                                    <p className="text-2xl font-normal text-[var(--text-primary)]">
                                        {isLoadingStats ? '...' : (overviewStats?.eventsTriggered || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Entities */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                                        <Database size={18} weight="light" />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-[var(--text-secondary)] mb-1">Database Entities</p>
                                    <p className="text-2xl font-normal text-[var(--text-primary)]">{entities.length}</p>
                                </div>
                            </div>

                            {/* Copilot Sessions */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                                        <Robot size={18} weight="light" />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs text-[var(--text-secondary)] mb-1">Copilot Sessions</p>
                                    <p className="text-2xl font-normal text-[var(--text-primary)]">
                                        {isLoadingCopilots ? '...' : copilots.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Chart and Copilots */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
                                <div>
                                    <h2 className="text-sm font-medium text-[var(--text-primary)]">Workflow Activity</h2>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Last 7 days</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Mini Stats */}
                                    <div className="flex items-center gap-4 pr-4 border-r border-[var(--border-light)]">
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-[var(--text-primary)]">{chartStats.total}</p>
                                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Total</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-[var(--text-primary)]">{chartStats.average}</p>
                                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Avg/day</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                        <span className="inline-block w-2 h-2 rounded-full bg-[#419CAF]"></span>
                                        Executions
                                    </div>
                                </div>
                            </div>
                            
                            {/* Chart */}
                            <div className="p-4" style={{ minHeight: '220px' }}>
                                <DynamicChart config={overviewChartConfig} />
                            </div>
                        </div>

                        {/* Copilots Section */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Your Copilots</h2>
                                <button 
                                    onClick={() => navigate('/copilots')}
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    View all
                                </button>
                            </div>
                            <div className="space-y-3">
                                {isLoadingCopilots ? (
                                    <div className="text-center py-4 text-sm text-[var(--text-secondary)]">Loading...</div>
                                ) : copilots.length > 0 ? (
                                    copilots.map(copilot => (
                                        <div 
                                            key={copilot.id} 
                                            className="flex items-start gap-3 border border-[var(--border-light)] rounded-lg p-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer" 
                                            onClick={() => navigate(`/copilots?chatId=${copilot.id}`)}
                                        >
                                            <div className="p-2 bg-[#256A65]/10 rounded-lg flex-shrink-0">
                                                <Sparkle size={16} weight="fill" className="text-[#256A65]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-normal text-[var(--text-primary)] truncate">{copilot.title}</p>
                                                <p className="text-xs text-[var(--text-secondary)] truncate">{copilot.messageCount || 0} messages</p>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">{formatTimeAgo(copilot.updatedAt)}</p>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/copilots?chatId=${copilot.id}`);
                                                }}
                                                className="text-xs text-[#256A65] hover:text-[#1e5a55] flex-shrink-0 font-medium"
                                            >
                                                Open
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <Sparkle size={32} weight="light" className="text-[var(--text-tertiary)] mx-auto mb-3" />
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">No copilots yet</p>
                                        <button
                                            onClick={() => navigate('/copilots')}
                                            className="inline-flex items-center gap-1.5 text-xs text-[#256A65] hover:text-[#1e5a55] font-medium"
                                        >
                                            <Plus size={12} weight="bold" />
                                            Create your first copilot
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Recent Workflows Table */}
                    <section className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
                            <h2 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Recent Workflows</h2>
                            <button 
                                onClick={() => navigate('/workflows')}
                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                View all
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="text-[var(--text-secondary)]">
                                    <tr className="border-b border-[var(--border-light)]">
                                        <th className="px-4 py-2 font-medium">Name</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-4 py-2 font-medium">Last Run</th>
                                        <th className="px-4 py-2 font-medium">Executions</th>
                                        <th className="px-4 py-2 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingStats ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                                                Loading workflows...
                                            </td>
                                        </tr>
                                    ) : overviewStats && overviewStats.recentWorkflows && overviewStats.recentWorkflows.length > 0 ? (
                                        overviewStats.recentWorkflows
                                            .slice((workflowsPage - 1) * workflowsPerPage, workflowsPage * workflowsPerPage)
                                            .map(workflow => (
                                            <tr key={workflow.id} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                                                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{workflow.name}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusStyles[workflow.status] || statusStyles.paused}`}>
                                                        {workflow.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)]">{formatTimeAgo(workflow.lastExecutionAt)}</td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)]">{workflow.executionCount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button 
                                                        onClick={() => navigate(`/workflow/${workflow.id}`)}
                                                        className="text-xs text-[#256A65] hover:text-[#1e5a55] font-medium"
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center">
                                                <FlowArrow size={32} weight="light" className="text-[var(--text-tertiary)] mx-auto mb-3" />
                                                <p className="text-sm text-[var(--text-secondary)] mb-2">No workflows yet</p>
                                                <button
                                                    onClick={() => navigate('/workflows')}
                                                    className="inline-flex items-center gap-1.5 text-xs text-[#256A65] hover:text-[#1e5a55] font-medium"
                                                >
                                                    <Plus size={12} weight="bold" />
                                                    Create your first workflow
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        {overviewStats && overviewStats.recentWorkflows && overviewStats.recentWorkflows.length > workflowsPerPage && (
                            <div className="px-4 py-3 border-t border-[var(--border-light)] flex items-center justify-between">
                                <div className="text-xs text-[var(--text-secondary)]">
                                    Showing {(workflowsPage - 1) * workflowsPerPage + 1} to {Math.min(workflowsPage * workflowsPerPage, overviewStats.recentWorkflows.length)} of {overviewStats.recentWorkflows.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setWorkflowsPage(prev => Math.max(1, prev - 1))}
                                        disabled={workflowsPage === 1}
                                        className="p-1.5 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]"
                                    >
                                        <CaretLeft size={14} weight="bold" />
                                    </button>
                                    <span className="text-xs text-[var(--text-secondary)] px-2">
                                        Page {workflowsPage} of {Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage)}
                                    </span>
                                    <button
                                        onClick={() => setWorkflowsPage(prev => Math.min(Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage), prev + 1))}
                                        disabled={workflowsPage === Math.ceil(overviewStats.recentWorkflows.length / workflowsPerPage)}
                                        className="p-1.5 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]"
                                    >
                                        <CaretRight size={14} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
};
