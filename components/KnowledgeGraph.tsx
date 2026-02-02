import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    X, MagnifyingGlass, Minus, Plus, ArrowsOut, TreeStructure, Eye
} from '@phosphor-icons/react';
import { Entity } from '../types';

interface KnowledgeGraphProps {
    entities: Entity[];
    folders: Folder[];
    onNavigate: (entityId: string) => void;
    onClose: () => void;
}

interface Folder {
    id: string;
    name: string;
    color?: string;
    parentId?: string | null;
    entityIds: string[];
}

interface GraphNode {
    id: string;
    type: 'entity' | 'property';
    label: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    parentId?: string;
    entityId?: string;
    propertyType?: string;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
}

// Color palette based on design system
const NODE_COLORS = {
    entity: '#419CAF',      // Primary-medium (teal)
    text: '#3FB6AE',        // Secondary-medium
    number: '#F59E0B',      // Amber
    date: '#EC4899',        // Pink
    boolean: '#84CC16',     // Lime
    email: '#8B5CF6',       // Violet
    url: '#06B6D4',         // Cyan
    default: '#6B7280',     // Gray
};

// Force simulation constants
const REPULSION = 600;
const ATTRACTION = 0.015;
const CENTER_PULL = 0.008;
const DAMPING = 0.85;

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
    entities,
    folders,
    onNavigate,
    onClose
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>();
    
    // View state
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProperties, setShowProperties] = useState(true);
    
    // Graph data
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    
    // Get color for property type
    const getPropertyColor = (type: string): string => {
        const t = type.toLowerCase();
        if (t.includes('text') || t.includes('string')) return NODE_COLORS.text;
        if (t.includes('number') || t.includes('int') || t.includes('float') || t.includes('decimal')) return NODE_COLORS.number;
        if (t.includes('date') || t.includes('time')) return NODE_COLORS.date;
        if (t.includes('bool')) return NODE_COLORS.boolean;
        if (t.includes('email')) return NODE_COLORS.email;
        if (t.includes('url') || t.includes('link')) return NODE_COLORS.url;
        return NODE_COLORS.default;
    };
    
    // Initialize graph
    useEffect(() => {
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        const newNodes: GraphNode[] = [];
        const newEdges: GraphEdge[] = [];
        
        // Create entity nodes in a circular layout
        entities.forEach((entity, i) => {
            const angle = (i / Math.max(entities.length, 1)) * 2 * Math.PI;
            const radius = Math.min(width, height) * 0.25;
            
            newNodes.push({
                id: `entity-${entity.id}`,
                type: 'entity',
                label: entity.name,
                color: NODE_COLORS.entity,
                x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
                y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
                vx: 0,
                vy: 0,
                radius: 12,
                entityId: entity.id
            });
            
            // Create property nodes around each entity
            if (showProperties && entity.properties) {
                entity.properties.forEach((prop, j) => {
                    const propAngle = (j / entity.properties!.length) * 2 * Math.PI;
                    const propRadius = 60 + Math.random() * 20;
                    const entityNode = newNodes.find(n => n.id === `entity-${entity.id}`);
                    
                    const propNode: GraphNode = {
                        id: `prop-${entity.id}-${prop.name}`,
                        type: 'property',
                        label: prop.name,
                        color: getPropertyColor(prop.type),
                        x: (entityNode?.x || centerX) + Math.cos(propAngle) * propRadius,
                        y: (entityNode?.y || centerY) + Math.sin(propAngle) * propRadius,
                        vx: 0,
                        vy: 0,
                        radius: 5,
                        parentId: `entity-${entity.id}`,
                        propertyType: prop.type
                    };
                    
                    newNodes.push(propNode);
                    
                    newEdges.push({
                        id: `edge-${entity.id}-${prop.name}`,
                        source: `entity-${entity.id}`,
                        target: `prop-${entity.id}-${prop.name}`
                    });
                });
            }
        });
        
        // Detect relationships between entities
        entities.forEach(entity => {
            if (!entity.properties) return;
            
            entity.properties.forEach(prop => {
                const propLower = prop.name.toLowerCase();
                
                entities.forEach(other => {
                    if (entity.id === other.id) return;
                    const otherLower = other.name.toLowerCase();
                    
                    if (propLower.includes(otherLower) || 
                        propLower === `${otherLower}_id` ||
                        propLower === `${otherLower}id`) {
                        
                        const edgeId = `relation-${entity.id}-${other.id}`;
                        if (!newEdges.find(e => e.id === edgeId)) {
                            newEdges.push({
                                id: edgeId,
                                source: `entity-${entity.id}`,
                                target: `entity-${other.id}`
                            });
                        }
                    }
                });
            });
        });
        
        setNodes(newNodes);
        setEdges(newEdges);
    }, [entities, showProperties]);
    
    // Force simulation
    useEffect(() => {
        if (nodes.length === 0) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let frameCount = 0;
        const maxFrames = 200;
        
        const simulate = () => {
            if (frameCount >= maxFrames) return;
            
            setNodes(prev => {
                const updated = prev.map(node => ({ ...node }));
                
                // Calculate forces
                updated.forEach((node, i) => {
                    let fx = 0, fy = 0;
                    
                    // Repulsion from other nodes
                    updated.forEach((other, j) => {
                        if (i === j) return;
                        
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        
                        if (dist < 150) {
                            const force = REPULSION / (dist * dist);
                            fx += (dx / dist) * force;
                            fy += (dy / dist) * force;
                        }
                    });
                    
                    // Attraction along edges
                    edges.forEach(edge => {
                        if (edge.source === node.id || edge.target === node.id) {
                            const otherId = edge.source === node.id ? edge.target : edge.source;
                            const other = updated.find(n => n.id === otherId);
                            if (!other) return;
                            
                            const dx = other.x - node.x;
                            const dy = other.y - node.y;
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            
                            const targetDist = node.type === 'property' ? 70 : 150;
                            const force = (dist - targetDist) * ATTRACTION;
                            
                            fx += (dx / dist) * force;
                            fy += (dy / dist) * force;
                        }
                    });
                    
                    // Center gravity (stronger for entities)
                    const gravity = node.type === 'entity' ? CENTER_PULL : CENTER_PULL * 0.3;
                    fx += (centerX - node.x) * gravity;
                    fy += (centerY - node.y) * gravity;
                    
                    // Update velocity
                    node.vx = (node.vx + fx) * DAMPING;
                    node.vy = (node.vy + fy) * DAMPING;
                    
                    // Update position
                    node.x += node.vx;
                    node.y += node.vy;
                    
                    // Bounds
                    node.x = Math.max(50, Math.min(width - 50, node.x));
                    node.y = Math.max(50, Math.min(height - 50, node.y));
                });
                
                return updated;
            });
            
            frameCount++;
            animationRef.current = requestAnimationFrame(simulate);
        };
        
        simulate();
        
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [nodes.length, edges]);
    
    // Hover effect - push nearby nodes
    useEffect(() => {
        if (!hoveredNode) return;
        
        const hovered = nodes.find(n => n.id === hoveredNode);
        if (!hovered) return;
        
        setNodes(prev => prev.map(node => {
            if (node.id === hoveredNode) return node;
            
            const dx = node.x - hovered.x;
            const dy = node.y - hovered.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 100 && dist > 0) {
                const push = (100 - dist) * 0.05;
                return {
                    ...node,
                    vx: node.vx + (dx / dist) * push,
                    vy: node.vy + (dy / dist) * push
                };
            }
            return node;
        }));
    }, [hoveredNode]);
    
    // Filter nodes
    const filteredNodeIds = useMemo(() => {
        if (!searchQuery) return new Set(nodes.map(n => n.id));
        const q = searchQuery.toLowerCase();
        const matching = new Set<string>();
        
        nodes.forEach(node => {
            if (node.label.toLowerCase().includes(q)) {
                matching.add(node.id);
                if (node.parentId) matching.add(node.parentId);
                // Add children
                nodes.filter(n => n.parentId === node.id).forEach(n => matching.add(n.id));
            }
        });
        
        return matching;
    }, [nodes, searchQuery]);
    
    // Pan handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
            setIsDragging(true);
            setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };
    
    const handleMouseUp = () => setIsDragging(false);
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(z => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.95 : 1.05))));
    };
    
    const zoomIn = () => setZoom(z => Math.min(3, z * 1.2));
    const zoomOut = () => setZoom(z => Math.max(0.3, z / 1.2));
    const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
    
    // Get connected nodes for highlighting
    const connectedNodes = useMemo(() => {
        if (!hoveredNode && !selectedEntity) return new Set<string>();
        const target = selectedEntity ? `entity-${selectedEntity}` : hoveredNode;
        const connected = new Set<string>([target!]);
        
        edges.forEach(edge => {
            if (edge.source === target) connected.add(edge.target);
            if (edge.target === target) connected.add(edge.source);
        });
        
        return connected;
    }, [hoveredNode, selectedEntity, edges]);
    
    // Selected entity data
    const selectedEntityData = useMemo(() => {
        if (!selectedEntity) return null;
        return entities.find(e => e.id === selectedEntity);
    }, [selectedEntity, entities]);
    
    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#1a1d21' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <TreeStructure size={18} weight="light" className="text-[#419CAF]" />
                    <div>
                        <h1 className="text-sm font-medium text-white/90">Knowledge Graph</h1>
                        <p className="text-[10px] text-white/40">
                            {entities.length} entities · {nodes.filter(n => n.type === 'property').length} properties
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-36 pl-7 pr-2 py-1 text-[11px] bg-white/5 border border-white/10 rounded text-white/80 placeholder-white/30 focus:outline-none focus:border-white/20"
                        />
                    </div>
                    
                    {/* Toggle properties */}
                    <button
                        onClick={() => setShowProperties(!showProperties)}
                        className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                            showProperties 
                                ? 'bg-[#419CAF]/20 text-[#419CAF]' 
                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                    >
                        Properties
                    </button>
                    
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    >
                        <X size={16} className="text-white/50" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
                {/* Graph canvas */}
                <div 
                    ref={containerRef}
                    className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
                >
                    <svg
                        ref={svgRef}
                        className="w-full h-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        {/* Background grid */}
                        <defs>
                            <pattern id="grid" width={30 * zoom} height={30 * zoom} patternUnits="userSpaceOnUse">
                                <circle cx={1} cy={1} r={0.5} fill="rgba(255,255,255,0.03)" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                        
                        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                            {/* Edges */}
                            {edges.map(edge => {
                                const source = nodes.find(n => n.id === edge.source);
                                const target = nodes.find(n => n.id === edge.target);
                                if (!source || !target) return null;
                                
                                const isHighlighted = connectedNodes.has(edge.source) && connectedNodes.has(edge.target);
                                const isVisible = filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
                                const isRelation = edge.id.startsWith('relation');
                                
                                return (
                                    <line
                                        key={edge.id}
                                        x1={source.x}
                                        y1={source.y}
                                        x2={target.x}
                                        y2={target.y}
                                        stroke={isRelation ? '#419CAF' : 'rgba(255,255,255,0.15)'}
                                        strokeWidth={isHighlighted ? 1.5 : 0.5}
                                        strokeOpacity={isVisible ? (isHighlighted ? 0.8 : 0.4) : 0.05}
                                        style={{ transition: 'stroke-opacity 0.3s, stroke-width 0.3s' }}
                                    />
                                );
                            })}
                            
                            {/* Nodes */}
                            {nodes.map(node => {
                                const isHovered = hoveredNode === node.id;
                                const isSelected = selectedEntity === node.entityId;
                                const isConnected = connectedNodes.has(node.id);
                                const isVisible = filteredNodeIds.has(node.id);
                                
                                const opacity = isVisible ? (isConnected || (!hoveredNode && !selectedEntity) ? 1 : 0.3) : 0.05;
                                const scale = isHovered ? 1.5 : (isConnected ? 1.2 : 1);
                                
                                return (
                                    <g
                                        key={node.id}
                                        transform={`translate(${node.x}, ${node.y})`}
                                        style={{ 
                                            opacity,
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={() => setHoveredNode(node.id)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onClick={() => {
                                            if (node.type === 'entity' && node.entityId) {
                                                setSelectedEntity(selectedEntity === node.entityId ? null : node.entityId);
                                            }
                                        }}
                                        className="cursor-pointer"
                                    >
                                        {/* Glow effect */}
                                        {(isHovered || isSelected) && (
                                            <circle
                                                r={node.radius * 2.5}
                                                fill={node.color}
                                                opacity={0.15}
                                            />
                                        )}
                                        
                                        {/* Node circle */}
                                        <circle
                                            r={node.radius * scale}
                                            fill={node.color}
                                            style={{ 
                                                transition: 'r 0.2s',
                                                filter: isHovered ? 'brightness(1.3)' : undefined
                                            }}
                                        />
                                        
                                        {/* Label - only show on hover or for entities */}
                                        {(isHovered || isConnected || node.type === 'entity') && (
                                            <text
                                                x={node.radius * scale + 8}
                                                y={4}
                                                fill="rgba(255,255,255,0.8)"
                                                fontSize={node.type === 'entity' ? 11 : 9}
                                                fontWeight={node.type === 'entity' ? 500 : 400}
                                                style={{ 
                                                    pointerEvents: 'none',
                                                    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                                }}
                                            >
                                                {node.label}
                                            </text>
                                        )}
                                        
                                        {/* Property type badge */}
                                        {isHovered && node.type === 'property' && node.propertyType && (
                                            <text
                                                x={node.radius * scale + 8}
                                                y={16}
                                                fill="rgba(255,255,255,0.4)"
                                                fontSize={8}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {node.propertyType}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                    
                    {/* Zoom controls */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-0.5 bg-black/40 backdrop-blur-sm rounded p-0.5">
                        <button onClick={zoomOut} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                            <Minus size={12} className="text-white/60" />
                        </button>
                        <span className="px-2 text-[10px] text-white/50 min-w-[40px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button onClick={zoomIn} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                            <Plus size={12} className="text-white/60" />
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <button onClick={resetView} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                            <ArrowsOut size={12} className="text-white/60" />
                        </button>
                    </div>
                    
                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-4 px-3 py-2 bg-black/40 backdrop-blur-sm rounded text-[9px] text-white/50">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS.entity }} />
                            <span>Entity</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS.text }} />
                            <span>Text</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS.number }} />
                            <span>Number</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS.date }} />
                            <span>Date</span>
                        </div>
                    </div>
                </div>
                
                {/* Details panel */}
                {selectedEntityData && (
                    <div className="w-64 border-l border-white/10 bg-black/20 p-4 overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-medium text-white/90">{selectedEntityData.name}</h3>
                                <p className="text-[10px] text-white/40">
                                    {selectedEntityData.properties?.length || 0} properties
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedEntity(null)}
                                className="p-1 hover:bg-white/10 rounded"
                            >
                                <X size={12} className="text-white/40" />
                            </button>
                        </div>
                        
                        {/* Properties list */}
                        <div className="space-y-1.5">
                            {selectedEntityData.properties?.map((prop, idx) => (
                                <div 
                                    key={idx}
                                    className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded"
                                >
                                    <div 
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: getPropertyColor(prop.type) }}
                                    />
                                    <span className="text-[11px] text-white/70 truncate flex-1">{prop.name}</span>
                                    <span className="text-[9px] text-white/30">{prop.type}</span>
                                </div>
                            ))}
                        </div>
                        
                        {/* View entity button */}
                        <button
                            onClick={() => onNavigate(selectedEntityData.id)}
                            className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-[#419CAF]/20 hover:bg-[#419CAF]/30 text-[#419CAF] rounded text-[11px] font-medium transition-colors"
                        >
                            <Eye size={12} />
                            View Details
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
