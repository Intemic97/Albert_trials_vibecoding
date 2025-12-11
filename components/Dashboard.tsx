import React, { useState } from 'react';
import { Entity } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Database, TrendingUp, Layers, Activity, Sparkles, X, Info } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { ProfileMenu } from './ProfileMenu';

interface DashboardProps {
    entities: Entity[];
    onNavigate?: (entityId: string) => void;
}

const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];

interface WidgetCardProps {
    widget: WidgetConfig;
    onSave?: (widget: WidgetConfig) => void;
    onRemove: () => void;
    isSaved?: boolean;
    onNavigate?: (entityId: string) => void;
    entities?: Entity[];
}

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, onSave, onRemove, isSaved, onNavigate, entities }) => {
    const [showExplanation, setShowExplanation] = useState(false);

    const renderExplanation = (text: string) => {
        if (!text) return null;

        // Regex to match @EntityName (assuming CamelCase or single word for now, or matching until non-word char)
        const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const entityName = part.substring(1);
                const entity = entities?.find(e => e.name === entityName);

                if (entity && onNavigate) {
                    return (
                        <span
                            key={index}
                            onClick={() => onNavigate(entity.id)}
                            className="text-teal-600 font-medium cursor-pointer hover:underline"
                            title={`View ${entityName} details`}
                        >
                            {part}
                        </span>
                    );
                }
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {!isSaved && onSave && (
                    <button
                        onClick={() => onSave(widget)}
                        className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Save to Dashboard"
                    >
                        <Database size={16} />
                    </button>
                )}
                <button
                    onClick={onRemove}
                    className={`p-1 text-slate-400 rounded transition-colors ${isSaved ? 'hover:text-red-500 hover:bg-red-50' : 'hover:text-red-500 hover:bg-red-50'}`}
                    title={isSaved ? "Delete Widget" : "Remove"}
                >
                    <X size={16} />
                </button>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 mb-1">{widget.title}</h3>
            <p className="text-xs text-slate-500 mb-4">{widget.description}</p>

            <DynamicChart config={widget} />

            {widget.explanation && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                        <Info size={12} />
                        How did I prepare this?
                    </button>

                    {showExplanation && (
                        <div className="mt-2 p-3 bg-teal-50 rounded-lg text-xs text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-1 whitespace-pre-wrap">
                            {renderExplanation(widget.explanation)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ entities, onNavigate }) => {
    const [generatedWidgets, setGeneratedWidgets] = useState<WidgetConfig[]>([]);
    const [savedWidgets, setSavedWidgets] = useState<WidgetConfig[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch saved widgets on mount
    React.useEffect(() => {
        fetchWidgets();
    }, []);

    const fetchWidgets = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/widgets', { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setSavedWidgets(data.map((w: any) => ({ ...w.config, id: w.id })));
            } else {
                setSavedWidgets([]);
            }
        } catch (error) {
            console.error('Error fetching widgets:', error);
            setSavedWidgets([]);
        }
    };

    // Calculate statistics
    const totalEntities = entities.length;
    const totalProperties = entities.reduce((sum, e) => sum + e.properties.length, 0);
    const avgPropertiesPerEntity = totalEntities > 0 ? (totalProperties / totalEntities).toFixed(1) : 0;

    // Data for entities by property count (Bar Chart)
    const entitiesByPropertyCount = entities.map(e => ({
        name: e.name.length > 15 ? e.name.substring(0, 15) + '...' : e.name,
        properties: e.properties.length
    })).sort((a, b) => b.properties - a.properties);

    // Data for entity distribution (Pie Chart)
    const propertyTypes = entities.map(e => {
        const relationCount = e.properties.filter(p => p.type === 'relation').length;
        const textCount = e.properties.filter(p => p.type === 'text').length;
        const numberCount = e.properties.filter(p => p.type === 'number').length;
        return { name: e.name, relations: relationCount, text: textCount, numbers: numberCount };
    });

    const totalRelations = propertyTypes.reduce((sum, e) => sum + e.relations, 0);
    const totalText = propertyTypes.reduce((sum, e) => sum + e.text, 0);
    const totalNumbers = propertyTypes.reduce((sum, e) => sum + e.numbers, 0);

    const pieData = [
        { name: 'Relations', value: totalRelations },
        { name: 'Text', value: totalText },
        { name: 'Numbers', value: totalNumbers }
    ].filter(d => d.value > 0);

    // Mock time series data (Area Chart)
    const timeSeriesData = [
        { month: 'Jan', entities: Math.max(0, totalEntities - 5), properties: Math.max(0, totalProperties - 15) },
        { month: 'Feb', entities: Math.max(0, totalEntities - 4), properties: Math.max(0, totalProperties - 12) },
        { month: 'Mar', entities: Math.max(0, totalEntities - 3), properties: Math.max(0, totalProperties - 9) },
        { month: 'Apr', entities: Math.max(0, totalEntities - 2), properties: Math.max(0, totalProperties - 6) },
        { month: 'May', entities: Math.max(0, totalEntities - 1), properties: Math.max(0, totalProperties - 3) },
        { month: 'Jun', entities: totalEntities, properties: totalProperties }
    ];

    // Top entities by complexity score (Line Chart)
    const complexityData = entities.map(e => {
        const relationCount = e.properties.filter(p => p.type === 'relation').length;
        const complexity = e.properties.length + (relationCount * 2); // Relations add more complexity
        return {
            name: e.name.length > 12 ? e.name.substring(0, 12) + '...' : e.name,
            complexity
        };
    }).sort((a, b) => b.complexity - a.complexity).slice(0, 6);

    const handleGenerateWidget = async (prompt: string, mentionedEntityIds: string[]) => {
        setIsGenerating(true);
        try {
            const res = await fetch('http://localhost:3001/api/generate-widget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds
                }),
                credentials: 'include'
            });

            const widgetConfig = await res.json();
            if (widgetConfig.error) {
                throw new Error(widgetConfig.error);
            }

            setGeneratedWidgets(prev => [widgetConfig, ...prev]);
        } catch (error) {
            console.error('Error generating widget:', error);
            alert('Failed to generate widget. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveWidget = async (widget: WidgetConfig) => {
        try {
            const id = crypto.randomUUID();
            const res = await fetch('http://localhost:3001/api/widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: widget.title,
                    description: widget.description,
                    config: widget
                }),
                credentials: 'include'
            });

            if (res.ok) {
                // Add to saved widgets and remove from generated
                setSavedWidgets(prev => [{ ...widget, id: id as any }, ...prev]);
                setGeneratedWidgets(prev => prev.filter(w => w !== widget));
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            alert('Failed to save widget.');
        }
    };

    const removeWidget = async (index: number, isSaved: boolean = false, widgetId?: string) => {
        if (isSaved && widgetId) {
            try {
                await fetch(`http://localhost:3001/api/widgets/${widgetId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                setSavedWidgets(prev => prev.filter(w => (w as any).id !== widgetId));
            } catch (error) {
                console.error('Error deleting widget:', error);
            }
        } else {
            setGeneratedWidgets(prev => prev.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <Activity className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
                        <p className="text-xs text-slate-500">Visual analytics and insights</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* AI Widget Generator */}
                    <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="text-teal-100" size={24} />
                            <h2 className="text-lg font-bold">AI Widget Generator</h2>
                        </div>
                        <p className="text-teal-50 text-sm mb-6">
                            Ask a question about your data to generate a custom chart. Try "Show me a bar chart of @Entities by property count". <strong>Press Enter to generate.</strong>
                        </p>
                        <PromptInput
                            entities={entities}
                            onGenerate={handleGenerateWidget}
                            isGenerating={isGenerating}
                            placeholder="Describe the chart you want to create..."
                            buttonLabel="Generate Widget"
                            className="bg-white rounded-lg shadow-inner text-slate-800"
                        />
                    </div>

                    {/* Generated Widgets Section */}
                    {generatedWidgets.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Sparkles size={18} className="text-teal-500" />
                                Custom Insights
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {generatedWidgets.map((widget, index) => (
                                    <WidgetCard
                                        key={index}
                                        widget={widget}
                                        onSave={handleSaveWidget}
                                        onRemove={() => removeWidget(index)}
                                        onNavigate={onNavigate}
                                        entities={entities}
                                    />
                                ))}
                            </div>
                            <div className="border-b border-slate-200 my-8" />
                        </div>
                    )}

                    {/* Saved Widgets Section */}
                    {savedWidgets.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 mb-8">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Database size={18} className="text-teal-500" />
                                Saved Dashboards
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {savedWidgets.map((widget, index) => (
                                    <WidgetCard
                                        key={(widget as any).id || index}
                                        widget={widget}
                                        onRemove={() => removeWidget(index, true, (widget as any).id)}
                                        isSaved={true}
                                        onNavigate={onNavigate}
                                        entities={entities}
                                    />
                                ))}
                            </div>
                            <div className="border-b border-slate-200 my-8" />
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Entities */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Entities</p>
                                    <p className="text-3xl font-bold text-slate-800 mt-2">{totalEntities}</p>
                                </div>
                                <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                                    <Database className="text-teal-600" size={24} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-xs text-slate-500">
                                <TrendingUp size={14} className="mr-1 text-green-500" />
                                Active data structures
                            </div>
                        </div>

                        {/* Total Properties */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Properties</p>
                                    <p className="text-3xl font-bold text-slate-800 mt-2">{totalProperties}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <Layers className="text-blue-600" size={24} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-xs text-slate-500">
                                <TrendingUp size={14} className="mr-1 text-green-500" />
                                Schema definitions
                            </div>
                        </div>

                        {/* Average Properties */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Avg Properties/Entity</p>
                                    <p className="text-3xl font-bold text-slate-800 mt-2">{avgPropertiesPerEntity}</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <Activity className="text-purple-600" size={24} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-xs text-slate-500">
                                <TrendingUp size={14} className="mr-1 text-green-500" />
                                Entity complexity
                            </div>
                        </div>
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar Chart - Properties per Entity */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Properties per Entity</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={entitiesByPropertyCount}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                                    />
                                    <Bar dataKey="properties" fill="#0d9488" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pie Chart - Property Type Distribution */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Property Type Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Line Chart - Entity Complexity */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Entity Complexity Score</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={complexityData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="complexity"
                                        stroke="#0d9488"
                                        strokeWidth={3}
                                        dot={{ fill: '#0d9488', r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-slate-500 mt-2">
                                Complexity = Properties + (Relations × 2)
                            </p>
                        </div>

                        {/* Area Chart - Growth Trend */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Growth Trend (6 Months)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={timeSeriesData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="entities"
                                        stackId="1"
                                        stroke="#0d9488"
                                        fill="#0d9488"
                                        fillOpacity={0.6}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="properties"
                                        stackId="2"
                                        stroke="#14b8a6"
                                        fill="#14b8a6"
                                        fillOpacity={0.4}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-slate-500 mt-2">
                                Simulated growth data based on current metrics
                            </p>
                        </div>
                    </div>

                    {/* Additional Info Panel */}
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-sm p-6 text-white">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Data Model Summary</h3>
                                <p className="text-teal-50 text-sm mb-4">
                                    Your database contains {totalEntities} entities with a total of {totalProperties} properties.
                                    {totalRelations > 0 && ` ${totalRelations} relationships connect your data structures.`}
                                </p>
                                <div className="flex gap-4 text-sm">
                                    <div className="bg-white/20 rounded-lg px-3 py-2">
                                        <span className="font-semibold">{totalRelations}</span> Relations
                                    </div>
                                    <div className="bg-white/20 rounded-lg px-3 py-2">
                                        <span className="font-semibold">{totalText}</span> Text Fields
                                    </div>
                                    <div className="bg-white/20 rounded-lg px-3 py-2">
                                        <span className="font-semibold">{totalNumbers}</span> Number Fields
                                    </div>
                                </div>
                            </div>
                            <Database className="text-white/80" size={48} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

