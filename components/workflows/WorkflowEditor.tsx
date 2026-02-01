/**
 * WorkflowEditor - Editor de workflows modular
 * 
 * Versión simplificada que demuestra la arquitectura final usando:
 * - Zustand stores para estado
 * - Hooks modulares para interacciones
 * - Componentes desacoplados
 * 
 * Este archivo puede reemplazar eventualmente a Workflows.tsx
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FloppyDisk as Save, 
  Play, 
  ArrowLeft,
  Sparkle as Sparkles,
  Clock,
  Users,
  Share as Share2,
} from '@phosphor-icons/react';
import { useWorkflowStore, useNodeConfigStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import { generateUUID } from '../../utils/uuid';

// Modular components
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodePalette } from './NodePalette';
import { WorkflowToolbar } from './WorkflowToolbar';
import { 
  ExecutionHistoryModal, 
  TemplatesGalleryModal,
  WorkflowRunnerModal,
} from './modals';

// Types
import type { WorkflowNode, Connection } from './types';

interface WorkflowEditorProps {
  entities?: any[];
  onViewChange?: (view: string) => void;
}

/**
 * Editor principal de workflows - Arquitectura modular
 */
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  entities = [],
  onViewChange,
}) => {
  const { workflowId: urlWorkflowId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // =========================================================================
  // STORES
  // =========================================================================
  
  // Workflow store - estado central
  const workflow = useWorkflowStore(state => state.workflow);
  const nodes = useWorkflowStore(state => state.nodes);
  const connections = useWorkflowStore(state => state.connections);
  const hasUnsavedChanges = useWorkflowStore(state => state.hasUnsavedChanges);
  const ui = useWorkflowStore(state => state.ui);
  
  const loadWorkflow = useWorkflowStore(state => state.loadWorkflow);
  const resetWorkflow = useWorkflowStore(state => state.resetWorkflow);
  const setWorkflowMeta = useWorkflowStore(state => state.setWorkflowMeta);
  const setNodes = useWorkflowStore(state => state.setNodes);
  const setConnections = useWorkflowStore(state => state.setConnections);
  const updateNode = useWorkflowStore(state => state.updateNode);
  const markAsSaved = useWorkflowStore(state => state.markAsSaved);
  const toggleSidebar = useWorkflowStore(state => state.toggleSidebar);
  const toggleAIAssistant = useWorkflowStore(state => state.toggleAIAssistant);
  const setShowExecutionHistory = useWorkflowStore(state => state.setShowExecutionHistory);
  const setShowTemplatesGallery = useWorkflowStore(state => state.setShowTemplatesGallery);
  const setShowRunnerModal = useWorkflowStore(state => state.setShowRunnerModal);
  
  // Node config store
  const configuringNodeId = useNodeConfigStore(state => state.configuringNodeId);
  const openConfig = useNodeConfigStore(state => state.openConfig);
  const closeConfig = useNodeConfigStore(state => state.closeConfig);
  
  // =========================================================================
  // LOCAL STATE (UI-only)
  // =========================================================================
  
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // =========================================================================
  // EFFECTS
  // =========================================================================
  
  // Load workflow on mount
  useEffect(() => {
    if (urlWorkflowId && urlWorkflowId !== 'new') {
      fetchWorkflow(urlWorkflowId);
    } else {
      resetWorkflow();
    }
  }, [urlWorkflowId]);
  
  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  // =========================================================================
  // API FUNCTIONS
  // =========================================================================
  
  const fetchWorkflow = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/workflows/${id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        loadWorkflow(
          data.id,
          data.name,
          data.nodes || [],
          data.connections || [],
          {
            description: data.description,
            tags: data.tags || [],
            isPublic: data.isPublic || false,
          }
        );
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
    }
  };
  
  const saveWorkflow = async () => {
    setIsSaving(true);
    
    try {
      const payload = {
        name: workflow.name,
        description: workflow.description,
        nodes,
        connections,
        tags: workflow.tags,
        isPublic: workflow.isPublic,
      };
      
      const isNew = !workflow.id;
      const url = isNew 
        ? `${API_BASE}/api/workflows`
        : `${API_BASE}/api/workflows/${workflow.id}`;
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (isNew && data.id) {
          setWorkflowMeta({ id: data.id });
          navigate(`/workflows/${data.id}`, { replace: true });
        }
        
        markAsSaved();
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    
    try {
      // Save first
      await saveWorkflow();
      
      // Reset node statuses
      nodes.forEach(node => {
        updateNode(node.id, { status: 'idle', executionResult: undefined });
      });
      
      // Execute via API
      const response = await fetch(`${API_BASE}/api/workflows/${workflow.id}/execute`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Workflow executed:', result);
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
    }
  };
  
  // =========================================================================
  // HANDLERS
  // =========================================================================
  
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        return;
      }
    }
    navigate('/workflows');
    onViewChange?.('list');
  };
  
  const handleNodeConfigure = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      openConfig(nodeId, node.type as any, node.config);
    }
  };
  
  const handleNodeRun = async (nodeId: string) => {
    updateNode(nodeId, { status: 'running' });
    
    // Simulate node execution
    setTimeout(() => {
      updateNode(nodeId, { status: 'completed', executionResult: 'Success' });
    }, 1000);
  };
  
  const handlePaletteDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('application/workflow-node', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };
  
  // =========================================================================
  // RENDER
  // =========================================================================
  
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </button>
          
          <input
            type="text"
            value={workflow.name}
            onChange={(e) => setWorkflowMeta({ name: e.target.value })}
            className="text-lg font-medium bg-transparent border-none focus:outline-none text-[var(--text-primary)]"
            placeholder="Workflow name..."
          />
          
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-500 font-medium">Unsaved</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExecutionHistory(true)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-sm text-[var(--text-secondary)]"
          >
            <Clock size={16} />
            History
          </button>
          
          <button
            onClick={() => setShowTemplatesGallery(true)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-sm text-[var(--text-secondary)]"
          >
            <Share2 size={16} />
            Templates
          </button>
          
          <div className="w-px h-6 bg-[var(--border-light)]" />
          
          <button
            onClick={saveWorkflow}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-sm font-medium text-[var(--text-primary)]"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={runWorkflow}
            disabled={isRunning || nodes.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Play size={16} weight="fill" />
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Node Palette */}
        {!ui.isSidebarCollapsed && (
          <div className="w-64 border-r border-[var(--border-light)] bg-[var(--bg-card)] overflow-y-auto">
            <NodePalette
              onDragStart={handlePaletteDragStart}
              searchQuery={ui.searchQuery}
              selectedCategory={ui.selectedCategory}
            />
          </div>
        )}
        
        {/* Canvas */}
        <WorkflowCanvas
          entities={entities}
          isRunning={isRunning}
          onNodeConfigure={handleNodeConfigure}
          onNodeRun={handleNodeRun}
          onOpenAIAssistant={toggleAIAssistant}
        />
      </div>
      
      {/* Modals */}
      {ui.showExecutionHistory && (
        <ExecutionHistoryModal
          isOpen={ui.showExecutionHistory}
          workflowId={workflow.id || ''}
          workflowName={workflow.name}
          onClose={() => setShowExecutionHistory(false)}
        />
      )}
      
      {ui.showTemplatesGallery && (
        <TemplatesGalleryModal
          isOpen={ui.showTemplatesGallery}
          onClose={() => setShowTemplatesGallery(false)}
          onCopyTemplate={async (template) => {
            setNodes(template.nodes || []);
            setConnections(template.connections || []);
            setWorkflowMeta({ name: template.name });
            setShowTemplatesGallery(false);
          }}
          isCopying={false}
        />
      )}
    </div>
  );
};

export default WorkflowEditor;
