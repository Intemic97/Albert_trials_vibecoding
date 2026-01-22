/**
 * Design System - Centralized design tokens and utilities
 * 
 * Este archivo contiene todas las clases de diseño centralizadas.
 * Cambiar valores aquí actualizará toda la aplicación.
 */

// Botón Primario Base (estilo del botón "Create Entity")
const BUTTON_PRIMARY_BASE = "flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md";

// Botón Primario - Tamaño pequeño (text-xs)
export const BUTTON_PRIMARY_SM = `${BUTTON_PRIMARY_BASE} px-3 py-1.5 text-xs`;

// Botón Primario - Tamaño mediano (text-sm)
export const BUTTON_PRIMARY_MD = `${BUTTON_PRIMARY_BASE} px-3 py-2 text-sm`;

// Botón Primario - Tamaño grande (text-base)
export const BUTTON_PRIMARY_LG = `${BUTTON_PRIMARY_BASE} px-4 py-2.5 text-base`;

// Botón Primario por defecto (usa tamaño pequeño)
export const BUTTON_PRIMARY = BUTTON_PRIMARY_SM;

// Botón Secundario Base (estilo del botón "Filter")
const BUTTON_SECONDARY_BASE = "flex items-center bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors";

// Botón Secundario - Tamaño pequeño (text-xs)
export const BUTTON_SECONDARY_SM = `${BUTTON_SECONDARY_BASE} px-3 py-1.5 text-xs`;

// Botón Secundario - Tamaño mediano (text-sm)
export const BUTTON_SECONDARY_MD = `${BUTTON_SECONDARY_BASE} px-3 py-2 text-sm`;

// Botón Secundario por defecto
export const BUTTON_SECONDARY = BUTTON_SECONDARY_SM;

// Input de Búsqueda Base
const INPUT_SEARCH_BASE = "bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300";

// Input de Búsqueda con icono a la izquierda
export const INPUT_SEARCH = `pl-8 pr-3 py-1.5 ${INPUT_SEARCH_BASE} w-60`;

// Input de Búsqueda sin ancho fijo (para usar en diferentes contextos)
export const INPUT_SEARCH_FLEX = `pl-8 pr-3 py-1.5 ${INPUT_SEARCH_BASE}`;

// Helper para combinar clases
export const combineClasses = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};
