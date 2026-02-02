/**
 * Node Definitions and Utilities
 * 
 * Definiciones de tipos de nodos y funciones utilitarias.
 */

// ============================================================================
// DEFINITIONS
// ============================================================================

export {
  NODE_DEFINITIONS,
  getNodeDefinition,
  getNodesByCategory,
  hasMultipleOutputs,
  hasMultipleInputs,
  getStatusStyles,
  type NodeDefinition,
  type NodeCategory,
} from './nodeDefinitions';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  validateNodeConfig,
  isValidConnection,
  getNodeDisplayName,
  getNodeSummary,
  isTriggerNode,
  isTerminalNode,
  getConnectableNodes,
  getExecutionOrder,
  cloneNode,
} from './nodeUtils';
