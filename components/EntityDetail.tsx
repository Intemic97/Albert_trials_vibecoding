/**
 * EntityDetail - Enhanced Entity Detail View
 * 
 * Features:
 * - Modern design aligned with branding
 * - Full dark mode support
 * - Related entities section
 * - Export capabilities (JSON, SQL, API spec)
 * - Quick stats overview
 */

import React, { useState, useMemo } from 'react';
import {
    ArrowLeft, Plus, Trash, PencilSimple, Copy, Check,
    Database, Table, TreeStructure, Export, FileJs, FileCode,
    CaretRight, Lightning, Eye, Link as LinkIcon, Tag,
    Hash, TextT, Calendar, ToggleLeft, At, Globe, File,
    DotsThree, Download, Code, Brackets
} from '@phosphor-icons/react';
import { Entity } from '../types';

// Types
interface Property {
    id: string;
    name: string;
    type: string;
    defaultValue?: string;
    relatedEntityId?: string;
}

interface Record {
    id: string;
    values: { [key: string]: string };
}

interface EntityDetailProps {
    entity: Entity;
    entities: Entity[];
    records: Record[];
    onBack: () => void;
    onAddProperty: () => void;
    onDeleteProperty: (propId: string) => void;
    onAddRecord: () => void;
    onEditRecord: (recordId: string) => void;
    onDeleteRecord: (recordId: string) => void;
    onNavigateToEntity: (entityId: string) => void;
}

// Property type icons
const TYPE_ICONS: { [key: string]: React.ReactNode } = {
    text: <TextT size={14} weight="light" />,
    number: <Hash size={14} weight="light" />,
    date: <Calendar size={14} weight="light" />,
    boolean: <ToggleLeft size={14} weight="light" />,
    email: <At size={14} weight="light" />,
    url: <Globe size={14} weight="light" />,
    file: <File size={14} weight="light" />,
    json: <Brackets size={14} weight="light" />,
    relation: <LinkIcon size={14} weight="light" />,
};

// Property type colors
const TYPE_COLORS: { [key: string]: string } = {
    text: 'text-emerald-500 bg-emerald-500/10',
    number: 'text-amber-500 bg-amber-500/10',
    date: 'text-pink-500 bg-pink-500/10',
    boolean: 'text-violet-500 bg-violet-500/10',
    email: 'text-blue-500 bg-blue-500/10',
    url: 'text-cyan-500 bg-cyan-500/10',
    file: 'text-orange-500 bg-orange-500/10',
    json: 'text-indigo-500 bg-indigo-500/10',
    relation: 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10',
};

export const EntityDetail: React.FC<EntityDetailProps> = ({
    entity,
    entities,
    records,
    onBack,
    onAddProperty,
    onDeleteProperty,
    onAddRecord,
    onEditRecord,
    onDeleteRecord,
    onNavigateToEntity
}) => {
    const [activeTab, setActiveTab] = useState<'structure' | 'data' | 'relations'>('structure');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Find related entities
    const relatedEntities = useMemo(() => {
        const related: { entity: Entity; property: Property; direction: 'outgoing' | 'incoming' }[] = [];
        
        // Outgoing relations (this entity references others)
        entity.properties?.forEach((prop: Property) => {
            if (prop.type === 'relation' && prop.relatedEntityId) {
                const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);
                if (relatedEntity) {
                    related.push({ entity: relatedEntity, property: prop, direction: 'outgoing' });
                }
            }
        });
        
        // Incoming relations (other entities reference this one)
        entities.forEach(otherEntity => {
            if (otherEntity.id === entity.id) return;
            otherEntity.properties?.forEach((prop: Property) => {
                if (prop.type === 'relation' && prop.relatedEntityId === entity.id) {
                    related.push({ entity: otherEntity, property: prop, direction: 'incoming' });
                }
            });
        });
        
        return related;
    }, [entity, entities]);

    // Stats
    const stats = useMemo(() => ({
        properties: entity.properties?.length || 0,
        records: records.length,
        relations: relatedEntities.length,
        requiredFields: entity.properties?.filter((p: Property) => p.defaultValue === undefined).length || 0
    }), [entity, records, relatedEntities]);

    // Copy to clipboard
    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Export functions
    const exportAsJSON = () => {
        const data = {
            entity: {
                id: entity.id,
                name: entity.name,
                description: entity.description,
                properties: entity.properties
            },
            records: records
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity.name.toLowerCase().replace(/\s+/g, '_')}.json`;
        a.click();
        setShowExportMenu(false);
    };

    const exportAsSQLSchema = () => {
        const tableName = entity.name.toLowerCase().replace(/\s+/g, '_');
        const columns = entity.properties?.map((prop: Property) => {
            const sqlType = {
                text: 'VARCHAR(255)',
                number: 'DECIMAL(10,2)',
                date: 'TIMESTAMP',
                boolean: 'BOOLEAN',
                email: 'VARCHAR(255)',
                url: 'TEXT',
                file: 'VARCHAR(500)',
                json: 'JSONB',
                relation: 'UUID REFERENCES'
            }[prop.type] || 'TEXT';
            return `  ${prop.name.toLowerCase().replace(/\s+/g, '_')} ${sqlType}`;
        }).join(',\n');
        
        const sql = `CREATE TABLE ${tableName} (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n${columns},\n  created_at TIMESTAMP DEFAULT NOW(),\n  updated_at TIMESTAMP DEFAULT NOW()\n);`;
        
        const blob = new Blob([sql], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}_schema.sql`;
        a.click();
        setShowExportMenu(false);
    };

    const exportAsAPISpec = () => {
        const basePath = entity.name.toLowerCase().replace(/\s+/g, '-');
        const properties: { [key: string]: { type: string } } = {};
        entity.properties?.forEach((prop: Property) => {
            properties[prop.name] = {
                type: prop.type === 'number' ? 'number' : prop.type === 'boolean' ? 'boolean' : 'string'
            };
        });
        
        const spec = {
            openapi: '3.0.0',
            info: { title: `${entity.name} API`, version: '1.0.0' },
            paths: {
                [`/api/${basePath}`]: {
                    get: { summary: `List all ${entity.name}`, responses: { '200': { description: 'Success' } } },
                    post: { summary: `Create ${entity.name}`, responses: { '201': { description: 'Created' } } }
                },
                [`/api/${basePath}/{id}`]: {
                    get: { summary: `Get ${entity.name} by ID`, responses: { '200': { description: 'Success' } } },
                    put: { summary: `Update ${entity.name}`, responses: { '200': { description: 'Updated' } } },
                    delete: { summary: `Delete ${entity.name}`, responses: { '204': { description: 'Deleted' } } }
                }
            },
            components: {
                schemas: {
                    [entity.name]: { type: 'object', properties }
                }
            }
        };
        
        const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${basePath}_openapi.json`;
        a.click();
        setShowExportMenu(false);
    };

    const getRelatedEntityName = (id?: string) => {
        if (!id) return 'Unknown';
        return entities.find(e => e.id === id)?.name || 'Unknown';
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)]"
                        >
                            <ArrowLeft size={20} weight="light" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                    <Database size={20} className="text-[var(--accent-primary)]" weight="light" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                        {entity.name}
                                    </h1>
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        {entity.description || 'No description'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm text-[var(--text-secondary)] transition-colors"
                            >
                                <Export size={16} weight="light" />
                                Export
                            </button>
                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg overflow-hidden z-50">
                                    <button
                                        onClick={exportAsJSON}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        <FileJs size={18} className="text-amber-500" />
                                        Export as JSON
                                    </button>
                                    <button
                                        onClick={exportAsSQLSchema}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        <FileCode size={18} className="text-blue-500" />
                                        SQL Schema
                                    </button>
                                    <button
                                        onClick={exportAsAPISpec}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        <Code size={18} className="text-emerald-500" />
                                        OpenAPI Spec
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <button
                            onClick={() => copyToClipboard(entity.id, 'entity-id')}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm text-[var(--text-secondary)] transition-colors"
                        >
                            {copiedId === 'entity-id' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} weight="light" />}
                            Copy ID
                        </button>
                    </div>
                </div>
                
                {/* Stats Bar */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[var(--border-light)]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <TreeStructure size={14} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-[var(--text-primary)]">{stats.properties}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Properties</p>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--border-light)]" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Table size={14} className="text-blue-500" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-[var(--text-primary)]">{stats.records}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Records</p>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--border-light)]" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <LinkIcon size={14} className="text-violet-500" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-[var(--text-primary)]">{stats.relations}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Relations</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6">
                <div className="flex gap-1">
                    {[
                        { id: 'structure', label: 'Structure', icon: <TreeStructure size={14} /> },
                        { id: 'data', label: 'Data Records', icon: <Table size={14} /> },
                        { id: 'relations', label: 'Relations', icon: <LinkIcon size={14} />, count: relatedEntities.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                                activeTab === tab.id
                                    ? 'text-[var(--accent-primary)]'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-violet-500/15 text-violet-500 rounded-full">
                                    {tab.count}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6">
                    
                    {/* STRUCTURE TAB */}
                    {activeTab === 'structure' && (
                        <>
                            {/* Properties */}
                            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
                                    <div>
                                        <h3 className="text-sm font-medium text-[var(--text-primary)]">Properties</h3>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Define the data structure</p>
                                    </div>
                                    <button
                                        onClick={onAddProperty}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <Plus size={14} weight="bold" />
                                        Add Property
                                    </button>
                                </div>
                                
                                {entity.properties?.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
                                            <TreeStructure size={24} className="text-[var(--text-tertiary)]" />
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">No properties defined yet</p>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Add properties to define your data structure</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[var(--border-light)]">
                                        {entity.properties?.map((prop: Property) => (
                                            <div key={prop.id} className="flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TYPE_COLORS[prop.type] || TYPE_COLORS.text}`}>
                                                        {TYPE_ICONS[prop.type] || TYPE_ICONS.text}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--text-primary)]">{prop.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{prop.type}</span>
                                                            {prop.type === 'relation' && prop.relatedEntityId && (
                                                                <span className="text-[10px] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded">
                                                                    → {getRelatedEntityName(prop.relatedEntityId)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteProperty(prop.id)}
                                                    className="p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash size={16} weight="light" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Metadata */}
                            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] p-4">
                                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Metadata</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Created by</p>
                                        <p className="text-sm text-[var(--text-secondary)]">{entity.author || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Last modified</p>
                                        <p className="text-sm text-[var(--text-secondary)]">{entity.lastEdited || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Entity ID</p>
                                        <p className="text-sm text-[var(--text-secondary)] font-mono">{entity.id}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* DATA TAB */}
                    {activeTab === 'data' && (
                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Data Records</h3>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{records.length} records</p>
                                </div>
                                <button
                                    onClick={onAddRecord}
                                    disabled={!entity.properties?.length}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={14} weight="bold" />
                                    Add Record
                                </button>
                            </div>
                            
                            {records.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
                                        <Table size={24} className="text-[var(--text-tertiary)]" />
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)]">No records yet</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                        {entity.properties?.length ? 'Add your first record' : 'Add properties first, then add records'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-[var(--bg-tertiary)]">
                                                {entity.properties?.map((prop: Property) => (
                                                    <th key={prop.id} className="px-4 py-3 text-left text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                                                        {prop.name}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-right text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-light)]">
                                            {records.map(record => (
                                                <tr key={record.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors group">
                                                    {entity.properties?.map((prop: Property) => (
                                                        <td key={prop.id} className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                                                            {record.values[prop.id] || '-'}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => onEditRecord(record.id)}
                                                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                                                            >
                                                                <PencilSimple size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onDeleteRecord(record.id)}
                                                                className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                            >
                                                                <Trash size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RELATIONS TAB */}
                    {activeTab === 'relations' && (
                        <div className="space-y-4">
                            {relatedEntities.length === 0 ? (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] p-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
                                        <LinkIcon size={24} className="text-[var(--text-tertiary)]" />
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)]">No relations found</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                        Add a "relation" type property to connect entities
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Outgoing Relations */}
                                    {relatedEntities.filter(r => r.direction === 'outgoing').length > 0 && (
                                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                                            <div className="p-4 border-b border-[var(--border-light)]">
                                                <h3 className="text-sm font-medium text-[var(--text-primary)]">References</h3>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Entities this entity references</p>
                                            </div>
                                            <div className="divide-y divide-[var(--border-light)]">
                                                {relatedEntities.filter(r => r.direction === 'outgoing').map((rel, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer"
                                                        onClick={() => onNavigateToEntity(rel.entity.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                                                <Database size={16} className="text-[var(--accent-primary)]" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-[var(--text-primary)]">{rel.entity.name}</p>
                                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                                    via <span className="text-[var(--accent-primary)]">{rel.property.name}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <CaretRight size={16} className="text-[var(--text-tertiary)]" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Incoming Relations */}
                                    {relatedEntities.filter(r => r.direction === 'incoming').length > 0 && (
                                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                                            <div className="p-4 border-b border-[var(--border-light)]">
                                                <h3 className="text-sm font-medium text-[var(--text-primary)]">Referenced by</h3>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Entities that reference this entity</p>
                                            </div>
                                            <div className="divide-y divide-[var(--border-light)]">
                                                {relatedEntities.filter(r => r.direction === 'incoming').map((rel, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer"
                                                        onClick={() => onNavigateToEntity(rel.entity.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                                                <Database size={16} className="text-violet-500" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-[var(--text-primary)]">{rel.entity.name}</p>
                                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                                    via <span className="text-violet-500">{rel.property.name}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <CaretRight size={16} className="text-[var(--text-tertiary)]" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntityDetail;
