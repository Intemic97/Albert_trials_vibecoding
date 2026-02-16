/**
 * Theme System - Design Tokens for Light and Dark modes
 * Inspired by Notion's dark theme
 * 
 * Este es el archivo principal del sistema de diseño.
 * Define todos los tokens de color, tipografía y espaciado.
 * 
 * USO:
 * Los colores se aplican como CSS variables y se usan así:
 * - bg-[var(--bg-primary)] para fondos
 * - text-[var(--text-primary)] para texto
 * - border-[var(--border-light)] para bordes
 * 
 * Las variables se actualizan automáticamente al cambiar de tema
 * a través del ThemeContext.
 * 
 * @see context/ThemeContext.tsx - Contexto que aplica el tema
 * @see src/index.css - Variables CSS base
 */

export const lightTheme = {
  // Backgrounds
  bgPrimary: '#F8F8F8',
  bgSecondary: '#FFFFFF',
  bgTertiary: '#F0F0F0',
  bgHover: 'rgba(0, 0, 0, 0.03)',
  bgActive: 'rgba(0, 0, 0, 0.05)',
  bgSidebar: '#F8F8F8',
  bgCard: '#FFFFFF',
  bgModal: '#FFFFFF',
  bgInput: '#FFFFFF',
  bgSelected: '#464545',
  
  // Text
  textPrimary: '#37352F',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  textMuted: '#B4B4B4',
  textInverse: '#FFFFFF',
  textOnSelected: '#F8F8F8',
  
  // Borders
  borderLight: '#E8E8E8',
  borderMedium: '#D0D0D0',
  borderDark: '#B0B0B0',
  borderFocus: '#464545',
  
  // Sidebar specific
  sidebarBg: '#F8F8F8',
  sidebarText: '#707070',
  sidebarTextHover: '#505050',
  sidebarTextActive: '#F8F8F8',
  sidebarBgHover: 'rgba(112, 112, 112, 0.1)',
  sidebarBgActive: '#667475',
  sidebarBorder: '#E0E0E0',
  sidebarIcon: '#707070',
  sidebarIconActive: '#F8F8F8',
  sidebarSectionLabel: '#707070',
  
  // Accents - Primary teal (Login/CTA buttons)
  accentPrimary: '#5B7476',
  accentPrimaryHover: '#526a6c',
  accentSuccess: '#0F766E',
  accentWarning: '#D97706',
  accentError: '#DC2626',
  accentInfo: '#0EA5E9',
  
  // Shadows
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px rgba(0, 0, 0, 0.07)',
  shadowLg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  
  // Logo
  logoFilter: 'brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(90%)',
};

export const darkTheme = {
  // Backgrounds - Notion-inspired dark palette
  bgPrimary: '#191919',
  bgSecondary: '#202020',
  bgTertiary: '#2F2F2F',
  bgHover: 'rgba(255, 255, 255, 0.03)',
  bgActive: 'rgba(255, 255, 255, 0.05)',
  bgSidebar: '#202020',
  bgCard: '#252525',
  bgModal: '#252525',
  bgInput: '#2F2F2F',
  bgSelected: '#37352F',
  
  // Text - High contrast for accessibility
  textPrimary: '#E8E8E8',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',
  textMuted: '#505050',
  textInverse: '#191919',
  textOnSelected: '#E8E8E8',
  
  // Borders
  borderLight: '#333333',
  borderMedium: '#404040',
  borderDark: '#505050',
  borderFocus: '#5C5C5C',
  
  // Sidebar specific - Notion dark style
  sidebarBg: '#202020',
  sidebarText: '#9B9B9B',
  sidebarTextHover: '#E8E8E8',
  sidebarTextActive: '#E8E8E8',
  sidebarBgHover: 'rgba(255, 255, 255, 0.05)',
  sidebarBgActive: '#37352F',
  sidebarBorder: '#333333',
  sidebarIcon: '#9B9B9B',
  sidebarIconActive: '#E8E8E8',
  sidebarSectionLabel: '#6B6B6B',
  
  // Accents - Primary teal (same as Login)
  accentPrimary: '#5B7476',
  accentPrimaryHover: '#526a6c',
  accentSuccess: '#2DD4BF',
  accentWarning: '#FBBF24',
  accentError: '#F87171',
  accentInfo: '#38BDF8',
  
  // Shadows - Darker for dark mode
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 6px rgba(0, 0, 0, 0.4)',
  shadowLg: '0 10px 15px rgba(0, 0, 0, 0.5)',
  
  // Logo
  logoFilter: 'brightness(0) invert(1) opacity(0.8)',
};

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark' | 'system';

// CSS variable names mapping
export const cssVarNames = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  bgHover: '--bg-hover',
  bgActive: '--bg-active',
  bgSidebar: '--bg-sidebar',
  bgCard: '--bg-card',
  bgModal: '--bg-modal',
  bgInput: '--bg-input',
  bgSelected: '--bg-selected',
  
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textTertiary: '--text-tertiary',
  textMuted: '--text-muted',
  textInverse: '--text-inverse',
  textOnSelected: '--text-on-selected',
  
  borderLight: '--border-light',
  borderMedium: '--border-medium',
  borderDark: '--border-dark',
  borderFocus: '--border-focus',
  
  sidebarBg: '--sidebar-bg',
  sidebarText: '--sidebar-text',
  sidebarTextHover: '--sidebar-text-hover',
  sidebarTextActive: '--sidebar-text-active',
  sidebarBgHover: '--sidebar-bg-hover',
  sidebarBgActive: '--sidebar-bg-active',
  sidebarBorder: '--sidebar-border',
  sidebarIcon: '--sidebar-icon',
  sidebarIconActive: '--sidebar-icon-active',
  sidebarSectionLabel: '--sidebar-section-label',
  
  accentPrimary: '--accent-primary',
  accentPrimaryHover: '--accent-primary-hover',
  accentSuccess: '--accent-success',
  accentWarning: '--accent-warning',
  accentError: '--accent-error',
  accentInfo: '--accent-info',
  
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  
  logoFilter: '--logo-filter',
};

// Generate CSS variables string
export const generateCSSVariables = (theme: Theme): string => {
  return Object.entries(theme)
    .map(([key, value]) => {
      const varName = cssVarNames[key as keyof typeof cssVarNames];
      return varName ? `${varName}: ${value};` : '';
    })
    .filter(Boolean)
    .join('\n  ');
};
