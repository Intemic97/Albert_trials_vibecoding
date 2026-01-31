/**
 * Workflow Editor Module
 * 
 * Componentes modulares para el editor de workflows.
 * Incluye tipos, constantes, hooks y componentes UI.
 * 
 * @example
 * import { 
 *   WorkflowNode, Connection,
 *   useWorkflowNodes, useWorkflowCanvas,
 *   NodePalette, ConnectionLine
 * } from '@/components/workflows';
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  NodeType,
  NodeStatus,
  NodeConfig,
  WorkflowNode,
  Connection,
  DraggableItem,
  WorkflowData,
  WorkflowExecution,
  CanvasState,
  DragState,
  ConnectionDragState,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  DRAGGABLE_ITEMS,
  NODE_CATEGORIES,
  NODE_ICONS,
  CANVAS_CONSTANTS,
  NODE_STATUS_COLORS,
} from './constants';

// ============================================================================
// TEMPLATES
// ============================================================================

export {
  WORKFLOW_TEMPLATES,
  getTemplatesByCategory,
  getTemplateCategories,
  type WorkflowTemplate,
} from './templates';

// ============================================================================
// HOOKS
// ============================================================================

export {
  // Canvas management
  useWorkflowCanvas,
  // Node & connection management
  useWorkflowNodes,
  // Execution control
  useWorkflowExecution,
  // Autosave
  useWorkflowAutosave,
  // Undo/Redo history
  useWorkflowHistory,
  // Node configuration state
  useNodeConfig,
  type NodeConfigState,
  type UseNodeConfigReturn,
} from './hooks';

// ============================================================================
// CONFIGURATION MODALS
// ============================================================================

export {
  // Data routing
  JoinConfigModal,
  ConditionConfigModal,
  // Input/API
  HttpConfigModal,
  // AI/Code
  LLMConfigModal,
  PythonConfigModal,
} from './modals';

// ============================================================================
// NODE UTILITIES
// ============================================================================

export {
  // Definitions
  NODE_DEFINITIONS,
  getNodeDefinition,
  getNodesByCategory,
  hasMultipleOutputs,
  hasMultipleInputs,
  getStatusStyles,
  type NodeDefinition,
  type NodeCategory,
  // Utilities
  validateNodeConfig,
  isValidConnection,
  getNodeDisplayName,
  getNodeSummary,
  isTriggerNode,
  isTerminalNode,
  getConnectableNodes,
  getExecutionOrder,
  cloneNode,
} from './nodes';

// ============================================================================
// UI COMPONENTS
// ============================================================================

// Node Palette - Panel de nodos arrastrables
export { NodePalette } from './NodePalette';

// Workflow Node - Componente de nodo individual
export { 
  WorkflowNode as WorkflowNodeComponent, 
  getNodeIcon, 
  getNodeIconColor, 
  getNodeStatusBorder 
} from './WorkflowNode';

// Connection Line - Líneas de conexión entre nodos
export { ConnectionLine, DraggingConnection } from './ConnectionLine';

// Canvas Controls - Controles de zoom y navegación
export { CanvasControls } from './CanvasControls';

// Workflow Toolbar - Barra de herramientas superior
export { WorkflowToolbar } from './WorkflowToolbar';

// Data Preview Panel - Preview de datos en tiempo real
export { DataPreviewPanel, InlineDataPreview } from './DataPreviewPanel';
