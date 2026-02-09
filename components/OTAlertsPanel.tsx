/**
 * OT Alerts Panel Component
 * Displays active OT alerts and allows acknowledgment
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Warning, 
    CheckCircle, 
    XCircle, 
    Clock, 
    SpinnerGap,
    Funnel,
    X,
    ArrowClockwise,
    Download,
    CheckSquare,
    Bell,
    BellSlash
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface OTAlert {
    id: string;
    nodeId: string;
    nodeType: string;
    fieldName: string;
    value: number;
    threshold: {
        min?: number;
        max?: number;
        operator: string;
    };
    severity: 'error' | 'warning';
    message: string;
    createdAt: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    metadata?: any;
}

interface OTAlertsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId?: string;
    nodeId?: string;
}

export const OTAlertsPanel: React.FC<OTAlertsPanelProps> = ({
    isOpen,
    onClose,
    workflowId,
    nodeId,
}) => {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState<OTAlert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
    const [filterAcknowledged, setFilterAcknowledged] = useState<'all' | 'true' | 'false'>('false');
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const wsRef = useRef<WebSocket | null>(null);
    const notificationPermissionRef = useRef<NotificationPermission | null>(null);

    // Request notification permission when panel opens
    useEffect(() => {
        if (!isOpen) return;
        
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                notificationPermissionRef.current = permission;
            });
        } else if ('Notification' in window) {
            notificationPermissionRef.current = Notification.permission;
        }
    }, [isOpen]);

    // WebSocket connection for real-time alerts (optional - falls back to polling)
    useEffect(() => {
        if (!isOpen || !user?.orgId) return;

        // Only attempt WebSocket in production or if explicitly enabled
        const enableWebSocket = window.location.hostname !== 'localhost' || 
                                import.meta.env.VITE_ENABLE_WEBSOCKET === 'true';
        
        if (!enableWebSocket) {
            // Skip WebSocket in development - rely on polling instead
            return;
        }

        // Build WebSocket URL
        const getWsUrl = () => {
            if (window.location.protocol === 'https:') {
                return `wss://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/ws`;
            }
            return `ws://${window.location.hostname}:3001/ws`;
        };

        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;

        const connect = () => {
            try {
                const wsUrl = getWsUrl();
                ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    // Subscribe to OT alerts for the organization
                    ws?.send(JSON.stringify({
                        type: 'subscribe_ot_alerts',
                        orgId: user.orgId,
                        user: {
                            id: user.id,
                            name: user.name || user.email?.split('@')[0] || 'Anonymous',
                            email: user.email
                        }
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        
                        if (message.type === 'ot_alert' && message.alert) {
                            const newAlert = {
                                id: message.alert.id,
                                nodeId: message.alert.nodeId,
                                nodeType: message.alert.nodeType,
                                fieldName: message.alert.fieldName,
                                value: message.alert.value,
                                threshold: message.alert.threshold,
                                severity: message.alert.severity,
                                message: message.alert.message,
                                createdAt: message.alert.timestamp,
                                acknowledgedAt: undefined,
                                acknowledgedBy: undefined
                            };
                            
                            // New alert received, add to list
                            setAlerts(prev => {
                                // Check if alert already exists
                                const exists = prev.some(a => a.id === newAlert.id);
                                if (exists) return prev;
                                
                                // Add new alert at the beginning
                                return [newAlert, ...prev];
                            });
                            
                            // Show browser notification for critical alerts
                            if (newAlert.severity === 'error' && 'Notification' in window) {
                                const permission = notificationPermissionRef.current || Notification.permission;
                                if (permission === 'granted') {
                                    try {
                                        new Notification(`OT Alert: ${newAlert.nodeType.toUpperCase()} - ${newAlert.fieldName}`, {
                                            body: newAlert.message,
                                            icon: '/logo.png',
                                            tag: `ot-alert-${newAlert.id}`,
                                            requireInteraction: false,
                                            badge: '/logo.png'
                                        });
                                    } catch (error) {
                                        // Silently fail for notification errors
                                    }
                                }
                            }
                            
                            // Update last refresh time
                            setLastRefresh(new Date());
                        }
                    } catch (error) {
                        // Silently fail for parse errors
                    }
                };

                ws.onerror = () => {
                    // Silently handle WebSocket errors - fall back to polling
                };

                ws.onclose = () => {
                    // Don't auto-reconnect to avoid spam - polling is the fallback
                };
            } catch (error) {
                // WebSocket not available - rely on polling
            }
        };

        connect();

        return () => {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [isOpen, user?.orgId]);

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
            // Auto-refresh every 30 seconds (as fallback if WebSocket fails)
            const interval = setInterval(fetchAlerts, 30000);
            return () => clearInterval(interval);
        }
    }, [isOpen, filterSeverity, filterAcknowledged, workflowId, nodeId]);

    const fetchAlerts = async () => {
        setIsLoading(true);
        setApiError(null);
        try {
            const params = new URLSearchParams();
            if (filterSeverity !== 'all') {
                params.append('severity', filterSeverity);
            }
            if (filterAcknowledged !== 'all') {
                params.append('acknowledged', filterAcknowledged);
            }
            params.append('limit', '100');

            const res = await fetch(`${API_BASE}/ot-alerts?${params.toString()}`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                let filteredAlerts = data;

                // Filter by workflow/node if specified
                if (workflowId || nodeId) {
                    filteredAlerts = data.filter((alert: OTAlert) => {
                        if (nodeId && alert.nodeId !== nodeId) return false;
                        // Note: We'd need workflowId in alert metadata to filter by workflow
                        return true;
                    });
                }

                setAlerts(filteredAlerts);
                setLastRefresh(new Date());
            } else if (res.status === 500) {
                // Server error - OT alerts endpoint may not be configured
                setApiError('OT Alerts service not available. This feature requires backend configuration.');
                setAlerts([]);
            } else {
                setApiError(`Failed to load alerts (${res.status})`);
            }
        } catch (error) {
            // Network error or server not running
            setApiError('Cannot connect to alerts service. Server may be offline.');
            setAlerts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcknowledge = useCallback(async (alertId: string) => {
        try {
            const res = await fetch(`${API_BASE}/ot-alerts/${alertId}/acknowledge`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                // Update local state
                setAlerts(prev => prev.map(a =>
                    a.id === alertId
                        ? { ...a, acknowledgedAt: new Date().toISOString() }
                        : a
                ));
            }
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            window.alert('Failed to acknowledge alert');
        }
    }, []);

    const getSeverityIcon = (severity: string) => {
        if (severity === 'error') {
            return <XCircle size={18} className="text-red-500" weight="fill" />;
        }
        return <Warning size={18} className="text-amber-500" weight="fill" />;
    };

    const getSeverityBadge = (severity: string) => {
        if (severity === 'error') {
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        }
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    };

    const formatTimeAgo = (dateString: string) => {
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

    const filteredAlerts = alerts.filter(alert => {
        if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
        if (filterAcknowledged === 'true' && !alert.acknowledgedAt) return false;
        if (filterAcknowledged === 'false' && alert.acknowledgedAt) return false;
        return true;
    });

    const unacknowledgedCount = alerts.filter(a => !a.acknowledgedAt).length;
    const errorCount = alerts.filter(a => a.severity === 'error' && !a.acknowledgedAt).length;

    // Export alerts to CSV
    const handleExportCSV = useCallback(() => {
        if (filteredAlerts.length === 0) return;
        
        const exportData = filteredAlerts.map(alert => ({
            ID: alert.id,
            Severity: alert.severity,
            'Node Type': alert.nodeType,
            Field: alert.fieldName,
            Value: alert.value,
            Message: alert.message,
            'Created At': new Date(alert.createdAt).toLocaleString(),
            Acknowledged: alert.acknowledgedAt ? 'Yes' : 'No',
            'Acknowledged At': alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleString() : ''
        }));
        
        const headers = Object.keys(exportData[0]);
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => 
                headers.map(h => {
                    const value = row[h as keyof typeof row];
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value}"`;
                    }
                    return value ?? '';
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ot_alerts_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [filteredAlerts]);

    // Acknowledge all unacknowledged alerts
    const handleAcknowledgeAll = useCallback(async () => {
        const unacknowledged = filteredAlerts.filter(a => !a.acknowledgedAt);
        if (unacknowledged.length === 0) return;
        
        const confirmMsg = `Are you sure you want to acknowledge ${unacknowledged.length} alerts?`;
        if (!window.confirm(confirmMsg)) return;
        
        for (const a of unacknowledged) {
            await handleAcknowledge(a.id);
        }
    }, [filteredAlerts, handleAcknowledge]);

    // Early return AFTER all hooks to comply with Rules of Hooks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div 
                className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <Warning size={24} className="text-red-500" weight="fill" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                OT Alerts
                            </h2>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                {unacknowledgedCount} unacknowledged • {errorCount} errors
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {unacknowledgedCount > 0 && (
                            <button
                                onClick={handleAcknowledgeAll}
                                className="px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1"
                                title="Acknowledge all visible alerts"
                            >
                                <CheckSquare size={14} />
                                Ack All ({unacknowledgedCount})
                            </button>
                        )}
                        <button
                            onClick={handleExportCSV}
                            disabled={filteredAlerts.length === 0}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                            title="Export to CSV"
                        >
                            <Download size={18} />
                        </button>
                        <button
                            onClick={fetchAlerts}
                            disabled={isLoading}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <ArrowClockwise size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Funnel size={14} className="text-[var(--text-tertiary)]" />
                            <span className="text-xs font-medium text-[var(--text-secondary)]">Filters:</span>
                        </div>
                        <select
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value as any)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="all">All Severities</option>
                            <option value="error">Errors Only</option>
                            <option value="warning">Warnings Only</option>
                        </select>
                        <select
                            value={filterAcknowledged}
                            onChange={(e) => setFilterAcknowledged(e.target.value as any)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="all">All</option>
                            <option value="false">Unacknowledged</option>
                            <option value="true">Acknowledged</option>
                        </select>
                        <div className="ml-auto text-xs text-[var(--text-tertiary)]">
                            Last refresh: {formatTimeAgo(lastRefresh.toISOString())}
                        </div>
                    </div>
                </div>

                {/* Alerts List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {isLoading && alerts.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <SpinnerGap size={24} className="text-[var(--text-tertiary)] animate-spin" />
                        </div>
                    ) : apiError ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Warning size={48} className="text-[var(--accent-warning)] mb-3" weight="light" />
                            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                Service Unavailable
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                                {apiError}
                            </p>
                            <button
                                onClick={fetchAlerts}
                                className="mt-4 px-4 py-2 text-xs font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredAlerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle size={48} className="text-green-500 mb-3" weight="light" />
                            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                No alerts found
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                                {filterSeverity !== 'all' || filterAcknowledged !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'All systems operating normally'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-4 rounded-lg border ${
                                        alert.acknowledgedAt
                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-light)] opacity-60'
                                            : alert.severity === 'error'
                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            {getSeverityIcon(alert.severity)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityBadge(alert.severity)}`}>
                                                        {alert.severity.toUpperCase()}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-tertiary)]">
                                                        {alert.nodeType.toUpperCase()}
                                                    </span>
                                                    {alert.acknowledgedAt && (
                                                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                                            <CheckCircle size={12} weight="fill" />
                                                            Acknowledged
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                                    {alert.fieldName}
                                                </p>
                                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                                    {alert.message}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} weight="light" />
                                                        {formatTimeAgo(alert.createdAt)}
                                                    </span>
                                                    <span>
                                                        Value: <span className="font-mono font-medium text-[var(--text-primary)]">{alert.value}</span>
                                                    </span>
                                                    {alert.threshold && (
                                                        <span>
                                                            Threshold: {alert.threshold.min !== undefined && `${alert.threshold.min} ≤ `}
                                                            {alert.threshold.operator === 'range' && 'value ≤ '}
                                                            {alert.threshold.max !== undefined && alert.threshold.max}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!alert.acknowledgedAt && (
                                            <button
                                                onClick={() => handleAcknowledge(alert.id)}
                                                className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
                                            >
                                                <CheckCircle size={14} weight="fill" />
                                                Acknowledge
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                    <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                        <span>
                            Showing {filteredAlerts.length} of {alerts.length} alerts
                        </span>
                        <div className="flex items-center gap-4">
                            <span className={`flex items-center gap-1 ${
                                notificationPermissionRef.current === 'granted' ? 'text-green-500' : 'text-gray-500'
                            }`}>
                                {notificationPermissionRef.current === 'granted' ? (
                                    <><Bell size={12} /> Notifications on</>
                                ) : (
                                    <><BellSlash size={12} /> Notifications off</>
                                )}
                            </span>
                            <span className={`flex items-center gap-1 ${
                                wsRef.current?.readyState === WebSocket.OPEN ? 'text-green-500' : 'text-gray-500'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                    wsRef.current?.readyState === WebSocket.OPEN ? 'bg-green-500' : 'bg-gray-500'
                                }`} />
                                {wsRef.current?.readyState === WebSocket.OPEN ? 'Real-time' : 'Polling'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
