import React, { useRef, useState, useEffect, memo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

export interface WidgetConfig {
    type: 'bar' | 'line' | 'pie' | 'area';
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
}

const DEFAULT_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];

export const DynamicChart: React.FC<DynamicChartProps> = memo(({ config }) => {
    const { type, data, xAxisKey, dataKey, colors = DEFAULT_COLORS } = config;
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Track container size for responsive pie chart
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        updateDimensions();
        
        // Use ResizeObserver for better performance
        const resizeObserver = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Calculate pie chart radius based on container size
    const getPieRadius = () => {
        const minDimension = Math.min(dimensions.width, dimensions.height);
        return Math.max(40, Math.min(minDimension * 0.35, 150));
    };

    const renderChart = () => {
        switch (type) {
            case 'bar':
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey={xAxisKey} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                        />
                        <Legend />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
                            ))
                        ) : (
                            <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
                        )}
                    </BarChart>
                );
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey={xAxisKey} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                        />
                        <Legend />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={2} dot={{ r: 4 }} />
                            ))
                        ) : (
                            <Line type="monotone" dataKey={dataKey} stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
                        )}
                    </LineChart>
                );
            case 'area':
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey={xAxisKey} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                        />
                        <Legend />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((key, index) => (
                                <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.6} />
                            ))
                        ) : (
                            <Area type="monotone" dataKey={dataKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
                        )}
                    </AreaChart>
                );
            case 'pie':
                const pieRadius = getPieRadius();
                const showLabels = dimensions.width > 300 && dimensions.height > 200;
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={showLabels}
                            label={showLabels ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                            outerRadius={pieRadius}
                            innerRadius={pieRadius > 60 ? pieRadius * 0.4 : 0}
                            fill="#8884d8"
                            dataKey={Array.isArray(dataKey) ? dataKey[0] : dataKey}
                            paddingAngle={2}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Legend 
                            wrapperStyle={{ fontSize: dimensions.width < 300 ? '10px' : '12px' }}
                        />
                    </PieChart>
                );
            default:
                return <div>Unsupported chart type</div>;
        }
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
            </ResponsiveContainer>
        </div>
    );
});
