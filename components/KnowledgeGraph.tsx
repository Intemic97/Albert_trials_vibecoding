import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, MagnifyingGlass, Minus, Plus, ArrowsOut, TreeStructure, Eye, CaretRight, Folder as FolderIcon, Database, Tag, ArrowLeft, Crosshair
} from '@phosphor-icons/react';
import { Entity } from '../types';

// Modular components
import { GraphMinimap, GraphSearch, GraphControls, FolderCluster } from './knowledge-graph/components';

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
    fixed?: boolean; // True if user manually moved this node
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

// Force simulation constants - tuned for very smooth, gentle animation
const REPULSION = 200;           // Very gentle repulsion
const LINK_ATTRACTION = 0.03;    // Gentle attraction between connected entities
const CENTER_PULL = 0.001;       // Very subtle center gravity
const DAMPING = 0.92;            // Consistent high damping for smooth movement
const COLLISION_STRENGTH = 0.2;  // Very soft collision response
const MIN_SEPARATION = 80;       // Minimum distance between entity centers

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
    entities,
    folders,
    onNavigate,
    onClose
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    
    // View state
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProperties, setShowProperties] = useState(true);
    
    // Node drag state
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });
    
    // Graph data
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [isSettled, setIsSettled] = useState(false);
    
    // Animation state for smooth entrance
    const [isVisible, setIsVisible] = useState(false);
    
    // Search highlighting
    const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
    
    // Show minimap
    const [showMinimap, setShowMinimap] = useState(true);
    
    // Show folder clusters
    const [showFolderClusters, setShowFolderClusters] = useState(true);
    
    // Trigger entrance animation on mount
    useEffect(() => {
        // Small delay to ensure CSS transition works
        requestAnimationFrame(() => {
            setIsVisible(true);
        });
    }, []);
    
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
        
        // Start entities in a natural spiral - already somewhat spaced
        entityGroups.forEach((group, i) => {
            const goldenAngle = i * 2.39996; // Golden angle for organic distribution
            // Start with moderate spacing - animation will fine-tune positions gently
            const initialRadius = 60 + (i * 40); // More spaced initial placement
            const maxRadius = baseRadius * 0.8;
            const entityX = centerX + Math.cos(goldenAngle) * Math.min(initialRadius, maxRadius);
            const entityY = centerY + Math.sin(goldenAngle) * Math.min(initialRadius, maxRadius);
            
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
                    
                    const orbitRadius = 20 + ringIndex * 12; // Closer to entity
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
        // 1. First, check explicit relations (properties with type 'relation' and relatedEntityId)
        entities.forEach(entity => {
            if (!entity.properties) return;
            
            entity.properties.forEach(prop => {
                // Check for explicit relation type with relatedEntityId
                if (prop.type === 'relation' && prop.relatedEntityId) {
                    const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);
                    if (relatedEntity) {
                        const edgeId = `relation-${entity.id}-${relatedEntity.id}`;
                        const reverseEdgeId = `relation-${relatedEntity.id}-${entity.id}`;
                        
                        // Avoid duplicate edges
                        if (!newEdges.find(e => e.id === edgeId || e.id === reverseEdgeId)) {
                            newEdges.push({
                                id: edgeId,
                                source: `entity-${entity.id}`,
                                target: `entity-${relatedEntity.id}`
                            });
                        }
                    }
                }
            });
        });
        
        // 2. Also detect implicit relationships by property naming conventions
        entities.forEach(entity => {
            if (!entity.properties) return;
            
            entity.properties.forEach(prop => {
                // Skip if already a relation type (handled above)
                if (prop.type === 'relation') return;
                
                const propLower = prop.name.toLowerCase();
                
                entities.forEach(other => {
                    if (entity.id === other.id) return;
                    const otherLower = other.name.toLowerCase();
                    
                    if (propLower.includes(otherLower) || 
                        propLower === `${otherLower}_id` ||
                        propLower === `${otherLower}id`) {
                        
                        const edgeId = `relation-${entity.id}-${other.id}`;
                        const reverseEdgeId = `relation-${other.id}-${entity.id}`;
                        
                        if (!newEdges.find(e => e.id === edgeId || e.id === reverseEdgeId)) {
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
        setIsSettled(false); // Reset to allow new settling
    }, [entities, showProperties]);
    
    // Fluid physics simulation with link-based clustering
    useEffect(() => {
        if (nodes.length === 0 || edges.length === 0) return;
        if (isSettled) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let frameCount = 0;
        let animating = true;
        const maxFrames = 300; // More frames for very smooth animation
        
        // Build adjacency map for connected entities
        const connectedEntities = new Map<string, Set<string>>();
        edges.forEach(edge => {
            // Only consider entity-to-entity connections (relations)
            if (edge.source.startsWith('entity-') && edge.target.startsWith('entity-')) {
                if (!connectedEntities.has(edge.source)) connectedEntities.set(edge.source, new Set());
                if (!connectedEntities.has(edge.target)) connectedEntities.set(edge.target, new Set());
                connectedEntities.get(edge.source)!.add(edge.target);
                connectedEntities.get(edge.target)!.add(edge.source);
            }
        });
        
        const simulate = () => {
            if (!animating || frameCount >= maxFrames) {
                setIsSettled(true);
                return;
            }
            
            // Very gentle easing - starts extremely slow
            const progress = frameCount / maxFrames;
            // Cubic ease-out for very gentle start
            const forceMultiplier = Math.min(1, progress * progress * 3);
            
            setNodes(prev => {
                const updated = prev.map(node => ({ ...node }));
                const entityMap = new Map<string, GraphNode>();
                
                // First pass: store entity positions
                updated.forEach(node => {
                    if (node.type === 'entity') {
                        entityMap.set(node.id, node);
                    }
                });
                
                // Calculate territories (space needed by each entity including its properties)
                const entityTerritories = new Map<string, number>();
                updated.forEach(node => {
                    if (node.type === 'entity') {
                        let maxOrbit = 0;
                        updated.forEach(other => {
                            if (other.parentId === node.id && other.orbitRadius) {
                                maxOrbit = Math.max(maxOrbit, other.orbitRadius);
                            }
                        });
                        entityTerritories.set(node.id, maxOrbit + 25);
                    }
                });
                
                // Apply forces to entities
                updated.forEach((node, i) => {
                    if (node.type !== 'entity' || node.fixed) return;
                    
                    let fx = 0, fy = 0;
                    const nodeTerritory = entityTerritories.get(node.id) || MIN_SEPARATION / 2;
                    const connections = connectedEntities.get(node.id);
                    
                    updated.forEach((other, j) => {
                        if (i === j || other.type !== 'entity') return;
                        
                        const otherTerritory = entityTerritories.get(other.id) || MIN_SEPARATION / 2;
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        
                        const isConnected = connections?.has(other.id);
                        
                        if (isConnected) {
                            // ATTRACTION: Gently pull connected entities together
                            const idealDist = nodeTerritory + otherTerritory + 30;
                            if (dist > idealDist) {
                                const pullStrength = (dist - idealDist) * LINK_ATTRACTION * forceMultiplier;
                                fx -= (dx / dist) * pullStrength;
                                fy -= (dy / dist) * pullStrength;
                            }
                        }
                        
                        // REPULSION: Very gentle push when too close
                        const minDist = nodeTerritory + otherTerritory;
                        if (dist < minDist) {
                            const overlap = minDist - dist;
                            const pushStrength = overlap * COLLISION_STRENGTH * forceMultiplier;
                            fx += (dx / dist) * pushStrength;
                            fy += (dy / dist) * pushStrength;
                        } else if (!isConnected && dist < minDist * 1.5) {
                            // Very gentle repulsion for unconnected entities
                            const gentlePush = REPULSION * forceMultiplier / (dist * dist + 500);
                            fx += (dx / dist) * gentlePush;
                            fy += (dy / dist) * gentlePush;
                        }
                    });
                    
                    // Very gentle center pull
                    fx += (centerX - node.x) * CENTER_PULL * forceMultiplier;
                    fy += (centerY - node.y) * CENTER_PULL * forceMultiplier;
                    
                    // Apply velocity with consistent damping for smooth movement
                    node.vx = (node.vx + fx * 0.05) * DAMPING;
                    node.vy = (node.vy + fy * 0.05) * DAMPING;
                    
                    // Smooth position update
                    node.x += node.vx;
                    node.y += node.vy;
                    
                    // Very soft bounds (elastic, subtle)
                    const padding = nodeTerritory + 50;
                    if (node.x < padding) node.vx += (padding - node.x) * 0.02;
                    if (node.x > width - padding) node.vx -= (node.x - (width - padding)) * 0.02;
                    if (node.y < padding) node.vy += (padding - node.y) * 0.02;
                    if (node.y > height - padding) node.vy -= (node.y - (height - padding)) * 0.02;
                    
                    entityMap.set(node.id, node);
                });
                
                // Very smoothly update property positions around their parent entities
                updated.forEach(node => {
                    if (node.fixed) return;
                    if (node.parentId && node.orbitRadius && node.orbitAngle !== undefined) {
                        const parent = entityMap.get(node.parentId);
                        if (parent) {
                            const targetX = parent.x + Math.cos(node.orbitAngle) * node.orbitRadius;
                            const targetY = parent.y + Math.sin(node.orbitAngle) * node.orbitRadius;
                            // Very smooth interpolation - properties follow gently
                            node.x += (targetX - node.x) * 0.15;
                            node.y += (targetY - node.y) * 0.15;
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
    }, [nodes.length, edges.length, isSettled]);
    
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
    
    // Node drag handlers
    const handleNodeDragStart = (e: React.MouseEvent, node: GraphNode) => {
        e.stopPropagation();
        setDraggingNodeId(node.id);
        
        // Calculate offset from node center to mouse position
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
            const mouseX = (e.clientX - rect.left - offset.x) / zoom;
            const mouseY = (e.clientY - rect.top - offset.y) / zoom;
            setNodeDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
        }
    };
    
    // Pan handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
            setIsPanning(true);
            setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingNodeId) {
            // Dragging a node
            const rect = svgRef.current?.getBoundingClientRect();
            if (rect) {
                const mouseX = (e.clientX - rect.left - offset.x) / zoom;
                const mouseY = (e.clientY - rect.top - offset.y) / zoom;
                
                setNodes(prev => prev.map(node => {
                    if (node.id === draggingNodeId) {
                        const newX = mouseX - nodeDragOffset.x;
                        const newY = mouseY - nodeDragOffset.y;
                        
                        // If dragging an entity, also move its properties
                        return { ...node, x: newX, y: newY, vx: 0, vy: 0 };
                    }
                    // Move properties that belong to the dragged entity
                    if (node.parentId === draggingNodeId) {
                        const parent = prev.find(n => n.id === draggingNodeId);
                        if (parent && node.orbitRadius && node.orbitAngle !== undefined) {
                            const newParentX = mouseX - nodeDragOffset.x;
                            const newParentY = mouseY - nodeDragOffset.y;
                            return {
                                ...node,
                                x: newParentX + Math.cos(node.orbitAngle) * node.orbitRadius,
                                y: newParentY + Math.sin(node.orbitAngle) * node.orbitRadius
                            };
                        }
                    }
                    return node;
                }));
            }
        } else if (isPanning) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };
    
    const handleMouseUp = () => {
        // Mark the dragged node as "fixed" so simulation won't move it
        if (draggingNodeId) {
            setNodes(prev => prev.map(node => 
                node.id === draggingNodeId ? { ...node, fixed: true } : node
            ));
        }
        setIsPanning(false);
        setDraggingNodeId(null);
    };
    
    // Wheel handler with passive: false to allow preventDefault
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            
            const rect = svg.getBoundingClientRect();
            
            // Get mouse position relative to the SVG
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate the point in world coordinates under the mouse
            const worldX = (mouseX - offset.x) / zoom;
            const worldY = (mouseY - offset.y) / zoom;
            
            // Calculate new zoom
            const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
            const newZoom = Math.max(0.3, Math.min(3, zoom * zoomFactor));
            
            // Adjust offset to keep the same point under the mouse
            const newOffsetX = mouseX - worldX * newZoom;
            const newOffsetY = mouseY - worldY * newZoom;
            
            setZoom(newZoom);
            setOffset({ x: newOffsetX, y: newOffsetY });
        };
        
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
    }, [zoom, offset]);
    
    const zoomIn = () => setZoom(z => Math.min(3, z * 1.2));
    const zoomOut = () => setZoom(z => Math.max(0.3, z / 1.2));
    const resetView = () => { 
        setZoom(1); 
        setOffset({ x: 0, y: 0 }); 
        // Unfix all nodes so they can be repositioned by the simulation
        setNodes(prev => prev.map(node => ({ ...node, fixed: false })));
    };
    
    // Fit to content - automatically fits all nodes in view
    const fitToContent = useCallback(() => {
        const entityNodes = nodes.filter(n => n.type === 'entity');
        if (entityNodes.length === 0) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const padding = 80;
        
        const minX = Math.min(...entityNodes.map(n => n.x)) - 50;
        const maxX = Math.max(...entityNodes.map(n => n.x)) + 50;
        const minY = Math.min(...entityNodes.map(n => n.y)) - 50;
        const maxY = Math.max(...entityNodes.map(n => n.y)) + 50;
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const scaleX = (width - padding * 2) / contentWidth;
        const scaleY = (height - padding * 2) / contentHeight;
        const newZoom = Math.max(0.3, Math.min(3, Math.min(scaleX, scaleY, 1.5)));
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        setZoom(newZoom);
        setOffset({
            x: width / 2 - centerX * newZoom,
            y: height / 2 - centerY * newZoom,
        });
    }, [nodes]);
    
    // Center on selected node
    const centerOnSelected = useCallback(() => {
        if (!selectedEntity) return;
        const node = nodes.find(n => n.entityId === selectedEntity);
        if (!node) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        
        setOffset({
            x: width / 2 - node.x * zoom,
            y: height / 2 - node.y * zoom,
        });
    }, [selectedEntity, nodes, zoom]);
    
    // Auto fit when settled
    useEffect(() => {
        if (isSettled && nodes.length > 0) {
            // Small delay to ensure all positions are final
            const timer = setTimeout(fitToContent, 100);
            return () => clearTimeout(timer);
        }
    }, [isSettled, fitToContent]);
    
    // Search function for GraphSearch component
    const handleSearch = useCallback((query: string) => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        
        interface SearchResult {
            id: string;
            name: string;
            type: 'entity' | 'property';
            parentName?: string;
        }
        
        const results: SearchResult[] = [];
        
        nodes.forEach(node => {
            if (node.label.toLowerCase().includes(q)) {
                if (node.type === 'entity') {
                    results.push({
                        id: node.id,
                        name: node.label,
                        type: 'entity',
                    });
                } else {
                    // Find parent entity name
                    const parent = nodes.find(n => n.id === node.parentId);
                    results.push({
                        id: node.id,
                        name: node.label,
                        type: 'property',
                        parentName: parent?.label,
                    });
                }
            }
        });
        
        return results;
    }, [nodes]);
    
    // Handle search result selection - center on node
    const handleSearchResultSelect = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        
        // Center on node
        setOffset({
            x: width / 2 - node.x * zoom,
            y: height / 2 - node.y * zoom,
        });
        
        // Select the node
        setSelectedNode(node);
        if (node.entityId) {
            setSelectedEntity(node.entityId);
        } else if (node.parentId) {
            const parent = nodes.find(n => n.id === node.parentId);
            if (parent?.entityId) {
                setSelectedEntity(parent.entityId);
            }
        }
        
        // Highlight just this node
        setHighlightedNodeIds([nodeId]);
        
        // Clear highlight after delay
        setTimeout(() => setHighlightedNodeIds([]), 3000);
    }, [nodes, zoom]);
    
    // Handle minimap viewport change
    const handleMinimapViewportChange = useCallback((newOffsetX: number, newOffsetY: number) => {
        setOffset({ x: newOffsetX, y: newOffsetY });
    }, []);
    
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
    
    // Build path for selected node
    const nodePath = useMemo(() => {
        if (!selectedNode) return null;
        
        const pathParts: { label: string; color: string; type: string }[] = [];
        
        if (selectedNode.type === 'property' && selectedNode.parentId) {
            // Find parent entity
            const parentNode = nodes.find(n => n.id === selectedNode.parentId);
            if (parentNode && parentNode.entityId) {
                const entity = entities.find(e => e.id === parentNode.entityId);
                if (entity) {
                    // Check if entity is in a folder
                    const folder = folders.find(f => f.entityIds?.includes(entity.id));
                    if (folder) {
                        pathParts.push({ label: folder.name, color: folder.color || NODE_COLORS.folder, type: 'folder' });
                    }
                    pathParts.push({ label: entity.name, color: NODE_COLORS.entity, type: 'entity' });
                }
            }
            pathParts.push({ label: selectedNode.label, color: NODE_COLORS.property, type: 'property' });
        } else if (selectedNode.type === 'entity' && selectedNode.entityId) {
            const entity = entities.find(e => e.id === selectedNode.entityId);
            if (entity) {
                // Check if entity is in a folder
                const folder = folders.find(f => f.entityIds?.includes(entity.id));
                if (folder) {
                    pathParts.push({ label: folder.name, color: folder.color || NODE_COLORS.folder, type: 'folder' });
                }
                pathParts.push({ label: entity.name, color: NODE_COLORS.entity, type: 'entity' });
            }
        }
        
        return pathParts.length > 0 ? pathParts : null;
    }, [selectedNode, nodes, entities, folders]);
    
    return createPortal(
        <div 
            className={`fixed inset-0 z-[9999] flex flex-col transition-opacity duration-300 ease-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`} 
            style={{ backgroundColor: '#1a1d21' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-4">
                    {/* Back button */}
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-2 py-1.5 text-white/60 hover:bg-white/10 rounded-md transition-colors text-sm"
                    >
                        <ArrowLeft size={14} weight="light" />
                        <span className="font-medium">Back</span>
                    </button>
                    
                    <div className="h-6 w-px bg-white/10"></div>
                    
                    <div className="flex items-center gap-3">
                        <TreeStructure size={18} weight="light" className="text-[#419CAF]" />
                        <div>
                            <h1 className="text-sm font-medium text-white/90">Knowledge Graph</h1>
                            <p className="text-[10px] text-white/40">
                                {entities.length} entities · {nodes.filter(n => n.type === 'property').length} properties
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Enhanced Search */}
                    <GraphSearch
                        onSearch={handleSearch}
                        onResultSelect={handleSearchResultSelect}
                        onHighlight={setHighlightedNodeIds}
                    />
                    
                    {/* Toggle folders */}
                    <button
                        onClick={() => setShowFolderClusters(!showFolderClusters)}
                        className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                            showFolderClusters 
                                ? 'bg-amber-500/20 text-amber-400' 
                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                    >
                        Folders
                    </button>
                    
                    {/* Toggle minimap */}
                    <button
                        onClick={() => setShowMinimap(!showMinimap)}
                        className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                            showMinimap 
                                ? 'bg-[#419CAF]/20 text-[#419CAF]' 
                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                    >
                        Minimap
                    </button>
                    
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
                        style={{ background: '#1a1d21' }}
                    >
                        {/* Clean background - no grid for cleaner look */}
                        
                        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                            {/* Folder clusters - background groupings */}
                            {showFolderClusters && folders.map(folder => {
                                // Check if folder has entities that are in the current view
                                const hasEntities = folder.entityIds?.some(entityId => 
                                    entities.some(e => e.id === entityId)
                                );
                                if (!hasEntities) return null;
                                
                                const isHighlighted = selectedEntityData && 
                                    folder.entityIds?.includes(selectedEntityData.id);
                                
                                return (
                                    <FolderCluster
                                        key={folder.id}
                                        folder={folder}
                                        nodes={nodes.map(n => ({
                                            id: n.id,
                                            x: n.x,
                                            y: n.y,
                                            radius: n.radius,
                                            type: n.type,
                                            entityId: n.entityId,
                                        }))}
                                        isHighlighted={isHighlighted || false}
                                    />
                                );
                            })}
                            
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
                                        stroke="rgba(107,114,128,0.3)"
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
                                const isHighlighted = highlightedNodeIds.includes(node.id);
                                
                                const opacity = isVisible ? (isConnected || isHighlighted || (!hoveredNode && !selectedEntity) ? 1 : 0.4) : 0.1;
                                const scale = isHighlighted ? 1.6 : (isHovered ? 1.5 : (isSelected ? 1.3 : (isConnected ? 1.1 : 1)));
                                
                                // Radius based on type
                                const baseRadius = node.type === 'entity' ? 8 : 3;
                                
                                return (
                                    <g
                                        key={node.id}
                                        transform={`translate(${node.x}, ${node.y})`}
                                        style={{ 
                                            opacity,
                                            transition: draggingNodeId === node.id ? 'none' : 'opacity 0.3s ease-out',
                                            cursor: draggingNodeId === node.id ? 'grabbing' : 'grab'
                                        }}
                                        onMouseEnter={() => !draggingNodeId && setHoveredNode(node.id)}
                                        onMouseLeave={() => !draggingNodeId && setHoveredNode(null)}
                                        onMouseDown={(e) => handleNodeDragStart(e, node)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Select node for path display
                                            setSelectedNode(selectedNode?.id === node.id ? null : node);
                                            if (node.type === 'entity' && node.entityId) {
                                                setSelectedEntity(selectedEntity === node.entityId ? null : node.entityId);
                                            }
                                        }}
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
                                        
                                        {/* Pulsing highlight for search results */}
                                        {isHighlighted && (
                                            <>
                                                <circle
                                                    r={baseRadius * scale + 10}
                                                    fill="none"
                                                    stroke={node.color}
                                                    strokeWidth={2}
                                                    strokeOpacity={0.6}
                                                    className="animate-ping"
                                                />
                                                <circle
                                                    r={baseRadius * scale + 5}
                                                    fill="none"
                                                    stroke={node.color}
                                                    strokeWidth={2}
                                                    strokeOpacity={0.8}
                                                />
                                            </>
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
                    
                    {/* Path indicator - top left */}
                    {nodePath && (
                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg">
                            {nodePath.map((part, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && (
                                        <CaretRight size={10} className="text-white/30" />
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        {part.type === 'folder' && <FolderIcon size={12} style={{ color: part.color }} weight="fill" />}
                                        {part.type === 'entity' && <Database size={12} style={{ color: part.color }} weight="fill" />}
                                        {part.type === 'property' && <Tag size={10} style={{ color: part.color }} weight="fill" />}
                                        <span 
                                            className="text-[11px] font-medium"
                                            style={{ color: part.type === 'property' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.9)' }}
                                        >
                                            {part.label}
                                        </span>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    
                    {/* Drag hint */}
                    {!nodePath && !draggingNodeId && (
                        <div className="absolute top-4 left-4 px-3 py-2 bg-black/40 backdrop-blur-sm rounded text-[10px] text-white/40">
                            Click a node to see its path · Drag nodes to rearrange
                        </div>
                    )}
                    
                    {/* Zoom controls */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-0.5 bg-black/40 backdrop-blur-sm rounded p-0.5">
                        <button onClick={zoomOut} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Alejar">
                            <Minus size={12} className="text-white/60" />
                        </button>
                        <span className="px-2 text-[10px] text-white/50 min-w-[40px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button onClick={zoomIn} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Acercar">
                            <Plus size={12} className="text-white/60" />
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <button onClick={fitToContent} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Ajustar a contenido">
                            <ArrowsOut size={12} className="text-white/60" />
                        </button>
                        {selectedEntity && (
                            <button onClick={centerOnSelected} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Centrar en selección">
                                <Crosshair size={12} className="text-white/60" />
                            </button>
                        )}
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <button onClick={resetView} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Reiniciar vista">
                            <ArrowsOut size={12} className="text-white/60" />
                        </button>
                    </div>
                    
                    {/* Minimap */}
                    {showMinimap && nodes.length > 0 && (
                        <GraphMinimap
                            nodes={nodes.map(n => ({
                                id: n.id,
                                x: n.x,
                                y: n.y,
                                vx: n.vx,
                                vy: n.vy,
                                radius: n.radius,
                                type: n.type,
                            }))}
                            viewportWidth={containerRef.current?.clientWidth || 800}
                            viewportHeight={containerRef.current?.clientHeight || 600}
                            zoom={zoom}
                            offsetX={offset.x}
                            offsetY={offset.y}
                            onViewportChange={handleMinimapViewportChange}
                        />
                    )}
                    
                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-4 px-3 py-2 bg-black/40 backdrop-blur-sm rounded text-[10px] text-white/60" style={{ marginBottom: showMinimap ? '140px' : '0' }}>
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
        </div>,
        document.body
    );
};
