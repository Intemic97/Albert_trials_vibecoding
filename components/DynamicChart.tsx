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
    type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'radial' | 'gauge' | 'parallel' | 'heatmap' | 'scatter_matrix' | 'sankey' | 'bubble' | 'timeline' | 'multi_timeline';
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
    // Gauge configs
    min?: number;
    max?: number;
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

// Premium color palette - Branding colors elegantes
const DEFAULT_COLORS = [
    '#419CAF', // Primary teal (main)
    '#E8985E', // Warm orange (contrast)
    '#337B8B', // Dark teal
    '#86D5D0', // Light mint
    '#265B66', // Deep teal
    '#D4A574', // Muted orange
    '#3FB6AE', // Bright teal
    '#C4937A', // Warm neutral
];

// Alternative palette for pie/donut - warm golden tones (sophisticated)
const PIE_COLORS = [
    '#D4875E', // Deep orange
    '#E8A870', // Medium orange
    '#F2C896', // Light orange
    '#F8DDB8', // Pale orange
    '#C67B52', // Dark terracotta
    '#EBBB82', // Golden
    '#F5D4A8', // Cream orange
    '#B86B45', // Deep terracotta
];

// Tooltip personalizado con mejor diseño
const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
        <div 
            className="px-3 py-2.5 rounded-lg shadow-lg"
            style={{
                backgroundColor: isDarkMode ? '#252525' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
                backdropFilter: 'blur(8px)',
            }}
        >
            {label && (
                <p 
                    className="text-[11px] font-medium mb-2 pb-2 border-b"
                    style={{ 
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        borderColor: isDarkMode ? '#333' : '#e5e7eb'
                    }}
                >
                    {label}
                </p>
            )}
            <div className="space-y-1">
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color || entry.fill }}
                            />
                            <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                                {entry.name}
                            </span>
                        </div>
                        <span 
                            className="font-semibold tabular-nums"
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
        </div>
    );
};

// Leyenda personalizada más elegante
const CustomLegend = ({ payload, isDarkMode }: any) => {
    if (!payload || !payload.length) return null;
    
    return (
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3 px-2">
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                    <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span 
                        className="text-[11px] font-medium"
                        style={{ color: isDarkMode ? '#9ca3af' : '#64748b' }}
                    >
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

// Label personalizado para gráficos de pie - estilo externo elegante
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value, name, index }: any) => {
    if (percent < 0.03) return null;
    
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    
    // Punto en el borde del pie
    const sx = cx + outerRadius * cos;
    const sy = cy + outerRadius * sin;
    
    // Punto del codo de la línea
    const mx = cx + (outerRadius + 15) * cos;
    const my = cy + (outerRadius + 15) * sin;
    
    // Punto final de la línea
    const ex = mx + (cos >= 0 ? 1 : -1) * 20;
    const ey = my;
    
    const textAnchor = cos >= 0 ? 'start' : 'end';
    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
    
    return (
        <g>
            {/* Línea conectora */}
            <path
                d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                stroke={isDark ? '#555' : '#ccc'}
                fill="none"
                strokeWidth={1}
            />
            {/* Punto en el borde */}
            <circle cx={sx} cy={sy} r={2} fill={isDark ? '#888' : '#999'} />
            {/* Valor */}
            <text
                x={ex + (cos >= 0 ? 4 : -4)}
                y={ey - 8}
                textAnchor={textAnchor}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
                style={{ fontSize: '13px', fontWeight: 700 }}
            >
                {Math.round(percent * 100)}
            </text>
            {/* Nombre */}
            <text
                x={ex + (cos >= 0 ? 4 : -4)}
                y={ey + 6}
                textAnchor={textAnchor}
                fill={isDark ? '#9ca3af' : '#6b7280'}
                style={{ fontSize: '10px', fontWeight: 500 }}
            >
                {name}
            </text>
        </g>
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
                // Single color for bars - more elegant
                const barColor = colors[0] || '#419CAF';
                return (
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="20%">
                        <defs>
                            <linearGradient id="barGradientMain" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={barColor} stopOpacity={0.9} />
                                <stop offset="100%" stopColor={barColor} stopOpacity={0.6} />
                            </linearGradient>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`barGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey={xAxisKey} {...axisProps} tickMargin={8} />
                        <YAxis {...axisProps} tickMargin={8} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                        {Array.isArray(dataKey) && dataKey.length > 1 && (
                            <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        )}
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Bar 
                                    key={key} 
                                    dataKey={key} 
                                    fill={`url(#barGradient-${index % colors.length})`}
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={800}
                                    animationEasing="ease-out"
                                    maxBarSize={50}
                                />
                            ))
                        ) : (
                            <Bar 
                                dataKey={dataKey} 
                                fill="url(#barGradientMain)"
                                radius={[4, 4, 0, 0]}
                                animationDuration={800}
                                animationEasing="ease-out"
                                maxBarSize={50}
                            />
                        )}
                    </BarChart>
                );
                
            case 'line':
                const lineColor = colors[0] || '#419CAF';
                return (
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`lineGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey={xAxisKey} {...axisProps} tickMargin={8} />
                        <YAxis {...axisProps} tickMargin={8} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        {Array.isArray(dataKey) && dataKey.length > 1 && (
                            <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        )}
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Line 
                                    key={key} 
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={colors[index % colors.length]} 
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5, fill: colors[index % colors.length], strokeWidth: 2, stroke: isDarkMode ? '#1a1a1a' : '#ffffff' }}
                                    animationDuration={1000}
                                />
                            ))
                        ) : (
                            <Line 
                                type="monotone" 
                                dataKey={dataKey} 
                                stroke={lineColor} 
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 5, fill: lineColor, strokeWidth: 2, stroke: isDarkMode ? '#1a1a1a' : '#ffffff' }}
                                animationDuration={1000}
                            />
                        )}
                    </LineChart>
                );
                
            case 'area':
                const areaColor = colors[0] || '#419CAF';
                return (
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGradientMain" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={areaColor} stopOpacity={0.02} />
                            </linearGradient>
                            {colors.map((color, i) => (
                                <linearGradient key={i} id={`areaGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey={xAxisKey} {...axisProps} tickMargin={8} />
                        <YAxis {...axisProps} tickMargin={8} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        {Array.isArray(dataKey) && dataKey.length > 1 && (
                            <Legend content={<CustomLegend isDarkMode={isDarkMode} />} />
                        )}
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
                                stroke={areaColor} 
                                strokeWidth={2}
                                fill="url(#areaGradientMain)"
                                animationDuration={1000}
                            />
                        )}
                    </AreaChart>
                );
                
            case 'pie':
            case 'donut':
                const { innerRadius, outerRadius } = getRadii();
                const pieColors = PIE_COLORS;
                const total = data.reduce((sum, item) => sum + (item[actualDataKey] || 0), 0);
                
                // Calculate variable outer radius based on value (larger values extend further)
                const maxValue = Math.max(...data.map(d => d[actualDataKey] || 0));
                const getOuterRadius = (value: number) => {
                    const baseRadius = outerRadius * 0.85;
                    const extraRadius = outerRadius * 0.15 * (value / maxValue);
                    return baseRadius + extraRadius;
                };
                
                return (
                    <PieChart margin={{ top: 30, right: 60, bottom: 30, left: 60 }}>
                        <defs>
                            {pieColors.map((color, i) => (
                                <linearGradient key={i} id={`pieGradient-${i}`} x1="0" y1="0" x2="0.5" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.85} />
                                </linearGradient>
                            ))}
                        </defs>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={type === 'donut' ? outerRadius * 0.35 : outerRadius * 0.15}
                            outerRadius={(entry) => getOuterRadius(entry[actualDataKey] || 0)}
                            dataKey={actualDataKey}
                            nameKey={xAxisKey || 'name'}
                            paddingAngle={1}
                            cornerRadius={3}
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                            onMouseEnter={onPieEnter}
                            onMouseLeave={onPieLeave}
                            label={renderCustomizedLabel}
                            labelLine={false}
                        >
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={pieColors[index % pieColors.length]}
                                    stroke="none"
                                    style={{
                                        filter: activeIndex === index ? 'brightness(1.08) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                                        transition: 'filter 0.2s ease-out',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                        {/* Centro con círculo decorativo */}
                        <circle
                            cx="50%"
                            cy="50%"
                            r={outerRadius * 0.12}
                            fill={isDarkMode ? '#252525' : '#ffffff'}
                            stroke={isDarkMode ? '#333' : '#e5e7eb'}
                            strokeWidth={1}
                        />
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
                if (config.nodes && config.links && config.nodes.length > 0 && config.links.length > 0) {
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
                    ...data.map(d => d.source || d.from || d[xAxisKey]),
                    ...data.map(d => d.target || d.to || d[actualDataKey])
                ].filter(Boolean))).map(id => ({ id: String(id) }));
                const sankeyLinks = data.map(d => ({
                    source: String(d.source || d.from || d[xAxisKey] || ''),
                    target: String(d.target || d.to || d[actualDataKey] || ''),
                    value: parseFloat(d[config.valueKey || 'value'] || d[actualDataKey] || '1') || 1
                })).filter(l => l.source && l.target && l.source !== l.target);
                
                if (sankeyNodes.length === 0 || sankeyLinks.length === 0) {
                    return (
                        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
                            <div className="text-center">
                                <p>Sankey chart requires data with source/target relationships</p>
                                <p className="text-xs mt-1">Expected format: source, target, value</p>
                            </div>
                        </div>
                    );
                }
                
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
                
            case 'radial':
                // Radial Bar Chart
                if (data.length === 0) {
                    return (
                        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
                            No data available for radial chart
                        </div>
                    );
                }
                
                const radialData = data.map((d, idx) => ({
                    name: String(d[xAxisKey] || d.name || `Item ${idx + 1}`),
                    value: parseFloat(d[actualDataKey]) || 0,
                    fill: colors[idx % colors.length]
                })).filter(d => d.value > 0); // Filter out zero values
                
                if (radialData.length === 0) {
                    return (
                        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
                            No valid data values for radial chart
                        </div>
                    );
                }
                
                return (
                    <ResponsiveContainer width="100%" height={height} minWidth={100} minHeight={100}>
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="20%"
                            outerRadius="80%"
                            data={radialData}
                            startAngle={90}
                            endAngle={-270}
                        >
                            <RadialBar
                                dataKey="value"
                                cornerRadius={4}
                                fill="#419CAF"
                            />
                            <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                            <Legend />
                        </RadialBarChart>
                    </ResponsiveContainer>
                );
                
            case 'gauge':
                // Gauge Chart (semicircular gauge)
                if (data.length === 0) {
                    return (
                        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
                            No data available for gauge chart
                        </div>
                    );
                }
                
                // Get value from first data point or sum all values
                let gaugeValue = 0;
                if (Array.isArray(dataKey)) {
                    gaugeValue = data.reduce((sum, d) => sum + (parseFloat(d[dataKey[0]]) || 0), 0);
                } else {
                    gaugeValue = parseFloat(data[0]?.[actualDataKey]) || 
                                 data.reduce((sum, d) => sum + (parseFloat(d[actualDataKey]) || 0), 0);
                }
                
                const gaugeMin = config.min ?? 0;
                const gaugeMax = config.max ?? (gaugeValue > 0 ? gaugeValue * 1.2 : 100);
                const gaugePercentage = Math.min(Math.max(((gaugeValue - gaugeMin) / (gaugeMax - gaugeMin)) * 100, 0), 100);
                const gaugeColor = gaugePercentage >= 80 ? '#10b981' : gaugePercentage >= 50 ? '#f59e0b' : '#ef4444';
                
                // Create gauge data
                const gaugeData = [
                    { name: 'value', value: gaugePercentage, fill: gaugeColor },
                    { name: 'remaining', value: 100 - gaugePercentage, fill: isDarkMode ? '#2a2a2a' : '#f3f4f6' }
                ];
                
                return (
                    <ResponsiveContainer width="100%" height={height} minWidth={100} minHeight={100}>
                        <RadialBarChart
                            cx="50%"
                            cy="90%"
                            innerRadius="40%"
                            outerRadius="80%"
                            data={gaugeData}
                            startAngle={180}
                            endAngle={0}
                        >
                            <RadialBar
                                dataKey="value"
                                cornerRadius={8}
                                fill={gaugeColor}
                            />
                            <text
                                x="50%"
                                y="45%"
                                textAnchor="middle"
                                fill={isDarkMode ? '#e8e8e8' : '#1f2937'}
                                fontSize={32}
                                fontWeight="bold"
                            >
                                {gaugeValue.toFixed(1)}
                            </text>
                            <text
                                x="50%"
                                y="52%"
                                textAnchor="middle"
                                fill={isDarkMode ? '#9ca3af' : '#6b7280'}
                                fontSize={14}
                            >
                                {config.subtitle || `${gaugeMin} - ${gaugeMax}`}
                            </text>
                        </RadialBarChart>
                    </ResponsiveContainer>
                );
                
            default:
                return <div className="text-[var(--text-tertiary)]">Unsupported chart type</div>;
        }
    };

    // Loading state
    const hasValidSize = dimensions.width > 10 && dimensions.height > 10;
    if (!isReady || !hasValidSize || !data || data.length === 0) {
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
