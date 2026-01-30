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
