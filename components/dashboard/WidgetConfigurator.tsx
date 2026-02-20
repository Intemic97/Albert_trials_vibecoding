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
    relatedEntityIds?: string[];
    xAxisColumn?: string;
    yAxisColumn?: string;
    sizeColumn?: string;
    sourceColumn?: string;
    targetColumn?: string;
    dateColumn?: string;
    severityColumn?: string;
    labelColumn?: string;
    trackColumn?: string;
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
    initialConfig?: Partial<WidgetFullConfig>;
    submitLabel?: string;
}

const AGGREGATIONS = [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'count', label: 'Count' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
];

const AGGREGATIONS_WITH_NONE = [
    { value: 'none', label: 'None (Raw Data)' },
    ...AGGREGATIONS
];

const CHART_COLORS = [
    ['#5B7476', '#84C4D1', '#3d8a84', '#5ba9a3'],
    ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
    ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A'],
    ['#EF4444', '#F87171', '#FCA5A5', '#FECACA'],
];

export const WidgetConfigurator: React.FC<WidgetConfiguratorProps> = ({
    template,
    entities,
    onSave,
    onCancel,
    initialConfig,
    submitLabel
}) => {
    const initialDataConfig = initialConfig?.dataConfig;
    const [title, setTitle] = useState(initialConfig?.title || template.name);
    const [description, setDescription] = useState(initialConfig?.description || '');
    const [selectedEntityId, setSelectedEntityId] = useState<string>(initialDataConfig?.entityId || '');
    const [xAxisColumn, setXAxisColumn] = useState<string>(initialDataConfig?.xAxisColumn || '');
    const [yAxisColumn, setYAxisColumn] = useState<string>(initialDataConfig?.yAxisColumn || '');
    const [sizeColumn, setSizeColumn] = useState<string>(initialDataConfig?.sizeColumn || '');
    const [sourceColumn, setSourceColumn] = useState<string>(initialDataConfig?.sourceColumn || '');
    const [targetColumn, setTargetColumn] = useState<string>(initialDataConfig?.targetColumn || '');
    const [dateColumn, setDateColumn] = useState<string>(initialDataConfig?.dateColumn || '');
    const [severityColumn, setSeverityColumn] = useState<string>(initialDataConfig?.severityColumn || '');
    const [labelColumn, setLabelColumn] = useState<string>(initialDataConfig?.labelColumn || '');
    const [trackColumn, setTrackColumn] = useState<string>(initialDataConfig?.trackColumn || '');
    const [aggregation, setAggregation] = useState<string>(initialDataConfig?.aggregation || 'sum');
    const [groupBy, setGroupBy] = useState<string>(initialDataConfig?.groupBy || '');
    const [limit, setLimit] = useState<number>(initialDataConfig?.limit || 10);
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    
    // AI specific
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Preview data
    const [previewData, setPreviewData] = useState<any[]>(Array.isArray(initialConfig?.data) ? initialConfig!.data as any[] : []);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const selectedEntity = entities.find(e => e.id === selectedEntityId);
    const numericColumns = selectedEntity?.properties.filter(p => p.type === 'number') || [];
    const textColumns = selectedEntity?.properties.filter(p => p.type === 'text') || [];
    const allColumns = selectedEntity?.properties || [];
    const dateLikeColumns = allColumns.filter(col => /date|fecha|time|timestamp|period|day|month/i.test(col.name));

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

    // Heatmap needs a second categorical dimension (Y axis in matrix)
    useEffect(() => {
        if (!selectedEntity || template.id !== 'heatmap' || groupBy) return;
        const candidates = textColumns.filter(col => col.id !== xAxisColumn);
        if (candidates.length > 0) {
            setGroupBy(candidates[0].id);
        } else if (textColumns.length > 0) {
            setGroupBy(textColumns[0].id);
        }
    }, [selectedEntity, template.id, groupBy, textColumns, xAxisColumn]);

    useEffect(() => {
        if (!selectedEntity || template.id !== 'bubble' || sizeColumn) return;
        if (numericColumns.length > 1) {
            const candidate = numericColumns.find(col => col.id !== yAxisColumn);
            if (candidate) setSizeColumn(candidate.id);
        }
    }, [selectedEntity, template.id, sizeColumn, numericColumns, yAxisColumn]);

    useEffect(() => {
        if (!selectedEntity || template.id !== 'sankey') return;
        if (!sourceColumn && textColumns.length > 0) {
            setSourceColumn(textColumns[0].id);
        }
        if (!targetColumn && textColumns.length > 1) {
            setTargetColumn(textColumns[1].id);
        } else if (!targetColumn && textColumns.length > 0) {
            setTargetColumn(textColumns[0].id);
        }
    }, [selectedEntity, template.id, sourceColumn, targetColumn, textColumns]);

    useEffect(() => {
        if (!selectedEntity || !['timeline', 'multi_timeline'].includes(template.id)) return;
        if (!dateColumn) {
            if (dateLikeColumns.length > 0) {
                setDateColumn(dateLikeColumns[0].id);
            } else if (textColumns.length > 0) {
                setDateColumn(textColumns[0].id);
            }
        }
        if (!severityColumn) {
            const sev = allColumns.find(col => /severity|criticality|level|criticidad|impact/i.test(col.name));
            if (sev) setSeverityColumn(sev.id);
        }
        if (!labelColumn) {
            const label = allColumns.find(col => /name|title|descripcion|description|event|alert/i.test(col.name));
            if (label) setLabelColumn(label.id);
        }
        if (template.id === 'multi_timeline' && !trackColumn) {
            const track = allColumns.find(col => /asset|line|machine|equipo|detector|source|area|unit/i.test(col.name));
            if (track) {
                setTrackColumn(track.id);
            } else if (textColumns.length > 0) {
                setTrackColumn(textColumns[0].id);
            }
        }
    }, [
        selectedEntity,
        template.id,
        dateColumn,
        severityColumn,
        labelColumn,
        trackColumn,
        allColumns,
        dateLikeColumns,
        textColumns
    ]);

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
        const groupCol = allColumns.find(c => c.id === groupBy);
        const sizeCol = allColumns.find(c => c.id === sizeColumn);
        const sourceCol = allColumns.find(c => c.id === sourceColumn);
        const targetCol = allColumns.find(c => c.id === targetColumn);
        const dateCol = allColumns.find(c => c.id === dateColumn);
        const sevCol = allColumns.find(c => c.id === severityColumn);
        const labelCol = allColumns.find(c => c.id === labelColumn);
        const trackCol = allColumns.find(c => c.id === trackColumn);
        
        const requiresNumericY = !['timeline', 'multi_timeline'].includes(template.id) && !(template.id === 'sankey' && aggregation === 'count');
        if (!yCol && requiresNumericY) return [];

        const aggregate = (values: number[]) => {
            if (values.length === 0) return 0;
            if (aggregation === 'none') {
                // For "none", return the first value (raw data, no aggregation)
                return values[0] || 0;
            }
            switch (aggregation) {
                case 'sum':
                    return values.reduce((a, b) => a + b, 0);
                case 'avg':
                    return values.reduce((a, b) => a + b, 0) / values.length;
                case 'count':
                    return values.length;
                case 'min':
                    return Math.min(...values);
                case 'max':
                    return Math.max(...values);
                default:
                    return values.reduce((a, b) => a + b, 0);
            }
        };

        if (template.id === 'heatmap' && xAxisColumn && groupBy && xCol && groupCol) {
            const matrixGroups: Record<string, number[]> = {};

            records.forEach(record => {
                const xValue = String(record.values?.[xAxisColumn] ?? 'Unknown');
                const yValue = String(record.values?.[groupBy] ?? 'Unknown');
                const value = parseFloat(record.values?.[yAxisColumn]) || 0;
                const key = `${xValue}||${yValue}`;
                if (!matrixGroups[key]) matrixGroups[key] = [];
                matrixGroups[key].push(value);
            });

            return Object.entries(matrixGroups)
                .map(([pair, values]) => {
                    const [xValue, yValue] = pair.split('||');
                    const aggregatedValue = Math.round(aggregate(values) * 100) / 100;
                    return {
                        name: xValue,
                        category: yValue,
                        value: aggregatedValue,
                        [xCol.name]: xValue,
                        [groupCol.name]: yValue,
                        [yCol.name]: aggregatedValue
                    };
                })
                .slice(0, limit);
        }

        if (template.id === 'bubble' && xCol && yCol) {
            return records.slice(0, limit).map((record) => {
                const xRaw = record.values?.[xAxisColumn];
                const yRaw = record.values?.[yAxisColumn];
                const sRaw = sizeCol ? record.values?.[sizeColumn] : undefined;
                const xValue = parseFloat(xRaw);
                const yValue = parseFloat(yRaw);
                const sizeValue = sizeCol ? parseFloat(sRaw) : Math.abs(parseFloat(yRaw) || 0);
                const safeX = Number.isFinite(xValue) ? xValue : 0;
                const safeY = Number.isFinite(yValue) ? yValue : 0;
                const safeSize = Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : 1;
                const label = labelCol ? String(record.values?.[labelColumn] ?? '') : '';
                return {
                    [xCol.name]: safeX,
                    [yCol.name]: safeY,
                    [(sizeCol?.name || 'size')]: safeSize,
                    name: label || `Point ${record.id}`,
                    value: safeY
                };
            });
        }

        if (template.id === 'sankey' && sourceCol && targetCol) {
            const flowGroups: Record<string, number[]> = {};
            records.forEach((record) => {
                const src = String(record.values?.[sourceColumn] ?? 'Unknown');
                const tgt = String(record.values?.[targetColumn] ?? 'Unknown');
                const numeric = parseFloat(record.values?.[yAxisColumn]) || 0;
                const key = `${src}||${tgt}`;
                if (!flowGroups[key]) flowGroups[key] = [];
                flowGroups[key].push(aggregation === 'count' ? 1 : numeric);
            });

            return Object.entries(flowGroups)
                .map(([key, values]) => {
                    const [src, tgt] = key.split('||');
                    const flowValue = Math.max(0, Math.round(aggregate(values) * 100) / 100);
                    return {
                        source: src || 'Unknown',
                        target: tgt || 'Unknown',
                        value: flowValue,
                        [sourceCol.name]: src || 'Unknown',
                        [targetCol.name]: tgt || 'Unknown',
                        [(yCol?.name || 'value')]: flowValue
                    };
                })
                .filter(item => item.source && item.target)
                .slice(0, limit);
        }

        if (template.id === 'timeline' && dateCol) {
            const normalizeSeverity = (value: string) => {
                const raw = String(value || '').toLowerCase();
                if (/high|critical|alta|severa/.test(raw)) return 'high';
                if (/low|minor|baja/.test(raw)) return 'low';
                return 'medium';
            };

            return records
                .map((record) => {
                    const rawDate = record.values?.[dateColumn];
                    const parsedDate = new Date(rawDate);
                    if (!rawDate || Number.isNaN(parsedDate.getTime())) return null;
                    const labelValue = labelCol ? String(record.values?.[labelColumn] ?? '') : '';
                    const severityValue = sevCol ? String(record.values?.[severityColumn] ?? '') : '';
                    return {
                        start: parsedDate.toISOString(),
                        severity: normalizeSeverity(severityValue),
                        label: labelValue || `Event ${record.id}`,
                        name: labelValue || `Event ${record.id}`,
                        value: 1,
                        [dateCol.name]: parsedDate.toISOString()
                    };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .slice(0, limit);
        }

        if (template.id === 'multi_timeline' && dateCol) {
            const normalizeSeverity = (value: string) => {
                const raw = String(value || '').toLowerCase();
                if (/high|critical|alta|severa/.test(raw)) return 'high';
                if (/low|minor|baja/.test(raw)) return 'low';
                return 'medium';
            };
            const trackKey = trackCol?.name || 'asset';

            return records
                .map((record) => {
                    const rawDate = record.values?.[dateColumn];
                    const parsedDate = new Date(rawDate);
                    if (!rawDate || Number.isNaN(parsedDate.getTime())) return null;
                    const labelValue = labelCol ? String(record.values?.[labelColumn] ?? '') : '';
                    const severityValue = sevCol ? String(record.values?.[severityColumn] ?? '') : '';
                    const trackValue = trackCol ? String(record.values?.[trackColumn] ?? 'Default') : 'Default';
                    return {
                        start: parsedDate.toISOString(),
                        severity: normalizeSeverity(severityValue),
                        label: labelValue || `Event ${record.id}`,
                        [trackKey]: trackValue || 'Default',
                        name: labelValue || `Event ${record.id}`,
                        value: 1
                    };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .slice(0, limit);
        }

        if ((template.id === 'parallel' || template.id === 'scatter_matrix') && numericColumns.length > 0) {
            const dims = numericColumns.slice(0, template.id === 'parallel' ? 6 : 4);
            return records.slice(0, limit).map((record) => {
                const row: Record<string, any> = {};
                dims.forEach((dim) => {
                    const n = parseFloat(record.values?.[dim.id]);
                    row[dim.name] = Number.isFinite(n) ? n : 0;
                });
                if (xCol) {
                    row[xCol.name] = String(record.values?.[xAxisColumn] ?? `Record ${record.id}`);
                    row.name = row[xCol.name];
                }
                return row;
            });
        }

        // Group by X column if specified
        if (xAxisColumn && xCol) {
            // If aggregation is "none", don't group - return raw data
            if (aggregation === 'none') {
                return records.slice(0, limit).map(record => {
                    const xValue = record.values?.[xAxisColumn] || 'Unknown';
                    const yValue = parseFloat(record.values?.[yAxisColumn]) || 0;
                    return {
                        name: String(xValue),
                        value: yValue,
                        [xCol.name]: String(xValue),
                        [yCol.name]: yValue
                    };
                });
            }
            
            // Otherwise, group and aggregate
            const groups: Record<string, number[]> = {};
            
            records.forEach(record => {
                const xValue = record.values?.[xAxisColumn] || 'Unknown';
                const yValue = parseFloat(record.values?.[yAxisColumn]) || 0;
                
                if (!groups[xValue]) groups[xValue] = [];
                groups[xValue].push(yValue);
            });

            return Object.entries(groups).map(([name, values]) => {
                const aggregatedValue = aggregate(values);
                return {
                    name,
                    value: Math.round(aggregatedValue * 100) / 100,
                    [xCol.name]: name,
                    [yCol.name]: Math.round(aggregatedValue * 100) / 100
                };
            }).sort((a, b) => b.value - a.value).slice(0, limit);
        }

        // No grouping - return raw values
        return records.slice(0, limit).map(record => ({
            name: record.values?.[xAxisColumn] || 'Item',
            value: parseFloat(record.values?.[yAxisColumn]) || 0,
            [xCol?.name || 'name']: record.values?.[xAxisColumn] || 'Item',
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
                sizeColumn,
                sourceColumn,
                targetColumn,
                dateColumn,
                severityColumn,
                labelColumn,
                trackColumn,
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

    const validationState = useMemo(() => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (template.id === 'ai_generated') return { errors, warnings };
        if (!selectedEntityId) {
            errors.push('Selecciona una entidad de datos.');
            return { errors, warnings };
        }

        const hasRows = previewData.length > 0;
        const xColName = allColumns.find(c => c.id === xAxisColumn)?.name;
        const groupColName = allColumns.find(c => c.id === groupBy)?.name;

        const uniqueCount = (keyCandidates: string[]) => {
            const values = new Set<string>();
            previewData.forEach((row) => {
                for (const key of keyCandidates) {
                    if (row[key] !== undefined && row[key] !== null && `${row[key]}`.trim() !== '') {
                        values.add(String(row[key]));
                        return;
                    }
                }
            });
            return values.size;
        };

        switch (template.id) {
            case 'heatmap': {
                if (!xAxisColumn || !yAxisColumn || !groupBy) {
                    errors.push('Heatmap requiere Category (X), Value (Y) y Row Category.');
                    break;
                }
                if (xAxisColumn === groupBy) {
                    errors.push('En Heatmap, Category (X) y Row Category deben ser columnas distintas.');
                }
                if (hasRows) {
                    const distinctX = uniqueCount([xColName || '', 'name']);
                    const distinctRows = uniqueCount([groupColName || '', 'category']);
                    if (distinctX < 2) {
                        errors.push('Heatmap necesita al menos 2 categorías distintas en X. Prueba otra columna en Category.');
                    }
                    if (distinctRows < 2) {
                        errors.push('Heatmap necesita al menos 2 categorías distintas en Row Category.');
                    }
                } else if (!isLoadingPreview) {
                    warnings.push('No hay filas en la previsualización para este Heatmap.');
                }
                break;
            }
            case 'sankey': {
                if (!sourceColumn || !targetColumn) {
                    errors.push('Sankey requiere Source Column y Target Column.');
                    break;
                }
                if (!(aggregation === 'count' || yAxisColumn)) {
                    errors.push('Selecciona Value (Y) o usa agregación Count para Sankey.');
                }
                if (sourceColumn === targetColumn) {
                    errors.push('Source y Target deben ser columnas distintas para Sankey.');
                }
                if (hasRows) {
                    const validLinks = previewData.filter(row => row.source && row.target && row.source !== row.target).length;
                    if (validLinks === 0) {
                        errors.push('No hay flujos válidos (source -> target). Cambia Source/Target o agregación.');
                    }
                }
                break;
            }
            case 'timeline': {
                if (!dateColumn) {
                    errors.push('Timeline requiere una columna de fecha/hora.');
                    break;
                }
                if (hasRows) {
                    const validDates = previewData.filter(row => {
                        const raw = row.start || row.date || row.timestamp || row.time;
                        return !Number.isNaN(new Date(raw).getTime());
                    }).length;
                    if (validDates === 0) {
                        errors.push('No se pudo parsear ninguna fecha. Selecciona otra Date/Time Column.');
                    } else if (validDates < previewData.length) {
                        warnings.push('Algunas filas tienen fecha inválida y no se dibujarán en Timeline.');
                    }
                }
                break;
            }
            case 'multi_timeline': {
                if (!dateColumn || !trackColumn) {
                    errors.push('Multi-Track Timeline requiere Date/Time y Track Column.');
                }
                break;
            }
            case 'bubble': {
                if (!xAxisColumn || !yAxisColumn) {
                    errors.push('Bubble requiere X y Y numéricos.');
                }
                if (xAxisColumn && yAxisColumn && xAxisColumn === yAxisColumn) {
                    warnings.push('X y Y usan la misma columna; el gráfico será poco informativo.');
                }
                break;
            }
            default: {
                if (!yAxisColumn) {
                    errors.push('Selecciona Value (Y-Axis).');
                }
            }
        }

        return { errors, warnings };
    }, [
        template.id,
        selectedEntityId,
        allColumns,
        xAxisColumn,
        yAxisColumn,
        groupBy,
        sourceColumn,
        targetColumn,
        dateColumn,
        trackColumn,
        aggregation,
        previewData,
        isLoadingPreview
    ]);
    const isValid = validationState.errors.length === 0;

    const previewInsights = useMemo(() => {
        if (previewData.length === 0) return null;

        if (template.id === 'sankey') {
            const uniqueSources = new Set(previewData.map((row) => row.source).filter(Boolean)).size;
            const uniqueTargets = new Set(previewData.map((row) => row.target).filter(Boolean)).size;
            const selfLoops = previewData.filter((row) => row.source && row.target && row.source === row.target).length;
            return {
                title: 'Flow quality',
                details: [
                    `${uniqueSources} unique sources`,
                    `${uniqueTargets} unique targets`,
                    `${selfLoops} self-loops`
                ]
            };
        }

        if (template.id === 'timeline' || template.id === 'multi_timeline') {
            const validDates = previewData.filter((row) => {
                const value = row.start || row.date || row.timestamp || row.time;
                return value && !Number.isNaN(new Date(value).getTime());
            }).length;
            const invalidDates = previewData.length - validDates;
            const tracks = template.id === 'multi_timeline'
                ? new Set(previewData.map((row) => row[allColumns.find(c => c.id === trackColumn)?.name || 'asset']).filter(Boolean)).size
                : null;
            return {
                title: 'Event quality',
                details: [
                    `${validDates} valid dates`,
                    invalidDates > 0 ? `${invalidDates} invalid dates` : 'No invalid dates',
                    tracks !== null ? `${tracks} tracks detected` : ''
                ].filter(Boolean)
            };
        }

        if (template.id === 'heatmap') {
            const xName = allColumns.find(c => c.id === xAxisColumn)?.name || 'name';
            const yName = allColumns.find(c => c.id === groupBy)?.name || 'category';
            const distinctX = new Set(previewData.map((row) => row[xName]).filter(Boolean)).size;
            const distinctY = new Set(previewData.map((row) => row[yName]).filter(Boolean)).size;
            return {
                title: 'Matrix coverage',
                details: [`${distinctX} X categories`, `${distinctY} row categories`]
            };
        }

        return null;
    }, [previewData, template.id, allColumns, trackColumn, xAxisColumn, groupBy]);

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
                            <div className="p-2 bg-[var(--accent-primary)] rounded-lg text-white">
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
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>

                            {/* Entity Selector */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Data Entity</label>
                                <select
                                    value={selectedEntityId}
                                    onChange={e => setSelectedEntityId(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
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
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
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
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                        >
                                            <option value="">Select column...</option>
                                            {numericColumns.map(col => (
                                                <option key={col.id} value={col.id}>{col.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Aggregation */}
                                    {(() => {
                                        // Check if X-axis is a date column (by name pattern, since type might vary)
                                        const xCol = allColumns.find(c => c.id === xAxisColumn);
                                        const isDateColumn = xCol && /fecha|date|time|timestamp/i.test(xCol.name);
                                        // For time-series charts (line, area), allow "None" option when X-axis is a date
                                        const isTimeSeriesChart = ['line_chart', 'area_chart'].includes(template.id);
                                        const showNoneOption = isTimeSeriesChart && isDateColumn;
                                        const aggregationOptions = showNoneOption ? AGGREGATIONS_WITH_NONE : AGGREGATIONS;
                                        
                                        return (
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Aggregation {showNoneOption && <span className="text-[var(--text-tertiary)]">(optional for time series)</span>}
                                                </label>
                                                <select
                                                    value={aggregation}
                                                    onChange={e => setAggregation(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    {aggregationOptions.map(agg => (
                                                        <option key={agg.value} value={agg.value}>{agg.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}

                                    {/* Heatmap row grouping */}
                                    {template.id === 'heatmap' && (
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                Row Category (Y-Axis)
                                            </label>
                                            <select
                                                value={groupBy}
                                                onChange={e => setGroupBy(e.target.value)}
                                                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                            >
                                                <option value="">Select column...</option>
                                                {allColumns.map(col => (
                                                    <option key={col.id} value={col.id}>{col.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {template.id === 'bubble' && (
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                Bubble Size (optional)
                                            </label>
                                            <select
                                                value={sizeColumn}
                                                onChange={e => setSizeColumn(e.target.value)}
                                                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                            >
                                                <option value="">Use Y value as size</option>
                                                {numericColumns.map(col => (
                                                    <option key={col.id} value={col.id}>{col.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {template.id === 'sankey' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Source Column
                                                </label>
                                                <select
                                                    value={sourceColumn}
                                                    onChange={e => setSourceColumn(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    <option value="">Select column...</option>
                                                    {allColumns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Target Column
                                                </label>
                                                <select
                                                    value={targetColumn}
                                                    onChange={e => setTargetColumn(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    <option value="">Select column...</option>
                                                    {allColumns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {(template.id === 'timeline' || template.id === 'multi_timeline') && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Date/Time Column
                                                </label>
                                                <select
                                                    value={dateColumn}
                                                    onChange={e => setDateColumn(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    <option value="">Select column...</option>
                                                    {allColumns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {template.id === 'multi_timeline' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                        Track Column
                                                    </label>
                                                    <select
                                                        value={trackColumn}
                                                        onChange={e => setTrackColumn(e.target.value)}
                                                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                    >
                                                        <option value="">Select column...</option>
                                                        {allColumns.map(col => (
                                                            <option key={col.id} value={col.id}>{col.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Severity Column (optional)
                                                </label>
                                                <select
                                                    value={severityColumn}
                                                    onChange={e => setSeverityColumn(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    <option value="">Default medium</option>
                                                    {allColumns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                                    Label Column (optional)
                                                </label>
                                                <select
                                                    value={labelColumn}
                                                    onChange={e => setLabelColumn(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                                >
                                                    <option value="">Use record id</option>
                                                    {allColumns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}

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
                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
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
                                                            ? 'border-[var(--accent-primary)]'
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
                                        {previewInsights && (
                                            <div className="mb-3 p-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                                <p className="text-[11px] font-medium text-[var(--text-secondary)]">{previewInsights.title}</p>
                                                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                                    {previewInsights.details.join(' • ')}
                                                </p>
                                            </div>
                                        )}
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                            {previewData.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 bg-[var(--bg-card)] rounded-lg text-xs">
                                                    <span className="text-[var(--text-primary)] truncate flex-1">
                                                        {item.name || item.source || item.label || item.target || `Item ${index + 1}`}
                                                    </span>
                                                    <span className="text-[var(--text-secondary)] font-mono ml-2">
                                                        {typeof item.value === 'number'
                                                            ? item.value.toLocaleString()
                                                            : typeof item.start === 'string'
                                                                ? item.start.slice(0, 10)
                                                                : item.value ?? '-'}
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
                    <div className="mr-auto">
                        {validationState.errors.length > 0 && (
                            <p className="text-xs text-red-500">
                                {validationState.errors[0]}
                            </p>
                        )}
                        {validationState.errors.length === 0 && validationState.warnings.length > 0 && (
                            <p className="text-xs text-amber-500">
                                {validationState.warnings[0]}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValid}
                        className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {submitLabel || 'Add Widget'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WidgetConfigurator;
