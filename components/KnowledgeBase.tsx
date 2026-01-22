import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Plus, Search, Filter, X, FileText, Shield } from 'lucide-react';
import { Entity } from '../types';
import { EntityCard } from './EntityCard';
import { Tabs } from './Tabs';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface KnowledgeBaseProps {
    entities: Entity[];
    onNavigate: (entityId: string) => void;
}

interface Standard {
    id: string;
    name: string;
    code?: string;
    category?: string;
    description?: string;
    version?: string;
    status?: string;
    effectiveDate?: string;
    expiryDate?: string;
    tags?: string[];
    relatedEntityIds?: string[];
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'entities' | 'standards'>('entities');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');
    const [standards, setStandards] = useState<Standard[]>([]);
    const [isLoadingStandards, setIsLoadingStandards] = useState(false);
    const [isCreatingStandard, setIsCreatingStandard] = useState(false);
    const [newStandardName, setNewStandardName] = useState('');
    const [newStandardCode, setNewStandardCode] = useState('');
    const [newStandardCategory, setNewStandardCategory] = useState('');
    const [newStandardDescription, setNewStandardDescription] = useState('');

    // Load search query from URL
    useEffect(() => {
        if (location.pathname.startsWith('/database')) {
            const params = new URLSearchParams(location.search);
            const query = params.get('q');
            if (query !== null) {
                setSearchQuery(query);
            }
        }
    }, [location.pathname, location.search]);

    // Load standards when tab is active
    useEffect(() => {
        if (activeTab === 'standards') {
            fetchStandards();
        }
    }, [activeTab]);

    const fetchStandards = async () => {
        setIsLoadingStandards(true);
        try {
            const res = await fetch(`${API_BASE}/standards`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStandards(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching standards:', error);
            setStandards([]);
        } finally {
            setIsLoadingStandards(false);
        }
    };

    const filteredEntities = entities.filter(entity =>
        entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateEntity = async () => {
        if (!newEntityName.trim()) return;

        const newEntity = {
            id: Math.random().toString(36).substr(2, 9),
            name: newEntityName,
            description: newEntityDescription,
            author: user?.name || user?.email?.split('@')[0] || 'User',
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
            
            setNewEntityName('');
            setNewEntityDescription('');
            setIsCreatingEntity(false);
            
            // Reload entities by navigating away and back, or trigger a refresh
            window.location.reload();
        } catch (error) {
            console.error('Error creating entity:', error);
            alert('Failed to create entity');
        }
    };

    const handleDeleteEntity = async (entity: Entity) => {
        if (!confirm(`Are you sure you want to delete "${entity.name}"? This will also delete all its records.`)) {
            return;
        }

        try {
            await fetch(`${API_BASE}/entities/${entity.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            window.location.reload();
        } catch (error) {
            console.error('Error deleting entity:', error);
            alert('Failed to delete entity');
        }
    };

    const handleCreateStandard = async () => {
        if (!newStandardName.trim()) return;

        const newStandard = {
            id: Math.random().toString(36).substr(2, 9),
            name: newStandardName,
            code: newStandardCode || undefined,
            category: newStandardCategory || undefined,
            description: newStandardDescription || undefined,
            status: 'active',
            tags: [],
            relatedEntityIds: []
        };

        try {
            await fetch(`${API_BASE}/standards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStandard),
                credentials: 'include'
            });
            
            setNewStandardName('');
            setNewStandardCode('');
            setNewStandardCategory('');
            setNewStandardDescription('');
            setIsCreatingStandard(false);
            await fetchStandards();
        } catch (error) {
            console.error('Error creating standard:', error);
            alert('Failed to create standard');
        }
    };

    const handleDeleteStandard = async (standard: Standard) => {
        if (!confirm(`Are you sure you want to delete "${standard.name}"?`)) {
            return;
        }

        try {
            await fetch(`${API_BASE}/standards/${standard.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchStandards();
        } catch (error) {
            console.error('Error deleting standard:', error);
            alert('Failed to delete standard');
        }
    };

    const filteredStandards = standards.filter(standard =>
        standard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        standard.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        standard.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50" data-tutorial="database-content">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
                <div>
                    <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                        Your database
                    </h1>
                    <p className="text-[11px] text-slate-500">View and manage your different entities</p>
                </div>
                <div />
            </header>

            {/* Tabs */}
            <div className="px-8 pt-6 bg-white border-b border-slate-200">
                <Tabs
                    items={[
                        { id: 'entities', label: 'Entities', icon: Database, badge: entities.length },
                        { id: 'standards', label: 'Standards', icon: Shield, badge: standards.length }
                    ]}
                    activeTab={activeTab}
                    onChange={(tabId) => setActiveTab(tabId as 'entities' | 'standards')}
                />
            </div>

            {/* Content */}
            <div data-tutorial="database-main" className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'entities' ? (
                    <>
                        {/* Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-slate-500">
                                {searchQuery
                                    ? `Showing ${filteredEntities.length} of ${entities.length} entities`
                                    : `Total: ${entities.length} entities`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search entities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                                    />
                                </div>
                                <button className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                    <Filter size={14} className="mr-2" />
                                    Filter
                                </button>
                                <button
                                    onClick={() => setIsCreatingEntity(true)}
                                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Plus size={14} className="mr-2" />
                                    Create Entity
                                </button>
                            </div>
                        </div>

                        {/* Entities Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                            {filteredEntities.map((entity) => (
                                <EntityCard
                                    key={entity.id}
                                    entity={entity}
                                    onClick={(e) => onNavigate(e.id)}
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
                    </>
                ) : (
                    <>
                        {/* Standards Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-slate-500">
                                {searchQuery
                                    ? `Showing ${filteredStandards.length} of ${standards.length} standards`
                                    : `Total: ${standards.length} standards`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search standards..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                                    />
                                </div>
                                <button className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                    <Filter size={14} className="mr-2" />
                                    Filter
                                </button>
                                <button
                                    onClick={() => setIsCreatingStandard(true)}
                                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Plus size={14} className="mr-2" />
                                    Create Standard
                                </button>
                            </div>
                        </div>

                        {/* Standards Grid */}
                        {isLoadingStandards ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                            </div>
                        ) : filteredStandards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                {filteredStandards.map((standard) => (
                                    <div
                                        key={standard.id}
                                        className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                                                    <Shield size={18} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors">
                                                        {standard.name}
                                                    </h3>
                                                    {standard.code && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Code: {standard.code}
                                                        </p>
                                                    )}
                                                    {standard.category && (
                                                        <p className="text-xs text-slate-500">
                                                            Category: {standard.category}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteStandard(standard);
                                                }}
                                                className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        {standard.description && (
                                            <p className="text-xs text-slate-600 mb-4 line-clamp-2">
                                                {standard.description}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <div className="text-xs text-slate-500">
                                                {standard.status || 'active'}
                                            </div>
                                            {standard.version && (
                                                <div className="text-xs text-slate-500">
                                                    v{standard.version}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-12 text-center">
                                <Shield className="mx-auto text-slate-300 mb-4" size={48} />
                                <h3 className="text-base font-normal text-slate-700 mb-2">No standards found</h3>
                                <p className="text-sm text-slate-500">
                                    {searchQuery
                                        ? 'Try adjusting your search query'
                                        : 'Create your first standard to get started'
                                    }
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Standard Modal */}
            {isCreatingStandard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCreatingStandard(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-slate-900">Create Standard</h2>
                                <p className="text-xs text-slate-500 mt-1">Define a new standard for compliance</p>
                            </div>
                            <button
                                onClick={() => setIsCreatingStandard(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Standard Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newStandardName}
                                    onChange={(e) => setNewStandardName(e.target.value)}
                                    placeholder="e.g., ISO 9001, GDPR Compliance"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Code
                                </label>
                                <input
                                    type="text"
                                    value={newStandardCode}
                                    onChange={(e) => setNewStandardCode(e.target.value)}
                                    placeholder="e.g., ISO-9001"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Category
                                </label>
                                <input
                                    type="text"
                                    value={newStandardCategory}
                                    onChange={(e) => setNewStandardCategory(e.target.value)}
                                    placeholder="e.g., Quality, Security, Compliance"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={newStandardDescription}
                                    onChange={(e) => setNewStandardDescription(e.target.value)}
                                    placeholder="Optional description of the standard"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
                                />
                            </div>
                        </div>
                        <div className="border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsCreatingStandard(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateStandard}
                                disabled={!newStandardName.trim()}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create Standard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Entity Modal */}
            {isCreatingEntity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCreatingEntity(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-slate-900">Create Entity</h2>
                                <p className="text-xs text-slate-500 mt-1">Define a new entity for your database</p>
                            </div>
                            <button
                                onClick={() => setIsCreatingEntity(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Entity Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newEntityName}
                                    onChange={(e) => setNewEntityName(e.target.value)}
                                    placeholder="e.g., Customers, Products, Orders"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={newEntityDescription}
                                    onChange={(e) => setNewEntityDescription(e.target.value)}
                                    placeholder="Optional description of what this entity represents"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
                                />
                            </div>
                        </div>
                        <div className="border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsCreatingEntity(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEntity}
                                disabled={!newEntityName.trim()}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create Entity
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
