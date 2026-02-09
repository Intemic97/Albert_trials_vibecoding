/**
 * Shared Hooks Library
 * 
 * Hooks reutilizables para toda la aplicación.
 * 
 * @example
 * import { useDebounce, useLocalStorage, useNotifications } from '@/hooks';
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Storage - Persistencia de datos
export { 
  useLocalStorage, 
  useSessionStorage,
} from './useLocalStorage';

// Notifications - Sistema de notificaciones
export { 
  useNotifications, 
  getNotificationStyles,
  type Notification,
  type NotificationType,
} from './useNotifications';

// ============================================================================
// PERFORMANCE & OPTIMIZATION
// ============================================================================

// Debounce & Throttle
export { 
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
} from './useDebounce';

// Async Operations
export { 
  useAsync,
} from './useDebounce';

// Advanced Optimization Hooks
export {
  useDebouncedState,
  useThrottledCallback as useThrottledCallbackOptimized,
  useMemoizedComputation,
  useLazyInit,
  useStableCallback,
  useIntersectionObserver,
  useWindowSize,
  useRenderCount,
  useBatchedState,
} from './useOptimizedState';

// ============================================================================
// UTILITIES
// ============================================================================

// Previous Value
export { 
  usePrevious,
} from './useDebounce';

// Click Outside Detection
export { 
  useClickOutside,
} from './useDebounce';

// Keyboard Shortcuts
export { 
  useKeyboardShortcut,
} from './useDebounce';

// ============================================================================
// COLLABORATION
// ============================================================================

// Real-time Cursors
export { useCollaborativeCursors } from './useCollaborativeCursors';

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

// Execution Progress Tracking
export { 
  useExecutionProgress,
  type ExecutionProgress,
} from './useExecutionProgress';

// Workflow Execution (API-based, replaces frontend execution)
export {
  useWorkflowExecution,
  type ExecutionState,
  type NodeStatus,
} from './useWorkflowExecution';
