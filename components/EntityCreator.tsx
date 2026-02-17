/**
 * EntityCreator - Notion-style inline entity table view
 * 
 * Works in two modes:
 * - Edit mode (entityId provided): loads existing entity, auto-saves changes
 * - New mode (no entityId / isNew): entity was just created, shows options panel
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Plus, X, Table as TableIcon, Sparkle, Download,
    TextT, Hash, Calendar, Globe, File, Link as LinkIcon,
    Trash, SpinnerGap, ArrowUp, ListBullets, CheckSquare,
    MagnifyingGlass, Export, Paperclip, UploadSimple,
    ArrowSquareOut, Package, Gear, Wrench, Warning, CurrencyDollar
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface CreatorProperty {
    id: string;
    name: string;
    type: string;
    unit?: string;
    relatedEntityId?: string;
}

interface CreatorRecord {
    id: string;
    values: Record<string, string>;
    isNew?: boolean; // locally added, not yet saved
}

// Property type config
const PROPERTY_TYPES = [
    { value: 'text', label: 'Text', icon: TextT, color: 'text-emerald-500 bg-emerald-500/10' },
    { value: 'number', label: 'Number', icon: Hash, color: 'text-amber-500 bg-amber-500/10' },
    { value: 'date', label: 'Date', icon: Calendar, color: 'text-pink-500 bg-pink-500/10' },
    { value: 'url', label: 'URL', icon: Globe, color: 'text-cyan-500 bg-cyan-500/10' },
    { value: 'file', label: 'File', icon: File, color: 'text-orange-500 bg-orange-500/10' },
    { value: 'relation', label: 'Relation', icon: LinkIcon, color: 'text-violet-500 bg-violet-500/10' },
    { value: 'select', label: 'Select', icon: ListBullets, color: 'text-blue-500 bg-blue-500/10' },
    { value: 'multi-select', label: 'Multi-select', icon: CheckSquare, color: 'text-indigo-500 bg-indigo-500/10' },
];

// Suggested templates (icon = Phosphor component, no emojis)
const TEMPLATES = [
    {
        id: 'product',
        name: 'Product',
        icon: Package,
        iconBg: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        properties: [
            { name: 'Name', type: 'text' },
            { name: 'SKU', type: 'text' },
            { name: 'Category', type: 'text' },
            { name: 'Unit Price', type: 'number' },
            { name: 'Stock', type: 'number' },
        ]
    },
    {
        id: 'process',
        name: 'Process',
        icon: Gear,
        iconBg: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        properties: [
            { name: 'Name', type: 'text' },
            { name: 'Description', type: 'text' },
            { name: 'Status', type: 'text' },
            { name: 'Owner', type: 'text' },
            { name: 'Last Updated', type: 'date' },
        ]
    },
    {
        id: 'equipment',
        name: 'Equipment',
        icon: Wrench,
        iconBg: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        properties: [
            { name: 'Name', type: 'text' },
            { name: 'Model', type: 'text' },
            { name: 'Serial Number', type: 'text' },
            { name: 'Location', type: 'text' },
            { name: 'Last Maintenance', type: 'date' },
        ]
    },
    {
        id: 'deviation',
        name: 'Deviation',
        icon: Warning,
        iconBg: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        properties: [
            { name: 'Title', type: 'text' },
            { name: 'Description', type: 'text' },
            { name: 'Severity', type: 'text' },
            { name: 'Root Cause', type: 'text' },
            { name: 'Date Reported', type: 'date' },
        ]
    },
    {
        id: 'financials',
        name: 'Financials',
        icon: CurrencyDollar,
        iconBg: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        properties: [
            { name: 'Name', type: 'text' },
            { name: 'Amount', type: 'number' },
            { name: 'Currency', type: 'text' },
            { name: 'Category', type: 'text' },
            { name: 'Date', type: 'date' },
        ]
    },
];

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Table virtualization when many rows
const TABLE_ROW_HEIGHT_PX = 40;
const VIRTUAL_TABLE_THRESHOLD = 80;

interface EntityCreatorProps {
    entityId: string;
    isNew?: boolean; // if true, show the options panel on first load
    onEntityChanged?: () => void;
}

export const EntityCreator: React.FC<EntityCreatorProps> = ({ entityId, isNew, onEntityChanged }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addPropBtnRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestNameRef = useRef<string>(''); // Track latest name for flush on unmount
    const savedNameRef = useRef<string>('');   // Track last saved name to detect pending changes
    const recordsRef = useRef<CreatorRecord[]>([]); // Track latest records for flush on unmount

    // Entity state
    const [entityName, setEntityName] = useState('');
    const [properties, setProperties] = useState<CreatorProperty[]>([]);
    const [records, setRecords] = useState<CreatorRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Keep refs in sync with state
    useEffect(() => { recordsRef.current = records; }, [records]);

    // UI state
    const [showOptionsPanel, setShowOptionsPanel] = useState(!!isNew);
    const [showAddProperty, setShowAddProperty] = useState(false);
    const [newPropName, setNewPropName] = useState('');
    const [newPropType, setNewPropType] = useState('text');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiLastSummary, setAiLastSummary] = useState<string | null>(null);
    const [datasetAttachedHint, setDatasetAttachedHint] = useState<string | null>(null);
    const [csvMessage, setCsvMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [editingPropId, setEditingPropId] = useState<string | null>(null);
    const [editingPropName, setEditingPropName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [recordSearch, setRecordSearch] = useState('');
    const [tableScrollTop, setTableScrollTop] = useState(0);
    const [tableContainerHeight, setTableContainerHeight] = useState(500);
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
    const [activeSelectCell, setActiveSelectCell] = useState<string | null>(null); // "recordId-propId"
    const [selectFilter, setSelectFilter] = useState('');
    const [newPropRelationId, setNewPropRelationId] = useState(''); // For relation type: which entity to link
    const [newPropTwoWay, setNewPropTwoWay] = useState(false); // Two-way relation checkbox
    const [newPropUnit, setNewPropUnit] = useState(''); // Unit for number type (e.g. ºC, Kg)
    const [allEntities, setAllEntities] = useState<{ id: string; name: string }[]>([]);
    const [relatedRecords, setRelatedRecords] = useState<Record<string, { entityName: string; records: { id: string; displayName: string }[] }>>({}); // relatedEntityId -> records

    // Side panel: peek into a related record
    const [peekRecord, setPeekRecord] = useState<{
        recordId: string;
        relatedEntityId: string;
        entityName: string;
        entityProperties: { id: string; name: string; type: string; relatedEntityId?: string }[];
        values: Record<string, any>;
    } | null>(null);

    // Save entity name to backend (immediate, no debounce)
    const saveNameToBackend = useCallback(async (name: string) => {
        const trimmed = name.trim() || 'Untitled';
        if (trimmed === savedNameRef.current) return; // No change
        try {
            await fetch(`${API_BASE}/entities/${entityId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: trimmed }),
            });
            savedNameRef.current = trimmed;
            onEntityChanged?.();
        } catch (e) { console.error('Error saving name:', e); }
    }, [entityId, onEntityChanged]);

    // Save all unsaved records to backend
    const flushUnsavedRecords = useCallback(async () => {
        const current = recordsRef.current;
        for (const record of current) {
            if (record.isNew) {
                const hasData = Object.values(record.values).some(v => v && v.trim());
                if (!hasData) continue;
                try {
                    const values: Record<string, string> = {};
                    Object.entries(record.values).forEach(([propId, value]) => {
                        if (value) values[propId] = value;
                    });
                    await fetch(`${API_BASE}/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ entityId, values }),
                    });
                } catch (e) { console.error('Error saving record:', e); }
            }
        }
    }, [entityId]);

    // Flush pending saves on unmount (name + unsaved records)
    useEffect(() => {
        return () => {
            // Cancel pending debounce
            if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
            // Save name immediately if changed (fire-and-forget with keepalive)
            const currentName = latestNameRef.current;
            if (currentName && currentName.trim() !== savedNameRef.current) {
                const trimmed = currentName.trim() || 'Untitled';
                fetch(`${API_BASE}/entities/${entityId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: trimmed }),
                    keepalive: true,
                }).catch(() => {});
            }
            // Flush unsaved records (fire-and-forget with keepalive)
            const currentRecords = recordsRef.current;
            for (const record of currentRecords) {
                if (record.isNew) {
                    const hasData = Object.values(record.values).some(v => v && v.trim());
                    if (!hasData) continue;
                    const values: Record<string, string> = {};
                    Object.entries(record.values).forEach(([propId, value]) => {
                        if (value) values[propId] = value;
                    });
                    fetch(`${API_BASE}/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ entityId, values }),
                        keepalive: true,
                    }).catch(() => {});
                }
            }
        };
    }, [entityId]);

    // Load entity data from backend
    useEffect(() => {
        if (!entityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [entityRes, recordsRes] = await Promise.all([
                    fetch(`${API_BASE}/entities/${entityId}`, { credentials: 'include' }),
                    fetch(`${API_BASE}/entities/${entityId}/records`, { credentials: 'include' }),
                ]);
                let loadedProps: CreatorProperty[] = [];
                if (entityRes.ok) {
                    const entity = await entityRes.json();
                    const loadedName = entity.name || '';
                    setEntityName(loadedName);
                    latestNameRef.current = loadedName;
                    savedNameRef.current = loadedName;
                    loadedProps = (entity.properties || []).map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        unit: p.unit,
                        relatedEntityId: p.relatedEntityId,
                    }));
                }
                // Guarantee at least a "Name" column exists
                if (loadedProps.length === 0) {
                    const namePropId = `prop-${Date.now()}-0-${Math.random().toString(36).substr(2, 5)}`;
                    const nameProp: CreatorProperty = { id: namePropId, name: 'Name', type: 'text' };
                    loadedProps = [nameProp];
                    // Save to backend
                    try {
                        await fetch(`${API_BASE}/properties`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ id: namePropId, entityId, name: 'Name', type: 'text', defaultValue: '' }),
                        });
                    } catch {}
                }
                setProperties(loadedProps);
                if (recordsRes.ok) {
                    const recs = await recordsRes.json();
                    setRecords(recs.map((r: any) => ({
                        id: r.id,
                        values: r.values || {},
                    })));
                }
            } catch (error) {
                console.error('Error loading entity:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [entityId]);

    // Fetch all entities (for relation property creation and display)
    useEffect(() => {
        const fetchAllEntities = async () => {
            try {
                const res = await fetch(`${API_BASE}/entities`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setAllEntities(data.filter((e: any) => e.id !== entityId).map((e: any) => ({ id: e.id, name: e.name })));
                }
            } catch (e) { console.error('Error fetching entities:', e); }
        };
        fetchAllEntities();
    }, [entityId]);

    // Fetch related entity records when properties have relation types
    useEffect(() => {
        const relationProps = properties.filter(p => p.type === 'relation' && p.relatedEntityId);
        if (relationProps.length === 0) return;

        const fetchRelated = async () => {
            const newRelated: Record<string, { entityName: string; records: { id: string; displayName: string }[] }> = {};
            for (const prop of relationProps) {
                if (!prop.relatedEntityId || newRelated[prop.relatedEntityId]) continue;
                try {
                    const [entityRes, recordsRes] = await Promise.all([
                        fetch(`${API_BASE}/entities/${prop.relatedEntityId}`, { credentials: 'include' }),
                        fetch(`${API_BASE}/entities/${prop.relatedEntityId}/records`, { credentials: 'include' }),
                    ]);
                    let entityName = 'Unknown';
                    let relatedProps: any[] = [];
                    if (entityRes.ok) {
                        const entityData = await entityRes.json();
                        entityName = entityData.name || 'Unknown';
                        relatedProps = entityData.properties || [];
                    }
                    let recs: { id: string; displayName: string }[] = [];
                    if (recordsRes.ok) {
                        const recordsData = await recordsRes.json();
                        // Find the "name" or first text property for display
                        const nameProp = relatedProps.find((p: any) => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title')
                            || relatedProps.find((p: any) => p.type === 'text')
                            || relatedProps[0];
                        recs = recordsData.map((r: any) => ({
                            id: r.id,
                            displayName: nameProp ? (r.values?.[nameProp.id] || r.id) : r.id,
                        }));
                    }
                    newRelated[prop.relatedEntityId] = { entityName, records: recs };
                } catch (e) { console.error('Error fetching related records:', e); }
            }
            setRelatedRecords(prev => ({ ...prev, ...newRelated }));
        };
        fetchRelated();
    }, [properties]);

    // Also load related records for peek panel's relation properties
    useEffect(() => {
        if (!peekRecord) return;
        const relationProps = peekRecord.entityProperties.filter(p => p.type === 'relation' && p.relatedEntityId && !relatedRecords[p.relatedEntityId!]);
        if (relationProps.length === 0) return;

        const fetchPeekRelated = async () => {
            const newRelated: Record<string, { entityName: string; records: { id: string; displayName: string }[] }> = {};
            for (const prop of relationProps) {
                if (!prop.relatedEntityId || newRelated[prop.relatedEntityId]) continue;
                try {
                    const [entityRes, recordsRes] = await Promise.all([
                        fetch(`${API_BASE}/entities/${prop.relatedEntityId}`, { credentials: 'include' }),
                        fetch(`${API_BASE}/entities/${prop.relatedEntityId}/records`, { credentials: 'include' }),
                    ]);
                    let entityName = 'Unknown';
                    let relatedProps: any[] = [];
                    if (entityRes.ok) {
                        const entityData = await entityRes.json();
                        entityName = entityData.name || 'Unknown';
                        relatedProps = entityData.properties || [];
                    }
                    let recs: { id: string; displayName: string }[] = [];
                    if (recordsRes.ok) {
                        const recordsData = await recordsRes.json();
                        const nameProp = relatedProps.find((p: any) => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title')
                            || relatedProps.find((p: any) => p.type === 'text')
                            || relatedProps[0];
                        recs = recordsData.map((r: any) => ({
                            id: r.id,
                            displayName: nameProp ? (r.values?.[nameProp.id] || r.id) : r.id,
                        }));
                    }
                    newRelated[prop.relatedEntityId] = { entityName, records: recs };
                } catch (e) { console.error('Error fetching peek related records:', e); }
            }
            setRelatedRecords(prev => ({ ...prev, ...newRelated }));
        };
        fetchPeekRelated();
    }, [peekRecord, relatedRecords]);

    // Auto-save entity name (debounced)
    const handleNameChange = (name: string) => {
        setEntityName(name);
        latestNameRef.current = name;
        if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
        nameDebounceRef.current = setTimeout(() => {
            saveNameToBackend(name);
        }, 600);
    };

    // Add property → save to backend (if no name, use the type label like Notion)
    const handleAddProperty = async () => {
        if (newPropType === 'relation' && !newPropRelationId) return; // Must select a related entity
        const typeLabel = PROPERTY_TYPES.find(t => t.value === newPropType)?.label || newPropType;
        const relatedEntity = newPropType === 'relation' ? allEntities.find(e => e.id === newPropRelationId) : null;
        const finalName = newPropName.trim() || (relatedEntity ? relatedEntity.name : typeLabel);
        const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newProp: CreatorProperty = {
            id: propId,
            name: finalName,
            type: newPropType,
            relatedEntityId: newPropType === 'relation' ? newPropRelationId : undefined,
            unit: newPropType === 'number' && newPropUnit.trim() ? newPropUnit.trim() : undefined,
        };
        const isTwoWay = newPropType === 'relation' && newPropTwoWay;
        setProperties(prev => [...prev, newProp]);
        setNewPropName('');
        setNewPropType('text');
        setNewPropRelationId('');
        setNewPropTwoWay(false);
        setNewPropUnit('');
        setShowAddProperty(false);

        try {
            await fetch(`${API_BASE}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: propId,
                    entityId,
                    name: newProp.name,
                    type: newProp.type,
                    defaultValue: '',
                    relatedEntityId: newProp.relatedEntityId,
                    unit: newProp.unit,
                }),
            });

            // Create reverse relation in the target entity for two-way
            if (isTwoWay && newProp.relatedEntityId) {
                const reversePropId = `prop-${Date.now()}-rev-${Math.random().toString(36).substr(2, 5)}`;
                const reverseEntityName = entityName.trim() || 'Untitled';
                await fetch(`${API_BASE}/properties`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        id: reversePropId,
                        entityId: newProp.relatedEntityId,
                        name: reverseEntityName,
                        type: 'relation',
                        defaultValue: '',
                        relatedEntityId: entityId,
                    }),
                });
            }

            onEntityChanged?.();
        } catch (e) { console.error('Error adding property:', e); }
    };

    // Remove property → delete from backend
    const handleRemoveProperty = async (propId: string) => {
        setProperties(prev => prev.filter(p => p.id !== propId));
        try {
            await fetch(`${API_BASE}/properties/${propId}`, { method: 'DELETE', credentials: 'include' });
            onEntityChanged?.();
        } catch (e) { console.error('Error removing property:', e); }
    };

    // Rename property → save on blur
    const startEditProp = (prop: CreatorProperty) => {
        setEditingPropId(prop.id);
        setEditingPropName(prop.name);
    };

    const finishEditProp = async () => {
        if (editingPropId && editingPropName.trim()) {
            const newName = editingPropName.trim();
            setProperties(prev => prev.map(p =>
                p.id === editingPropId ? { ...p, name: newName } : p
            ));
            try {
                await fetch(`${API_BASE}/properties/${editingPropId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: newName }),
                });
            } catch (e) { console.error('Error renaming property:', e); }
        }
        setEditingPropId(null);
        setEditingPropName('');
    };

    // Update record value → auto-save on blur
    const handleRecordChange = (recordId: string, propId: string, value: string) => {
        setRecords(prev => prev.map(r =>
            r.id === recordId
                ? { ...r, values: { ...r.values, [propId]: value } }
                : r
        ));
    };

    const handleRecordBlur = async (record: CreatorRecord) => {
        const hasData = Object.values(record.values).some(v => v && v.trim());
        if (!hasData) return;

        if (record.isNew) {
            // Create new record in backend
            try {
                const values: Record<string, string> = {};
                Object.entries(record.values).forEach(([propId, value]) => {
                    if (value) values[propId] = value;
                });
                const res = await fetch(`${API_BASE}/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ entityId, values }),
                });
                if (res.ok) {
                    const data = await res.json();
                    // Replace local record with saved record (update id, remove isNew)
                    setRecords(prev => prev.map(r =>
                        r.id === record.id ? { ...r, id: data.id, isNew: false } : r
                    ));
                }
            } catch (e) { console.error('Error creating record:', e); }
        } else {
            // Update existing record
            try {
                const values: Record<string, string> = {};
                Object.entries(record.values).forEach(([propId, value]) => {
                    values[propId] = value || '';
                });
                await fetch(`${API_BASE}/records/${record.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ values }),
                });
            } catch (e) { console.error('Error updating record:', e); }
        }
    };

    // Add new (local) row
    const handleAddRecord = () => {
        setRecords(prev => [...prev, { id: `new-${genId()}`, values: {}, isNew: true }]);
    };

    // Delete a record
    const handleDeleteRecord = async (recordId: string, isNew?: boolean) => {
        setRecords(prev => prev.filter(r => r.id !== recordId));
        if (!isNew) {
            try {
                await fetch(`${API_BASE}/records/${recordId}`, { method: 'DELETE', credentials: 'include' });
            } catch (e) { console.error('Error deleting record:', e); }
        }
    };

    // File upload for file-type properties
    const handleFileUpload = async (recordId: string, propId: string, file: globalThis.File) => {
        const uploadKey = `${recordId}-${propId}`;
        setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Upload failed');
            const fileData = await response.json();
            const fileValue = JSON.stringify(fileData);
            // Update local state
            setRecords(prev => prev.map(r =>
                r.id === recordId ? { ...r, values: { ...r.values, [propId]: fileValue } } : r
            ));
            // Auto-save
            const record = records.find(r => r.id === recordId);
            if (record) {
                const updatedRecord = { ...record, values: { ...record.values, [propId]: fileValue } };
                // Small delay so state is updated
                setTimeout(() => handleRecordBlur(updatedRecord), 100);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
        }
    };

    // Build context for entity AI: current table structure + sample rows (by property name)
    const buildEntityContext = useCallback(() => {
        const nameById: Record<string, string> = {};
        properties.forEach(p => { nameById[p.id] = p.name; });
        const sampleRecords = records.slice(0, 3).map(r => {
            const o: Record<string, string> = {};
            Object.entries(r.values).forEach(([propId, val]) => {
                const name = nameById[propId];
                if (name) o[name] = val;
            });
            return o;
        });
        return {
            entityName: entityName || 'Untitled',
            properties: properties.map(p => ({ name: p.name, type: p.type })),
            recordCount: records.length,
            sampleRecords
        };
    }, [entityName, properties, records]);

    // AI: Interpret natural language and run actions (add column, add records, create entity, replace schema)
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setAiError(null);
        setAiLastSummary(null);
        setDatasetAttachedHint(null);
        setIsGeneratingAI(true);
        try {
            const res = await fetch(`${API_BASE}/entity-ai-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: aiPrompt.trim(),
                    context: buildEntityContext()
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setAiError(data?.error || 'Failed to process. Please try again.');
                return;
            }

            const actions = Array.isArray(data.actions) ? data.actions : [];
            const summary = typeof data.summary === 'string' ? data.summary : '';

            for (const action of actions) {
                const type = action.type;
                if (type === 'replace_schema') {
                    if (action.name) handleNameChange(action.name);
                    if (action.properties && action.properties.length > 0) {
                        for (const prop of properties) {
                            try { await fetch(`${API_BASE}/properties/${prop.id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
                        }
                        const aiProps: CreatorProperty[] = [];
                        for (const p of action.properties) {
                            const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                            const propType = (p.type || 'text') as string;
                            const prop: CreatorProperty = { id: propId, name: p.name || 'Untitled', type: propType, unit: p.unit };
                            aiProps.push(prop);
                            await fetch(`${API_BASE}/properties`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ id: propId, entityId, name: prop.name, type: prop.type, defaultValue: '', unit: prop.unit || '' })
                            });
                        }
                        setProperties(aiProps);
                    }
                    onEntityChanged?.();
                } else if (type === 'add_column') {
                    const name = action.name || 'New column';
                    const dataType = (action as { dataType?: string }).dataType || 'text';
                    const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    const newProp: CreatorProperty = { id: propId, name, type: dataType };
                    await fetch(`${API_BASE}/properties`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id: propId, entityId, name, type: newProp.type, defaultValue: '' })
                    });
                    setProperties(prev => [...prev, newProp]);
                    onEntityChanged?.();
                } else if (type === 'add_records' && Array.isArray(action.records) && action.records.length > 0) {
                    const recRes = await fetch(`${API_BASE}/entities/${entityId}/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(action.records)
                    });
                    if (recRes.ok) {
                        const recsRes = await fetch(`${API_BASE}/entities/${entityId}/records`, { credentials: 'include' });
                        if (recsRes.ok) {
                            const recsData = await recsRes.json();
                            const recordsWithValues = (recsData || []).map((rec: { id: string; values: Record<string, string> }) => ({
                                id: rec.id,
                                values: rec.values || {},
                                isNew: false
                            }));
                            setRecords(recordsWithValues);
                        }
                    }
                    onEntityChanged?.();
                } else if (type === 'create_entity' && action.name) {
                    const newId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const entityProps = Array.isArray(action.properties) && action.properties.length > 0
                        ? action.properties
                        : [{ name: 'Name', type: 'text' }];
                    const propIds = entityProps.map((_, i) => `prop-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`);
                    const newEntity = {
                        id: newId,
                        name: action.name,
                        description: 'Created from Entity Creator',
                        author: user?.email ?? undefined,
                        lastEdited: new Date().toISOString(),
                        properties: entityProps.map((p, i) => ({
                            id: propIds[i],
                            name: p.name || 'Name',
                            type: p.type || 'text',
                            defaultValue: ''
                        })),
                        folderId: undefined
                    };
                    const createRes = await fetch(`${API_BASE}/entities`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(newEntity)
                    });
                    if (!createRes.ok) throw new Error('Failed to create entity');
                    const recordsToAdd = Array.isArray(action.records) ? action.records : [];
                    if (recordsToAdd.length > 0) {
                        await fetch(`${API_BASE}/entities/${newId}/records`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(recordsToAdd)
                        });
                    }
                    setAiPrompt('');
                    setAiLastSummary(summary || `Created table "${action.name}".`);
                    onEntityChanged?.();
                    navigate(`/entities/${newId}`);
                    setShowOptionsPanel(false);
                    return;
                }
            }

            setAiPrompt('');
            setAiLastSummary(summary || 'Done.');
            if (actions.some((a: { type: string }) => a.type === 'replace_schema')) setShowOptionsPanel(false);
        } catch (error) {
            console.error('AI command error:', error);
            setAiError('Connection error. Please try again.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Apply a template
    const handleApplyTemplate = async (template: typeof TEMPLATES[0]) => {
        // Delete existing properties
        for (const prop of properties) {
            try { await fetch(`${API_BASE}/properties/${prop.id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
        }

        // Create new properties from template
        const newProps: CreatorProperty[] = [];
        for (const p of template.properties) {
            const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const prop: CreatorProperty = { id: propId, name: p.name, type: p.type };
            newProps.push(prop);
            try {
                await fetch(`${API_BASE}/properties`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id: propId, entityId, name: prop.name, type: prop.type, defaultValue: '' }),
                });
            } catch {}
        }
        setProperties(newProps);
        if (!entityName || entityName === 'Untitled') handleNameChange(template.name);

        // Update entityType in backend
        try {
            await fetch(`${API_BASE}/entities/${entityId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ entityType: template.id }),
            });
        } catch {}

        setShowOptionsPanel(false);
        onEntityChanged?.();
    };

    // CSV Import con validación y mensajes claros
    const handleCSVImport = async (file: File) => {
        setIsImporting(true);
        setCsvMessage(null);
        try {
            let text: string;
            try {
                text = await file.text();
            } catch {
                setCsvMessage({ type: 'error', text: 'No se pudo leer el archivo. Guárdalo como CSV con codificación UTF-8.' });
                return;
            }
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 1) {
                setCsvMessage({ type: 'error', text: 'El archivo está vacío.' });
                return;
            }
            if (lines.length === 1) {
                setCsvMessage({ type: 'error', text: 'Solo hay cabecera; no hay filas de datos.' });
                return;
            }

            const parseCSVLine = (line: string): string[] => {
                const result: string[] = [];
                let current = '';
                let inQuotes = false;
                for (const char of line) {
                    if (char === '"') { inQuotes = !inQuotes; }
                    else if ((char === ',' || char === ';') && !inQuotes) { result.push(current.trim()); current = ''; }
                    else { current += char; }
                }
                result.push(current.trim());
                return result;
            };

            const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '')).filter(Boolean);
            if (headers.length === 0) {
                setCsvMessage({ type: 'error', text: 'No se detectaron columnas. Use comas o punto y coma como separador y UTF-8.' });
                return;
            }
            const dataLines = lines.slice(1);
            const expectedCols = headers.length;
            const badRows = dataLines
                .map((line, i) => ({ i: i + 2, cols: parseCSVLine(line).length }))
                .filter(({ cols }) => cols !== expectedCols);
            if (badRows.length > 0) {
                const first = badRows[0];
                setCsvMessage({
                    type: 'error',
                    text: `Filas con distinto número de columnas (ej. fila ${first.i}: ${first.cols} en lugar de ${expectedCols}). Revisa el CSV.`
                });
                return;
            }

            // Delete old properties and create new ones from CSV
            for (const prop of properties) {
                try { await fetch(`${API_BASE}/properties/${prop.id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
            }

            const csvProps: CreatorProperty[] = [];
            for (const header of headers) {
                const values = dataLines.slice(0, 20).map(line => {
                    const vals = parseCSVLine(line);
                    return vals[headers.indexOf(header)] || '';
                }).filter(v => v !== '');
                const allNumbers = values.length > 0 && values.every(v => !isNaN(Number(v)) && v !== '');
                const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                const propType = allNumbers ? 'number' : 'text';
                csvProps.push({ id: propId, name: header, type: propType });
                try {
                    await fetch(`${API_BASE}/properties`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id: propId, entityId, name: header, type: propType, defaultValue: '' }),
                    });
                } catch {}
            }
            setProperties(csvProps);

            // Import records using property names (backend resolves names → IDs)
            const csvRecords: CreatorRecord[] = [];
            for (const line of dataLines.slice(0, 200)) {
                const vals = parseCSVLine(line);
                const row: Record<string, string> = {};
                headers.forEach((h, idx) => {
                    row[h] = (vals[idx] || '').replace(/^["']|["']$/g, '');
                });
                try {
                    const res = await fetch(`${API_BASE}/entities/${entityId}/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(row),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        // Build values map with propId keys
                        const valuesMap: Record<string, string> = {};
                        csvProps.forEach((p, i) => {
                            valuesMap[p.id] = (vals[i] || '').replace(/^["']|["']$/g, '');
                        });
                        csvRecords.push({ id: data.id, values: valuesMap });
                    }
                } catch {}
            }
            setRecords(csvRecords);

            if (!entityName || entityName === 'Untitled') {
                handleNameChange(file.name.replace(/\.[^/.]+$/, ''));
            }
            const rowCount = Math.min(dataLines.length, 200);
            setDatasetAttachedHint(`Dataset attached: ${headers.length} columns, ${rowCount} rows. What do you want to do with it? (e.g. keep as is, add columns, filter, create another table)`);
            setCsvMessage({ type: 'success', text: `Importadas ${rowCount} filas y ${headers.length} columnas.` });
            onEntityChanged?.();
        } catch (error) {
            console.error('CSV parse error:', error);
            setCsvMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Error al importar. Comprueba que el archivo sea un CSV válido (UTF-8, separado por comas o punto y coma).'
            });
        } finally {
            setIsImporting(false);
        }
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = properties.map(p => p.name);
        const csvRows = [headers.join(',')];
        records.forEach(record => {
            const row = properties.map(p => {
                const val = (record.values[p.id] || '').replace(/"/g, '""');
                return `"${val}"`;
            });
            csvRows.push(row.join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entityName || 'export'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Navigate back — flush pending saves first
    const handleGoBack = async () => {
        if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
        await saveNameToBackend(latestNameRef.current);
        await flushUnsavedRecords();
        navigate('/database');
    };

    const getTypeConfig = (type: string) => PROPERTY_TYPES.find(t => t.value === type) || PROPERTY_TYPES[0];

    // Open peek panel for a related record
    const openPeekPanel = useCallback(async (relatedEntityId: string, recordId: string) => {
        try {
            const [entityRes, recordsRes] = await Promise.all([
                fetch(`${API_BASE}/entities/${relatedEntityId}`, { credentials: 'include' }),
                fetch(`${API_BASE}/entities/${relatedEntityId}/records`, { credentials: 'include' }),
            ]);
            if (!entityRes.ok || !recordsRes.ok) return;
            const entityData = await entityRes.json();
            const allRecs = await recordsRes.json();
            const rec = allRecs.find((r: any) => r.id === recordId);
            if (!rec) return;

            setPeekRecord({
                recordId,
                relatedEntityId,
                entityName: entityData.name || 'Unknown',
                entityProperties: (entityData.properties || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    relatedEntityId: p.relatedEntityId,
                })),
                values: rec.values || {},
            });
        } catch (e) {
            console.error('Error opening peek panel:', e);
        }
    }, []);

    // Sync reverse side of a two-way relation
    const syncReverseRelation = useCallback(async (
        relatedEntityId: string,
        thisRecordId: string,
        action: 'add' | 'remove'
    ) => {
        try {
            // Find the reverse property in the related entity that points back to this entity
            const res = await fetch(`${API_BASE}/entities/${relatedEntityId}`, { credentials: 'include' });
            if (!res.ok) return;
            const relatedEntity = await res.json();
            const reverseProps = (relatedEntity.properties || []).filter(
                (p: any) => p.type === 'relation' && p.relatedEntityId === entityId
            );
            if (reverseProps.length === 0) return; // Not a two-way relation

            // Get all records of the related entity that reference thisRecordId
            const recRes = await fetch(`${API_BASE}/entities/${relatedEntityId}/records`, { credentials: 'include' });
            if (!recRes.ok) return;
            const relatedRecordsData = await recRes.json();

            for (const reverseProp of reverseProps) {
                for (const relatedRec of relatedRecordsData) {
                    const rawVal = relatedRec.values?.[reverseProp.id] || '[]';
                    let currentIds: string[] = [];
                    try { currentIds = JSON.parse(rawVal); if (!Array.isArray(currentIds)) currentIds = rawVal ? [rawVal] : []; } catch { currentIds = rawVal ? [rawVal] : []; }

                    const hasLink = currentIds.includes(thisRecordId);

                    if (action === 'add' && !hasLink) {
                        // This related record should link back only if it is one of the selected target records
                        // We handle this per-record below
                    } else if (action === 'remove' && hasLink) {
                        const newIds = currentIds.filter(id => id !== thisRecordId);
                        await fetch(`${API_BASE}/records/${relatedRec.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ values: { [reverseProp.id]: JSON.stringify(newIds) } }),
                        });
                    }
                }
            }
        } catch (e) { console.error('Error syncing reverse relation:', e); }
    }, [entityId]);

    // Add a reverse link in a specific related record
    const addReverseLink = useCallback(async (
        relatedEntityId: string,
        targetRecordId: string,
        thisRecordId: string
    ) => {
        try {
            const res = await fetch(`${API_BASE}/entities/${relatedEntityId}`, { credentials: 'include' });
            if (!res.ok) return;
            const relatedEntity = await res.json();
            const reverseProps = (relatedEntity.properties || []).filter(
                (p: any) => p.type === 'relation' && p.relatedEntityId === entityId
            );
            if (reverseProps.length === 0) return;

            // Get the target record's current values
            const recRes = await fetch(`${API_BASE}/entities/${relatedEntityId}/records`, { credentials: 'include' });
            if (!recRes.ok) return;
            const records = await recRes.json();
            const targetRec = records.find((r: any) => r.id === targetRecordId);
            if (!targetRec) return;

            for (const reverseProp of reverseProps) {
                const rawVal = targetRec.values?.[reverseProp.id] || '[]';
                let currentIds: string[] = [];
                try { currentIds = JSON.parse(rawVal); if (!Array.isArray(currentIds)) currentIds = rawVal ? [rawVal] : []; } catch { currentIds = rawVal ? [rawVal] : []; }

                if (!currentIds.includes(thisRecordId)) {
                    const newIds = [...currentIds, thisRecordId];
                    await fetch(`${API_BASE}/records/${targetRec.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ values: { [reverseProp.id]: JSON.stringify(newIds) } }),
                    });
                }
            }
        } catch (e) { console.error('Error adding reverse link:', e); }
    }, [entityId]);

    // Collect all unique values used for a select/multi-select property (for dropdown options)
    const getSelectOptions = (propId: string): string[] => {
        const opts = new Set<string>();
        records.forEach(r => {
            const val = r.values[propId];
            if (!val) return;
            // For multi-select, values are stored as JSON array
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                    parsed.forEach((v: string) => { if (v.trim()) opts.add(v.trim()); });
                    return;
                }
            } catch {}
            if (val.trim()) opts.add(val.trim());
        });
        return Array.from(opts).sort();
    };

    // Tag color palette for select values
    const TAG_PALETTE = [
        'bg-blue-100 text-blue-700',
        'bg-emerald-100 text-emerald-700',
        'bg-amber-100 text-amber-700',
        'bg-purple-100 text-purple-700',
        'bg-pink-100 text-pink-700',
        'bg-cyan-100 text-cyan-700',
        'bg-orange-100 text-orange-700',
        'bg-indigo-100 text-indigo-700',
        'bg-rose-100 text-rose-700',
        'bg-teal-100 text-teal-700',
    ];
    const getTagColor = (value: string) => {
        let hash = 0;
        for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
        return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
    };

    // Filter records by search
    const filteredRecords = recordSearch
        ? records.filter(r => Object.values(r.values).some(v => v?.toLowerCase().includes(recordSearch.toLowerCase())))
        : records;

    // Virtualization: only render visible rows when many records
    const useVirtual = filteredRecords.length > VIRTUAL_TABLE_THRESHOLD;
    const virtualStart = useVirtual ? Math.max(0, Math.floor(tableScrollTop / TABLE_ROW_HEIGHT_PX) - 3) : 0;
    const virtualVisibleCount = useVirtual ? Math.ceil(tableContainerHeight / TABLE_ROW_HEIGHT_PX) + 6 : filteredRecords.length;
    const virtualEnd = useVirtual ? Math.min(filteredRecords.length, virtualStart + virtualVisibleCount) : filteredRecords.length;
    const rowsToRender = useVirtual ? filteredRecords.slice(virtualStart, virtualEnd) : filteredRecords;

    const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        setTableScrollTop(el.scrollTop);
        setTableContainerHeight(el.clientHeight);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-[var(--bg-primary)] items-center justify-center">
                <SpinnerGap size={32} className="animate-spin text-[var(--text-tertiary)]" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Table area */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-[1400px] mx-auto w-full">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 px-12 pt-8 pb-1">
                            <button
                                onClick={handleGoBack}
                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                                <ArrowLeft size={16} weight="light" />
                            </button>
                            <span className="text-xs text-[var(--text-tertiary)]">Database</span>
                        </div>

                        {/* Entity title */}
                        <div className="px-12 pb-5">
                            <input
                                type="text"
                                value={entityName}
                                onChange={(e) => handleNameChange(e.target.value)}
                                onBlur={() => {
                                    // Flush save immediately on blur
                                    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
                                    saveNameToBackend(latestNameRef.current);
                                }}
                                placeholder="Untitled"
                                className="text-[28px] font-semibold text-[var(--text-primary)] bg-transparent border-none outline-none placeholder:text-[var(--text-tertiary)] w-full"
                                style={{ fontFamily: "'Berkeley Mono', monospace" }}
                            />
                        </div>

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-12 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-xs font-medium text-[var(--text-primary)]">
                                    <TableIcon size={14} weight="light" />
                                    Table
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)]">{records.length} {records.length === 1 ? 'record' : 'records'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={13} weight="light" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={recordSearch}
                                        onChange={(e) => setRecordSearch(e.target.value)}
                                        className="pl-7 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] w-44 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowOptionsPanel(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-xs text-white transition-colors"
                                >
                                    <Sparkle size={13} weight="duotone" />
                                    AI assistant
                                </button>
                                <button
                                    onClick={handleExportCSV}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-xs text-[var(--text-secondary)] transition-colors"
                                >
                                    <Export size={13} weight="light" />
                                    CSV
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="px-12 pb-8">
                            <div
                                ref={tableScrollRef}
                                onScroll={handleTableScroll}
                                className="overflow-x-auto rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm"
                                style={{ maxHeight: '60vh', overflowY: 'auto' }}
                            >
                                <table className="w-full border-collapse" style={{ minWidth: `${properties.length * 180 + 50}px` }}>
                                    <colgroup>
                                        {properties.map(prop => (
                                            <col key={prop.id} style={{ minWidth: '180px', width: `${100 / properties.length}%` }} />
                                        ))}
                                        <col style={{ width: '50px', minWidth: '50px' }} />
                                    </colgroup>
                                    {/* Header row (sticky when table is scrollable) */}
                                    <thead className="sticky top-0 z-10 bg-[var(--bg-tertiary)] shadow-[0_1px_0_0_var(--border-light)]">
                                        <tr className="bg-[var(--bg-tertiary)]">
                                            {properties.map((prop) => {
                                                const typeConf = getTypeConfig(prop.type);
                                                const TypeIcon = typeConf.icon;
                                                return (
                                                    <th
                                                        key={prop.id}
                                                        className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide border-r border-b border-[var(--border-light)] last:border-r-0 group relative"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <TypeIcon size={14} weight="light" className={typeConf.color.split(' ')[0]} />
                                                            {editingPropId === prop.id ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingPropName}
                                                                    onChange={(e) => setEditingPropName(e.target.value)}
                                                                    onBlur={finishEditProp}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') finishEditProp(); }}
                                                                    className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-[var(--text-primary)] uppercase tracking-wide"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="cursor-pointer hover:text-[var(--text-primary)] transition-colors truncate"
                                                                    onClick={() => startEditProp(prop)}
                                                                    title={prop.unit ? `${prop.name} (${prop.unit})` : prop.name}
                                                                >
                                                                    {prop.name}{prop.unit ? <span className="text-[var(--text-tertiary)] font-normal ml-1">({prop.unit})</span> : null}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {properties.length > 1 && (
                                                            <button
                                                                onClick={() => handleRemoveProperty(prop.id)}
                                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                            {/* Add property column */}
                                            <th className="border-b border-[var(--border-light)] p-0" ref={addPropBtnRef}>
                                                <button
                                                    onClick={() => setShowAddProperty(!showAddProperty)}
                                                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors w-full h-full whitespace-nowrap"
                                                >
                                                    <Plus size={14} weight="light" />
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    {/* Data rows (virtualized when many rows) */}
                                    <tbody>
                                        {useVirtual && virtualStart > 0 && (
                                            <tr aria-hidden style={{ height: virtualStart * TABLE_ROW_HEIGHT_PX }}>
                                                <td colSpan={properties.length + 1} className="p-0 border-0" />
                                            </tr>
                                        )}
                                        {rowsToRender.map((record) => (
                                            <tr
                                                key={record.id}
                                                style={useVirtual ? { height: TABLE_ROW_HEIGHT_PX } : undefined}
                                                className="border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50 transition-colors group/row"
                                            >
                                                {properties.map((prop) => {
                                                    const uploadKey = `${record.id}-${prop.id}`;
                                                    const isUploading = uploadingFiles[uploadKey];

                                                    // File type column
                                                    if (prop.type === 'file') {
                                                        const rawValue = record.values[prop.id];
                                                        let fileData: any = null;
                                                        try {
                                                            if (rawValue) fileData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                                                        } catch {}

                                                        return (
                                                            <td key={prop.id} className="border-r border-[var(--border-light)] last:border-r-0 px-3 py-1">
                                                                {isUploading ? (
                                                                    <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                                                        <SpinnerGap size={14} className="animate-spin" />
                                                                        Uploading…
                                                                    </span>
                                                                ) : fileData?.filename ? (
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <a
                                                                            href={`${API_BASE}/files/${fileData.filename}/download?originalName=${encodeURIComponent(fileData.originalName || fileData.filename)}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors truncate max-w-[140px]"
                                                                            title={fileData.originalName || fileData.filename}
                                                                        >
                                                                            <Paperclip size={11} weight="bold" className="shrink-0" />
                                                                            <span className="truncate">{fileData.originalName || fileData.filename}</span>
                                                                        </a>
                                                                        <label className="p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0">
                                                                            <UploadSimple size={13} weight="light" />
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                onChange={(e) => {
                                                                                    const f = e.target.files?.[0];
                                                                                    if (f) handleFileUpload(record.id, prop.id, f);
                                                                                    e.target.value = '';
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                ) : (
                                                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 hover:text-[var(--text-secondary)] transition-all py-2">
                                                                        <UploadSimple size={14} weight="light" />
                                                                        Upload file
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                const f = e.target.files?.[0];
                                                                                if (f) handleFileUpload(record.id, prop.id, f);
                                                                                e.target.value = '';
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </td>
                                                        );
                                                    }

                                                    // Select type column
                                                    if (prop.type === 'select') {
                                                        const cellKey = `${record.id}-${prop.id}`;
                                                        const isOpen = activeSelectCell === cellKey;
                                                        const currentValue = record.values[prop.id] || '';
                                                        const allOptions = getSelectOptions(prop.id);
                                                        const filtered = selectFilter
                                                            ? allOptions.filter(o => o.toLowerCase().includes(selectFilter.toLowerCase()))
                                                            : allOptions;
                                                        const showCreate = selectFilter.trim() && !allOptions.some(o => o.toLowerCase() === selectFilter.trim().toLowerCase());

                                                        return (
                                                            <td key={prop.id} className="border-r border-[var(--border-light)] last:border-r-0 relative">
                                                                <div
                                                                    className="w-full px-3 py-2 cursor-pointer min-h-[40px] flex items-center"
                                                                    onClick={() => { setActiveSelectCell(isOpen ? null : cellKey); setSelectFilter(''); }}
                                                                >
                                                                    {currentValue ? (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(currentValue)}`}>
                                                                            {currentValue}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 transition-opacity">Select…</span>
                                                                    )}
                                                                </div>
                                                                {isOpen && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-30" onClick={() => setActiveSelectCell(null)} />
                                                                        <div className="absolute top-full left-0 z-40 mt-1 w-52 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden">
                                                                            <div className="p-2 border-b border-[var(--border-light)]">
                                                                                <input
                                                                                    type="text"
                                                                                    value={selectFilter}
                                                                                    onChange={(e) => setSelectFilter(e.target.value)}
                                                                                    placeholder="Search or create…"
                                                                                    className="w-full px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                                                                    autoFocus
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && selectFilter.trim()) {
                                                                                            handleRecordChange(record.id, prop.id, selectFilter.trim());
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: selectFilter.trim() } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                            setSelectFilter('');
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="max-h-40 overflow-y-auto p-1">
                                                                                {currentValue && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            handleRecordChange(record.id, prop.id, '');
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: '' } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                        }}
                                                                                        className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                                                                                    >
                                                                                        Clear selection
                                                                                    </button>
                                                                                )}
                                                                                {filtered.map(opt => (
                                                                                    <button
                                                                                        key={opt}
                                                                                        onClick={() => {
                                                                                            handleRecordChange(record.id, prop.id, opt);
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: opt } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                        }}
                                                                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                                                                                            currentValue === opt ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'
                                                                                        }`}
                                                                                    >
                                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(opt)}`}>{opt}</span>
                                                                                    </button>
                                                                                ))}
                                                                                {showCreate && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            handleRecordChange(record.id, prop.id, selectFilter.trim());
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: selectFilter.trim() } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                            setSelectFilter('');
                                                                                        }}
                                                                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                                                                                    >
                                                                                        <Plus size={12} weight="bold" className="text-[var(--accent-primary)]" />
                                                                                        Create "<span className="font-medium text-[var(--text-primary)]">{selectFilter.trim()}</span>"
                                                                                    </button>
                                                                                )}
                                                                                {filtered.length === 0 && !showCreate && (
                                                                                    <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)] text-center">No options yet. Type to create one.</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                        );
                                                    }

                                                    // Multi-select type column
                                                    if (prop.type === 'multi-select') {
                                                        const cellKey = `${record.id}-${prop.id}`;
                                                        const isOpen = activeSelectCell === cellKey;
                                                        const rawVal = record.values[prop.id] || '[]';
                                                        let selectedValues: string[] = [];
                                                        try { selectedValues = JSON.parse(rawVal); } catch { if (rawVal.trim()) selectedValues = [rawVal]; }
                                                        const allOptions = getSelectOptions(prop.id);
                                                        const filtered = selectFilter
                                                            ? allOptions.filter(o => o.toLowerCase().includes(selectFilter.toLowerCase()))
                                                            : allOptions;
                                                        const showCreate = selectFilter.trim() && !allOptions.some(o => o.toLowerCase() === selectFilter.trim().toLowerCase());

                                                        const toggleOption = (opt: string) => {
                                                            const newValues = selectedValues.includes(opt)
                                                                ? selectedValues.filter(v => v !== opt)
                                                                : [...selectedValues, opt];
                                                            const jsonVal = JSON.stringify(newValues);
                                                            handleRecordChange(record.id, prop.id, jsonVal);
                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: jsonVal } }), 50);
                                                        };

                                                        return (
                                                            <td key={prop.id} className="border-r border-[var(--border-light)] last:border-r-0 relative">
                                                                <div
                                                                    className="w-full px-3 py-2 cursor-pointer min-h-[40px] flex items-center gap-1 flex-wrap"
                                                                    onClick={() => { setActiveSelectCell(isOpen ? null : cellKey); setSelectFilter(''); }}
                                                                >
                                                                    {selectedValues.length > 0 ? (
                                                                        selectedValues.map(v => (
                                                                            <span key={v} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(v)}`}>
                                                                                {v}
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-xs text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 transition-opacity">Select…</span>
                                                                    )}
                                                                </div>
                                                                {isOpen && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-30" onClick={() => setActiveSelectCell(null)} />
                                                                        <div className="absolute top-full left-0 z-40 mt-1 w-52 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden">
                                                                            <div className="p-2 border-b border-[var(--border-light)]">
                                                                                <input
                                                                                    type="text"
                                                                                    value={selectFilter}
                                                                                    onChange={(e) => setSelectFilter(e.target.value)}
                                                                                    placeholder="Search or create…"
                                                                                    className="w-full px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                                                                    autoFocus
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && selectFilter.trim()) {
                                                                                            toggleOption(selectFilter.trim());
                                                                                            setSelectFilter('');
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="max-h-40 overflow-y-auto p-1">
                                                                                {selectedValues.length > 0 && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            handleRecordChange(record.id, prop.id, '[]');
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: '[]' } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                        }}
                                                                                        className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                                                                                    >
                                                                                        Clear all
                                                                                    </button>
                                                                                )}
                                                                                {filtered.map(opt => {
                                                                                    const isSelected = selectedValues.includes(opt);
                                                                                    return (
                                                                                        <button
                                                                                            key={opt}
                                                                                            onClick={() => toggleOption(opt)}
                                                                                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                                                                                                isSelected ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'
                                                                                            }`}
                                                                                        >
                                                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                                                                isSelected ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'border-[var(--border-light)]'
                                                                                            }`}>
                                                                                                {isSelected && <span className="text-white text-[9px]">✓</span>}
                                                                                            </div>
                                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(opt)}`}>{opt}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                                {showCreate && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            toggleOption(selectFilter.trim());
                                                                                            setSelectFilter('');
                                                                                        }}
                                                                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                                                                                    >
                                                                                        <Plus size={12} weight="bold" className="text-[var(--accent-primary)]" />
                                                                                        Create "<span className="font-medium text-[var(--text-primary)]">{selectFilter.trim()}</span>"
                                                                                    </button>
                                                                                )}
                                                                                {filtered.length === 0 && !showCreate && (
                                                                                    <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)] text-center">No options yet. Type to create one.</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                        );
                                                    }

                                                    // Relation type column
                                                    if (prop.type === 'relation' && prop.relatedEntityId) {
                                                        const cellKey = `${record.id}-${prop.id}`;
                                                        const isOpen = activeSelectCell === cellKey;
                                                        const rawVal = record.values[prop.id] || '[]';
                                                        let selectedIds: string[] = [];
                                                        try { selectedIds = JSON.parse(rawVal); if (!Array.isArray(selectedIds)) selectedIds = rawVal ? [rawVal] : []; } catch { if (rawVal.trim()) selectedIds = [rawVal]; }
                                                        const related = relatedRecords[prop.relatedEntityId];
                                                        const availableRecords = related?.records || [];
                                                        const entityName = related?.entityName || 'Entity';
                                                        const filtered = selectFilter
                                                            ? availableRecords.filter(r => r.displayName.toLowerCase().includes(selectFilter.toLowerCase()))
                                                            : availableRecords;

                                                        const toggleRecord = (recId: string) => {
                                                            const isRemoving = selectedIds.includes(recId);
                                                            const newIds = isRemoving
                                                                ? selectedIds.filter(id => id !== recId)
                                                                : [...selectedIds, recId];
                                                            const jsonVal = JSON.stringify(newIds);
                                                            handleRecordChange(record.id, prop.id, jsonVal);
                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: jsonVal } }), 50);

                                                            // Sync reverse side if two-way relation exists
                                                            if (prop.relatedEntityId && !record.isNew) {
                                                                if (isRemoving) {
                                                                    syncReverseRelation(prop.relatedEntityId, record.id, 'remove');
                                                                } else {
                                                                    addReverseLink(prop.relatedEntityId, recId, record.id);
                                                                }
                                                            }
                                                        };

                                                        return (
                                                            <td key={prop.id} className="border-r border-[var(--border-light)] last:border-r-0 relative">
                                                                <div
                                                                    className="w-full px-3 py-2 cursor-pointer min-h-[40px] flex items-center gap-1 flex-wrap"
                                                                    onClick={() => { setActiveSelectCell(isOpen ? null : cellKey); setSelectFilter(''); }}
                                                                >
                                                                    {selectedIds.length > 0 ? (
                                                                        selectedIds.map(id => {
                                                                            const rec = availableRecords.find(r => r.id === id);
                                                                            return (
                                                                                <button
                                                                                    key={id}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (prop.relatedEntityId) openPeekPanel(prop.relatedEntityId, id);
                                                                                    }}
                                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors cursor-pointer"
                                                                                >
                                                                                    <LinkIcon size={10} weight="bold" />
                                                                                    {rec?.displayName || id.slice(0, 8)}
                                                                                </button>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-xs text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 transition-opacity">Link {entityName}…</span>
                                                                    )}
                                                                </div>
                                                                {isOpen && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-30" onClick={() => setActiveSelectCell(null)} />
                                                                        <div className="absolute top-full left-0 z-40 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden">
                                                                            <div className="px-2.5 py-2 border-b border-[var(--border-light)]">
                                                                                <p className="text-[10px] text-[var(--text-tertiary)] font-medium mb-1.5">{entityName}</p>
                                                                                <input
                                                                                    type="text"
                                                                                    value={selectFilter}
                                                                                    onChange={(e) => setSelectFilter(e.target.value)}
                                                                                    placeholder="Search records…"
                                                                                    className="w-full px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                                                                    autoFocus
                                                                                />
                                                                            </div>
                                                                            <div className="max-h-48 overflow-y-auto p-1">
                                                                                {selectedIds.length > 0 && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            handleRecordChange(record.id, prop.id, '[]');
                                                                                            setTimeout(() => handleRecordBlur({ ...record, values: { ...record.values, [prop.id]: '[]' } }), 50);
                                                                                            setActiveSelectCell(null);
                                                                                            // Sync reverse: remove all links
                                                                                            if (prop.relatedEntityId && !record.isNew) {
                                                                                                selectedIds.forEach(id => {
                                                                                                    syncReverseRelation(prop.relatedEntityId!, record.id, 'remove');
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                                                                                    >
                                                                                        Clear all links
                                                                                    </button>
                                                                                )}
                                                                                {filtered.map(rec => {
                                                                                    const isLinked = selectedIds.includes(rec.id);
                                                                                    return (
                                                                                        <button
                                                                                            key={rec.id}
                                                                                            onClick={() => toggleRecord(rec.id)}
                                                                                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                                                                                                isLinked ? 'bg-teal-50 text-teal-800' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                                                                            }`}
                                                                                        >
                                                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                                                                isLinked ? 'bg-teal-500 border-teal-500' : 'border-[var(--border-light)]'
                                                                                            }`}>
                                                                                                {isLinked && <span className="text-white text-[9px]">✓</span>}
                                                                                            </div>
                                                                                            <span className="truncate">{rec.displayName}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                                {filtered.length === 0 && (
                                                                                    <p className="px-2 py-3 text-[11px] text-[var(--text-tertiary)] text-center">
                                                                                        {availableRecords.length === 0 ? `No records in ${entityName}` : 'No matches'}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                        );
                                                    }

                                                    // Default: text / number / date / url / etc.
                                                    return (
                                                        <td key={prop.id} className="border-r border-[var(--border-light)] last:border-r-0 p-0">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type={prop.type === 'number' ? 'number' : prop.type === 'date' ? 'date' : 'text'}
                                                                    value={record.values[prop.id] || ''}
                                                                    onChange={(e) => handleRecordChange(record.id, prop.id, e.target.value)}
                                                                    onBlur={() => handleRecordBlur(record)}
                                                                    placeholder=""
                                                                    className={`${prop.type === 'number' && prop.unit ? 'pr-1' : 'pr-4'} w-full pl-4 py-2.5 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]`}
                                                                />
                                                                {prop.type === 'number' && prop.unit && record.values[prop.id] && (
                                                                    <span className="pr-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap select-none">{prop.unit}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                {/* Delete row button */}
                                                <td className="border-l border-[var(--border-light)] text-center p-0">
                                                    <button
                                                        onClick={() => handleDeleteRecord(record.id, record.isNew)}
                                                        className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {useVirtual && virtualEnd < filteredRecords.length && (
                                            <tr aria-hidden style={{ height: (filteredRecords.length - virtualEnd) * TABLE_ROW_HEIGHT_PX }}>
                                                <td colSpan={properties.length + 1} className="p-0 border-0" />
                                            </tr>
                                        )}
                                    </tbody>
                                    {/* Add row */}
                                    <tfoot>
                                        <tr>
                                            <td colSpan={properties.length + 1} className="p-0">
                                                <button
                                                    onClick={handleAddRecord}
                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors rounded-b-xl"
                                                >
                                                    <Plus size={14} weight="light" />
                                                    New row
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Options (AI, CSV, Templates) */}
                {/* Right Panel - Peek into related record */}
                {peekRecord && !showOptionsPanel && (
                    <div className="w-96 border-l border-[var(--border-light)] bg-[var(--bg-card)] overflow-y-auto shrink-0 flex flex-col animate-in slide-in-from-right-5">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-2 min-w-0">
                                <LinkIcon size={16} weight="bold" className="text-teal-500 shrink-0" />
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{peekRecord.entityName}</h3>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => navigate(`/database/${peekRecord.relatedEntityId}`)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-md transition-colors"
                                    title="Open full table"
                                >
                                    <ArrowSquareOut size={13} weight="bold" />
                                    Open
                                </button>
                                <button
                                    onClick={() => setPeekRecord(null)}
                                    className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                >
                                    <X size={14} className="text-[var(--text-tertiary)]" />
                                </button>
                            </div>
                        </div>
                        {/* Record fields */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {peekRecord.entityProperties.map(prop => {
                                const typeConf = getTypeConfig(prop.type);
                                const TypeIcon = typeConf.icon;
                                const rawValue = peekRecord.values[prop.id];

                                // Render value based on type
                                let displayContent: React.ReactNode;

                                if (prop.type === 'relation' && prop.relatedEntityId) {
                                    let ids: string[] = [];
                                    try { ids = JSON.parse(rawValue || '[]'); if (!Array.isArray(ids)) ids = rawValue ? [rawValue] : []; } catch { if (rawValue) ids = [rawValue]; }
                                    const related = relatedRecords[prop.relatedEntityId];
                                    displayContent = ids.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {ids.map(id => {
                                                const rec = related?.records.find(r => r.id === id);
                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => openPeekPanel(prop.relatedEntityId!, id)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors"
                                                    >
                                                        <LinkIcon size={10} weight="bold" />
                                                        {rec?.displayName || id.slice(0, 8)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)] italic">No links</span>
                                    );
                                } else if (prop.type === 'file') {
                                    let fileData: any = null;
                                    try { if (rawValue) fileData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue; } catch {}
                                    displayContent = fileData?.filename ? (
                                        <a
                                            href={`${API_BASE}/files/${fileData.filename}/download?originalName=${encodeURIComponent(fileData.originalName || fileData.filename)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors"
                                        >
                                            <Paperclip size={11} weight="bold" />
                                            {fileData.originalName || fileData.filename}
                                        </a>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)] italic">No file</span>
                                    );
                                } else if (prop.type === 'select') {
                                    displayContent = rawValue ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(rawValue)}`}>
                                            {rawValue}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)] italic">Empty</span>
                                    );
                                } else if (prop.type === 'multi-select') {
                                    let values: string[] = [];
                                    try { values = JSON.parse(rawValue || '[]'); } catch { if (rawValue) values = [rawValue]; }
                                    displayContent = values.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {values.map(v => (
                                                <span key={v} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getTagColor(v)}`}>
                                                    {v}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)] italic">Empty</span>
                                    );
                                } else if (prop.type === 'url' && rawValue) {
                                    displayContent = (
                                        <a
                                            href={rawValue.startsWith('http') ? rawValue : `https://${rawValue}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-[var(--accent-primary)] hover:underline break-all"
                                        >
                                            {rawValue}
                                        </a>
                                    );
                                } else {
                                    displayContent = rawValue ? (
                                        <span className="text-sm text-[var(--text-primary)] break-words">
                                            {rawValue}{prop.type === 'number' && prop.unit ? <span className="text-[var(--text-tertiary)] ml-1">{prop.unit}</span> : null}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)] italic">Empty</span>
                                    );
                                }

                                return (
                                    <div key={prop.id}>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <TypeIcon size={13} weight="light" className={typeConf.color.split(' ')[0]} />
                                            <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">{prop.name}{prop.unit ? ` (${prop.unit})` : ''}</span>
                                        </div>
                                        <div className="pl-5">
                                            {displayContent}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showOptionsPanel && (
                    <div className="w-80 border-l border-[var(--border-light)] bg-[var(--bg-card)] p-5 overflow-y-auto shrink-0">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-medium text-[var(--text-primary)]">Options</h3>
                            <button
                                onClick={() => setShowOptionsPanel(false)}
                                className="p-1 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <X size={14} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>

                        {/* AI prompt */}
                        <div className="relative mb-4">
                            <div className="flex items-start gap-2 border border-[var(--border-light)] rounded-lg p-2.5 focus-within:ring-1 focus-within:ring-[var(--accent-primary)] focus-within:border-[var(--accent-primary)] transition-all">
                                <Sparkle size={16} weight="duotone" className="text-[var(--accent-primary)] mt-0.5 shrink-0" />
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => { setAiPrompt(e.target.value); if (aiError) setAiError(null); }}
                                    placeholder={datasetAttachedHint ? "What do you want to do with this dataset? (e.g. keep as is, add a column, filter rows…)" : "Add column, add rows, create table…"}
                                    rows={2}
                                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-tertiary)]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAIGenerate();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleAIGenerate}
                                    disabled={isGeneratingAI || !aiPrompt.trim()}
                                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors disabled:opacity-30 shrink-0"
                                >
                                    {isGeneratingAI ? (
                                        <SpinnerGap size={16} className="animate-spin text-[var(--accent-primary)]" />
                                    ) : (
                                        <ArrowUp size={16} weight="bold" />
                                    )}
                                </button>
                            </div>
                            {aiError && (
                                <p className="mt-1.5 text-[11px] text-red-500">{aiError}</p>
                            )}
                            {aiLastSummary && (
                                <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{aiLastSummary}</p>
                            )}
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-2 px-0.5">
                            Examples: &quot;Add a column X&quot;, &quot;Add 3 rows: …&quot;, &quot;Create a new table called Orders&quot;
                        </p>

                        {/* Attach dataset + hint + Templates: al crear entidad nueva (sin propiedades o solo la columna por defecto) */}
                        {(properties.length === 0 || (isNew && properties.length <= 1)) && (
                            <>
                                <div className="space-y-1 mb-4">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isImporting}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left disabled:opacity-50 border border-[var(--border-light)]"
                                    >
                                        {isImporting ? (
                                            <SpinnerGap size={18} className="animate-spin text-[var(--text-tertiary)]" />
                                        ) : (
                                            <Download size={18} weight="light" className="text-[var(--text-tertiary)]" />
                                        )}
                                        Attach dataset
                                    </button>
                                    {csvMessage && (
                                        <p className={`text-[11px] px-1 ${csvMessage.type === 'error' ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
                                            {csvMessage.text}
                                        </p>
                                    )}
                                </div>
                                {datasetAttachedHint && (
                                    <div className="mb-4 p-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
                                        <p className="text-xs text-[var(--text-primary)]">{datasetAttachedHint}</p>
                                        <p className="text-[11px] text-[var(--text-secondary)] mt-1">Describe above what you want and the AI will do it.</p>
                                    </div>
                                )}
                                <div className="mb-5">
                                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">Templates</p>
                                    <div className="space-y-1">
                                        {TEMPLATES.map(template => (
                                            <button
                                                key={template.id}
                                                onClick={() => handleApplyTemplate(template)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                            >
                                                <span className={`w-7 h-7 ${template.iconBg} rounded-md flex items-center justify-center`}>
                                                    {React.createElement(template.icon, { size: 16, weight: 'light' })}
                                                </span>
                                                {template.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCSVImport(file);
                                e.target.value = '';
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Add property dropdown - rendered fixed to avoid overflow clipping */}
            {showAddProperty && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddProperty(false)} />
                    <div
                        className="fixed w-64 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl z-50 p-3"
                        style={{
                            top: addPropBtnRef.current
                                ? addPropBtnRef.current.getBoundingClientRect().bottom + 4
                                : 200,
                            left: addPropBtnRef.current
                                ? Math.min(
                                    addPropBtnRef.current.getBoundingClientRect().left,
                                    window.innerWidth - 280 // 256px width + 24px margin
                                )
                                : 200,
                        }}
                    >
                        <input
                            type="text"
                            value={newPropName}
                            onChange={(e) => setNewPropName(e.target.value)}
                            placeholder="Property name"
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] mb-2"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddProperty(); }}
                        />
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">Type</p>
                        <div className="grid grid-cols-2 gap-1 mb-3">
                            {PROPERTY_TYPES.map(pt => {
                                const Icon = pt.icon;
                                return (
                                    <button
                                        key={pt.value}
                                        onClick={() => setNewPropType(pt.value)}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
                                            newPropType === pt.value
                                                ? 'border-[var(--text-tertiary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                                                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                    >
                                        <Icon size={14} weight="light" />
                                        {pt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Related entity selector for Relation type */}
                        {newPropType === 'relation' && (
                            <div className="mt-2 mb-1">
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block">Link to</label>
                                {allEntities.length === 0 ? (
                                    <p className="text-[11px] text-[var(--text-tertiary)] italic">No other entities available</p>
                                ) : (
                                    <select
                                        value={newPropRelationId}
                                        onChange={(e) => setNewPropRelationId(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-md text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                    >
                                        <option value="">Select entity…</option>
                                        {allEntities.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                )}
                                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none group">
                                    <input
                                        type="checkbox"
                                        checked={newPropTwoWay}
                                        onChange={(e) => setNewPropTwoWay(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-light)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                                    />
                                    <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Two-way relation</span>
                                </label>
                            </div>
                        )}
                        {/* Unit input for Number type */}
                        {newPropType === 'number' && (
                            <div className="mt-2 mb-1">
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block">Unit (optional)</label>
                                <input
                                    type="text"
                                    value={newPropUnit}
                                    onChange={(e) => setNewPropUnit(e.target.value)}
                                    placeholder="e.g. ºC, Kg, m/s, %…"
                                    className="w-full px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-md text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>
                        )}
                        <button
                            onClick={handleAddProperty}
                            disabled={newPropType === 'relation' && !newPropRelationId}
                            className="w-full px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Add
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
