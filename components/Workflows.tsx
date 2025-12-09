import React, { useState, useRef, useEffect } from 'react';
import { Workflow, Zap, Play, CheckCircle, AlertCircle, ArrowRight, X, Save, FolderOpen, Trash2 } from 'lucide-react';

interface WorkflowNode {
    id: string;
    type: 'trigger' | 'action' | 'condition';
    label: string;
    x: number;
    y: number;
}

interface Connection {
    id: string;
    fromNodeId: string;
    toNodeId: string;
}

interface DraggableItem {
    type: 'trigger' | 'action' | 'condition';
    label: string;
    icon: React.ElementType;
}

const DRAGGABLE_ITEMS: DraggableItem[] = [
    { type: 'trigger', label: 'Manual Trigger', icon: Play },
    { type: 'trigger', label: 'Schedule', icon: Workflow },
    { type: 'action', label: 'Send Email', icon: Zap },
    { type: 'action', label: 'Update Record', icon: CheckCircle },
    { type: 'condition', label: 'If / Else', icon: AlertCircle },
];

export const Workflows: React.FC = () => {
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    const [draggingItem, setDraggingItem] = useState<DraggableItem | null>(null);
    const [workflowName, setWorkflowName] = useState<string>('Untitled Workflow');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
    const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Load workflows on mount
    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/workflows');
            const data = await res.json();
            setSavedWorkflows(data);
            // Auto-load the most recent workflow
            if (data.length > 0 && !currentWorkflowId) {
                loadWorkflow(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
        }
    };

    const loadWorkflow = async (id: string) => {
        try {
            const res = await fetch(`http://localhost:3001/api/workflows/${id}`);
            const workflow = await res.json();
            setWorkflowName(workflow.name);
            setCurrentWorkflowId(workflow.id);
            setNodes(workflow.data.nodes || []);
            setConnections(workflow.data.connections || []);
        } catch (error) {
            console.error('Error loading workflow:', error);
        }
    };

    const saveWorkflow = async () => {
        if (!workflowName.trim()) {
            alert('Please enter a workflow name');
            return;
        }

        setIsSaving(true);
        try {
            const data = { nodes, connections };

            if (currentWorkflowId) {
                // Update existing
                await fetch(`http://localhost:3001/api/workflows/${currentWorkflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, data })
                });
            } else {
                // Create new
                const res = await fetch('http://localhost:3001/api/workflows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, data })
                });
                const newWorkflow = await res.json();
                setCurrentWorkflowId(newWorkflow.id);
            }

            await fetchWorkflows();
            alert('Workflow saved successfully!');
        } catch (error) {
            console.error('Error saving workflow:', error);
            alert('Failed to save workflow');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            await fetch(`http://localhost:3001/api/workflows/${id}`, { method: 'DELETE' });
            await fetchWorkflows();
            if (currentWorkflowId === id) {
                setCurrentWorkflowId(null);
                setWorkflowName('Untitled Workflow');
                setNodes([]);
                setConnections([]);
            }
        } catch (error) {
            console.error('Error deleting workflow:', error);
        }
    };

    const newWorkflow = () => {
        setCurrentWorkflowId(null);
        setWorkflowName('Untitled Workflow');
        setNodes([]);
        setConnections([]);
        setConnectingFrom(null);
    };


    const handleDragStart = (e: React.DragEvent, item: DraggableItem) => {
        setDraggingItem(item);
        e.dataTransfer.effectAllowed = 'copy';
        // Set a transparent image or custom drag image if needed, 
        // but default is usually fine for simple cases.
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingItem || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;

        const newNode: WorkflowNode = {
            id: crypto.randomUUID(),
            type: draggingItem.type,
            label: draggingItem.label,
            x,
            y
        };

        setNodes(prev => [...prev, newNode]);
        setDraggingItem(null);
    };

    const removeNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        // Also remove connections involving this node
        setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
    };

    const handleConnectorClick = (nodeId: string) => {
        if (!connectingFrom) {
            // Start connecting
            setConnectingFrom(nodeId);
        } else if (connectingFrom !== nodeId) {
            // Complete connection
            const newConnection: Connection = {
                id: crypto.randomUUID(),
                fromNodeId: connectingFrom,
                toNodeId: nodeId
            };
            setConnections(prev => [...prev, newConnection]);
            setConnectingFrom(null);
        } else {
            // Cancel if clicking same node
            setConnectingFrom(null);
        }
    };

    // Simple node rendering based on type
    const getNodeColor = (type: string) => {
        switch (type) {
            case 'trigger': return 'bg-purple-100 border-purple-300 text-purple-800';
            case 'action': return 'bg-blue-100 border-blue-300 text-blue-800';
            case 'condition': return 'bg-amber-100 border-amber-300 text-amber-800';
            default: return 'bg-slate-100 border-slate-300';
        }
    };

    return (
        <div className="flex h-full bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col shadow-sm z-10">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Components</h2>
                <div className="space-y-3">
                    {DRAGGABLE_ITEMS.map((item) => (
                        <div
                            key={item.label}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            className="flex items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-teal-500 hover:shadow-md transition-all"
                        >
                            <item.icon size={18} className="text-slate-500 mr-3" />
                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto p-4 bg-slate-50 rounded-lg text-xs text-slate-500">
                    <p className="font-semibold mb-1">Tip:</p>
                    {connectingFrom ? (
                        <p>Click another connector point to complete the connection, or click the same node to cancel.</p>
                    ) : (
                        <p>Drag components onto the canvas. Click connector points to link nodes.</p>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="text-2xl font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none transition-colors"
                            placeholder="Workflow Name"
                        />
                        <p className="text-sm text-slate-500 mt-1">
                            {nodes.length} nodes • {connections.length} connections {currentWorkflowId && '• Saved'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={newWorkflow}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Workflow size={16} />
                            New
                        </button>
                        <select
                            value={currentWorkflowId || ''}
                            onChange={(e) => e.target.value && loadWorkflow(e.target.value)}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium appearance-none pr-10"
                        >
                            <option value="">Load Workflow...</option>
                            {savedWorkflows.map(wf => (
                                <option key={wf.id} value={wf.id}>{wf.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={saveWorkflow}
                            disabled={isSaving}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                <div
                    ref={canvasRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="w-full h-full relative"
                >
                    {/* SVG Layer for Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                        {connections.map(conn => {
                            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
                            const toNode = nodes.find(n => n.id === conn.toNodeId);
                            if (!fromNode || !toNode) return null;

                            // Calculate line positions (from right of fromNode to left of toNode)
                            const x1 = fromNode.x + 96; // Half width of node (192px / 2)
                            const y1 = fromNode.y;
                            const x2 = toNode.x - 96;
                            const y2 = toNode.y;

                            return (
                                <line
                                    key={conn.id}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="#0d9488"
                                    strokeWidth="3"
                                    markerEnd="url(#arrowhead)"
                                />
                            );
                        })}
                        {/* Arrow marker definition */}
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="10"
                                refX="9"
                                refY="3"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3, 0 6" fill="#0d9488" />
                            </marker>
                        </defs>
                    </svg>

                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            style={{
                                position: 'absolute',
                                left: node.x,
                                top: node.y,
                                transform: 'translate(-50%, -50%)', // Center on drop point
                                zIndex: 10
                            }}
                            className={`flex items-center p-4 rounded-lg border shadow-md w-48 group ${getNodeColor(node.type)}`}
                        >
                            <div className="flex-1 font-medium text-sm">{node.label}</div>
                            <button
                                onClick={() => removeNode(node.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-all"
                            >
                                <X size={14} />
                            </button>

                            {/* Connector Points */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleConnectorClick(node.id);
                                }}
                                className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full hover:border-teal-500 cursor-crosshair transition-all ${connectingFrom === node.id ? 'border-teal-500 scale-150' : 'border-slate-400'
                                    }`}
                            />
                            {node.type !== 'trigger' && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConnectorClick(node.id);
                                    }}
                                    className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full hover:border-teal-500 cursor-crosshair transition-all ${connectingFrom === node.id ? 'border-teal-500 scale-150' : 'border-slate-400'
                                        }`}
                                />
                            )}
                        </div>
                    ))}

                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center text-slate-400">
                                <Workflow size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Drag components here</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
