import React, { useState, useEffect, useMemo } from 'react';
import {
    MagnifyingGlass, Funnel, Export, CaretDown, User, Clock,
    FlowArrow, Database, FileText, SquaresFour, Gear, SpinnerGap,
    ArrowClockwise, Shield, Users, Lightning, Sparkle, Flask,
    ChartLineUp, CalendarBlank, X, CaretLeft, CaretRight, Eye, EyeSlash
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
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

export const ActivityLog: React.FC = () => {
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

    // Fetch data
    useEffect(() => {
        fetchLogs();
        fetchStats();
        fetchFilters();
    }, [selectedAction, selectedResourceType, selectedUser, page]);

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
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 border border-[var(--border-light)] hover:border-[var(--accent-primary)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                >
                    <Export size={16} />
                    Export CSV
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Total Events (30d)
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">
                            {stats.total.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Most Common Action
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">
                            {stats.actionCounts[0]?.action || '—'}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Most Active User
                        </p>
                        <p className="text-2xl font-semibold text-[var(--text-primary)] truncate">
                            {stats.activeUsers[0]?.userName || '—'}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                            Activity Trend
                        </p>
                        {stats.dailyActivity.length > 0 && (
                            <ResponsiveContainer width="100%" height={40}>
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

            {/* Search and Filters */}
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
                        placeholder="Search by user, action, or resource..."
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
                    Filters
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
                        Clear all
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
                    <span className="hidden sm:inline">{showPII ? 'PII Visible' : 'PII Masked'}</span>
                </button>
            </div>

            {/* Filter Dropdowns */}
            {showFilters && (
                <div className="flex items-center gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl">
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Action</label>
                        <select
                            value={selectedAction}
                            onChange={(e) => { setSelectedAction(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">All actions</option>
                            {filters.actions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Resource Type</label>
                        <select
                            value={selectedResourceType}
                            onChange={(e) => { setSelectedResourceType(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">All resources</option>
                            {filters.resourceTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">User</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => { setSelectedUser(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="">All users</option>
                            {filters.users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Activity List */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <SpinnerGap size={32} className="animate-spin text-[var(--text-tertiary)]" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20">
                        <Shield size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                            No activity found
                        </h3>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {hasActiveFilters 
                                ? 'Try adjusting your filters' 
                                : 'Activity will appear here as users interact with the workspace'
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
                                                {log.userName || 'System'}
                                            </span>
                                            <span 
                                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ 
                                                    backgroundColor: `${actionConfig.color}15`,
                                                    color: actionConfig.color
                                                }}
                                            >
                                                {actionConfig.label}
                                            </span>
                                            {log.resourceName && (
                                                <>
                                                    <span className="text-[var(--text-tertiary)]">on</span>
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
                                                <span className="font-mono" title={showPII ? log.ipAddress : 'IP address masked'}>
                                                    IP: {showPII ? log.ipAddress : maskIP(log.ipAddress)}
                                                </span>
                                            )}
                                            {log.userEmail && (
                                                <span title={showPII ? log.userEmail : 'Email masked'}>
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
