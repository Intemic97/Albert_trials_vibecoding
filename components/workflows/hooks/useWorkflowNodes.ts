import { useState, useCallback } from 'react';
import { WorkflowNode, Connection, NodeType } from '../types';
import { CANVAS_CONSTANTS } from '../constants';
import { generateUUID } from '../../../utils/uuid';

interface UseWorkflowNodesReturn {
  nodes: WorkflowNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  addNode: (type: NodeType, label: string, x: number, y: number, config?: WorkflowNode['config']) => WorkflowNode;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  updateNodeConfig: (nodeId: string, config: Partial<WorkflowNode['config']>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string, offsetX?: number, offsetY?: number) => WorkflowNode | null;
  moveNode: (nodeId: string, x: number, y: number) => void;
  clearAllNodes: () => void;
  addConnection: (fromNodeId: string, toNodeId: string, outputType?: Connection['outputType'], inputPort?: Connection['inputPort']) => Connection;
  deleteConnection: (connectionId: string) => void;
  deleteConnectionsForNode: (nodeId: string) => void;
  getNodeById: (nodeId: string) => WorkflowNode | undefined;
  getConnectedNodes: (nodeId: string) => { incoming: WorkflowNode[]; outgoing: WorkflowNode[] };
  resetNodeStatuses: () => void;
  updateNodeStatus: (nodeId: string, status: WorkflowNode['status']) => void;
  setNodeExecutionResult: (nodeId: string, result: string, data?: any) => void;
}

interface UseWorkflowNodesOptions {
  initialNodes?: WorkflowNode[];
  initialConnections?: Connection[];
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  onConnectionsChange?: (connections: Connection[]) => void;
}

/**
 * Hook for managing workflow nodes and connections
 */
export const useWorkflowNodes = (options: UseWorkflowNodesOptions = {}): UseWorkflowNodesReturn => {
  const {
    initialNodes = [],
    initialConnections = [],
    onNodesChange,
    onConnectionsChange,
  } = options;

  const [nodes, setNodesInternal] = useState<WorkflowNode[]>(initialNodes);
  const [connections, setConnectionsInternal] = useState<Connection[]>(initialConnections);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Wrapper for setNodes that calls onChange
  const setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>> = useCallback((action) => {
    setNodesInternal(prev => {
      const newNodes = typeof action === 'function' ? action(prev) : action;
      onNodesChange?.(newNodes);
      return newNodes;
    });
  }, [onNodesChange]);

  // Wrapper for setConnections that calls onChange
  const setConnections: React.Dispatch<React.SetStateAction<Connection[]>> = useCallback((action) => {
    setConnectionsInternal(prev => {
      const newConnections = typeof action === 'function' ? action(prev) : action;
      onConnectionsChange?.(newConnections);
      return newConnections;
    });
  }, [onConnectionsChange]);

  // Add a new node
  const addNode = useCallback((
    type: NodeType,
    label: string,
    x: number,
    y: number,
    config?: WorkflowNode['config']
  ): WorkflowNode => {
    const newNode: WorkflowNode = {
      id: generateUUID(),
      type,
      label,
      x,
      y,
      status: 'idle',
      config,
    };
    setNodes(prev => [...prev, newNode]);
    return newNode;
  }, [setNodes]);

  // Update a node's properties
  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  }, [setNodes]);

  // Update a node's config
  const updateNodeConfig = useCallback((nodeId: string, config: Partial<WorkflowNode['config']>) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId
        ? { ...node, config: { ...node.config, ...config } }
        : node
    ));
  }, [setNodes]);

  // Delete a node and its connections
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(
      conn => conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
    ));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [setNodes, setConnections, selectedNodeId]);

  // Duplicate a node
  const duplicateNode = useCallback((
    nodeId: string,
    offsetX: number = 50,
    offsetY: number = 50
  ): WorkflowNode | null => {
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode) return null;

    const newNode: WorkflowNode = {
      ...sourceNode,
      id: generateUUID(),
      x: sourceNode.x + offsetX,
      y: sourceNode.y + offsetY,
      status: 'idle',
      executionResult: undefined,
      data: undefined,
      inputData: undefined,
      outputData: undefined,
    };
    setNodes(prev => [...prev, newNode]);
    return newNode;
  }, [nodes, setNodes]);

  // Move a node to new coordinates
  const moveNode = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, x, y } : node
    ));
  }, [setNodes]);

  // Clear all nodes and connections
  const clearAllNodes = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setSelectedNodeId(null);
  }, [setNodes, setConnections]);

  // Add a connection between nodes
  const addConnection = useCallback((
    fromNodeId: string,
    toNodeId: string,
    outputType?: Connection['outputType'],
    inputPort?: Connection['inputPort']
  ): Connection => {
    const newConnection: Connection = {
      id: generateUUID(),
      fromNodeId,
      toNodeId,
      outputType,
      inputPort,
    };
    setConnections(prev => [...prev, newConnection]);
    return newConnection;
  }, [setConnections]);

  // Delete a connection
  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  }, [setConnections]);

  // Delete all connections for a node
  const deleteConnectionsForNode = useCallback((nodeId: string) => {
    setConnections(prev => prev.filter(
      conn => conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
    ));
  }, [setConnections]);

  // Get a node by ID
  const getNodeById = useCallback((nodeId: string): WorkflowNode | undefined => {
    return nodes.find(n => n.id === nodeId);
  }, [nodes]);

  // Get connected nodes (incoming and outgoing)
  const getConnectedNodes = useCallback((nodeId: string) => {
    const incoming = connections
      .filter(conn => conn.toNodeId === nodeId)
      .map(conn => nodes.find(n => n.id === conn.fromNodeId))
      .filter((n): n is WorkflowNode => n !== undefined);

    const outgoing = connections
      .filter(conn => conn.fromNodeId === nodeId)
      .map(conn => nodes.find(n => n.id === conn.toNodeId))
      .filter((n): n is WorkflowNode => n !== undefined);

    return { incoming, outgoing };
  }, [nodes, connections]);

  // Reset all node statuses to idle
  const resetNodeStatuses = useCallback(() => {
    setNodes(prev => prev.map(node => ({
      ...node,
      status: 'idle',
      executionResult: undefined,
      data: undefined,
      inputData: undefined,
      outputData: undefined,
    })));
  }, [setNodes]);

  // Update a node's status
  const updateNodeStatus = useCallback((nodeId: string, status: WorkflowNode['status']) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, status } : node
    ));
  }, [setNodes]);

  // Set node execution result
  const setNodeExecutionResult = useCallback((nodeId: string, result: string, data?: any) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId
        ? { ...node, executionResult: result, data }
        : node
    ));
  }, [setNodes]);

  return {
    nodes,
    connections,
    selectedNodeId,
    setNodes,
    setConnections,
    setSelectedNodeId,
    addNode,
    updateNode,
    updateNodeConfig,
    deleteNode,
    duplicateNode,
    moveNode,
    clearAllNodes,
    addConnection,
    deleteConnection,
    deleteConnectionsForNode,
    getNodeById,
    getConnectedNodes,
    resetNodeStatuses,
    updateNodeStatus,
    setNodeExecutionResult,
  };
};
