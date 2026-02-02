/**
 * WorkflowsRefactored - Example of using the modular architecture
 * 
 * Este archivo muestra cómo se vería Workflows.tsx usando los módulos extraídos.
 * Es un ejemplo funcional que puede usarse como referencia para la migración.
 * 
 * Para usar: Renombrar a Workflows.tsx y ajustar según sea necesario.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { generateUUID } from '../../utils/uuid';

// Import all from modular architecture
import {
    // Types
    type WorkflowNode,
    type Connection,
    type WorkflowTemplate,
    // Constants
    DRAGGABLE_ITEMS,
    WORKFLOW_TEMPLATES,
    // Hooks
    useWorkflowState,
    useCanvasInteraction,
    // Views
    WorkflowsListView,
    type WorkflowListItem,
    // Modals
    TemplatesGalleryModal,
    ExecutionHistoryModal,
    WorkflowRunnerModal,
    // Utilities
    getNodeColor,
    isNodeConfigured,
    getNodeTopTag,
} from './index';

// ============================================================================
// TYPES
// ============================================================================

interface WorkflowsRefactoredProps {
    entities: any[];
}

interface SavedWorkflow extends WorkflowListItem {
    data?: {
        nodes: WorkflowNode[];
        connections: Connection[];
    };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkflowsRefactored: React.FC<WorkflowsRefactoredProps> = ({ entities }) => {
    const { workflowId: urlWorkflowId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const canvasRef = useRef<HTMLDivElement>(null);
    
    // Use modular workflow state hook
    const workflowState = useWorkflowState();
    const {
        nodes,
        setNodes,
        connections,
        setConnections,
        workflowName,
        setWorkflowName,
        currentWorkflowId,
        setCurrentWorkflowId,
        isSaving,
        saveWorkflow,
        loadWorkflow,
        createNewWorkflow,
    } = workflowState;

    // Use modular canvas interaction hook
    const canvasInteraction = useCanvasInteraction(canvasRef);
    const {
        canvasOffset,
        canvasZoom,
        isPanning,
        handleWheel,
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        resetView,
        zoomIn,
        zoomOut,
        fitToView,
    } = canvasInteraction;

    // ========================================================================
    // LOCAL STATE
    // ========================================================================
    
    // View state
    const [currentView, setCurrentView] = useState<'list' | 'canvas'>('list');
    
    // Workflows list
    const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
    
    // Search and filter
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    
    // Modals
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [showExecutionHistory, setShowExecutionHistory] = useState(false);
    const [showRunnerModal, setShowRunnerModal] = useState(false);
    const [isCopyingTemplate, setIsCopyingTemplate] = useState(false);

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    const fetchWorkflows = useCallback(async () => {
        setIsLoadingWorkflows(true);
        try {
            const res = await fetch(`${API_BASE}/workflows`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSavedWorkflows(data);
            }
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
        } finally {
            setIsLoadingWorkflows(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    // Handle URL workflow ID
    useEffect(() => {
        if (urlWorkflowId === 'new') {
            createNewWorkflow();
            setCurrentView('canvas');
        } else if (urlWorkflowId) {
            loadWorkflow(urlWorkflowId).then(() => {
                setCurrentView('canvas');
            });
        }
    }, [urlWorkflowId]);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleOpenWorkflow = useCallback((id: string) => {
        navigate(`/workflows/${id}`);
    }, [navigate]);

    const handleDeleteWorkflow = useCallback(async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        
        try {
            const res = await fetch(`${API_BASE}/workflows/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (res.ok) {
                fetchWorkflows();
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        }
    }, [fetchWorkflows]);

    const handleCreateNew = useCallback(() => {
        navigate('/workflows/new');
    }, [navigate]);

    const handleCopyTemplate = useCallback(async (template: WorkflowTemplate) => {
        setIsCopyingTemplate(true);
        try {
            // Generate new IDs
            const idMapping: Record<string, string> = {};
            
            const newNodes = template.nodes.map(node => {
                const newId = generateUUID();
                idMapping[node.id] = newId;
                return { ...node, id: newId, status: undefined };
            });

            const newConnections = template.connections.map(conn => ({
                ...conn,
                id: generateUUID(),
                fromNodeId: idMapping[conn.fromNodeId],
                toNodeId: idMapping[conn.toNodeId],
            }));

            // Create workflow via API
            const res = await fetch(`${API_BASE}/workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${template.name} (Copy)`,
                    data: { nodes: newNodes, connections: newConnections },
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const newWorkflow = await res.json();
                await fetchWorkflows();
                navigate(`/workflows/${newWorkflow.id}`);
            }
        } catch (error) {
            console.error('Failed to copy template:', error);
        } finally {
            setIsCopyingTemplate(false);
        }
    }, [fetchWorkflows, navigate]);

    const handleRunWorkflow = useCallback(async (inputs: Record<string, any>) => {
        if (!currentWorkflowId) return;
        
        const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs }),
            credentials: 'include'
        });
        
        if (!res.ok) {
            throw new Error('Workflow execution failed');
        }
    }, [currentWorkflowId]);

    const handleBackToList = useCallback(() => {
        navigate('/workflows');
        setCurrentView('list');
    }, [navigate]);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================

    const allTags = Array.from(new Set(
        savedWorkflows.flatMap(wf => wf.tags || []).filter(Boolean)
    )).sort();

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="flex flex-col bg-[var(--bg-primary)] h-full">
            {currentView === 'list' ? (
                // Use modular WorkflowsListView
                <WorkflowsListView
                    workflows={savedWorkflows}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedTagFilter={selectedTagFilter}
                    onTagFilterChange={setSelectedTagFilter}
                    allTags={allTags}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onOpenWorkflow={handleOpenWorkflow}
                    onDeleteWorkflow={handleDeleteWorkflow}
                    onCreateNew={handleCreateNew}
                    onOpenTemplates={() => setShowTemplatesModal(true)}
                />
            ) : (
                // Canvas View (simplified example)
                <div className="flex-1 flex flex-col">
                    {/* Toolbar */}
                    <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={handleBackToList} className="text-sm">
                                ← Back
                            </button>
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="text-lg bg-transparent border-none focus:outline-none"
                                placeholder="Workflow Name"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowExecutionHistory(true)}
                                className="px-3 py-1.5 text-sm border rounded"
                            >
                                History
                            </button>
                            <button 
                                onClick={() => setShowRunnerModal(true)}
                                className="px-3 py-1.5 text-sm bg-[#256A65] text-white rounded"
                            >
                                Run
                            </button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div 
                        ref={canvasRef}
                        className="flex-1 overflow-hidden relative"
                        onWheel={handleWheel}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={(e) => handleCanvasMouseMove(e, nodes, setNodes)}
                        onMouseUp={handleCanvasMouseUp}
                    >
                        <div
                            style={{
                                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
                                transformOrigin: '0 0',
                            }}
                        >
                            {/* Render nodes here */}
                            {nodes.map(node => (
                                <div
                                    key={node.id}
                                    className={`absolute p-4 rounded-lg ${getNodeColor(node.type, node.status)}`}
                                    style={{ left: node.x, top: node.y }}
                                >
                                    {node.label}
                                    {!isNodeConfigured(node) && (
                                        <span className="text-xs text-amber-500 ml-2">Not configured</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Zoom Controls */}
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            <button onClick={zoomOut} className="p-2 bg-white rounded shadow">−</button>
                            <button onClick={resetView} className="p-2 bg-white rounded shadow">Reset</button>
                            <button onClick={zoomIn} className="p-2 bg-white rounded shadow">+</button>
                            <button onClick={() => fitToView(nodes)} className="p-2 bg-white rounded shadow">Fit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modular Templates Modal */}
            <TemplatesGalleryModal
                isOpen={showTemplatesModal}
                onClose={() => setShowTemplatesModal(false)}
                onCopyTemplate={handleCopyTemplate}
                isCopying={isCopyingTemplate}
            />

            {/* Modular Execution History Modal */}
            <ExecutionHistoryModal
                isOpen={showExecutionHistory}
                onClose={() => setShowExecutionHistory(false)}
                workflowId={currentWorkflowId || ''}
                workflowName={workflowName}
            />

            {/* Modular Workflow Runner Modal */}
            <WorkflowRunnerModal
                isOpen={showRunnerModal}
                onClose={() => setShowRunnerModal(false)}
                workflowName={workflowName}
                nodes={nodes}
                onRun={handleRunWorkflow}
            />
        </div>
    );
};

export default WorkflowsRefactored;
