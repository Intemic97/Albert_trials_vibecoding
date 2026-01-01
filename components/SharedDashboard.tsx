import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Database, Info } from 'lucide-react';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { API_BASE } from '../config';

interface SharedDashboardData {
    dashboard: {
        id: string;
        name: string;
        description?: string;
        createdAt: string;
    };
    widgets: Array<{
        id: string;
        title: string;
        description?: string;
        config: WidgetConfig;
        position: number;
    }>;
}

interface SharedDashboardProps {
    shareToken: string;
}

const WidgetCard: React.FC<{ widget: WidgetConfig }> = ({ widget }) => {
    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">{widget.title}</h3>
            <p className="text-xs text-slate-500 mb-4">{widget.description}</p>

            <DynamicChart config={widget} />

            {widget.explanation && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                        <Info size={12} />
                        How was this prepared?
                    </button>

                    {showExplanation && (
                        <div className="mt-2 p-3 bg-teal-50 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {widget.explanation}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const SharedDashboard: React.FC<SharedDashboardProps> = ({ shareToken }) => {
    const [data, setData] = useState<SharedDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboard();
    }, [shareToken]);

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_BASE}/shared/${shareToken}`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError('Dashboard not found or is no longer shared.');
                } else {
                    setError('Failed to load dashboard.');
                }
                return;
            }
            const dashboardData = await res.json();
            setData(dashboardData);
        } catch (err) {
            console.error('Error fetching shared dashboard:', err);
            setError('Failed to load dashboard. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <LayoutDashboard className="mx-auto text-slate-300 mb-4" size={48} />
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Dashboard Unavailable</h1>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{data.dashboard.name}</h1>
                        {data.dashboard.description && (
                            <p className="text-xs text-slate-500">{data.dashboard.description}</p>
                        )}
                    </div>
                </div>
                <div className="text-xs text-slate-400">
                    Shared Dashboard
                </div>
            </header>

            {/* Main Content */}
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {data.widgets.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {data.widgets.map((widget) => (
                                <WidgetCard key={widget.id} widget={widget.config} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                            <Database className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">No widgets</h3>
                            <p className="text-sm text-slate-500">
                                This dashboard doesn't have any widgets yet.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-slate-400">
                Powered by Intemic
            </footer>
        </div>
    );
};





