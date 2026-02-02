import React, { useState, useEffect, useMemo } from 'react';
import { Entity, Property } from '../../types';
import { 
    X, Database, ChartBar, CaretDown, Check, Sparkle, SpinnerGap,
    Calculator, Funnel, SortAscending, SortDescending, Palette
} from '@phosphor-icons/react';
import { WidgetTemplate, WidgetType } from './WidgetGallery';
import { API_BASE } from '../../config';
import { PromptInput } from '../PromptInput';

export interface WidgetDataConfig {
    entityId: string;
    entityName: string;
    xAxisColumn?: string;
    yAxisColumn?: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    groupBy?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    filters?: Array<{ column: string; operator: string; value: string }>;
}

export interface WidgetFullConfig {
    id: string;
    type: WidgetType;
    title: string;
    description?: string;
    dataConfig?: WidgetDataConfig;
    // For AI generated
    aiPrompt?: string;
    // Visual config
    colors?: string[];
    showLegend?: boolean;
    // Computed data
    data?: any[];
}

interface WidgetConfiguratorProps {
    template: WidgetTemplate;
    entities: Entity[];
    onSave: (config: WidgetFullConfig) => void;
    onCancel: () => void;
}

const AGGREGATIONS = [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'count', label: 'Count' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
];

const CHART_COLORS = [
    ['#256A65', '#84C4D1', '#3d8a84', '#5ba9a3'],
    ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
    ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A'],
    ['#EF4444', '#F87171', '#FCA5A5', '#FECACA'],
];

export const WidgetConfigurator: React.FC<WidgetConfiguratorProps> = ({
    template,
    entities,
    onSave,
    onCancel
}) => {
    const [title, setTitle] = useState(template.name);
    const [description, setDescription] = useState('');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [xAxisColumn, setXAxisColumn] = useState<string>('');
    const [yAxisColumn, setYAxisColumn] = useState<string>('');
    const [aggregation, setAggregation] = useState<string>('sum');
    const [groupBy, setGroupBy] = useState<string>('');
    const [limit, setLimit] = useState<number>(10);
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    
    // AI specific
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Preview data
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const selectedEntity = entities.find(e => e.id === selectedEntityId);
    const numericColumns = selectedEntity?.properties.filter(p => p.type === 'number') || [];
    const textColumns = selectedEntity?.properties.filter(p => p.type === 'text') || [];
    const allColumns = selectedEntity?.properties || [];

    // Auto-select first numeric column for Y-axis
    useEffect(() => {
        if (numericColumns.length > 0 && !yAxisColumn) {
            setYAxisColumn(numericColumns[0].id);
        }
    }, [numericColumns, yAxisColumn]);

    // Auto-select first text column for X-axis/groupBy
    useEffect(() => {
        if (textColumns.length > 0 && !xAxisColumn) {
            setXAxisColumn(textColumns[0].id);
        }
    }, [textColumns, xAxisColumn]);

    // Load preview data when config changes
    useEffect(() => {
        if (selectedEntityId && yAxisColumn && template.id !== 'ai_generated') {
            loadPreviewData();
        }
    }, [selectedEntityId, yAxisColumn, xAxisColumn, aggregation, groupBy, limit]);

    const loadPreviewData = async () => {
        if (!selectedEntityId) return;
        
        setIsLoadingPreview(true);
        try {
            const res = await fetch(`${API_BASE}/entities/${selectedEntityId}/records`, {
                credentials: 'include'
            });
            if (res.ok) {
                const records = await res.json();
                if (Array.isArray(records)) {
                    // Process data based on config
                    const processed = processDataForWidget(records);
                    setPreviewData(processed.slice(0, limit));
                }
            }
        } catch (error) {
            console.error('Error loading preview data:', error);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const processDataForWidget = (records: any[]): any[] => {
        if (!selectedEntity) return [];

        const xCol = allColumns.find(c => c.id === xAxisColumn);
        const yCol = allColumns.find(c => c.id === yAxisColumn);
        
        if (!yCol) return [];

        // Group by X column if specified
        if (xAxisColumn && xCol) {
            const groups: Record<string, number[]> = {};
            
            records.forEach(record => {
                const xValue = record.values?.[xAxisColumn] || 'Unknown';
                const yValue = parseFloat(record.values?.[yAxisColumn]) || 0;
                
                if (!groups[xValue]) groups[xValue] = [];
                groups[xValue].push(yValue);
            });

            return Object.entries(groups).map(([name, values]) => {
                let aggregatedValue: number;
                switch (aggregation) {
                    case 'sum':
                        aggregatedValue = values.reduce((a, b) => a + b, 0);
                        break;
                    case 'avg':
                        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
                        break;
                    case 'count':
                        aggregatedValue = values.length;
                        break;
                    case 'min':
                        aggregatedValue = Math.min(...values);
                        break;
                    case 'max':
                        aggregatedValue = Math.max(...values);
                        break;
                    default:
                        aggregatedValue = values.reduce((a, b) => a + b, 0);
                }
                
                return {
                    name,
                    value: Math.round(aggregatedValue * 100) / 100,
                    [yCol.name]: Math.round(aggregatedValue * 100) / 100
                };
            }).sort((a, b) => b.value - a.value).slice(0, limit);
        }

        // No grouping - return raw values
        return records.slice(0, limit).map(record => ({
            name: record.values?.[xAxisColumn] || 'Item',
            value: parseFloat(record.values?.[yAxisColumn]) || 0,
            [yCol.name]: parseFloat(record.values?.[yAxisColumn]) || 0
        }));
    };

    const handleSave = () => {
        const config: WidgetFullConfig = {
            id: '', // Will be set by parent
            type: template.id,
            title,
            description,
            colors: CHART_COLORS[selectedColorIndex],
            showLegend: true,
        };

        if (template.id === 'ai_generated') {
            config.aiPrompt = aiPrompt;
        } else {
            config.dataConfig = {
                entityId: selectedEntityId,
                entityName: selectedEntity?.name || '',
                xAxisColumn,
                yAxisColumn,
                aggregation: aggregation as any,
                groupBy,
                limit
            };
            config.data = previewData;
        }

        onSave(config);
    };

    const handleAIGenerate = async (prompt: string, mentionedEntityIds: string[]) => {
        setIsGenerating(true);
        setAiPrompt(prompt);
        
        try {
            const res = await fetch(`${API_BASE}/generate-widget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mentionedEntityIds }),
                credentials: 'include'
            });

            const widgetConfig = await res.json();
            if (!widgetConfig.error) {
                // Use AI generated config directly
                onSave({
                    id: '',
                    type: 'ai_generated',
                    title: widgetConfig.title || 'AI Widget',
                    description: widgetConfig.description,
                    data: widgetConfig.data,
                    colors: CHART_COLORS[selectedColorIndex],
                    showLegend: true,
                    aiPrompt: prompt
                });
            }
        } catch (error) {
            console.error('Error generating widget:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const isValid = template.id === 'ai_generated' || (selectedEntityId && yAxisColumn);

    // Render AI Generator UI
    if (template.id === 'ai_generated') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                
                <div 
                    className="relative w-full max-w-2xl bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#256A65] rounded-lg text-white">
                                <Sparkle size={20} weight="light" />
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-[var(--text-primary)]">AI Widget Generator</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Describe what you want to visualize</p>
                            </div>
                        </div>
                        <button onClick={onCancel} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                            <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        <PromptInput
                            entities={entities}
                            onGenerate={handleAIGenerate}
                            isGenerating={isGenerating}
                            placeholder="e.g. 'Show @Sales by month' or 'Top 10 @Customers by revenue'"
                            buttonLabel="Generate Widget"
                        />
                        
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-[var(--text-primary)]">Tip:</strong> Use @ to reference your data entities. 
                                The AI will analyze your data and create the best visualization.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render Data Config UI
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            <div 
                className="relative w-full max-w-3xl bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                            {template.icon}
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-[var(--text-primary)]">Configure {template.name}</h2>
                            <p className="text-xs text-[var(--text-secondary)]">{template.description}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                        <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left: Configuration */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                <Database size={14} weight="light" />
                                Data Source
                            </h3>

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                />
                            </div>

                            {/* Entity Selector */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Data Entity</label>
                                <select
                                    value={selectedEntityId}
                                    onChange={e => setSelectedEntityId(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                >
                                    <option value="">Select entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedEntity && (
                                <>
                                    {/* X-Axis / Category */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                            Category (X-Axis)
                                        </label>
                                        <select
                                            value={xAxisColumn}
                                            onChange={e => setXAxisColumn(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                        >
                                            <option value="">Select column...</option>
                                            {allColumns.map(col => (
                                                <option key={col.id} value={col.id}>{col.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Y-Axis / Value */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                            Value (Y-Axis)
                                        </label>
                                        <select
                                            value={yAxisColumn}
                                            onChange={e => setYAxisColumn(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                        >
                                            <option value="">Select column...</option>
                                            {numericColumns.map(col => (
                                                <option key={col.id} value={col.id}>{col.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Aggregation */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                            Aggregation
                                        </label>
                                        <select
                                            value={aggregation}
                                            onChange={e => setAggregation(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                        >
                                            {AGGREGATIONS.map(agg => (
                                                <option key={agg.value} value={agg.value}>{agg.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Limit */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                            Limit Results
                                        </label>
                                        <input
                                            type="number"
                                            value={limit}
                                            onChange={e => setLimit(parseInt(e.target.value) || 10)}
                                            min={1}
                                            max={100}
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65]"
                                        />
                                    </div>

                                    {/* Color Scheme */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                            Color Scheme
                                        </label>
                                        <div className="flex gap-2">
                                            {CHART_COLORS.map((colors, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setSelectedColorIndex(index)}
                                                    className={`flex gap-0.5 p-1.5 rounded-lg border-2 transition-colors ${
                                                        selectedColorIndex === index
                                                            ? 'border-[#256A65]'
                                                            : 'border-transparent hover:border-[var(--border-medium)]'
                                                    }`}
                                                >
                                                    {colors.slice(0, 3).map((color, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-4 h-4 rounded"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Preview */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                <ChartBar size={14} weight="light" />
                                Preview
                            </h3>

                            <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)] p-4 min-h-[300px] flex items-center justify-center">
                                {isLoadingPreview ? (
                                    <div className="text-center">
                                        <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)] mx-auto mb-2" weight="light" />
                                        <p className="text-xs text-[var(--text-secondary)]">Loading preview...</p>
                                    </div>
                                ) : previewData.length > 0 ? (
                                    <div className="w-full">
                                        <p className="text-xs text-[var(--text-secondary)] mb-3">{previewData.length} results</p>
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                            {previewData.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 bg-[var(--bg-card)] rounded-lg text-xs">
                                                    <span className="text-[var(--text-primary)] truncate flex-1">{item.name}</span>
                                                    <span className="text-[var(--text-secondary)] font-mono ml-2">
                                                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Database size={32} className="text-[var(--text-tertiary)] mx-auto mb-2" weight="light" />
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            {selectedEntityId ? 'No data available' : 'Select a data source'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValid}
                        className="px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Add Widget
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WidgetConfigurator;
