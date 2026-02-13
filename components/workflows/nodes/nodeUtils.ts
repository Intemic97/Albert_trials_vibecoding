import { WorkflowNode, Connection, NodeType } from '../types';
import { NODE_DEFINITIONS, getNodeDefinition } from './nodeDefinitions';

/**
 * Validate node configuration
 */
export const validateNodeConfig = (node: WorkflowNode): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const definition = getNodeDefinition(node.type);
  
  if (!definition) {
    return { valid: false, errors: ['Unknown node type'] };
  }

  // Check required config fields
  const requiredFields = definition.validationRules?.requiredConfig || [];
  for (const field of requiredFields) {
    if (!node.config?.[field as keyof typeof node.config]) {
      errors.push(`Missing required configuration: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Check if a connection is valid
 */
export const isValidConnection = (
  fromNode: WorkflowNode,
  toNode: WorkflowNode,
  existingConnections: Connection[],
  outputType?: Connection['outputType'],
  inputPort?: Connection['inputPort']
): { valid: boolean; reason?: string } => {
  // Cannot connect to self
  if (fromNode.id === toNode.id) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }

  // Check for existing connection
  const existingConnection = existingConnections.find(
    conn => conn.fromNodeId === fromNode.id && 
            conn.toNodeId === toNode.id &&
            conn.outputType === outputType &&
            conn.inputPort === inputPort
  );
  if (existingConnection) {
    return { valid: false, reason: 'Connection already exists' };
  }

  // Check max connections
  const fromDef = getNodeDefinition(fromNode.type);
  const toDef = getNodeDefinition(toNode.type);

  // Check output limit
  if (fromDef.validationRules?.maxConnections?.output) {
    const currentOutputs = existingConnections.filter(c => c.fromNodeId === fromNode.id).length;
    if (currentOutputs >= fromDef.validationRules.maxConnections.output) {
      return { valid: false, reason: 'Maximum output connections reached' };
    }
  }

  // Check input limit (default 1 for non-join nodes)
  const maxInputs = toDef.hasMultipleInputs ? 2 : (toDef.validationRules?.maxConnections?.input ?? 1);
  const currentInputs = existingConnections.filter(c => c.toNodeId === toNode.id).length;
  if (currentInputs >= maxInputs) {
    return { valid: false, reason: 'Maximum input connections reached' };
  }

  // Special case: join nodes require specific input ports
  if (toNode.type === 'join' && !inputPort) {
    const usedPorts = existingConnections
      .filter(c => c.toNodeId === toNode.id)
      .map(c => c.inputPort);
    
    if (usedPorts.includes('A') && usedPorts.includes('B')) {
      return { valid: false, reason: 'Both input ports are already connected' };
    }
  }

  return { valid: true };
};

/**
 * Get display name for a node (custom name or default label)
 */
export const getNodeDisplayName = (node: WorkflowNode): string => {
  return node.config?.customName || node.label;
};

/**
 * Get node summary text for display
 */
export const getNodeSummary = (node: WorkflowNode): string | null => {
  switch (node.type) {
    case 'fetchData':
      return node.config?.entityName || null;
    case 'condition':
      if (node.config?.conditionField) {
        return `${node.config.conditionField} ${node.config.conditionOperator} ${node.config.conditionValue}`;
      }
      return null;
    case 'llm':
      return node.config?.llmPrompt?.slice(0, 50) || null;
    case 'python':
      return node.config?.pythonCode ? 'Custom code' : null;
    case 'http':
      return node.config?.httpUrl || null;
    case 'excelInput':
      return node.config?.fileName || null;
    case 'pdfInput':
      return node.config?.fileName || null;
    case 'comment':
      return node.config?.commentText?.slice(0, 50) || null;
    case 'sendEmail':
      return node.config?.emailTo || null;
    case 'sendSMS':
      return node.config?.smsTo || null;
    case 'sendWhatsApp':
      return node.config?.whatsappTo || null;
    case 'conveyor':
      return node.config?.conveyorSpeed && node.config?.conveyorLength 
        ? `${node.config.conveyorLength}m @ ${node.config.conveyorSpeed} m/s` 
        : null;
    case 'franmit':
      return node.config?.franmitReactorVolume ? `V=${node.config.franmitReactorVolume} m³` : null;
    default:
      return null;
  }
};

/**
 * Check if node is a trigger type
 */
export const isTriggerNode = (type: NodeType): boolean => {
  return NODE_DEFINITIONS[type]?.category === 'triggers';
};

/**
 * Check if node is an output/terminal type
 */
export const isTerminalNode = (type: NodeType): boolean => {
  return type === 'output' || type === 'comment';
};

/**
 * Get nodes that can be connected from a given node
 */
export const getConnectableNodes = (
  fromNode: WorkflowNode,
  allNodes: WorkflowNode[],
  existingConnections: Connection[]
): WorkflowNode[] => {
  return allNodes.filter(toNode => {
    if (toNode.id === fromNode.id) return false;
    const { valid } = isValidConnection(fromNode, toNode, existingConnections);
    return valid;
  });
};

/**
 * Calculate node execution order (topological sort)
 */
export const getExecutionOrder = (
  nodes: WorkflowNode[],
  connections: Connection[]
): WorkflowNode[] => {
  const visited = new Set<string>();
  const order: WorkflowNode[] = [];
  
  // Find root nodes (triggers or no incoming connections)
  const rootNodes = nodes.filter(node => 
    isTriggerNode(node.type) || 
    !connections.some(conn => conn.toNodeId === node.id)
  );

  const visit = (nodeId: string, path: Set<string> = new Set()) => {
    if (visited.has(nodeId)) return;
    if (path.has(nodeId)) {
      console.warn('Circular dependency detected');
      return;
    }
    
    path.add(nodeId);
    
    // Visit dependencies first
    const dependencies = connections
      .filter(conn => conn.toNodeId === nodeId)
      .map(conn => conn.fromNodeId);
    
    dependencies.forEach(depId => visit(depId, new Set(path)));
    
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) order.push(node);
  };

  // Start from roots
  rootNodes.forEach(node => visit(node.id));
  
  // Visit any remaining unvisited nodes
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  });

  return order;
};

/**
 * Clone a node with new ID
 */
export const cloneNode = (
  node: WorkflowNode,
  newId: string,
  offset: { x: number; y: number } = { x: 50, y: 50 }
): WorkflowNode => {
  return {
    ...node,
    id: newId,
    x: node.x + offset.x,
    y: node.y + offset.y,
    status: 'idle',
    executionResult: undefined,
    data: undefined,
    inputData: undefined,
    outputData: undefined,
    conditionResult: undefined,
  };
};
