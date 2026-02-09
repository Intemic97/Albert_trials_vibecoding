/**
 * OT Activity Log Component
 * Shows real-time activity feed for OT systems
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ClockCounterClockwise,
    Warning,
    CheckCircle,
    XCircle,
    PlugsConnected,
    Lightning,
    Bell,
    ArrowClockwise,
    Funnel,
    X,
    Download,
    CaretDown
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface ActivityEvent {
    id: string;
    type: 'alert' | 'connection_change' | 'test' | 'acknowledge' | 'config_change';
    severity: 'info' | 'warning' | 'error' | 'success';
    title: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

interface OTActivityLogProps {
    isOpen: boolean;
    onClose: () => void;
    maxEvents?: number;
}

export const OTActivityLog: React.FC<OTActivityLogProps> = ({
    isOpen,
    onClose,
    maxEvents = 100
}) => {
    const { user } = useAuth();
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterType, setFilterType] = useState<'all' | ActivityEvent['type']>('all');
    const [filterSeverity, setFilterSeverity] = useState<'all' | ActivityEvent['severity']>('all');
    const wsRef = useRef<WebSocket | null>(null);

    // Generate initial events from alerts and connections
    const fetchInitialEvents = useCallback(async () => {
        setIsLoading(true);
        try {
            const [alertsRes, connectionsRes] = await Promise.all([
                fetch(`${API_BASE}/ot-alerts?limit=50`, { credentials: 'include' }),
                fetch(`${API_BASE}/data-connections`, { credentials: 'include' })
            ]);

            const newEvents: ActivityEvent[] = [];

            if (alertsRes.ok) {
                const alerts = await alertsRes.json();
                alerts.forEach((alert: any) => {
                    newEvents.push({
                        id: `alert_${alert.id}`,
                        type: 'alert',
                        severity: alert.severity === 'error' ? 'error' : 'warning',
                        title: `Alert: ${alert.fieldName}`,
                        description: alert.message,
                        timestamp: alert.createdAt,
                        metadata: { alertId: alert.id, nodeType: alert.nodeType }
                    });

                    if (alert.acknowledgedAt) {
                        newEvents.push({
                            id: `ack_${alert.id}`,
                            type: 'acknowledge',
                            severity: 'success',
                            title: 'Alert Acknowledged',
                            description: `Alert for ${alert.fieldName} was acknowledged`,
                            timestamp: alert.acknowledgedAt,
                            metadata: { alertId: alert.id }
                        });
                    }
                });
            }

            if (connectionsRes.ok) {
                const connections = await connectionsRes.json();
                const otTypes = ['opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian'];
                connections
                    .filter((c: any) => otTypes.includes(c.type))
                    .forEach((conn: any) => {
                        if (conn.lastTestedAt) {
                            newEvents.push({
                                id: `test_${conn.id}_${conn.lastTestedAt}`,
                                type: 'test',
                                severity: conn.status === 'active' ? 'success' : 'error',
                                title: `Connection Test: ${conn.name}`,
                                description: conn.status === 'active' 
                                    ? 'Connection test successful' 
                                    : `Connection test failed: ${conn.lastError || 'Unknown error'}`,
                                timestamp: conn.lastTestedAt,
                                metadata: { connectionId: conn.id, type: conn.type }
                            });
                        }
                    });
            }

            // Sort by timestamp descending
            newEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setEvents(newEvents.slice(0, maxEvents));
        } catch (error) {
            console.error('Error fetching activity events:', error);
        } finally {
            setIsLoading(false);
        }
    }, [maxEvents]);

    // WebSocket for real-time events
    useEffect(() => {
        if (!isOpen || !user?.orgId) return;

        fetchInitialEvents();

        const wsUrl = window.location.protocol === 'https:'
            ? `wss://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/ws`
            : `ws://${window.location.hostname}:3001/ws`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    type: 'subscribe_ot_alerts',
                    orgId: user.orgId,
                    user: { id: user.id, name: user.name || 'User', email: user.email }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'ot_alert' && message.alert) {
                        const newEvent: ActivityEvent = {
                            id: `alert_${message.alert.id}_${Date.now()}`,
                            type: 'alert',
                            severity: message.alert.severity === 'error' ? 'error' : 'warning',
                            title: `New Alert: ${message.alert.fieldName}`,
                            description: message.alert.message,
                            timestamp: message.alert.timestamp || new Date().toISOString(),
                            metadata: { alertId: message.alert.id, nodeType: message.alert.nodeType }
                        };
                        setEvents(prev => [newEvent, ...prev].slice(0, maxEvents));
                    } else if (message.type === 'connection_status_change' && message.connection) {
                        const newEvent: ActivityEvent = {
                            id: `conn_${message.connection.id}_${Date.now()}`,
                            type: 'connection_change',
                            severity: message.connection.status === 'active' ? 'success' : 'error',
                            title: `Connection Status: ${message.connection.name}`,
                            description: message.connection.status === 'active'
                                ? 'Connection is now active'
                                : `Connection error: ${message.connection.lastError || 'Unknown'}`,
                            timestamp: message.connection.lastTestedAt || new Date().toISOString(),
                            metadata: { connectionId: message.connection.id }
                        };
                        setEvents(prev => [newEvent, ...prev].slice(0, maxEvents));
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };
        } catch (e) {
            console.error('WebSocket connection error:', e);
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [isOpen, user?.orgId, user?.id, user?.name, user?.email, maxEvents, fetchInitialEvents]);

    const getEventIcon = (event: ActivityEvent) => {
        switch (event.type) {
            case 'alert':
                return <Warning size={16} className={event.severity === 'error' ? 'text-red-500' : 'text-amber-500'} />;
            case 'connection_change':
                return <PlugsConnected size={16} className={event.severity === 'success' ? 'text-green-500' : 'text-red-500'} />;
            case 'test':
                return <Lightning size={16} className={event.severity === 'success' ? 'text-green-500' : 'text-red-500'} />;
            case 'acknowledge':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'config_change':
                return <Bell size={16} className="text-blue-500" />;
            default:
                return <ClockCounterClockwise size={16} className="text-gray-500" />;
        }
    };

    const getSeverityBadge = (severity: ActivityEvent['severity']) => {
        switch (severity) {
            case 'error':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'warning':
                return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'success':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            default:
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
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
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const exportToCSV = () => {
        const csvData = filteredEvents.map(e => ({
            Timestamp: new Date(e.timestamp).toLocaleString(),
            Type: e.type,
            Severity: e.severity,
            Title: e.title,
            Description: e.description
        }));

        const headers = Object.keys(csvData[0] || {});
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ot_activity_log_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const filteredEvents = events.filter(event => {
        if (filterType !== 'all' && event.type !== filterType) return false;
        if (filterSeverity !== 'all' && event.severity !== filterSeverity) return false;
        return true;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div 
                className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ClockCounterClockwise size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity Log</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">
                                {filteredEvents.length} events
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchInitialEvents}
                            disabled={isLoading}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <ArrowClockwise size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={exportToCSV}
                            disabled={filteredEvents.length === 0}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                            title="Export CSV"
                        >
                            <Download size={18} />
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
                <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-3">
                        <Funnel size={14} className="text-[var(--text-tertiary)]" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="alert">Alerts</option>
                            <option value="connection_change">Connection Changes</option>
                            <option value="test">Tests</option>
                            <option value="acknowledge">Acknowledgments</option>
                        </select>
                        <select
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value as any)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none"
                        >
                            <option value="all">All Severities</option>
                            <option value="error">Errors</option>
                            <option value="warning">Warnings</option>
                            <option value="success">Success</option>
                            <option value="info">Info</option>
                        </select>
                    </div>
                </div>

                {/* Events List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <ClockCounterClockwise size={48} className="text-[var(--text-tertiary)] mb-3" />
                            <p className="text-sm text-[var(--text-secondary)]">No activity events</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                Events will appear here as they occur
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-light)]">
                            {filteredEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="flex items-start gap-3 p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getEventIcon(event)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-[var(--text-primary)]">
                                                {event.title}
                                            </span>
                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getSeverityBadge(event.severity)}`}>
                                                {event.severity.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] mb-1">
                                            {event.description}
                                        </p>
                                        <p className="text-[10px] text-[var(--text-tertiary)]">
                                            {formatTimeAgo(event.timestamp)} • {new Date(event.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                    <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                        <span>Showing {filteredEvents.length} events</span>
                        <span className={`flex items-center gap-1 ${wsRef.current?.readyState === WebSocket.OPEN ? 'text-green-500' : 'text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${wsRef.current?.readyState === WebSocket.OPEN ? 'bg-green-500' : 'bg-gray-500'}`} />
                            {wsRef.current?.readyState === WebSocket.OPEN ? 'Live updates' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
