import React, { useState, useEffect, useMemo } from 'react';
import {
    MagnifyingGlass, Funnel, Export, CaretDown, User, Clock,
    FlowArrow, Database, FileText, SquaresFour, Gear, SpinnerGap,
    ArrowClockwise, Shield, Users, Lightning, Sparkle, Flask,
    ChartLineUp, CalendarBlank, X, CaretLeft, CaretRight, Eye, EyeSlash, Cpu
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

// PII Masking utilities
const maskEmail = (email: string | null | undefined): string => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = localPart.length > 2 
        ? `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 2, 5))}${localPart[localPart.length - 1]}`
        : localPart[0] + '*';
    return `${maskedLocal}@${domain}`;
};

const maskIP = (ip: string | null | undefined): string => {
    if (!ip) return '';
    // IPv4
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***`;
        }
    }
    // IPv6 or other
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}:****:****`;
        }
    }
    // Localhost or unknown format
    if (ip === '::1' || ip === '127.0.0.1') return ip;
    return ip.substring(0, Math.min(ip.length, 6)) + '***';
};

const maskUserAgent = (ua: string | null | undefined): string => {
    if (!ua) return '';
    // Extract just the browser name and version
    const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s](\d+)/i);
    if (browserMatch) {
        return `${browserMatch[1]} ${browserMatch[2]}`;
    }
    // Fallback: show truncated
    return ua.length > 30 ? ua.substring(0, 30) + '...' : ua;
};

interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    action: string;
    resourceType: string;
    resourceId: string;
    resourceName: string;
    details: any;
    ipAddress: string;
    userAgent: string;
    createdAt: string;
}

interface AuditStats {
    total: number;
    actionCounts: { action: string; count: number }[];
    resourceCounts: { resourceType: string; count: number }[];
    activeUsers: { userId: string; userName: string; count: number }[];
    dailyActivity: { date: string; count: number }[];
}

interface Filters {
    actions: string[];
    resourceTypes: string[];
    users: { id: string; name: string }[];
}

// Action icons and colors
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    'create': { icon: Lightning, color: '#10B981', label: 'Created' },
    'update': { icon: ArrowClockwise, color: '#3B82F6', label: 'Updated' },
    'delete': { icon: X, color: '#EF4444', label: 'Deleted' },
    'login': { icon: User, color: '#8B5CF6', label: 'Login' },
    'logout': { icon: User, color: '#6B7280', label: 'Logout' },
    'view': { icon: MagnifyingGlass, color: '#F59E0B', label: 'Viewed' },
    'execute': { icon: Lightning, color: '#EC4899', label: 'Executed' },
    'share': { icon: Users, color: '#06B6D4', label: 'Shared' },
    'unshare': { icon: Users, color: '#64748B', label: 'Unshared' },
    'invite': { icon: Users, color: '#8B5CF6', label: 'Invited' },
    'export': { icon: Export, color: '#F97316', label: 'Exported' },
};

const ACTION_I18N_KEYS: Record<string, string> = {
    create: 'created', update: 'updated', delete: 'deleted', login: 'login', logout: 'logoutAction',
    view: 'viewed', execute: 'executed', share: 'shared', unshare: 'unshared', invite: 'invited', export: 'exported',
};

const RESOURCE_ICONS: Record<string, React.ElementType> = {
    'workflow': FlowArrow,
    'entity': Database,
    'report': FileText,
    'dashboard': SquaresFour,
    'user': User,
    'settings': Gear,
    'copilot': Sparkle,
    'lab': Flask,
    'document': FileText,
    'template': FileText,
};

interface AIAuditLog {
    id: string;
    userEmail: string;
    chatId: string;
    agentId: string;
    agentRole: string;
    model: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    durationMs: number;
    createdAt: string;
}

interface AIAuditStats {
    total: number;
    totalTokens: number;
    byRole: { agentRole: string; count: number; totalTokens: number }[];
    daily: { date: string; count: number; tokens: number }[];
}

export const ActivityLog: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'general' | 'ai'>('general');
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [filters, setFilters] = useState<Filters>({ actions: [], resourceTypes: [], users: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedResourceType, setSelectedResourceType] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [showPII, setShowPII] = useState(false); // PII masking toggle
    const pageSize = 50;

    const [aiLogs, setAiLogs] = useState<AIAuditLog[]>([]);
    const [aiStats, setAiStats] = useState<AIAuditStats | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // Fetch data
    useEffect(() => {
        if (activeTab === 'general') {
            fetchLogs();
            fetchStats();
            fetchFilters();
        }
    }, [activeTab, selectedAction, selectedResourceType, selectedUser, page]);

    useEffect(() => {
        if (activeTab === 'ai') {
            fetchAILogs();
            fetchAIStats();
        }
    }, [activeTab]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: String(pageSize),
                offset: String(page * pageSize),
                ...(selectedAction && { action: selectedAction }),
                ...(selectedResourceType && { resourceType: selectedResourceType }),
                ...(selectedUser && { userId: selectedUser }),
                ...(searchQuery && { search: searchQuery }),
            });

            const res = await fetch(`${API_BASE}/audit-logs?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
                setHasMore(data.length === pageSize);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAILogs = async () => {
        setAiLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai-audit-logs?limit=50&offset=0`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setAiLogs(data);
            }
        } catch (error) {
            console.error('Error fetching AI audit logs:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const fetchAIStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/ai-audit-logs/stats?days=30`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setAiStats(data);
            }
        } catch (error) {
            console.error('Error fetching AI stats:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/audit-logs/stats?days=30`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchFilters = async () => {
        try {
            const res = await fetch(`${API_BASE}/audit-logs/filters`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setFilters(data);
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams({
                ...(selectedAction && { action: selectedAction }),
                ...(selectedResourceType && { resourceType: selectedResourceType }),
            });

            window.open(`${API_BASE}/audit-logs/export?${params}`, '_blank');
        } catch (error) {
            console.error('Error exporting logs:', error);
        }
    };

    const handleSearch = () => {
        setPage(0);
        fetchLogs();
    };

    const clearFilters = () => {
        setSelectedAction('');
        setSelectedResourceType('');
        setSelectedUser('');
        setSearchQuery('');
        setPage(0);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getActionConfig = (action: string) => {
        return ACTION_CONFIG[action.toLowerCase()] || { 
            icon: Lightning, 
            color: '#6B7280', 
            label: action 
        };
    };

    const getResourceIcon = (resourceType: string) => {
        return RESOURCE_ICONS[resourceType.toLowerCase()] || Database;
    };

    const hasActiveFilters = selectedAction || selectedResourceType || selectedUser || searchQuery;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Shield size={24} className="text-[var(--accent-primary)]" />
                        Activity Log
                    </h1>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                        Track all actions and changes in your workspace
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-[var(--border-light)] p-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {t('activity.tabActivity')}
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${activeTab === 'ai' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <Cpu size={14} />
                            {t('activity.tabAI')}
                        </button>
                    </div>
                    {activeTab === 'general' && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 border border-[var(--border-light)] hover:border-[var(--accent-primary)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                        >
                            <Export size={16} />
                            {t('activity.exportCsv')}
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            {activeTab === 'general' && stats && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            {t('activity.totalEvents')}
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">
                            {stats.total.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            {t('activity.mostCommonAction')}
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">
                            {stats.actionCounts[0]?.action || '—'}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            {t('activity.mostActiveUser')}
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)] truncate">
                            {stats.activeUsers[0]?.userName || '—'}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                            {t('activity.activityTrend')}
                        </p>
                        {stats.dailyActivity.length > 0 && (
                            <ResponsiveContainer width="100%" height={40} minWidth={100} minHeight={40}>
                                <AreaChart data={stats.dailyActivity}>
                                    <defs>
                                        <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area 
                                        type="monotone" 
                                        dataKey="count" 
                                        stroke="var(--accent-primary)" 
                                        strokeWidth={2}
                                        fill="url(#activityGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}

            {/* AI Tab: PII toggle row */}
            {activeTab === 'ai' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowPII(!showPII)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
                            showPII ? 'border-amber-500/50 bg-amber-500/10 text-amber-500' : 'border-[var(--border-light)] text-[var(--text-secondary)]'
                        }`}
                    >
                        {showPII ? <Eye size={16} /> : <EyeSlash size={16} />}
                        {showPII ? t('activity.piiVisible') : t('activity.piiMasked')}
                    </button>
                </div>
            )}

            {/* AI Stats (when AI tab active) */}
            {activeTab === 'ai' && aiStats && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('activity.aiCalls')}</p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">{aiStats.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('activity.totalTokens')}</p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">{aiStats.totalTokens?.toLocaleString() || '0'}</p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('activity.mostUsedRole')}</p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">{aiStats.byRole?.[0]?.agentRole || '—'}</p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{t('activity.trend')}</p>
                        {aiStats.daily?.length > 0 && (
                            <ResponsiveContainer width="100%" height={40} minWidth={100} minHeight={40}>
                                <AreaChart data={aiStats.daily}>
                                    <defs>
                                        <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} fill="url(#aiGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}

            {/* Search and Filters (General tab only) */}
            {activeTab === 'general' && (
            <>
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlass 
                        size={16} 
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" 
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={t('activity.searchPlaceholder')}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                        hasActiveFilters
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                            : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'
                    }`}
                >
                    <Funnel size={16} />
                    {t('common.filters')}
                    {hasActiveFilters && (
                        <span className="w-5 h-5 bg-[var(--accent-primary)] text-white text-xs rounded-full flex items-center justify-center">
                            {[selectedAction, selectedResourceType, selectedUser].filter(Boolean).length}
                        </span>
                    )}
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                        {t('common.clearAll')}
                    </button>
                )}

                {/* PII Masking Toggle */}
                <button
                    onClick={() => setShowPII(!showPII)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ml-auto ${
                        showPII
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                            : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'
                    }`}
                    title={showPII ? 'PII visible - Click to mask sensitive data' : 'PII masked - Click to reveal sensitive data'}
                >
                    {showPII ? <Eye size={16} /> : <EyeSlash size={16} />}
                    <span className="hidden sm:inline">{showPII ? t('activity.piiVisible') : t('activity.piiMasked')}</span>
                </button>
            </div>

            {/* Filter Dropdowns */}
            {showFilters && (
                <div className="flex items-center gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl">
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">{t('activity.action')}</label>
                        <select
                            value={selectedAction}
                            onChange={(e) => { setSelectedAction(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">{t('activity.allActions')}</option>
                            {filters.actions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">{t('activity.resourceType')}</label>
                        <select
                            value={selectedResourceType}
                            onChange={(e) => { setSelectedResourceType(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">{t('activity.allResources')}</option>
                            {filters.resourceTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">{t('common.user')}</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => { setSelectedUser(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">{t('activity.allUsers')}</option>
                            {filters.users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            </>
            )}

            {/* Activity List */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
                {activeTab === 'ai' ? (
                    aiLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <SpinnerGap size={32} className="animate-spin text-[var(--text-tertiary)]" />
                        </div>
                    ) : aiLogs.length === 0 ? (
                        <div className="text-center py-20">
                            <Cpu size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">{t('activity.noAiCalls')}</h3>
                            <p className="text-sm text-[var(--text-tertiary)]">{t('activity.aiCallsWillAppear')}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-light)]">
                            {aiLogs.map((log) => (
                                <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-tertiary)]">
                                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                        <Cpu size={18} className="text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--text-primary)]">{log.agentRole}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">{log.model} · {log.tokensTotal} tokens · {log.durationMs}ms</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-[var(--text-tertiary)]">{log.userEmail ? (showPII ? log.userEmail : maskEmail(log.userEmail)) : '—'}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">{formatDate(log.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <SpinnerGap size={32} className="animate-spin text-[var(--text-tertiary)]" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20">
                        <Shield size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                            {t('activity.noActivity')}
                        </h3>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {hasActiveFilters 
                                ? t('activity.adjustFilters') 
                                : t('activity.activityWillAppear')
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-light)]">
                        {logs.map((log) => {
                            const actionConfig = getActionConfig(log.action);
                            const ResourceIcon = getResourceIcon(log.resourceType);
                            const ActionIcon = actionConfig.icon;

                            return (
                                <div 
                                    key={log.id}
                                    className="flex items-start gap-4 p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                    {/* Action Icon */}
                                    <div 
                                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${actionConfig.color}15` }}
                                    >
                                        <ActionIcon size={18} style={{ color: actionConfig.color }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-[var(--text-primary)]">
                                                {log.userName || t('common.system')}
                                            </span>
                                            <span 
                                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ 
                                                    backgroundColor: `${actionConfig.color}15`,
                                                    color: actionConfig.color
                                                }}
                                            >
                                                {ACTION_I18N_KEYS[log.action.toLowerCase()] ? t(`activity.${ACTION_I18N_KEYS[log.action.toLowerCase()]}`) : actionConfig.label}
                                            </span>
                                            {log.resourceName && (
                                                <>
                                                    <span className="text-[var(--text-tertiary)]">{t('common.on')}</span>
                                                    <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                                                        <ResourceIcon size={14} />
                                                        {log.resourceName}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Details */}
                                        {log.details && (
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-1">
                                                {typeof log.details === 'string' 
                                                    ? log.details 
                                                    : JSON.stringify(log.details)
                                                }
                                            </p>
                                        )}

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {formatDate(log.createdAt)}
                                            </span>
                                            {log.ipAddress && (
                                                <span className="font-mono" title={showPII ? log.ipAddress : t('activity.ipMasked')}>
                                                    IP: {showPII ? log.ipAddress : maskIP(log.ipAddress)}
                                                </span>
                                            )}
                                            {log.userEmail && (
                                                <span title={showPII ? log.userEmail : t('activity.emailMasked')}>
                                                    {showPII ? log.userEmail : maskEmail(log.userEmail)}
                                                </span>
                                            )}
                                            <span className="capitalize">
                                                {log.resourceType}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {logs.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                        <span className="text-sm text-[var(--text-tertiary)]">
                            Showing {page * pageSize + 1} - {page * pageSize + logs.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <CaretLeft size={16} className="text-[var(--text-secondary)]" />
                            </button>
                            <span className="text-sm text-[var(--text-secondary)]">
                                Page {page + 1}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!hasMore}
                                className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <CaretRight size={16} className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLog;
