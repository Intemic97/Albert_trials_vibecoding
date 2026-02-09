/**
 * useGraphInteraction - Handles all user interactions for Knowledge Graph
 * 
 * - Pan & Zoom (wheel with passive: false)
 * - Node dragging
 * - Hover effects
 * - Selection
 */

import { useState, useCallback, useRef, useEffect, RefObject } from 'react';
import type { PhysicsNode } from './useGraphPhysics';

interface UseGraphInteractionOptions {
    svgRef: RefObject<SVGSVGElement>;
    nodes: PhysicsNode[];
    onNodesChange: (updater: (nodes: PhysicsNode[]) => PhysicsNode[]) => void;
    minZoom?: number;
    maxZoom?: number;
}

interface ViewState {
    zoom: number;
    offsetX: number;
    offsetY: number;
}

export const useGraphInteraction = ({
    svgRef,
    nodes,
    onNodesChange,
    minZoom = 0.2,
    maxZoom = 4,
}: UseGraphInteractionOptions) => {
    // View state
    const [view, setView] = useState<ViewState>({ zoom: 1, offsetX: 0, offsetY: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    
    // Refs for pan drag
    const panStartRef = useRef({ x: 0, y: 0 });
    const nodeDragOffsetRef = useRef({ x: 0, y: 0 });
    
    // Wheel zoom with passive: false
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            
            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            setView(prev => {
                const worldX = (mouseX - prev.offsetX) / prev.zoom;
                const worldY = (mouseY - prev.offsetY) / prev.zoom;
                
                const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
                const newZoom = Math.max(minZoom, Math.min(maxZoom, prev.zoom * zoomFactor));
                
                return {
                    zoom: newZoom,
                    offsetX: mouseX - worldX * newZoom,
                    offsetY: mouseY - worldY * newZoom,
                };
            });
        };
        
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
    }, [svgRef, minZoom, maxZoom]);
    
    // Pan handlers
    const handlePanStart = useCallback((e: React.MouseEvent) => {
        if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX - view.offsetX, y: e.clientY - view.offsetY };
        }
    }, [svgRef, view.offsetX, view.offsetY]);
    
    const handlePanMove = useCallback((e: React.MouseEvent) => {
        if (draggingNodeId) {
            // Node dragging
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            
            const mouseX = (e.clientX - rect.left - view.offsetX) / view.zoom;
            const mouseY = (e.clientY - rect.top - view.offsetY) / view.zoom;
            const newX = mouseX - nodeDragOffsetRef.current.x;
            const newY = mouseY - nodeDragOffsetRef.current.y;
            
            onNodesChange(prev => prev.map(node => {
                if (node.id === draggingNodeId) {
                    return { ...node, x: newX, y: newY, vx: 0, vy: 0 };
                }
                // Move child properties with parent entity
                if (node.parentId === draggingNodeId && node.orbitRadius && node.orbitAngle !== undefined) {
                    return {
                        ...node,
                        x: newX + Math.cos(node.orbitAngle) * node.orbitRadius,
                        y: newY + Math.sin(node.orbitAngle) * node.orbitRadius,
                    };
                }
                return node;
            }));
        } else if (isPanning) {
            setView(prev => ({
                ...prev,
                offsetX: e.clientX - panStartRef.current.x,
                offsetY: e.clientY - panStartRef.current.y,
            }));
        }
    }, [draggingNodeId, isPanning, svgRef, view, onNodesChange]);
    
    const handlePanEnd = useCallback(() => {
        if (draggingNodeId) {
            // Mark node as fixed after drag
            onNodesChange(prev => prev.map(node =>
                node.id === draggingNodeId ? { ...node, fixed: true } : node
            ));
        }
        setIsPanning(false);
        setDraggingNodeId(null);
    }, [draggingNodeId, onNodesChange]);
    
    // Node drag start
    const handleNodeDragStart = useCallback((e: React.MouseEvent, node: PhysicsNode) => {
        e.stopPropagation();
        setDraggingNodeId(node.id);
        
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
            const mouseX = (e.clientX - rect.left - view.offsetX) / view.zoom;
            const mouseY = (e.clientY - rect.top - view.offsetY) / view.zoom;
            nodeDragOffsetRef.current = { x: mouseX - node.x, y: mouseY - node.y };
        }
    }, [svgRef, view]);
    
    // Node click
    const handleNodeClick = useCallback((e: React.MouseEvent, node: PhysicsNode) => {
        e.stopPropagation();
        setSelectedNodeId(prev => prev === node.id ? null : node.id);
        if (node.type === 'entity') {
            const entityId = node.id.replace('entity-', '');
            setSelectedEntityId(prev => prev === entityId ? null : entityId);
        }
    }, []);
    
    // Hover handlers
    const handleNodeHover = useCallback((nodeId: string | null) => {
        if (!draggingNodeId) {
            setHoveredNodeId(nodeId);
        }
    }, [draggingNodeId]);
    
    // Zoom controls
    const zoomIn = useCallback(() => {
        setView(prev => ({
            ...prev,
            zoom: Math.min(maxZoom, prev.zoom * 1.2),
        }));
    }, [maxZoom]);
    
    const zoomOut = useCallback(() => {
        setView(prev => ({
            ...prev,
            zoom: Math.max(minZoom, prev.zoom / 1.2),
        }));
    }, [minZoom]);
    
    const resetView = useCallback(() => {
        setView({ zoom: 1, offsetX: 0, offsetY: 0 });
        // Unfix all nodes
        onNodesChange(prev => prev.map(node => ({ ...node, fixed: false })));
    }, [onNodesChange]);
    
    // Fit to content
    const fitToContent = useCallback((containerWidth: number, containerHeight: number) => {
        if (nodes.length === 0) return;
        
        const padding = 80;
        const entityNodes = nodes.filter(n => n.type === 'entity');
        if (entityNodes.length === 0) return;
        
        const minX = Math.min(...entityNodes.map(n => n.x)) - 50;
        const maxX = Math.max(...entityNodes.map(n => n.x)) + 50;
        const minY = Math.min(...entityNodes.map(n => n.y)) - 50;
        const maxY = Math.max(...entityNodes.map(n => n.y)) + 50;
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const scaleX = (containerWidth - padding * 2) / contentWidth;
        const scaleY = (containerHeight - padding * 2) / contentHeight;
        const newZoom = Math.max(minZoom, Math.min(maxZoom, Math.min(scaleX, scaleY, 1.5)));
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        setView({
            zoom: newZoom,
            offsetX: containerWidth / 2 - centerX * newZoom,
            offsetY: containerHeight / 2 - centerY * newZoom,
        });
    }, [nodes, minZoom, maxZoom]);
    
    return {
        // View state
        view,
        isPanning,
        draggingNodeId,
        hoveredNodeId,
        selectedEntityId,
        selectedNodeId,
        
        // Handlers
        handlePanStart,
        handlePanMove,
        handlePanEnd,
        handleNodeDragStart,
        handleNodeClick,
        handleNodeHover,
        
        // Actions
        zoomIn,
        zoomOut,
        resetView,
        fitToContent,
        setSelectedEntityId,
        setSelectedNodeId,
    };
};

export default useGraphInteraction;
