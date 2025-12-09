import React, { useState, useRef } from 'react';
import { Workflow, Zap, Play, CheckCircle, AlertCircle, ArrowRight, X } from 'lucide-react';

interface WorkflowNode {
    id: string;
    type: 'trigger' | 'action' | 'condition';
    label: string;
    x: number;
    y: number;
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
    const [draggingItem, setDraggingItem] = useState<DraggableItem | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

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
                    Drag components onto the canvas to build your workflow.
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="absolute top-4 left-4 z-10">
                    <h1 className="text-2xl font-bold text-slate-800">New Workflow</h1>
                    <p className="text-sm text-slate-500">Untitled Workflow</p>
                </div>

                <div
                    ref={canvasRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="w-full h-full relative"
                >
                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            style={{
                                position: 'absolute',
                                left: node.x,
                                top: node.y,
                                transform: 'translate(-50%, -50%)' // Center on drop point
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
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-400 rounded-full hover:border-teal-500 cursor-crosshair" />
                            {node.type !== 'trigger' && (
                                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-400 rounded-full hover:border-teal-500 cursor-crosshair" />
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
