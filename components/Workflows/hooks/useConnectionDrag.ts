import { useState, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '../types';
import { CANVAS_CONSTANTS } from '../constants';

type OutputType = 'true' | 'false' | 'A' | 'B' | undefined;
type InputPort = 'A' | 'B' | undefined;

interface ConnectionDragState {
  isConnecting: boolean;
  fromNodeId: string | null;
  outputType: OutputType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseConnectionDragOptions {
  nodes: WorkflowNode[];
  connections: Connection[];
  scale: number;
  offsetX: number;
  offsetY: number;
  onConnectionCreate?: (connection: Omit<Connection, 'id'>) => void;
  onConnectionStart?: (nodeId: string, outputType: OutputType) => void;
  onConnectionEnd?: () => void;
}

interface UseConnectionDragReturn {
  // State
  connectionDrag: ConnectionDragState | null;
  isConnecting: boolean;
  
  // Handlers
  startConnection: (e: React.MouseEvent, nodeId: string, outputType?: OutputType) => void;
  updateConnection: (e: React.MouseEvent, containerRect: DOMRect) => void;
  endConnection: (targetNodeId?: string, inputPort?: InputPort) => void;
  cancelConnection: () => void;
  
  // Connector position helpers
  getOutputConnectorPosition: (node: WorkflowNode, outputType?: OutputType) => { x: number; y: number };
  getInputConnectorPosition: (node: WorkflowNode, inputPort?: InputPort) => { x: number; y: number };
  
  // Check if can connect
  canConnect: (fromNodeId: string, toNodeId: string) => boolean;
}

/**
 * Hook for managing connection drag interactions
 */
export const useConnectionDrag = (options: UseConnectionDragOptions): UseConnectionDragReturn => {
  const {
    nodes,
    connections,
    scale,
    offsetX,
    offsetY,
    onConnectionCreate,
    onConnectionStart,
    onConnectionEnd,
  } = options;

  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const { NODE_HALF_WIDTH, CONNECTOR_RADIUS } = CANVAS_CONSTANTS;

  // Get output connector position for a node
  const getOutputConnectorPosition = useCallback((
    node: WorkflowNode,
    outputType?: OutputType
  ): { x: number; y: number } => {
    const x = node.x + NODE_HALF_WIDTH + CONNECTOR_RADIUS;
    let y = node.y;
    
    // Adjust Y for condition/splitColumns nodes
    if (node.type === 'condition' || node.type === 'splitColumns') {
      if (outputType === 'true' || outputType === 'A') {
        y = node.y - 37;
      } else if (outputType === 'false' || outputType === 'B') {
        y = node.y + 37;
      }
    }
    
    return { x, y };
  }, [NODE_HALF_WIDTH, CONNECTOR_RADIUS]);

  // Get input connector position for a node
  const getInputConnectorPosition = useCallback((
    node: WorkflowNode,
    inputPort?: InputPort
  ): { x: number; y: number } => {
    const x = node.x - NODE_HALF_WIDTH - CONNECTOR_RADIUS;
    let y = node.y;
    
    // Adjust Y for join nodes
    if (node.type === 'join') {
      if (inputPort === 'A') {
        y = node.y - 5;
      } else if (inputPort === 'B') {
        y = node.y + 25;
      }
    }
    
    return { x, y };
  }, [NODE_HALF_WIDTH, CONNECTOR_RADIUS]);

  // Start a new connection
  const startConnection = useCallback((
    e: React.MouseEvent,
    nodeId: string,
    outputType?: OutputType
  ) => {
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const pos = getOutputConnectorPosition(node, outputType);
    
    setConnectionDrag({
      isConnecting: true,
      fromNodeId: nodeId,
      outputType,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
    
    onConnectionStart?.(nodeId, outputType);
  }, [nodes, getOutputConnectorPosition, onConnectionStart]);

  // Update connection position during drag
  const updateConnection = useCallback((e: React.MouseEvent, containerRect: DOMRect) => {
    if (!connectionDrag) return;
    
    const x = (e.clientX - containerRect.left - offsetX) / scale;
    const y = (e.clientY - containerRect.top - offsetY) / scale;
    
    setConnectionDrag(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  }, [connectionDrag, scale, offsetX, offsetY]);

  // Check if two nodes can be connected
  const canConnect = useCallback((fromNodeId: string, toNodeId: string): boolean => {
    // Can't connect to self
    if (fromNodeId === toNodeId) return false;
    
    const fromNode = nodes.find(n => n.id === fromNodeId);
    const toNode = nodes.find(n => n.id === toNodeId);
    
    if (!fromNode || !toNode) return false;
    
    // Can't connect to trigger nodes
    if (toNode.type === 'trigger' || toNode.type === 'webhook') return false;
    
    // Can't connect from output nodes
    if (fromNode.type === 'output') return false;
    
    // Check for existing connection (for non-join nodes)
    if (toNode.type !== 'join') {
      const hasExistingInput = connections.some(c => c.toNodeId === toNodeId);
      if (hasExistingInput) return false;
    }
    
    // Check for cycles (simple check - not exhaustive)
    const wouldCreateCycle = connections.some(
      c => c.fromNodeId === toNodeId && c.toNodeId === fromNodeId
    );
    if (wouldCreateCycle) return false;
    
    return true;
  }, [nodes, connections]);

  // End connection (create if valid target)
  const endConnection = useCallback((targetNodeId?: string, inputPort?: InputPort) => {
    if (!connectionDrag) return;
    
    if (targetNodeId && canConnect(connectionDrag.fromNodeId!, targetNodeId)) {
      const toNode = nodes.find(n => n.id === targetNodeId);
      
      // Determine output type for condition/splitColumns nodes
      let outputType = connectionDrag.outputType;
      if (!outputType) {
        const fromNode = nodes.find(n => n.id === connectionDrag.fromNodeId);
        if (fromNode?.type === 'condition') {
          // Default to 'true' if not specified
          outputType = 'true';
        } else if (fromNode?.type === 'splitColumns') {
          outputType = 'A';
        }
      }
      
      // Determine input port for join nodes
      let finalInputPort = inputPort;
      if (!finalInputPort && toNode?.type === 'join') {
        // Check which port is available
        const hasA = connections.some(
          c => c.toNodeId === targetNodeId && c.inputPort === 'A'
        );
        finalInputPort = hasA ? 'B' : 'A';
      }
      
      onConnectionCreate?.({
        fromNodeId: connectionDrag.fromNodeId!,
        toNodeId: targetNodeId,
        outputType,
        inputPort: finalInputPort,
      });
    }
    
    setConnectionDrag(null);
    onConnectionEnd?.();
  }, [connectionDrag, nodes, connections, canConnect, onConnectionCreate, onConnectionEnd]);

  // Cancel connection without creating
  const cancelConnection = useCallback(() => {
    setConnectionDrag(null);
    onConnectionEnd?.();
  }, [onConnectionEnd]);

  return {
    connectionDrag,
    isConnecting: connectionDrag !== null,
    startConnection,
    updateConnection,
    endConnection,
    cancelConnection,
    getOutputConnectorPosition,
    getInputConnectorPosition,
    canConnect,
  };
};

export default useConnectionDrag;
