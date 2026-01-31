import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entity, Property } from '../types';
import { 
    Database, X, Plus, Trash, PencilSimple, FloppyDisk, Sparkle, CaretRight, 
    CaretDown, MagnifyingGlass, Funnel, ChartBar, TrendUp, GearSix, 
    Play, Copy, Check, WarningCircle, Info, Sliders, Lightning, FileText,
    ArrowLeft, DotsThreeVertical, Eye, EyeSlash, Share, ArrowSquareOut, SpinnerGap,
    ArrowsLeftRight, Table, ChartLine, Percent, CurrencyDollar, Calculator,
    CheckCircle, Circle, CaretUp, Export, Download
} from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import { generateUUID } from '../utils/uuid';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    ComposedChart, ReferenceLine
} from 'recharts';

// ============================================================================
// TYPES - Nuevo modelo de datos para simulaciones reales
// ============================================================================

interface SourceEntity {
    entityId: string;
    entityName: string;
    alias: string;
    selectedColumns: string[]; // property IDs
}

interface SimulationVariable {
    id: string;
    name: string;
    sourceEntityAlias: string;
    columnId: string;
    columnName: string;
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
    baseValue: number; // Valor calculado del dataset
    unit?: string;
}

interface ScenarioModifier {
    variableId: string;
    modifierType: 'percentage' | 'absolute' | 'multiply';
    value: number;
}

interface Scenario {
    id: string;
    name: string;
    description?: string;
    color: string;
    modifiers: ScenarioModifier[];
    createdAt: string;
}

interface Simulation {
    id: string;
    name: string;
    description?: string;
    sourceEntities: SourceEntity[];
    variables: SimulationVariable[];
    scenarios: Scenario[];
    createdAt: string;
    updatedAt: string;
}

interface SimulationsProps {
    entities: Entity[];
    onNavigate?: (entityId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCENARIO_COLORS = [
    '#256A65', // Teal (base)
    '#3B82F6', // Blue
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#10B981', // Emerald
    '#EC4899', // Pink
    '#6366F1', // Indigo
];

const AGGREGATION_OPTIONS = [
    { value: 'sum', label: 'Suma', icon: Calculator },
    { value: 'avg', label: 'Promedio', icon: ChartLine },
    { value: 'min', label: 'Mínimo', icon: CaretDown },
    { value: 'max', label: 'Máximo', icon: CaretUp },
    { value: 'count', label: 'Conteo', icon: Table },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Simulations: React.FC<SimulationsProps> = ({ entities, onNavigate }) => {
    const { simulationId } = useParams();
    const navigate = useNavigate();
    
    // State
    const [simulations, setSimulations] = useState<Simulation[]>([]);
    const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(simulationId || null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Entity data cache
    const [entityDataCache, setEntityDataCache] = useState<Record<string, any[]>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);
    
    // Wizard state
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardData, setWizardData] = useState<Partial<Simulation>>({
        name: '',
        description: '',
        sourceEntities: [],
        variables: [],
        scenarios: []
    });
    
    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [showAddScenarioModal, setShowAddScenarioModal] = useState(false);
    const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
    
    // Sensitivity analysis
    const [sensitivityVariable, setSensitivityVariable] = useState<string | null>(null);
    const [sensitivityRange, setSensitivityRange] = useState({ min: -50, max: 50, steps: 10 });

    const selectedSimulation = simulations.find(s => s.id === selectedSimulationId);

    // ============================================================================
    // DATA FETCHING
    // ============================================================================

    useEffect(() => {
        fetchSimulations();
    }, []);

    useEffect(() => {
        if (simulationId) {
            setSelectedSimulationId(simulationId);
        }
    }, [simulationId]);

    // Load entity data when simulation is selected
    useEffect(() => {
        if (selectedSimulation) {
            loadEntityData(selectedSimulation.sourceEntities);
        }
    }, [selectedSimulation?.id]);

    const fetchSimulations = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`${API_BASE}/simulations`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                // Migrate old simulations to new format if needed
                const migrated = (Array.isArray(data) ? data : []).map(migrateSimulation);
                setSimulations(migrated);
            } else {
                setSimulations([]);
            }
        } catch (error) {
            console.error('Error fetching simulations:', error);
            setSimulations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const migrateSimulation = (sim: any): Simulation => {
        // If already in new format, return as-is
        if (sim.sourceEntities && sim.variables) {
            return sim;
        }
        // Convert old format to new
        return {
            id: sim.id,
            name: sim.name,
            description: sim.description,
            sourceEntities: [],
            variables: [],
            scenarios: (sim.scenarios || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                color: SCENARIO_COLORS[0],
                modifiers: [],
                createdAt: s.createdAt || new Date().toISOString()
            })),
            createdAt: sim.createdAt || new Date().toISOString(),
            updatedAt: sim.updatedAt || new Date().toISOString()
        };
    };

    const loadEntityData = async (sourceEntities: SourceEntity[]) => {
        setIsLoadingData(true);
        const newCache: Record<string, any[]> = {};
        
        for (const source of sourceEntities) {
            if (!entityDataCache[source.entityId]) {
                try {
                    const res = await fetch(`${API_BASE}/entities/${source.entityId}/records`, {
                        credentials: 'include'
                    });
                    if (res.ok) {
                        const data = await res.json();
                        newCache[source.entityId] = Array.isArray(data) ? data : [];
                    }
                } catch (error) {
                    console.error(`Error loading data for entity ${source.entityId}:`, error);
                    newCache[source.entityId] = [];
                }
            }
        }
        
        setEntityDataCache(prev => ({ ...prev, ...newCache }));
        setIsLoadingData(false);
    };

    const saveSimulation = async (simulation: Simulation) => {
        try {
            const res = await fetch(`${API_BASE}/simulations${simulation.id ? `/${simulation.id}` : ''}`, {
                method: simulation.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(simulation)
            });
            
            if (res.ok) {
                await fetchSimulations();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving simulation:', error);
            return false;
        }
    };

    const deleteSimulation = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta simulación?')) return;
        
        try {
            await fetch(`${API_BASE}/simulations/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchSimulations();
            if (selectedSimulationId === id) {
                setSelectedSimulationId(null);
                navigate('/simulations');
            }
        } catch (error) {
            console.error('Error deleting simulation:', error);
        }
    };

    // ============================================================================
    // CALCULATIONS
    // ============================================================================

    const calculateBaseValue = useCallback((
        variable: SimulationVariable,
        sourceEntities: SourceEntity[]
    ): number => {
        const source = sourceEntities.find(s => s.alias === variable.sourceEntityAlias);
        if (!source) return 0;
        
        const records = entityDataCache[source.entityId] || [];
        if (records.length === 0) return 0;
        
        const values = records
            .map(r => parseFloat(r.values?.[variable.columnId]) || 0)
            .filter(v => !isNaN(v));
        
        if (values.length === 0) return 0;
        
        switch (variable.aggregation) {
            case 'sum':
                return values.reduce((a, b) => a + b, 0);
            case 'avg':
                return values.reduce((a, b) => a + b, 0) / values.length;
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'count':
                return values.length;
            default:
                return 0;
        }
    }, [entityDataCache]);

    const calculateScenarioValue = useCallback((
        variable: SimulationVariable,
        scenario: Scenario
    ): number => {
        const modifier = scenario.modifiers.find(m => m.variableId === variable.id);
        if (!modifier) return variable.baseValue;
        
        switch (modifier.modifierType) {
            case 'percentage':
                return variable.baseValue * (1 + modifier.value / 100);
            case 'absolute':
                return variable.baseValue + modifier.value;
            case 'multiply':
                return variable.baseValue * modifier.value;
            default:
                return variable.baseValue;
        }
    }, []);

    const calculateSensitivityData = useCallback((
        variable: SimulationVariable,
        range: { min: number; max: number; steps: number }
    ) => {
        const step = (range.max - range.min) / range.steps;
        const data = [];
        
        for (let pct = range.min; pct <= range.max; pct += step) {
            const value = variable.baseValue * (1 + pct / 100);
            data.push({
                percentage: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`,
                pctValue: pct,
                value: value,
                baseValue: variable.baseValue
            });
        }
        
        return data;
    }, []);

    // ============================================================================
    // WIZARD HANDLERS
    // ============================================================================

    const handleWizardNext = () => {
        if (wizardStep === 1 && (!wizardData.name?.trim() || wizardData.sourceEntities?.length === 0)) {
            alert('Por favor, ingresa un nombre y selecciona al menos una entidad');
            return;
        }
        if (wizardStep === 2 && wizardData.variables?.length === 0) {
            alert('Por favor, define al menos una variable');
            return;
        }
        setWizardStep(prev => Math.min(prev + 1, 3));
    };

    const handleWizardBack = () => {
        setWizardStep(prev => Math.max(prev - 1, 1));
    };

    const handleWizardComplete = async () => {
        // Create base scenario automatically
        const baseScenario: Scenario = {
            id: generateUUID(),
            name: 'Escenario Base',
            description: 'Valores actuales sin modificaciones',
            color: SCENARIO_COLORS[0],
            modifiers: [],
            createdAt: new Date().toISOString()
        };

        const simulation: Simulation = {
            id: generateUUID(),
            name: wizardData.name!,
            description: wizardData.description,
            sourceEntities: wizardData.sourceEntities || [],
            variables: wizardData.variables || [],
            scenarios: [baseScenario, ...(wizardData.scenarios || [])],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Calculate base values for all variables
        await loadEntityData(simulation.sourceEntities);
        simulation.variables = simulation.variables.map(v => ({
            ...v,
            baseValue: calculateBaseValue(v, simulation.sourceEntities)
        }));

        const success = await saveSimulation(simulation);
        if (success) {
            setShowWizard(false);
            setWizardStep(1);
            setWizardData({ name: '', description: '', sourceEntities: [], variables: [], scenarios: [] });
            setSelectedSimulationId(simulation.id);
            navigate(`/simulations/${simulation.id}`);
        }
    };

    const handleAddSourceEntity = (entity: Entity) => {
        const existing = wizardData.sourceEntities?.find(s => s.entityId === entity.id);
        if (existing) return;
        
        const alias = entity.name.toLowerCase().replace(/\s+/g, '_').slice(0, 20);
        const newSource: SourceEntity = {
            entityId: entity.id,
            entityName: entity.name,
            alias: alias,
            selectedColumns: entity.properties
                .filter(p => p.type === 'number')
                .map(p => p.id)
        };
        
        setWizardData(prev => ({
            ...prev,
            sourceEntities: [...(prev.sourceEntities || []), newSource]
        }));
        
        // Load data for this entity
        loadEntityData([newSource]);
    };

    const handleRemoveSourceEntity = (entityId: string) => {
        setWizardData(prev => ({
            ...prev,
            sourceEntities: prev.sourceEntities?.filter(s => s.entityId !== entityId) || [],
            variables: prev.variables?.filter(v => {
                const source = prev.sourceEntities?.find(s => s.alias === v.sourceEntityAlias);
                return source?.entityId !== entityId;
            }) || []
        }));
    };

    const handleAddVariable = (
        sourceAlias: string,
        column: Property,
        aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count'
    ) => {
        const source = wizardData.sourceEntities?.find(s => s.alias === sourceAlias);
        if (!source) return;
        
        const newVariable: SimulationVariable = {
            id: generateUUID(),
            name: `${column.name} (${AGGREGATION_OPTIONS.find(a => a.value === aggregation)?.label})`,
            sourceEntityAlias: sourceAlias,
            columnId: column.id,
            columnName: column.name,
            aggregation,
            baseValue: 0 // Will be calculated
        };
        
        // Calculate base value
        const records = entityDataCache[source.entityId] || [];
        const values = records
            .map(r => parseFloat(r.values?.[column.id]) || 0)
            .filter(v => !isNaN(v));
        
        if (values.length > 0) {
            switch (aggregation) {
                case 'sum':
                    newVariable.baseValue = values.reduce((a, b) => a + b, 0);
                    break;
                case 'avg':
                    newVariable.baseValue = values.reduce((a, b) => a + b, 0) / values.length;
                    break;
                case 'min':
                    newVariable.baseValue = Math.min(...values);
                    break;
                case 'max':
                    newVariable.baseValue = Math.max(...values);
                    break;
                case 'count':
                    newVariable.baseValue = values.length;
                    break;
            }
        }
        
        setWizardData(prev => ({
            ...prev,
            variables: [...(prev.variables || []), newVariable]
        }));
    };

    const handleRemoveVariable = (variableId: string) => {
        setWizardData(prev => ({
            ...prev,
            variables: prev.variables?.filter(v => v.id !== variableId) || []
        }));
    };

    // ============================================================================
    // SCENARIO HANDLERS
    // ============================================================================

    const handleAddScenario = (name: string, description?: string) => {
        if (!selectedSimulation) return;
        
        const newScenario: Scenario = {
            id: generateUUID(),
            name,
            description,
            color: SCENARIO_COLORS[selectedSimulation.scenarios.length % SCENARIO_COLORS.length],
            modifiers: [],
            createdAt: new Date().toISOString()
        };
        
        const updated: Simulation = {
            ...selectedSimulation,
            scenarios: [...selectedSimulation.scenarios, newScenario],
            updatedAt: new Date().toISOString()
        };
        
        saveSimulation(updated);
        setShowAddScenarioModal(false);
    };

    const handleUpdateScenarioModifier = (
        scenarioId: string,
        variableId: string,
        modifierType: 'percentage' | 'absolute' | 'multiply',
        value: number
    ) => {
        if (!selectedSimulation) return;
        
        const updated: Simulation = {
            ...selectedSimulation,
            scenarios: selectedSimulation.scenarios.map(s => {
                if (s.id !== scenarioId) return s;
                
                const existingIndex = s.modifiers.findIndex(m => m.variableId === variableId);
                const newModifiers = [...s.modifiers];
                
                if (existingIndex >= 0) {
                    if (value === 0 && modifierType === 'percentage') {
                        newModifiers.splice(existingIndex, 1);
                    } else {
                        newModifiers[existingIndex] = { variableId, modifierType, value };
                    }
                } else if (value !== 0 || modifierType !== 'percentage') {
                    newModifiers.push({ variableId, modifierType, value });
                }
                
                return { ...s, modifiers: newModifiers };
            }),
            updatedAt: new Date().toISOString()
        };
        
        saveSimulation(updated);
    };

    const handleDeleteScenario = (scenarioId: string) => {
        if (!selectedSimulation) return;
        if (selectedSimulation.scenarios.length <= 1) {
            alert('Debe haber al menos un escenario');
            return;
        }
        
        const updated: Simulation = {
            ...selectedSimulation,
            scenarios: selectedSimulation.scenarios.filter(s => s.id !== scenarioId),
            updatedAt: new Date().toISOString()
        };
        
        saveSimulation(updated);
    };

    // ============================================================================
    // FILTERED DATA
    // ============================================================================

    const filteredSimulations = simulations.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ============================================================================
    // RENDER: LOADING
    // ============================================================================

    if (isLoading) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg-primary)] relative">
                <PageHeader title="Simulaciones" subtitle="Crea escenarios what-if y analiza diferentes resultados" />
                <div className="flex-1 flex items-center justify-center min-h-0">
                    <SpinnerGap className="animate-spin text-[var(--text-tertiary)]" size={24} weight="light" />
                </div>
            </div>
        );
    }

    // ============================================================================
    // RENDER: LIST VIEW
    // ============================================================================

    if (!selectedSimulationId) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg-primary)] relative">
                <PageHeader title="Simulaciones" subtitle="Crea escenarios what-if y analiza diferentes resultados" />

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                    Mis Simulaciones
                                </h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {simulations.length} simulación{simulations.length !== 1 ? 'es' : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowWizard(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                            >
                                <Plus size={14} weight="light" />
                                Nueva Simulación
                            </button>
                        </div>

                        {/* Search */}
                        {simulations.length > 0 && (
                            <div className="relative">
                                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar simulaciones..."
                                    className="w-full pl-8 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] outline-none placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>
                        )}

                        {/* Grid */}
                        {filteredSimulations.length === 0 ? (
                            <EmptyState onCreateNew={() => setShowWizard(true)} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredSimulations.map(simulation => (
                                    <SimulationCard
                                        key={simulation.id}
                                        simulation={simulation}
                                        onClick={() => {
                                            setSelectedSimulationId(simulation.id);
                                            navigate(`/simulations/${simulation.id}`);
                                        }}
                                        onDelete={() => deleteSimulation(simulation.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Wizard Modal */}
                {showWizard && (
                    <SimulationWizard
                        step={wizardStep}
                        data={wizardData}
                        entities={entities}
                        entityDataCache={entityDataCache}
                        onUpdateData={setWizardData}
                        onAddSourceEntity={handleAddSourceEntity}
                        onRemoveSourceEntity={handleRemoveSourceEntity}
                        onAddVariable={handleAddVariable}
                        onRemoveVariable={handleRemoveVariable}
                        onNext={handleWizardNext}
                        onBack={handleWizardBack}
                        onComplete={handleWizardComplete}
                        onClose={() => {
                            setShowWizard(false);
                            setWizardStep(1);
                            setWizardData({ name: '', description: '', sourceEntities: [], variables: [], scenarios: [] });
                        }}
                    />
                )}
            </div>
        );
    }

    // ============================================================================
    // RENDER: DETAIL VIEW
    // ============================================================================

    if (!selectedSimulation) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg-primary)] items-center justify-center">
                <p className="text-[var(--text-secondary)]">Simulación no encontrada</p>
                <button
                    onClick={() => {
                        setSelectedSimulationId(null);
                        navigate('/simulations');
                    }}
                    className="mt-4 text-[#256A65] hover:underline text-sm"
                >
                    Volver a la lista
                </button>
            </div>
        );
    }

    // Recalculate base values with current data
    const variablesWithValues = selectedSimulation.variables.map(v => ({
        ...v,
        baseValue: calculateBaseValue(v, selectedSimulation.sourceEntities)
    }));

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg-primary)] relative">
            {/* Header */}
            <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-8 z-10 shrink-0">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => {
                            setSelectedSimulationId(null);
                            navigate('/simulations');
                        }}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)]"
                    >
                        <ArrowLeft size={18} weight="light" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-normal text-[var(--text-primary)] truncate" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            {selectedSimulation.name}
                        </h1>
                        {selectedSimulation.description && (
                            <p className="text-[11px] text-[var(--text-secondary)] truncate">{selectedSimulation.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddScenarioModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-all"
                    >
                        <Plus size={14} weight="light" />
                        Nuevo Escenario
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* Source Entities Info */}
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Fuentes de Datos
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {selectedSimulation.sourceEntities.map(source => (
                                <div key={source.entityId} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-xs">
                                    <Database size={14} className="text-[var(--text-secondary)]" weight="light" />
                                    <span className="text-[var(--text-primary)] font-medium">{source.entityName}</span>
                                    <span className="text-[var(--text-tertiary)]">({source.alias})</span>
                                </div>
                            ))}
                            {selectedSimulation.sourceEntities.length === 0 && (
                                <p className="text-xs text-[var(--text-tertiary)]">No hay entidades configuradas</p>
                            )}
                        </div>
                    </div>

                    {/* Comparison Table */}
                    {variablesWithValues.length > 0 && selectedSimulation.scenarios.length > 0 && (
                        <ComparisonTable
                            variables={variablesWithValues}
                            scenarios={selectedSimulation.scenarios}
                            calculateScenarioValue={calculateScenarioValue}
                            onUpdateModifier={handleUpdateScenarioModifier}
                            onDeleteScenario={handleDeleteScenario}
                        />
                    )}

                    {/* Comparison Chart */}
                    {variablesWithValues.length > 0 && selectedSimulation.scenarios.length > 1 && (
                        <ComparisonChart
                            variables={variablesWithValues}
                            scenarios={selectedSimulation.scenarios}
                            calculateScenarioValue={calculateScenarioValue}
                        />
                    )}

                    {/* Sensitivity Analysis */}
                    {variablesWithValues.length > 0 && (
                        <SensitivityAnalysis
                            variables={variablesWithValues}
                            selectedVariable={sensitivityVariable}
                            onSelectVariable={setSensitivityVariable}
                            range={sensitivityRange}
                            onUpdateRange={setSensitivityRange}
                            calculateSensitivityData={calculateSensitivityData}
                        />
                    )}

                    {/* Empty State */}
                    {variablesWithValues.length === 0 && (
                        <div className="bg-[var(--bg-card)] rounded-lg border border-dashed border-[var(--border-light)] p-12 text-center">
                            <Sliders size={48} className="mx-auto text-[var(--text-tertiary)] mb-4" weight="light" />
                            <p className="text-[var(--text-secondary)] text-sm font-medium mb-1">No hay variables configuradas</p>
                            <p className="text-[var(--text-tertiary)] text-xs">Esta simulación necesita ser reconfigurada con el nuevo formato</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Scenario Modal */}
            {showAddScenarioModal && (
                <AddScenarioModal
                    onAdd={handleAddScenario}
                    onClose={() => setShowAddScenarioModal(false)}
                />
            )}
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => (
    <div className="bg-[var(--bg-card)] rounded-lg border border-dashed border-[var(--border-light)] p-12 text-center">
        <Sliders size={48} className="mx-auto text-[var(--text-tertiary)] mb-4" weight="light" />
        <p className="text-[var(--text-secondary)] mt-4 text-sm font-medium">No hay simulaciones</p>
        <p className="text-[var(--text-tertiary)] text-xs mt-1">Crea tu primera simulación para analizar escenarios what-if</p>
        <button
            onClick={onCreateNew}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
        >
            <Plus size={16} weight="light" />
            Crear Simulación
        </button>
    </div>
);

const SimulationCard: React.FC<{
    simulation: Simulation;
    onClick: () => void;
    onDelete: () => void;
}> = ({ simulation, onClick, onDelete }) => (
    <div
        onClick={onClick}
        className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 hover:border-[var(--border-medium)] hover:shadow-md transition-all cursor-pointer flex flex-col"
    >
        <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-3 right-3 p-1.5 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
        >
            <Trash size={16} weight="light" />
        </button>

        <div className="flex items-start gap-3 pr-12 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                <Sliders size={20} className="text-[var(--text-secondary)]" weight="light" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-normal text-sm text-[var(--text-primary)] leading-tight" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                    {simulation.name}
                </h3>
            </div>
        </div>

        {simulation.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-4 leading-relaxed">
                {simulation.description}
            </p>
        )}
        
        <div className="mt-auto pt-3 border-t border-[var(--border-light)] flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
                <Database size={12} className="text-[var(--text-tertiary)]" weight="light" />
                <span className="font-medium">{simulation.sourceEntities?.length || 0}</span>
                <span>entidades</span>
            </div>
            <span className="text-[var(--text-tertiary)]">•</span>
            <div className="flex items-center gap-1.5">
                <ChartBar size={12} className="text-[var(--text-tertiary)]" weight="light" />
                <span className="font-medium">{simulation.scenarios?.length || 0}</span>
                <span>escenarios</span>
            </div>
        </div>
    </div>
);

// ============================================================================
// WIZARD COMPONENT
// ============================================================================

interface WizardProps {
    step: number;
    data: Partial<Simulation>;
    entities: Entity[];
    entityDataCache: Record<string, any[]>;
    onUpdateData: (data: Partial<Simulation>) => void;
    onAddSourceEntity: (entity: Entity) => void;
    onRemoveSourceEntity: (entityId: string) => void;
    onAddVariable: (sourceAlias: string, column: Property, aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count') => void;
    onRemoveVariable: (variableId: string) => void;
    onNext: () => void;
    onBack: () => void;
    onComplete: () => void;
    onClose: () => void;
}

const SimulationWizard: React.FC<WizardProps> = ({
    step, data, entities, entityDataCache,
    onUpdateData, onAddSourceEntity, onRemoveSourceEntity,
    onAddVariable, onRemoveVariable,
    onNext, onBack, onComplete, onClose
}) => {
    const [selectedAggregation, setSelectedAggregation] = useState<'sum' | 'avg' | 'min' | 'max' | 'count'>('sum');

    const steps = [
        { num: 1, title: 'Configuración', desc: 'Nombre y entidades' },
        { num: 2, title: 'Variables', desc: 'Define métricas' },
        { num: 3, title: 'Revisar', desc: 'Confirmar y crear' }
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                Nueva Simulación
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Paso {step} de 3</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-tertiary)]">
                            <X size={18} weight="light" />
                        </button>
                    </div>
                    
                    {/* Progress */}
                    <div className="flex items-center gap-2 mt-4">
                        {steps.map((s, i) => (
                            <React.Fragment key={s.num}>
                                <div className={`flex items-center gap-2 ${step >= s.num ? 'text-[#256A65]' : 'text-[var(--text-tertiary)]'}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                        step > s.num ? 'bg-[#256A65] text-white' : 
                                        step === s.num ? 'bg-[#256A65]/20 text-[#256A65] border border-[#256A65]' : 
                                        'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                                    }`}>
                                        {step > s.num ? <Check size={12} weight="bold" /> : s.num}
                                    </div>
                                    <span className="text-xs font-medium hidden sm:inline">{s.title}</span>
                                </div>
                                {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.num ? 'bg-[#256A65]' : 'bg-[var(--border-light)]'}`} />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Name & Description */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                        Nombre <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.name || ''}
                                        onChange={e => onUpdateData({ ...data, name: e.target.value })}
                                        placeholder="Ej: Análisis de Ventas Q1"
                                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65] placeholder:text-[var(--text-tertiary)]"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Descripción</label>
                                    <textarea
                                        value={data.description || ''}
                                        onChange={e => onUpdateData({ ...data, description: e.target.value })}
                                        placeholder="Describe el propósito de esta simulación..."
                                        rows={2}
                                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65] resize-none placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                            </div>

                            {/* Select Entities */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Seleccionar Entidades <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-[var(--text-secondary)] mb-3">
                                    Elige las entidades cuyos datos quieres analizar
                                </p>
                                
                                {/* Selected */}
                                {(data.sourceEntities?.length || 0) > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {data.sourceEntities?.map(source => (
                                            <div key={source.entityId} className="flex items-center gap-2 px-3 py-1.5 bg-[#256A65]/10 border border-[#256A65]/30 rounded-lg text-xs">
                                                <Database size={14} className="text-[#256A65]" weight="light" />
                                                <span className="text-[var(--text-primary)] font-medium">{source.entityName}</span>
                                                <button onClick={() => onRemoveSourceEntity(source.entityId)} className="text-[var(--text-tertiary)] hover:text-red-400">
                                                    <X size={12} weight="bold" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Available */}
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                                    {entities.filter(e => !data.sourceEntities?.find(s => s.entityId === e.id)).map(entity => (
                                        <button
                                            key={entity.id}
                                            onClick={() => onAddSourceEntity(entity)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] border border-[var(--border-light)] rounded-lg text-xs text-left transition-colors"
                                        >
                                            <Database size={14} className="text-[var(--text-tertiary)]" weight="light" />
                                            <span className="truncate text-[var(--text-primary)]">{entity.name}</span>
                                            <span className="text-[var(--text-tertiary)] ml-auto">
                                                {entity.properties.filter(p => p.type === 'number').length} num
                                            </span>
                                        </button>
                                    ))}
                                    {entities.length === 0 && (
                                        <p className="col-span-2 text-center text-xs text-[var(--text-tertiary)] py-4">
                                            No hay entidades disponibles
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">Define Variables</h4>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Selecciona columnas numéricas y cómo quieres agregarlas
                                </p>
                            </div>

                            {/* Aggregation selector */}
                            <div className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                <span className="text-xs text-[var(--text-secondary)] px-2">Agregación:</span>
                                {AGGREGATION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedAggregation(opt.value as any)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                            selectedAggregation === opt.value
                                                ? 'bg-[#256A65] text-white'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                                        }`}
                                    >
                                        <opt.icon size={12} weight="light" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Columns by entity */}
                            {data.sourceEntities?.map(source => {
                                const entity = entities.find(e => e.id === source.entityId);
                                if (!entity) return null;
                                
                                const numericColumns = entity.properties.filter(p => p.type === 'number');
                                const records = entityDataCache[source.entityId] || [];
                                
                                return (
                                    <div key={source.entityId} className="space-y-2">
                                        <h5 className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-2">
                                            <Database size={12} weight="light" />
                                            {source.entityName}
                                            <span className="text-[var(--text-tertiary)] font-normal">({records.length} registros)</span>
                                        </h5>
                                        <div className="grid grid-cols-2 gap-2">
                                            {numericColumns.map(col => {
                                                const alreadyAdded = data.variables?.find(
                                                    v => v.columnId === col.id && v.sourceEntityAlias === source.alias && v.aggregation === selectedAggregation
                                                );
                                                
                                                return (
                                                    <button
                                                        key={col.id}
                                                        onClick={() => !alreadyAdded && onAddVariable(source.alias, col, selectedAggregation)}
                                                        disabled={!!alreadyAdded}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                                                            alreadyAdded
                                                                ? 'bg-[#256A65]/10 border border-[#256A65]/30 text-[#256A65]'
                                                                : 'bg-[var(--bg-card)] border border-[var(--border-light)] hover:border-[#256A65] text-[var(--text-primary)]'
                                                        }`}
                                                    >
                                                        {alreadyAdded ? <CheckCircle size={14} weight="fill" /> : <Circle size={14} weight="light" />}
                                                        <span className="truncate">{col.name}</span>
                                                    </button>
                                                );
                                            })}
                                            {numericColumns.length === 0 && (
                                                <p className="col-span-2 text-xs text-[var(--text-tertiary)] py-2">
                                                    No hay columnas numéricas
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Selected Variables */}
                            {(data.variables?.length || 0) > 0 && (
                                <div className="border-t border-[var(--border-light)] pt-4">
                                    <h5 className="text-xs font-medium text-[var(--text-primary)] mb-2">Variables seleccionadas ({data.variables?.length})</h5>
                                    <div className="space-y-1">
                                        {data.variables?.map(variable => (
                                            <div key={variable.id} className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Calculator size={14} className="text-[var(--text-secondary)]" weight="light" />
                                                    <span className="text-[var(--text-primary)]">{variable.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[var(--text-secondary)] font-mono">
                                                        {variable.baseValue.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                                    </span>
                                                    <button onClick={() => onRemoveVariable(variable.id)} className="text-[var(--text-tertiary)] hover:text-red-400">
                                                        <X size={12} weight="bold" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="text-center py-4">
                                <CheckCircle size={48} className="mx-auto text-[#256A65] mb-3" weight="fill" />
                                <h4 className="text-lg font-medium text-[var(--text-primary)]">¡Listo para crear!</h4>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Revisa la configuración antes de crear la simulación</p>
                            </div>

                            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 space-y-4">
                                <div>
                                    <span className="text-xs text-[var(--text-tertiary)]">Nombre</span>
                                    <p className="text-sm text-[var(--text-primary)] font-medium">{data.name}</p>
                                </div>
                                {data.description && (
                                    <div>
                                        <span className="text-xs text-[var(--text-tertiary)]">Descripción</span>
                                        <p className="text-sm text-[var(--text-secondary)]">{data.description}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-xs text-[var(--text-tertiary)]">Entidades ({data.sourceEntities?.length})</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {data.sourceEntities?.map(s => (
                                            <span key={s.entityId} className="px-2 py-0.5 bg-[var(--bg-card)] rounded text-xs text-[var(--text-primary)]">
                                                {s.entityName}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs text-[var(--text-tertiary)]">Variables ({data.variables?.length})</span>
                                    <div className="space-y-1 mt-1">
                                        {data.variables?.map(v => (
                                            <div key={v.id} className="flex justify-between text-xs">
                                                <span className="text-[var(--text-primary)]">{v.name}</span>
                                                <span className="text-[var(--text-secondary)] font-mono">
                                                    {v.baseValue.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-[var(--text-tertiary)] text-center">
                                Se creará automáticamente un "Escenario Base" con los valores actuales
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-between">
                    <button
                        onClick={step === 1 ? onClose : onBack}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </button>
                    <button
                        onClick={step === 3 ? onComplete : onNext}
                        className="px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {step === 3 ? 'Crear Simulación' : 'Siguiente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// COMPARISON TABLE
// ============================================================================

interface ComparisonTableProps {
    variables: SimulationVariable[];
    scenarios: Scenario[];
    calculateScenarioValue: (variable: SimulationVariable, scenario: Scenario) => number;
    onUpdateModifier: (scenarioId: string, variableId: string, modifierType: 'percentage' | 'absolute' | 'multiply', value: number) => void;
    onDeleteScenario: (scenarioId: string) => void;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
    variables, scenarios, calculateScenarioValue, onUpdateModifier, onDeleteScenario
}) => {
    const [editingCell, setEditingCell] = useState<{ scenarioId: string; variableId: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleStartEdit = (scenarioId: string, variableId: string, currentModifier?: ScenarioModifier) => {
        setEditingCell({ scenarioId, variableId });
        setEditValue(currentModifier ? String(currentModifier.value) : '0');
    };

    const handleSaveEdit = () => {
        if (!editingCell) return;
        const value = parseFloat(editValue) || 0;
        onUpdateModifier(editingCell.scenarioId, editingCell.variableId, 'percentage', value);
        setEditingCell(null);
    };

    return (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-light)]">
                <h3 className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                    Comparación de Escenarios
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Haz clic en una celda para modificar el valor (% de cambio)</p>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-[var(--bg-tertiary)]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                Variable
                            </th>
                            {scenarios.map(scenario => (
                                <th key={scenario.id} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider min-w-[140px]">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scenario.color }} />
                                        <span className="text-[var(--text-secondary)]">{scenario.name}</span>
                                        {scenarios.length > 1 && (
                                            <button
                                                onClick={() => onDeleteScenario(scenario.id)}
                                                className="p-1 text-[var(--text-tertiary)] hover:text-red-400 rounded transition-colors"
                                            >
                                                <Trash size={12} weight="light" />
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                        {variables.map(variable => (
                            <tr key={variable.id} className="hover:bg-[var(--bg-tertiary)]/50">
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-[var(--text-primary)] font-medium">{variable.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">
                                            Base: {variable.baseValue.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </td>
                                {scenarios.map(scenario => {
                                    const modifier = scenario.modifiers.find(m => m.variableId === variable.id);
                                    const value = calculateScenarioValue(variable, scenario);
                                    const diff = value - variable.baseValue;
                                    const diffPct = variable.baseValue !== 0 ? (diff / variable.baseValue) * 100 : 0;
                                    const isEditing = editingCell?.scenarioId === scenario.id && editingCell?.variableId === variable.id;
                                    
                                    return (
                                        <td key={scenario.id} className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                                        onBlur={handleSaveEdit}
                                                        autoFocus
                                                        className="w-20 px-2 py-1 text-right text-sm bg-[var(--bg-card)] border border-[#256A65] rounded focus:outline-none"
                                                    />
                                                    <span className="text-xs text-[var(--text-tertiary)]">%</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleStartEdit(scenario.id, variable.id, modifier)}
                                                    className="group text-right w-full"
                                                >
                                                    <div className="text-[var(--text-primary)] font-mono">
                                                        {value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                                    </div>
                                                    {modifier && (
                                                        <div className={`text-xs ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                        clic para editar
                                                    </div>
                                                </button>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ============================================================================
// COMPARISON CHART
// ============================================================================

interface ComparisonChartProps {
    variables: SimulationVariable[];
    scenarios: Scenario[];
    calculateScenarioValue: (variable: SimulationVariable, scenario: Scenario) => number;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ variables, scenarios, calculateScenarioValue }) => {
    const chartData = variables.map(variable => {
        const dataPoint: any = { name: variable.name.length > 20 ? variable.name.slice(0, 20) + '...' : variable.name };
        scenarios.forEach(scenario => {
            dataPoint[scenario.name] = calculateScenarioValue(variable, scenario);
        });
        return dataPoint;
    });

    return (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                Comparación Visual
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={120} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        formatter={(value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {scenarios.map((scenario, index) => (
                        <Bar key={scenario.id} dataKey={scenario.name} fill={scenario.color} radius={[0, 4, 4, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// ============================================================================
// SENSITIVITY ANALYSIS
// ============================================================================

interface SensitivityAnalysisProps {
    variables: SimulationVariable[];
    selectedVariable: string | null;
    onSelectVariable: (id: string | null) => void;
    range: { min: number; max: number; steps: number };
    onUpdateRange: (range: { min: number; max: number; steps: number }) => void;
    calculateSensitivityData: (variable: SimulationVariable, range: { min: number; max: number; steps: number }) => any[];
}

const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({
    variables, selectedVariable, onSelectVariable, range, onUpdateRange, calculateSensitivityData
}) => {
    const variable = variables.find(v => v.id === selectedVariable);
    const data = variable ? calculateSensitivityData(variable, range) : [];

    return (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                        Análisis de Sensibilidad
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Visualiza cómo cambia una variable al modificar su valor base
                    </p>
                </div>
            </div>

            {/* Variable selector */}
            <div className="flex flex-wrap gap-2 mb-4">
                {variables.map(v => (
                    <button
                        key={v.id}
                        onClick={() => onSelectVariable(selectedVariable === v.id ? null : v.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedVariable === v.id
                                ? 'bg-[#256A65] text-white'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-selected)]'
                        }`}
                    >
                        {v.name}
                    </button>
                ))}
            </div>

            {/* Range controls */}
            {selectedVariable && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-secondary)]">Rango:</span>
                        <input
                            type="number"
                            value={range.min}
                            onChange={e => onUpdateRange({ ...range, min: parseInt(e.target.value) || -50 })}
                            className="w-16 px-2 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-center"
                        />
                        <span className="text-xs text-[var(--text-tertiary)]">% a</span>
                        <input
                            type="number"
                            value={range.max}
                            onChange={e => onUpdateRange({ ...range, max: parseInt(e.target.value) || 50 })}
                            className="w-16 px-2 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-center"
                        />
                        <span className="text-xs text-[var(--text-tertiary)]">%</span>
                    </div>
                </div>
            )}

            {/* Chart */}
            {variable && data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={data} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey="percentage" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}
                            formatter={(value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                        />
                        <ReferenceLine y={variable.baseValue} stroke="#256A65" strokeDasharray="5 5" label={{ value: 'Base', fill: '#256A65', fontSize: 10 }} />
                        <Area type="monotone" dataKey="value" fill="#256A65" fillOpacity={0.1} stroke="#256A65" strokeWidth={2} />
                        <Line type="monotone" dataKey="value" stroke="#256A65" strokeWidth={2} dot={{ fill: '#256A65', r: 3 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-48 flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                    Selecciona una variable para ver el análisis
                </div>
            )}
        </div>
    );
};

// ============================================================================
// ADD SCENARIO MODAL
// ============================================================================

interface AddScenarioModalProps {
    onAdd: (name: string, description?: string) => void;
    onClose: () => void;
}

const AddScenarioModal: React.FC<AddScenarioModalProps> = ({ onAdd, onClose }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Por favor, ingresa un nombre para el escenario');
            return;
        }
        onAdd(name.trim(), description.trim() || undefined);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Nuevo Escenario
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-tertiary)]">
                            <X size={18} weight="light" />
                        </button>
                    </div>
                </div>
                
                <div className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                            Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Escenario Optimista"
                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65] placeholder:text-[var(--text-tertiary)]"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Descripción</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describe este escenario..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65] resize-none placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Crear Escenario
                    </button>
                </div>
            </div>
        </div>
    );
};
