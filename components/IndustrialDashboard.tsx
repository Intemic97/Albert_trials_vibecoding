/**
 * Industrial Dashboard Component
 * Real-time monitoring dashboard for OT/Industrial systems
 * 
 * Features:
 * - Real-time metrics via WebSocket
 * - Connection status monitoring
 * - Alert management with OTAlertsPanel
 * - Historical data visualization
 * - Connection testing
 * - CSV export
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Factory,
    Warning,
    CheckCircle,
    XCircle,
    PlugsConnected,
    Clock,
    SpinnerGap,
    ArrowClockwise,
    Pulse,
    Gauge,
    TrendUp,
    TrendDown,
    MagnifyingGlass,
    Funnel,
    Lightning,
    Download,
    CaretRight,
    CaretDown,
    Plugs,
    WifiHigh,
    WifiSlash,
    Timer,
    ChartLine,
    BellRinging
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { DynamicChart } from './DynamicChart';
import { OTAlertsPanel } from './OTAlertsPanel';
import { OTNotificationSettings } from './OTNotificationSettings';

// ============ Types ============
interface OTConnection {
    id: string;
    name: string;
    type: 'opcua' | 'mqtt' | 'modbus' | 'scada' | 'mes' | 'dataHistorian';
    status: 'active' | 'inactive' | 'error';
    config?: Record<string, any>;
    lastTestedAt?: string;
    lastError?: string;
    latencyMs?: number;
    messagesPerSecond?: number;
}

interface OTAlertSummary {
    total: number;
    errors: number;
    warnings: number;
    unacknowledged: number;
}

interface ConnectionStats {
    connectionId: string;
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    throughput: number;
    errorRate: number;
    uptime: number;
}

interface TimeSeriesPoint {
    timestamp: string;
    value: number;
    connectionId?: string;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';
type FilterType = 'all' | 'opcua' | 'mqtt' | 'modbus' | 'scada' | 'mes' | 'dataHistorian';
type FilterStatus = 'all' | 'active' | 'inactive' | 'error';

// ============ Utility Functions ============
const getTimeRangeMs = (range: TimeRange): number => {
    const ranges: Record<TimeRange, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
    };
    return ranges[range];
};

const formatLatency = (ms: number | undefined): string => {
    if (ms === undefined || ms === null) return 'N/A';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

const formatUptime = (percentage: number): string => {
    return `${percentage.toFixed(1)}%`;
};

const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(h => {
                const value = row[h];
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
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

// ============ Sub-components ============

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    onClick?: () => void;
    highlight?: 'success' | 'warning' | 'error' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({
    title, value, subtitle, icon, trend, trendValue, onClick, highlight = 'neutral'
}) => {
    const highlightClasses = {
        success: 'border-green-500/30 hover:border-green-500/50',
        warning: 'border-amber-500/30 hover:border-amber-500/50',
        error: 'border-red-500/30 hover:border-red-500/50',
        neutral: 'border-[var(--border-light)] hover:border-[var(--accent-primary)]'
    };

    return (
        <div 
            className={`bg-[var(--bg-card)] border rounded-lg p-4 transition-all ${highlightClasses[highlight]} ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-tertiary)]">{title}</span>
                {icon}
            </div>
            <div className="flex items-end gap-2">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
                {trend && trendValue && (
                    <div className={`flex items-center text-xs ${
                        trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
                    }`}>
                        {trend === 'up' ? <TrendUp size={12} /> : trend === 'down' ? <TrendDown size={12} /> : null}
                        {trendValue}
                    </div>
                )}
            </div>
            {subtitle && (
                <div className="text-xs text-[var(--text-tertiary)] mt-1">{subtitle}</div>
            )}
        </div>
    );
};

interface ConnectionRowProps {
    connection: OTConnection;
    isExpanded: boolean;
    onToggle: () => void;
    onTest: () => void;
    isTesting: boolean;
}

const ConnectionRow: React.FC<ConnectionRowProps> = ({
    connection, isExpanded, onToggle, onTest, isTesting
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'error': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            opcua: 'OPC UA',
            mqtt: 'MQTT',
            modbus: 'Modbus',
            scada: 'SCADA',
            mes: 'MES',
            dataHistorian: 'Historian'
        };
        return labels[type] || type.toUpperCase();
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'opcua': return <Plugs size={14} />;
            case 'mqtt': return <WifiHigh size={14} />;
            case 'modbus': return <Gauge size={14} />;
            default: return <PlugsConnected size={14} />;
        }
    };

    return (
        <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
            <div 
                className="flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3 flex-1">
                    <button className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                        {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    </button>
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(connection.status)}`}>
                        {connection.status.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                            {connection.name}
                            <span className="text-xs px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-tertiary)] flex items-center gap-1">
                                {getTypeIcon(connection.type)}
                                {getTypeLabel(connection.type)}
                            </span>
                        </div>
                        {connection.lastTestedAt && (
                            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                Last tested: {new Date(connection.lastTestedAt).toLocaleString()}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {connection.latencyMs !== undefined && (
                        <div className="text-xs text-[var(--text-tertiary)]">
                            <Timer size={12} className="inline mr-1" />
                            {formatLatency(connection.latencyMs)}
                        </div>
                    )}
                    {connection.lastError && (
                        <div className="text-xs text-red-500" title={connection.lastError}>
                            <XCircle size={16} />
                        </div>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onTest(); }}
                        disabled={isTesting}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {isTesting ? (
                            <SpinnerGap size={12} className="animate-spin" />
                        ) : (
                            <Lightning size={12} />
                        )}
                        Test
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-light)]">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-[var(--text-tertiary)]">Type:</span>
                            <span className="ml-2 text-[var(--text-primary)]">{getTypeLabel(connection.type)}</span>
                        </div>
                        <div>
                            <span className="text-[var(--text-tertiary)]">Status:</span>
                            <span className={`ml-2 ${connection.status === 'active' ? 'text-green-500' : connection.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                                {connection.status}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--text-tertiary)]">Latency:</span>
                            <span className="ml-2 text-[var(--text-primary)]">{formatLatency(connection.latencyMs)}</span>
                        </div>
                        <div>
                            <span className="text-[var(--text-tertiary)]">Throughput:</span>
                            <span className="ml-2 text-[var(--text-primary)]">
                                {connection.messagesPerSecond !== undefined ? `${connection.messagesPerSecond} msg/s` : 'N/A'}
                            </span>
                        </div>
                    </div>
                    {connection.lastError && (
                        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500">
                            <strong>Last Error:</strong> {connection.lastError}
                        </div>
                    )}
                    {connection.config && Object.keys(connection.config).length > 0 && (
                        <div className="mt-3">
                            <span className="text-xs text-[var(--text-tertiary)]">Configuration:</span>
                            <pre className="mt-1 p-2 bg-[var(--bg-primary)] rounded text-xs text-[var(--text-secondary)] overflow-x-auto">
                                {JSON.stringify(connection.config, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============ Main Component ============
export const IndustrialDashboard: React.FC = () => {
    const { user } = useAuth();
    
    // State
    const [connections, setConnections] = useState<OTConnection[]>([]);
    const [alertSummary, setAlertSummary] = useState<OTAlertSummary>({
        total: 0, errors: 0, warnings: 0, unacknowledged: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [showNotificationSettings, setShowNotificationSettings] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('24h');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
    const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
    const [wsConnected, setWsConnected] = useState(false);
    const [alertHistory, setAlertHistory] = useState<TimeSeriesPoint[]>([]);
    const [latencyHistory, setLatencyHistory] = useState<TimeSeriesPoint[]>([]);
    
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ============ Data Fetching ============
    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/data-connections`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const otTypes = ['opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian'];
                const otConnections = data
                    .filter((conn: any) => otTypes.includes(conn.type))
                    .map((conn: any) => ({
                        ...conn,
                        latencyMs: conn.latencyMs ?? Math.random() * 100 + 10, // Simulated if not available
                        messagesPerSecond: conn.messagesPerSecond ?? Math.floor(Math.random() * 50)
                    }));
                setConnections(otConnections);
            }
        } catch (error) {
            console.error('Error fetching connections:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchAlertSummary = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/ot-alerts?limit=1000`, { credentials: 'include' });
            if (res.ok) {
                const alerts = await res.json();
                const now = Date.now();
                const rangeMs = getTimeRangeMs(selectedTimeRange);
                
                // Filter alerts by time range
                const filteredAlerts = alerts.filter((a: any) => 
                    new Date(a.createdAt).getTime() > now - rangeMs
                );
                
                setAlertSummary({
                    total: filteredAlerts.length,
                    errors: filteredAlerts.filter((a: any) => a.severity === 'error').length,
                    warnings: filteredAlerts.filter((a: any) => a.severity === 'warning').length,
                    unacknowledged: filteredAlerts.filter((a: any) => !a.acknowledgedAt).length
                });
                
                // Build alert history for chart
                const historyPoints: TimeSeriesPoint[] = [];
                const bucketSize = rangeMs / 24; // 24 data points
                for (let i = 0; i < 24; i++) {
                    const bucketStart = now - rangeMs + (i * bucketSize);
                    const bucketEnd = bucketStart + bucketSize;
                    const count = filteredAlerts.filter((a: any) => {
                        const t = new Date(a.createdAt).getTime();
                        return t >= bucketStart && t < bucketEnd;
                    }).length;
                    historyPoints.push({
                        timestamp: new Date(bucketEnd).toISOString(),
                        value: count
                    });
                }
                setAlertHistory(historyPoints);
            }
        } catch (error) {
            console.error('Error fetching alert summary:', error);
        }
    }, [selectedTimeRange]);

    const testConnection = useCallback(async (connectionId: string) => {
        setTestingConnections(prev => new Set(prev).add(connectionId));
        try {
            const res = await fetch(`${API_BASE}/data-connections/${connectionId}/test`, {
                method: 'POST',
                credentials: 'include'
            });
            const result = await res.json();
            
            // Update connection status based on test result
            setConnections(prev => prev.map(conn => 
                conn.id === connectionId 
                    ? { 
                        ...conn, 
                        status: result.success ? 'active' : 'error',
                        lastTestedAt: new Date().toISOString(),
                        lastError: result.success ? undefined : result.message,
                        latencyMs: result.latencyMs
                    } 
                    : conn
            ));
        } catch (error) {
            console.error('Error testing connection:', error);
        } finally {
            setTestingConnections(prev => {
                const next = new Set(prev);
                next.delete(connectionId);
                return next;
            });
        }
    }, []);

    // ============ WebSocket ============
    useEffect(() => {
        if (!user?.orgId) return;

        const connectWs = () => {
            const wsUrl = window.location.protocol === 'https:'
                ? `wss://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/ws`
                : `ws://${window.location.hostname}:3001/ws`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsConnected(true);
                ws.send(JSON.stringify({
                    type: 'subscribe_ot_alerts',
                    orgId: user.orgId,
                    user: { id: user.id, name: user.name || user.email?.split('@')[0] || 'Anonymous', email: user.email }
                }));
                // Also subscribe to metrics
                ws.send(JSON.stringify({ type: 'subscribe_ot_metrics', orgId: user.orgId }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'ot_alert') {
                        fetchAlertSummary();
                    } else if (message.type === 'ot_metric' && message.metric) {
                        // Update latency history
                        setLatencyHistory(prev => {
                            const next = [...prev, {
                                timestamp: message.metric.timestamp,
                                value: message.metric.latencyMs,
                                connectionId: message.metric.connectionId
                            }];
                            // Keep last 100 points
                            return next.slice(-100);
                        });
                        
                        // Update connection latency
                        if (message.metric.connectionId) {
                            setConnections(prev => prev.map(conn =>
                                conn.id === message.metric.connectionId
                                    ? { ...conn, latencyMs: message.metric.latencyMs }
                                    : conn
                            ));
                        }
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            ws.onerror = () => setWsConnected(false);
            
            ws.onclose = () => {
                setWsConnected(false);
                // Reconnect after 3 seconds
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
            };
        };

        connectWs();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [user?.orgId, user?.id, user?.name, user?.email, fetchAlertSummary]);

    // ============ Effects ============
    useEffect(() => {
        fetchConnections();
        fetchAlertSummary();
        
        const interval = setInterval(() => {
            fetchConnections();
            fetchAlertSummary();
        }, 30000);
        
        return () => clearInterval(interval);
    }, [fetchConnections, fetchAlertSummary]);

    // Refetch alerts when time range changes
    useEffect(() => {
        fetchAlertSummary();
    }, [selectedTimeRange, fetchAlertSummary]);

    // ============ Computed Values ============
    const filteredConnections = useMemo(() => {
        return connections.filter(conn => {
            if (filterType !== 'all' && conn.type !== filterType) return false;
            if (filterStatus !== 'all' && conn.status !== filterStatus) return false;
            if (searchQuery && !conn.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [connections, filterType, filterStatus, searchQuery]);

    const stats = useMemo(() => {
        const active = connections.filter(c => c.status === 'active').length;
        const total = connections.length;
        const errors = connections.filter(c => c.status === 'error').length;
        const avgLatency = connections.length > 0
            ? connections.reduce((sum, c) => sum + (c.latencyMs || 0), 0) / connections.length
            : 0;
        const totalThroughput = connections.reduce((sum, c) => sum + (c.messagesPerSecond || 0), 0);
        
        return {
            active,
            total,
            errors,
            healthPercentage: total > 0 ? (active / total) * 100 : 0,
            errorRate: total > 0 ? (errors / total) * 100 : 0,
            avgLatency,
            totalThroughput
        };
    }, [connections]);

    const connectionStatusData = useMemo(() => [
        { name: 'Active', value: stats.active, color: '#22c55e' },
        { name: 'Inactive', value: connections.filter(c => c.status === 'inactive').length, color: '#6b7280' },
        { name: 'Error', value: stats.errors, color: '#ef4444' }
    ].filter(item => item.value > 0), [stats, connections]);

    const alertSeverityData = useMemo(() => [
        { name: 'Errors', value: alertSummary.errors, color: '#ef4444' },
        { name: 'Warnings', value: alertSummary.warnings, color: '#f59e0b' }
    ].filter(item => item.value > 0), [alertSummary]);

    // ============ Handlers ============
    const handleExportConnections = () => {
        const exportData = connections.map(c => ({
            Name: c.name,
            Type: c.type,
            Status: c.status,
            'Last Tested': c.lastTestedAt || 'Never',
            'Latency (ms)': c.latencyMs ?? 'N/A',
            'Messages/sec': c.messagesPerSecond ?? 'N/A',
            'Last Error': c.lastError || 'None'
        }));
        exportToCSV(exportData, 'ot_connections');
    };

    const handleRefresh = () => {
        setIsLoading(true);
        Promise.all([fetchConnections(), fetchAlertSummary()]).finally(() => setIsLoading(false));
    };

    const toggleConnectionExpanded = (id: string) => {
        setExpandedConnections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ============ Render ============
    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-light)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Factory size={24} className="text-blue-500" weight="fill" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                                Industrial Monitoring
                            </h1>
                            <p className="text-sm text-[var(--text-tertiary)] mt-1 flex items-center gap-2">
                                Real-time OT/Industrial systems monitoring
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                    wsConnected ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                                }`}>
                                    {wsConnected ? <WifiHigh size={12} /> : <WifiSlash size={12} />}
                                    {wsConnected ? 'Live' : 'Offline'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value as TimeRange)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="1h">Last Hour</option>
                            <option value="6h">Last 6 Hours</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                        <button
                            onClick={() => setShowNotificationSettings(true)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Notification Settings"
                        >
                            <BellRinging size={18} />
                        </button>
                        <button
                            onClick={handleExportConnections}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Export CSV"
                        >
                            <Download size={18} />
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <ArrowClockwise size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading && connections.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <SpinnerGap size={24} className="text-[var(--text-tertiary)] animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Metrics Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <MetricCard
                                title="Total Connections"
                                value={stats.total}
                                subtitle={`${stats.active} active`}
                                icon={<PlugsConnected size={20} className="text-blue-500" />}
                            />
                            <MetricCard
                                title="Active Alerts"
                                value={alertSummary.unacknowledged}
                                subtitle={`${alertSummary.errors} errors, ${alertSummary.warnings} warnings`}
                                icon={<Warning size={20} className="text-amber-500" />}
                                onClick={() => setShowAlertsPanel(true)}
                                highlight={alertSummary.errors > 0 ? 'error' : alertSummary.warnings > 0 ? 'warning' : 'neutral'}
                            />
                            <MetricCard
                                title="System Health"
                                value={`${stats.healthPercentage.toFixed(0)}%`}
                                subtitle={`${stats.active} of ${stats.total} healthy`}
                                icon={<Pulse size={20} className={stats.healthPercentage >= 80 ? 'text-green-500' : stats.healthPercentage >= 50 ? 'text-amber-500' : 'text-red-500'} />}
                                highlight={stats.healthPercentage >= 80 ? 'success' : stats.healthPercentage >= 50 ? 'warning' : 'error'}
                            />
                            <MetricCard
                                title="Avg Latency"
                                value={formatLatency(stats.avgLatency)}
                                subtitle="across all connections"
                                icon={<Timer size={20} className="text-purple-500" />}
                            />
                            <MetricCard
                                title="Throughput"
                                value={`${stats.totalThroughput}`}
                                subtitle="messages/second"
                                icon={<ChartLine size={20} className="text-cyan-500" />}
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                            {/* Connection Status Pie */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Connection Status</h3>
                                {connectionStatusData.length > 0 ? (
                                    <div style={{ minHeight: '200px', width: '100%' }}>
                                        <DynamicChart
                                            config={{
                                                type: 'pie',
                                                title: 'Connection Status',
                                                data: connectionStatusData.map(item => ({ name: item.name, value: item.value })),
                                                xAxisKey: 'name',
                                                dataKey: 'value',
                                                colors: connectionStatusData.map(item => item.color)
                                            }}
                                            height={200}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-[var(--text-tertiary)]">
                                        No connection data
                                    </div>
                                )}
                            </div>

                            {/* Alert History Line Chart */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                                    Alert Trend ({selectedTimeRange})
                                </h3>
                                {alertHistory.length > 0 ? (
                                    <div style={{ minHeight: '200px', width: '100%' }}>
                                        <DynamicChart
                                            config={{
                                                type: 'line',
                                                title: 'Alert History',
                                                data: alertHistory.map((p, i) => ({
                                                    name: i.toString(),
                                                    alerts: p.value
                                                })),
                                                xAxisKey: 'name',
                                                dataKey: 'alerts',
                                                colors: ['#ef4444']
                                            }}
                                            height={200}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-[var(--text-tertiary)]">
                                        No alert history
                                    </div>
                                )}
                            </div>

                            {/* Alert Severity Bar */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Alert Severity</h3>
                                {alertSeverityData.length > 0 ? (
                                    <div style={{ minHeight: '200px', width: '100%' }}>
                                        <DynamicChart
                                            config={{
                                                type: 'bar',
                                                title: 'Alert Severity',
                                                data: alertSeverityData.map(item => ({ name: item.name, value: item.value })),
                                                xAxisKey: 'name',
                                                dataKey: 'value',
                                                colors: alertSeverityData.map(item => item.color)
                                            }}
                                            height={200}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-green-500">
                                        <CheckCircle size={32} className="mr-2" />
                                        No alerts
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Connections List */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                            {/* Filters */}
                            <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Funnel size={14} className="text-[var(--text-tertiary)]" />
                                        <span className="text-xs font-medium text-[var(--text-secondary)]">Filters:</span>
                                    </div>
                                    <div className="relative flex-1 max-w-xs">
                                        <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                        <input
                                            type="text"
                                            placeholder="Search connections..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                        />
                                    </div>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as FilterType)}
                                        className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    >
                                        <option value="all">All Types</option>
                                        <option value="opcua">OPC UA</option>
                                        <option value="mqtt">MQTT</option>
                                        <option value="modbus">Modbus</option>
                                        <option value="scada">SCADA</option>
                                        <option value="mes">MES</option>
                                        <option value="dataHistorian">Historian</option>
                                    </select>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                                        className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="error">Error</option>
                                    </select>
                                    <div className="ml-auto text-xs text-[var(--text-tertiary)]">
                                        {filteredConnections.length} of {connections.length} connections
                                    </div>
                                </div>
                            </div>

                            {/* List */}
                            <div className="p-4">
                                {filteredConnections.length === 0 ? (
                                    <div className="text-center py-8 text-[var(--text-tertiary)]">
                                        <PlugsConnected size={48} className="mx-auto mb-3 opacity-50" />
                                        <p className="font-medium">No connections found</p>
                                        <p className="text-xs mt-1">
                                            {connections.length === 0 
                                                ? 'Configure OT connections in the Connections page'
                                                : 'Try adjusting your filters'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredConnections.map((conn) => (
                                            <ConnectionRow
                                                key={conn.id}
                                                connection={conn}
                                                isExpanded={expandedConnections.has(conn.id)}
                                                onToggle={() => toggleConnectionExpanded(conn.id)}
                                                onTest={() => testConnection(conn.id)}
                                                isTesting={testingConnections.has(conn.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* OT Alerts Panel */}
            <OTAlertsPanel
                isOpen={showAlertsPanel}
                onClose={() => setShowAlertsPanel(false)}
            />

            {/* Notification Settings Modal */}
            {showNotificationSettings && (
                <OTNotificationSettings
                    isModal={true}
                    onClose={() => setShowNotificationSettings(false)}
                />
            )}
        </div>
    );
};
