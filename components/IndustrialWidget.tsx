/**
 * Industrial Widget Component
 * Compact summary widget for OT/Industrial system status
 * Can be embedded in Dashboard or used standalone
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Factory,
    Warning,
    CheckCircle,
    XCircle,
    PlugsConnected,
    Pulse,
    ArrowRight,
    SpinnerGap
} from '@phosphor-icons/react';
import { API_BASE } from '../config';

interface IndustrialSummary {
    totalConnections: number;
    activeConnections: number;
    errorConnections: number;
    unacknowledgedAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    healthPercentage: number;
}

interface IndustrialWidgetProps {
    compact?: boolean;
    showLink?: boolean;
    className?: string;
}

export const IndustrialWidget: React.FC<IndustrialWidgetProps> = ({
    compact = false,
    showLink = true,
    className = ''
}) => {
    const [summary, setSummary] = useState<IndustrialSummary>({
        totalConnections: 0,
        activeConnections: 0,
        errorConnections: 0,
        unacknowledgedAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        healthPercentage: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchSummary = useCallback(async () => {
        try {
            const [connectionsRes, alertsRes] = await Promise.all([
                fetch(`${API_BASE}/data-connections`, { credentials: 'include' }),
                fetch(`${API_BASE}/ot-alerts?acknowledged=false&limit=100`, { credentials: 'include' })
            ]);

            let connections: any[] = [];
            let alerts: any[] = [];

            if (connectionsRes.ok) {
                const data = await connectionsRes.json();
                const otTypes = ['opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian'];
                connections = data.filter((c: any) => otTypes.includes(c.type));
            }

            if (alertsRes.ok) {
                alerts = await alertsRes.json();
            }

            const activeConnections = connections.filter(c => c.status === 'active').length;
            const errorConnections = connections.filter(c => c.status === 'error').length;
            const totalConnections = connections.length;

            setSummary({
                totalConnections,
                activeConnections,
                errorConnections,
                unacknowledgedAlerts: alerts.length,
                criticalAlerts: alerts.filter((a: any) => a.severity === 'error').length,
                warningAlerts: alerts.filter((a: any) => a.severity === 'warning').length,
                healthPercentage: totalConnections > 0 
                    ? Math.round((activeConnections / totalConnections) * 100) 
                    : 100
            });
        } catch (error) {
            console.error('Error fetching industrial summary:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, 30000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    const getHealthColor = () => {
        if (summary.healthPercentage >= 80) return 'text-green-500';
        if (summary.healthPercentage >= 50) return 'text-amber-500';
        return 'text-red-500';
    };

    const getHealthBgColor = () => {
        if (summary.healthPercentage >= 80) return 'bg-green-500/10 border-green-500/20';
        if (summary.healthPercentage >= 50) return 'bg-amber-500/10 border-amber-500/20';
        return 'bg-red-500/10 border-red-500/20';
    };

    if (isLoading) {
        return (
            <div className={`bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 ${className}`}>
                <div className="flex items-center justify-center py-4">
                    <SpinnerGap size={20} className="text-[var(--text-tertiary)] animate-spin" />
                </div>
            </div>
        );
    }

    // No OT connections configured
    if (summary.totalConnections === 0) {
        return (
            <div className={`bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 ${className}`}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Factory size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Industrial</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">OT Monitoring</p>
                    </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mb-3">
                    No OT connections configured yet.
                </p>
                {showLink && (
                    <Link 
                        to="/connections" 
                        className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                    >
                        Configure connections <ArrowRight size={12} />
                    </Link>
                )}
            </div>
        );
    }

    if (compact) {
        return (
            <Link 
                to="/industrial"
                className={`block bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-3 hover:border-[var(--accent-primary)] transition-colors ${className}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Factory size={16} className="text-blue-500" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">Industrial</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {summary.unacknowledgedAlerts > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500 text-white rounded-full">
                                {summary.unacknowledgedAlerts}
                            </span>
                        )}
                        <span className={`text-sm font-bold ${getHealthColor()}`}>
                            {summary.healthPercentage}%
                        </span>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <div className={`bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Factory size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Industrial Status</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">OT System Health</p>
                    </div>
                </div>
                {showLink && (
                    <Link 
                        to="/industrial"
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <ArrowRight size={16} />
                    </Link>
                )}
            </div>

            {/* Health Indicator */}
            <div className={`p-3 rounded-lg border mb-4 ${getHealthBgColor()}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Pulse size={18} className={getHealthColor()} />
                        <span className="text-sm text-[var(--text-primary)]">System Health</span>
                    </div>
                    <span className={`text-xl font-bold ${getHealthColor()}`}>
                        {summary.healthPercentage}%
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Connections */}
                <div className="flex items-center gap-2">
                    <PlugsConnected size={16} className="text-blue-500" />
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {summary.activeConnections}/{summary.totalConnections}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">Connections</div>
                    </div>
                </div>

                {/* Errors */}
                <div className="flex items-center gap-2">
                    {summary.errorConnections > 0 ? (
                        <XCircle size={16} className="text-red-500" />
                    ) : (
                        <CheckCircle size={16} className="text-green-500" />
                    )}
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {summary.errorConnections}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">Errors</div>
                    </div>
                </div>

                {/* Critical Alerts */}
                <div className="flex items-center gap-2">
                    <Warning size={16} className={summary.criticalAlerts > 0 ? 'text-red-500' : 'text-gray-400'} />
                    <div>
                        <div className={`text-sm font-semibold ${summary.criticalAlerts > 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                            {summary.criticalAlerts}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">Critical</div>
                    </div>
                </div>

                {/* Warnings */}
                <div className="flex items-center gap-2">
                    <Warning size={16} className={summary.warningAlerts > 0 ? 'text-amber-500' : 'text-gray-400'} />
                    <div>
                        <div className={`text-sm font-semibold ${summary.warningAlerts > 0 ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
                            {summary.warningAlerts}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">Warnings</div>
                    </div>
                </div>
            </div>

            {/* Alert Banner (if any) */}
            {summary.unacknowledgedAlerts > 0 && (
                <Link 
                    to="/industrial"
                    className="mt-4 flex items-center justify-between p-2 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Warning size={14} className="text-red-500" />
                        <span className="text-xs text-red-600 font-medium">
                            {summary.unacknowledgedAlerts} unacknowledged alert{summary.unacknowledgedAlerts > 1 ? 's' : ''}
                        </span>
                    </div>
                    <ArrowRight size={12} className="text-red-500" />
                </Link>
            )}
        </div>
    );
};
