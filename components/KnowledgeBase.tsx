import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Plus, Search, Filter, X, FileText, Shield, Upload, FileSpreadsheet, Loader2, File, Download, Trash2, Eye, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { Entity } from '../types';
import { EntityCard } from './EntityCard';
import { Tabs } from './Tabs';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface KnowledgeBaseProps {
    entities: Entity[];
    onNavigate: (entityId: string) => void;
    onRefreshEntities?: () => Promise<void>;
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

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate, onRefreshEntities }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'entities' | 'standards' | 'documents'>('entities');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');
    const [standards, setStandards] = useState<Standard[]>([]);
    const [isLoadingStandards, setIsLoadingStandards] = useState(false);
    const [isCreatingStandard, setIsCreatingStandard] = useState(false);
    
    // Documents state
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const documentFileInputRef = useRef<HTMLInputElement>(null);
    const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
    const [newStandardName, setNewStandardName] = useState('');
    const [newStandardCode, setNewStandardCode] = useState('');
    const [newStandardCategory, setNewStandardCategory] = useState('');
    const [newStandardDescription, setNewStandardDescription] = useState('');
    
    // File upload states
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadMode, setUploadMode] = useState<'manual' | 'file'>('manual');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        } else if (activeTab === 'documents') {
            fetchDocuments();
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
            setUploadMode('manual');
            
            // Refresh entities list
            if (onRefreshEntities) {
                await onRefreshEntities();
            }
        } catch (error) {
            console.error('Error creating entity:', error);
            alert('Failed to create entity');
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }

        setIsUploadingFile(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('createEntity', 'true');
            formData.append('entityName', newEntityName.trim() || file.name.replace(/\.[^/.]+$/, ''));

            const res = await fetch(`${API_BASE}/entities/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                setNewEntityName('');
                setNewEntityDescription('');
                setIsCreatingEntity(false);
                setUploadMode('manual');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                
                // Refresh entities list
                if (onRefreshEntities) {
                    await onRefreshEntities();
                }
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create entity from file');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file');
        } finally {
            setIsUploadingFile(false);
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
            // Refresh entities list
            if (onRefreshEntities) {
                await onRefreshEntities();
            }
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

    const fetchDocuments = async () => {
        setIsLoadingDocuments(true);
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDocuments(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
            setDocuments([]);
        } finally {
            setIsLoadingDocuments(false);
        }
    };

    const handleUploadDocument = async (file: File) => {
        if (!file) return;

        setIsUploadingDocument(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_BASE}/knowledge/documents`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) {
                await fetchDocuments();
                if (documentFileInputRef.current) {
                    documentFileInputRef.current.value = '';
                }
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to upload document');
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Failed to upload document');
        } finally {
            setIsUploadingDocument(false);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${docId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                await fetchDocuments();
            } else {
                alert('Failed to delete document');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Failed to delete document');
        }
    };

    const handleCopyCitation = async (doc: any) => {
        const citation = `@${doc.name}`;
        await navigator.clipboard.writeText(citation);
        setCopiedDocId(doc.id);
        setTimeout(() => setCopiedDocId(null), 2000);
    };

    const handleCopyStandardCitation = async (standard: Standard) => {
        const citation = `@${standard.name}`;
        await navigator.clipboard.writeText(citation);
        setCopiedDocId(standard.id);
        setTimeout(() => setCopiedDocId(null), 2000);
    };

    // Combine documents and standards for the documents view
    const allDocuments = [
        ...documents.map(doc => ({ ...doc, type: 'document' })),
        ...standards.map(standard => ({
            id: standard.id,
            name: standard.name,
            summary: standard.description,
            tags: [],
            fileSize: null,
            createdAt: standard.effectiveDate || new Date().toISOString(),
            type: 'standard',
            code: standard.code,
            category: standard.category,
            version: standard.version,
            status: standard.status
        }))
    ];

    const filteredDocuments = allDocuments.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(doc.tags) && doc.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        (doc.type === 'standard' && doc.code?.toLowerCase().includes(searchQuery.toLowerCase()))
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
                        { id: 'standards', label: 'Standards', icon: Shield, badge: standards.length },
                        { id: 'documents', label: 'Documents', icon: FileText, badge: documents.length }
                    ]}
                    activeTab={activeTab}
                    onChange={(tabId) => setActiveTab(tabId as 'entities' | 'standards' | 'documents')}
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
                ) : activeTab === 'standards' ? (
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
                                            <div className="flex items-center gap-2">
                                                {standard.version && (
                                                    <div className="text-xs text-slate-500">
                                                        v{standard.version}
                                                    </div>
                                                )}
                                                {copiedDocId === standard.id && (
                                                    <div className="text-xs text-green-600 flex items-center gap-1">
                                                        <Check size={10} />
                                                        Cited
                                                    </div>
                                                )}
                                            </div>
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
                ) : activeTab === 'documents' ? (
                    <>
                        {/* Documents Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-slate-500">
                                {searchQuery
                                    ? `Showing ${filteredDocuments.length} of ${allDocuments.length} documents`
                                    : `Total: ${allDocuments.length} documents (${documents.length} files, ${standards.length} standards)`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search documents..."
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
                                    onClick={() => documentFileInputRef.current?.click()}
                                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Upload size={14} className="mr-2" />
                                    Upload Document
                                </button>
                                <input
                                    ref={documentFileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleUploadDocument(file);
                                        }
                                    }}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* Documents Grid */}
                        {isLoadingDocuments ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                            </div>
                        ) : filteredDocuments.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                {filteredDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    doc.type === 'standard' 
                                                        ? 'bg-gradient-to-br from-blue-50 to-blue-100' 
                                                        : 'bg-gradient-to-br from-purple-50 to-purple-100'
                                                }`}>
                                                    {doc.type === 'standard' ? (
                                                        <Shield size={18} className="text-blue-600" />
                                                    ) : (
                                                        <FileText size={18} className="text-purple-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-normal text-slate-900 truncate" title={doc.name}>
                                                        {doc.name}
                                                    </h3>
                                                    {doc.summary && (
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.summary}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        if (doc.type === 'standard') {
                                                            const standard = standards.find(s => s.id === doc.id);
                                                            if (standard) handleCopyStandardCitation(standard);
                                                        } else {
                                                            handleCopyCitation(doc);
                                                        }
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                    title="Copy citation"
                                                >
                                                    {copiedDocId === doc.id ? <Check size={14} /> : <LinkIcon size={14} />}
                                                </button>
                                                {doc.type !== 'standard' && (
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete document"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
                                            {doc.type === 'standard' ? (
                                                <>
                                                    {doc.code && (
                                                        <span className="px-2 py-0.5 bg-purple-100 rounded text-purple-700 font-medium">
                                                            {doc.code}
                                                        </span>
                                                    )}
                                                    {doc.category && (
                                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                                            {doc.category}
                                                        </span>
                                                    )}
                                                    {doc.version && (
                                                        <span className="text-slate-500">v{doc.version}</span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {doc.fileSize && (
                                                        <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                                    )}
                                                    {doc.tags && doc.tags.length > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            {doc.tags.slice(0, 2).map((tag: string, idx: number) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {doc.tags.length > 2 && <span>+{doc.tags.length - 2}</span>}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {doc.createdAt && (
                                                <span className="ml-auto">
                                                    {new Date(doc.createdAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {copiedDocId === doc.id && (
                                            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                                <Check size={12} />
                                                Citation copied! Use @{doc.name} to reference this {doc.type === 'standard' ? 'standard' : 'document'}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText size={48} className="text-slate-300 mb-4" />
                                <h3 className="text-lg font-normal text-slate-900 mb-2">No documents yet</h3>
                                <p className="text-sm text-slate-500 mb-6">Upload your first document to start building your knowledge base</p>
                                <button
                                    onClick={() => documentFileInputRef.current?.click()}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Upload size={16} />
                                    Upload Document
                                </button>
                            </div>
                        )}

                        {/* Upload Progress */}
                        {isUploadingDocument && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Loader2 size={24} className="text-slate-600 animate-spin" />
                                        <div>
                                            <h3 className="text-base font-medium text-slate-900">Uploading document</h3>
                                            <p className="text-sm text-slate-500">Processing and extracting content...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
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
                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-50 rounded-lg border border-slate-200">
                                <button
                                    onClick={() => setUploadMode('manual')}
                                    className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                                        uploadMode === 'manual'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-800'
                                    }`}
                                >
                                    Manual
                                </button>
                                <button
                                    onClick={() => setUploadMode('file')}
                                    className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                                        uploadMode === 'file'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-800'
                                    }`}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Upload size={14} />
                                        Upload File
                                    </span>
                                </button>
                            </div>

                            {uploadMode === 'manual' ? (
                                <>
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
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Entity Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newEntityName}
                                            onChange={(e) => setNewEntityName(e.target.value)}
                                            placeholder="Will use filename if empty"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Leave empty to use the filename as entity name</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Upload Excel or CSV File
                                        </label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (!newEntityName.trim()) {
                                                            setNewEntityName(file.name.replace(/\.[^/.]+$/, ''));
                                                        }
                                                        handleFileUpload(file);
                                                    }
                                                }}
                                                className="hidden"
                                                id="entity-file-upload"
                                                disabled={isUploadingFile}
                                            />
                                            <label
                                                htmlFor="entity-file-upload"
                                                className={`cursor-pointer flex flex-col items-center ${isUploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isUploadingFile ? (
                                                    <>
                                                        <Loader2 size={32} className="text-slate-400 mb-2 animate-spin" />
                                                        <span className="text-sm text-slate-600">Processing file...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                                                            <FileSpreadsheet size={24} className="text-slate-600" />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700 mb-1">Click to upload or drag and drop</span>
                                                        <span className="text-xs text-slate-500">CSV, XLSX, or XLS (max 50MB)</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            The entity will be created with properties based on the columns in your file. Data will be imported automatically.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsCreatingEntity(false);
                                    setUploadMode('manual');
                                    setNewEntityName('');
                                    setNewEntityDescription('');
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            {uploadMode === 'manual' && (
                                <button
                                    onClick={handleCreateEntity}
                                    disabled={!newEntityName.trim()}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Create Entity
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
