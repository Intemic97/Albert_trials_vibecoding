/**
 * Constantes centralizadas de la aplicación
 * 
 * Todas las constantes de configuración deben estar aquí
 * para facilitar el mantenimiento y evitar valores mágicos
 */

/**
 * Configuración de workflows
 */
export const WORKFLOW_CONFIG = {
  MAX_NODES: 100,
  MAX_CONNECTIONS_PER_NODE: 10,
  EXECUTION_TIMEOUT: 300000, // 5 minutos en ms
  POLLING_INTERVAL: 5000, // 5 segundos en ms
  MAX_PREVIEW_ROWS: 500,
  CANVAS_GRID_SIZE: 20,
  NODE_MIN_WIDTH: 180,
  NODE_MIN_HEIGHT: 60,
} as const;

/**
 * Configuración de la base de datos
 */
export const DATABASE_CONFIG = {
  MAX_RECORDS_PER_PAGE: 50,
  MAX_SEARCH_RESULTS: 100,
  CACHE_TTL: 300000, // 5 minutos
} as const;

/**
 * Configuración de la UI
 */
export const UI_CONFIG = {
  SIDEBAR_WIDTH: 256,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  MODAL_MAX_WIDTH: '95vw',
  MODAL_MAX_HEIGHT: '90vh',
  TOAST_DURATION: 5000, // 5 segundos
  DEBOUNCE_DELAY: 300, // ms para búsquedas
} as const;

/**
 * Endpoints de la API
 */
export const API_ENDPOINTS = {
  // Workflows
  WORKFLOWS: '/api/workflows',
  WORKFLOW: (id: string) => `/api/workflows/${id}`,
  EXECUTE_WORKFLOW: (id: string) => `/api/workflow/${id}/execute`,
  EXECUTION: (id: string) => `/api/workflow/execution/${id}`,
  EXECUTION_LOGS: (id: string) => `/api/workflow/execution/${id}/logs`,
  
  // Entities
  ENTITIES: '/api/entities',
  ENTITY: (id: string) => `/api/entities/${id}`,
  ENTITY_RECORDS: (id: string) => `/api/entities/${id}/records`,
  
  // Knowledge Base
  KNOWLEDGE_DOCUMENTS: '/api/knowledge/documents',
  KNOWLEDGE_STANDARDS: '/api/knowledge/standards',
  
  // Reports
  REPORTS: '/api/reports',
  REPORT_TEMPLATES: '/api/report-templates',
  
  // Auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REGISTER: '/api/auth/register',
  
  // Prefect
  PREFECT_HEALTH: '/api/prefect/health',
} as const;

/**
 * Tipos de nodos de workflow
 */
export const WORKFLOW_NODE_TYPES = {
  TRIGGER: 'trigger',
  ACTION: 'action',
  CONDITION: 'condition',
  FETCH_DATA: 'fetchData',
  ADD_FIELD: 'addField',
  SAVE_RECORDS: 'saveRecords',
  LLM: 'llm',
  PYTHON: 'python',
  MANUAL_INPUT: 'manualInput',
  OUTPUT: 'output',
  COMMENT: 'comment',
  HTTP: 'http',
  JOIN: 'join',
  SPLIT_COLUMNS: 'splitColumns',
  AGENT: 'agent',
} as const;

/**
 * Estados de ejecución de nodos
 */
export const NODE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  WAITING: 'waiting',
} as const;

/**
 * Estados de ejecución de workflows
 */
export const WORKFLOW_EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

/**
 * Mensajes de error comunes
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet e inténtalo de nuevo',
  UNAUTHORIZED: 'No estás autenticado. Por favor, inicia sesión',
  FORBIDDEN: 'No tienes permisos para realizar esta acción',
  NOT_FOUND: 'El recurso solicitado no existe',
  VALIDATION_ERROR: 'Los datos proporcionados no son válidos',
  SERVER_ERROR: 'Error del servidor. Por favor, inténtalo más tarde',
  TIMEOUT: 'La operación tardó demasiado. Por favor, inténtalo de nuevo',
  UNKNOWN: 'Ha ocurrido un error inesperado',
} as const;

/**
 * Mensajes de éxito comunes
 */
export const SUCCESS_MESSAGES = {
  SAVED: 'Guardado correctamente',
  DELETED: 'Eliminado correctamente',
  CREATED: 'Creado correctamente',
  UPDATED: 'Actualizado correctamente',
  COPIED: 'Copiado al portapapeles',
} as const;
