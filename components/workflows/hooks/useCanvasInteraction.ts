/**
 * Custom hook for canvas interaction (pan, zoom, drag & drop)
 * Handles all mouse/wheel events for the workflow canvas
 */

import { useState, useCallback, useRef, RefObject } from 'react';
import { WorkflowNode } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface CanvasOffset {
    x: number;
    y: number;
}

export interface DragConnectionState {
    nodeId: string;
    outputType?: string;
    x: number;
    y: number;
}

export interface CanvasInteractionHook {
    // Canvas state
    canvasOffset: CanvasOffset;
    canvasZoom: number;
    isPanning: boolean;
    
    // Drag state
    draggingNodeId: string | null;
    nodeDragged: boolean;
    dragConnectionStart: DragConnectionState | null;
    dragConnectionCurrent: { x: number; y: number } | null;
    
    // Setters
    setCanvasOffset: React.Dispatch<React.SetStateAction<CanvasOffset>>;
    setCanvasZoom: React.Dispatch<React.SetStateAction<number>>;
    setDraggingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
    
    // Handlers
    handleWheel: (e: React.WheelEvent) => void;
    handleCanvasMouseDown: (e: React.MouseEvent) => void;
    handleCanvasMouseMove: (e: React.MouseEvent, nodes: WorkflowNode[], setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>) => void;
    handleCanvasMouseUp: () => void;
    handleNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    handleConnectorMouseDown: (e: React.MouseEvent, nodeId: string, outputType?: string) => void;
    handleConnectorMouseUp: (e: React.MouseEvent, targetNodeId: string, inputPort?: 'A' | 'B') => { fromNodeId: string; toNodeId: string; outputType?: string; inputPort?: 'A' | 'B' } | null;
    
    // Utilities
    screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
    resetView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    fitToView: (nodes: WorkflowNode[]) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;

// ============================================================================
// HOOK
// ============================================================================

export const useCanvasInteraction = (
    canvasRef: RefObject<HTMLDivElement>
): CanvasInteractionHook => {
    // Canvas transform state
    const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: 0, y: 0 });
    const [canvasZoom, setCanvasZoom] = useState(DEFAULT_ZOOM);
    
    // Panning state
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    
    // Node dragging state
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [nodeDragged, setNodeDragged] = useState(false);
    
    // Connection dragging state
    const [dragConnectionStart, setDragConnectionStart] = useState<DragConnectionState | null>(null);
    const [dragConnectionCurrent, setDragConnectionCurrent] = useState<{ x: number; y: number } | null>(null);

    // Convert screen coordinates to canvas coordinates
    const screenToCanvas = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - canvasOffset.x) / canvasZoom,
            y: (screenY - rect.top - canvasOffset.y) / canvasZoom
        };
    }, [canvasRef, canvasOffset, canvasZoom]);

    // Handle mouse wheel for zooming
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        
        if (!canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate the point in canvas coordinates under the mouse
        const worldX = (mouseX - canvasOffset.x) / canvasZoom;
        const worldY = (mouseY - canvasOffset.y) / canvasZoom;
        
        // Calculate new zoom level
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(canvasZoom * delta, MIN_ZOOM), MAX_ZOOM);
        
        // Calculate new offset to keep the same point under the mouse
        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;
        
        setCanvasZoom(newZoom);
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }, [canvasRef, canvasOffset, canvasZoom]);

    // Handle canvas mouse down (start panning)
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        // Middle mouse button or left button on empty canvas
        if (e.button === 1 || (e.button === 0 && !draggingNodeId)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
            e.preventDefault();
        }
    }, [canvasOffset, draggingNodeId]);

    // Handle canvas mouse move (panning or dragging)
    const handleCanvasMouseMove = useCallback((
        e: React.MouseEvent,
        nodes: WorkflowNode[],
        setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>
    ) => {
        if (isPanning) {
            setCanvasOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        } else if (draggingNodeId) {
            if (!canvasRef.current) return;
            
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            setNodeDragged(true);
            
            setNodes(prev => prev.map(n =>
                n.id === draggingNodeId ? { ...n, x, y } : n
            ));
        }
        
        // Update connection drag line
        if (dragConnectionStart && canvasRef.current) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            setDragConnectionCurrent({ x, y });
        }
    }, [isPanning, panStart, draggingNodeId, dragConnectionStart, canvasRef, screenToCanvas]);

    // Handle canvas mouse up (stop panning/dragging)
    const handleCanvasMouseUp = useCallback(() => {
        setIsPanning(false);
        setDraggingNodeId(null);
        setNodeDragged(false);
        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    }, []);

    // Handle node mouse down (start dragging node)
    const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        setDraggingNodeId(nodeId);
        setNodeDragged(false);
    }, []);

    // Handle connector mouse down (start creating connection)
    const handleConnectorMouseDown = useCallback((e: React.MouseEvent, nodeId: string, outputType?: string) => {
        e.stopPropagation();
        e.preventDefault();
        
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        setDragConnectionStart({ nodeId, outputType, x, y });
        setDragConnectionCurrent({ x, y });
    }, [screenToCanvas]);

    // Handle connector mouse up (finish creating connection)
    const handleConnectorMouseUp = useCallback((
        e: React.MouseEvent,
        targetNodeId: string,
        inputPort?: 'A' | 'B'
    ): { fromNodeId: string; toNodeId: string; outputType?: string; inputPort?: 'A' | 'B' } | null => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!dragConnectionStart || dragConnectionStart.nodeId === targetNodeId) {
            setDragConnectionStart(null);
            setDragConnectionCurrent(null);
            return null;
        }
        
        const result = {
            fromNodeId: dragConnectionStart.nodeId,
            toNodeId: targetNodeId,
            outputType: dragConnectionStart.outputType,
            inputPort
        };
        
        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
        
        return result;
    }, [dragConnectionStart]);

    // Reset view to default
    const resetView = useCallback(() => {
        setCanvasOffset({ x: 0, y: 0 });
        setCanvasZoom(DEFAULT_ZOOM);
    }, []);

    // Zoom in
    const zoomIn = useCallback(() => {
        setCanvasZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
    }, []);

    // Zoom out
    const zoomOut = useCallback(() => {
        setCanvasZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
    }, []);

    // Fit all nodes in view
    const fitToView = useCallback((nodes: WorkflowNode[]) => {
        if (!canvasRef.current || nodes.length === 0) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const padding = 100;
        
        // Find bounding box of all nodes
        const minX = Math.min(...nodes.map(n => n.x));
        const maxX = Math.max(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxY = Math.max(...nodes.map(n => n.y));
        
        const contentWidth = maxX - minX + 400; // Node width estimate
        const contentHeight = maxY - minY + 200; // Node height estimate
        
        // Calculate zoom to fit
        const scaleX = (rect.width - padding * 2) / contentWidth;
        const scaleY = (rect.height - padding * 2) / contentHeight;
        const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), MAX_ZOOM);
        
        // Calculate offset to center
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const newOffsetX = rect.width / 2 - centerX * newZoom;
        const newOffsetY = rect.height / 2 - centerY * newZoom;
        
        setCanvasZoom(newZoom);
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }, [canvasRef]);

    return {
        // Canvas state
        canvasOffset,
        canvasZoom,
        isPanning,
        
        // Drag state
        draggingNodeId,
        nodeDragged,
        dragConnectionStart,
        dragConnectionCurrent,
        
        // Setters
        setCanvasOffset,
        setCanvasZoom,
        setDraggingNodeId,
        
        // Handlers
        handleWheel,
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleNodeMouseDown,
        handleConnectorMouseDown,
        handleConnectorMouseUp,
        
        // Utilities
        screenToCanvas,
        resetView,
        zoomIn,
        zoomOut,
        fitToView,
    };
};

export default useCanvasInteraction;
