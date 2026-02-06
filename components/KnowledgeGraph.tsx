import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, MagnifyingGlass, Minus, Plus, ArrowsOut, TreeStructure, Eye, CaretRight, Folder as FolderIcon, Database, Tag, ArrowLeft, Crosshair
} from '@phosphor-icons/react';
import { Entity } from '../types';
import { API_BASE } from '../config';

// Modular components
import { GraphSearch } from './knowledge-graph/components';

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
    category?: EntityCategory; // Entity category for typed icons
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label?: string; // Relation name shown on edge
}

// Entity type detection based on folder name or entity name patterns
type EntityCategory = 'plant' | 'equipment' | 'sensor' | 'material' | 'process' | 'safety' | 'generic';

const ENTITY_CATEGORY_CONFIG: Record<EntityCategory, { color: string; label: string }> = {
    plant:     { color: '#F59E0B', label: 'Plant/Area' },
    equipment: { color: '#3B82F6', label: 'Equipment' },
    sensor:    { color: '#10B981', label: 'Sensor' },
    material:  { color: '#8B5CF6', label: 'Material' },
    process:   { color: '#EC4899', label: 'Process' },
    safety:    { color: '#EF4444', label: 'Safety' },
    generic:   { color: '#419CAF', label: 'Entity' },
};

const CATEGORY_PATTERNS: { category: EntityCategory; patterns: RegExp[] }[] = [
    { category: 'plant', patterns: [/plant|planta|factory|f[aá]brica|area|[aá]rea|site|facility|building|nave/i] },
    { category: 'equipment', patterns: [/equip|reactor|pump|bomba|compresor|compressor|valve|v[aá]lvula|tank|tanque|column|columna|heat.*exchanger|intercambiador|motor|turbine|turbina|conveyor|cinta|mixer|mezclador|machine|m[aá]quina|extruder|extrusora/i] },
    { category: 'sensor', patterns: [/sensor|instrument|gauge|meter|medidor|termopar|thermocouple|transmitter|transmisor|detector|analyz|analizador|probe|sonda|flow.*meter|caudal[ií]metro|thermometer|term[oó]metro|pressure|presi[oó]n|temperature|temperatura|level|nivel/i] },
    { category: 'material', patterns: [/material|product|producto|chemical|qu[ií]mico|raw.*material|materia.*prima|ingredient|ingrediente|batch|lote|sample|muestra|compound|compuesto|polymer|pol[ií]mero|resin|resina/i] },
    { category: 'process', patterns: [/process|proceso|workflow|recipe|receta|operation|operaci[oó]n|step|etapa|phase|fase|procedure|procedimiento|production|producci[oó]n|maintenance|mantenimiento/i] },
    { category: 'safety', patterns: [/safety|seguridad|alarm|alarma|alert|alerta|emergency|emergencia|hazard|peligro|risk|riesgo|compliance|cumplimiento|inspection|inspecci[oó]n|incident|incidente/i] },
];

function detectEntityCategory(entityName: string, folderName?: string): EntityCategory {
    const textToCheck = `${entityName} ${folderName || ''}`;
    for (const { category, patterns } of CATEGORY_PATTERNS) {
        if (patterns.some(p => p.test(textToCheck))) {
            return category;
        }
    }
    return 'generic';
}

// Simple color palette matching design system
const NODE_COLORS = {
    entity: '#419CAF',      // Primary teal - Entities
    property: '#6B7280',    // Gray - All properties/variables
    folder: '#F59E0B',      // Amber - Folders (if shown)
};

// Force simulation constants
const REPULSION = 300;           // Push overlapping entities apart
const LINK_ATTRACTION = 0.02;    // Pull connected entities together
const FOLDER_ATTRACTION = 0.03;  // Pull same-folder entities together
const CENTER_PULL = 0.0005;      // Very subtle center gravity
const DAMPING = 0.85;            // High damping for smooth, slow movement
const COLLISION_STRENGTH = 0.5;  // Strong collision response to prevent overlap
const MIN_SEPARATION = 120;      // Larger minimum distance between entity centers

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
    
    // Legend filter - which categories are visible
    const [hiddenCategories, setHiddenCategories] = useState<Set<EntityCategory>>(new Set());
    
    // Data preview for selected entity
    const [previewData, setPreviewData] = useState<{ records: any[]; loading: boolean; error?: string }>({ records: [], loading: false });
    
    // Trigger entrance animation on mount
    useEffect(() => {
        // Small delay to ensure CSS transition works
        requestAnimationFrame(() => {
            setIsVisible(true);
        });
    }, []);
    
    // All properties use the same gray color
    const getPropertyColor = (): string => NODE_COLORS.property;
    
    // Initialize graph - nodes start AT their final positions (minimal movement)
    useEffect(() => {
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        const newNodes: GraphNode[] = [];
        const newEdges: GraphEdge[] = [];
        
        const entityGroups: { entity: Entity; propCount: number }[] = entities.map(e => ({
            entity: e,
            propCount: e.properties?.length || 0
        })).sort((a, b) => b.propCount - a.propCount);
        
        // Build entity->folder name map for category detection
        const entityFolderNameMap = new Map<string, string>();
        folders.forEach(folder => {
            folder.entityIds?.forEach(eid => entityFolderNameMap.set(eid, folder.name));
        });
        
        // Entities start directly at their final spiral position - no travel animation
        // Spacing accounts for each entity's property cloud size
        entityGroups.forEach((group, i) => {
            const goldenAngle = i * 2.39996;
            // More generous spacing: base + per-entity step, scaled by property count
            const propRadius = 30 + Math.ceil((group.propCount || 0) / 8) * 15; // Space needed for properties
            const radius = 80 + (i * 55) + propRadius; // Much wider spiral
            const maxRadius = Math.min(width, height) * 0.42; // Use more of the viewport
            const entityX = centerX + Math.cos(goldenAngle) * Math.min(radius, maxRadius);
            const entityY = centerY + Math.sin(goldenAngle) * Math.min(radius, maxRadius);
            
            const folderName = entityFolderNameMap.get(group.entity.id);
            // Use real entityType if available, fallback to name-based detection
            const category: EntityCategory = (group.entity as any).entityType && (group.entity as any).entityType !== 'generic'
                ? (group.entity as any).entityType as EntityCategory
                : detectEntityCategory(group.entity.name, folderName);
            const categoryColor = ENTITY_CATEGORY_CONFIG[category].color;
            
            newNodes.push({
                id: `entity-${group.entity.id}`,
                type: 'entity',
                label: group.entity.name,
                color: categoryColor,
                x: entityX,
                y: entityY,
                vx: 0,
                vy: 0,
                radius: 8,
                entityId: group.entity.id,
                category,
            });
            
            // Properties start at their orbit positions directly
            if (showProperties && group.entity.properties) {
                const props = group.entity.properties;
                const numProps = props.length;
                const propsPerRing = 8;
                
                props.forEach((prop, j) => {
                    const ringIndex = Math.floor(j / propsPerRing);
                    const posInRing = j % propsPerRing;
                    const propsInThisRing = Math.min(propsPerRing, numProps - ringIndex * propsPerRing);
                    
                    const orbitRadius = 28 + ringIndex * 16; // More space between rings
                    const angleOffset = ringIndex * 0.4; // More angular offset per ring
                    const propAngle = angleOffset + (posInRing / propsInThisRing) * 2 * Math.PI;
                    
                    const propColor = getPropertyColor();
                    
                    newNodes.push({
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
                    });
                    
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
                                target: `entity-${relatedEntity.id}`,
                                label: prop.name, // e.g. "Located In", "Belongs To"
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
                                target: `entity-${other.id}`,
                                label: prop.name, // e.g. "customer_id"
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
    
    // Minimal settling: nodes already start in place, just a gentle nudge for clustering
    useEffect(() => {
        if (nodes.length === 0) return;
        if (isSettled) return;
        
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let frameCount = 0;
        let animating = true;
        const maxFrames = 150; // ~2.5s - enough to resolve overlaps smoothly
        
        // Build adjacency map
        const connectedEntities = new Map<string, Set<string>>();
        edges.forEach(edge => {
            if (edge.source.startsWith('entity-') && edge.target.startsWith('entity-')) {
                if (!connectedEntities.has(edge.source)) connectedEntities.set(edge.source, new Set());
                if (!connectedEntities.has(edge.target)) connectedEntities.set(edge.target, new Set());
                connectedEntities.get(edge.source)!.add(edge.target);
                connectedEntities.get(edge.target)!.add(edge.source);
            }
        });
        
        const entityFolderMap = new Map<string, string>();
        folders.forEach(folder => {
            folder.entityIds?.forEach(entityId => {
                entityFolderMap.set(`entity-${entityId}`, folder.id);
            });
        });
        
        const simulate = () => {
            if (!animating || frameCount >= maxFrames) {
                setIsSettled(true);
                return;
            }
            
            // Force fades to zero quickly - just gentle nudges
            const t = frameCount / maxFrames;
            const forceFade = Math.pow(1 - t, 3); // Cubic fade-out: strong → zero fast
            
            setNodes(prev => {
                const updated = prev.map(node => ({ ...node }));
                const entityMap = new Map<string, GraphNode>();
                
                updated.forEach(node => {
                    if (node.type === 'entity') entityMap.set(node.id, node);
                });
                
                const entityTerritories = new Map<string, number>();
                updated.forEach(node => {
                    if (node.type === 'entity') {
                        let maxOrbit = 0;
                        updated.forEach(other => {
                            if (other.parentId === node.id && other.orbitRadius) {
                                maxOrbit = Math.max(maxOrbit, other.orbitRadius);
                            }
                        });
                        entityTerritories.set(node.id, maxOrbit + 40); // Generous padding around property cloud
                    }
                });
                
                // Very gentle forces - just resolve overlaps and nudge connected closer
                updated.forEach((node, i) => {
                    if (node.type !== 'entity' || node.fixed) return;
                    
                    let fx = 0, fy = 0;
                    const nodeTerritory = entityTerritories.get(node.id) || MIN_SEPARATION / 2;
                    const connections = connectedEntities.get(node.id);
                    const nodeFolder = entityFolderMap.get(node.id);
                    
                    updated.forEach((other, j) => {
                        if (i === j || other.type !== 'entity') return;
                        
                        const otherTerritory = entityTerritories.get(other.id) || MIN_SEPARATION / 2;
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        
                        const isConnected = connections?.has(other.id);
                        const otherFolder = entityFolderMap.get(other.id);
                        const sameFolder = nodeFolder && otherFolder && nodeFolder === otherFolder;
                        
                        // Gently pull connected nodes closer
                        if (isConnected) {
                            const idealDist = nodeTerritory + otherTerritory + 30;
                            if (dist > idealDist) {
                                const pull = (dist - idealDist) * LINK_ATTRACTION * forceFade;
                                fx -= (dx / dist) * pull;
                                fy -= (dy / dist) * pull;
                            }
                        }
                        // Folder attraction
                        if (sameFolder && !isConnected) {
                            const idealDist = nodeTerritory + otherTerritory + 50;
                            if (dist > idealDist) {
                                const pull = (dist - idealDist) * FOLDER_ATTRACTION * forceFade;
                                fx -= (dx / dist) * pull;
                                fy -= (dy / dist) * pull;
                            }
                        }
                        
                        // Only push apart if actually overlapping
                        const minDist = nodeTerritory + otherTerritory;
                        if (dist < minDist) {
                            const overlap = minDist - dist;
                            const push = overlap * COLLISION_STRENGTH * forceFade;
                            fx += (dx / dist) * push;
                            fy += (dy / dist) * push;
                        }
                    });
                    
                    // Very subtle center pull
                    fx += (centerX - node.x) * CENTER_PULL * 0.5 * forceFade;
                    fy += (centerY - node.y) * CENTER_PULL * 0.5 * forceFade;
                    
                    // High damping = slow, gentle movement
                    node.vx = (node.vx + fx * 0.03) * 0.85;
                    node.vy = (node.vy + fy * 0.03) * 0.85;
                    node.x += node.vx;
                    node.y += node.vy;
                    
                    entityMap.set(node.id, node);
                });
                
                // Properties follow parent smoothly
                updated.forEach(node => {
                    if (node.fixed) return;
                    if (node.parentId && node.orbitRadius && node.orbitAngle !== undefined) {
                        const parent = entityMap.get(node.parentId);
                        if (parent) {
                            const tx = parent.x + Math.cos(node.orbitAngle) * node.orbitRadius;
                            const ty = parent.y + Math.sin(node.orbitAngle) * node.orbitRadius;
                            node.x += (tx - node.x) * 0.2;
                            node.y += (ty - node.y) * 0.2;
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
    
    // Filter nodes by search and hidden categories
    const filteredNodeIds = useMemo(() => {
        const matching = new Set<string>();
        
        nodes.forEach(node => {
            // Filter by hidden categories
            if (node.type === 'entity' && node.category && hiddenCategories.has(node.category)) return;
            if (node.type === 'property' && node.parentId) {
                const parent = nodes.find(n => n.id === node.parentId);
                if (parent?.category && hiddenCategories.has(parent.category)) return;
            }
            
            // Filter by search
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (node.label.toLowerCase().includes(q)) {
                    matching.add(node.id);
                    if (node.parentId) matching.add(node.parentId);
                    nodes.filter(n => n.parentId === node.id).forEach(n => matching.add(n.id));
                }
            } else {
                matching.add(node.id);
            }
        });
        
        return matching;
    }, [nodes, searchQuery, hiddenCategories]);
    
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
    
    // Fetch preview data when entity is selected
    useEffect(() => {
        if (!selectedEntity) {
            setPreviewData({ records: [], loading: false });
            return;
        }
        
        const fetchPreview = async () => {
            setPreviewData(prev => ({ ...prev, loading: true, error: undefined }));
            try {
                const res = await fetch(`${API_BASE}/entities/${selectedEntity}/records?limit=5`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    // Take last 5 records
                    const records = Array.isArray(data) ? data.slice(-5) : [];
                    setPreviewData({ records, loading: false });
                } else {
                    setPreviewData({ records: [], loading: false, error: 'Failed to load' });
                }
            } catch {
                setPreviewData({ records: [], loading: false, error: 'No data available' });
            }
        };
        
        fetchPreview();
    }, [selectedEntity]);
    
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
    
    // Compute active categories present in the graph
    const activeCategories = useMemo(() => {
        const cats = new Set<EntityCategory>();
        nodes.forEach(n => {
            if (n.type === 'entity' && n.category) cats.add(n.category);
        });
        return Array.from(cats);
    }, [nodes]);
    
    // Toggle category visibility
    const toggleCategory = useCallback((cat: EntityCategory) => {
        setHiddenCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }, []);
    
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
                            {/* Edges - subtle lines with labels for relations */}
                            {edges.map(edge => {
                                const source = nodes.find(n => n.id === edge.source);
                                const target = nodes.find(n => n.id === edge.target);
                                if (!source || !target) return null;
                                
                                const isHighlighted = connectedNodes.has(edge.source) && connectedNodes.has(edge.target);
                                const isVisible = filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
                                const isRelation = edge.id.startsWith('relation');
                                
                                if (!isVisible && !isHighlighted) {
                                    return (
                                        <line
                                            key={edge.id}
                                            x1={source.x} y1={source.y}
                                            x2={target.x} y2={target.y}
                                            stroke="rgba(107,114,128,0.1)"
                                            strokeWidth={0.5}
                                        />
                                    );
                                }
                                
                                // For relation edges, use curved path with label
                                if (isRelation) {
                                    const dx = target.x - source.x;
                                    const dy = target.y - source.y;
                                    const dist = Math.sqrt(dx * dx + dy * dy);
                                    // Slight curve for visual distinction
                                    const mx = (source.x + target.x) / 2;
                                    const my = (source.y + target.y) / 2;
                                    const curvature = Math.min(20, dist * 0.08);
                                    // Normal perpendicular to edge
                                    const nx = -dy / dist;
                                    const ny = dx / dist;
                                    const cx = mx + nx * curvature;
                                    const cy = my + ny * curvature;
                                    
                                    const pathD = `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
                                    const edgeColor = isHighlighted ? 'rgba(255,255,255,0.5)' : 'rgba(107,114,128,0.3)';
                                    
                                    return (
                                        <g key={edge.id}>
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={edgeColor}
                                                strokeWidth={isHighlighted ? 1.5 : 0.8}
                                                strokeDasharray={isRelation ? '' : '3,3'}
                                            />
                                            {/* Arrowhead */}
                                            <circle
                                                cx={target.x - (dx / dist) * 12}
                                                cy={target.y - (dy / dist) * 12}
                                                r={2}
                                                fill={edgeColor}
                                            />
                                            {/* Relation label - show when highlighted or at reasonable zoom */}
                                            {edge.label && (isHighlighted || zoom > 0.9) && (
                                                <text
                                                    x={cx}
                                                    y={cy - 4}
                                                    textAnchor="middle"
                                                    fill={isHighlighted ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'}
                                                    fontSize={8}
                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                    fontWeight={400}
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {edge.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                }
                                
                                return (
                                    <line
                                        key={edge.id}
                                        x1={source.x} y1={source.y}
                                        x2={target.x} y2={target.y}
                                        stroke="rgba(107,114,128,0.3)"
                                        strokeWidth={isHighlighted ? 1 : 0.5}
                                        strokeOpacity={isHighlighted ? 0.8 : 0.4}
                                        strokeDasharray="2,2"
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
                                        {/* Solid circle with category color */}
                                        <circle
                                            r={baseRadius * scale}
                                            fill={node.color}
                                            style={{ transition: 'all 0.2s ease-out' }}
                                        />
                                        
                                        {/* Category letter icon for entities at zoom > 0.7 */}
                                        {node.type === 'entity' && node.category && node.category !== 'generic' && zoom > 0.7 && (
                                            <text
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fill="white"
                                                fontSize={baseRadius * scale * 0.8}
                                                fontFamily="system-ui, -apple-system, sans-serif"
                                                fontWeight={600}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {node.category === 'plant' && 'P'}
                                                {node.category === 'equipment' && 'E'}
                                                {node.category === 'sensor' && 'S'}
                                                {node.category === 'material' && 'M'}
                                                {node.category === 'process' && 'F'}
                                                {node.category === 'safety' && '!'}
                                            </text>
                                        )}
                                        
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
                    </div>
                    
                    {/* Interactive Legend - click to filter */}
                    <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 px-3 py-2.5 bg-black/50 backdrop-blur-sm rounded-lg text-[10px]">
                        <span className="text-white/30 font-medium mb-0.5">Click to filter</span>
                        {activeCategories.map(cat => {
                            const config = ENTITY_CATEGORY_CONFIG[cat];
                            const isHidden = hiddenCategories.has(cat);
                            const count = nodes.filter(n => n.category === cat).length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={`flex items-center gap-2 px-1.5 py-0.5 rounded transition-all hover:bg-white/10 ${isHidden ? 'opacity-30' : 'opacity-100'}`}
                                >
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: config.color, opacity: isHidden ? 0.3 : 1 }} 
                                    />
                                    <span className="text-white/70">{config.label}</span>
                                    <span className="text-white/30 ml-auto">{count}</span>
                                </button>
                            );
                        })}
                        {showProperties && (
                            <div className="flex items-center gap-2 px-1.5 py-0.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_COLORS.property }} />
                                <span className="text-white/50">Properties</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Details panel */}
                {selectedEntityData && (
                    <div className="w-72 border-l border-white/10 bg-black/20 overflow-y-auto custom-scrollbar">
                        {/* Entity header with category badge */}
                        <div className="p-4 border-b border-white/5">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    {(() => {
                                        const node = nodes.find(n => n.entityId === selectedEntity);
                                        const cat = node?.category || 'generic';
                                        const config = ENTITY_CATEGORY_CONFIG[cat];
                                        return (
                                            <span 
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium mb-2"
                                                style={{ backgroundColor: `${config.color}20`, color: config.color }}
                                            >
                                                {config.label}
                                            </span>
                                        );
                                    })()}
                                    <h3 className="text-sm font-medium text-white/90">{selectedEntityData.name}</h3>
                                    {selectedEntityData.description && (
                                        <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{selectedEntityData.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedEntity(null)}
                                    className="p-1 hover:bg-white/10 rounded flex-shrink-0"
                                >
                                    <X size={12} className="text-white/40" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Properties list */}
                        <div className="p-4 border-b border-white/5">
                            <h4 className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">
                                Properties ({selectedEntityData.properties?.length || 0})
                            </h4>
                            <div className="space-y-1">
                                {selectedEntityData.properties?.map((prop, idx) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded"
                                    >
                                        <div 
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: prop.type === 'relation' ? '#F59E0B' : NODE_COLORS.property }}
                                        />
                                        <span className="text-[11px] text-white/70 truncate flex-1">{prop.name}</span>
                                        <span className="text-[9px] text-white/30 px-1.5 py-0.5 bg-white/5 rounded">{prop.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Data Preview */}
                        <div className="p-4 border-b border-white/5">
                            <h4 className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">
                                Latest Records
                            </h4>
                            {previewData.loading ? (
                                <div className="text-[10px] text-white/30 text-center py-3">Loading...</div>
                            ) : previewData.error ? (
                                <div className="text-[10px] text-white/30 text-center py-3">{previewData.error}</div>
                            ) : previewData.records.length === 0 ? (
                                <div className="text-[10px] text-white/30 text-center py-3">No records yet</div>
                            ) : (
                                <div className="space-y-2">
                                    {previewData.records.slice(0, 3).map((record: any, idx: number) => (
                                        <div key={record.id || idx} className="px-2 py-2 bg-white/5 rounded text-[10px]">
                                            {/* Show first few fields of the record */}
                                            {Object.entries(record)
                                                .filter(([key]) => !['id', 'entityId', 'createdAt'].includes(key))
                                                .slice(0, 4)
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between gap-2 py-0.5">
                                                        <span className="text-white/40 truncate">{key}</span>
                                                        <span className="text-white/70 font-mono truncate max-w-[120px] text-right">
                                                            {typeof value === 'number' 
                                                                ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                                : String(value || '—').slice(0, 30)}
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    ))}
                                    {previewData.records.length > 3 && (
                                        <p className="text-[9px] text-white/30 text-center">
                                            +{previewData.records.length - 3} more records
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* View entity button */}
                        <div className="p-4">
                            <button
                                onClick={() => onNavigate(selectedEntityData.id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#419CAF]/20 hover:bg-[#419CAF]/30 text-[#419CAF] rounded-lg text-[11px] font-medium transition-colors"
                            >
                                <Eye size={12} />
                                View Full Details
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
