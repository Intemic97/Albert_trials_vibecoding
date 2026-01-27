import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity } from '../types';
import { 
    Database, X, Plus, Trash2, Edit2, Save, Sparkles, ChevronRight, 
    ChevronDown, Search, Filter, BarChart3, TrendingUp, Settings, 
    Play, Copy, Check, AlertCircle, Info, Sliders, Zap, FileText,
    ArrowLeft, MoreVertical, Eye, EyeOff, Share2, ExternalLink, Loader2
} from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { API_BASE } from '../config';
import { AIPromptSection } from './AIPromptSection';

// Generate UUID
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface Simulation {
    id: string;
    name: string;
    description?: string;
    baseDatasetId?: string;
    baseDatasetName?: string;
    scenarios: Scenario[];
    createdAt: string;
    updatedAt: string;
}

interface Scenario {
    id: string;
    name: string;
    description?: string;
    variables: Record<string, any>;
    listItems: ListItem[];
    createdAt: string;
    updatedAt: string;
}

interface ListItem {
    id: string;
    label: string;
    value: any;
    type: 'number' | 'string' | 'boolean' | 'formula';
    formula?: string;
    metadata?: Record<string, any>;
}

interface SimulationsProps {
    entities: Entity[];
    onNavigate?: (entityId: string) => void;
}

export const Simulations: React.FC<SimulationsProps> = ({ entities, onNavigate }) => {
    const { simulationId, scenarioId } = useParams();
    const navigate = useNavigate();
    
    const [simulations, setSimulations] = useState<Simulation[]>([]);
    const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(simulationId || null);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(scenarioId || null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [showCreateSimulationModal, setShowCreateSimulationModal] = useState(false);
    const [showCreateScenarioModal, setShowCreateScenarioModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    
    // Create simulation form
    const [newSimulationName, setNewSimulationName] = useState('');
    const [newSimulationDescription, setNewSimulationDescription] = useState('');
    const [selectedBaseDataset, setSelectedBaseDataset] = useState<string>('');
    
    // Create scenario form
    const [newScenarioName, setNewScenarioName] = useState('');
    const [newScenarioDescription, setNewScenarioDescription] = useState('');
    
    // List item management
    const [editingListItemId, setEditingListItemId] = useState<string | null>(null);
    const [isGeneratingList, setIsGeneratingList] = useState(false);
    
    const selectedSimulation = simulations.find(s => s.id === selectedSimulationId);
    const selectedScenario = selectedSimulation?.scenarios.find(s => s.id === selectedScenarioId);

    // Fetch simulations on mount
    useEffect(() => {
        fetchSimulations();
    }, []);

    // Sync URL params
    useEffect(() => {
        if (simulationId) {
            setSelectedSimulationId(simulationId);
        } else {
            setSelectedSimulationId(null);
        }
        if (scenarioId) {
            setSelectedScenarioId(scenarioId);
        } else {
            setSelectedScenarioId(null);
        }
    }, [simulationId, scenarioId]);
    
    // Refresh simulations when URL changes
    useEffect(() => {
        fetchSimulations();
    }, [simulationId, scenarioId]);

    // Mock data fallback
    const getMockSimulations = (): Simulation[] => {
        return [
            {
                id: 'mock-1',
                name: 'Production Optimization',
                description: 'What-if analysis for production efficiency',
                baseDatasetId: entities[0]?.id,
                baseDatasetName: entities[0]?.name || 'Production Data',
                scenarios: [
                    {
                        id: 'mock-scenario-1',
                        name: 'Baseline Scenario',
                        description: 'Current production parameters',
                        variables: {},
                        listItems: [
                            { id: 'item-1', label: 'Production Rate', value: 100, type: 'number' },
                            { id: 'item-2', label: 'Efficiency', value: 85, type: 'number' },
                            { id: 'item-3', label: 'Quality Score', value: 92, type: 'number' }
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    {
                        id: 'mock-scenario-2',
                        name: 'Optimized Scenario',
                        description: 'Improved production parameters',
                        variables: {},
                        listItems: [
                            { id: 'item-4', label: 'Production Rate', value: 120, type: 'number' },
                            { id: 'item-5', label: 'Efficiency', value: 92, type: 'number' },
                            { id: 'item-6', label: 'Quality Score', value: 95, type: 'number' }
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'mock-2',
                name: 'Energy Cost Analysis',
                description: 'Simulate different energy consumption scenarios',
                baseDatasetId: entities[1]?.id,
                baseDatasetName: entities[1]?.name || 'Energy Data',
                scenarios: [
                    {
                        id: 'mock-scenario-3',
                        name: 'Current Consumption',
                        description: 'Baseline energy usage',
                        variables: {},
                        listItems: [
                            { id: 'item-7', label: 'Monthly kWh', value: 5000, type: 'number' },
                            { id: 'item-8', label: 'Cost per kWh', value: 0.12, type: 'number' },
                            { id: 'item-9', label: 'Total Cost', value: 600, type: 'formula', formula: 'Monthly kWh * Cost per kWh' }
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    };

    const fetchSimulations = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`${API_BASE}/simulations`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setSimulations(Array.isArray(data) ? data : []);
            } else {
                console.warn('Failed to fetch simulations, using mock data:', res.status);
                // Use mock data as fallback
                setSimulations(getMockSimulations());
            }
        } catch (error) {
            console.warn('Error fetching simulations, using mock data:', error);
            // Use mock data as fallback
            setSimulations(getMockSimulations());
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSimulation = async () => {
        if (!newSimulationName.trim()) {
            alert('Please enter a simulation name');
            return;
        }

        try {
            const simulation: Simulation = {
                id: generateUUID(),
                name: newSimulationName.trim(),
                description: newSimulationDescription.trim() || undefined,
                baseDatasetId: selectedBaseDataset || undefined,
                baseDatasetName: selectedBaseDataset ? entities.find(e => e.id === selectedBaseDataset)?.name : undefined,
                scenarios: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/simulations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(simulation)
            });

            if (res.ok) {
                const created = await res.json();
                // Refresh simulations to get latest data with scenarios
                await fetchSimulations();
                setSelectedSimulationId(created.id);
                navigate(`/simulations/${created.id}`);
                setShowCreateSimulationModal(false);
                setNewSimulationName('');
                setNewSimulationDescription('');
                setSelectedBaseDataset('');
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to create simulation');
            }
        } catch (error) {
            console.error('Error creating simulation:', error);
            alert('Failed to create simulation');
        }
    };

    const handleCreateScenario = async () => {
        if (!newScenarioName.trim() || !selectedSimulationId) {
            alert('Please enter a scenario name');
            return;
        }

        try {
            const scenario: Scenario = {
                id: generateUUID(),
                name: newScenarioName.trim(),
                description: newScenarioDescription.trim() || undefined,
                variables: {},
                listItems: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/simulations/${selectedSimulationId}/scenarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(scenario)
            });

            if (res.ok) {
                const updated = await res.json();
                // Refresh simulations to get latest data
                await fetchSimulations();
                setSelectedScenarioId(scenario.id);
                navigate(`/simulations/${selectedSimulationId}/scenarios/${scenario.id}`);
                setShowCreateScenarioModal(false);
                setNewScenarioName('');
                setNewScenarioDescription('');
            } else {
                // If API fails, add to local state
                console.warn('API failed, adding scenario to local state');
                setSimulations(prev => prev.map(sim => 
                    sim.id === selectedSimulationId 
                        ? { ...sim, scenarios: [...sim.scenarios, scenario] }
                        : sim
                ));
                setSelectedScenarioId(scenario.id);
                navigate(`/simulations/${selectedSimulationId}/scenarios/${scenario.id}`);
                setShowCreateScenarioModal(false);
                setNewScenarioName('');
                setNewScenarioDescription('');
            }
        } catch (error) {
            console.warn('Error creating scenario, adding to local state:', error);
            // Add to local state if API fails
            setSimulations(prev => prev.map(sim => 
                sim.id === selectedSimulationId 
                    ? { ...sim, scenarios: [...sim.scenarios, scenario] }
                    : sim
            ));
            setSelectedScenarioId(scenario.id);
            navigate(`/simulations/${selectedSimulationId}/scenarios/${scenario.id}`);
            setShowCreateScenarioModal(false);
            setNewScenarioName('');
            setNewScenarioDescription('');
        }
    };

    const handleDeleteSimulation = async (id: string) => {
        if (!confirm('Are you sure you want to delete this simulation?')) return;

        try {
            const res = await fetch(`${API_BASE}/simulations/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                // Refresh simulations
                await fetchSimulations();
                if (selectedSimulationId === id) {
                    setSelectedSimulationId(null);
                    navigate('/simulations');
                }
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to delete simulation');
            }
        } catch (error) {
            console.error('Error deleting simulation:', error);
        }
    };

    const handleDeleteScenario = async (scenarioId: string) => {
        if (!confirm('Are you sure you want to delete this scenario?')) return;

        try {
            const res = await fetch(`${API_BASE}/simulations/${selectedSimulationId}/scenarios/${scenarioId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                // Refresh simulations
                await fetchSimulations();
                if (selectedScenarioId === scenarioId) {
                    setSelectedScenarioId(null);
                    navigate(`/simulations/${selectedSimulationId}`);
                }
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to delete scenario');
            }
        } catch (error) {
            console.error('Error deleting scenario:', error);
        }
    };

    const handleAddListItem = () => {
        if (!selectedSimulationId || !selectedScenarioId) return;

        const newItem: ListItem = {
            id: generateUUID(),
            label: 'New Item',
            value: 0,
            type: 'number'
        };

        updateScenarioListItems([...selectedScenario!.listItems, newItem]);
    };

    const handleUpdateListItem = (itemId: string, updates: Partial<ListItem>) => {
        if (!selectedSimulationId || !selectedScenarioId) return;

        const updatedItems = selectedScenario!.listItems.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
        );
        updateScenarioListItems(updatedItems);
    };

    const handleDeleteListItem = (itemId: string) => {
        if (!selectedSimulationId || !selectedScenarioId) return;

        const updatedItems = selectedScenario!.listItems.filter(item => item.id !== itemId);
        updateScenarioListItems(updatedItems);
    };

    const updateScenarioListItems = async (items: ListItem[]) => {
        if (!selectedSimulationId || !selectedScenarioId) return;

        try {
            const updatedScenario = {
                ...selectedScenario!,
                listItems: items,
                updatedAt: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/simulations/${selectedSimulationId}/scenarios/${selectedScenarioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedScenario)
            });

            if (res.ok) {
                const updated = await res.json();
                // Refresh simulations to get latest data
                await fetchSimulations();
            } else {
                const errorData = await res.json();
                console.error('Error updating list items:', errorData);
                alert(errorData.error || 'Failed to update list items');
            }
        } catch (error) {
            console.error('Error updating list items:', error);
            alert('Failed to update list items');
        }
    };

    const handleGenerateListWithLLM = async (prompt: string) => {
        if (!selectedSimulationId || !selectedScenarioId) return;

        setIsGeneratingList(true);
        try {
            const res = await fetch(`${API_BASE}/simulations/${selectedSimulationId}/scenarios/${selectedScenarioId}/generate-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    prompt,
                    baseDataset: selectedSimulation?.baseDatasetId,
                    context: selectedScenario?.description
                })
            });

            if (res.ok) {
                const { items } = await res.json();
                const newItems: ListItem[] = items.map((item: any) => ({
                    id: generateUUID(),
                    label: item.label || 'Item',
                    value: item.value ?? 0,
                    type: item.type || 'number',
                    formula: item.formula,
                    metadata: item.metadata
                }));

                updateScenarioListItems([...selectedScenario!.listItems, ...newItems]);
            } else {
                alert('Failed to generate list items');
            }
        } catch (error) {
            console.error('Error generating list:', error);
            alert('Failed to generate list items');
        } finally {
            setIsGeneratingList(false);
        }
    };

    const filteredSimulations = simulations.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-slate-50 relative">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                    <div>
                        <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Simulations</h1>
                        <p className="text-[11px] text-slate-500">Create what-if scenarios and analyze different outcomes</p>
                    </div>
                    <div />
                </header>
                <div className="flex-1 flex items-center justify-center min-h-0">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
            </div>
        );
    }

    // List view
    if (!selectedSimulationId) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-slate-50 relative">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                    <div>
                        <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Simulations</h1>
                        <p className="text-[11px] text-slate-500">Create what-if scenarios and analyze different outcomes</p>
                    </div>
                    <div />
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header Section */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>My Simulations</h2>
                                <p className="text-xs text-slate-500 mt-1">{simulations.length} simulation{simulations.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button
                                onClick={() => setShowCreateSimulationModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={14} />
                                New Simulation
                            </button>
                        </div>

                        {/* Search */}
                        {simulations.length > 0 && (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search simulations..."
                                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-1 focus:ring-slate-300 focus:border-slate-300 outline-none placeholder:text-slate-400 hover:border-slate-300 transition-colors"
                                />
                            </div>
                        )}

                        {/* Simulations Grid */}
                        <div>
                            {filteredSimulations.length === 0 ? (
                                <div className="bg-white rounded-lg border border-dashed border-slate-200 p-12 text-center">
                                    <Sliders size={48} className="mx-auto text-slate-300 mb-4" />
                                    <p className="text-slate-600 mt-4 text-sm font-medium">No simulations yet</p>
                                    <p className="text-slate-400 text-xs mt-1">Create your first simulation to start analyzing what-if scenarios</p>
                                    <button
                                        onClick={() => setShowCreateSimulationModal(true)}
                                        className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                                    >
                                        <Plus size={16} />
                                        Create Simulation
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredSimulations.map(simulation => (
                                        <div
                                            key={simulation.id}
                                            onClick={() => {
                                                setSelectedSimulationId(simulation.id);
                                                navigate(`/simulations/${simulation.id}`);
                                            }}
                                            className="group relative bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
                                        >
                                            {/* Delete button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSimulation(simulation.id);
                                                }}
                                                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                            {/* Header with icon and title */}
                                            <div className="flex items-start gap-3 pr-12 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
                                                    <Sliders size={20} className="text-slate-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-normal text-sm text-slate-900 group-hover:text-slate-700 transition-colors leading-tight" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                        {simulation.name}
                                                    </h3>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            {simulation.description && (
                                                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                                                    {simulation.description}
                                                </p>
                                            )}
                                            
                                            {/* Footer stats */}
                                            <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Database size={12} className="text-slate-400" />
                                                    <span className="font-medium text-slate-600">{simulation.scenarios.length}</span>
                                                    <span>scenario{simulation.scenarios.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                {simulation.baseDatasetName && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="truncate">{simulation.baseDatasetName}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Create Simulation Modal */}
                {showCreateSimulationModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => setShowCreateSimulationModal(false)}>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Sliders size={18} className="text-slate-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                            Create Simulation
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Create a new what-if analysis scenario</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateSimulationModal(false)}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            {/* Content */}
                            <div className="px-6 py-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newSimulationName}
                                        onChange={(e) => setNewSimulationName(e.target.value)}
                                        placeholder="My Simulation"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                                    <textarea
                                        value={newSimulationDescription}
                                        onChange={(e) => setNewSimulationDescription(e.target.value)}
                                        placeholder="Describe what this simulation analyzes..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none placeholder:text-slate-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Base Dataset</label>
                                    <select
                                        value={selectedBaseDataset}
                                        onChange={(e) => setSelectedBaseDataset(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                    >
                                        <option value="">None</option>
                                        {entities.map(entity => (
                                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        setShowCreateSimulationModal(false);
                                        setNewSimulationName('');
                                        setNewSimulationDescription('');
                                        setSelectedBaseDataset('');
                                    }}
                                    className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateSimulation}
                                    disabled={!newSimulationName.trim()}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Simulation
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Simulation detail view
    return (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-50 relative">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => {
                            setSelectedSimulationId(null);
                            setSelectedScenarioId(null);
                            navigate('/simulations');
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex-shrink-0"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-normal text-slate-900 truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                            {selectedSimulation?.name || 'Simulation'}
                        </h1>
                        {selectedSimulation?.description && (
                            <p className="text-[11px] text-slate-500 truncate">{selectedSimulation.description}</p>
                        )}
                    </div>
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                    >
                        <Share2 size={14} />
                        Share
                    </button>
                </div>
            </header>

            {/* Scenarios Tabs */}
            <div className="bg-white border-b border-slate-200 px-8 py-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {selectedSimulation?.scenarios.map(scenario => (
                        <button
                            key={scenario.id}
                            onClick={() => {
                                setSelectedScenarioId(scenario.id);
                                navigate(`/simulations/${selectedSimulationId}/scenarios/${scenario.id}`);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                                selectedScenarioId === scenario.id
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {scenario.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowCreateScenarioModal(true)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={14} />
                        New Scenario
                    </button>
                </div>
            </div>

            {/* Scenario Content */}
            {selectedScenarioId && selectedScenario ? (
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Scenario Header */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-lg font-normal text-slate-900 mb-1" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                        {selectedScenario.name}
                                    </h2>
                                    {selectedScenario.description && (
                                        <p className="text-sm text-slate-500">{selectedScenario.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteScenario(selectedScenarioId)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* List Items Section */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-normal text-slate-900 mb-1" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                        Configuration List
                                    </h3>
                                    <p className="text-xs text-slate-500">Configure items manually or generate with AI</p>
                                </div>
                                <button
                                    onClick={handleAddListItem}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Plus size={14} />
                                    Add Item
                                </button>
                            </div>

                            {/* AI Generation */}
                            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={14} className="text-slate-600" />
                                    <span className="text-sm font-medium text-slate-900">Generate with AI</span>
                                </div>
                                <AIPromptSection
                                    onSubmit={handleGenerateListWithLLM}
                                    placeholder="Describe the list items you want to generate... (e.g., 'Create a list of sales targets for Q1-Q4')"
                                    isLoading={isGeneratingList}
                                    buttonText="Generate List"
                                />
                            </div>

                            {/* List Items */}
                            <div className="space-y-3">
                                {selectedScenario.listItems.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
                                        <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-sm text-slate-600 font-medium mb-1">No items yet</p>
                                        <p className="text-xs text-slate-500">Add items manually or generate with AI</p>
                                    </div>
                                ) : (
                                    selectedScenario.listItems.map(item => (
                                        <ListItemEditor
                                            key={item.id}
                                            item={item}
                                            isEditing={editingListItemId === item.id}
                                            onEdit={() => setEditingListItemId(item.id)}
                                            onSave={(updates) => {
                                                handleUpdateListItem(item.id, updates);
                                                setEditingListItemId(null);
                                            }}
                                            onCancel={() => setEditingListItemId(null)}
                                            onDelete={() => handleDeleteListItem(item.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Variables Section */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <h3 className="text-base font-normal text-slate-900 mb-4" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                Variables
                            </h3>
                            <div className="text-sm text-slate-500">
                                Variables will be available for what-if analysis
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white rounded-lg border border-dashed border-slate-200 p-12 text-center">
                            <Sliders size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-600 mt-4 text-sm font-medium">No scenario selected</p>
                            <p className="text-slate-400 text-xs mt-1">Create a new scenario to get started</p>
                            <button
                                onClick={() => setShowCreateScenarioModal(true)}
                                className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                            >
                                <Plus size={16} />
                                Create Scenario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Scenario Modal */}
            {showCreateScenarioModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => setShowCreateScenarioModal(false)}>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Plus size={18} className="text-slate-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                        Create Scenario
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Add a new scenario to this simulation</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCreateScenarioModal(false);
                                        setNewScenarioName('');
                                        setNewScenarioDescription('');
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newScenarioName}
                                    onChange={(e) => setNewScenarioName(e.target.value)}
                                    placeholder="Optimistic Scenario"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                                <textarea
                                    value={newScenarioDescription}
                                    onChange={(e) => setNewScenarioDescription(e.target.value)}
                                    placeholder="Describe this scenario..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setShowCreateScenarioModal(false);
                                    setNewScenarioName('');
                                    setNewScenarioDescription('');
                                }}
                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateScenario}
                                disabled={!newScenarioName.trim()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Scenario
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// List Item Editor Component
interface ListItemEditorProps {
    item: ListItem;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (updates: Partial<ListItem>) => void;
    onCancel: () => void;
    onDelete: () => void;
}

const ListItemEditor: React.FC<ListItemEditorProps> = ({
    item,
    isEditing,
    onEdit,
    onSave,
    onCancel,
    onDelete
}) => {
    const [label, setLabel] = useState(item.label);
    const [value, setValue] = useState(item.value);
    const [type, setType] = useState(item.type);
    const [formula, setFormula] = useState(item.formula || '');

    useEffect(() => {
        if (isEditing) {
            setLabel(item.label);
            setValue(item.value);
            setType(item.type);
            setFormula(item.formula || '');
        }
    }, [isEditing, item]);

    const handleSave = () => {
        onSave({
            label,
            value: type === 'number' ? Number(value) : type === 'boolean' ? Boolean(value) : value,
            type,
            formula: type === 'formula' ? formula : undefined
        });
    };

    if (!isEditing) {
        return (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors group">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        {item.type === 'formula' ? `Formula: ${item.formula}` : `Value: ${String(item.value)}`}
                    </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={onEdit}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-lg border-2 border-slate-300 shadow-sm">
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as ListItem['type'])}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="number">Number</option>
                        <option value="string">String</option>
                        <option value="boolean">Boolean</option>
                        <option value="formula">Formula</option>
                    </select>
                </div>
                {type === 'formula' ? (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Formula</label>
                        <input
                            type="text"
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            placeholder="e.g., SUM(A1:A10)"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Value</label>
                        <input
                            type={type === 'number' ? 'number' : type === 'boolean' ? 'checkbox' : 'text'}
                            checked={type === 'boolean' ? Boolean(value) : undefined}
                            value={type !== 'boolean' ? String(value) : undefined}
                            onChange={(e) => {
                                if (type === 'boolean') {
                                    setValue(e.target.checked);
                                } else {
                                    setValue(e.target.value);
                                }
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                    </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
