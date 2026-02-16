import { useState, useCallback, useRef, useEffect } from 'react';
import { CanvasState, DragState } from '../types';
import { CANVAS_CONSTANTS } from '../constants';

interface UseWorkflowCanvasOptions {
  initialScale?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
}

interface UseWorkflowCanvasReturn {
  // Canvas state
  scale: number;
  offsetX: number;
  offsetY: number;
  
  // Canvas ref
  canvasRef: React.RefObject<HTMLDivElement>;
  
  // Actions
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitToContent: (nodePositions: Array<{ x: number; y: number }>) => void;
  
  // Pan handling
  isPanning: boolean;
  startPan: (e: React.MouseEvent) => void;
  handlePan: (e: React.MouseEvent) => void;
  endPan: () => void;
  
  // Coordinate conversion
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
}

export const useWorkflowCanvas = (options: UseWorkflowCanvasOptions = {}): UseWorkflowCanvasReturn => {
  const {
    initialScale = CANVAS_CONSTANTS.DEFAULT_SCALE,
    initialOffsetX = 0,
    initialOffsetY = 0,
  } = options;

  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScaleState] = useState(initialScale);
  const [offsetX, setOffsetX] = useState(initialOffsetX);
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Set scale with bounds
  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(
      CANVAS_CONSTANTS.MIN_SCALE,
      Math.min(CANVAS_CONSTANTS.MAX_SCALE, newScale)
    );
    setScaleState(clampedScale);
  }, []);

  // Set offset
  const setOffset = useCallback((x: number, y: number) => {
    setOffsetX(x);
    setOffsetY(y);
  }, []);

  // Zoom in
  const zoomIn = useCallback(() => {
    setScale(scale + CANVAS_CONSTANTS.ZOOM_STEP);
  }, [scale, setScale]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setScale(scale - CANVAS_CONSTANTS.ZOOM_STEP);
  }, [scale, setScale]);

  // Reset view
  const resetView = useCallback(() => {
    setScaleState(CANVAS_CONSTANTS.DEFAULT_SCALE);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  // Fit to content
  const fitToContent = useCallback((nodePositions: Array<{ x: number; y: number }>) => {
    if (!canvasRef.current || nodePositions.length === 0) return;

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();

    // Calculate bounds
    const minX = Math.min(...nodePositions.map(n => n.x));
    const maxX = Math.max(...nodePositions.map(n => n.x));
    const minY = Math.min(...nodePositions.map(n => n.y));
    const maxY = Math.max(...nodePositions.map(n => n.y));

    // Add padding
    const padding = 100;
    const contentWidth = maxX - minX + CANVAS_CONSTANTS.NODE_WIDTH + padding * 2;
    const contentHeight = maxY - minY + 150 + padding * 2; // 150 is approx node height

    // Calculate scale to fit
    const scaleX = canvasRect.width / contentWidth;
    const scaleY = canvasRect.height / contentHeight;
    const newScale = Math.min(scaleX, scaleY, CANVAS_CONSTANTS.MAX_SCALE);

    // Calculate offset to center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newOffsetX = canvasRect.width / 2 - centerX * newScale;
    const newOffsetY = canvasRect.height / 2 - centerY * newScale;

    setScaleState(Math.max(newScale, CANVAS_CONSTANTS.MIN_SCALE));
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  }, []);

  // Start panning
  const startPan = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1 && !e.shiftKey) return; // Middle mouse or shift+drag
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  }, [offsetX, offsetY]);

  // Handle pan movement
  const handlePan = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    
    setOffsetX(e.clientX - panStart.x);
    setOffsetY(e.clientY - panStart.y);
  }, [isPanning, panStart]);

  // End panning
  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: screenX, y: screenY };
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offsetX) / scale,
      y: (screenY - rect.top - offsetY) / scale,
    };
  }, [scale, offsetX, offsetY]);

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    if (!canvasRef.current) return { x: canvasX, y: canvasY };
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: canvasX * scale + offsetX + rect.left,
      y: canvasY * scale + offsetY + rect.top,
    };
  }, [scale, offsetX, offsetY]);

  // Handle wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate new scale
      const delta = e.deltaY > 0 ? -CANVAS_CONSTANTS.ZOOM_STEP : CANVAS_CONSTANTS.ZOOM_STEP;
      const newScale = Math.max(
        CANVAS_CONSTANTS.MIN_SCALE,
        Math.min(CANVAS_CONSTANTS.MAX_SCALE, scale + delta)
      );
      
      // Adjust offset to zoom towards mouse position
      const scaleFactor = newScale / scale;
      const newOffsetX = mouseX - (mouseX - offsetX) * scaleFactor;
      const newOffsetY = mouseY - (mouseY - offsetY) * scaleFactor;
      
      setScaleState(newScale);
      setOffsetX(newOffsetX);
      setOffsetY(newOffsetY);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scale, offsetX, offsetY]);

  return {
    scale,
    offsetX,
    offsetY,
    canvasRef,
    setScale,
    setOffset,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    isPanning,
    startPan,
    handlePan,
    endPan,
    screenToCanvas,
    canvasToScreen,
  };
};

export default useWorkflowCanvas;
