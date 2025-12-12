import React, { useState, useRef, useEffect } from 'react';
import { Workflow, Zap, Play, CheckCircle, AlertCircle, ArrowRight, X, Save, FolderOpen, Trash2, PlayCircle, Check, XCircle, Database, Wrench, Search, ChevronsLeft, ChevronsRight, Sparkles, Code, Edit, LogOut, MessageSquare, Globe } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { ProfileMenu } from './ProfileMenu';

interface WorkflowNode {
    id: string;
    type: 'trigger' | 'action' | 'condition' | 'fetchData' | 'addField' | 'saveRecords' | 'equipment' | 'llm' | 'python' | 'manualInput' | 'output' | 'comment' | 'http';
    label: string;
    x: number;
    y: number;
    status?: 'idle' | 'running' | 'completed' | 'error';
    config?: {
        entityId?: string;
        entityName?: string;
        // For condition nodes:
        conditionField?: string;
        conditionOperator?: string;
        conditionValue?: string;
        recordId?: string;
        recordName?: string;
        llmPrompt?: string;
        llmContextEntities?: string[];
        llmIncludeInput?: boolean;
        pythonCode?: string;
        pythonAiPrompt?: string;
        // For manual input nodes:
        inputVarName?: string;
        inputVarValue?: string;
        // For comment nodes:
        commentText?: string;
        // For http nodes:
        httpUrl?: string;
    };
    executionResult?: string;
    data?: any;
    inputData?: any;
    outputData?: any;
    conditionResult?: boolean;  // Store evaluation result
}

interface Connection {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    outputType?: 'true' | 'false';  // For condition nodes
}

interface DraggableItem {
    type: 'trigger' | 'action' | 'condition' | 'fetchData' | 'addField' | 'saveRecords' | 'equipment' | 'llm' | 'python' | 'manualInput' | 'output' | 'comment' | 'http';
    label: string;
    icon: React.ElementType;
    description: string;
    category: 'Triggers' | 'Data' | 'Logic' | 'Actions' | 'Other';
}

const DRAGGABLE_ITEMS: DraggableItem[] = [
    { type: 'trigger', label: 'Manual Trigger', icon: Play, description: 'Manually start the workflow', category: 'Triggers' },
    { type: 'trigger', label: 'Schedule', icon: Workflow, description: 'Run on a specific schedule', category: 'Triggers' },
    { type: 'fetchData', label: 'Fetch Data', icon: Database, description: 'Get records from an entity', category: 'Data' },
    { type: 'saveRecords', label: 'Save Records', icon: Database, description: 'Create or update records', category: 'Data' },
    { type: 'equipment', label: 'Equipment', icon: Wrench, description: 'Use specific equipment data', category: 'Data' },
    { type: 'http', label: 'HTTP Request', icon: Globe, description: 'Fetch data from an external API', category: 'Data' },
    { type: 'manualInput', label: 'Manual Data Input', icon: Edit, description: 'Define a variable with a value', category: 'Data' },
    { type: 'condition', label: 'If / Else', icon: AlertCircle, description: 'Branch based on conditions', category: 'Logic' },
    { type: 'llm', label: 'AI Generation', icon: Sparkles, description: 'Generate text using AI', category: 'Logic' },
    { type: 'python', label: 'Python Code', icon: Code, description: 'Run Python script', category: 'Logic' },
    { type: 'addField', label: 'Add Field', icon: CheckCircle, description: 'Add a new field to data', category: 'Logic' },
    { type: 'action', label: 'Send Email', icon: Zap, description: 'Send an email notification', category: 'Actions' },
    { type: 'action', label: 'Update Record', icon: CheckCircle, description: 'Modify existing records', category: 'Actions' },
    { type: 'output', label: 'Output', icon: LogOut, description: 'Display workflow output data', category: 'Actions' },
    { type: 'comment', label: 'Comment', icon: MessageSquare, description: 'Add a note or comment', category: 'Other' },
];

interface WorkflowsProps {
    entities: any[];
    onViewChange?: (view: string) => void;
}

export const Workflows: React.FC<WorkflowsProps> = ({ entities, onViewChange }) => {
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    const [draggingItem, setDraggingItem] = useState<DraggableItem | null>(null);
    const [workflowName, setWorkflowName] = useState<string>('Untitled Workflow');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
    const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [viewingDataNodeId, setViewingDataNodeId] = useState<string | null>(null);
    const [configuringConditionNodeId, setConfiguringConditionNodeId] = useState<string | null>(null);
    const [conditionField, setConditionField] = useState<string>('');
    const [conditionOperator, setConditionOperator] = useState<string>('isText');
    const [conditionValue, setConditionValue] = useState<string>('');
    const [connectingFromType, setConnectingFromType] = useState<'true' | 'false' | null>(null);
    const [configuringAddFieldNodeId, setConfiguringAddFieldNodeId] = useState<string | null>(null);
    const [addFieldName, setAddFieldName] = useState<string>('');
    const [addFieldValue, setAddFieldValue] = useState<string>('');
    const [configuringSaveNodeId, setConfiguringSaveNodeId] = useState<string | null>(null);
    const [saveEntityId, setSaveEntityId] = useState<string>('');

    // Sidebar State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Equipment Node State
    const [configuringEquipmentNodeId, setConfiguringEquipmentNodeId] = useState<string | null>(null);
    const [equipmentRecords, setEquipmentRecords] = useState<any[]>([]);
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
    const [isLoadingEquipments, setIsLoadingEquipments] = useState(false);

    // LLM Node State
    const [configuringLLMNodeId, setConfiguringLLMNodeId] = useState<string | null>(null);
    const [llmPrompt, setLlmPrompt] = useState<string>('');
    const [llmContextEntities, setLlmContextEntities] = useState<string[]>([]);
    const [llmIncludeInput, setLlmIncludeInput] = useState<boolean>(true);

    // Python Node State
    const [configuringPythonNodeId, setConfiguringPythonNodeId] = useState<string | null>(null);
    const [pythonCode, setPythonCode] = useState<string>('def process(data):\n    # Modify data here\n    return data');
    const [pythonAiPrompt, setPythonAiPrompt] = useState<string>('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);

    // Manual Input Node State
    const [configuringManualInputNodeId, setConfiguringManualInputNodeId] = useState<string | null>(null);
    const [manualInputVarName, setManualInputVarName] = useState<string>('');
    const [manualInputVarValue, setManualInputVarValue] = useState<string>('');

    // HTTP Node State
    const [configuringHttpNodeId, setConfiguringHttpNodeId] = useState<string | null>(null);
    const [httpUrl, setHttpUrl] = useState<string>('');

    const [dataViewTab, setDataViewTab] = useState<'input' | 'output'>('output');
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [canvasZoom, setCanvasZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    // Load workflows on mount
    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/workflows', { credentials: 'include' });
            if (!res.ok) {
                console.error('Failed to fetch workflows');
                setSavedWorkflows([]);
                return;
            }
            const data = await res.json();

            if (Array.isArray(data)) {
                setSavedWorkflows(data);
                // Auto-load the most recent workflow
                if (data.length > 0 && !currentWorkflowId) {
                    loadWorkflow(data[0].id);
                }
            } else {
                console.error('Workflows API returned non-array:', data);
                setSavedWorkflows([]);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
            setSavedWorkflows([]);
        }
    };

    const loadWorkflow = async (id: string) => {
        try {
            const res = await fetch(`http://localhost:3001/api/workflows/${id}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to load workflow');
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
                const res = await fetch(`http://localhost:3001/api/workflows/${currentWorkflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, data }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Failed to update workflow');
            } else {
                // Create new
                const res = await fetch('http://localhost:3001/api/workflows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, data }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Failed to create workflow');
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
            const res = await fetch(`http://localhost:3001/api/workflows/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to delete workflow');
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

    const openNodeConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'fetchData') {
            setConfiguringNodeId(nodeId);
            setSelectedEntityId(node.config?.entityId || '');
        }
    };

    const saveNodeConfig = () => {
        if (!configuringNodeId || !selectedEntityId) return;

        const entity = entities.find(e => e.id === selectedEntityId);
        setNodes(prev => prev.map(n =>
            n.id === configuringNodeId
                ? { ...n, config: { entityId: selectedEntityId, entityName: entity?.name || '' } }
                : n
        ));
        setConfiguringNodeId(null);
        setSelectedEntityId('');
    };

    const openConditionConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'condition') {
            setConfiguringConditionNodeId(nodeId);
            setConditionField(node.config?.conditionField || '');
            setConditionOperator(node.config?.conditionOperator || 'isText');
            setConditionValue(node.config?.conditionValue || '');
        }
    };

    const saveConditionConfig = () => {
        if (!configuringConditionNodeId || !conditionField) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringConditionNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        conditionField,
                        conditionOperator,
                        conditionValue
                    }
                }
                : n
        ));
        setConfiguringConditionNodeId(null);
        setConditionField('');
        setConditionOperator('isText');
        setConditionValue('');
    };

    const openAddFieldConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'addField') {
            setConfiguringAddFieldNodeId(nodeId);
            setAddFieldName(node.config?.conditionField || '');
            setAddFieldValue(node.config?.conditionValue || '');
        }
    };

    const saveAddFieldConfig = () => {
        if (!configuringAddFieldNodeId || !addFieldName) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringAddFieldNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        conditionField: addFieldName,
                        conditionValue: addFieldValue
                    }
                }
                : n
        ));
        setConfiguringAddFieldNodeId(null);
        setAddFieldName('');
        setAddFieldValue('');
    };

    const openSaveRecordsConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'saveRecords') {
            setConfiguringSaveNodeId(nodeId);
            setSaveEntityId(node.config?.entityId || '');
        }
    };

    const saveSaveRecordsConfig = () => {
        if (!configuringSaveNodeId || !saveEntityId) return;

        const entity = entities.find(e => e.id === saveEntityId);
        setNodes(prev => prev.map(n =>
            n.id === configuringSaveNodeId
                ? { ...n, config: { entityId: saveEntityId, entityName: entity?.name || '' } }
                : n
        ));
        setConfiguringSaveNodeId(null);
        setSaveEntityId('');
    };

    const openEquipmentConfig = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'equipment') {
            setConfiguringEquipmentNodeId(nodeId);
            setSelectedEquipmentId(node.config?.recordId || '');

            // Find "Equipment" or "Equipments" entity
            const equipmentEntity = entities.find(e =>
                e.name.toLowerCase() === 'equipment' ||
                e.name.toLowerCase() === 'equipments'
            );

            if (equipmentEntity) {
                setIsLoadingEquipments(true);
                try {
                    const res = await fetch(`http://localhost:3001/api/entities/${equipmentEntity.id}/records`, { credentials: 'include' });
                    const data = await res.json();
                    setEquipmentRecords(data);
                } catch (error) {
                    console.error('Error fetching equipment records:', error);
                    setEquipmentRecords([]);
                } finally {
                    setIsLoadingEquipments(false);
                }
            } else {
                alert('No "Equipment" entity found. Please create one first.');
                setEquipmentRecords([]);
            }
        }
    };

    const saveEquipmentConfig = () => {
        if (!configuringEquipmentNodeId || !selectedEquipmentId) return;

        const record = equipmentRecords.find(r => r.id === selectedEquipmentId);

        // Find the Equipment entity to understand the schema
        const equipmentEntity = entities.find(e =>
            e.name.toLowerCase() === 'equipment' ||
            e.name.toLowerCase() === 'equipments'
        );

        let recordName = 'Unknown Equipment';

        if (record && equipmentEntity) {
            // 1. Try to find a property named "name" or "title"
            const nameProp = equipmentEntity.properties.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
            if (nameProp && record.values[nameProp.id]) {
                recordName = record.values[nameProp.id];
            } else {
                // 2. Fallback to the first "text" property
                const firstTextProp = equipmentEntity.properties.find(p => p.type === 'text');
                if (firstTextProp && record.values[firstTextProp.id]) {
                    recordName = record.values[firstTextProp.id];
                } else {
                    // 3. Fallback to ID
                    recordName = record.id;
                }
            }
        } else if (record) {
            recordName = record.id;
        }

        setNodes(prev => prev.map(n =>
            n.id === configuringEquipmentNodeId
                ? { ...n, label: recordName, config: { ...n.config, recordId: selectedEquipmentId, recordName } }
                : n
        ));
        setConfiguringEquipmentNodeId(null);
        setSelectedEquipmentId('');
        setEquipmentRecords([]);
    };

    const openLLMConfig = (nodeId: string) => {
        setConfiguringLLMNodeId(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setLlmPrompt(node.config?.llmPrompt || '');
            setLlmContextEntities(node.config?.llmContextEntities || []);
            setLlmIncludeInput(node.config?.llmIncludeInput !== undefined ? node.config.llmIncludeInput : true);
        }
    };

    const saveLLMConfig = () => {
        if (!configuringLLMNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringLLMNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        llmPrompt,
                        llmContextEntities,
                        llmIncludeInput
                    }
                }
                : n
        ));
        setConfiguringLLMNodeId(null);
        setLlmPrompt('');
        setLlmContextEntities([]);
        setLlmIncludeInput(true);
    };

    const openPythonConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setPythonCode(node.config?.pythonCode || 'def process(data):\n    # Modify data here\n    return data');
            setPythonAiPrompt(node.config?.pythonAiPrompt || '');
            setConfiguringPythonNodeId(nodeId);
        }
    };

    const savePythonConfig = () => {
        if (configuringPythonNodeId) {
            setNodes(nodes.map(n => n.id === configuringPythonNodeId ? {
                ...n,
                config: { ...n.config, pythonCode, pythonAiPrompt }
            } : n));
            setConfiguringPythonNodeId(null);
        }
    };

    const openManualInputConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'manualInput') {
            setConfiguringManualInputNodeId(nodeId);
            setManualInputVarName(node.config?.inputVarName || '');
            setManualInputVarValue(node.config?.inputVarValue || '');
        }
    };

    const saveManualInputConfig = () => {
        if (!configuringManualInputNodeId || !manualInputVarName.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringManualInputNodeId
                ? {
                    ...n,
                    label: `${manualInputVarName}: ${manualInputVarValue}`,
                    config: {
                        ...n.config,
                        inputVarName: manualInputVarName,
                        inputVarValue: manualInputVarValue
                    }
                }
                : n
        ));
        setConfiguringManualInputNodeId(null);
        setManualInputVarName('');
        setManualInputVarValue('');
    };

    const openHttpConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'http') {
            setConfiguringHttpNodeId(nodeId);
            setHttpUrl(node.config?.httpUrl || '');
        }
    };

    const saveHttpConfig = () => {
        if (!configuringHttpNodeId || !httpUrl.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringHttpNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        httpUrl
                    }
                }
                : n
        ));
        setConfiguringHttpNodeId(null);
        setHttpUrl('');
    };

    const generatePythonCode = async () => {
        if (!pythonAiPrompt.trim()) return;

        setIsGeneratingCode(true);
        try {
            const response = await fetch('http://localhost:3001/api/python/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: pythonAiPrompt }),
                credentials: 'include'
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse JSON:', text);
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate code');
            }

            setPythonCode(data.code);
        } catch (error) {
            console.error('Error generating python code:', error);
            alert(`Failed to generate code: ${error.message}`);
        } finally {
            setIsGeneratingCode(false);
        }
    };


    const executeNode = async (nodeId: string, inputData: any = null, recursive: boolean = true) => {
        // Use a ref or get the latest node from the state setter to ensure we have the latest config?
        // For now, using 'nodes' from closure is fine for config, but we must be careful about 'status' checks if we needed them.
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Set to running
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'running' as const, inputData } : n
        ));

        //Simulate work
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Set result based on type
        let result = '';
        let nodeData: any = null;
        let conditionResult: boolean | undefined = undefined;

        if (node.type === 'fetchData') {
            if (!node.config?.entityId) {
                result = 'Error: No entity configured';
                setNodes(prev => prev.map(n =>
                    n.id === nodeId ? { ...n, status: 'error' as const, executionResult: result } : n
                ));
                return;
            }

            try {
                const res = await fetch(`http://localhost:3001/api/entities/${node.config.entityId}/records`, { credentials: 'include' });
                const records = await res.json();

                // Flatten data using entity schema
                const entity = entities.find(e => e.id === node.config?.entityId);
                nodeData = records.map((record: any) => {
                    const flattened: any = {
                        id: record.id,
                        createdAt: record.createdAt
                    };

                    if (record.values) {
                        Object.entries(record.values).forEach(([propId, value]) => {
                            if (entity) {
                                const prop = entity.properties.find((p: any) => p.id === propId);
                                flattened[prop ? prop.name : propId] = value;
                            } else {
                                flattened[propId] = value;
                            }
                        });
                    }
                    return flattened;
                });

                result = `Fetched ${records.length} records from ${node.config.entityName}`;
            } catch (error) {
                result = 'Error fetching data';
                setNodes(prev => prev.map(n =>
                    n.id === nodeId ? { ...n, status: 'error' as const, executionResult: result } : n
                ));
                return;
            }
        } else if (node.type === 'equipment') {
            if (!node.config?.recordId) {
                result = 'Error: No equipment selected';
                setNodes(prev => prev.map(n =>
                    n.id === nodeId ? { ...n, status: 'error' as const, executionResult: result } : n
                ));
                return;
            }

            try {
                const equipmentEntity = entities.find(e =>
                    e.name.toLowerCase() === 'equipment' ||
                    e.name.toLowerCase() === 'equipments'
                );

                if (!equipmentEntity) {
                    throw new Error('Equipment entity not found');
                }

                const res = await fetch(`http://localhost:3001/api/entities/${equipmentEntity.id}/records`, { credentials: 'include' });
                const records = await res.json();
                const record = records.find((r: any) => r.id === node.config?.recordId);

                if (record) {
                    nodeData = [record];
                    result = `Fetched equipment: ${node.config.recordName}`;
                } else {
                    result = 'Equipment record not found';
                    setNodes(prev => prev.map(n =>
                        n.id === nodeId ? { ...n, status: 'error' as const, executionResult: result } : n
                    ));
                    return;
                }
            } catch (error) {
                result = 'Error fetching equipment';
                setNodes(prev => prev.map(n =>
                    n.id === nodeId ? { ...n, status: 'error' as const, executionResult: result } : n
                ));
                return;
            }
        } else {
            switch (node.type) {
                case 'trigger':
                    result = 'Triggered!';
                    break;
                case 'action':
                    result = 'Action executed!';
                    break;
                case 'condition':
                    // Evaluate condition
                    if (node.config?.conditionField && node.config?.conditionOperator) {
                        const dataToEval = inputData;

                        if (dataToEval && Array.isArray(dataToEval) && dataToEval.length > 0) {
                            const record = dataToEval[0];
                            const fieldValue = record[node.config.conditionField];
                            let condResult = false;

                            switch (node.config.conditionOperator) {
                                case 'isText': condResult = typeof fieldValue === 'string'; break;
                                case 'isNumber': condResult = !isNaN(Number(fieldValue)); break;
                                case 'equals': condResult = String(fieldValue) === node.config.conditionValue; break;
                                case 'greaterThan': condResult = Number(fieldValue) > Number(node.config.conditionValue); break;
                                case 'lessThan': condResult = Number(fieldValue) < Number(node.config.conditionValue); break;
                            }

                            nodeData = dataToEval;
                            conditionResult = condResult;
                            result = `${node.config.conditionField} ${node.config.conditionOperator} → ${condResult ? '✓' : '✗'}`;
                        } else {
                            result = 'No data to evaluate';
                        }
                    } else {
                        result = 'Not configured';
                    }
                    break;
                case 'addField':
                    // Add field to all records
                    if (node.config?.conditionField && inputData && Array.isArray(inputData)) {
                        const fieldName = node.config.conditionField;
                        const fieldValue = node.config.conditionValue || '';

                        nodeData = inputData.map(record => ({
                            ...record,
                            [fieldName]: fieldValue
                        }));

                        result = `Added field "${fieldName}" = "${fieldValue}" to ${nodeData.length} records`;
                    } else {
                        result = 'Not configured or no data';
                    }
                    break;
                case 'saveRecords':
                    // Save records to entity
                    if (node.config?.entityId && inputData && Array.isArray(inputData)) {
                        try {
                            let savedCount = 0;
                            let failedCount = 0;

                            for (const record of inputData) {
                                // Remove id to let database generate it
                                const { id, ...recordWithoutId } = record;

                                const response = await fetch(`http://localhost:3001/api/entities/${node.config.entityId}/records`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(recordWithoutId),
                                    credentials: 'include'
                                });

                                if (response.ok) {
                                    savedCount++;
                                } else {
                                    failedCount++;
                                    console.error(`Failed to save record:`, record, await response.text());
                                }
                            }

                            nodeData = inputData;
                            result = failedCount > 0
                                ? `Saved ${savedCount}, Failed ${failedCount} to ${node.config.entityName}`
                                : `Saved ${savedCount} records to ${node.config.entityName}`;
                        } catch (error) {
                            console.error('Save records error:', error);
                            result = `Error: ${error.message || 'Failed to save'}`;
                        }
                    } else {
                        result = 'Not configured or no data';
                    }
                    break;
                case 'python':
                    if (node.config?.pythonCode) {
                        try {
                            const response = await fetch('http://localhost:3001/api/python/execute', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    code: node.config.pythonCode,
                                    inputData: inputData || []
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                nodeData = data.result;
                                result = 'Python code executed successfully';
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Python execution failed');
                            }
                        } catch (error) {
                            console.error('Python execution error:', error);
                            result = `Error: ${error.message || 'Failed to execute'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Code not configured';
                    }
                    break;
                case 'llm':
                    if (node.config?.llmPrompt) {
                        try {
                            const response = await fetch('http://localhost:3001/api/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    prompt: node.config.llmPrompt,
                                    mentionedEntityIds: node.config.llmContextEntities || [],
                                    additionalContext: node.config.llmIncludeInput ? inputData : undefined
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                nodeData = [{ result: data.response }]; // Store as a record-like object
                                result = 'Generated text successfully';
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to generate text');
                            }
                        } catch (error) {
                            console.error('LLM generation error:', error);
                            result = `Error: ${error.message || 'Failed to generate'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Prompt not configured';
                    }
                    break;
                case 'manualInput':
                    // Create output data from the configured variable
                    if (node.config?.inputVarName) {
                        const varName = node.config.inputVarName;
                        const varValue = node.config.inputVarValue || '';
                        // Try to parse as number if possible
                        const parsedValue = !isNaN(Number(varValue)) && varValue.trim() !== ''
                            ? Number(varValue)
                            : varValue;
                        nodeData = [{ [varName]: parsedValue }];
                        result = `Set ${varName} = ${parsedValue}`;
                    } else {
                        result = 'Not configured';
                    }
                    break;
                case 'http':
                    if (node.config?.httpUrl) {
                        try {
                            const response = await fetch('http://localhost:3001/api/proxy', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: node.config.httpUrl,
                                    method: 'GET'
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                // Ensure output is an array of objects if possible, for compatibility
                                if (Array.isArray(data)) {
                                    nodeData = data;
                                } else if (typeof data === 'object') {
                                    nodeData = [data];
                                } else {
                                    nodeData = [{ result: data }];
                                }
                                result = `Fetched from ${node.config.httpUrl}`;
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Request failed');
                            }
                        } catch (error) {
                            console.error('HTTP request error:', error);
                            result = `Error: ${error.message || 'Failed to fetch'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'URL not configured';
                    }
                    break;
                case 'output':
                    // Output node just displays the input data
                    if (inputData && Array.isArray(inputData) && inputData.length > 0) {
                        nodeData = inputData;
                        result = `Received ${inputData.length} record(s)`;
                    } else if (inputData) {
                        nodeData = [inputData];
                        result = 'Received data';
                    } else {
                        result = 'No input data';
                    }
                    break;
            }
        }

        // Set to completed
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'completed' as const, executionResult: result, data: nodeData, outputData: nodeData, conditionResult: conditionResult !== undefined ? conditionResult : n.conditionResult } : n
        ));

        if (recursive) {
            // Find and execute connected nodes
            const nextConnections = connections.filter(conn => conn.fromNodeId === nodeId);

            // For condition nodes, filter by outputType based on result
            const toExecute = node.type === 'condition' && conditionResult !== undefined
                ? nextConnections.filter(c => {
                    if (conditionResult) {
                        return !c.outputType || c.outputType === 'true';
                    } else {
                        return c.outputType === 'false';
                    }
                })
                : nextConnections;

            for (const conn of toExecute) {
                await executeNode(conn.toNodeId, nodeData);
            }
        }
    };

    const runWorkflow = async () => {
        if (isRunning) return;
        setIsRunning(true);

        // Reset all nodes to idle
        setNodes(prev => prev.map(n => ({ ...n, status: 'idle' as const, executionResult: undefined })));

        // Find trigger nodes (nodes with no incoming connections)
        const triggerNodes = nodes.filter(node =>
            !connections.some(conn => conn.toNodeId === node.id)
        );

        if (triggerNodes.length === 0) {
            alert('No trigger nodes found! Add a node without incoming connections.');
            setIsRunning(false);
            return;
        }

        // Execute all trigger nodes
        for (const trigger of triggerNodes) {
            await executeNode(trigger.id);
        }

        setIsRunning(false);
    };

    const handleRunNode = async (nodeId: string) => {
        if (isRunning) return;

        // Find input data from parent nodes if available
        const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
        let inputData = null;

        if (incomingConnections.length > 0) {
            // Use the data from the first connected parent that has output data
            // This is a simplification; in a real runner, we might need to wait for all or handle multiple inputs
            for (const conn of incomingConnections) {
                const parentNode = nodes.find(n => n.id === conn.fromNodeId);
                if (parentNode && parentNode.outputData) {
                    inputData = parentNode.outputData;
                    break;
                }
            }
        }

        await executeNode(nodeId, inputData, false);
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

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setCanvasZoom(prev => Math.min(Math.max(prev * delta, 0.25), 3));
    };

    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Panning logic (Middle mouse or Left mouse on canvas)
        if (e.button === 1 || (e.button === 0 && !draggingNodeId)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
            e.preventDefault();
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setCanvasOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        } else if (draggingNodeId) {
            // Node dragging logic
            if (!canvasRef.current) return;
            const canvasRect = canvasRef.current.getBoundingClientRect();

            // Calculate new position in canvas coordinates
            const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
            const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

            setNodes(prev => prev.map(n =>
                n.id === draggingNodeId
                    ? { ...n, x, y }
                    : n
            ));
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        setDraggingNodeId(null);
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        if (e.button === 0) { // Left click only
            e.stopPropagation(); // Prevent canvas panning
            setDraggingNodeId(nodeId);
        }
    };

    const resetView = () => {
        setCanvasOffset({ x: 0, y: 0 });
        setCanvasZoom(1);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingItem || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

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

    const [dragConnectionStart, setDragConnectionStart] = useState<{ nodeId: string, outputType?: 'true' | 'false', x: number, y: number } | null>(null);
    const [dragConnectionCurrent, setDragConnectionCurrent] = useState<{ x: number, y: number } | null>(null);

    const handleConnectorMouseDown = (e: React.MouseEvent, nodeId: string, outputType?: 'true' | 'false') => {
        e.stopPropagation();
        e.preventDefault();

        // Calculate start position relative to canvas
        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

        setDragConnectionStart({ nodeId, outputType, x, y });
        setDragConnectionCurrent({ x, y });
    };

    const handleConnectorMouseUp = (e: React.MouseEvent, targetNodeId: string) => {
        e.stopPropagation();
        e.preventDefault();

        if (dragConnectionStart && dragConnectionStart.nodeId !== targetNodeId) {
            // Complete connection
            let finalOutputType = dragConnectionStart.outputType;

            // If connecting from a condition node and no type was set, ask the user
            const fromNode = nodes.find(n => n.id === dragConnectionStart.nodeId);
            if (fromNode?.type === 'condition' && !finalOutputType) {
                const choice = window.confirm('Click OK for TRUE path, Cancel for FALSE path');
                finalOutputType = choice ? 'true' : 'false';
            }

            const newConnection: Connection = {
                id: crypto.randomUUID(),
                fromNodeId: dragConnectionStart.nodeId,
                toNodeId: targetNodeId,
                outputType: finalOutputType
            };
            setConnections(prev => [...prev, newConnection]);
        }

        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    };

    const getNodeColor = (type: string, status?: string) => {
        if (status === 'running') return 'bg-yellow-100 border-yellow-400 text-yellow-900 animate-pulse';
        if (status === 'completed') return 'bg-green-100 border-green-400 text-green-900';
        if (status === 'error') return 'bg-red-100 border-red-400 text-red-900';

        switch (type) {
            case 'trigger': return 'bg-purple-100 border-purple-300 text-purple-800';
            case 'action': return 'bg-blue-100 border-blue-300 text-blue-800';
            case 'condition': return 'bg-amber-100 border-amber-300 text-amber-800';
            case 'fetchData': return 'bg-teal-100 border-teal-300 text-teal-800';
            case 'equipment': return 'bg-orange-100 border-orange-300 text-orange-800';
            case 'addField': return 'bg-indigo-100 border-indigo-300 text-indigo-800';
            case 'saveRecords': return 'bg-emerald-100 border-emerald-300 text-emerald-800';
            case 'llm': return 'bg-violet-100 border-violet-300 text-violet-800';
            case 'comment': return 'bg-amber-50 border-amber-200 text-amber-900';
            default: return 'bg-slate-100 border-slate-300';
        }
    };

    const filteredItems = DRAGGABLE_ITEMS.filter(item => {
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex h-full bg-slate-50">
            {/* Sidebar */}
            <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shadow-sm z-10 h-full">
                <div className="p-4 border-b border-slate-200 bg-white">
                    <h2 className="text-lg font-bold text-slate-800 mb-1">Components</h2>
                    <p className="text-xs text-slate-500 mb-4">Drag & Drop</p>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                    </div>

                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['All', 'Triggers', 'Data', 'Logic', 'Actions', 'Other'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                                    ? 'bg-teal-100 text-teal-700 border border-teal-200'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {filteredItems.map((item) => (
                        <div
                            key={item.label}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            className="flex items-start p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab hover:border-teal-500 hover:shadow-md transition-all group"
                        >
                            <div className={`p-2 rounded-lg mr-3 ${item.category === 'Triggers' ? 'bg-purple-100 text-purple-600' :
                                item.category === 'Data' ? 'bg-teal-100 text-teal-600' :
                                    item.category === 'Logic' ? 'bg-amber-100 text-amber-600' :
                                        'bg-blue-100 text-blue-600'
                                }`}>
                                <item.icon size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">{item.label}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="absolute top-4 left-4 right-8 z-10 flex items-center gap-4">
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
                            className="flex items-center px-4 py-2 bg-slate-800 border-none text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
                        >
                            {isSaving ? <span className="animate-spin mr-2">⟳</span> : <Save size={16} className="mr-2" />}
                            Save
                        </button>
                        <button
                            onClick={runWorkflow}
                            disabled={isRunning || nodes.length === 0}
                            className={`flex items-center px-4 py-2 rounded-lg text-white shadow-sm transition-colors text-sm font-medium ${isRunning || nodes.length === 0
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-slate-900'
                                }`}
                        >
                            <PlayCircle size={16} className="mr-2" />
                            {isRunning ? 'Running...' : 'Run'}
                        </button>
                        <div className="ml-2 border-l border-slate-300 pl-4">
                            <ProfileMenu onNavigate={onViewChange} />
                        </div>
                    </div>
                </div>

                <div
                    ref={canvasRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onWheel={handleWheel}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="w-full h-full relative"
                    style={{ cursor: isPanning ? 'grabbing' : 'default' }}
                >
                    {/* Zoom Controls */}
                    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
                        <button
                            onClick={() => setCanvasZoom(prev => Math.min(prev * 1.2, 3))}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm font-bold"
                            title="Zoom In"
                        >
                            +
                        </button>
                        <button
                            onClick={() => setCanvasZoom(prev => Math.max(prev / 1.2, 0.25))}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm font-bold"
                            title="Zoom Out"
                        >
                            −
                        </button>
                        <button
                            onClick={resetView}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm text-xs"
                            title="Reset View"
                        >
                            Reset
                        </button>
                        <div className="px-3 py-1 bg-white border border-slate-300 rounded-lg shadow-sm text-xs text-center">
                            {Math.round(canvasZoom * 100)}%
                        </div>
                    </div>

                    {/* Content with transform */}
                    <div style={{
                        transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
                        transformOrigin: '0 0',
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}>
                        {/* SVG Layer for Connections */}
                        <svg
                            className="absolute pointer-events-none"
                            style={{
                                zIndex: 1,
                                overflow: 'visible',
                                left: 0,
                                top: 0,
                                width: '10000px',
                                height: '10000px'
                            }}
                        >
                            {connections.map(conn => {
                                const fromNode = nodes.find(n => n.id === conn.fromNodeId);
                                const toNode = nodes.find(n => n.id === conn.toNodeId);
                                if (!fromNode || !toNode) return null;

                                // Calculate line positions (from right of fromNode to left of toNode)
                                const x1 = fromNode.x + 96; // Half width of node (192px / 2)
                                const y1 = fromNode.y;
                                const x2 = toNode.x - 96;
                                const y2 = toNode.y;

                                // Control points for Bezier curve
                                const c1x = x1 + Math.abs(x2 - x1) / 2;
                                const c1y = y1;
                                const c2x = x2 - Math.abs(x2 - x1) / 2;
                                const c2y = y2;

                                // Color based on outputType: green for true, red for false, teal for default
                                const strokeColor = conn.outputType === 'true' ? '#10b981'
                                    : conn.outputType === 'false' ? '#ef4444'
                                        : '#0d9488';

                                return (
                                    <path
                                        key={conn.id}
                                        d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                                        stroke={strokeColor}
                                        strokeWidth="2"
                                        fill="none"
                                        markerEnd="url(#workflow-arrowhead)"
                                    />
                                );
                            })}
                            {/* Arrow marker definition */}
                            <defs>
                                <marker
                                    id="workflow-arrowhead"
                                    markerWidth="6"
                                    markerHeight="6"
                                    refX="5"
                                    refY="3"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 6 3, 0 6" fill="#0d9488" />
                                </marker>
                            </defs>
                        </svg>

                        {nodes.map((node) => (
                            <div
                                key={node.id}

                                onClick={(e) => {
                                    // Don't trigger on connector points or delete button
                                    if ((e.target as HTMLElement).closest('.connector-point, button')) return;

                                    // Open config for configurable nodes
                                    if (node.type === 'fetchData') {
                                        openNodeConfig(node.id);
                                    } else if (node.type === 'condition') {
                                        openConditionConfig(node.id);
                                    } else if (node.type === 'addField') {
                                        openAddFieldConfig(node.id);
                                    } else if (node.type === 'saveRecords') {
                                        openSaveRecordsConfig(node.id);
                                    } else if (node.type === 'equipment') {
                                        openEquipmentConfig(node.id);
                                    } else if (node.type === 'llm') {
                                        openLLMConfig(node.id);
                                    } else if (node.type === 'python') {
                                        openPythonConfig(node.id);
                                    } else if (node.type === 'manualInput') {
                                        openManualInputConfig(node.id);
                                    } else if (node.type === 'http') {
                                        openHttpConfig(node.id);
                                    }
                                }}
                                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                style={{
                                    position: 'absolute',
                                    left: node.x,
                                    top: node.y,
                                    transform: 'translate(-50%, -50%)', // Center on drop point
                                    width: '192px', // Enforce fixed width (w-48)
                                    cursor: (node.data || ['fetchData', 'condition', 'addField', 'saveRecords', 'equipment', 'llm'].includes(node.type)) ? 'grab' : 'default'
                                }}
                                className={`flex flex-col p-3 rounded-lg border-2 shadow-md w-48 group relative ${getNodeColor(node.type, node.status)}`}
                            >
                                {/* Hover Action Buttons - Above Node */}
                                <div className="absolute -top-7 left-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-md shadow-sm border border-slate-200 p-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunNode(node.id);
                                        }}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-teal-600 transition-all"
                                        title="Run Node"
                                    >
                                        <Play size={12} fill="currentColor" />
                                    </button>
                                    {node.data && Array.isArray(node.data) && node.data.length > 0 && (
                                        <button
                                            onClick={() => setViewingDataNodeId(node.id)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800 transition-all"
                                            title="View Data"
                                        >
                                            <Database size={12} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => removeNode(node.id)}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-red-500 transition-all"
                                        title="Delete Node"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>

                                {/* Node Content */}
                                {node.type === 'comment' ? (
                                    /* Comment Node Special Layout */
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                A
                                            </div>
                                            <span className="text-xs text-slate-500">Comment</span>
                                        </div>
                                        <textarea
                                            value={node.config?.commentText || ''}
                                            onChange={(e) => {
                                                const newText = e.target.value;
                                                setNodes(prev => prev.map(n =>
                                                    n.id === node.id
                                                        ? { ...n, config: { ...n.config, commentText: newText } }
                                                        : n
                                                ));
                                            }}
                                            placeholder="Write a comment..."
                                            className="w-full p-2 text-xs bg-transparent border-none resize-none focus:outline-none text-slate-700 min-h-[40px]"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                ) : (
                                    /* Regular Node Layout */
                                    <>
                                        <div className="flex items-center">
                                            <div className="flex-1 font-medium text-sm truncate" title={node.label}>{node.label}</div>
                                            {node.status === 'completed' && <Check size={16} className="text-green-600 flex-shrink-0 ml-1" />}
                                            {node.status === 'error' && <XCircle size={16} className="text-red-600 flex-shrink-0 ml-1" />}
                                            {node.status === 'running' && <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin ml-1" />}
                                        </div>

                                        {node.executionResult && (
                                            <div className="mt-2 text-xs italic opacity-75">
                                                {node.executionResult}
                                            </div>
                                        )}
                                    </>
                                )}

                                {node.type === 'fetchData' && node.config?.entityName && (
                                    <div className="mt-2 text-xs font-medium text-teal-700">
                                        Entity: {node.config.entityName}
                                        {node.data && (
                                            <span className="ml-2 text-green-600">({node.data.length} records)</span>
                                        )}
                                    </div>
                                )}

                                {/* Connector Points - not for comment nodes */}
                                {node.type !== 'comment' && (
                                    <>
                                        <div
                                            onMouseDown={(e) => handleConnectorMouseDown(e, node.id)}
                                            onMouseUp={(e) => handleConnectorMouseUp(e, node.id)}
                                            className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full hover:border-teal-500 cursor-crosshair transition-all ${dragConnectionStart?.nodeId === node.id ? 'border-teal-500 scale-150' : 'border-slate-400'
                                                }`}
                                        />
                                        {node.type !== 'trigger' && (
                                            <div
                                                onMouseUp={(e) => handleConnectorMouseUp(e, node.id)}
                                                className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full hover:border-teal-500 cursor-crosshair transition-all border-slate-400`}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        ))}

                        {/* Temporary Connection Line */}
                        {dragConnectionStart && dragConnectionCurrent && (
                            <svg
                                className="absolute pointer-events-none"
                                style={{
                                    zIndex: 20,
                                    overflow: 'visible',
                                    left: 0,
                                    top: 0,
                                    width: '10000px',
                                    height: '10000px'
                                }}
                            >
                                <defs>
                                    <marker
                                        id="temp-arrowhead"
                                        markerWidth="10"
                                        markerHeight="7"
                                        refX="9"
                                        refY="3.5"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#0d9488" />
                                    </marker>
                                </defs>
                                <path
                                    d={`M ${nodes.find(n => n.id === dragConnectionStart.nodeId)!.x + 96} ${nodes.find(n => n.id === dragConnectionStart.nodeId)!.y} C ${nodes.find(n => n.id === dragConnectionStart.nodeId)!.x + 96 + 50} ${nodes.find(n => n.id === dragConnectionStart.nodeId)!.y}, ${dragConnectionCurrent.x - 50} ${dragConnectionCurrent.y}, ${dragConnectionCurrent.x} ${dragConnectionCurrent.y}`}
                                    stroke="#0d9488"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="5,5"
                                    markerEnd="url(#temp-arrowhead)"
                                />
                            </svg>
                        )}

                        {nodes.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center text-slate-400">
                                    <Workflow size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Drag components here</p>
                                </div>
                            </div>
                        )}
                    </div> {/* Close transform div */}
                </div> {/* Close canvas div */}

                {/* Configuration Modal */}
                {configuringNodeId && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfiguringNodeId(null)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Configure Fetch Data</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Select Entity
                                </label>
                                <select
                                    value={selectedEntityId}
                                    onChange={(e) => setSelectedEntityId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">Choose entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setConfiguringNodeId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveNodeConfig}
                                    disabled={!selectedEntityId}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HTTP Configuration Modal */}
                {configuringHttpNodeId && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfiguringHttpNodeId(null)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Configure HTTP Request</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    URL
                                </label>
                                <input
                                    type="text"
                                    value={httpUrl}
                                    onChange={(e) => setHttpUrl(e.target.value)}
                                    placeholder="https://api.example.com/data"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Enter the full URL to fetch data from (GET request).
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setConfiguringHttpNodeId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveHttpConfig}
                                    disabled={!httpUrl.trim()}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Preview Modal */}
                {viewingDataNodeId && (() => {
                    const node = nodes.find(n => n.id === viewingDataNodeId);
                    if (!node) return null;

                    const hasInput = node.inputData && Array.isArray(node.inputData) && node.inputData.length > 0;
                    const hasOutput = node.outputData && Array.isArray(node.outputData) && node.outputData.length > 0;

                    if (!hasInput && !hasOutput) return null;

                    return (
                        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewingDataNodeId(null)}>
                            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-800">
                                        {node.label} - Data Preview
                                    </h3>
                                    <button
                                        onClick={() => setViewingDataNodeId(null)}
                                        className="p-1 hover:bg-slate-100 rounded"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-2 mb-4 border-b">
                                    {hasInput && (
                                        <button
                                            onClick={() => setDataViewTab('input')}
                                            className={`px-4 py-2 font-medium transition-all ${dataViewTab === 'input'
                                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                                : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                        >
                                            Input ({node.inputData.length})
                                        </button>
                                    )}
                                    {hasOutput && (
                                        <button
                                            onClick={() => setDataViewTab('output')}
                                            className={`px-4 py-2 font-medium transition-all ${dataViewTab === 'output'
                                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                                : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                        >
                                            Output ({node.outputData.length})
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-auto flex-1">
                                    {(() => {
                                        const displayData = dataViewTab === 'input' ? node.inputData : node.outputData;
                                        return displayData && displayData.length > 0 ? (
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 sticky top-0">
                                                    <tr>
                                                        {Object.keys(displayData[0]).map(key => (
                                                            <th key={key} className="px-4 py-2 text-left font-semibold text-slate-700 border-b">
                                                                {key}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayData.map((record: any, idx: number) => (
                                                        <tr key={idx} className="border-b hover:bg-slate-50">
                                                            {Object.values(record).map((value: any, vidx: number) => (
                                                                <td key={vidx} className="px-4 py-2">
                                                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-slate-500 text-center py-8">No data available</p>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Condition Configuration Modal */}
                {configuringConditionNodeId && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfiguringConditionNodeId(null)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Configure Condition</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Field Name
                                    </label>
                                    <input
                                        type="text"
                                        value={conditionField}
                                        onChange={(e) => setConditionField(e.target.value)}
                                        placeholder="e.g., status, price, name"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Operator
                                    </label>
                                    <select
                                        value={conditionOperator}
                                        onChange={(e) => setConditionOperator(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="isText">Is Text</option>
                                        <option value="isNumber">Is Number</option>
                                        <option value="equals">Equals</option>
                                        <option value="greaterThan">Greater Than</option>
                                        <option value="lessThan">Less Than</option>
                                    </select>
                                </div>
                                {['equals', 'greaterThan', 'lessThan'].includes(conditionOperator) && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Value
                                        </label>
                                        <input
                                            type="text"
                                            value={conditionValue}
                                            onChange={(e) => setConditionValue(e.target.value)}
                                            placeholder="Comparison value"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    onClick={() => setConfiguringConditionNodeId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveConditionConfig}
                                    disabled={!conditionField}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Field Configuration Modal */}
                {configuringAddFieldNodeId && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfiguringAddFieldNodeId(null)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Add Field to Records</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Field Name
                                    </label>
                                    <input
                                        type="text"
                                        value={addFieldName}
                                        onChange={(e) => setAddFieldName(e.target.value)}
                                        placeholder="e.g., Nombre, Category"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Field Value
                                    </label>
                                    <input
                                        type="text"
                                        value={addFieldValue}
                                        onChange={(e) => setAddFieldValue(e.target.value)}
                                        placeholder="e.g., Albert, Active"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    onClick={() => setConfiguringAddFieldNodeId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveAddFieldConfig}
                                    disabled={!addFieldName}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save Records Configuration Modal */}
                {configuringSaveNodeId && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfiguringSaveNodeId(null)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Save Records to Entity</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Select Entity
                                </label>
                                <select
                                    value={saveEntityId}
                                    onChange={(e) => setSaveEntityId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">Choose entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setConfiguringSaveNodeId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveSaveRecordsConfig}
                                    disabled={!saveEntityId}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Equipment Config Modal */}
            {configuringEquipmentNodeId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Select Equipment</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Equipment Record
                            </label>
                            {isLoadingEquipments ? (
                                <div className="text-sm text-slate-500">Loading equipments...</div>
                            ) : equipmentRecords.length > 0 ? (
                                <select
                                    value={selectedEquipmentId}
                                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                >
                                    <option value="">Select an equipment...</option>
                                    {equipmentRecords.map(record => {
                                        // Find the Equipment entity to understand the schema
                                        const equipmentEntity = entities.find(e =>
                                            e.name.toLowerCase() === 'equipment' ||
                                            e.name.toLowerCase() === 'equipments'
                                        );

                                        let name = record.id;
                                        if (equipmentEntity) {
                                            const nameProp = equipmentEntity.properties.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
                                            if (nameProp && record.values[nameProp.id]) {
                                                name = record.values[nameProp.id];
                                            } else {
                                                const firstTextProp = equipmentEntity.properties.find(p => p.type === 'text');
                                                if (firstTextProp && record.values[firstTextProp.id]) {
                                                    name = record.values[firstTextProp.id];
                                                }
                                            }
                                        } else {
                                            // Fallback if entity not found (shouldn't happen given the check above)
                                            const firstVal = Object.values(record.values || {}).find(v => typeof v === 'string');
                                            if (firstVal) name = firstVal as string;
                                        }

                                        return (
                                            <option key={record.id} value={record.id}>
                                                {String(name)}
                                            </option>
                                        );
                                    })}
                                </select>
                            ) : (
                                <div className="text-sm text-red-500">
                                    No equipment records found. Please create an "Equipment" entity and add records.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfiguringEquipmentNodeId(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveEquipmentConfig}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                disabled={!selectedEquipmentId}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LLM Config Modal */}
            {configuringLLMNodeId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Configure AI Generation</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Prompt
                                </label>
                                <div className="h-48">
                                    <PromptInput
                                        entities={entities}
                                        onGenerate={() => { }} // Not used here
                                        isGenerating={false}
                                        initialValue={llmPrompt}
                                        placeholder="Ask a question... Use @ to mention entities or Input Data."
                                        hideButton={true}
                                        onChange={(val, ids) => {
                                            setLlmPrompt(val);
                                            setLlmContextEntities(ids);
                                            // Auto-enable include input if @Input Data is mentioned
                                            if (val.includes('@Input Data')) {
                                                setLlmIncludeInput(true);
                                            }
                                        }}
                                        className="h-full"
                                        inputData={(() => {
                                            // Get input data from parent node
                                            const parentConnection = connections.find(c => c.toNodeId === configuringLLMNodeId);
                                            if (parentConnection) {
                                                const parentNode = nodes.find(n => n.id === parentConnection.fromNodeId);
                                                return parentNode?.outputData || parentNode?.data || [];
                                            }
                                            return [];
                                        })()}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    id="includeInput"
                                    checked={llmIncludeInput}
                                    onChange={(e) => setLlmIncludeInput(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="includeInput" className="text-sm text-slate-700 cursor-pointer">
                                    Include Input Data (from previous node)
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setConfiguringLLMNodeId(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveLLMConfig}
                                disabled={!llmPrompt.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Python Config Modal */}
            {configuringPythonNodeId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-[600px] max-w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Code className="text-indigo-600" />
                            Configure Python Code
                        </h3>

                        <div className="space-y-4">
                            {/* AI Assistant Section */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                    <Sparkles size={14} className="text-indigo-500" />
                                    Ask AI to write code
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={pythonAiPrompt}
                                        onChange={(e) => setPythonAiPrompt(e.target.value)}
                                        placeholder="e.g., Filter records where price > 100"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                                        onKeyDown={(e) => e.key === 'Enter' && generatePythonCode()}
                                    />
                                    <button
                                        onClick={generatePythonCode}
                                        disabled={isGeneratingCode || !pythonAiPrompt.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap flex items-center gap-2"
                                    >
                                        {isGeneratingCode ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={14} />
                                                Generate
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Code Editor */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Python Code
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={pythonCode}
                                        onChange={(e) => setPythonCode(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-900 text-slate-50 font-mono text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-64 resize-none"
                                        spellCheck={false}
                                    />
                                    <div className="absolute top-2 right-2 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                        Python 3
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Function must be named <code>process(data)</code> and return a list.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setConfiguringPythonNodeId(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={savePythonConfig}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Input Config Modal */}
            {configuringManualInputNodeId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Edit className="text-teal-600" size={20} />
                            Configure Manual Data Input
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Variable Name
                                </label>
                                <input
                                    type="text"
                                    value={manualInputVarName}
                                    onChange={(e) => setManualInputVarName(e.target.value)}
                                    placeholder="e.g., temperature, count, status"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Value
                                </label>
                                <input
                                    type="text"
                                    value={manualInputVarValue}
                                    onChange={(e) => setManualInputVarValue(e.target.value)}
                                    placeholder="e.g., 25, Active, Hello World"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Numbers will be parsed automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setConfiguringManualInputNodeId(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveManualInputConfig}
                                disabled={!manualInputVarName.trim()}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};
