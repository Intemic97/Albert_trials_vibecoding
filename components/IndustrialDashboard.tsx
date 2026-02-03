/**
 * Industrial Dashboard Component
 * Real-time monitoring dashboard for OT/Industrial systems
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Factory,
    Warning,
    CheckCircle,
    XCircle,
    PlugsConnected,
    ChartLine,
    Clock,
    SpinnerGap,
    ArrowClockwise,
    Pulse,
    Gauge,
    TrendUp,
    TrendDown
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { DynamicChart } from './DynamicChart';
// import { OTAlertsPanel } from './OTAlertsPanel';

interface OTConnection {
    id: string;
    name: string;
    type: 'opcua' | 'mqtt' | 'modbus' | 'scada' | 'mes' | 'dataHistorian';
    status: 'active' | 'inactive' | 'error';
    lastTestedAt?: string;
    lastError?: string;
}

interface OTAlertSummary {
    total: number;
    errors: number;
    warnings: number;
    unacknowledged: number;
}

interface OTMetric {
    connectionId: string;
    connectionName: string;
    nodeId?: string;
    fieldName: string;
    value: number;
    timestamp: string;
    unit?: string;
}

export const IndustrialDashboard: React.FC = () => {
    const { user } = useAuth();
    const [connections, setConnections] = useState<OTConnection[]>([]);
    const [alertSummary, setAlertSummary] = useState<OTAlertSummary>({
        total: 0,
        errors: 0,
        warnings: 0,
        unacknowledged: 0
    });
    const [metrics, setMetrics] = useState<OTMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
    const wsRef = useRef<WebSocket | null>(null);
    const metricsHistoryRef = useRef<Map<string, Array<{ timestamp: Date; value: number }>>>(new Map());

    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/data-connections`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                // Filter only OT connections
                const otConnections = data.filter((conn: any) => 
                    ['opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian'].includes(conn.type)
                );
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
            const res = await fetch(`${API_BASE}/ot-alerts?limit=1000`, {
                credentials: 'include'
            });
            if (res.ok) {
                const alerts = await res.json();
                const summary: OTAlertSummary = {
                    total: alerts.length,
                    errors: alerts.filter((a: any) => a.severity === 'error').length,
                    warnings: alerts.filter((a: any) => a.severity === 'warning').length,
                    unacknowledged: alerts.filter((a: any) => !a.acknowledgedAt).length
                };
                setAlertSummary(summary);
            }
        } catch (error) {
            console.error('Error fetching alert summary:', error);
        }
    }, []);

    // Fetch connections
    useEffect(() => {
        fetchConnections();
        fetchAlertSummary();
        const interval = setInterval(() => {
            fetchConnections();
            fetchAlertSummary();
        }, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [fetchConnections, fetchAlertSummary]);

    // WebSocket connection for real-time metrics
    useEffect(() => {
        if (!user?.orgId) return;

        const getWsUrl = () => {
            if (window.location.protocol === 'https:') {
                return `wss://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/ws`;
            }
            return `ws://${window.location.hostname}:3001/ws`;
        };

        const wsUrl = getWsUrl();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
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
                    // Update alert summary
                    fetchAlertSummary();
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            setTimeout(() => {
                if (user?.orgId) {
                    // Reconnect handled by useEffect
                }
            }, 3000);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [user?.orgId, fetchAlertSummary]);

    const getConnectionStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'error':
                return 'text-red-500 bg-red-500/10 border-red-500/20';
            default:
                return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getConnectionTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            opcua: 'OPC UA',
            mqtt: 'MQTT',
            modbus: 'Modbus',
            scada: 'SCADA',
            mes: 'MES',
            dataHistorian: 'Data Historian'
        };
        return labels[type] || type.toUpperCase();
    };

    const activeConnections = connections.filter(c => c.status === 'active').length;
    const totalConnections = connections.length;

    // Prepare chart data for connection status
    const connectionStatusData = [
        { name: 'Active', value: activeConnections, color: '#22c55e' },
        { name: 'Inactive', value: totalConnections - activeConnections, color: '#6b7280' },
        { name: 'Error', value: connections.filter(c => c.status === 'error').length, color: '#ef4444' }
    ].filter(item => item.value > 0);

    // Prepare chart data for alert severity
    const alertSeverityData = [
        { name: 'Errors', value: alertSummary.errors, color: '#ef4444' },
        { name: 'Warnings', value: alertSummary.warnings, color: '#f59e0b' }
    ].filter(item => item.value > 0);

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
                                Industrial Monitoring Dashboard
                            </h1>
                            <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                Real-time monitoring of OT/Industrial systems
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                            className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        >
                            <option value="1h">Last Hour</option>
                            <option value="6h">Last 6 Hours</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                        <button
                            onClick={() => {
                                fetchConnections();
                                fetchAlertSummary();
                            }}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <ArrowClockwise size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading && connections.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <SpinnerGap size={24} className="text-[var(--text-tertiary)] animate-spin" />
                    </div>
                ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Total Connections */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-[var(--text-tertiary)]">Total Connections</span>
                                <PlugsConnected size={20} className="text-blue-500" />
                            </div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                {totalConnections}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                {activeConnections} active
                            </div>
                        </div>

                        {/* Active Alerts */}
                        <div 
                            className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                            onClick={() => setShowAlertsPanel(true)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-[var(--text-tertiary)]">Active Alerts</span>
                                <Warning size={20} className="text-amber-500" />
                            </div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                {alertSummary.unacknowledged}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                {alertSummary.errors} errors, {alertSummary.warnings} warnings
                            </div>
                        </div>

                        {/* Error Rate */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-[var(--text-tertiary)]">Error Rate</span>
                                {alertSummary.errors > 0 ? (
                                    <XCircle size={20} className="text-red-500" />
                                ) : (
                                    <CheckCircle size={20} className="text-green-500" />
                                )}
                            </div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                {totalConnections > 0 
                                    ? ((connections.filter(c => c.status === 'error').length / totalConnections) * 100).toFixed(1)
                                    : '0'
                                }%
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                {connections.filter(c => c.status === 'error').length} connections with errors
                            </div>
                        </div>

                        {/* System Health */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-[var(--text-tertiary)]">System Health</span>
                                <Pulse size={20} className="text-green-500" />
                            </div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                {totalConnections > 0
                                    ? Math.round((activeConnections / totalConnections) * 100)
                                    : 0
                                }%
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                {activeConnections} of {totalConnections} connections healthy
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {/* Connection Status Chart */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                                Connection Status
                            </h3>
                            {connectionStatusData.length > 0 ? (
                                <div style={{ minHeight: '200px', width: '100%' }}>
                                    <DynamicChart
                                        config={{
                                            type: 'pie',
                                            title: 'Connection Status',
                                            description: 'Distribution of connection statuses',
                                            data: connectionStatusData.map(item => ({
                                                name: item.name,
                                                value: item.value
                                            })),
                                            xAxisKey: 'name',
                                            dataKey: 'value',
                                            colors: connectionStatusData.map(item => item.color)
                                        }}
                                        height={200}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-[var(--text-tertiary)]">
                                    No connection data available
                                </div>
                            )}
                        </div>

                        {/* Alert Severity Chart */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                                Alert Severity Distribution
                            </h3>
                            {alertSeverityData.length > 0 ? (
                                <div style={{ minHeight: '200px', width: '100%' }}>
                                    <DynamicChart
                                        config={{
                                            type: 'bar',
                                            title: 'Alert Severity',
                                            description: 'Distribution of alert severities',
                                            data: alertSeverityData.map(item => ({
                                                name: item.name,
                                                value: item.value
                                            })),
                                            xAxisKey: 'name',
                                            dataKey: 'value',
                                            colors: alertSeverityData.map(item => item.color)
                                        }}
                                        height={200}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-[var(--text-tertiary)]">
                                    No alerts found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connections List */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                            OT Connections
                        </h3>
                        {connections.length === 0 ? (
                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                                <PlugsConnected size={48} className="mx-auto mb-3 opacity-50" />
                                <p>No OT connections configured</p>
                                <p className="text-xs mt-1">Configure connections in the Connections page</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {connections.map((conn) => (
                                    <div
                                        key={conn.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className={`px-2 py-1 rounded text-xs font-medium border ${getConnectionStatusColor(conn.status)}`}>
                                                {conn.status.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-[var(--text-primary)]">
                                                    {conn.name}
                                                </div>
                                                <div className="text-xs text-[var(--text-tertiary)]">
                                                    {getConnectionTypeLabel(conn.type)}
                                                    {conn.lastTestedAt && (
                                                        <> • Last tested: {new Date(conn.lastTestedAt).toLocaleString()}</>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {conn.lastError && (
                                            <div className="text-xs text-red-500 ml-2" title={conn.lastError}>
                                                <XCircle size={16} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </>
                )}
            </div>

            {/* OT Alerts Panel */}
            {showAlertsPanel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAlertsPanel(false)}>
                    <div className="bg-[var(--bg-card)] p-6 rounded-lg">
                        <p>OT Alerts Panel - Coming soon</p>
                        <button onClick={() => setShowAlertsPanel(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};
