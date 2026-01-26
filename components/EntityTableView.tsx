import React, { useState, useRef, useEffect } from 'react';
import { Plus, Type, Hash, Link as LinkIcon, Paperclip, Trash2, MoreHorizontal, ChevronDown, X } from 'lucide-react';
import { Entity, Property, PropertyType } from '../types';
import { API_BASE } from '../config';

interface EntityTableViewProps {
    entity: Entity;
    entities: Entity[];
    onUpdate: () => void;
}

export const EntityTableView: React.FC<EntityTableViewProps> = ({ entity, entities, onUpdate }) => {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(true);
    const [localValues, setLocalValues] = useState<Record<string, Record<string, any>>>({});
    const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
    const [newPropertyName, setNewPropertyName] = useState('');
    const [newPropertyType, setNewPropertyType] = useState<PropertyType>('text');
    const [selectedRelatedEntity, setSelectedRelatedEntity] = useState('');
    const [propertyMenuOpen, setPropertyMenuOpen] = useState<string | null>(null);
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    useEffect(() => {
        fetchRecords();
    }, [entity.id]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            Object.values(saveTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
        };
    }, []);

    const fetchRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const res = await fetch(`${API_BASE}/entities/${entity.id}/records`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                // Flatten the values object into the record
                const flattenedRecords = data.map((record: any) => {
                    const { values, ...rest } = record;
                    return {
                        ...rest,
                        ...values
                    };
                });
                setRecords(Array.isArray(flattenedRecords) ? flattenedRecords : []);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            setRecords([]);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    const handleAddProperty = async () => {
        if (!newPropertyName.trim()) return;

        const newProperty = {
            id: Math.random().toString(36).substr(2, 9),
            entityId: entity.id,
            name: newPropertyName.trim(),
            type: newPropertyType,
            defaultValue: newPropertyType === 'number' ? '0' : '',
            relatedEntityId: newPropertyType === 'relation' ? selectedRelatedEntity : undefined
        };

        try {
            const res = await fetch(`${API_BASE}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newProperty)
            });

            if (res.ok) {
                setNewPropertyName('');
                setNewPropertyType('text');
                setSelectedRelatedEntity('');
                setShowAddPropertyModal(false);
                onUpdate();
            } else {
                const error = await res.json();
                console.error('Error adding property:', error);
                alert('Failed to add property: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error adding property:', error);
            alert('Failed to add property');
        }
    };

    const handleDeleteProperty = async (propertyId: string) => {
        if (!confirm('Are you sure you want to delete this property? All data in this column will be lost.')) return;

        try {
            const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (res.ok) {
                onUpdate();
            } else {
                const error = await res.json();
                console.error('Error deleting property:', error);
                alert('Failed to delete property: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting property:', error);
            alert('Failed to delete property');
        }
    };

    const handleAddRecord = async () => {
        setIsAddingRecord(true);
        try {
            // Create an empty record - the server will handle creating it
            const newRecordData: any = {};

            const res = await fetch(`${API_BASE}/entities/${entity.id}/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newRecordData)
            });

            if (res.ok) {
                await fetchRecords();
            } else {
                console.error('Error adding record:', await res.json());
                alert('Failed to add record');
            }
        } catch (error) {
            console.error('Error adding record:', error);
            alert('Failed to add record');
        } finally {
            setIsAddingRecord(false);
        }
    };

    const handleCellChange = (recordId: string, propertyId: string, value: string) => {
        // Update local state immediately
        setLocalValues(prev => ({
            ...prev,
            [recordId]: {
                ...prev[recordId],
                [propertyId]: value
            }
        }));

        // Clear existing timeout for this cell
        const cellKey = `${recordId}-${propertyId}`;
        if (saveTimeoutRef.current[cellKey]) {
            clearTimeout(saveTimeoutRef.current[cellKey]);
        }

        // Set new timeout to save after 500ms of no typing
        saveTimeoutRef.current[cellKey] = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/records/${recordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        values: {
                            [propertyId]: value
                        }
                    })
                });

                if (res.ok) {
                    // Update records state without refetching
                    setRecords(prev => prev.map(r => 
                        r.id === recordId ? { ...r, [propertyId]: value } : r
                    ));
                } else {
                    console.error('Error updating cell:', await res.json());
                }
            } catch (error) {
                console.error('Error updating cell:', error);
            }
        }, 500);
    };

    const handleDeleteRecord = async (recordId: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;

        try {
            const res = await fetch(`${API_BASE}/records/${recordId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                // Remove from local state instead of refetching
                setRecords(prev => prev.filter(r => r.id !== recordId));
                // Also clean up local values
                setLocalValues(prev => {
                    const newValues = { ...prev };
                    delete newValues[recordId];
                    return newValues;
                });
            } else {
                console.error('Error deleting record:', await res.json());
                alert('Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Failed to delete record');
        }
    };

    const getCellValue = (record: any, propertyId: string) => {
        // Check local values first, then fall back to record data
        if (localValues[record.id]?.[propertyId] !== undefined) {
            return localValues[record.id][propertyId];
        }
        return record[propertyId] || '';
    };

    const renderPropertyIcon = (type: PropertyType) => {
        switch (type) {
            case 'text': return <Type size={14} className="text-slate-500" />;
            case 'number': return <Hash size={14} className="text-slate-500" />;
            case 'relation': return <LinkIcon size={14} className="text-slate-500" />;
            case 'file': return <Paperclip size={14} className="text-slate-500" />;
            default: return <Type size={14} className="text-slate-500" />;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Empty state when no properties */}
            {entity.properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                    <div className="mb-4 p-4 bg-slate-100 rounded-full">
                        <Plus size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No properties defined yet</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md">
                        Start by adding properties to define the structure of your data. 
                        Click the button below to create your first property.
                    </p>
                    <button
                        onClick={() => setShowAddPropertyModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        Add First Property
                    </button>
                </div>
            ) : (
            /* Table Container */
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    {/* Table Header */}
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {/* Dynamic Property Columns */}
                            {entity.properties.map((property, index) => (
                                <th key={property.id} className={`text-left px-4 py-3 border-r border-slate-200 min-w-[180px] relative group ${
                                    index === 0 ? 'sticky left-0 bg-slate-50 z-10 min-w-[200px]' : ''
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {renderPropertyIcon(property.type)}
                                            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                                {property.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPropertyMenuOpen(propertyMenuOpen === property.id ? null : property.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                                        >
                                            <MoreHorizontal size={14} className="text-slate-500" />
                                        </button>

                                        {/* Property Menu */}
                                        {propertyMenuOpen === property.id && (
                                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                                                <button
                                                    onClick={() => {
                                                        handleDeleteProperty(property.id);
                                                        setPropertyMenuOpen(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Trash2 size={14} />
                                                        Delete Property
                                                    </span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}

                            {/* Add Property Column */}
                            <th className="text-left px-4 py-3 border-r border-slate-200 min-w-[60px]">
                                <button
                                    onClick={() => setShowAddPropertyModal(true)}
                                    className="flex items-center justify-center w-full h-full p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600"
                                    title="Add Property"
                                >
                                    <Plus size={16} />
                                </button>
                            </th>

                            {/* Actions Column */}
                            <th className="text-left px-4 py-3 w-[60px]"></th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {isLoadingRecords ? (
                            <tr>
                                <td colSpan={entity.properties.length + 3} className="text-center py-12 text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={entity.properties.length + 3} className="text-center py-12 text-slate-500">
                                    <p className="text-sm">No records yet. Click "New" to add your first record.</p>
                                </td>
                            </tr>
                        ) : (
                            records.map((record) => (
                                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/50 group">
                                    {/* Dynamic Property Cells */}
                                    {entity.properties.map((property, index) => (
                                        <td key={property.id} className={`px-4 py-3 border-r border-slate-100 ${
                                            index === 0 ? 'sticky left-0 bg-white group-hover:bg-slate-50/50' : ''
                                        }`}>
                                            {property.type === 'file' ? (
                                                <div className="text-sm text-slate-600">
                                                    {getCellValue(record, property.id) ? (
                                                        <a href={getCellValue(record, property.id)} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                                                            View file
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-400">No file</span>
                                                    )}
                                                </div>
                                            ) : property.type === 'relation' ? (
                                                <div className="text-sm text-slate-600">
                                                    {getCellValue(record, property.id) || <span className="text-slate-400">-</span>}
                                                </div>
                                            ) : (
                                                <input
                                                    type={property.type === 'number' ? 'number' : 'text'}
                                                    value={getCellValue(record, property.id)}
                                                    onChange={(e) => handleCellChange(record.id, property.id, e.target.value)}
                                                    placeholder={index === 0 ? 'Untitled' : ''}
                                                    className="w-full px-2 py-1 text-sm text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none rounded"
                                                />
                                            )}
                                        </td>
                                    ))}

                                    {/* Empty cell for add property column */}
                                    <td className="px-4 py-3 border-r border-slate-100"></td>

                                    {/* Actions Cell */}
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleDeleteRecord(record.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="Delete record"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}

                        {/* Add New Record Row */}
                        <tr className="border-b border-slate-100">
                            <td colSpan={entity.properties.length + 3} className="px-4 py-3">
                                <button
                                    onClick={handleAddRecord}
                                    disabled={isAddingRecord}
                                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                                >
                                    <Plus size={16} />
                                    {isAddingRecord ? 'Adding...' : 'New'}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            )}

            {/* Add Property Modal */}
            {showAddPropertyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddPropertyModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Add Property</h3>
                            <button
                                onClick={() => setShowAddPropertyModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Property Name</label>
                                <input
                                    type="text"
                                    value={newPropertyName}
                                    onChange={(e) => setNewPropertyName(e.target.value)}
                                    placeholder="e.g. Email, Price, Status"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Property Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setNewPropertyType('text')}
                                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                                            newPropertyType === 'text'
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Type size={16} />
                                        Text
                                    </button>
                                    <button
                                        onClick={() => setNewPropertyType('number')}
                                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                                            newPropertyType === 'number'
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Hash size={16} />
                                        Number
                                    </button>
                                    <button
                                        onClick={() => setNewPropertyType('relation')}
                                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                                            newPropertyType === 'relation'
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <LinkIcon size={16} />
                                        Relation
                                    </button>
                                    <button
                                        onClick={() => setNewPropertyType('file')}
                                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                                            newPropertyType === 'file'
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Paperclip size={16} />
                                        File
                                    </button>
                                </div>
                            </div>

                            {newPropertyType === 'relation' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Related Entity</label>
                                    <select
                                        value={selectedRelatedEntity}
                                        onChange={(e) => setSelectedRelatedEntity(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="">Select entity...</option>
                                        {entities.filter(e => e.id !== entity.id).map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowAddPropertyModal(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddProperty}
                                disabled={!newPropertyName.trim() || (newPropertyType === 'relation' && !selectedRelatedEntity)}
                                className="px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Property
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

