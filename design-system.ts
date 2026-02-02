/**
 * Design System - LEGACY FILE
 * 
 * @deprecated Este archivo está obsoleto. Usar theme.ts en su lugar.
 * 
 * El sistema de diseño actual utiliza CSS variables definidas en theme.ts
 * que soportan modo claro/oscuro automáticamente.
 * 
 * En lugar de usar estas constantes Tailwind, usa las variables CSS:
 * - bg-[var(--bg-primary)] en lugar de BACKGROUND_CLASS
 * - text-[var(--text-primary)] en lugar de TEXT_PRIMARY
 * - etc.
 * 
 * @see theme.ts - Sistema de temas actual con soporte para dark mode
 * @see context/ThemeContext.tsx - Contexto de tema
 */

// =============================================================================
// COLORES
// =============================================================================

// Color de fondo principal - Gris claro neutro
export const BACKGROUND_COLOR = "#F8F8F8";
export const BACKGROUND_CLASS = "bg-[#F8F8F8]";

// Colores de texto
export const TEXT_PRIMARY = "text-slate-700";      // Texto principal (gris oscuro, NO negro)
export const TEXT_SECONDARY = "text-slate-500";    // Texto secundario
export const TEXT_MUTED = "text-slate-400";        // Texto deshabilitado/sutil

// Sidebar (mantiene su propio fondo)
export const SIDEBAR_BG = "bg-slate-50";

// =============================================================================
// TIPOGRAFÍA
// =============================================================================

export const FONT_FAMILY_PRIMARY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const FONT_FAMILY_SYSTEM = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// =============================================================================
// BOTONES
// =============================================================================

// Botón Primario Base
const BUTTON_PRIMARY_BASE = "flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md";

export const BUTTON_PRIMARY_SM = `${BUTTON_PRIMARY_BASE} px-3 py-1.5 text-xs`;
export const BUTTON_PRIMARY_MD = `${BUTTON_PRIMARY_BASE} px-3 py-2 text-sm`;
export const BUTTON_PRIMARY_LG = `${BUTTON_PRIMARY_BASE} px-4 py-2.5 text-base`;
export const BUTTON_PRIMARY = BUTTON_PRIMARY_SM;

// Botón Secundario Base
const BUTTON_SECONDARY_BASE = "flex items-center bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors";

export const BUTTON_SECONDARY_SM = `${BUTTON_SECONDARY_BASE} px-3 py-1.5 text-xs`;
export const BUTTON_SECONDARY_MD = `${BUTTON_SECONDARY_BASE} px-3 py-2 text-sm`;
export const BUTTON_SECONDARY = BUTTON_SECONDARY_SM;

// =============================================================================
// INPUTS
// =============================================================================

const INPUT_SEARCH_BASE = "bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300";

export const INPUT_SEARCH = `pl-8 pr-3 py-1.5 ${INPUT_SEARCH_BASE} w-60`;
export const INPUT_SEARCH_FLEX = `pl-8 pr-3 py-1.5 ${INPUT_SEARCH_BASE}`;

// =============================================================================
// LAYOUT
// =============================================================================

export const HEADER_HEIGHT = "h-16";
export const SIDEBAR_WIDTH = "w-60";

// =============================================================================
// UTILIDADES
// =============================================================================

/**
 * Combina clases CSS filtrando valores falsy
 */
export const combineClasses = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};
