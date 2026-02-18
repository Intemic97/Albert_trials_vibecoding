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

import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FloppyDisk as Save, 
  Play, 
  ArrowLeft,
  Sparkle as Sparkles,
  Clock,
  Users,
  Share as Share2,
  Tag,
  ArrowCounterClockwise as Undo,
  ArrowClockwise as Redo,
} from '@phosphor-icons/react';
import { useWorkflowStore, useNodeConfigStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { useExecutionProgress } from '../../hooks';
import { useWorkflowHistory } from './hooks';
import { API_BASE } from '../../config';
import { generateUUID } from '../../utils/uuid';

// Modular components
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodePalette } from './NodePalette';
import { WorkflowToolbar } from './WorkflowToolbar';
import { AIAssistantPanel } from './AIAssistantPanel';
import { NodeConfigPanels } from './NodeConfigPanels';
import { DataPreviewSidePanel } from './DataPreviewSidePanel';
import { 
  ExecutionHistoryModal, 
  TemplatesGalleryModal,
  WorkflowRunnerModal,
  TagsModal,
} from './modals';

// Types & Constants
import type { WorkflowNode, Connection } from './types';
import { DRAGGABLE_ITEMS } from './constants';

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
  const { t } = useTranslation();
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
  const addNode = useWorkflowStore(state => state.addNode);
  const selectNode = useWorkflowStore(state => state.selectNode);
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
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [viewingDataNodeId, setViewingDataNodeId] = useState<string | null>(null);
  const lastExecutionIdRef = useRef<string | null>(null);
  const isUndoRedoRef = useRef(false);

  // Undo/Redo - sync with Zustand store
  const markAsChanged = useWorkflowStore(state => state.markAsChanged);
  const { canUndo, canRedo, undo, redo, pushState, clearHistory } = useWorkflowHistory({
    maxHistoryLength: 50,
    onStateChange: useCallback((state) => {
      isUndoRedoRef.current = true;
      setNodes(state.nodes);
      setConnections(state.connections);
      markAsChanged();
      requestAnimationFrame(() => { isUndoRedoRef.current = false; });
    }, [setNodes, setConnections, markAsChanged]),
  });

  // Execution progress - sync WebSocket updates to node statuses
  const handleExecutionProgress = useCallback((progress: { workflowId?: string; executionId?: string; logs?: Array<{ nodeId: string; status: string }>; currentNodeId?: string; status?: string }) => {
    if (!workflow.id || progress.workflowId !== workflow.id) return;
    const logs = progress.logs || [];
    logs.forEach(log => {
      const nodeStatus = log.status === 'completed' ? 'completed' : log.status === 'error' ? 'error' : log.status === 'running' ? 'running' : null;
      if (nodeStatus) {
        updateNode(log.nodeId, { status: nodeStatus as any });
      }
    });
    if (progress.currentNodeId && progress.status === 'running') {
      updateNode(progress.currentNodeId, { status: 'running' });
    }
  }, [workflow.id, updateNode]);

  const handleExecutionComplete = useCallback((progress: { workflowId?: string; status?: string }) => {
    if (progress.workflowId !== workflow.id) return;
    if (progress.status === 'completed' || progress.status === 'failed') {
      lastExecutionIdRef.current = null;
    }
  }, [workflow.id]);

  useExecutionProgress({
    onProgress: handleExecutionProgress,
    onComplete: handleExecutionComplete,
  });
  
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

  // Push state to undo history when nodes/connections change (debounced)
  const lastHistoryKeyRef = useRef('');
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    if (nodes.length === 0 && connections.length === 0) return;
    const stateKey = JSON.stringify({ n: nodes.length, c: connections.length, ids: nodes.map(n => n.id).sort().join(',') });
    if (stateKey === lastHistoryKeyRef.current) return;
    const timer = setTimeout(() => {
      lastHistoryKeyRef.current = stateKey;
      pushState({ nodes, connections });
    }, 400);
    return () => clearTimeout(timer);
  }, [nodes, connections, pushState]);

  // Clear history when workflow is reset or when URL workflow changes
  const prevUrlIdRef = useRef(urlWorkflowId);
  useEffect(() => {
    if (urlWorkflowId !== prevUrlIdRef.current) {
      prevUrlIdRef.current = urlWorkflowId;
      clearHistory();
      lastHistoryKeyRef.current = '';
    } else if (nodes.length === 0 && connections.length === 0) {
      clearHistory();
      lastHistoryKeyRef.current = '';
    }
  }, [urlWorkflowId, nodes.length, connections.length, clearHistory]);

  // Keyboard shortcuts: Ctrl+Z Undo, Ctrl+Shift+Z Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
  
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
      const response = await fetch(`${API_BASE}/workflows/${id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const workflowData = data.data || {};
        loadWorkflow(
          data.id,
          data.name,
          workflowData.nodes || [],
          workflowData.connections || [],
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
      const isNew = !workflow.id;
      const url = isNew 
        ? `${API_BASE}/workflows`
        : `${API_BASE}/workflows/${workflow.id}`;
      
      const apiPayload = isNew
        ? { name: workflow.name, data: { nodes, connections }, tags: workflow.tags || [], createdByName: user?.name || user?.email?.split('@')[0] || t('common.unknown') }
        : { name: workflow.name, data: { nodes, connections }, tags: workflow.tags || [], lastEditedByName: user?.name || user?.email?.split('@')[0] || t('common.unknown') };
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiPayload),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (isNew && data.id) {
          setWorkflowMeta({ id: data.id });
          navigate(`/workflows-v2/${data.id}`, { replace: true });
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
      
      // Execute via API (use /api/workflow/:id/execute - singular - and usePrefect for background execution)
      const response = await fetch(`${API_BASE}/workflow/${workflow.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inputs: {}, usePrefect: true }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.executionId) {
          lastExecutionIdRef.current = data.executionId;
        }
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunWorkflowWithInputs = async (inputs: Record<string, any>) => {
    if (!workflow.id) throw new Error('Workflow not saved');
    await saveWorkflow();
    nodes.forEach(node => {
      updateNode(node.id, { status: 'idle', executionResult: undefined });
    });
    const response = await fetch(`${API_BASE}/workflow/${workflow.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inputs, usePrefect: true }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || t('workflows.executionFailed'));
    }
    const data = await response.json();
    if (data.executionId) {
      lastExecutionIdRef.current = data.executionId;
    }
    return {
      executionId: data.executionId,
      backgroundExecution: data.usingPrefect || data.backgroundExecution,
    };
  };
  
  // =========================================================================
  // HANDLERS
  // =========================================================================
  
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm(t('workflows.unsavedChanges'))) {
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
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    updateNode(nodeId, { status: 'running', executionResult: undefined });

    // Use real API when workflow is saved
    if (workflow.id) {
      try {
        const response = await fetch(`${API_BASE}/workflow/${workflow.id}/execute-node`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            nodeId,
            nodeType: node.type,
            node: { ...node, config: node.config || {} },
            inputData: {},
            recursive: false,
          }),
        });
        const data = await response.json();
        if (response.ok && data.success !== false) {
          const output = data.output ?? data.result;
          updateNode(nodeId, {
            status: 'completed',
            executionResult: output ? (typeof output === 'string' ? output : JSON.stringify(output).slice(0, 200)) : t('workflows.success'),
            data: Array.isArray(output) ? output : output?.data ?? (output ? [output] : undefined),
          });
        } else {
          updateNode(nodeId, {
            status: 'error',
            executionResult: data.error || t('workflows.executionFailed'),
          });
        }
      } catch (error) {
        console.error('Node execution error:', error);
        updateNode(nodeId, {
          status: 'error',
          executionResult: error instanceof Error ? error.message : t('workflows.executionFailed'),
        });
      }
    } else {
      // Fallback: simulate when workflow not yet saved
      setTimeout(() => {
        updateNode(nodeId, {
          status: 'completed',
          executionResult: t('workflows.success'),
          data: [{ id: 1, name: 'Sample', value: 100 }, { id: 2, name: 'Data', value: 200 }],
        });
      }, 1000);
    }
  };
  
  const handleViewNodeData = (nodeId: string) => {
    setViewingDataNodeId(nodeId);
  };
  
  const handleDeleteNode = (nodeId: string) => {
    const deleteNode = useWorkflowStore.getState().deleteNode;
    deleteNode(nodeId);
  };
  
  const handleDuplicateNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const newNode: WorkflowNode = {
        ...node,
        id: generateUUID(),
        x: node.x + 50,
        y: node.y + 50,
        label: `${node.label} (copy)`,
      };
      addNode(newNode);
      selectNode(newNode.id);
    }
  };
  
  const handlePaletteDragStart = () => {};

  // "Run with inputs" solo tiene sentido cuando el workflow tiene nodos que aceptan input
  const hasInputNodes = useMemo(
    () => nodes.some((n) => ['manualInput', 'excelInput', 'pdfInput', 'webhook'].includes(n.type)),
    [nodes]
  );

  const handleSaveTags = async (newTags: string[]) => {
    if (!workflow.id) return;
    const res = await fetch(`${API_BASE}/workflows/${workflow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
        body: JSON.stringify({
        name: workflow.name,
        data: { nodes, connections },
        tags: newTags,
        lastEditedByName: user?.name || user?.email?.split('@')[0] || t('common.unknown'),
      }),
    });
    if (res.ok) {
      setWorkflowMeta({ tags: newTags });
      markAsSaved();
    } else {
      throw new Error('Failed to save tags');
    }
  };
  
  // =========================================================================
  // RENDER
  // =========================================================================
  
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
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
          
          <button
            onClick={() => setShowTagsModal(true)}
            disabled={!workflow.id}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
            title="Manage Tags"
          >
            <Tag size={18} className="text-[var(--text-secondary)]" weight="light" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 mr-1">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={16} className="text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo size={16} className="text-[var(--text-secondary)]" />
            </button>
          </div>
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
            className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Play size={16} weight="fill" />
            {isRunning ? 'Running...' : 'Run'}
          </button>
          
          {hasInputNodes && (
            <button
              onClick={() => setShowRunnerModal(true)}
              disabled={nodes.length === 0 || !workflow.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
              title="Provide values for Manual Input, Excel, PDF or Webhook nodes"
            >
              <Share2 size={16} weight="light" />
              Run with inputs
            </button>
          )}
        </div>
      </div>
      
      {/* Main content - canvas fixed, sidebar scrolls */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar - Node Palette (scrollable when many categories) */}
        <div className={`flex-shrink-0 min-h-0 ${ui.isSidebarCollapsed ? 'w-12' : 'w-64'} border-r border-[var(--border-light)] bg-[var(--bg-card)] flex flex-col overflow-hidden transition-all duration-200`}>
          <NodePalette
            isCollapsed={ui.isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onDragStart={handlePaletteDragStart}
            onDragEnd={() => {}}
          />
        </div>
        
        {/* Canvas - fixed, no scroll, fills remaining space */}
        <div 
          className="flex-1 min-h-0 relative overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const raw = e.dataTransfer.getData('application/workflow-node');
            if (!raw) return;
            let item: { type: string; label: string } | null = null;
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.type && parsed?.label) item = parsed;
            } catch {
              item = { type: raw, label: DRAGGABLE_ITEMS.find((i) => i.type === raw)?.label || raw };
            }
            if (item) {
              const def = DRAGGABLE_ITEMS.find((i) => i.type === item!.type && i.label === item!.label) || DRAGGABLE_ITEMS.find((i) => i.type === item!.type);
              if (def) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const newNode: WorkflowNode = {
                  id: generateUUID(),
                  type: def.type as any,
                  label: def.label,
                  x: x,
                  y: y,
                  status: 'idle',
                };
                addNode(newNode);
                selectNode(newNode.id);
              }
            }
          }}
        >
          <WorkflowCanvas
            entities={entities}
            isRunning={isRunning}
            onNodeConfigure={handleNodeConfigure}
            onNodeRun={handleNodeRun}
            onNodeDelete={handleDeleteNode}
            onNodeDuplicate={handleDuplicateNode}
            onViewNodeData={handleViewNodeData}
            onOpenAIAssistant={toggleAIAssistant}
          />
          
          {/* AI Assistant Panel */}
          <AIAssistantPanel
            isOpen={ui.showAIAssistant}
            onClose={toggleAIAssistant}
            entities={entities}
          />
          
          {/* Node Configuration Panels */}
          <NodeConfigPanels entities={entities} />
          
          {/* Data Preview Panel */}
          <DataPreviewSidePanel
            isOpen={viewingDataNodeId !== null}
            nodeId={viewingDataNodeId}
            onClose={() => setViewingDataNodeId(null)}
          />
        </div>
      </div>
      
      {/* Modals */}
      {ui.showExecutionHistory && (
        <ExecutionHistoryModal
          isOpen={ui.showExecutionHistory}
          workflowId={workflow.id || ''}
          workflowName={workflow.name}
          onClose={() => setShowExecutionHistory(false)}
          onRestore={(data, version) => {
            setNodes(data.nodes || []);
            setConnections(data.connections || []);
            setShowExecutionHistory(false);
          }}
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
      
      {showTagsModal && (
        <TagsModal
          isOpen={showTagsModal}
          onClose={() => setShowTagsModal(false)}
          initialTags={workflow.tags || []}
          onSave={handleSaveTags}
          disabled={!workflow.id}
        />
      )}
      
      {ui.showRunnerModal && (
        <WorkflowRunnerModal
          isOpen={ui.showRunnerModal}
          onClose={() => setShowRunnerModal(false)}
          workflowId={workflow.id || ''}
          workflowName={workflow.name}
          nodes={nodes}
          onRun={handleRunWorkflowWithInputs}
        />
      )}
    </div>
  );
};

export default WorkflowEditor;
