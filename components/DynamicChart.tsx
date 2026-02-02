import React, { useRef, useState, useEffect, memo, useCallback, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    RadialBarChart, RadialBar
} from 'recharts';
import {
    ParallelCoordinatesChart,
    HeatmapChart,
    ScatterMatrixChart,
    SankeyChart,
    BubbleChart,
    SeverityTimelineChart,
    MultiTrackTimelineChart
} from './dashboard/AdvancedCharts';

export interface WidgetConfig {
    type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'radial' | 'parallel' | 'heatmap' | 'scatter_matrix' | 'sankey' | 'bubble' | 'timeline' | 'multi_timeline';
    title: string;
    description: string;
    explanation?: string;
    data: any[];
    xAxisKey: string;
    dataKey: string | string[];
    colors?: string[];
    // Advanced chart configs
    dimensions?: string[];
    yKey?: string;
    valueKey?: string;
    sizeKey?: string;
    colorKey?: string;
    nodes?: { id: string; value?: number }[];
    links?: { source: string; target: string; value: number }[];
    // Timeline configs
    events?: { start: string | Date; end?: string | Date; severity: string; label?: string }[];
    tracks?: { id: string; title: string; subtitle?: string; events: any[] }[];
    subtitle?: string;
}

export interface DateRange {
    start: string;
    end: string;
}

interface DynamicChartProps {
    config: WidgetConfig;
    height?: number;
    dateRange?: DateRange;
}

// Helper function to filter data by date range
const filterDataByDateRange = (data: any[], dateRange?: DateRange): any[] => {
    if (!dateRange || !data || data.length === 0) return data;
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    
    // Common date field names to look for
    const dateFields = ['date', 'fecha', 'timestamp', 'time', 'created_at', 'createdAt', 'month', 'day', 'periodo', 'period'];
    const dateField = dateFields.find(field => data[0]?.[field] !== undefined);
    
    if (!dateField) return data;
    
    return data.filter(item => {
        const itemDate = new Date(item[dateField]);
        return !isNaN(itemDate.getTime()) && itemDate >= startDate && itemDate <= endDate;
    });
};

// Premium color palette - más profesional y elegante
const DEFAULT_COLORS = [
    '#256A65', // Primary teal
    '#5BA9A3', // Light teal
    '#84C4D1', // Sky blue
    '#3D7A75', // Dark teal
    '#A8D5D8', // Pale blue
    '#1E5A55', // Deep teal
    '#7EBDC3', // Medium blue
    '#4A9590', // Muted teal
];

// Tooltip personalizado con mejor diseño
const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
        <div 
            className="px-3 py-2 rounded-lg shadow-xl border"
            style={{
                backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                borderColor: isDarkMode ? '#333' : '#e5e7eb',
            }}
        >
            {label && (
                <p 
                    className="text-xs font-semibold mb-1.5 pb-1.5 border-b"
                    style={{ 
                        color: isDarkMode ? '#e8e8e8' : '#1f2937',
                        borderColor: isDarkMode ? '#333' : '#e5e7eb'
                    }}
                >
                    {label}
                </p>
            )}
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                    <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: entry.color || entry.fill }}
                    />
                    <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                        {entry.name}:
                    </span>
                    <span 
                        className="font-semibold"
                        style={{ color: isDarkMode ? '#e8e8e8' : '#1f2937' }}
                    >
                        {typeof entry.value === 'number' 
                            ? entry.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })
                            : entry.value
                        }
                    </span>
                </div>
            ))}
        </div>
    );
};

// Leyenda personalizada más elegante
const CustomLegend = ({ payload, isDarkMode }: any) => {
    if (!payload || !payload.length) return null;
    
    return (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-1.5">
                    <div 
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span 
                        className="text-xs"
                        style={{ color: isDarkMode ? '#9ca3af' : '#64748b' }}
                    >
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

// Label personalizado para gráficos de pie/donut - más limpio
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, fill }: any) => {
    if (percent < 0.05) return null; // No mostrar etiquetas para valores muy pequeños
    
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
        <text 
            x={x} 
            y={y} 
            fill={fill}
            textAnchor={x > cx ? 'start' : 'end'} 
            dominantBaseline="central"
            style={{ 
                fontSize: '11px', 
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(255,255,255,0.8)'
            }}
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export const DynamicChart: React.FC<DynamicChartProps> = memo(({ config, height = 250, dateRange }) => {
    const { type, data: rawData, xAxisKey, dataKey, colors = DEFAULT_COLORS } = config;
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Filter data by date range if provided
    const data = React.useMemo(() => filterDataByDateRange(rawData, dateRange), [rawData, dateRange]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isReady, setIsReady] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // Track container size for responsive charts
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                const height = containerRef.current.offsetHeight;
                setDimensions({ width, height });
                if (width > 0 && height > 0) {
                    setIsReady(true);
                }
            }
        };

        const timer = setTimeout(updateDimensions, 50);
        const resizeObserver = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
        };
    }, []);

    // Calculate radius for pie/donut charts
    const getRadii = useCallback(() => {
        const minDimension = Math.min(dimensions.width, dimensions.height);
        const outerRadius = Math.max(50, Math.min(minDimension * 0.32, 120));
        const innerRadius = type === 'donut' || type === 'pie' ? outerRadius * 0.55 : 0;
        return { innerRadius, outerRadius };
    }, [dimensions, type]);

    // Detect dark mode
    const isDarkMode = typeof window !== 'undefined' && 
        document.documentElement.classList.contains('dark');
    
    // Theme colors
    const gridColor = isDarkMode ? '#333' : '#f1f5f9';
    const tickColor = isDarkMode ? '#9ca3af' : '#64748b';
    const axisLineColor = isDarkMode ? '#404040' : '#e2e8f0';

    // Common axis props
    const axisProps = {
        tick: { fill: tickColor, fontSize: 11 },
        tickLine: { stroke: axisLineColor },
        axisLine: { stroke: axisLineColor },
    };

    const onPieEnter = (_: any, index: number) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    const renderChart = () => {
        const actualDataKey = Array.isArray(dataKey) ? dataKey[0] : dataKey;
        
        switch (type) {
            case 'bar':
                return (
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`barGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey={xAxisKey} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Bar 
                                    key={key} 
                                    dataKey={key} 
                                    fill={`url(#barGradient-${index % colors.length})`}
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={800}
                                    animationEasing="ease-out"
                                />
                            ))
                        ) : (
                            <Bar 
                                dataKey={dataKey} 
                                fill={`url(#barGradient-0)`}
                                radius={[6, 6, 0, 0]}
                                animationDuration={800}
                                animationEasing="ease-out"
                            />
                        )}
                    </BarChart>
                );
                
            case 'line':
                return (
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`lineGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey={xAxisKey} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Line 
                                    key={key} 
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={colors[index % colors.length]} 
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: colors[index % colors.length] }}
                                    activeDot={{ r: 6, fill: colors[index % colors.length], strokeWidth: 0 }}
                                    animationDuration={1000}
                                />
                            ))
                        ) : (
                            <Line 
                                type="monotone" 
                                dataKey={dataKey} 
                                stroke={colors[0]} 
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: colors[0] }}
                                activeDot={{ r: 6, fill: colors[0], strokeWidth: 0 }}
                                animationDuration={1000}
                            />
                        )}
                    </LineChart>
                );
                
            case 'area':
                return (
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`areaGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey={xAxisKey} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Area 
                                    key={key} 
                                    type="monotone" 
                                    dataKey={key} 
                                    stackId="1"
                                    stroke={colors[index % colors.length]} 
                                    strokeWidth={2}
                                    fill={`url(#areaGradient-${index % colors.length})`}
                                    animationDuration={1000}
                                />
                            ))
                        ) : (
                            <Area 
                                type="monotone" 
                                dataKey={dataKey} 
                                stroke={colors[0]} 
                                strokeWidth={2}
                                fill={`url(#areaGradient-0)`}
                                animationDuration={1000}
                            />
                        )}
                    </AreaChart>
                );
                
            case 'pie':
            case 'donut':
                const { innerRadius, outerRadius } = getRadii();
                const showLabels = dimensions.width > 280;
                
                return (
                    <PieChart>
                        <defs>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`pieGradient-${i}`} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.75} />
                                </linearGradient>
                            ))}
                            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                            </filter>
                        </defs>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius={outerRadius}
                            dataKey={actualDataKey}
                            nameKey={xAxisKey || 'name'}
                            paddingAngle={0}
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                            onMouseEnter={onPieEnter}
                            onMouseLeave={onPieLeave}
                            label={showLabels ? (props) => renderCustomizedLabel({
                                ...props,
                                fill: colors[props.index % colors.length]
                            }) : false}
                            labelLine={showLabels ? {
                                stroke: isDarkMode ? '#666' : '#cbd5e1',
                                strokeWidth: 1,
                            } : false}
                        >
                            {data.map((_, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={`url(#pieGradient-${index % colors.length})`}
                                    stroke="none"
                                    style={{
                                        transform: activeIndex === index ? 'scale(1.02)' : 'scale(1)',
                                        transformOrigin: 'center',
                                        transition: 'transform 0.2s ease-out',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        <Legend 
                            content={<CustomLegend isDarkMode={isDarkMode} />}
                            verticalAlign="bottom"
                        />
                        {/* Centro con valor total para donut */}
                        {(type === 'donut' || type === 'pie') && innerRadius > 0 && (
                            <text
                                x="50%"
                                y="50%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fill: isDarkMode ? '#e8e8e8' : '#1f2937'
                                }}
                            >
                                {data.reduce((sum, item) => sum + (item[actualDataKey] || 0), 0).toLocaleString('es-ES')}
                            </text>
                        )}
                    </PieChart>
                );
                
            case 'parallel':
                // Parallel Coordinates Chart
                const parallelDimensions = config.dimensions || 
                    (data[0] ? Object.keys(data[0]).filter(k => typeof data[0][k] === 'number').slice(0, 6) : []);
                return (
                    <ParallelCoordinatesChart
                        data={data}
                        dimensions={parallelDimensions}
                        colorKey={config.colorKey}
                        height={height}
                    />
                );
                
            case 'heatmap':
                // Heatmap Chart
                return (
                    <HeatmapChart
                        data={data}
                        xKey={xAxisKey}
                        yKey={config.yKey || 'category'}
                        valueKey={config.valueKey || (Array.isArray(dataKey) ? dataKey[0] : dataKey)}
                        height={height}
                    />
                );
                
            case 'scatter_matrix':
                // Scatter Matrix Chart
                const scatterDimensions = config.dimensions || 
                    (data[0] ? Object.keys(data[0]).filter(k => typeof data[0][k] === 'number').slice(0, 4) : []);
                return (
                    <ScatterMatrixChart
                        data={data}
                        dimensions={scatterDimensions}
                        colorKey={config.colorKey}
                        height={height}
                    />
                );
                
            case 'sankey':
                // Sankey Diagram
                if (config.nodes && config.links) {
                    return (
                        <SankeyChart
                            nodes={config.nodes}
                            links={config.links}
                            height={height}
                        />
                    );
                }
                // Auto-generate from data if no nodes/links provided
                const sankeyNodes = Array.from(new Set([
                    ...data.map(d => d.source || d.from),
                    ...data.map(d => d.target || d.to)
                ].filter(Boolean))).map(id => ({ id: id as string }));
                const sankeyLinks = data.map(d => ({
                    source: d.source || d.from,
                    target: d.target || d.to,
                    value: parseFloat(d[config.valueKey || 'value']) || 1
                })).filter(l => l.source && l.target);
                return (
                    <SankeyChart
                        nodes={sankeyNodes}
                        links={sankeyLinks}
                        height={height}
                    />
                );
                
            case 'bubble':
                // Bubble Chart
                return (
                    <BubbleChart
                        data={data}
                        xKey={xAxisKey}
                        yKey={config.yKey || (Array.isArray(dataKey) ? dataKey[0] : dataKey)}
                        sizeKey={config.sizeKey || (Array.isArray(dataKey) && dataKey[1] ? dataKey[1] : 'size')}
                        colorKey={config.colorKey}
                        height={height}
                    />
                );
                
            case 'timeline':
                // Severity Timeline
                const timelineEvents = config.events || data.map(d => ({
                    start: d.start || d.timestamp || d.date || d.time,
                    end: d.end,
                    severity: d.severity || 'medium',
                    label: d.label || d.name || d.description
                }));
                return (
                    <SeverityTimelineChart
                        title={config.title}
                        subtitle={config.subtitle || config.description}
                        events={timelineEvents as any}
                        height={height}
                    />
                );
                
            case 'multi_timeline':
                // Multi-Track Timeline
                if (config.tracks) {
                    return (
                        <MultiTrackTimelineChart
                            tracks={config.tracks}
                            height={height}
                        />
                    );
                }
                // Auto-generate tracks from data grouped by a key
                const groupKey = config.colorKey || 'asset' || 'detector' || 'category';
                const groups = new Map<string, any[]>();
                data.forEach(d => {
                    const key = d[groupKey] || 'Default';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push({
                        start: d.start || d.timestamp || d.date,
                        end: d.end,
                        severity: d.severity || 'medium',
                        label: d.label
                    });
                });
                const autoTracks = Array.from(groups.entries()).map(([id, events]) => ({
                    id,
                    title: id,
                    events
                }));
                return (
                    <MultiTrackTimelineChart
                        tracks={autoTracks}
                        height={height}
                    />
                );
                
            default:
                return <div className="text-[var(--text-tertiary)]">Unsupported chart type</div>;
        }
    };

    // Loading state
    if (!isReady || !data || data.length === 0) {
        return (
            <div 
                ref={containerRef} 
                style={{ width: '100%', height: height, minHeight: height }}
                className="flex items-center justify-center text-[var(--text-tertiary)] text-sm"
            >
                {!data || data.length === 0 ? 'No data available' : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[var(--border-medium)] border-t-[#256A65] rounded-full animate-spin" />
                        <span className="text-xs">Loading chart...</span>
                    </div>
                )}
            </div>
        );
    }

    // Advanced charts handle their own sizing
    const isAdvancedChart = ['parallel', 'heatmap', 'scatter_matrix', 'sankey', 'bubble', 'timeline', 'multi_timeline'].includes(type);

    return (
        <div ref={containerRef} style={{ width: '100%', height: height, minHeight: height }} className="relative">
            {isAdvancedChart ? (
                renderChart()
            ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    {renderChart()}
                </ResponsiveContainer>
            )}
        </div>
    );
});
