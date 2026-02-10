import React, { useState, useMemo, useCallback } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Cell, ZAxis, Legend
} from 'recharts';

// ============================================================================
// COLOR PALETTES
// ============================================================================

const ADVANCED_COLORS = [
    '#FF6B35', '#F7C94B', '#88D498', '#4ECDC4', '#556FB5',
    '#9B5DE5', '#F15BB5', '#00BBF9', '#00F5D4', '#FEE440'
];

const HEATMAP_COLORS = {
    low: '#1a1a2e',
    mid: '#e94560',
    high: '#ff9a3c'
};

// ============================================================================
// PARALLEL COORDINATES CHART
// ============================================================================

interface ParallelCoordinatesProps {
    data: any[];
    dimensions: string[];
    colorKey?: string;
    height?: number;
}

export const ParallelCoordinatesChart: React.FC<ParallelCoordinatesProps> = ({
    data,
    dimensions,
    colorKey,
    height = 300
}) => {
    const [hoveredLine, setHoveredLine] = useState<number | null>(null);
    const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());

    // Calculate scales for each dimension
    const scales = useMemo(() => {
        return dimensions.map(dim => {
            const values = data.map(d => parseFloat(d[dim]) || 0);
            return {
                min: Math.min(...values),
                max: Math.max(...values),
                dimension: dim
            };
        });
    }, [data, dimensions]);

    // Calculate paths
    const paths = useMemo(() => {
        const width = 100 / (dimensions.length - 1);
        
        return data.map((item, idx) => {
            const points = dimensions.map((dim, i) => {
                const scale = scales[i];
                const value = parseFloat(item[dim]) || 0;
                const normalizedY = scale.max === scale.min 
                    ? 50 
                    : ((value - scale.min) / (scale.max - scale.min)) * 80 + 10;
                return `${i * width},${100 - normalizedY}`;
            });
            
            return {
                path: `M ${points.join(' L ')}`,
                color: colorKey && item[colorKey] 
                    ? ADVANCED_COLORS[Math.abs(item[colorKey].toString().charCodeAt(0)) % ADVANCED_COLORS.length]
                    : ADVANCED_COLORS[idx % ADVANCED_COLORS.length],
                data: item,
                index: idx
            };
        });
    }, [data, dimensions, scales, colorKey]);

    const handleLineClick = (idx: number) => {
        setSelectedLines(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    };

    return (
        <div className="w-full" style={{ height }}>
            <svg 
                viewBox="0 0 100 100" 
                preserveAspectRatio="none"
                className="w-full h-full"
                style={{ background: 'transparent' }}
            >
                {/* Background */}
                <rect x="0" y="0" width="100" height="100" fill="var(--bg-tertiary)" rx="1" />
                
                {/* Axis lines */}
                {dimensions.map((_, i) => {
                    const x = (i / (dimensions.length - 1)) * 100;
                    return (
                        <line
                            key={`axis-${i}`}
                            x1={x}
                            y1="10"
                            x2={x}
                            y2="90"
                            stroke="var(--border-light)"
                            strokeWidth="0.3"
                        />
                    );
                })}

                {/* Data lines */}
                {paths.map((p, idx) => {
                    const isHovered = hoveredLine === idx;
                    const isSelected = selectedLines.has(idx);
                    const opacity = selectedLines.size > 0 
                        ? (isSelected ? 0.9 : 0.1) 
                        : (isHovered ? 0.9 : 0.4);
                    
                    return (
                        <path
                            key={idx}
                            d={p.path}
                            fill="none"
                            stroke={p.color}
                            strokeWidth={isHovered || isSelected ? "0.8" : "0.3"}
                            strokeOpacity={opacity}
                            onMouseEnter={() => setHoveredLine(idx)}
                            onMouseLeave={() => setHoveredLine(null)}
                            onClick={() => handleLineClick(idx)}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        />
                    );
                })}

                {/* Axis labels */}
                {dimensions.map((dim, i) => {
                    const x = (i / (dimensions.length - 1)) * 100;
                    const scale = scales[i];
                    return (
                        <g key={`label-${i}`}>
                            <text
                                x={x}
                                y="6"
                                textAnchor="middle"
                                fontSize="3"
                                fill="var(--text-secondary)"
                                fontWeight="500"
                            >
                                {dim.length > 12 ? dim.slice(0, 12) + '...' : dim}
                            </text>
                            <text
                                x={x}
                                y="95"
                                textAnchor="middle"
                                fontSize="2.5"
                                fill="var(--text-tertiary)"
                            >
                                {scale.min.toFixed(0)} - {scale.max.toFixed(0)}
                            </text>
                        </g>
                    );
                })}
            </svg>
            
            {/* Tooltip */}
            {hoveredLine !== null && (
                <div className="absolute bottom-2 left-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-lg text-xs max-w-[200px] z-10">
                    {dimensions.slice(0, 4).map(dim => (
                        <div key={dim} className="flex justify-between gap-2">
                            <span className="text-[var(--text-tertiary)]">{dim}:</span>
                            <span className="text-[var(--text-primary)] font-medium">
                                {typeof paths[hoveredLine].data[dim] === 'number' 
                                    ? paths[hoveredLine].data[dim].toLocaleString()
                                    : paths[hoveredLine].data[dim]}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HEATMAP CHART
// ============================================================================

interface HeatmapProps {
    data: any[];
    xKey: string;
    yKey: string;
    valueKey: string;
    height?: number;
}

export const HeatmapChart: React.FC<HeatmapProps> = ({
    data,
    xKey,
    yKey,
    valueKey,
    height = 300
}) => {
    const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string; value: number } | null>(null);

    // Extract unique values for axes
    const { xValues, yValues, matrix, maxValue, minValue } = useMemo(() => {
        const xSet = new Set<string>();
        const ySet = new Set<string>();
        
        data.forEach(d => {
            xSet.add(d[xKey]?.toString() || '');
            ySet.add(d[yKey]?.toString() || '');
        });
        
        const xArr = Array.from(xSet).sort();
        const yArr = Array.from(ySet).sort();
        
        // Create matrix
        const mat: Record<string, Record<string, number>> = {};
        let max = -Infinity;
        let min = Infinity;
        
        yArr.forEach(y => {
            mat[y] = {};
            xArr.forEach(x => {
                const item = data.find(d => d[xKey]?.toString() === x && d[yKey]?.toString() === y);
                const val = item ? parseFloat(item[valueKey]) || 0 : 0;
                mat[y][x] = val;
                max = Math.max(max, val);
                min = Math.min(min, val);
            });
        });
        
        return { xValues: xArr, yValues: yArr, matrix: mat, maxValue: max, minValue: min };
    }, [data, xKey, yKey, valueKey]);
    const hasFlatRange = maxValue === minValue;

    const getColor = useCallback((value: number) => {
        if (maxValue === minValue) return HEATMAP_COLORS.mid;
        const ratio = (value - minValue) / (maxValue - minValue);
        
        if (ratio < 0.5) {
            // Interpolate between low and mid
            const t = ratio * 2;
            return interpolateColor(HEATMAP_COLORS.low, HEATMAP_COLORS.mid, t);
        } else {
            // Interpolate between mid and high
            const t = (ratio - 0.5) * 2;
            return interpolateColor(HEATMAP_COLORS.mid, HEATMAP_COLORS.high, t);
        }
    }, [maxValue, minValue]);

    const hasData = xValues.length > 0 && yValues.length > 0;
    const plotLeft = 12;
    const plotTop = 8;
    const plotRight = 88;
    const plotBottom = 86;
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const cellWidth = hasData ? plotWidth / xValues.length : plotWidth;
    const cellHeight = hasData ? plotHeight / yValues.length : plotHeight;

    return (
        <div className="w-full relative" style={{ height }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                {/* Cells */}
                {yValues.map((y, yi) => (
                    xValues.map((x, xi) => {
                        const value = matrix[y][x];
                        return (
                            <rect
                                key={`${x}-${y}`}
                                x={plotLeft + xi * cellWidth}
                                y={plotTop + yi * cellHeight}
                                width={cellWidth - 1}
                                height={cellHeight - 1}
                                fill={getColor(value)}
                                rx="0.5"
                                onMouseEnter={() => setHoveredCell({ x, y, value })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                                opacity={hoveredCell && (hoveredCell.x !== x || hoveredCell.y !== y) ? 0.7 : 1}
                            />
                        );
                    })
                ))}
                
                {/* X-axis labels */}
                {xValues.map((x, i) => (
                    <text
                        key={`x-${i}`}
                        x={plotLeft + i * cellWidth + cellWidth / 2}
                        y="96"
                        textAnchor="middle"
                        fontSize="2.3"
                        fill="var(--text-tertiary)"
                    >
                        {x.length > 8 ? `${x.slice(0, 8)}..` : x}
                    </text>
                ))}
                
                {/* Y-axis labels */}
                {yValues.map((y, i) => (
                    <text
                        key={`y-${i}`}
                        x="10"
                        y={plotTop + i * cellHeight + cellHeight / 2 + 0.8}
                        textAnchor="end"
                        fontSize="2.3"
                        fill="var(--text-tertiary)"
                    >
                        {y.length > 10 ? `${y.slice(0, 10)}..` : y}
                    </text>
                ))}
            </svg>
            
            {/* Tooltip */}
            {hoveredCell && (
                <div className="absolute top-2 right-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-lg text-xs z-10">
                    <div className="font-medium text-[var(--text-primary)]">{hoveredCell.x} × {hoveredCell.y}</div>
                    <div className="text-[var(--accent-primary)] font-bold">{hoveredCell.value.toLocaleString()}</div>
                </div>
            )}
            
            {/* Legend */}
            <div className="absolute bottom-0 right-2 flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                {Number.isFinite(minValue) && Number.isFinite(maxValue) ? (
                    hasFlatRange ? (
                        <span>Single value: {minValue.toLocaleString()}</span>
                    ) : (
                        <>
                            <span>{minValue.toFixed(0)}</span>
                            <div
                                className="w-20 h-2 rounded"
                                style={{
                                    background: `linear-gradient(to right, ${HEATMAP_COLORS.low}, ${HEATMAP_COLORS.mid}, ${HEATMAP_COLORS.high})`
                                }}
                            />
                            <span>{maxValue.toFixed(0)}</span>
                        </>
                    )
                ) : (
                    <span>No values</span>
                )}
            </div>
            {yValues.length <= 1 && (
                <div className="absolute bottom-5 left-2 text-[10px] text-[var(--text-tertiary)]">
                    Add more row categories to get a full matrix
                </div>
            )}
        </div>
    );
};

// ============================================================================
// SCATTER MATRIX (Pairwise)
// ============================================================================

interface ScatterMatrixProps {
    data: any[];
    dimensions: string[];
    colorKey?: string;
    height?: number;
}

export const ScatterMatrixChart: React.FC<ScatterMatrixProps> = ({
    data,
    dimensions,
    colorKey,
    height = 400
}) => {
    const [hoveredPoint, setHoveredPoint] = useState<any>(null);
    
    const n = Math.min(dimensions.length, 4); // Limit to 4x4 matrix
    const cellSize = 100 / n;
    
    const scales = useMemo(() => {
        return dimensions.slice(0, n).map(dim => {
            const values = data.map(d => parseFloat(d[dim]) || 0);
            return {
                min: Math.min(...values),
                max: Math.max(...values),
                range: Math.max(...values) - Math.min(...values) || 1
            };
        });
    }, [data, dimensions, n]);

    const normalizeValue = (value: number, scaleIdx: number) => {
        const scale = scales[scaleIdx];
        return ((value - scale.min) / scale.range) * (cellSize - 10) + 5;
    };

    return (
        <div className="w-full relative" style={{ height }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                {/* Grid cells */}
                {dimensions.slice(0, n).map((dimY, yi) => (
                    dimensions.slice(0, n).map((dimX, xi) => {
                        const cellX = xi * cellSize;
                        const cellY = yi * cellSize;
                        
                        if (xi === yi) {
                            // Diagonal - show dimension name
                            return (
                                <g key={`${xi}-${yi}`}>
                                    <rect
                                        x={cellX}
                                        y={cellY}
                                        width={cellSize}
                                        height={cellSize}
                                        fill="var(--bg-tertiary)"
                                        stroke="var(--border-light)"
                                        strokeWidth="0.2"
                                    />
                                    <text
                                        x={cellX + cellSize / 2}
                                        y={cellY + cellSize / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="3.2"
                                        fill="var(--text-secondary)"
                                        fontWeight="500"
                                    >
                                        {dimX.length > 12 ? dimX.slice(0, 12) + '..' : dimX}
                                    </text>
                                </g>
                            );
                        }
                        
                        // Scatter plot cell
                        return (
                            <g key={`${xi}-${yi}`}>
                                <rect
                                    x={cellX}
                                    y={cellY}
                                    width={cellSize}
                                    height={cellSize}
                                    fill="var(--bg-card)"
                                    stroke="var(--border-light)"
                                    strokeWidth="0.2"
                                />
                                {data.slice(0, 100).map((d, i) => {
                                    const px = cellX + normalizeValue(parseFloat(d[dimX]) || 0, xi);
                                    const py = cellY + cellSize - normalizeValue(parseFloat(d[dimY]) || 0, yi);
                                    const color = colorKey 
                                        ? ADVANCED_COLORS[Math.abs((d[colorKey]?.toString() || '').charCodeAt(0)) % ADVANCED_COLORS.length]
                                        : ADVANCED_COLORS[0];
                                    
                                    return (
                                        <circle
                                            key={i}
                                            cx={px}
                                            cy={py}
                                            r="1.15"
                                            fill={color}
                                            opacity={0.72}
                                            onMouseEnter={() => setHoveredPoint(d)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                        />
                                    );
                                })}
                            </g>
                        );
                    })
                ))}
            </svg>
            
            {/* Tooltip */}
            {hoveredPoint && (
                <div className="absolute top-2 right-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-lg text-xs z-10 max-w-[150px]">
                    {dimensions.slice(0, 4).map(dim => (
                        <div key={dim} className="flex justify-between gap-2">
                            <span className="text-[var(--text-tertiary)] truncate">{dim}:</span>
                            <span className="text-[var(--text-primary)] font-medium">
                                {typeof hoveredPoint[dim] === 'number' 
                                    ? hoveredPoint[dim].toFixed(1)
                                    : hoveredPoint[dim]}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// SANKEY DIAGRAM (Simplified)
// ============================================================================

interface SankeyNode {
    id: string;
    value?: number;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
}

interface SankeyProps {
    nodes: SankeyNode[];
    links: SankeyLink[];
    height?: number;
}

export const SankeyChart: React.FC<SankeyProps> = ({
    nodes,
    links,
    height = 300
}) => {
    const [hoveredLink, setHoveredLink] = useState<number | null>(null);

    // Simple layout calculation
    const layout = useMemo(() => {
        // Group nodes by depth
        const nodeMap = new Map<string, { depth: number; value: number; y: number; height: number }>();
        
        // Calculate depths
        nodes.forEach(n => nodeMap.set(n.id, { depth: 0, value: n.value || 0, y: 0, height: 0 }));
        
        // BFS to assign depths
        const visited = new Set<string>();
        const sources = new Set(links.map(l => l.source));
        const targets = new Set(links.map(l => l.target));
        const rootNodes = nodes.filter(n => sources.has(n.id) && !targets.has(n.id));
        
        const queue = rootNodes.map(n => ({ id: n.id, depth: 0 }));
        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);
            
            const node = nodeMap.get(id);
            if (node) node.depth = depth;
            
            links.filter(l => l.source === id).forEach(l => {
                queue.push({ id: l.target, depth: depth + 1 });
            });
        }
        
        // Group by depth
        const depthGroups = new Map<number, string[]>();
        nodeMap.forEach((data, id) => {
            const group = depthGroups.get(data.depth) || [];
            group.push(id);
            depthGroups.set(data.depth, group);
        });
        
        // Calculate values and positions
        const maxDepth = Math.max(...Array.from(nodeMap.values()).map(n => n.depth));
        
        depthGroups.forEach((ids, depth) => {
            const totalValue = ids.reduce((sum, id) => {
                const outgoing = links.filter(l => l.source === id).reduce((s, l) => s + l.value, 0);
                const incoming = links.filter(l => l.target === id).reduce((s, l) => s + l.value, 0);
                return sum + Math.max(outgoing, incoming, 1);
            }, 0);
            
            let currentY = 10;
            ids.forEach(id => {
                const node = nodeMap.get(id)!;
                const outgoing = links.filter(l => l.source === id).reduce((s, l) => s + l.value, 0);
                const incoming = links.filter(l => l.target === id).reduce((s, l) => s + l.value, 0);
                const value = Math.max(outgoing, incoming, 1);
                
                node.value = value;
                node.height = (value / totalValue) * 70;
                node.y = currentY;
                currentY += node.height + 5;
            });
        });
        
        return { nodeMap, maxDepth };
    }, [nodes, links]);

    const getNodeX = (depth: number) => {
        return (depth / (layout.maxDepth || 1)) * 80 + 5;
    };

    return (
        <div className="w-full relative" style={{ height }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Links */}
                {links.map((link, i) => {
                    const sourceNode = layout.nodeMap.get(link.source);
                    const targetNode = layout.nodeMap.get(link.target);
                    if (!sourceNode || !targetNode) return null;
                    
                    const x1 = getNodeX(sourceNode.depth) + 5;
                    const y1 = sourceNode.y + sourceNode.height / 2;
                    const x2 = getNodeX(targetNode.depth);
                    const y2 = targetNode.y + targetNode.height / 2;
                    
                    const thickness = Math.max(1, (link.value / 100) * 5);
                    
                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={ADVANCED_COLORS[i % ADVANCED_COLORS.length]}
                            strokeWidth={thickness}
                            strokeOpacity={hoveredLink === i ? 0.9 : 0.4}
                            onMouseEnter={() => setHoveredLink(i)}
                            onMouseLeave={() => setHoveredLink(null)}
                            style={{ cursor: 'pointer', transition: 'stroke-opacity 0.2s' }}
                        />
                    );
                })}
                
                {/* Nodes */}
                {Array.from(layout.nodeMap.entries()).map(([id, node]) => (
                    <g key={id}>
                        <rect
                            x={getNodeX(node.depth)}
                            y={node.y}
                            width="5"
                            height={Math.max(node.height, 3)}
                            fill={ADVANCED_COLORS[node.depth % ADVANCED_COLORS.length]}
                            rx="0.5"
                        />
                        <text
                            x={getNodeX(node.depth) + (node.depth === layout.maxDepth ? -2 : 7)}
                            y={node.y + node.height / 2}
                            textAnchor={node.depth === layout.maxDepth ? 'end' : 'start'}
                            dominantBaseline="middle"
                            fontSize="2.5"
                            fill="var(--text-secondary)"
                        >
                            {id.length > 10 ? id.slice(0, 10) + '..' : id}
                        </text>
                    </g>
                ))}
            </svg>
            
            {/* Tooltip */}
            {hoveredLink !== null && (
                <div className="absolute bottom-2 left-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-lg text-xs z-10">
                    <div className="text-[var(--text-primary)]">
                        {links[hoveredLink].source} → {links[hoveredLink].target}
                    </div>
                    <div className="text-[var(--accent-primary)] font-bold">
                        {links[hoveredLink].value.toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// BUBBLE CHART
// ============================================================================

interface BubbleChartProps {
    data: any[];
    xKey: string;
    yKey: string;
    sizeKey: string;
    colorKey?: string;
    height?: number;
}

export const BubbleChart: React.FC<BubbleChartProps> = ({
    data,
    xKey,
    yKey,
    sizeKey,
    colorKey,
    height = 300
}) => {
    const chartData = useMemo(() => {
        const maxSize = Math.max(...data.map(d => parseFloat(d[sizeKey]) || 1));
        return data.map((d, i) => ({
            ...d,
            x: parseFloat(d[xKey]) || 0,
            y: parseFloat(d[yKey]) || 0,
            z: ((parseFloat(d[sizeKey]) || 1) / maxSize) * 1000 + 100,
            fill: colorKey 
                ? ADVANCED_COLORS[Math.abs((d[colorKey]?.toString() || '').charCodeAt(0)) % ADVANCED_COLORS.length]
                : ADVANCED_COLORS[i % ADVANCED_COLORS.length]
        }));
    }, [data, xKey, yKey, sizeKey, colorKey]);

    return (
        <ResponsiveContainer width="100%" height={height} minWidth={100} minHeight={100}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis 
                    type="number" 
                    dataKey="x" 
                    name={xKey}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                    stroke="var(--border-light)"
                />
                <YAxis 
                    type="number" 
                    dataKey="y" 
                    name={yKey}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                    stroke="var(--border-light)"
                />
                <ZAxis type="number" dataKey="z" range={[50, 500]} />
                <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        fontSize: '12px'
                    }}
                    formatter={(value: any, name: string) => [
                        typeof value === 'number' ? value.toLocaleString() : value,
                        name
                    ]}
                />
                <Scatter data={chartData}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.7} />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    );
};

// ============================================================================
// SEVERITY TIMELINE CHART (Alert/Event Timeline)
// ============================================================================

const SEVERITY_COLORS = {
    very_high: '#9333EA', // Purple
    high: '#DC2626',      // Red
    medium: '#F97316',    // Orange
    low: '#FBBF24',       // Yellow/Amber
    none: '#4B5563',      // Gray
    na: '#1F2937'         // Dark gray
};

const SEVERITY_LABELS = {
    very_high: 'Very high severity',
    high: 'High severity', 
    medium: 'Medium severity',
    low: 'Low severity',
    none: 'No detection',
    na: 'N/A'
};

interface TimelineEvent {
    start: string | Date;
    end?: string | Date;
    severity: 'very_high' | 'high' | 'medium' | 'low' | 'none' | 'na';
    label?: string;
}

interface SeverityTimelineProps {
    title: string;
    subtitle?: string;
    events: TimelineEvent[];
    startDate?: string | Date;
    endDate?: string | Date;
    height?: number;
    showLegend?: boolean;
}

export const SeverityTimelineChart: React.FC<SeverityTimelineProps> = ({
    title,
    subtitle,
    events,
    startDate,
    endDate,
    height = 120,
    showLegend = true
}) => {
    const [hoveredEvent, setHoveredEvent] = useState<{ event: TimelineEvent; x: number } | null>(null);

    // Calculate time range
    const timeRange = useMemo(() => {
        let minTime = startDate ? new Date(startDate).getTime() : Infinity;
        let maxTime = endDate ? new Date(endDate).getTime() : -Infinity;
        
        events.forEach(e => {
            const start = new Date(e.start).getTime();
            const end = e.end ? new Date(e.end).getTime() : start + 3600000; // Default 1h
            minTime = Math.min(minTime, start);
            maxTime = Math.max(maxTime, end);
        });
        
        // Add padding
        const range = maxTime - minTime;
        return {
            start: minTime - range * 0.02,
            end: maxTime + range * 0.02,
            duration: maxTime - minTime + range * 0.04
        };
    }, [events, startDate, endDate]);

    // Generate time labels
    const timeLabels = useMemo(() => {
        const labels: { time: number; label: string }[] = [];
        const range = timeRange.end - timeRange.start;
        const numLabels = 8;
        
        for (let i = 0; i <= numLabels; i++) {
            const time = timeRange.start + (range * i / numLabels);
            const date = new Date(time);
            labels.push({
                time,
                label: date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(',', '')
            });
        }
        return labels;
    }, [timeRange]);

    // Calculate event positions
    const eventBars = useMemo(() => {
        return events.map((event, idx) => {
            const start = new Date(event.start).getTime();
            const end = event.end ? new Date(event.end).getTime() : start + 3600000;
            
            const x = ((start - timeRange.start) / timeRange.duration) * 100;
            const width = Math.max(0.5, ((end - start) / timeRange.duration) * 100);
            
            return {
                ...event,
                x,
                width,
                index: idx
            };
        });
    }, [events, timeRange]);

    // Get unique severities for legend
    const activeSeverities = useMemo(() => {
        const severities = new Set(events.map(e => e.severity));
        return Array.from(severities);
    }, [events]);

    return (
        <div className="w-full" style={{ height }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">{title}</h4>
                    {subtitle && (
                        <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
                    )}
                </div>
            </div>
            
            {/* Timeline */}
            <div className="relative bg-[var(--bg-tertiary)] rounded-lg overflow-hidden" style={{ height: 40 }}>
                {/* Track label */}
                <div className="absolute left-0 top-0 bottom-0 w-auto max-w-[40%] px-2 flex items-center bg-gradient-to-r from-[var(--bg-card)] to-transparent z-10">
                    <span className="text-[10px] text-[var(--text-secondary)] truncate font-medium">
                        {subtitle || title}
                    </span>
                </div>
                
                {/* Event bars */}
                {eventBars.map((bar, idx) => (
                    <div
                        key={idx}
                        className="absolute top-1 bottom-1 rounded-sm transition-all cursor-pointer hover:brightness-110"
                        style={{
                            left: `${bar.x}%`,
                            width: `${bar.width}%`,
                            minWidth: '3px',
                            backgroundColor: SEVERITY_COLORS[bar.severity],
                            boxShadow: hoveredEvent?.event === bar ? '0 0 8px rgba(255,255,255,0.3)' : 'none'
                        }}
                        onMouseEnter={(e) => setHoveredEvent({ event: bar, x: e.clientX })}
                        onMouseLeave={() => setHoveredEvent(null)}
                    />
                ))}
                
                {/* Hover indicator line */}
                {hoveredEvent && (
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-white/50 pointer-events-none z-20"
                        style={{ left: `${(eventBars.find(b => b === hoveredEvent.event)?.x || 0)}%` }}
                    />
                )}
            </div>
            
            {/* Time axis */}
            <div className="relative h-5 mt-1">
                {timeLabels.map((label, idx) => (
                    <span
                        key={idx}
                        className="absolute text-[9px] text-[var(--text-tertiary)] whitespace-nowrap"
                        style={{
                            left: `${(idx / (timeLabels.length - 1)) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {label.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                ))}
            </div>
            
            {/* Legend */}
            {showLegend && (
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {Object.entries(SEVERITY_COLORS).map(([key, color]) => {
                        if (!activeSeverities.includes(key as any) && key !== 'none' && key !== 'na') return null;
                        return (
                            <div key={key} className="flex items-center gap-1.5">
                                <div 
                                    className="w-3 h-3 rounded-sm" 
                                    style={{ backgroundColor: color }}
                                />
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                    {SEVERITY_LABELS[key as keyof typeof SEVERITY_LABELS]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {/* Tooltip */}
            {hoveredEvent && (
                <div className="fixed bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-xl text-xs z-50 pointer-events-none"
                    style={{ 
                        left: hoveredEvent.x + 10, 
                        top: '50%',
                        transform: 'translateY(-50%)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: SEVERITY_COLORS[hoveredEvent.event.severity] }}
                        />
                        <span className="font-medium text-[var(--text-primary)]">
                            {SEVERITY_LABELS[hoveredEvent.event.severity]}
                        </span>
                    </div>
                    <div className="text-[var(--text-tertiary)]">
                        {new Date(hoveredEvent.event.start).toLocaleString()}
                    </div>
                    {hoveredEvent.event.label && (
                        <div className="text-[var(--text-secondary)] mt-1">
                            {hoveredEvent.event.label}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MULTI-TRACK TIMELINE (Multiple detectors)
// ============================================================================

interface TimelineTrack {
    id: string;
    title: string;
    subtitle?: string;
    events: TimelineEvent[];
}

interface MultiTrackTimelineProps {
    tracks: TimelineTrack[];
    startDate?: string | Date;
    endDate?: string | Date;
    height?: number;
}

export const MultiTrackTimelineChart: React.FC<MultiTrackTimelineProps> = ({
    tracks,
    startDate,
    endDate,
    height = 300
}) => {
    const [hoveredEvent, setHoveredEvent] = useState<{ track: string; event: TimelineEvent; x: number; y: number } | null>(null);

    // Calculate overall time range
    const timeRange = useMemo(() => {
        let minTime = startDate ? new Date(startDate).getTime() : Infinity;
        let maxTime = endDate ? new Date(endDate).getTime() : -Infinity;
        
        tracks.forEach(track => {
            track.events.forEach(e => {
                const start = new Date(e.start).getTime();
                const end = e.end ? new Date(e.end).getTime() : start + 3600000;
                minTime = Math.min(minTime, start);
                maxTime = Math.max(maxTime, end);
            });
        });
        
        const range = maxTime - minTime;
        return {
            start: minTime - range * 0.02,
            end: maxTime + range * 0.02,
            duration: maxTime - minTime + range * 0.04
        };
    }, [tracks, startDate, endDate]);

    // Generate time labels
    const timeLabels = useMemo(() => {
        const labels: { time: number; label: string }[] = [];
        const range = timeRange.end - timeRange.start;
        const numLabels = 10;
        
        for (let i = 0; i <= numLabels; i++) {
            const time = timeRange.start + (range * i / numLabels);
            const date = new Date(time);
            labels.push({
                time,
                label: date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    day: '2-digit',
                    hour: '2-digit'
                }).replace(',', ' ')
            });
        }
        return labels;
    }, [timeRange]);

    const trackHeight = Math.min(60, (height - 80) / tracks.length);

    return (
        <div className="w-full" style={{ height }}>
            {/* Tracks */}
            <div className="space-y-2">
                {tracks.map((track, trackIdx) => (
                    <div key={track.id}>
                        {/* Track header */}
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-medium text-[var(--text-primary)]">{track.title}</span>
                            {track.subtitle && (
                                <span className="text-[10px] text-[var(--text-tertiary)]">{track.subtitle}</span>
                            )}
                        </div>
                        
                        {/* Track bar */}
                        <div 
                            className="relative bg-[var(--bg-tertiary)] rounded overflow-hidden"
                            style={{ height: trackHeight }}
                        >
                            {/* Label overlay */}
                            <div className="absolute left-0 top-0 bottom-0 px-2 flex items-center bg-gradient-to-r from-[var(--bg-card)]/90 to-transparent z-10 max-w-[35%]">
                                <span className="text-[9px] text-[var(--text-secondary)] truncate">
                                    {track.subtitle || track.title}
                                </span>
                            </div>
                            
                            {/* Events */}
                            {track.events.map((event, eventIdx) => {
                                const start = new Date(event.start).getTime();
                                const end = event.end ? new Date(event.end).getTime() : start + 3600000;
                                const x = ((start - timeRange.start) / timeRange.duration) * 100;
                                const width = Math.max(0.3, ((end - start) / timeRange.duration) * 100);
                                
                                return (
                                    <div
                                        key={eventIdx}
                                        className="absolute top-1 bottom-1 rounded-sm cursor-pointer transition-all hover:brightness-125"
                                        style={{
                                            left: `${x}%`,
                                            width: `${width}%`,
                                            minWidth: '2px',
                                            backgroundColor: SEVERITY_COLORS[event.severity]
                                        }}
                                        onMouseEnter={(e) => setHoveredEvent({ 
                                            track: track.id, 
                                            event, 
                                            x: e.clientX, 
                                            y: e.clientY 
                                        })}
                                        onMouseLeave={() => setHoveredEvent(null)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Time axis */}
            <div className="relative h-6 mt-3 border-t border-[var(--border-light)] pt-1">
                {timeLabels.map((label, idx) => (
                    <span
                        key={idx}
                        className="absolute text-[9px] text-[var(--text-tertiary)] whitespace-nowrap"
                        style={{
                            left: `${(idx / (timeLabels.length - 1)) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {label.label}
                    </span>
                ))}
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 justify-center">
                {Object.entries(SEVERITY_COLORS).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                            {SEVERITY_LABELS[key as keyof typeof SEVERITY_LABELS]}
                        </span>
                    </div>
                ))}
            </div>
            
            {/* Tooltip */}
            {hoveredEvent && (
                <div 
                    className="fixed bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-2 shadow-xl text-xs z-50 pointer-events-none"
                    style={{ left: hoveredEvent.x + 10, top: hoveredEvent.y - 40 }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: SEVERITY_COLORS[hoveredEvent.event.severity] }}
                        />
                        <span className="font-medium text-[var(--text-primary)]">
                            {SEVERITY_LABELS[hoveredEvent.event.severity]}
                        </span>
                    </div>
                    <div className="text-[var(--text-tertiary)]">
                        {new Date(hoveredEvent.event.start).toLocaleString()}
                        {hoveredEvent.event.end && (
                            <> — {new Date(hoveredEvent.event.end).toLocaleString()}</>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function interpolateColor(color1: string, color2: string, factor: number): string {
    const hex = (c: string) => parseInt(c, 16);
    const r1 = hex(color1.slice(1, 3));
    const g1 = hex(color1.slice(3, 5));
    const b1 = hex(color1.slice(5, 7));
    const r2 = hex(color2.slice(1, 3));
    const g2 = hex(color2.slice(3, 5));
    const b2 = hex(color2.slice(5, 7));
    
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ADVANCED_CHART_TYPES = [
    { 
        id: 'parallel', 
        name: 'Parallel Coordinates', 
        description: 'Compare multiple dimensions across data points',
        icon: '⫽'
    },
    { 
        id: 'heatmap', 
        name: 'Heatmap', 
        description: 'Show intensity of values in a matrix',
        icon: '▦'
    },
    { 
        id: 'scatter_matrix', 
        name: 'Scatter Matrix', 
        description: 'Pairwise relationships between variables',
        icon: '⋮⋮'
    },
    { 
        id: 'sankey', 
        name: 'Sankey Diagram', 
        description: 'Flow of values between categories',
        icon: '⤳'
    },
    { 
        id: 'bubble', 
        name: 'Bubble Chart', 
        description: '3D scatter with size dimension',
        icon: '◉'
    },
    { 
        id: 'timeline', 
        name: 'Severity Timeline', 
        description: 'Alert/event timeline with severity levels',
        icon: '▬'
    },
    { 
        id: 'multi_timeline', 
        name: 'Multi-Track Timeline', 
        description: 'Multiple detector timelines with alerts',
        icon: '≡'
    }
];
