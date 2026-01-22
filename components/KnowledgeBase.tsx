import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Plus, Search, Filter } from 'lucide-react';
import { Entity } from '../types';

interface KnowledgeBaseProps {
    entities: Entity[];
    onNavigate: (entityId: string) => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEntities = entities.filter(entity =>
        entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                    </div>
                </div>

                {/* Entities Grid */}
                {filteredEntities.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                        {filteredEntities.map((entity) => (
                            <div
                                key={entity.id}
                                onClick={() => onNavigate(entity.id)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center">
                                            <Database size={18} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors">
                                                {entity.name}
                                            </h3>
                                            {entity.description && (
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                    {entity.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <div className="text-xs text-slate-500">
                                        {entity.properties?.length || 0} properties
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-12 text-center">
                        <Database className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-base font-normal text-slate-700 mb-2">No entities found</h3>
                        <p className="text-sm text-slate-500">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Create your first entity to get started'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
