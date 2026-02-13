import React, { useState, useEffect } from 'react';
import {
    MagnifyingGlass, Funnel, Export, CaretDown, User, Clock,
    FlowArrow, Database, FileText, SquaresFour, Gear, SpinnerGap,
    ArrowClockwise, Shield, Users, Lightning, Sparkle, Flask,
    CalendarBlank, X, CaretLeft, CaretRight, Eye, EyeSlash, Cpu
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

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
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***`;
        }
    }
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}:****:****`;
        }
    }
    if (ip === '::1' || ip === '127.0.0.1') return ip;
    return ip.substring(0, Math.min(ip.length, 6)) + '***';
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
    const [showPII, setShowPII] = useState(false);
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

    // --- Stats cards for General tab ---
    const renderGeneralStats = () => {
        if (!stats) return null;
        const statItems = [
            {
                label: t('activity.totalEvents'),
                value: stats.total.toLocaleString(),
                sub: '30d',
            },
            {
                label: t('activity.mostCommonAction'),
                value: stats.actionCounts[0]?.action || '\u2014',
            },
            {
                label: t('activity.mostActiveUser'),
                value: stats.activeUsers[0]?.userName || '\u2014',
                truncate: true,
            },
        ];

        return (
            <div className="grid grid-cols-4 gap-3">
                {statItems.map((item, i) => (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                            {item.label} {item.sub && <span className="text-[var(--text-tertiary)]/60">({item.sub})</span>}
                        </p>
                        <p className={`text-lg font-normal text-[var(--text-primary)] ${item.truncate ? 'truncate' : ''}`}>
                            {item.value}
                        </p>
                    </div>
                ))}
                <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                    <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                        {t('activity.activityTrend')}
                    </p>
                    {stats.dailyActivity.length > 0 ? (
                        <ResponsiveContainer width="100%" height={36} minWidth={80} minHeight={36}>
                            <AreaChart data={stats.dailyActivity}>
                                <defs>
                                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="var(--accent-primary)" 
                                    strokeWidth={1.5}
                                    fill="url(#activityGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-[var(--text-tertiary)]">&mdash;</p>
                    )}
                </div>
            </div>
        );
    };

    // --- Stats cards for AI tab ---
    const renderAIStats = () => {
        if (!aiStats) return null;
        const statItems = [
            { label: t('activity.aiCalls'), value: aiStats.total.toLocaleString() },
            { label: t('activity.totalTokens'), value: aiStats.totalTokens?.toLocaleString() || '0' },
            { label: t('activity.mostUsedRole'), value: aiStats.byRole?.[0]?.agentRole || '\u2014' },
        ];

        return (
            <div className="grid grid-cols-4 gap-3">
                {statItems.map((item, i) => (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{item.label}</p>
                        <p className="text-lg font-normal text-[var(--text-primary)]">{item.value}</p>
                    </div>
                ))}
                <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                    <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{t('activity.trend')}</p>
                    {aiStats.daily?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={36} minWidth={80} minHeight={36}>
                            <AreaChart data={aiStats.daily}>
                                <defs>
                                    <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={1.5} fill="url(#aiGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-[var(--text-tertiary)]">&mdash;</p>
                    )}
                </div>
            </div>
        );
    };

    // --- Search & Filters bar ---
    const renderSearchBar = () => (
        <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass 
                    size={15} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" 
                />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t('activity.searchPlaceholder')}
                    className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
                />
            </div>

            <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                    hasActiveFilters
                        ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5 text-[var(--accent-primary)]'
                        : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
                }`}
            >
                <Funnel size={14} weight="light" />
                {t('common.filters')}
                {hasActiveFilters && (
                    <span className="w-4 h-4 bg-[var(--accent-primary)] text-white text-[10px] rounded-full flex items-center justify-center leading-none">
                        {[selectedAction, selectedResourceType, selectedUser].filter(Boolean).length}
                    </span>
                )}
            </button>

            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                    {t('common.clearAll')}
                </button>
            )}

            {/* PII Toggle */}
            <button
                onClick={() => setShowPII(!showPII)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ml-auto ${
                    showPII
                        ? 'border-amber-500/30 bg-amber-500/5 text-amber-600'
                        : 'border-[var(--border-light)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
                title={showPII ? 'PII visible - Click to mask' : 'PII masked - Click to reveal'}
            >
                {showPII ? <Eye size={14} /> : <EyeSlash size={14} />}
                <span className="hidden sm:inline text-xs">
                    {showPII ? t('activity.piiVisible') : t('activity.piiMasked')}
                </span>
            </button>
        </div>
    );

    // --- Filter dropdowns ---
    const renderFilterDropdowns = () => {
        if (!showFilters) return null;
        return (
            <div className="flex items-end gap-3 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-xl">
                <div className="flex-1">
                    <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('activity.action')}</label>
                    <select
                        value={selectedAction}
                        onChange={(e) => { setSelectedAction(e.target.value); setPage(0); }}
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                        <option value="">{t('activity.allActions')}</option>
                        {filters.actions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('activity.resourceType')}</label>
                    <select
                        value={selectedResourceType}
                        onChange={(e) => { setSelectedResourceType(e.target.value); setPage(0); }}
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                        <option value="">{t('activity.allResources')}</option>
                        {filters.resourceTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('common.user')}</label>
                    <select
                        value={selectedUser}
                        onChange={(e) => { setSelectedUser(e.target.value); setPage(0); }}
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                        <option value="">{t('activity.allUsers')}</option>
                        {filters.users.map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        );
    };

    // --- Empty state ---
    const renderEmptyState = (icon: React.ElementType, title: string, subtitle: string) => {
        const Icon = icon;
        return (
            <div className="text-center py-16">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
                    <Icon size={24} className="text-[var(--text-tertiary)]" />
                </div>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</h3>
                <p className="text-xs text-[var(--text-tertiary)] max-w-xs mx-auto">{subtitle}</p>
            </div>
        );
    };

    // --- Loading state ---
    const renderLoading = () => (
        <div className="flex items-center justify-center py-16">
            <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
    );

    // --- General log row ---
    const renderLogRow = (log: AuditLog) => {
        const actionConfig = getActionConfig(log.action);
        const ResourceIcon = getResourceIcon(log.resourceType);
        const ActionIcon = actionConfig.icon;

        return (
            <div 
                key={log.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            >
                {/* Action Icon */}
                <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${actionConfig.color}10` }}
                >
                    <ActionIcon size={15} style={{ color: actionConfig.color }} weight="light" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            {log.userName || t('common.system')}
                        </span>
                        <span 
                            className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ 
                                backgroundColor: `${actionConfig.color}10`,
                                color: actionConfig.color
                            }}
                        >
                            {ACTION_I18N_KEYS[log.action.toLowerCase()] 
                                ? t(`activity.${ACTION_I18N_KEYS[log.action.toLowerCase()]}`) 
                                : actionConfig.label}
                        </span>
                        {log.resourceName && (
                            <>
                                <span className="text-xs text-[var(--text-tertiary)]">{t('common.on')}</span>
                                <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                                    <ResourceIcon size={12} weight="light" />
                                    {log.resourceName}
                                </span>
                            </>
                        )}
                    </div>

                    {log.details && (
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
                            {typeof log.details === 'string' 
                                ? log.details 
                                : JSON.stringify(log.details)
                            }
                        </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDate(log.createdAt)}
                        </span>
                        {log.ipAddress && (
                            <span className="font-mono">
                                {showPII ? log.ipAddress : maskIP(log.ipAddress)}
                            </span>
                        )}
                        {log.userEmail && (
                            <span>{showPII ? log.userEmail : maskEmail(log.userEmail)}</span>
                        )}
                        <span className="capitalize">{log.resourceType}</span>
                    </div>
                </div>
            </div>
        );
    };

    // --- AI log row ---
    const renderAILogRow = (log: AIAuditLog) => (
        <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/5 flex items-center justify-center flex-shrink-0">
                <Cpu size={15} className="text-[var(--accent-primary)]" weight="light" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{log.agentRole}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {log.model} &middot; {log.tokensTotal?.toLocaleString()} tokens &middot; {log.durationMs}ms
                </p>
            </div>
            <div className="text-right shrink-0">
                <p className="text-[11px] text-[var(--text-tertiary)]">
                    {log.userEmail ? (showPII ? log.userEmail : maskEmail(log.userEmail)) : '\u2014'}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)]">{formatDate(log.createdAt)}</p>
            </div>
        </div>
    );

    // --- Pagination ---
    const renderPagination = () => {
        if (logs.length === 0) return null;
        return (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-light)]">
                <span className="text-[11px] text-[var(--text-tertiary)]">
                    {page * pageSize + 1} - {page * pageSize + logs.length}
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <CaretLeft size={14} className="text-[var(--text-secondary)]" />
                    </button>
                    <span className="text-xs text-[var(--text-secondary)] px-2">
                        {page + 1}
                    </span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={!hasMore}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <CaretRight size={14} className="text-[var(--text-secondary)]" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 
                        className="text-lg font-normal text-[var(--text-primary)]"
                        style={{ fontFamily: "'Berkeley Mono', monospace" }}
                    >
                        {t('settings.activityLog')}
                    </h2>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Track all actions and changes in your workspace
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Tab switcher - pill style like Settings */}
                    <div className="flex gap-0.5 bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-light)]">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                activeTab === 'general' 
                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' 
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Shield size={13} weight="light" />
                            {t('activity.tabActivity')}
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                activeTab === 'ai' 
                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' 
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Cpu size={13} weight="light" />
                            {t('activity.tabAI')}
                        </button>
                    </div>

                    {/* Export button */}
                    {activeTab === 'general' && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-light)] hover:border-[var(--border-medium)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <Export size={14} weight="light" />
                            {t('activity.exportCsv')}
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            {activeTab === 'general' && renderGeneralStats()}
            {activeTab === 'ai' && renderAIStats()}

            {/* Search & Filters (General tab) */}
            {activeTab === 'general' && renderSearchBar()}
            {activeTab === 'general' && renderFilterDropdowns()}

            {/* AI tab PII toggle (when no search bar) */}
            {activeTab === 'ai' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowPII(!showPII)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                            showPII
                                ? 'border-amber-500/30 bg-amber-500/5 text-amber-600'
                                : 'border-[var(--border-light)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        {showPII ? <Eye size={14} /> : <EyeSlash size={14} />}
                        <span className="text-xs">{showPII ? t('activity.piiVisible') : t('activity.piiMasked')}</span>
                    </button>
                </div>
            )}

            {/* Log List */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
                {activeTab === 'ai' ? (
                    aiLoading ? renderLoading() :
                    aiLogs.length === 0 ? renderEmptyState(Cpu, t('activity.noAiCalls'), t('activity.aiCallsWillAppear')) :
                    <div className="divide-y divide-[var(--border-light)]/50">
                        {aiLogs.map(renderAILogRow)}
                    </div>
                ) : isLoading ? renderLoading() :
                logs.length === 0 ? renderEmptyState(
                    Shield,
                    t('activity.noActivity'),
                    hasActiveFilters ? t('activity.adjustFilters') : t('activity.activityWillAppear')
                ) : (
                    <div className="divide-y divide-[var(--border-light)]/50">
                        {logs.map(renderLogRow)}
                    </div>
                )}

                {activeTab === 'general' && renderPagination()}
            </div>
        </div>
    );
};

export default ActivityLog;
