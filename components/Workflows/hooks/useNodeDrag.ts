import { useState, useCallback, useRef } from 'react';
import type { WorkflowNode } from '../types';

interface UseNodeDragOptions {
  nodes: WorkflowNode[];
  scale: number;
  offsetX: number;
  offsetY: number;
  gridSize?: number;
  snapToGrid?: boolean;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onDragStart?: (nodeId: string) => void;
  onDragEnd?: (nodeId: string) => void;
}

interface UseNodeDragReturn {
  // State
  draggingNodeId: string | null;
  isDragging: boolean;
  
  // Handlers
  handleNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  handleMouseMove: (e: React.MouseEvent, containerRect: DOMRect) => void;
  handleMouseUp: () => void;
  
  // Get current dragging position (for optimistic UI)
  getDragPosition: (nodeId: string) => { x: number; y: number } | null;
}

/**
 * Hook for managing node drag interactions
 */
export const useNodeDrag = (options: UseNodeDragOptions): UseNodeDragReturn => {
  const {
    nodes,
    scale,
    offsetX,
    offsetY,
    gridSize = 20,
    snapToGrid = false,
    onNodeMove,
    onDragStart,
    onDragEnd,
  } = options;

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef<{ nodeX: number; nodeY: number; mouseX: number; mouseY: number } | null>(null);
  const currentPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Snap position to grid
  const snapPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Handle node drag start
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    // Only left click
    if (e.button !== 0) return;
    
    // Don't drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('button') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }
    
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDraggingNodeId(nodeId);
    dragStartRef.current = {
      nodeX: node.x,
      nodeY: node.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
    currentPositionRef.current = { x: node.x, y: node.y };
    
    onDragStart?.(nodeId);
  }, [nodes, onDragStart]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: React.MouseEvent, containerRect: DOMRect) => {
    if (!draggingNodeId || !dragStartRef.current) return;
    
    const dx = (e.clientX - dragStartRef.current.mouseX) / scale;
    const dy = (e.clientY - dragStartRef.current.mouseY) / scale;
    
    let newX = dragStartRef.current.nodeX + dx;
    let newY = dragStartRef.current.nodeY + dy;
    
    // Apply grid snapping
    const snapped = snapPosition(newX, newY);
    newX = snapped.x;
    newY = snapped.y;
    
    currentPositionRef.current = { x: newX, y: newY };
    onNodeMove?.(draggingNodeId, newX, newY);
  }, [draggingNodeId, scale, snapPosition, onNodeMove]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (draggingNodeId) {
      onDragEnd?.(draggingNodeId);
    }
    setDraggingNodeId(null);
    dragStartRef.current = null;
    currentPositionRef.current = null;
  }, [draggingNodeId, onDragEnd]);

  // Get current drag position for a node
  const getDragPosition = useCallback((nodeId: string) => {
    if (nodeId !== draggingNodeId) return null;
    return currentPositionRef.current;
  }, [draggingNodeId]);

  return {
    draggingNodeId,
    isDragging: draggingNodeId !== null,
    handleNodeMouseDown,
    handleMouseMove,
    handleMouseUp,
    getDragPosition,
  };
};

export default useNodeDrag;
