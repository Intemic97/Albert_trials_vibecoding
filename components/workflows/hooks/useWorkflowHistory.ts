import { useState, useCallback, useRef } from 'react';
import { WorkflowNode, Connection } from '../types';

interface HistoryState {
  nodes: WorkflowNode[];
  connections: Connection[];
}

interface UseWorkflowHistoryOptions {
  maxHistoryLength?: number;
  onStateChange?: (state: HistoryState) => void;
}

interface UseWorkflowHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;
  undo: () => HistoryState | null;
  redo: () => HistoryState | null;
  pushState: (state: HistoryState) => void;
  clearHistory: () => void;
  getHistory: () => HistoryState[];
}

/**
 * Hook for managing workflow undo/redo history
 */
export const useWorkflowHistory = (options: UseWorkflowHistoryOptions = {}): UseWorkflowHistoryReturn => {
  const { maxHistoryLength = 50, onStateChange } = options;

  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<HistoryState[]>([]);

  // Check if we can undo
  const canUndo = historyIndex > 0;

  // Check if we can redo
  const canRedo = historyIndex < historyRef.current.length - 1;

  // Push new state to history
  const pushState = useCallback((state: HistoryState) => {
    // Remove any redo states when new state is pushed
    if (historyIndex < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndex + 1);
    }

    // Add new state
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections)),
    });

    // Trim history if too long
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current = historyRef.current.slice(-maxHistoryLength);
    }

    setHistoryIndex(historyRef.current.length - 1);
  }, [historyIndex, maxHistoryLength]);

  // Undo to previous state
  const undo = useCallback((): HistoryState | null => {
    if (!canUndo) return null;

    const newIndex = historyIndex - 1;
    const state = historyRef.current[newIndex];
    
    setHistoryIndex(newIndex);
    
    if (state && onStateChange) {
      onStateChange(state);
    }

    return state ? {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections)),
    } : null;
  }, [canUndo, historyIndex, onStateChange]);

  // Redo to next state
  const redo = useCallback((): HistoryState | null => {
    if (!canRedo) return null;

    const newIndex = historyIndex + 1;
    const state = historyRef.current[newIndex];
    
    setHistoryIndex(newIndex);
    
    if (state && onStateChange) {
      onStateChange(state);
    }

    return state ? {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections)),
    } : null;
  }, [canRedo, historyIndex, onStateChange]);

  // Clear all history
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistoryIndex(-1);
  }, []);

  // Get full history
  const getHistory = useCallback(() => {
    return historyRef.current.map(state => ({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections)),
    }));
  }, []);

  return {
    canUndo,
    canRedo,
    historyLength: historyRef.current.length,
    currentIndex: historyIndex,
    undo,
    redo,
    pushState,
    clearHistory,
    getHistory,
  };
};
