import { useState, useCallback, useRef, useEffect, RefObject } from 'react';

interface CanvasPanZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface UseCanvasPanZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  initialOffset?: { x: number; y: number };
  onScaleChange?: (scale: number) => void;
  onOffsetChange?: (x: number, y: number) => void;
  /** Ref to the canvas element for attaching wheel listener with passive: false */
  canvasRef?: RefObject<HTMLElement>;
}

interface UseCanvasPanZoomReturn {
  // State
  scale: number;
  offsetX: number;
  offsetY: number;
  isPanning: boolean;
  
  // Handlers (handleWheel is now internal, attached via useEffect)
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  
  // Actions
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  fitToContent: (nodes: Array<{ x: number; y: number }>, containerRef: React.RefObject<HTMLElement>) => void;
  
  // Utils
  screenToCanvas: (screenX: number, screenY: number, containerRect: DOMRect) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
}

/**
 * Hook for managing canvas pan and zoom interactions
 */
export const useCanvasPanZoom = (options: UseCanvasPanZoomOptions = {}): UseCanvasPanZoomReturn => {
  const {
    minScale = 0.25,
    maxScale = 2,
    initialScale = 1,
    initialOffset = { x: 0, y: 0 },
    onScaleChange,
    onOffsetChange,
    canvasRef,
  } = options;

  const [state, setState] = useState<CanvasPanZoomState>({
    scale: initialScale,
    offsetX: initialOffset.x,
    offsetY: initialOffset.y,
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastOffsetRef = useRef({ x: 0, y: 0 });
  
  // Store refs for values needed in wheel handler
  const stateRef = useRef(state);
  stateRef.current = state;

  // Handle wheel zoom with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const prev = stateRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * zoomFactor));
      
      // Zoom towards mouse position
      const scaleChange = newScale / prev.scale;
      const newOffsetX = mouseX - (mouseX - prev.offsetX) * scaleChange;
      const newOffsetY = mouseY - (mouseY - prev.offsetY) * scaleChange;
      
      onScaleChange?.(newScale);
      onOffsetChange?.(newOffsetX, newOffsetY);
      
      setState({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    };
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [canvasRef, minScale, maxScale, onScaleChange, onOffsetChange]);

  // Handle pan start (middle mouse or space+click)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or left click with space key
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      lastOffsetRef.current = { x: state.offsetX, y: state.offsetY };
    }
  }, [state.offsetX, state.offsetY]);

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    
    const newOffsetX = lastOffsetRef.current.x + dx;
    const newOffsetY = lastOffsetRef.current.y + dy;
    
    setState(prev => ({
      ...prev,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    }));
    
    onOffsetChange?.(newOffsetX, newOffsetY);
  }, [isPanning, onOffsetChange]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom in action
  const zoomIn = useCallback(() => {
    setState(prev => {
      const newScale = Math.min(maxScale, prev.scale * 1.2);
      onScaleChange?.(newScale);
      return { ...prev, scale: newScale };
    });
  }, [maxScale, onScaleChange]);

  // Zoom out action
  const zoomOut = useCallback(() => {
    setState(prev => {
      const newScale = Math.max(minScale, prev.scale / 1.2);
      onScaleChange?.(newScale);
      return { ...prev, scale: newScale };
    });
  }, [minScale, onScaleChange]);

  // Reset view
  const resetView = useCallback(() => {
    setState({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    onScaleChange?.(1);
    onOffsetChange?.(0, 0);
  }, [onScaleChange, onOffsetChange]);

  // Set scale directly
  const setScale = useCallback((scale: number) => {
    const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
    setState(prev => ({ ...prev, scale: clampedScale }));
    onScaleChange?.(clampedScale);
  }, [minScale, maxScale, onScaleChange]);

  // Set offset directly
  const setOffset = useCallback((x: number, y: number) => {
    setState(prev => ({ ...prev, offsetX: x, offsetY: y }));
    onOffsetChange?.(x, y);
  }, [onOffsetChange]);

  // Fit content to view
  const fitToContent = useCallback((
    nodes: Array<{ x: number; y: number }>,
    containerRef: React.RefObject<HTMLElement>
  ) => {
    if (nodes.length === 0 || !containerRef.current) return;
    
    const container = containerRef.current;
    const padding = 120; // More generous padding
    
    // Find bounding box (account for node dimensions ~200x80)
    const minX = Math.min(...nodes.map(n => n.x)) - 100;
    const maxX = Math.max(...nodes.map(n => n.x)) + 300; // Node width ~200px + margin
    const minY = Math.min(...nodes.map(n => n.y)) - 50;
    const maxY = Math.max(...nodes.map(n => n.y)) + 130; // Node height ~80px + margin
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const containerWidth = container.clientWidth - padding * 2;
    const containerHeight = container.clientHeight - padding * 2;
    
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    // Cap at 0.75 (75%) so workflows don't appear too large by default
    // This gives users a comfortable overview with room to zoom in
    const newScale = Math.max(minScale, Math.min(0.75, Math.min(scaleX, scaleY)));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newOffsetX = container.clientWidth / 2 - centerX * newScale;
    const newOffsetY = container.clientHeight / 2 - centerY * newScale;
    
    setState({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    });
    
    onScaleChange?.(newScale);
    onOffsetChange?.(newOffsetX, newOffsetY);
  }, [minScale, maxScale, onScaleChange, onOffsetChange]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((
    screenX: number,
    screenY: number,
    containerRect: DOMRect
  ) => {
    const x = (screenX - containerRect.left - state.offsetX) / state.scale;
    const y = (screenY - containerRect.top - state.offsetY) / state.scale;
    return { x, y };
  }, [state.scale, state.offsetX, state.offsetY]);

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    const x = canvasX * state.scale + state.offsetX;
    const y = canvasY * state.scale + state.offsetY;
    return { x, y };
  }, [state.scale, state.offsetX, state.offsetY]);

  return {
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetView,
    setScale,
    setOffset,
    fitToContent,
    screenToCanvas,
    canvasToScreen,
  };
};

export default useCanvasPanZoom;
