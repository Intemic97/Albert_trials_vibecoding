import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { WorkflowNode, Connection } from '../components/Workflows/types';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowMeta {
  id: string | null;
  name: string;
  description?: string;
  tags: string[];
  isPublic: boolean;
  webhookEnabled: boolean;
  webhookToken?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredConnectionId: string | null;
}

export interface UIState {
  isSidebarCollapsed: boolean;
  searchQuery: string;
  selectedCategory: string;
  expandedFolders: Set<string>;
  viewMode: 'canvas' | 'list';
  showAIAssistant: boolean;
  showExecutionHistory: boolean;
  showTemplatesGallery: boolean;
  showRunnerModal: boolean;
}

export interface ExecutionState {
  isRunning: boolean;
  isSaving: boolean;
  currentExecutionId: string | null;
  nodeExecutionOrder: string[];
  executionResults: Record<string, any>;
}

export interface DragState {
  draggingNodeId: string | null;
  dragOffset: { x: number; y: number };
  isDraggingFromPalette: boolean;
  draggingItem: any | null;
}

export interface ConnectionDragState {
  isConnecting: boolean;
  fromNodeId: string | null;
  fromOutputType: 'true' | 'false' | 'A' | 'B' | null;
  currentPosition: { x: number; y: number } | null;
}

interface WorkflowState {
  // Core workflow data
  nodes: WorkflowNode[];
  connections: Connection[];
  workflow: WorkflowMeta;
  
  // Canvas state
  canvas: CanvasState;
  
  // UI state
  ui: UIState;
  
  // Execution state
  execution: ExecutionState;
  
  // Drag state
  drag: DragState;
  connectionDrag: ConnectionDragState;
  
  // History
  hasUnsavedChanges: boolean;
  
  // Actions - Nodes
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  
  // Actions - Connections
  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  setConnections: (connections: Connection[]) => void;
  
  // Actions - Workflow Meta
  setWorkflowMeta: (meta: Partial<WorkflowMeta>) => void;
  resetWorkflow: () => void;
  loadWorkflow: (id: string, name: string, nodes: WorkflowNode[], connections: Connection[], meta?: Partial<WorkflowMeta>) => void;
  
  // Actions - Canvas
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  selectNode: (id: string | null) => void;
  setHoveredNode: (id: string | null) => void;
  setHoveredConnection: (id: string | null) => void;
  resetCanvasView: () => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  toggleFolder: (folderId: string) => void;
  setViewMode: (mode: 'canvas' | 'list') => void;
  toggleAIAssistant: () => void;
  setShowExecutionHistory: (show: boolean) => void;
  setShowTemplatesGallery: (show: boolean) => void;
  setShowRunnerModal: (show: boolean) => void;
  
  // Actions - Execution
  startExecution: () => void;
  stopExecution: () => void;
  setNodeStatus: (nodeId: string, status: WorkflowNode['status'], result?: string) => void;
  setExecutionResult: (nodeId: string, result: any) => void;
  
  // Actions - Drag
  startNodeDrag: (nodeId: string, offsetX: number, offsetY: number) => void;
  endNodeDrag: () => void;
  startPaletteDrag: (item: any) => void;
  endPaletteDrag: () => void;
  
  // Actions - Connection Drag
  startConnectionDrag: (nodeId: string, outputType?: 'true' | 'false' | 'A' | 'B') => void;
  updateConnectionDrag: (x: number, y: number) => void;
  endConnectionDrag: () => void;
  
  // Actions - Unsaved changes
  markAsChanged: () => void;
  markAsSaved: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialWorkflowMeta: WorkflowMeta = {
  id: null,
  name: 'Untitled Workflow',
  tags: [],
  isPublic: false,
  webhookEnabled: false,
};

const initialCanvasState: CanvasState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  selectedNodeId: null,
  hoveredNodeId: null,
  hoveredConnectionId: null,
};

const initialUIState: UIState = {
  isSidebarCollapsed: false,
  searchQuery: '',
  selectedCategory: 'All',
  expandedFolders: new Set(['Recents']),
  viewMode: 'canvas',
  showAIAssistant: false,
  showExecutionHistory: false,
  showTemplatesGallery: false,
  showRunnerModal: false,
};

const initialExecutionState: ExecutionState = {
  isRunning: false,
  isSaving: false,
  currentExecutionId: null,
  nodeExecutionOrder: [],
  executionResults: {},
};

const initialDragState: DragState = {
  draggingNodeId: null,
  dragOffset: { x: 0, y: 0 },
  isDraggingFromPalette: false,
  draggingItem: null,
};

const initialConnectionDragState: ConnectionDragState = {
  isConnecting: false,
  fromNodeId: null,
  fromOutputType: null,
  currentPosition: null,
};

// ============================================================================
// Store
// ============================================================================

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set, get) => ({
      // Initial state
      nodes: [],
      connections: [],
      workflow: { ...initialWorkflowMeta },
      canvas: { ...initialCanvasState },
      ui: { ...initialUIState },
      execution: { ...initialExecutionState },
      drag: { ...initialDragState },
      connectionDrag: { ...initialConnectionDragState },
      hasUnsavedChanges: false,
      
      // ========== Node Actions ==========
      addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node],
        hasUnsavedChanges: true,
      })),
      
      updateNode: (id, updates) => set((state) => ({
        nodes: state.nodes.map((n) => 
          n.id === id ? { ...n, ...updates } : n
        ),
        hasUnsavedChanges: true,
      })),
      
      deleteNode: (id) => set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        connections: state.connections.filter(
          (c) => c.fromNodeId !== id && c.toNodeId !== id
        ),
        canvas: {
          ...state.canvas,
          selectedNodeId: state.canvas.selectedNodeId === id ? null : state.canvas.selectedNodeId,
        },
        hasUnsavedChanges: true,
      })),
      
      moveNode: (id, x, y) => set((state) => ({
        nodes: state.nodes.map((n) => 
          n.id === id ? { ...n, x, y } : n
        ),
        hasUnsavedChanges: true,
      })),
      
      setNodes: (nodes) => set({ nodes }),
      
      // ========== Connection Actions ==========
      addConnection: (connection) => set((state) => {
        // Check if connection already exists
        const exists = state.connections.some(
          (c) => c.fromNodeId === connection.fromNodeId && 
                 c.toNodeId === connection.toNodeId &&
                 c.outputType === connection.outputType
        );
        if (exists) return state;
        
        return {
          connections: [...state.connections, connection],
          hasUnsavedChanges: true,
        };
      }),
      
      deleteConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        hasUnsavedChanges: true,
      })),
      
      setConnections: (connections) => set({ connections }),
      
      // ========== Workflow Meta Actions ==========
      setWorkflowMeta: (meta) => set((state) => ({
        workflow: { ...state.workflow, ...meta },
        hasUnsavedChanges: true,
      })),
      
      resetWorkflow: () => set({
        nodes: [],
        connections: [],
        workflow: { ...initialWorkflowMeta },
        canvas: { ...initialCanvasState },
        execution: { ...initialExecutionState },
        hasUnsavedChanges: false,
      }),
      
      loadWorkflow: (id, name, nodes, connections, meta = {}) => set({
        nodes,
        connections,
        workflow: {
          ...initialWorkflowMeta,
          id,
          name,
          ...meta,
        },
        canvas: { ...initialCanvasState },
        execution: { ...initialExecutionState },
        hasUnsavedChanges: false,
      }),
      
      // ========== Canvas Actions ==========
      setScale: (scale) => set((state) => ({
        canvas: { ...state.canvas, scale: Math.max(0.25, Math.min(2, scale)) },
      })),
      
      setOffset: (x, y) => set((state) => ({
        canvas: { ...state.canvas, offsetX: x, offsetY: y },
      })),
      
      selectNode: (id) => set((state) => ({
        canvas: { ...state.canvas, selectedNodeId: id },
      })),
      
      setHoveredNode: (id) => set((state) => ({
        canvas: { ...state.canvas, hoveredNodeId: id },
      })),
      
      setHoveredConnection: (id) => set((state) => ({
        canvas: { ...state.canvas, hoveredConnectionId: id },
      })),
      
      resetCanvasView: () => set((state) => ({
        canvas: { ...state.canvas, scale: 1, offsetX: 0, offsetY: 0 },
      })),
      
      // ========== UI Actions ==========
      toggleSidebar: () => set((state) => ({
        ui: { ...state.ui, isSidebarCollapsed: !state.ui.isSidebarCollapsed },
      })),
      
      setSearchQuery: (query) => set((state) => ({
        ui: { ...state.ui, searchQuery: query },
      })),
      
      setSelectedCategory: (category) => set((state) => ({
        ui: { ...state.ui, selectedCategory: category },
      })),
      
      toggleFolder: (folderId) => set((state) => {
        const newFolders = new Set(state.ui.expandedFolders);
        if (newFolders.has(folderId)) {
          newFolders.delete(folderId);
        } else {
          newFolders.add(folderId);
        }
        return { ui: { ...state.ui, expandedFolders: newFolders } };
      }),
      
      setViewMode: (mode) => set((state) => ({
        ui: { ...state.ui, viewMode: mode },
      })),
      
      toggleAIAssistant: () => set((state) => ({
        ui: { ...state.ui, showAIAssistant: !state.ui.showAIAssistant },
      })),
      
      setShowExecutionHistory: (show) => set((state) => ({
        ui: { ...state.ui, showExecutionHistory: show },
      })),
      
      setShowTemplatesGallery: (show) => set((state) => ({
        ui: { ...state.ui, showTemplatesGallery: show },
      })),
      
      setShowRunnerModal: (show) => set((state) => ({
        ui: { ...state.ui, showRunnerModal: show },
      })),
      
      // ========== Execution Actions ==========
      startExecution: () => set((state) => ({
        execution: { ...state.execution, isRunning: true },
        nodes: state.nodes.map((n) => ({ ...n, status: 'idle' as const, executionResult: undefined })),
      })),
      
      stopExecution: () => set((state) => ({
        execution: { ...state.execution, isRunning: false },
      })),
      
      setNodeStatus: (nodeId, status, result) => set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, status, executionResult: result } : n
        ),
      })),
      
      setExecutionResult: (nodeId, result) => set((state) => ({
        execution: {
          ...state.execution,
          executionResults: { ...state.execution.executionResults, [nodeId]: result },
        },
      })),
      
      // ========== Drag Actions ==========
      startNodeDrag: (nodeId, offsetX, offsetY) => set({
        drag: {
          draggingNodeId: nodeId,
          dragOffset: { x: offsetX, y: offsetY },
          isDraggingFromPalette: false,
          draggingItem: null,
        },
      }),
      
      endNodeDrag: () => set({
        drag: { ...initialDragState },
      }),
      
      startPaletteDrag: (item) => set({
        drag: {
          draggingNodeId: null,
          dragOffset: { x: 0, y: 0 },
          isDraggingFromPalette: true,
          draggingItem: item,
        },
      }),
      
      endPaletteDrag: () => set({
        drag: { ...initialDragState },
      }),
      
      // ========== Connection Drag Actions ==========
      startConnectionDrag: (nodeId, outputType) => set({
        connectionDrag: {
          isConnecting: true,
          fromNodeId: nodeId,
          fromOutputType: outputType || null,
          currentPosition: null,
        },
      }),
      
      updateConnectionDrag: (x, y) => set((state) => ({
        connectionDrag: {
          ...state.connectionDrag,
          currentPosition: { x, y },
        },
      })),
      
      endConnectionDrag: () => set({
        connectionDrag: { ...initialConnectionDragState },
      }),
      
      // ========== Unsaved Changes ==========
      markAsChanged: () => set({ hasUnsavedChanges: true }),
      markAsSaved: () => set({ hasUnsavedChanges: false }),
    }),
    { name: 'workflow-store' }
  )
);

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

export const selectNodes = (state: WorkflowState) => state.nodes;
export const selectConnections = (state: WorkflowState) => state.connections;
export const selectWorkflowMeta = (state: WorkflowState) => state.workflow;
export const selectCanvas = (state: WorkflowState) => state.canvas;
export const selectUI = (state: WorkflowState) => state.ui;
export const selectExecution = (state: WorkflowState) => state.execution;
export const selectIsRunning = (state: WorkflowState) => state.execution.isRunning;
export const selectSelectedNode = (state: WorkflowState) => 
  state.nodes.find((n) => n.id === state.canvas.selectedNodeId) || null;
export const selectHasUnsavedChanges = (state: WorkflowState) => state.hasUnsavedChanges;

// ============================================================================
// Hooks for common patterns
// ============================================================================

export const useNodes = () => useWorkflowStore(selectNodes);
export const useConnections = () => useWorkflowStore(selectConnections);
export const useSelectedNode = () => useWorkflowStore(selectSelectedNode);
export const useIsRunning = () => useWorkflowStore(selectIsRunning);
