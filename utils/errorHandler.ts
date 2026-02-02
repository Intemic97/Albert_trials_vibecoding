/**
 * Sistema centralizado de manejo de errores
 * 
 * Proporciona clases de error personalizadas y funciones
 * para manejar errores de forma consistente en toda la aplicación
 */

import { logger } from './logger';

/**
 * Clase base para errores de la aplicación
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public userMessage?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    
    // Mantener el stack trace correcto
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Error específico para errores de API
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public endpoint?: string,
    public response?: unknown
  ) {
    super(
      message,
      'API_ERROR',
      statusCode,
      getApiErrorMessage(statusCode),
      { endpoint, response }
    );
    this.name = 'ApiError';
  }
}

/**
 * Error específico para errores de validación
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      'Los datos proporcionados no son válidos',
      { field, value }
    );
    this.name = 'ValidationError';
  }
}

/**
 * Error específico para errores de autenticación/autorización
 */
export class AuthError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(
      message,
      'AUTH_ERROR',
      401,
      'No tienes permisos para realizar esta acción'
    );
    this.name = 'AuthError';
  }
}

/**
 * Convierte un error desconocido a AppError
 */
export const handleError = (error: unknown): AppError => {
  // Si ya es un AppError, retornarlo tal cual
  if (error instanceof AppError) {
    return error;
  }
  
  // Si es un Error estándar
  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
    );
  }
  
  // Si es un string
  if (typeof error === 'string') {
    return new AppError(
      error,
      'UNKNOWN_ERROR',
      500,
      'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
    );
  }
  
  // Error desconocido
  return new AppError(
    'Error desconocido',
    'UNKNOWN_ERROR',
    500,
    'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.',
    { originalError: error }
  );
};

/**
 * Maneja errores de API y los convierte a ApiError
 */
export const handleApiError = async (
  response: Response,
  endpoint?: string
): Promise<ApiError> => {
  let errorMessage = `API request failed with status ${response.status}`;
  let errorData: unknown;
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      errorData = await response.json();
      if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = String(errorData.message);
      }
    } else {
      errorMessage = await response.text();
    }
  } catch (parseError) {
    logger.warn('Failed to parse error response', { parseError });
  }
  
  return new ApiError(errorMessage, response.status, endpoint, errorData);
};

/**
 * Obtiene un mensaje de error amigable para el usuario según el código de estado HTTP
 */
function getApiErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Los datos proporcionados no son válidos',
    401: 'No estás autenticado. Por favor, inicia sesión',
    403: 'No tienes permisos para realizar esta acción',
    404: 'El recurso solicitado no existe',
    409: 'Ya existe un recurso con estos datos',
    422: 'Los datos proporcionados no son válidos',
    429: 'Demasiadas solicitudes. Por favor, espera un momento',
    500: 'Error del servidor. Por favor, inténtalo más tarde',
    502: 'Servicio temporalmente no disponible',
    503: 'Servicio temporalmente no disponible',
  };
  
  return messages[statusCode] || 'Ha ocurrido un error. Por favor, inténtalo de nuevo';
}

/**
 * Wrapper para funciones async que maneja errores automáticamente
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = handleError(error);
      logger.error(
        context ? `Error in ${context}` : 'Error in async function',
        appError,
        { args }
      );
      throw appError;
    }
  }) as T;
};
