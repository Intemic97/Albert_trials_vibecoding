/**
 * Sistema de logging centralizado para la aplicación
 * 
 * Proporciona niveles de log consistentes y facilita el debugging
 * tanto en desarrollo como en producción.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  /**
   * Establece el nivel mínimo de logging
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log de debug - solo en desarrollo
   */
  debug(message: string, data?: LogContext): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  /**
   * Log de información general
   */
  info(message: string, data?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, data || '');
    }
  }

  /**
   * Log de advertencia
   */
  warn(message: string, data?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, data || '');
    }
    
    // En producción, enviar warnings críticos al servicio de logging
    if (!this.isDevelopment && this.shouldReportWarning(message)) {
      this.sendToLoggingService('warn', message, data);
    }
  }

  /**
   * Log de error
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    console.error(`[ERROR] ${message}`, {
      error: errorObj,
      message: errorObj.message,
      stack: errorObj.stack,
      ...context,
    });

    // En producción, enviar todos los errores al servicio de logging
    if (!this.isDevelopment) {
      this.sendToLoggingService('error', message, {
        error: {
          message: errorObj.message,
          stack: errorObj.stack,
          name: errorObj.name,
        },
        ...context,
      });
    }
  }

  /**
   * Determina si un warning debe ser reportado en producción
   */
  private shouldReportWarning(message: string): boolean {
    const criticalKeywords = ['timeout', 'failed', 'critical', 'security'];
    return criticalKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Envía logs a un servicio externo (Sentry, LogRocket, etc.)
   * Implementar según el servicio elegido
   */
  private sendToLoggingService(
    level: 'error' | 'warn',
    message: string,
    data?: LogContext
  ): void {
    // TODO: Implementar integración con servicio de logging
    // Ejemplo con Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureMessage(message, {
    //     level,
    //     extra: data,
    //   });
    // }
    
    // Por ahora, solo log en consola en producción
    if (import.meta.env.VITE_ENABLE_PRODUCTION_LOGS === 'true') {
      console[level](`[${level.toUpperCase()}] ${message}`, data);
    }
  }

  /**
   * Log de grupo (útil para debugging)
   */
  group(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.group(label);
    }
  }

  /**
   * Cierra un grupo de logs
   */
  groupEnd(): void {
    if (this.level <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * Log de tabla (útil para arrays de objetos)
   */
  table(data: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.table(data);
    }
  }
}

// Exportar instancia singleton
export const logger = new Logger();

// Helper para logging de performance
export const logPerformance = (label: string, fn: () => void): void => {
  if (logger.level <= LogLevel.DEBUG) {
    const start = performance.now();
    fn();
    const end = performance.now();
    logger.debug(`Performance: ${label}`, { duration: `${(end - start).toFixed(2)}ms` });
  } else {
    fn();
  }
};

// Helper para logging de API calls
export const logApiCall = (
  method: string,
  url: string,
  status?: number,
  error?: Error
): void => {
  if (error) {
    logger.error(`API ${method} ${url} failed`, error, { status });
  } else {
    logger.debug(`API ${method} ${url}`, { status });
  }
};
