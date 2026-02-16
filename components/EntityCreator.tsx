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
    MagnifyingGlass, Export, Paperclip, UploadSimple
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface CreatorProperty {
    id: string;
    name: string;
    type: string;
    unit?: string;
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

// Suggested templates
const TEMPLATES = [
    {
        id: 'product',
        name: 'Product',
        icon: '📦',
        iconBg: 'bg-blue-100',
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
        icon: '⚙️',
        iconBg: 'bg-emerald-100',
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
        icon: '🔧',
        iconBg: 'bg-amber-100',
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
        icon: '⚠️',
        iconBg: 'bg-red-100',
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
        icon: '💰',
        iconBg: 'bg-violet-100',
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
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [editingPropId, setEditingPropId] = useState<string | null>(null);
    const [editingPropName, setEditingPropName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [recordSearch, setRecordSearch] = useState('');
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

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
        const typeLabel = PROPERTY_TYPES.find(t => t.value === newPropType)?.label || newPropType;
        const finalName = newPropName.trim() || typeLabel;
        const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const propType = newPropType === 'select' || newPropType === 'multi-select' ? 'text' : newPropType;
        const newProp: CreatorProperty = { id: propId, name: finalName, type: propType };
        setProperties(prev => [...prev, newProp]);
        setNewPropName('');
        setNewPropType('text');
        setShowAddProperty(false);

        try {
            await fetch(`${API_BASE}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: propId, entityId, name: newProp.name, type: newProp.type, defaultValue: '' }),
            });
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

    // AI: Generate schema from description
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGeneratingAI(true);
        try {
            const res = await fetch(`${API_BASE}/ai/generate-entity-schema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ description: aiPrompt.trim() })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.name) {
                    handleNameChange(data.name);
                }
                if (data.properties && Array.isArray(data.properties)) {
                    // Delete existing properties first
                    for (const prop of properties) {
                        try { await fetch(`${API_BASE}/properties/${prop.id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
                    }

                    // Create new properties
                    const aiProps: CreatorProperty[] = [];
                    for (const p of data.properties) {
                        const propId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        const propType = p.type === 'select' || p.type === 'multi-select' ? 'text' : (p.type || 'text');
                        const prop: CreatorProperty = { id: propId, name: p.name || 'Untitled', type: propType, unit: p.unit };
                        aiProps.push(prop);
                        try {
                            await fetch(`${API_BASE}/properties`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ id: propId, entityId, name: prop.name, type: prop.type, defaultValue: '', unit: prop.unit }),
                            });
                        } catch {}
                    }
                    setProperties(aiProps);
                    onEntityChanged?.();
                }
                setShowOptionsPanel(false);
            }
        } catch (error) {
            console.error('AI generation error:', error);
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
            const propType = p.type === 'select' || p.type === 'multi-select' ? 'text' : p.type;
            const prop: CreatorProperty = { id: propId, name: p.name, type: propType };
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

    // CSV Import
    const handleCSVImport = async (file: File) => {
        setIsImporting(true);
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 1) return;

            const parseCSVLine = (line: string): string[] => {
                const result: string[] = [];
                let current = '';
                let inQuotes = false;
                for (const char of line) {
                    if (char === '"') { inQuotes = !inQuotes; }
                    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                    else { current += char; }
                }
                result.push(current.trim());
                return result;
            };

            const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
            const dataLines = lines.slice(1);

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
            setShowOptionsPanel(false);
            onEntityChanged?.();
        } catch (error) {
            console.error('CSV parse error:', error);
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

    // Filter records by search
    const filteredRecords = recordSearch
        ? records.filter(r => Object.values(r.values).some(v => v?.toLowerCase().includes(recordSearch.toLowerCase())))
        : records;

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
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-sm overflow-x-auto">
                                {/* Header row */}
                                <div className="flex border-b border-[var(--border-light)] bg-[var(--bg-tertiary)] min-w-fit">
                                    {properties.map((prop) => {
                                        const typeConf = getTypeConfig(prop.type);
                                        const TypeIcon = typeConf.icon;
                                        return (
                                            <div
                                                key={prop.id}
                                                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide border-r border-[var(--border-light)] last:border-r-0 group relative"
                                                style={{ minWidth: '180px', flex: '1 0 180px' }}
                                            >
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
                                                        className="cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                                        onClick={() => startEditProp(prop)}
                                                    >
                                                        {prop.name}
                                                    </span>
                                                )}
                                                {properties.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveProperty(prop.id)}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {/* Add property column */}
                                    <div className="relative shrink-0 border-l border-[var(--border-light)]" style={{ minWidth: '140px' }} ref={addPropBtnRef}>
                                        <button
                                            onClick={() => setShowAddProperty(!showAddProperty)}
                                            className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors w-full h-full"
                                        >
                                            <Plus size={14} weight="light" />
                                            Property
                                        </button>
                                    </div>
                                </div>

                                {/* Data rows */}
                                {filteredRecords.map((record) => (
                                    <div key={record.id} className="flex border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50 transition-colors group/row min-w-fit">
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
                                                    <div
                                                        key={prop.id}
                                                        className="border-r border-[var(--border-light)] last:border-r-0 flex items-center px-3"
                                                        style={{ minWidth: '180px', flex: '1 0 180px' }}
                                                    >
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
                                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors py-2">
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
                                                    </div>
                                                );
                                            }

                                            // Default: text / number / date / url / etc.
                                            return (
                                                <div
                                                    key={prop.id}
                                                    className="border-r border-[var(--border-light)] last:border-r-0"
                                                    style={{ minWidth: '180px', flex: '1 0 180px' }}
                                                >
                                                    <input
                                                        type={prop.type === 'number' ? 'number' : prop.type === 'date' ? 'date' : 'text'}
                                                        value={record.values[prop.id] || ''}
                                                        onChange={(e) => handleRecordChange(record.id, prop.id, e.target.value)}
                                                        onBlur={() => handleRecordBlur(record)}
                                                        placeholder=""
                                                        className="w-full px-4 py-2.5 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                            );
                                        })}
                                        {/* Delete row button */}
                                        <div className="shrink-0 flex items-center justify-center border-l border-[var(--border-light)]" style={{ minWidth: '140px' }}>
                                            <button
                                                onClick={() => handleDeleteRecord(record.id, record.isNew)}
                                                className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add row */}
                                <button
                                    onClick={handleAddRecord}
                                    className="w-full min-w-fit flex items-center gap-2 px-4 py-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors rounded-b-xl"
                                >
                                    <Plus size={14} weight="light" />
                                    New row
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Options (AI, CSV, Templates) */}
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
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="Describe what you want to build..."
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
                        </div>

                        {/* Quick actions */}
                        <div className="space-y-1 mb-5">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left disabled:opacity-50"
                            >
                                {isImporting ? (
                                    <SpinnerGap size={18} className="animate-spin text-[var(--text-tertiary)]" />
                                ) : (
                                    <Download size={18} weight="light" className="text-[var(--text-tertiary)]" />
                                )}
                                Import CSV
                            </button>
                        </div>

                        {/* Suggested templates */}
                        <div className="mb-5">
                            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">Templates</p>
                            <div className="space-y-1">
                                {TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleApplyTemplate(template)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                    >
                                        <span className={`w-7 h-7 ${template.iconBg} rounded-md flex items-center justify-center text-sm`}>
                                            {template.icon}
                                        </span>
                                        {template.name}
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                                            newPropType === pt.value
                                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                    >
                                        <Icon size={14} weight="light" />
                                        {pt.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={handleAddProperty}
                            className="w-full px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors"
                        >
                            Add
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
