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
  // Workflow state management
  useWorkflowState,
  type WorkflowData as WorkflowStateData,
  type WorkflowStateHook,
  // Canvas interaction
  useCanvasInteraction,
  type CanvasOffset,
  type DragConnectionState,
  type CanvasInteractionHook,
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
  // Workflow runner
  ExecutionHistoryModal,
  WorkflowRunnerModal,
  TemplatesGalleryModal,
} from './modals';

// ============================================================================
// VIEWS
// ============================================================================

export {
  WorkflowsListView,
  type WorkflowListItem,
} from './views';

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
// HELPER UTILITIES
// ============================================================================

export {
  getNodeColor,
  getNodeIconColor as getNodeIconColorUtil,
  getNodeIconBg,
  getNodeIcon as getNodeIconUtil,
  isNodeConfigured,
  getNodeTopTag,
  getCategoryColors,
  TEMPLATE_CATEGORY_COLORS,
  TEMPLATE_TEXT_COLORS,
} from './utils';

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

// ============================================================================
// MODULAR COMPONENTS (Zustand-based)
// ============================================================================

// Workflow Canvas - Canvas principal con stores de Zustand
export { WorkflowCanvas } from './WorkflowCanvas';
