/**
 * Custom hook for managing core workflow state
 * Centralizes all workflow-related state in one place
 */

import { useState, useCallback } from 'react';
import { WorkflowNode, Connection } from '../types';
import { API_BASE } from '../../../config';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowData {
    id: string;
    name: string;
    data: {
        nodes: WorkflowNode[];
        connections: Connection[];
    };
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    createdByName?: string;
    lastEditedBy?: string;
    lastEditedByName?: string;
}

export interface WorkflowStateHook {
    // Core state
    nodes: WorkflowNode[];
    connections: Connection[];
    workflowName: string;
    currentWorkflowId: string | null;
    workflowTags: string[];
    
    // Setters
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
    setWorkflowName: React.Dispatch<React.SetStateAction<string>>;
    setCurrentWorkflowId: React.Dispatch<React.SetStateAction<string | null>>;
    setWorkflowTags: React.Dispatch<React.SetStateAction<string[]>>;
    
    // Status
    isSaving: boolean;
    isRunning: boolean;
    hasUnsavedChanges: boolean;
    autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
    
    // Actions
    loadWorkflow: (id: string) => Promise<void>;
    saveWorkflow: () => Promise<boolean>;
    createNewWorkflow: () => void;
    resetWorkflow: () => void;
    markAsChanged: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export const useWorkflowState = (): WorkflowStateHook => {
    // Core workflow state
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [workflowName, setWorkflowName] = useState<string>('');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
    const [workflowTags, setWorkflowTags] = useState<string[]>([]);
    
    // Status state
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Load a workflow by ID
    const loadWorkflow = useCallback(async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/workflows/${id}`, {
                credentials: 'include'
            });
            
            if (!res.ok) {
                throw new Error('Failed to load workflow');
            }
            
            const workflow: WorkflowData = await res.json();
            
            setCurrentWorkflowId(workflow.id);
            setWorkflowName(workflow.name);
            setNodes(workflow.data?.nodes || []);
            setConnections(workflow.data?.connections || []);
            setWorkflowTags(workflow.tags || []);
            setHasUnsavedChanges(false);
            setAutoSaveStatus('idle');
        } catch (error) {
            console.error('Error loading workflow:', error);
            throw error;
        }
    }, []);

    // Save current workflow
    const saveWorkflow = useCallback(async (): Promise<boolean> => {
        if (!currentWorkflowId || !workflowName.trim()) {
            return false;
        }

        setIsSaving(true);
        setAutoSaveStatus('saving');

        try {
            const data = { nodes, connections };
            const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: workflowName,
                    data,
                    tags: workflowTags
                }),
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to save workflow');
            }

            setHasUnsavedChanges(false);
            setAutoSaveStatus('saved');
            
            // Reset to idle after showing "saved" briefly
            setTimeout(() => setAutoSaveStatus('idle'), 2000);
            
            return true;
        } catch (error) {
            console.error('Error saving workflow:', error);
            setAutoSaveStatus('error');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [currentWorkflowId, workflowName, nodes, connections, workflowTags]);

    // Create a new empty workflow
    const createNewWorkflow = useCallback(() => {
        setCurrentWorkflowId(null);
        setWorkflowName('');
        setNodes([]);
        setConnections([]);
        setWorkflowTags([]);
        setHasUnsavedChanges(false);
        setAutoSaveStatus('idle');
    }, []);

    // Reset to initial state
    const resetWorkflow = useCallback(() => {
        createNewWorkflow();
    }, [createNewWorkflow]);

    // Mark workflow as having unsaved changes
    const markAsChanged = useCallback(() => {
        setHasUnsavedChanges(true);
    }, []);

    return {
        // Core state
        nodes,
        connections,
        workflowName,
        currentWorkflowId,
        workflowTags,
        
        // Setters
        setNodes,
        setConnections,
        setWorkflowName,
        setCurrentWorkflowId,
        setWorkflowTags,
        
        // Status
        isSaving,
        isRunning,
        hasUnsavedChanges,
        autoSaveStatus,
        
        // Actions
        loadWorkflow,
        saveWorkflow,
        createNewWorkflow,
        resetWorkflow,
        markAsChanged,
    };
};

export default useWorkflowState;
