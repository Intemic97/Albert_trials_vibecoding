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

    const cellWidth = 100 / xValues.length;
    const cellHeight = 80 / yValues.length;

    return (
        <div className="w-full relative" style={{ height }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Cells */}
                {yValues.map((y, yi) => (
                    xValues.map((x, xi) => {
                        const value = matrix[y][x];
                        return (
                            <rect
                                key={`${x}-${y}`}
                                x={xi * cellWidth + 15}
                                y={yi * cellHeight + 10}
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
                        x={i * cellWidth + 15 + cellWidth / 2}
                        y="96"
                        textAnchor="middle"
                        fontSize="2.5"
                        fill="var(--text-tertiary)"
                    >
                        {x.length > 6 ? x.slice(0, 6) : x}
                    </text>
                ))}
                
                {/* Y-axis labels */}
                {yValues.map((y, i) => (
                    <text
                        key={`y-${i}`}
                        x="12"
                        y={i * cellHeight + 10 + cellHeight / 2 + 1}
                        textAnchor="end"
                        fontSize="2.5"
                        fill="var(--text-tertiary)"
                    >
                        {y.length > 8 ? y.slice(0, 8) : y}
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
                <span>{minValue.toFixed(0)}</span>
                <div 
                    className="w-20 h-2 rounded"
                    style={{ 
                        background: `linear-gradient(to right, ${HEATMAP_COLORS.low}, ${HEATMAP_COLORS.mid}, ${HEATMAP_COLORS.high})` 
                    }}
                />
                <span>{maxValue.toFixed(0)}</span>
            </div>
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
            <svg viewBox="0 0 100 100" className="w-full h-full">
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
                                        fontSize="3"
                                        fill="var(--text-secondary)"
                                        fontWeight="500"
                                    >
                                        {dimX.length > 8 ? dimX.slice(0, 8) + '..' : dimX}
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
                                            r="0.8"
                                            fill={color}
                                            opacity={0.6}
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
        <ResponsiveContainer width="100%" height={height}>
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
    }
];
