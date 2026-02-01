/**
 * WorkflowCanvas - Componente modular para el canvas de workflows
 * 
 * Este componente reemplaza la sección del canvas en Workflows.tsx
 * usando los nuevos stores de Zustand y hooks modulares.
 */

import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Play, Database, Sparkle as Sparkles, 
  MagnifyingGlassPlus as ZoomIn, 
  MagnifyingGlassMinus as ZoomOut,
  ArrowsOut as Maximize2,
  FlowArrow as Workflow
} from '@phosphor-icons/react';
import { useWorkflowStore } from '../../stores';
import { useCanvasPanZoom, useNodeDrag, useConnectionDrag } from './hooks';
import { WorkflowNode as WorkflowNodeComponent } from './WorkflowNode';
import { ConnectionLine, DraggingConnection } from './ConnectionLine';
import { CANVAS_CONSTANTS, DRAGGABLE_ITEMS } from './constants';
import type { WorkflowNode, Connection, DraggableItem } from './types';
import { generateUUID } from '../../utils/uuid';

interface WorkflowCanvasProps {
  // External data
  entities?: any[];
  
  // Collaboration
  remoteCursors?: Map<string, any>;
  onCursorMove?: (x: number, y: number) => void;
  
  // AI Assistant
  onOpenAIAssistant?: () => void;
  
  // Callbacks
  onNodeConfigure?: (nodeId: string) => void;
  onNodeRun?: (nodeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onNodeDuplicate?: (nodeId: string) => void;
  onViewNodeData?: (nodeId: string) => void;
  
  // Running state (from parent)
  isRunning?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  entities = [],
  remoteCursors,
  onCursorMove,
  onOpenAIAssistant,
  onNodeConfigure,
  onNodeRun,
  onNodeDelete,
  onNodeDuplicate,
  onViewNodeData,
  isRunning = false,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // =========================================================================
  // STORE: Workflow state
  // =========================================================================
  const nodes = useWorkflowStore(state => state.nodes);
  const connections = useWorkflowStore(state => state.connections);
  const selectedNodeId = useWorkflowStore(state => state.canvas.selectedNodeId);
  const hoveredConnectionId = useWorkflowStore(state => state.canvas.hoveredConnectionId);
  
  const addNode = useWorkflowStore(state => state.addNode);
  const updateNode = useWorkflowStore(state => state.updateNode);
  const deleteNode = useWorkflowStore(state => state.deleteNode);
  const moveNode = useWorkflowStore(state => state.moveNode);
  const addConnection = useWorkflowStore(state => state.addConnection);
  const deleteConnection = useWorkflowStore(state => state.deleteConnection);
  const selectNode = useWorkflowStore(state => state.selectNode);
  const setHoveredConnection = useWorkflowStore(state => state.setHoveredConnection);
  
  // =========================================================================
  // HOOK: Canvas pan & zoom
  // =========================================================================
  const {
    scale,
    offsetX,
    offsetY,
    isPanning,
    handleWheel,
    handleMouseDown: handlePanStart,
    handleMouseMove: handlePanMove,
    handleMouseUp: handlePanEnd,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    screenToCanvas,
    canvasToScreen,
  } = useCanvasPanZoom({
    minScale: 0.25,
    maxScale: 3,
  });
  
  // =========================================================================
  // HOOK: Node dragging
  // =========================================================================
  const {
    draggingNodeId,
    isDragging,
    handleNodeMouseDown,
    handleMouseMove: handleNodeDragMove,
    handleMouseUp: handleNodeDragEnd,
  } = useNodeDrag({
    nodes,
    scale,
    offsetX,
    offsetY,
    snapToGrid: false,
    onNodeMove: moveNode,
  });
  
  // =========================================================================
  // HOOK: Connection dragging
  // =========================================================================
  const {
    connectionDrag,
    isConnecting,
    startConnection,
    updateConnection,
    endConnection,
    cancelConnection,
    getOutputConnectorPosition,
    getInputConnectorPosition,
  } = useConnectionDrag({
    nodes,
    connections,
    scale,
    offsetX,
    offsetY,
    onConnectionCreate: (conn) => {
      addConnection({
        id: generateUUID(),
        ...conn,
      });
    },
  });
  
  // =========================================================================
  // HANDLERS: Canvas interactions
  // =========================================================================
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Deselect node when clicking on canvas background
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasBackground) {
      selectNode(null);
    }
    
    // Cancel any ongoing connection
    if (isConnecting && e.button === 0) {
      cancelConnection();
    }
    
    // Start panning
    handlePanStart(e);
  }, [selectNode, isConnecting, cancelConnection, handlePanStart]);
  
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Handle panning
    handlePanMove(e);
    
    // Handle node dragging
    if (isDragging) {
      handleNodeDragMove(e, rect);
    }
    
    // Handle connection dragging
    if (isConnecting) {
      updateConnection(e, rect);
    }
    
    // Send cursor position for collaboration
    if (onCursorMove) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect);
      onCursorMove(canvasPos.x, canvasPos.y);
    }
  }, [handlePanMove, isDragging, handleNodeDragMove, isConnecting, updateConnection, screenToCanvas, onCursorMove]);
  
  const handleCanvasMouseUp = useCallback(() => {
    handlePanEnd();
    handleNodeDragEnd();
    
    if (isConnecting) {
      cancelConnection();
    }
  }, [handlePanEnd, handleNodeDragEnd, isConnecting, cancelConnection]);
  
  // =========================================================================
  // HANDLERS: Drag & Drop from palette
  // =========================================================================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Drop event triggered');
    
    if (!canvasRef.current) {
      console.log('No canvas ref');
      return;
    }
    
    const itemType = e.dataTransfer.getData('application/workflow-node');
    console.log('Item type from dataTransfer:', itemType);
    
    if (!itemType) {
      console.log('No item type found');
      return;
    }
    
    const item = DRAGGABLE_ITEMS.find(i => i.type === itemType);
    console.log('Found item:', item);
    
    if (!item) {
      console.log('Item not found in DRAGGABLE_ITEMS');
      return;
    }
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect);
    console.log('Canvas position:', canvasPos);
    
    const newNode: WorkflowNode = {
      id: generateUUID(),
      type: item.type as any,
      label: item.label,
      x: canvasPos.x,
      y: canvasPos.y,
      status: 'idle',
    };
    
    console.log('Adding node:', newNode);
    addNode(newNode);
    selectNode(newNode.id);
  }, [screenToCanvas, addNode, selectNode]);
  
  // =========================================================================
  // HANDLERS: Quick actions (empty state)
  // =========================================================================
  const handleAddTrigger = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const canvasPos = screenToCanvas(centerX + rect.left, centerY + rect.top, rect);
    
    const newNode: WorkflowNode = {
      id: generateUUID(),
      type: 'trigger',
      label: 'Manual Trigger',
      x: canvasPos.x,
      y: canvasPos.y,
      status: 'idle',
    };
    
    addNode(newNode);
    selectNode(newNode.id);
  }, [screenToCanvas, addNode, selectNode]);
  
  const handleAddDataSource = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const canvasPos = screenToCanvas(centerX + rect.left, centerY + rect.top, rect);
    
    const newNode: WorkflowNode = {
      id: generateUUID(),
      type: 'fetchData',
      label: 'Fetch Data',
      x: canvasPos.x,
      y: canvasPos.y,
      status: 'idle',
    };
    
    addNode(newNode);
    selectNode(newNode.id);
  }, [screenToCanvas, addNode, selectNode]);
  
  // =========================================================================
  // KEYBOARD SHORTCUTS
  // =========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
      
      // Deselect with Escape
      if (e.key === 'Escape') {
        selectNode(null);
        if (isConnecting) cancelConnection();
      }
      
      // Zoom shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, deleteNode, selectNode, isConnecting, cancelConnection, zoomIn, zoomOut, resetView]);
  
  // =========================================================================
  // RENDER: Empty state
  // =========================================================================
  const renderEmptyState = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      <div className="text-center max-w-lg px-6">
        <div className="mb-8">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[#256A65]/10 to-[var(--bg-tertiary)] rounded-full blur-3xl" />
            <Workflow size={80} className="mx-auto relative text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-2xl font-normal text-[var(--text-primary)] mb-3">
            Start building your workflow
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
            Create powerful automation workflows by dragging components from the sidebar
          </p>
        </div>
        
        <div className="flex flex-col gap-4">
          {onOpenAIAssistant && (
            <button
              onClick={onOpenAIAssistant}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#256A65] text-white rounded-lg hover:bg-[#1e554f] transition-all font-medium shadow-md hover:shadow-lg"
            >
              <Sparkles size={20} />
              Create with AI Assistant
            </button>
          )}
          
          <div className="flex items-center gap-3 my-2">
            <span className="h-px flex-1 bg-[var(--bg-tertiary)]" />
            <span className="text-xs text-[var(--text-tertiary)] font-medium">OR</span>
            <span className="h-px flex-1 bg-[var(--bg-tertiary)]" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleAddTrigger}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all text-sm font-medium text-[var(--text-primary)]"
            >
              <Play size={16} className="text-[var(--text-secondary)]" />
              Add Trigger
            </button>
            <button
              onClick={handleAddDataSource}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all text-sm font-medium text-[var(--text-primary)]"
            >
              <Database size={16} className="text-[var(--text-secondary)]" />
              Add Data Source
            </button>
          </div>
          
          <p className="text-xs text-[var(--text-tertiary)] mt-4">
            Tip: Drag components from the sidebar to get started
          </p>
        </div>
      </div>
    </div>
  );
  
  // =========================================================================
  // RENDER: Zoom controls
  // =========================================================================
  const renderZoomControls = () => (
    <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-sm">
      <button
        onClick={zoomOut}
        className="p-2 hover:bg-[var(--bg-hover)] rounded-l-lg transition-colors"
        title="Zoom out (Ctrl+-)"
      >
        <ZoomOut size={16} className="text-[var(--text-secondary)]" />
      </button>
      
      <div className="px-3 py-1 text-sm font-medium text-[var(--text-secondary)] min-w-[60px] text-center border-x border-[var(--border-light)]">
        {Math.round(scale * 100)}%
      </div>
      
      <button
        onClick={zoomIn}
        className="p-2 hover:bg-[var(--bg-hover)] transition-colors"
        title="Zoom in (Ctrl++)"
      >
        <ZoomIn size={16} className="text-[var(--text-secondary)]" />
      </button>
      
      <button
        onClick={resetView}
        className="p-2 hover:bg-[var(--bg-hover)] rounded-r-lg transition-colors border-l border-[var(--border-light)]"
        title="Reset view (Ctrl+0)"
      >
        <Maximize2 size={16} className="text-[var(--text-secondary)]" />
      </button>
    </div>
  );
  
  // =========================================================================
  // RENDER: Remote cursors
  // =========================================================================
  const renderRemoteCursors = () => {
    if (!remoteCursors) return null;
    
    return Array.from(remoteCursors.values()).map((remote) => {
      if (!remote.cursor || remote.cursor.x < 0) return null;
      
      const screenPos = canvasToScreen(remote.cursor.x, remote.cursor.y);
      
      return (
        <div
          key={remote.id}
          className="absolute pointer-events-none z-[100] transition-all duration-75"
          style={{
            left: screenPos.x,
            top: screenPos.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3L19 12L12 13L9 20L5 3Z"
              fill={remote.user?.color || '#6366f1'}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
          <div
            className="absolute left-5 top-3 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: remote.user?.color || '#6366f1' }}
          >
            {remote.user?.name || 'User'}
          </div>
        </div>
      );
    });
  };
  
  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="flex-1 relative overflow-hidden bg-[var(--bg-secondary)]">
      {/* Canvas container */}
      <div
        ref={canvasRef}
        className="w-full h-full relative"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Dotted background */}
        <div
          data-canvas-background
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-tertiary) 1px, transparent 1px)',
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
            backgroundPosition: `${offsetX % (20 * scale)}px ${offsetY % (20 * scale)}px`,
            opacity: 0.3,
          }}
        />
        
        {/* Remote cursors */}
        {renderRemoteCursors()}
        
        {/* Transform container */}
        <div
          style={{
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            willChange: isPanning || draggingNodeId ? 'transform' : 'auto',
          }}
        >
          {/* Connections SVG */}
          <svg
            className="absolute pointer-events-none"
            style={{
              zIndex: 0,
              overflow: 'visible',
              left: 0,
              top: 0,
              width: '10000px',
              height: '10000px',
            }}
          >
            {/* Arrow markers */}
            <defs>
              <marker
                id="workflow-arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
              </marker>
            </defs>
            
            {/* Existing connections */}
            {connections.map((conn) => {
              const fromNode = nodes.find(n => n.id === conn.fromNodeId);
              const toNode = nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;
              
              return (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  fromNode={fromNode}
                  toNode={toNode}
                  isRunning={isRunning}
                  isHovered={hoveredConnectionId === conn.id}
                  onHover={setHoveredConnection}
                  onDelete={deleteConnection}
                />
              );
            })}
          </svg>
          
          {/* Dragging connection line */}
          {connectionDrag && (
            <svg
              className="absolute pointer-events-none"
              style={{
                zIndex: 20,
                overflow: 'visible',
                left: 0,
                top: 0,
                width: '10000px',
                height: '10000px',
              }}
            >
              <DraggingConnection
                startX={connectionDrag.startX}
                startY={connectionDrag.startY}
                endX={connectionDrag.currentX}
                endY={connectionDrag.currentY}
                outputType={connectionDrag.outputType}
              />
            </svg>
          )}
          
          {/* Nodes */}
          {nodes.map((node) => (
            <WorkflowNodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isDragging={draggingNodeId === node.id}
              scale={scale}
              isConfigured={!!(node.config && Object.keys(node.config).length > 0)}
              topTag={null}
              onNodeClick={() => selectNode(node.id)}
              onNodeDragStart={(e) => handleNodeMouseDown(e, node.id)}
              onRunNode={() => onNodeRun?.(node.id)}
              onViewData={() => onViewNodeData?.(node.id)}
              onDuplicate={() => onNodeDuplicate?.(node.id)}
              onDelete={() => onNodeDelete?.(node.id)}
              onConfigure={() => onNodeConfigure?.(node.id)}
              onOutputConnectorMouseDown={(e, _, outputType) => startConnection(e, node.id, outputType)}
              onInputConnectorMouseUp={(e, _, inputPort) => endConnection(node.id, inputPort)}
              isConnecting={isConnecting}
              connectingFromNodeId={connectionDrag?.fromNodeId || null}
            />
          ))}
        </div>
        
        {/* Empty state */}
        {nodes.length === 0 && renderEmptyState()}
      </div>
      
      {/* Zoom controls */}
      {renderZoomControls()}
    </div>
  );
};

export default WorkflowCanvas;
