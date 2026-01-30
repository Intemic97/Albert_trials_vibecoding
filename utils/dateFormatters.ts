/**
 * Utilidades para formateo de fechas
 * 
 * Centraliza todas las funciones de formato de fecha para evitar duplicación
 */

/**
 * Formatea una fecha en formato relativo ("hace X minutos", "hace X horas", etc.)
 * 
 * @param dateString - Fecha en formato string ISO o Date
 * @returns String con formato relativo
 * 
 * @example
 * formatTimeAgo('2024-01-30T10:00:00Z'); // "5m ago"
 * formatTimeAgo(null); // "Never"
 */
export const formatTimeAgo = (dateString: string | Date | null): string => {
  if (!dateString) return 'Never';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

/**
 * Formatea una fecha en formato completo (día/mes/año hora:minuto:segundo)
 * 
 * @param dateString - Fecha en formato string ISO o Date
 * @returns String con formato completo
 * 
 * @example
 * formatDateFull('2024-01-30T10:30:00Z'); // "30/01/2024, 10:30:00"
 */
export const formatDateFull = (dateString: string | Date | null): string => {
  if (!dateString) return '-';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Formatea una fecha en formato corto (día mes año)
 * 
 * @param dateString - Fecha en formato string ISO o Date
 * @returns String con formato corto
 * 
 * @example
 * formatDateShort('2024-01-30T10:30:00Z'); // "30 ene 2024"
 */
export const formatDateShort = (dateString: string | Date | null): string => {
  if (!dateString) return 'N/A';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Formatea una duración en milisegundos a un string legible
 * 
 * @param ms - Duración en milisegundos
 * @returns String con formato legible
 * 
 * @example
 * formatDuration(500); // "500ms"
 * formatDuration(5000); // "5.0s"
 * formatDuration(120000); // "2.0m"
 */
export const formatDuration = (ms?: number | null): string => {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/**
 * Formatea una fecha para mostrar en cards (día mes año)
 * 
 * @param dateString - Fecha en formato string ISO o Date
 * @returns String con formato de card
 * 
 * @example
 * formatCardDate('2024-01-30T10:30:00Z'); // "30 Jan 2024"
 */
export const formatCardDate = (dateString: string | Date | null): string => {
  if (!dateString) return 'Unknown';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};
