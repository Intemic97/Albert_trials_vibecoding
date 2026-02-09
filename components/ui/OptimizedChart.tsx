/**
 * Optimized Chart Component
 * Memoized wrapper for recharts with performance optimizations
 */

import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    LineChart,
    AreaChart,
    PieChart,
    Bar,
    Line,
    Area,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    TooltipProps
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut';

export interface ChartDataPoint {
    name: string;
    value: number;
    [key: string]: string | number;
}

export interface OptimizedChartProps {
    type: ChartType;
    data: ChartDataPoint[];
    dataKey?: string;
    xAxisKey?: string;
    height?: number;
    colors?: string[];
    showGrid?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    animate?: boolean;
    className?: string;
}

// ============================================================================
// DEFAULT COLORS
// ============================================================================

const DEFAULT_COLORS = [
    '#256A65', // Primary brand color
    '#84C4D1', // Secondary brand color
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
];

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

// Custom Tooltip (memoized)
const CustomTooltip = memo(({ 
    active, 
    payload, 
    label 
}: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg p-3 text-sm">
            <p className="font-medium text-[var(--text-primary)] mb-1">{label}</p>
            {payload.map((entry, index) => (
                <p key={index} style={{ color: entry.color }} className="text-xs">
                    {entry.name}: {typeof entry.value === 'number' 
                        ? entry.value.toLocaleString() 
                        : entry.value}
                </p>
            ))}
        </div>
    );
});
CustomTooltip.displayName = 'CustomTooltip';

// Custom Legend (memoized)
const CustomLegend = memo(({ payload }: { payload?: any[] }) => {
    if (!payload) return null;

    return (
        <div className="flex flex-wrap justify-center gap-4 mt-2">
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                    <div 
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-[var(--text-secondary)]">
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
});
CustomLegend.displayName = 'CustomLegend';

// ============================================================================
// CHART RENDERERS (MEMOIZED)
// ============================================================================

interface ChartRendererProps {
    data: ChartDataPoint[];
    dataKey: string;
    xAxisKey: string;
    colors: string[];
    showGrid: boolean;
    showLegend: boolean;
    showTooltip: boolean;
    animate: boolean;
}

// Bar Chart Renderer
const BarChartRenderer = memo<ChartRendererProps>(({
    data,
    dataKey,
    xAxisKey,
    colors,
    showGrid,
    showLegend,
    showTooltip,
    animate
}) => (
    <BarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />}
        <XAxis 
            dataKey={xAxisKey} 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        <YAxis 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        {showTooltip && <Tooltip content={<CustomTooltip />} />}
        {showLegend && <Legend content={<CustomLegend />} />}
        <Bar 
            dataKey={dataKey} 
            fill={colors[0]} 
            radius={[4, 4, 0, 0]}
            isAnimationActive={animate}
        />
    </BarChart>
));
BarChartRenderer.displayName = 'BarChartRenderer';

// Line Chart Renderer
const LineChartRenderer = memo<ChartRendererProps>(({
    data,
    dataKey,
    xAxisKey,
    colors,
    showGrid,
    showLegend,
    showTooltip,
    animate
}) => (
    <LineChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />}
        <XAxis 
            dataKey={xAxisKey} 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        <YAxis 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        {showTooltip && <Tooltip content={<CustomTooltip />} />}
        {showLegend && <Legend content={<CustomLegend />} />}
        <Line 
            type="monotone"
            dataKey={dataKey} 
            stroke={colors[0]}
            strokeWidth={2}
            dot={{ r: 4, fill: colors[0] }}
            activeDot={{ r: 6 }}
            isAnimationActive={animate}
        />
    </LineChart>
));
LineChartRenderer.displayName = 'LineChartRenderer';

// Area Chart Renderer
const AreaChartRenderer = memo<ChartRendererProps>(({
    data,
    dataKey,
    xAxisKey,
    colors,
    showGrid,
    showLegend,
    showTooltip,
    animate
}) => (
    <AreaChart data={data}>
        <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
            </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />}
        <XAxis 
            dataKey={xAxisKey} 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        <YAxis 
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={{ stroke: 'var(--border-light)' }}
        />
        {showTooltip && <Tooltip content={<CustomTooltip />} />}
        {showLegend && <Legend content={<CustomLegend />} />}
        <Area 
            type="monotone"
            dataKey={dataKey} 
            stroke={colors[0]}
            fill="url(#areaGradient)"
            isAnimationActive={animate}
        />
    </AreaChart>
));
AreaChartRenderer.displayName = 'AreaChartRenderer';

// Pie Chart Renderer
interface PieChartRendererProps extends Omit<ChartRendererProps, 'xAxisKey' | 'showGrid'> {
    innerRadius?: number;
}

const PieChartRenderer = memo<PieChartRendererProps>(({
    data,
    dataKey,
    colors,
    showLegend,
    showTooltip,
    animate,
    innerRadius = 0
}) => (
    <PieChart>
        {showTooltip && <Tooltip content={<CustomTooltip />} />}
        {showLegend && <Legend content={<CustomLegend />} />}
        <Pie
            data={data}
            dataKey={dataKey}
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={animate}
        >
            {data.map((_, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={colors[index % colors.length]}
                />
            ))}
        </Pie>
    </PieChart>
));
PieChartRenderer.displayName = 'PieChartRenderer';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OptimizedChart = memo<OptimizedChartProps>(({
    type,
    data,
    dataKey = 'value',
    xAxisKey = 'name',
    height = 300,
    colors = DEFAULT_COLORS,
    showGrid = true,
    showLegend = false,
    showTooltip = true,
    animate = true,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasValidSize, setHasValidSize] = useState(false);

    useEffect(() => {
        const updateSize = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.offsetWidth;
            const h = containerRef.current.offsetHeight;
            setHasValidSize(w > 10 && h > 10);
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, [height]);

    // Memoize processed data
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data;
    }, [data]);

    // Memoize colors array
    const chartColors = useMemo(() => {
        return colors.length > 0 ? colors : DEFAULT_COLORS;
    }, [colors]);

    // Render nothing if no data
    if (processedData.length === 0) {
        return (
            <div 
                className={`flex items-center justify-center text-[var(--text-tertiary)] text-sm ${className}`}
                style={{ height }}
            >
                No data available
            </div>
        );
    }

    // Common props for chart renderers
    const commonProps = {
        data: processedData,
        dataKey,
        xAxisKey,
        colors: chartColors,
        showGrid,
        showLegend,
        showTooltip,
        animate
    };

    // Render appropriate chart type
    const renderChart = () => {
        switch (type) {
            case 'bar':
                return <BarChartRenderer {...commonProps} />;
            case 'line':
                return <LineChartRenderer {...commonProps} />;
            case 'area':
                return <AreaChartRenderer {...commonProps} />;
            case 'pie':
                return <PieChartRenderer {...commonProps} innerRadius={0} />;
            case 'donut':
                return <PieChartRenderer {...commonProps} innerRadius={60} />;
            default:
                return <BarChartRenderer {...commonProps} />;
        }
    };

    return (
        <div ref={containerRef} className={className} style={{ height, minHeight: height }}>
            {hasValidSize ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    {renderChart()}
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                    Loading chart...
                </div>
            )}
        </div>
    );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;
