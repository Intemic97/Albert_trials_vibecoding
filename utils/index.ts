/**
 * Utility Functions Library
 * 
 * Funciones utilitarias para toda la aplicación.
 * 
 * @example
 * import { formatNumber, formatDate, generateUUID } from '@/utils';
 */

// ============================================================================
// DATE & TIME FORMATTING
// ============================================================================

export {
  formatTimeAgo,
  formatDateFull,
  formatDateShort,
  formatDuration,
  formatCardDate,
} from './dateFormatters';

// ============================================================================
// NUMBER & STRING FORMATTING
// ============================================================================

export {
  // Numbers
  formatNumber,
  formatPercent,
  formatBytes,
  formatCurrency,
  // Strings
  truncateString,
  capitalize,
  toTitleCase,
  camelToReadable,
  snakeToReadable,
  getInitials,
  pluralize,
  formatList,
} from './formatters';

// ============================================================================
// API & NETWORK
// ============================================================================

export {
  parseResponse,
  apiFetch,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  type ApiErrorResponse,
} from './apiHelpers';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export { 
  AppError,
  ApiError,
  ValidationError,
  AuthError,
  handleError,
  handleApiError,
  withErrorHandling,
} from './errorHandler';

// ============================================================================
// LOGGING
// ============================================================================

export { logger } from './logger';

// ============================================================================
// UTILITIES
// ============================================================================

export { generateUUID } from './uuid';
