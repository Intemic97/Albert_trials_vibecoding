import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkflowNode, Connection } from '../types';

interface AutosaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

interface UseWorkflowAutosaveOptions {
  workflowId: string | null;
  nodes: WorkflowNode[];
  connections: Connection[];
  workflowName: string;
  enabled?: boolean;
  debounceMs?: number;
  onSave: (data: { nodes: WorkflowNode[]; connections: Connection[]; name: string }) => Promise<void>;
}

interface UseWorkflowAutosaveReturn {
  autosaveState: AutosaveState;
  markDirty: () => void;
  markClean: () => void;
  forceSave: () => Promise<void>;
  cancelPendingSave: () => void;
}

/**
 * Hook for managing workflow autosave functionality
 */
export const useWorkflowAutosave = (options: UseWorkflowAutosaveOptions): UseWorkflowAutosaveReturn => {
  const {
    workflowId,
    nodes,
    connections,
    workflowName,
    enabled = true,
    debounceMs = 2000,
    onSave,
  } = options;

  const [autosaveState, setAutosaveState] = useState<AutosaveState>({
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null,
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Create a serialized version for comparison
  const getCurrentDataHash = useCallback(() => {
    return JSON.stringify({ nodes, connections, workflowName });
  }, [nodes, connections, workflowName]);

  // Check if data has changed
  const hasDataChanged = useCallback(() => {
    const currentHash = getCurrentDataHash();
    return currentHash !== lastSavedDataRef.current;
  }, [getCurrentDataHash]);

  // Mark as dirty (changes pending)
  const markDirty = useCallback(() => {
    if (hasDataChanged()) {
      setAutosaveState(prev => ({ ...prev, isDirty: true, error: null }));
    }
  }, [hasDataChanged]);

  // Mark as clean (no pending changes)
  const markClean = useCallback(() => {
    lastSavedDataRef.current = getCurrentDataHash();
    setAutosaveState(prev => ({
      ...prev,
      isDirty: false,
      lastSaved: new Date(),
    }));
  }, [getCurrentDataHash]);

  // Perform the save
  const performSave = useCallback(async () => {
    if (!workflowId || !enabled) return;
    if (!hasDataChanged()) {
      setAutosaveState(prev => ({ ...prev, isDirty: false }));
      return;
    }

    setAutosaveState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      await onSave({ nodes, connections, name: workflowName });
      markClean();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save';
      setAutosaveState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage,
      }));
    } finally {
      setAutosaveState(prev => ({ ...prev, isSaving: false }));
    }
  }, [workflowId, enabled, hasDataChanged, onSave, nodes, connections, workflowName, markClean]);

  // Force save immediately
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await performSave();
  }, [performSave]);

  // Cancel any pending save
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Debounced autosave effect
  useEffect(() => {
    if (!enabled || !workflowId || !autosaveState.isDirty) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, workflowId, autosaveState.isDirty, debounceMs, performSave]);

  // Detect changes and mark dirty
  useEffect(() => {
    if (enabled && workflowId && hasDataChanged()) {
      markDirty();
    }
  }, [nodes, connections, workflowName, enabled, workflowId, hasDataChanged, markDirty]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (autosaveState.isDirty && workflowId) {
        // Attempt final save synchronously is not possible, but we can try
        cancelPendingSave();
      }
    };
  }, [autosaveState.isDirty, workflowId, cancelPendingSave]);

  return {
    autosaveState,
    markDirty,
    markClean,
    forceSave,
    cancelPendingSave,
  };
};
