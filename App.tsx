import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { EntityCard } from './components/EntityCard';
import { Reporting } from './components/Reporting';
import { Dashboard } from './components/Dashboard';
import { Workflows } from './components/Workflows';
import { LoginPage } from './components/LoginPage';
import { Settings } from './components/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Entity, Property, PropertyType } from './types';
import { Plus, Search, Filter, ArrowLeft, Trash2, Database, Link as LinkIcon, Type, Hash, Pencil, X, Code } from 'lucide-react';
import { ProfileMenu } from './components/ProfileMenu';
import { API_BASE } from './config';

export default function App() {
    return (
        <AuthProvider>
            <AuthenticatedApp />
        </AuthProvider>
    );
}

function AuthenticatedApp() {
    const { isAuthenticated, isLoading } = useAuth();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState('database');

    // New Property State
    const [isAddingProp, setIsAddingProp] = useState(false);
    const [newPropName, setNewPropName] = useState('');
    const [newPropType, setNewPropType] = useState<PropertyType>('text');
    const [newPropRelationId, setNewPropRelationId] = useState<string>('');

    // New Entity State
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');

    // Records State
    const [activeTab, setActiveTab] = useState<'structure' | 'data'>('structure');
    const [records, setRecords] = useState<any[]>([]);
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [newRecordValues, setNewRecordValues] = useState<Record<string, any>>({});

    // Relations State
    const [relatedData, setRelatedData] = useState<Record<string, { entity: Entity, records: any[] }>>({});
    const [incomingData, setIncomingData] = useState<Record<string, { sourceEntity: Entity, sourceProperty: Property, records: any[] }>>({});

    // Side Panel State
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [selectedRecordEntity, setSelectedRecordEntity] = useState<Entity | null>(null);

    // Editing Schema State (for editing records from side panel)
    const [editingSchema, setEditingSchema] = useState<Entity | null>(null);

    const activeEntity = entities.find(e => e.id === activeEntityId);

    // Database Tab State
    const [databaseTab, setDatabaseTab] = useState<'company' | 'entities'>('entities');

    // Entity Search State
    const [entitySearchQuery, setEntitySearchQuery] = useState('');

    // Company Information State
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        industry: '',
        employees: '',
        website: '',
        linkedinUrl: '',
        headquarters: '',
        foundingYear: '',
        overview: ''
    });

    // Fetch Entities on Mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchEntities();
        }
    }, [isAuthenticated]);

    // Fetch Records when active entity or tab changes
    useEffect(() => {
        if (activeEntityId && activeTab === 'data') {
            fetchRecords();
            fetchRelatedData();
            fetchIncomingData();
        }
    }, [activeEntityId, activeTab]);

    const fetchEntities = async () => {
        try {
            const res = await fetch(`${API_BASE}/entities`, { credentials: 'include' });
            const data = await res.json();
            // Ensure data is an array before setting
            if (Array.isArray(data)) {
                setEntities(data);
            } else {
                console.error('Expected array from entities API, got:', data);
                setEntities([]);
            }
        } catch (error) {
            console.error('Error fetching entities:', error);
            setEntities([]);
        }
    };

    const fetchCompanyInfo = async () => {
        try {
            const res = await fetch(`${API_BASE}/company`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setCompanyInfo(data);
            }
        } catch (error) {
            console.error('Error fetching company info:', error);
        }
    };

    const updateCompanyInfo = async () => {
        try {
            await fetch(`${API_BASE}/company`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(companyInfo),
                credentials: 'include'
            });
            alert('Company information saved successfully!');
        } catch (error) {
            console.error('Error saving company info:', error);
            alert('Failed to save company information');
        }
    };

    const fetchRecords = async () => {
        if (!activeEntityId) return;
        try {
            const res = await fetch(`${API_BASE}/entities/${activeEntityId}/records`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setRecords(data);
            } else {
                console.error('Expected array from records API, got:', data);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            setRecords([]);
        }
    };

    const fetchRelatedData = async () => {
        if (!activeEntity) return;

        const relationProps = activeEntity.properties.filter(p => p.type === 'relation' && p.relatedEntityId);
        const newRelatedData: Record<string, { entity: Entity, records: any[] }> = {};

        for (const prop of relationProps) {
            if (!prop.relatedEntityId) continue;
            try {
                const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);

                if (relatedEntity) {
                    const res = await fetch(`${API_BASE}/entities/${prop.relatedEntityId}/records`, { credentials: 'include' });
                    const records = await res.json();
                    newRelatedData[prop.relatedEntityId] = { entity: relatedEntity, records };
                }
            } catch (error) {
                console.error(`Error fetching related data for ${prop.relatedEntityId}:`, error);
            }
        }
        setRelatedData(newRelatedData);
    };

    const fetchIncomingData = async () => {
        if (!activeEntityId) return;

        const newIncomingData: Record<string, { sourceEntity: Entity, sourceProperty: Property, records: any[] }> = {};

        for (const entity of entities) {
            // Find properties in other entities that point to THIS entity
            const pointingProps = entity.properties.filter(p => p.type === 'relation' && p.relatedEntityId === activeEntityId);

            for (const prop of pointingProps) {
                try {
                    const res = await fetch(`${API_BASE}/entities/${entity.id}/records`, { credentials: 'include' });
                    const records = await res.json();
                    newIncomingData[prop.id] = { sourceEntity: entity, sourceProperty: prop, records };
                } catch (error) {
                    console.error(`Error fetching incoming data from ${entity.name}:`, error);
                }
            }
        }
        setIncomingData(newIncomingData);
    };

    const handleCreateEntity = async () => {
        if (!newEntityName.trim()) return;

        const newEntity = {
            id: Math.random().toString(36).substr(2, 9),
            name: newEntityName,
            description: newEntityDescription,
            author: 'User', // Hardcoded for now
            lastEdited: 'Just now',
            properties: []
        };

        try {
            await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntity),
                credentials: 'include'
            });

            await fetchEntities();

            // Reset and Close
            setNewEntityName('');
            setNewEntityDescription('');
            setIsCreatingEntity(false);
        } catch (error) {
            console.error('Error creating entity:', error);
        }
    };

    const handleDeleteEntity = async (entity: Entity) => {
        try {
            await fetch(`${API_BASE}/entities/${entity.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchEntities();
        } catch (error) {
            console.error('Error deleting entity:', error);
        }
    };

    const handleAddProperty = async () => {
        if (!newPropName.trim() || !activeEntityId) return;

        const newProp: Property = {
            id: Math.random().toString(36).substr(2, 9),
            name: newPropName,
            type: newPropType,
            relatedEntityId: newPropType === 'relation' ? newPropRelationId : undefined,
            defaultValue: newPropType === 'number' ? 0 : '',
        };

        try {
            await fetch(`${API_BASE}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newProp, entityId: activeEntityId }),
                credentials: 'include'
            });

            // Refresh data
            await fetchEntities();

            // Reset Form
            setNewPropName('');
            setNewPropType('text');
            setNewPropRelationId('');
            setIsAddingProp(false);

        } catch (error) {
            console.error('Error adding property:', error);
        }
    };

    const deleteProperty = async (propId: string) => {
        try {
            await fetch(`${API_BASE}/properties/${propId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchEntities();
        } catch (error) {
            console.error('Error deleting property:', error);
        }
    };

    const handleSaveRecord = async () => {
        const targetEntityId = editingSchema?.id || activeEntityId;
        if (!targetEntityId) return;

        const processedValues = { ...newRecordValues };

        for (const key in processedValues) {
            if (Array.isArray(processedValues[key])) {
                processedValues[key] = JSON.stringify(processedValues[key]);
            }
        }

        try {
            if (editingRecordId) {
                // Update existing record
                await fetch(`${API_BASE}/records/${editingRecordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        values: processedValues
                    }),
                    credentials: 'include'
                });
            } else {
                // Create new record
                await fetch(`${API_BASE}/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entityId: targetEntityId,
                        values: processedValues
                    }),
                    credentials: 'include'
                });
            }

            // Refresh all data to ensure consistency
            if (activeEntityId) {
                await fetchRecords();
                await fetchRelatedData();
                await fetchIncomingData();
            }

            setIsAddingRecord(false);
            setEditingRecordId(null);
            setEditingSchema(null);
            setNewRecordValues({});
        } catch (error) {
            console.error('Error saving record:', error);
        }
    };

    const handleEditRecord = (record: any, entity?: Entity) => {
        const schema = entity || activeEntity;
        if (!schema) return;

        const values: Record<string, any> = {};

        // Parse JSON strings back to arrays for relations if needed
        schema.properties.forEach(prop => {
            const val = record.values[prop.id];
            if (prop.type === 'relation' && val) {
                try {
                    const parsed = JSON.parse(val);
                    values[prop.id] = parsed;
                } catch {
                    values[prop.id] = val;
                }
            } else {
                values[prop.id] = val;
            }
        });

        setNewRecordValues(values);
        setEditingRecordId(record.id);
        setEditingSchema(schema);
        setIsAddingRecord(true);
    };

    const deleteRecord = async (recordId: string) => {
        try {
            await fetch(`${API_BASE}/records/${recordId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchRecords();
        } catch (error) {
            console.error('Error deleting record:', error);
        }
    };

    const getRelatedEntityName = (id?: string) => {
        if (!id) return 'Unknown';
        const found = entities.find(e => e.id === id);
        return found ? found.name : 'Deleted Entity';
    };

    const getRecordDisplayName = (record: any, entity: Entity) => {
        // 1. Try to find a property named "name" or "title"
        const nameProp = entity.properties.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
        if (nameProp && record.values[nameProp.id]) {
            return record.values[nameProp.id];
        }

        // 2. Fallback to the first "text" property
        const firstTextProp = entity.properties.find(p => p.type === 'text');
        if (firstTextProp && record.values[firstTextProp.id]) {
            return record.values[firstTextProp.id];
        }

        // 3. Fallback to the first "number" property
        const firstNumberProp = entity.properties.find(p => p.type === 'number');
        if (firstNumberProp && record.values[firstNumberProp.id]) {
            return record.values[firstNumberProp.id];
        }

        return 'Untitled Record';
    };

    const handleRecordClick = (record: any, entity: Entity) => {
        setSelectedRecord(record);
        setSelectedRecordEntity(entity);
    };

    const renderCellValue = (prop: Property, value: any) => {
        if (!value) return '-';

        if (prop.type === 'json') {
            return (
                <div className="font-mono text-xs text-slate-600 bg-slate-100 p-1 rounded truncate max-w-[200px]" title={typeof value === 'string' ? value : JSON.stringify(value)}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                </div>
            );
        }

        if (prop.type === 'relation' && prop.relatedEntityId) {
            try {
                const ids = JSON.parse(value);
                if (Array.isArray(ids)) {
                    const relatedInfo = relatedData[prop.relatedEntityId];
                    if (!relatedInfo) return 'Loading...';

                    return (
                        <div className="flex flex-wrap gap-1">
                            {ids.map(id => {
                                const rec = relatedInfo.records.find(r => r.id === id);
                                return (
                                    <button
                                        key={id}
                                        onClick={() => rec && handleRecordClick(rec, relatedInfo.entity)}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors"
                                    >
                                        {rec ? getRecordDisplayName(rec, relatedInfo.entity) : 'Unknown'}
                                    </button>
                                );
                            })}
                        </div>
                    );
                }
            } catch (e) {
                return value;
            }
        }
        return value;
    };

    const renderIconForType = (type: PropertyType) => {
        switch (type) {
            case 'text': return <Type size={16} className="text-slate-400" />;
            case 'number': return <Hash size={16} className="text-slate-400" />;
            case 'relation': return <LinkIcon size={16} className="text-teal-500" />;
            case 'json': return <Code size={16} className="text-amber-500" />;
        }
    };

    const currentSchema = editingSchema || activeEntity;

    if (isLoading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
            <Sidebar activeView={currentView} onNavigate={setCurrentView} />

            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {currentView === 'dashboard' ? (
                    <Dashboard
                        entities={entities}
                        onNavigate={(entityId) => {
                            setActiveEntityId(entityId);
                            setCurrentView('database');
                            setActiveTab('data');
                        }}
                        onViewChange={setCurrentView}
                    />
                ) : currentView === 'workflows' ? (
                    <Workflows entities={entities} onViewChange={setCurrentView} />
                ) : currentView === 'reports' ? (
                    <Reporting entities={entities} companyInfo={companyInfo} onViewChange={setCurrentView} />
                ) : currentView === 'settings' ? (
                    <Settings onViewChange={setCurrentView} />
                ) : (
                    <>
                        {/* Top Header */}
                        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
                            {activeEntity ? (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setActiveEntityId(null)}
                                        className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            <Database size={20} className="text-teal-600" />
                                            {activeEntity.name}
                                        </h1>
                                        <p className="text-xs text-slate-500">Managing structure properties</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800">Your database</h1>
                                    <p className="text-sm text-slate-500">View and manage your different entities</p>
                                </div>
                            )}

                            <div className="flex items-center space-x-4">
                                <ProfileMenu onNavigate={setCurrentView} />
                            </div>
                        </header>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">

                            {/* LIST VIEW */}
                            {!activeEntityId && (
                                <div className="space-y-6">
                                    {/* Database Tabs */}
                                    <div className="flex space-x-6 border-b border-slate-200 mb-6">
                                        <button
                                            onClick={() => setDatabaseTab('company')}
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${databaseTab === 'company'
                                                ? 'border-teal-600 text-teal-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Company Information
                                        </button>
                                        <button
                                            onClick={() => setDatabaseTab('entities')}
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${databaseTab === 'entities'
                                                ? 'border-teal-600 text-teal-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Entities
                                        </button>
                                    </div>

                                    {/* Company Information Tab */}
                                    {databaseTab === 'company' && (
                                        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h2 className="text-lg font-semibold text-slate-800">Company Profile</h2>
                                                    <p className="text-sm text-slate-500">Manage your company's core information.</p>
                                                </div>
                                                <button
                                                    onClick={updateCompanyInfo}
                                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                                    <input
                                                        type="text"
                                                        value={companyInfo.name}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                                                    <input
                                                        type="text"
                                                        value={companyInfo.industry}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, industry: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Number of Employees</label>
                                                    <select
                                                        value={companyInfo.employees}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, employees: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="1-10">1-10</option>
                                                        <option value="11-50">11-50</option>
                                                        <option value="51-200">51-200</option>
                                                        <option value="201-500">201-500</option>
                                                        <option value="500+">500+</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                                                    <input
                                                        type="url"
                                                        value={companyInfo.website}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                                                    <input
                                                        type="url"
                                                        value={companyInfo.linkedinUrl}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, linkedinUrl: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Headquarters Location</label>
                                                    <input
                                                        type="text"
                                                        value={companyInfo.headquarters}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, headquarters: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Founding Year</label>
                                                    <input
                                                        type="text"
                                                        value={companyInfo.foundingYear}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, foundingYear: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                    />
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Overview</label>
                                                    <textarea
                                                        rows={4}
                                                        value={companyInfo.overview}
                                                        onChange={(e) => setCompanyInfo({ ...companyInfo, overview: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                        placeholder="Brief overview of your company..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Entities Tab (Existing View) */}
                                    {databaseTab === 'entities' && (
                                        <div className="space-y-6">
                                            {/* Toolbar */}
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm text-slate-500">
                                                    {entitySearchQuery 
                                                        ? `Showing ${entities.filter(e => e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) || e.description?.toLowerCase().includes(entitySearchQuery.toLowerCase())).length} of ${entities.length} entities`
                                                        : `Total: ${entities.length} entities`
                                                    }
                                                </div>
                                                <div className="flex space-x-3">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                                        <input
                                                            type="text"
                                                            placeholder="Search entities..."
                                                            value={entitySearchQuery}
                                                            onChange={(e) => setEntitySearchQuery(e.target.value)}
                                                            className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-64 shadow-sm"
                                                        />
                                                    </div>
                                                    <button className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
                                                        <Filter size={16} className="mr-2" />
                                                        Filter
                                                    </button>
                                                    <button
                                                        onClick={() => setIsCreatingEntity(true)}
                                                        className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
                                                    >
                                                        <Plus size={16} className="mr-2" />
                                                        Create Entity
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                                {entities
                                                    .filter(entity => 
                                                        entity.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) ||
                                                        entity.description?.toLowerCase().includes(entitySearchQuery.toLowerCase())
                                                    )
                                                    .map(entity => (
                                                    <EntityCard
                                                        key={entity.id}
                                                        entity={entity}
                                                        onClick={(e) => {
                                                            setActiveEntityId(e.id);
                                                            setActiveTab('data');
                                                        }}
                                                        onDelete={handleDeleteEntity}
                                                    />
                                                ))}

                                                {/* Empty State / Add New Placeholder */}
                                                <div
                                                    onClick={() => setIsCreatingEntity(true)}
                                                    className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center min-h-[200px] text-slate-400 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all cursor-pointer group"
                                                >
                                                    <div className="p-4 bg-slate-100 rounded-full mb-3 group-hover:bg-white">
                                                        <Plus size={24} />
                                                    </div>
                                                    <span className="font-medium">Create new entity</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* DETAIL VIEW */}
                            {activeEntity && (
                                <div className="max-w-6xl mx-auto space-y-8">

                                    {/* Tab Switcher */}
                                    <div className="flex space-x-6 border-b border-slate-200">
                                        <button
                                            onClick={() => setActiveTab('structure')}
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'structure'
                                                ? 'border-teal-600 text-teal-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Structure & Properties
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('data')}
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'data'
                                                ? 'border-teal-600 text-teal-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Data Records
                                        </button>
                                    </div>

                                    {/* STRUCTURE TAB */}
                                    {activeTab === 'structure' && (
                                        <>
                                            {/* Overview Panel */}
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Structure Overview</h2>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                                                        <p className="text-slate-700">{activeEntity.description || 'No description provided.'}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Metadata</label>
                                                        <div className="text-sm text-slate-600 space-y-1">
                                                            <p>Created by: <span className="font-medium text-slate-800">{activeEntity.author}</span></p>
                                                            <p>Last modified: <span className="font-medium text-slate-800">{activeEntity.lastEdited}</span></p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Properties Panel */}
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-slate-800">Properties</h2>
                                                        <p className="text-sm text-slate-500">Define the data structure for this entity.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsAddingProp(true)}
                                                        className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                                    >
                                                        <Plus size={16} className="mr-2" />
                                                        Add Property
                                                    </button>
                                                </div>
                                                {/* Property List */}
                                                <div className="divide-y divide-slate-100">
                                                    {activeEntity.properties.length === 0 ? (
                                                        <div className="p-12 text-center text-slate-500">
                                                            No properties defined yet. Click "Add Property" to start modeling.
                                                        </div>
                                                    ) : (
                                                        activeEntity.properties.map(prop => (
                                                            <div key={prop.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                                                        {renderIconForType(prop.type)}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-sm font-bold text-slate-800">{prop.name}</h3>
                                                                        <p className="text-xs text-slate-500 flex items-center mt-0.5">
                                                                            <span className="uppercase tracking-wider font-semibold mr-2">{prop.type}</span>
                                                                            {prop.type === 'relation' && (
                                                                                <span className="bg-teal-100 text-teal-800 px-1.5 rounded text-[10px]">
                                                                                    → {getRelatedEntityName(prop.relatedEntityId)}
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="text-xs text-right text-slate-400 mr-4">
                                                                        Example Value:<br />
                                                                        <span className="text-slate-600 font-mono">
                                                                            {prop.type === 'relation' ? 'ID-REF-123' : prop.defaultValue}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => deleteProperty(prop.id)}
                                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Add Property Form Area */}
                                                {isAddingProp && (
                                                    <div className="p-6 bg-slate-50 border-t border-slate-200 animate-in fade-in slide-in-from-top-4 duration-200">
                                                        <h3 className="text-sm font-bold text-slate-800 mb-4">New Property</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                                            <div className="md:col-span-4">
                                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    value={newPropName}
                                                                    onChange={(e) => setNewPropName(e.target.value)}
                                                                    placeholder="e.g. Serial Number"
                                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                                />
                                                            </div>
                                                            <div className="md:col-span-3">
                                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                                                                <select
                                                                    value={newPropType}
                                                                    onChange={(e) => setNewPropType(e.target.value as PropertyType)}
                                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="number">Number</option>
                                                                    <option value="json">JSON</option>
                                                                    <option value="relation">Relation</option>
                                                                </select>
                                                            </div>

                                                            {newPropType === 'relation' && (
                                                                <div className="md:col-span-3">
                                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Related Structure</label>
                                                                    <select
                                                                        value={newPropRelationId}
                                                                        onChange={(e) => setNewPropRelationId(e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                                    >
                                                                        <option value="">Select entity...</option>
                                                                        {entities
                                                                            .filter(e => e.id !== activeEntity.id) // Prevent self-reference for simplicity
                                                                            .map(e => (
                                                                                <option key={e.id} value={e.id}>{e.name}</option>
                                                                            ))}
                                                                    </select>
                                                                </div>
                                                            )}

                                                            <div className="md:col-span-2 flex space-x-2">
                                                                <button
                                                                    onClick={handleAddProperty}
                                                                    disabled={!newPropName || (newPropType === 'relation' && !newPropRelationId)}
                                                                    className="flex-1 py-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsAddingProp(false)}
                                                                    className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* DATA TAB */}
                                    {activeTab === 'data' && (
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                <div>
                                                    <h2 className="text-lg font-semibold text-slate-800">Data Records</h2>
                                                    <p className="text-sm text-slate-500">Manage the actual data for this entity.</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingRecordId(null);
                                                        setNewRecordValues({});
                                                        setIsAddingRecord(true);
                                                    }}
                                                    className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                                >
                                                    <Plus size={16} className="mr-2" />
                                                    Add Record
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200">
                                                            {activeEntity.properties.map(prop => (
                                                                <th key={prop.id} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                                    {prop.name}
                                                                </th>
                                                            ))}
                                                            {/* Incoming Relations Headers */}
                                                            {Object.values(incomingData).map(({ sourceEntity, sourceProperty }) => (
                                                                <th key={sourceProperty.id} className="px-6 py-3 text-xs font-semibold text-teal-600 uppercase tracking-wider bg-teal-50/50">
                                                                    {sourceEntity.name} ({sourceProperty.name})
                                                                </th>
                                                            ))}
                                                            <th className="px-6 py-3 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {records.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={activeEntity.properties.length + 1 + Object.keys(incomingData).length} className="p-12 text-center text-slate-500">
                                                                    No records found. Click "Add Record" to create one.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            records.map(record => (
                                                                <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                                                                    {activeEntity.properties.map(prop => (
                                                                        <td key={prop.id} className="px-6 py-4 text-sm text-slate-700">
                                                                            {renderCellValue(prop, record.values[prop.id])}
                                                                        </td>
                                                                    ))}
                                                                    {/* Incoming Relations Cells */}
                                                                    {Object.values(incomingData).map(({ sourceEntity, sourceProperty, records: sourceRecords }) => {
                                                                        const linkedRecords = sourceRecords.filter(r => {
                                                                            const val = r.values[sourceProperty.id];
                                                                            if (!val) return false;
                                                                            try {
                                                                                const ids = JSON.parse(val);
                                                                                return Array.isArray(ids) && ids.includes(record.id);
                                                                            } catch {
                                                                                return val === record.id;
                                                                            }
                                                                        });

                                                                        return (
                                                                            <td key={sourceProperty.id} className="px-6 py-4 text-sm text-slate-700 bg-teal-50/10">
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {linkedRecords.length > 0 ? linkedRecords.map(lr => (
                                                                                        <button
                                                                                            key={lr.id}
                                                                                            onClick={() => handleRecordClick(lr, sourceEntity)}
                                                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200 transition-colors"
                                                                                        >
                                                                                            {getRecordDisplayName(lr, sourceEntity)}
                                                                                        </button>
                                                                                    )) : <span className="text-slate-400 text-xs italic">None</span>}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button
                                                                            onClick={() => handleEditRecord(record)}
                                                                            className="p-2 text-slate-300 hover:text-teal-500 hover:bg-teal-50 rounded transition-colors opacity-0 group-hover:opacity-100 mr-2"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteRecord(record.id)}
                                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Side Panel for Record Details */}
                        {selectedRecord && selectedRecordEntity && (
                            <div className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">
                                            {getRecordDisplayName(selectedRecord, selectedRecordEntity)}
                                        </h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
                                            {selectedRecordEntity.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {
                                                handleEditRecord(selectedRecord, selectedRecordEntity);
                                                setSelectedRecord(null);
                                            }}
                                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                        <button
                                            onClick={() => setSelectedRecord(null)}
                                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {selectedRecordEntity.properties.map(prop => (
                                        <div key={prop.id}>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                                {prop.name}
                                            </label>
                                            <div className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                {prop.type === 'relation' ? (
                                                    renderCellValue(prop, selectedRecord.values[prop.id])
                                                ) : (
                                                    selectedRecord.values[prop.id] || '-'
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                                            Record ID
                                        </label>
                                        <p className="text-xs font-mono text-slate-400">{selectedRecord.id}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Create Entity Modal */}
                        {isCreatingEntity && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-bold text-slate-800 mb-4">Create New Entity</h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Entity Name</label>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newEntityName}
                                                onChange={(e) => setNewEntityName(e.target.value)}
                                                placeholder="e.g. Products"
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                            <textarea
                                                value={newEntityDescription}
                                                onChange={(e) => setNewEntityDescription(e.target.value)}
                                                placeholder="Describe what this entity represents..."
                                                rows={3}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6">
                                        <button
                                            onClick={() => setIsCreatingEntity(false)}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateEntity}
                                            disabled={!newEntityName.trim()}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Create Entity
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add/Edit Record Modal */}
                        {isAddingRecord && currentSchema && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-bold text-slate-800 mb-4">{editingRecordId ? 'Edit Record' : 'Add New Record'}</h2>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {currentSchema.properties.map(prop => {
                                            if (prop.type === 'relation' && prop.relatedEntityId) {
                                                const relatedInfo = relatedData[prop.relatedEntityId];
                                                return (
                                                    <div key={prop.id}>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{prop.name}</label>
                                                        <select
                                                            multiple
                                                            value={newRecordValues[prop.id] || []}
                                                            onChange={(e) => {
                                                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                                                setNewRecordValues({ ...newRecordValues, [prop.id]: selectedOptions });
                                                            }}
                                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[100px]"
                                                        >
                                                            {relatedInfo?.records.map(rec => (
                                                                <option key={rec.id} value={rec.id}>
                                                                    {getRecordDisplayName(rec, relatedInfo.entity)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={prop.id}>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">{prop.name}</label>
                                                    {prop.type === 'json' ? (
                                                        <textarea
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter valid JSON for ${prop.name}...`}
                                                            rows={4}
                                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono text-sm"
                                                        />
                                                    ) : (
                                                        <input
                                                            type={prop.type === 'number' ? 'number' : 'text'}
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter ${prop.name}...`}
                                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6">
                                        <button
                                            onClick={() => { setIsAddingRecord(false); setNewRecordValues({}); setEditingRecordId(null); setEditingSchema(null); }}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveRecord}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                        >
                                            {editingRecordId ? 'Save Changes' : 'Add Record'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </>
                )}
            </main>
        </div>
    );
}