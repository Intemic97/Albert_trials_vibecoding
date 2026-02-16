import React, { useState, useEffect } from 'react';
import { 
    TrendUp, TrendDown, Minus, DotsSixVertical, X, Info,
    ArrowUp, ArrowDown, Equals
} from '@phosphor-icons/react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { WidgetFullConfig } from './WidgetConfigurator';

const DEFAULT_COLORS = ['#5B7476', '#84C4D1', '#3d8a84', '#5ba9a3', '#79c9c3'];

// ============================================================================
// KPI WIDGET
// ============================================================================

interface KPIWidgetProps {
    title: string;
    value: number | string;
    previousValue?: number;
    format?: 'number' | 'currency' | 'percentage';
    prefix?: string;
    suffix?: string;
    color?: string;
}

export const KPIWidget: React.FC<KPIWidgetProps> = ({
    title,
    value,
    previousValue,
    format = 'number',
    prefix = '',
    suffix = '',
    color = '#5B7476'
}) => {
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const change = previousValue ? ((numericValue - previousValue) / previousValue) * 100 : null;
    
    const formatValue = (val: number) => {
        switch (format) {
            case 'currency':
                return `${prefix}${val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
            case 'percentage':
                return `${val.toFixed(1)}%`;
            default:
                return `${prefix}${val.toLocaleString('es-ES')}${suffix}`;
        }
    };

    return (
        <div className="h-full flex flex-col justify-center p-4">
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">{title}</p>
            <p className="text-3xl font-light text-[var(--text-primary)]" style={{ color }}>
                {formatValue(numericValue)}
            </p>
            {change !== null && (
                <div className={`flex items-center gap-1 mt-2 text-sm ${
                    change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-[var(--text-tertiary)]'
                }`}>
                    {change > 0 ? <ArrowUp size={14} weight="bold" /> : change < 0 ? <ArrowDown size={14} weight="bold" /> : <Equals size={14} weight="bold" />}
                    <span>{Math.abs(change).toFixed(1)}%</span>
                    <span className="text-[var(--text-tertiary)] text-xs">vs anterior</span>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// STAT WIDGET
// ============================================================================

interface StatWidgetProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon?: React.ReactNode;
    color?: string;
}

export const StatWidget: React.FC<StatWidgetProps> = ({
    title,
    value,
    subtitle,
    icon,
    color = '#5B7476'
}) => {
    return (
        <div className="h-full flex items-center gap-4 p-4">
            {icon && (
                <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${color}20`, color }}
                >
                    {icon}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-light text-[var(--text-primary)] truncate">
                    {typeof value === 'number' ? value.toLocaleString('es-ES') : value}
                </p>
                {subtitle && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// GAUGE WIDGET
// ============================================================================

interface GaugeWidgetProps {
    title: string;
    value: number;
    min?: number;
    max?: number;
    thresholds?: { value: number; color: string }[];
    suffix?: string;
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({
    title,
    value,
    min = 0,
    max = 100,
    thresholds = [
        { value: 33, color: '#EF4444' },
        { value: 66, color: '#F59E0B' },
        { value: 100, color: '#10B981' }
    ],
    suffix = '%'
}) => {
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
    const currentColor = thresholds.reduce((acc, t) => percentage <= t.value ? acc : t.color, thresholds[0]?.color || '#5B7476');

    return (
        <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="relative w-32 h-16 overflow-hidden">
                {/* Background arc */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: `conic-gradient(from 180deg, var(--bg-tertiary) 0deg, var(--bg-tertiary) 180deg)`,
                        borderRadius: '100px 100px 0 0'
                    }}
                />
                {/* Value arc */}
                <div 
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                        background: `conic-gradient(from 180deg, ${currentColor} 0deg, ${currentColor} ${percentage * 1.8}deg, transparent ${percentage * 1.8}deg)`,
                        borderRadius: '100px 100px 0 0'
                    }}
                />
                {/* Center cutout */}
                <div className="absolute inset-2 bg-[var(--bg-card)]" style={{ borderRadius: '100px 100px 0 0' }} />
            </div>
            
            <div className="text-center -mt-4">
                <p className="text-2xl font-light text-[var(--text-primary)]" style={{ color: currentColor }}>
                    {value.toLocaleString('es-ES')}{suffix}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{title}</p>
            </div>
        </div>
    );
};

// ============================================================================
// TREND WIDGET (Sparkline)
// ============================================================================

interface TrendWidgetProps {
    title: string;
    value: number | string;
    data: Array<{ value: number }>;
    color?: string;
}

export const TrendWidget: React.FC<TrendWidgetProps> = ({
    title,
    value,
    data,
    color = '#5B7476'
}) => {
    const lastValue = data[data.length - 1]?.value || 0;
    const firstValue = data[0]?.value || 0;
    const trend = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return (
        <div className="h-full flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-light text-[var(--text-primary)]">
                    {typeof value === 'number' ? value.toLocaleString('es-ES') : value}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${
                    trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-[var(--text-tertiary)]'
                }`}>
                    {trend > 0 ? <TrendUp size={12} weight="bold" /> : trend < 0 ? <TrendDown size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                    <span>{Math.abs(trend).toFixed(1)}%</span>
                </div>
            </div>
            
            <div className="w-24 h-12">
                <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`sparkGradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={color} 
                            fill={`url(#sparkGradient-${title})`}
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ============================================================================
// CHART WIDGET (Universal)
// ============================================================================

interface ChartWidgetProps {
    config: WidgetFullConfig;
    onRemove: () => void;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({ config, onRemove }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const colors = config.colors || DEFAULT_COLORS;
    const data = config.data || [];

    // Determine what to render based on widget type
    const renderChart = () => {
        switch (config.type) {
            case 'kpi':
                const kpiValue = data[0]?.value || 0;
                return <KPIWidget title={config.title} value={kpiValue} color={colors[0]} />;
            
            case 'stat':
                const statValue = data[0]?.value || 0;
                return <StatWidget title={config.title} value={statValue} color={colors[0]} />;
            
            case 'gauge':
                const gaugeValue = data[0]?.value || 0;
                return <GaugeWidget title={config.title} value={gaugeValue} />;
            
            case 'trend':
                const trendValue = data[data.length - 1]?.value || 0;
                return <TrendWidget title={config.title} value={trendValue} data={data} color={colors[0]} />;
            
            case 'bar_chart':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }} 
                            />
                            <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            
            case 'line_chart':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }} 
                            />
                            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0], r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            
            case 'area_chart':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={colors[0]} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={colors[0]} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }} 
                            />
                            <Area type="monotone" dataKey="value" stroke={colors[0]} fill="url(#areaGradient)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            
            case 'pie_chart':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius="70%"
                                innerRadius="40%"
                                paddingAngle={2}
                            >
                                {data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }} 
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                );
            
            case 'table':
                return (
                    <div className="h-full overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]">Name</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)]">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)]">
                                {data.map((item, index) => (
                                    <tr key={index} className="hover:bg-[var(--bg-tertiary)]">
                                        <td className="px-3 py-2 text-[var(--text-primary)]">{item.name}</td>
                                        <td className="px-3 py-2 text-right text-[var(--text-secondary)] font-mono">
                                            {typeof item.value === 'number' ? item.value.toLocaleString('es-ES') : item.value}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            
            default:
                // For AI generated or unknown types, try to render as bar chart
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    const isCompactWidget = ['kpi', 'stat', 'gauge', 'trend'].includes(config.type);

    return (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm flex flex-col h-full w-full overflow-hidden">
            {/* Header */}
            <div className="drag-handle cursor-move px-3 py-2 border-b border-[var(--border-light)] flex items-center justify-between group hover:bg-[var(--bg-hover)] transition-all select-none shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-5 h-5 rounded bg-[var(--bg-tertiary)] group-hover:bg-[var(--border-light)] transition-colors">
                        <DotsSixVertical size={12} weight="bold" className="text-[var(--text-tertiary)]" />
                    </div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">{config.title}</h3>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    onMouseDown={e => e.stopPropagation()}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                    <X size={14} weight="light" />
                </button>
            </div>
            
            {/* Content */}
            <div className={`flex-1 ${isCompactWidget ? '' : 'p-3'}`} style={{ minHeight: 0 }}>
                {config.description && !isCompactWidget && (
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{config.description}</p>
                )}
                <div className="h-full">
                    {renderChart()}
                </div>
            </div>
        </div>
    );
};

export default ChartWidget;
