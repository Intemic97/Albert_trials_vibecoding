import React, { useRef, useState, useEffect, memo, useCallback } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    RadialBarChart, RadialBar
} from 'recharts';

export interface WidgetConfig {
    type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'radial';
    title: string;
    description: string;
    explanation?: string;
    data: any[];
    xAxisKey: string;
    dataKey: string | string[];
    colors?: string[];
}

interface DynamicChartProps {
    config: WidgetConfig;
    height?: number;
}

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

export const DynamicChart: React.FC<DynamicChartProps> = memo(({ config, height = 250 }) => {
    const { type, data, xAxisKey, dataKey, colors = DEFAULT_COLORS } = config;
    const containerRef = useRef<HTMLDivElement>(null);
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
                            paddingAngle={3}
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
                            filter="url(#shadow)"
                        >
                            {data.map((_, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={`url(#pieGradient-${index % colors.length})`}
                                    stroke={isDarkMode ? '#1f1f1f' : '#ffffff'}
                                    strokeWidth={2}
                                    style={{
                                        transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
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

    return (
        <div ref={containerRef} style={{ width: '100%', height: height, minHeight: height }}>
            <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
            </ResponsiveContainer>
        </div>
    );
});
