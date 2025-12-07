import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { EntityCard } from './components/EntityCard';
import { Entity, Property, PropertyType } from './types';
import { Plus, Search, Filter, ArrowLeft, Trash2, Database, Link as LinkIcon, Type, Hash } from 'lucide-react';

// --- Mock Data ---
const initialEntities: Entity[] = [
  {
    id: '1',
    name: 'Facilities/Factories',
    description: 'Main manufacturing locations and physical plant metadata.',
    author: 'albert_mestre',
    lastEdited: 'December 2, 2025',
    properties: [
      { id: 'p1', name: 'Factory Name', type: 'text', defaultValue: 'Main Plant A' },
      { id: 'p2', name: 'Capacity', type: 'number', defaultValue: 5000 },
    ]
  },
  {
    id: '2',
    name: 'Equipments',
    description: 'Individual machinery units within the facilities.',
    author: 'Mateo Alcazar',
    lastEdited: 'November 28, 2025',
    properties: [
      { id: 'p3', name: 'Serial Number', type: 'text', defaultValue: 'SN-99882' },
      { id: 'p4', name: 'Installation Year', type: 'number', defaultValue: 2020 },
      { id: 'p5', name: 'Located In', type: 'relation', relatedEntityId: '1' } // Relations to Facilities
    ]
  },
  {
    id: '3',
    name: 'Formulations',
    description: 'Chemical recipes and composition standards.',
    author: 'albert_mestre',
    lastEdited: 'November 28, 2025',
    properties: [
        { id: 'p6', name: 'Formula Code', type: 'text', defaultValue: 'F-221' }
    ]
  },
  {
    id: '4',
    name: 'Customers',
    description: 'Client database and contact information.',
    author: 'albert_mestre',
    lastEdited: 'November 30, 2025',
    properties: []
  },
  {
    id: '5',
    name: 'Reports',
    description: 'Generated production reports.',
    author: 'System',
    lastEdited: 'December 1, 2025',
    properties: []
  },
  {
    id: '6',
    name: 'Alerts/Events',
    description: 'System generated anomalies and logs.',
    author: 'System',
    lastEdited: 'Today',
    properties: []
  }
];

export default function App() {
  const [entities, setEntities] = useState<Entity[]>(initialEntities);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  
  // New Property State
  const [isAddingProp, setIsAddingProp] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<PropertyType>('text');
  const [newPropRelationId, setNewPropRelationId] = useState<string>('');

  const activeEntity = entities.find(e => e.id === activeEntityId);

  const handleAddProperty = () => {
    if (!newPropName.trim() || !activeEntityId) return;

    const newProp: Property = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPropName,
      type: newPropType,
      relatedEntityId: newPropType === 'relation' ? newPropRelationId : undefined,
      defaultValue: newPropType === 'number' ? 0 : '',
    };

    setEntities(prev => prev.map(ent => {
      if (ent.id === activeEntityId) {
        return {
          ...ent,
          properties: [...ent.properties, newProp]
        };
      }
      return ent;
    }));

    // Reset Form
    setNewPropName('');
    setNewPropType('text');
    setNewPropRelationId('');
    setIsAddingProp(false);
  };

  const deleteProperty = (propId: string) => {
    setEntities(prev => prev.map(ent => {
      if (ent.id === activeEntityId) {
        return {
          ...ent,
          properties: ent.properties.filter(p => p.id !== propId)
        };
      }
      return ent;
    }));
  };

  const getRelatedEntityName = (id?: string) => {
    if (!id) return 'Unknown';
    const found = entities.find(e => e.id === id);
    return found ? found.name : 'Deleted Entity';
  };

  const renderIconForType = (type: PropertyType) => {
    switch (type) {
        case 'text': return <Type size={16} className="text-slate-400" />;
        case 'number': return <Hash size={16} className="text-slate-400" />;
        case 'relation': return <LinkIcon size={16} className="text-teal-500" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
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
                            <Database size={20} className="text-teal-600"/>
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
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer">
                  A
              </div>
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            
            {/* LIST VIEW */}
            {!activeEntityId && (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-500">
                            Total: {entities.length} entities
                        </div>
                        <div className="flex space-x-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-64 shadow-sm"
                                />
                            </div>
                            <button className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
                                <Filter size={16} className="mr-2" />
                                Filter
                            </button>
                            <button className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-md transition-colors">
                                <Plus size={16} className="mr-2" />
                                Create Entity
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                        {entities.map(entity => (
                            <EntityCard 
                                key={entity.id} 
                                entity={entity} 
                                onClick={(e) => setActiveEntityId(e.id)} 
                            />
                        ))}
                        
                        {/* Empty State / Add New Placeholder */}
                        <div className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center min-h-[200px] text-slate-400 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all cursor-pointer group">
                            <div className="p-4 bg-slate-100 rounded-full mb-3 group-hover:bg-white">
                                <Plus size={24} />
                            </div>
                            <span className="font-medium">Create new entity</span>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL VIEW */}
            {activeEntity && (
                <div className="max-w-4xl mx-auto space-y-8">
                    
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
                                <p className="text-sm text-slate-500">Define the schema for this entity.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingProp(true)}
                                className="flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
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
                                                Example Value:<br/>
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
                                            className="flex-1 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
            )}
        </div>
      </main>
    </div>
  );
}