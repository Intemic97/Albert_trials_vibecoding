import React from 'react';
import { Entity } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Database, TrendingUp, Layers, Activity } from 'lucide-react';

interface DashboardProps {
    entities: Entity[];
}

const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];

export const Dashboard: React.FC<DashboardProps> = ({ entities }) => {
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
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">

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
