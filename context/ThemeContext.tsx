import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { lightTheme, darkTheme, ThemeMode, cssVarNames, Theme } from '../theme';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'intemic-theme-mode';

// Apply theme to document
const applyTheme = (theme: Theme, isDark: boolean) => {
  const root = document.documentElement;
  
  Object.entries(theme).forEach(([key, value]) => {
    const varName = cssVarNames[key as keyof typeof cssVarNames];
    if (varName) {
      root.style.setProperty(varName, value);
    }
  });
  
  // Set data attribute for conditional CSS
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  
  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme.bgPrimary);
  }
};

// Get system preference
const getSystemPreference = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// Get stored preference
const getStoredPreference = (): ThemeMode | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  }
  return null;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return getStoredPreference() || 'light';
  });
  
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(getSystemPreference);
  
  // Resolve the actual theme based on mode
  const resolvedTheme: 'light' | 'dark' = mode === 'system' ? systemPreference : mode;
  const isDark = resolvedTheme === 'dark';
  
  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  // Apply theme when resolved theme changes
  useEffect(() => {
    const theme = isDark ? darkTheme : lightTheme;
    applyTheme(theme, isDark);
  }, [isDark]);
  
  // Set mode and persist
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);
  
  // Toggle between light and dark (not system)
  const toggleTheme = useCallback(() => {
    const newMode = isDark ? 'light' : 'dark';
    setMode(newMode);
  }, [isDark, setMode]);
  
  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for components that need theme-aware styles
export const useThemeStyles = () => {
  const { isDark } = useTheme();
  return isDark ? darkTheme : lightTheme;
};

export default ThemeContext;
