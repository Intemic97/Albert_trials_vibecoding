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
    orbitRadius?: number;
    orbitAngle?: number;
    orbitSpeed?: number;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
}

// Simple color palette matching design system
const NODE_COLORS = {
    entity: '#419CAF',      // Primary teal - Entities
    property: '#6B7280',    // Gray - All properties/variables
    folder: '#F59E0B',      // Amber - Folders (if shown)
};

// Force simulation constants
const REPULSION = 400;
const ATTRACTION = 0.012;
const CENTER_PULL = 0.006;
const DAMPING = 0.88;

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
    
    // All properties use the same gray color
    const getPropertyColor = (): string => NODE_COLORS.property;
    
    // Initialize graph with sphere-like layout
    useEffect(() => {
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.35;
        
        const newNodes: GraphNode[] = [];
        const newEdges: GraphEdge[] = [];
        
        // Calculate total properties for layout
        let totalProps = 0;
        entities.forEach(e => totalProps += (e.properties?.length || 0));
        
        // Create entity nodes in concentric circles based on number of properties
        const entityGroups: { entity: Entity; propCount: number }[] = entities.map(e => ({
            entity: e,
            propCount: e.properties?.length || 0
        })).sort((a, b) => b.propCount - a.propCount);
        
        // Distribute entities in a spiral pattern from center
        entityGroups.forEach((group, i) => {
            const spiralAngle = i * 2.4; // Golden angle for even distribution
            const spiralRadius = 30 + (i * 35);
            const entityX = centerX + Math.cos(spiralAngle) * Math.min(spiralRadius, baseRadius * 0.6);
            const entityY = centerY + Math.sin(spiralAngle) * Math.min(spiralRadius, baseRadius * 0.6);
            
            newNodes.push({
                id: `entity-${group.entity.id}`,
                type: 'entity',
                label: group.entity.name,
                color: NODE_COLORS.entity,
                x: entityX,
                y: entityY,
                vx: 0,
                vy: 0,
                radius: 8,
                entityId: group.entity.id
            });
            
            // Create property nodes in orbital rings around entity
            if (showProperties && group.entity.properties) {
                const props = group.entity.properties;
                const numProps = props.length;
                
                // Multiple orbital rings if many properties
                const propsPerRing = 8;
                const numRings = Math.ceil(numProps / propsPerRing);
                
                props.forEach((prop, j) => {
                    const ringIndex = Math.floor(j / propsPerRing);
                    const posInRing = j % propsPerRing;
                    const propsInThisRing = Math.min(propsPerRing, numProps - ringIndex * propsPerRing);
                    
                    const orbitRadius = 35 + ringIndex * 25;
                    const angleOffset = ringIndex * 0.3; // Offset each ring
                    const propAngle = angleOffset + (posInRing / propsInThisRing) * 2 * Math.PI;
                    
                    const propColor = getPropertyColor();
                    
                    const propNode: GraphNode = {
                        id: `prop-${group.entity.id}-${prop.name}`,
                        type: 'property',
                        label: prop.name,
                        color: propColor,
                        x: entityX + Math.cos(propAngle) * orbitRadius,
                        y: entityY + Math.sin(propAngle) * orbitRadius,
                        vx: 0,
                        vy: 0,
                        radius: 3,
                        parentId: `entity-${group.entity.id}`,
                        propertyType: prop.type,
                        orbitRadius: orbitRadius,
                        orbitAngle: propAngle,
                        orbitSpeed: 0.0003 + Math.random() * 0.0002
                    };
                    
                    newNodes.push(propNode);
                    
                    newEdges.push({
                        id: `edge-${group.entity.id}-${prop.name}`,
                        source: `entity-${group.entity.id}`,
                        target: `prop-${group.entity.id}-${prop.name}`
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
    
    // Gentle orbital animation for property nodes
    useEffect(() => {
        if (nodes.length === 0) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let frameCount = 0;
        let animating = true;
        
        const simulate = () => {
            if (!animating) return;
            
            setNodes(prev => {
                const updated = prev.map(node => ({ ...node }));
                const entityMap = new Map<string, GraphNode>();
                
                // First pass: update entities and store positions
                updated.forEach(node => {
                    if (node.type === 'entity') {
                        entityMap.set(node.id, node);
                    }
                });
                
                // Only apply forces in the first 150 frames for settling
                if (frameCount < 150) {
                    updated.forEach((node, i) => {
                        if (node.type !== 'entity') return;
                        
                        let fx = 0, fy = 0;
                        
                        // Repulsion from other entities
                        updated.forEach((other, j) => {
                            if (i === j || other.type !== 'entity') return;
                            
                            const dx = node.x - other.x;
                            const dy = node.y - other.y;
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            
                            if (dist < 120) {
                                const force = REPULSION / (dist * dist);
                                fx += (dx / dist) * force;
                                fy += (dy / dist) * force;
                            }
                        });
                        
                        // Center gravity
                        fx += (centerX - node.x) * CENTER_PULL;
                        fy += (centerY - node.y) * CENTER_PULL;
                        
                        // Update velocity
                        node.vx = (node.vx + fx) * DAMPING;
                        node.vy = (node.vy + fy) * DAMPING;
                        
                        // Update position
                        node.x += node.vx;
                        node.y += node.vy;
                        
                        // Bounds
                        node.x = Math.max(80, Math.min(width - 80, node.x));
                        node.y = Math.max(80, Math.min(height - 80, node.y));
                        
                        entityMap.set(node.id, node);
                    });
                }
                
                // Update property positions to orbit around their parent entities
                updated.forEach(node => {
                    if (node.parentId && node.orbitRadius && node.orbitAngle !== undefined) {
                        const parent = entityMap.get(node.parentId);
                        if (parent) {
                            // Slow orbital rotation
                            node.orbitAngle += node.orbitSpeed || 0.0003;
                            node.x = parent.x + Math.cos(node.orbitAngle) * node.orbitRadius;
                            node.y = parent.y + Math.sin(node.orbitAngle) * node.orbitRadius;
                        }
                    }
                });
                
                return updated;
            });
            
            frameCount++;
            animationRef.current = requestAnimationFrame(simulate);
        };
        
        simulate();
        
        return () => {
            animating = false;
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
                        style={{ background: '#1a1d21' }}
                    >
                        {/* Clean background - no grid for cleaner look */}
                        
                        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                            {/* Edges - subtle lines */}
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
                                        stroke={isRelation ? NODE_COLORS.entity : 'rgba(107,114,128,0.3)'}
                                        strokeWidth={isHighlighted ? 1 : 0.5}
                                        strokeOpacity={isVisible ? (isHighlighted ? 0.8 : 0.4) : 0.1}
                                    />
                                );
                            })}
                            
                            {/* Nodes - clean solid circles */}
                            {nodes.map(node => {
                                const isHovered = hoveredNode === node.id;
                                const isSelected = selectedEntity === node.entityId;
                                const isConnected = connectedNodes.has(node.id);
                                const isVisible = filteredNodeIds.has(node.id);
                                
                                const opacity = isVisible ? (isConnected || (!hoveredNode && !selectedEntity) ? 1 : 0.4) : 0.1;
                                const scale = isHovered ? 1.5 : (isSelected ? 1.3 : (isConnected ? 1.1 : 1));
                                
                                // Radius based on type
                                const baseRadius = node.type === 'entity' ? 8 : 3;
                                
                                return (
                                    <g
                                        key={node.id}
                                        transform={`translate(${node.x}, ${node.y})`}
                                        style={{ 
                                            opacity,
                                            transition: 'opacity 0.3s ease-out'
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
                                        {/* Simple solid circle */}
                                        <circle
                                            r={baseRadius * scale}
                                            fill={node.color}
                                            style={{ transition: 'all 0.2s ease-out' }}
                                        />
                                        
                                        {/* Subtle highlight on hover */}
                                        {(isHovered || isSelected) && (
                                            <circle
                                                r={baseRadius * scale + 3}
                                                fill="none"
                                                stroke={node.color}
                                                strokeWidth={1}
                                                strokeOpacity={0.4}
                                            />
                                        )}
                                        
                                        {/* Label - show on hover or for entities */}
                                        {(isHovered || (node.type === 'entity' && (isSelected || zoom > 0.8))) && (
                                            <text
                                                x={baseRadius * scale + 6}
                                                y={3}
                                                fill="rgba(255,255,255,0.9)"
                                                fontSize={node.type === 'entity' ? 10 : 8}
                                                fontWeight={node.type === 'entity' ? 500 : 400}
                                                fontFamily="system-ui, -apple-system, sans-serif"
                                                style={{ 
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                {node.label}
                                            </text>
                                        )}
                                        
                                        {/* Property type on hover */}
                                        {isHovered && node.type === 'property' && node.propertyType && (
                                            <text
                                                x={baseRadius * scale + 6}
                                                y={13}
                                                fill="rgba(255,255,255,0.5)"
                                                fontSize={7}
                                                fontFamily="system-ui, -apple-system, sans-serif"
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
                    <div className="absolute bottom-4 right-4 flex items-center gap-4 px-3 py-2 bg-black/40 backdrop-blur-sm rounded text-[10px] text-white/60">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.entity }} />
                            <span>Entity</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.property }} />
                            <span>Property</span>
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
                                        style={{ backgroundColor: NODE_COLORS.property }}
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
