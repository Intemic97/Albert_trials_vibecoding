import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Plus, MagnifyingGlass, Funnel, X, FileText, Folder, FolderPlus, UploadSimple, Table, SpinnerGap, File, DownloadSimple, Trash, Eye, Link as LinkIcon, Copy, Check, PencilSimple, Calendar, Tag, CaretRight } from '@phosphor-icons/react';
import { Entity } from '../types';
import { EntityCard } from './EntityCard';
import { Tabs } from './Tabs';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { ToastContainer } from './ui/Toast';

interface KnowledgeBaseProps {
    entities: Entity[];
    onNavigate: (entityId: string) => void;
}

interface Folder {
    id: string;
    name: string;
    description?: string;
    color?: string;
    parentId?: string;
    documentIds: string[];
    entityIds: string[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate }) => {
    const navigate = useNavigate();
    const { notifications, removeNotification, success, error: showError, warning } = useNotifications(3000);
    const location = useLocation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'entities' | 'folders' | 'documents'>('entities');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');
    
    // Folders state
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderDescription, setNewFolderDescription] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [showFolderSelector, setShowFolderSelector] = useState<{ type: 'document' | 'entity', itemId: string } | null>(null);
    
    // Documents state
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const documentFileInputRef = useRef<HTMLInputElement>(null);
    const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
    
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

    // Load folders and documents when tab is active
    useEffect(() => {
        if (activeTab === 'folders') {
            fetchFolders();
        } else if (activeTab === 'documents') {
            fetchDocuments();
        }
    }, [activeTab]);

    // Load folders when needed for entity/document assignment
    useEffect(() => {
        if (showFolderSelector && folders.length === 0) {
            fetchFolders();
        }
    }, [showFolderSelector]);

    const fetchFolders = async () => {
        setIsLoadingFolders(true);
        try {
            const res = await fetch(`${API_BASE}/knowledge/folders`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setFolders(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
            setFolders([]);
        } finally {
            setIsLoadingFolders(false);
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
            
            // Reload entities by navigating away and back, or trigger a refresh
            window.location.reload();
        } catch (error) {
            console.error('Error creating entity:', error);
            showError('Failed to create entity');
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            warning('Invalid file type', 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
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
                
                // Reload entities
                window.location.reload();
            } else {
                const errorData = await res.json();
                showError('Failed to create entity', errorData.error || 'Please try again');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showError('Failed to upload file');
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
            window.location.reload();
        } catch (error) {
            console.error('Error deleting entity:', error);
            showError('Failed to delete entity');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        const newFolder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'> = {
            name: newFolderName.trim(),
            description: newFolderDescription.trim() || undefined,
            color: newFolderColor,
            documentIds: [],
            entityIds: [],
            createdBy: user?.id || user?.email || 'unknown'
        };

        try {
            const res = await fetch(`${API_BASE}/knowledge/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newFolder),
                credentials: 'include'
            });

            if (res.ok) {
                setNewFolderName('');
                setNewFolderDescription('');
                setNewFolderColor('#3b82f6');
                setIsCreatingFolder(false);
                await fetchFolders();
            } else {
                showError('Failed to create folder');
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            showError('Failed to create folder');
        }
    };

    const handleUpdateFolder = async (folder: Folder) => {
        try {
            const res = await fetch(`${API_BASE}/knowledge/folders/${folder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: folder.name,
                    description: folder.description,
                    color: folder.color
                }),
                credentials: 'include'
            });

            if (res.ok) {
                setEditingFolder(null);
                await fetchFolders();
            } else {
                showError('Failed to update folder');
            }
        } catch (error) {
            console.error('Error updating folder:', error);
            showError('Failed to update folder');
        }
    };

    const handleDeleteFolder = async (folder: Folder) => {
        if (!confirm(`Are you sure you want to delete "${folder.name}"? This will not delete the documents or entities inside.`)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/knowledge/folders/${folder.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                await fetchFolders();
            } else {
                showError('Failed to delete folder');
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            showError('Failed to delete folder');
        }
    };

    const handleAddToFolder = async (folderId: string, type: 'document' | 'entity', itemId: string) => {
        try {
            const res = await fetch(`${API_BASE}/knowledge/folders/${folderId}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, itemId }),
                credentials: 'include'
            });

            if (res.ok) {
                await fetchFolders();
                if (type === 'document') {
                    await fetchDocuments();
                }
            } else {
                showError('Failed to add item to folder');
            }
        } catch (error) {
            console.error('Error adding to folder:', error);
            showError('Failed to add item to folder');
        }
    };

    const handleRemoveFromFolder = async (folderId: string, type: 'document' | 'entity', itemId: string) => {
        try {
            const res = await fetch(`${API_BASE}/knowledge/folders/${folderId}/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, itemId }),
                credentials: 'include'
            });

            if (res.ok) {
                await fetchFolders();
                if (type === 'document') {
                    await fetchDocuments();
                }
            } else {
                showError('Failed to remove item from folder');
            }
        } catch (error) {
            console.error('Error removing from folder:', error);
            showError('Failed to remove item from folder');
        }
    };

    const filteredFolders = folders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        folder.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
                const errorData = await res.json();
                showError('Failed to upload document', errorData.error);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            showError('Failed to upload document');
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
                showError('Failed to delete document');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            showError('Failed to delete document');
        }
    };

    const handleCopyCitation = async (doc: any) => {
        const citation = `@${doc.name}`;
        await navigator.clipboard.writeText(citation);
        setCopiedDocId(doc.id);
        setTimeout(() => setCopiedDocId(null), 2000);
    };

    const handleCopyFolderCitation = async (folder: Folder) => {
        const citation = `@${folder.name}`;
        await navigator.clipboard.writeText(citation);
        setCopiedDocId(folder.id);
        setTimeout(() => setCopiedDocId(null), 2000);
    };

    const filteredDocuments = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(doc.tags) && doc.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-tutorial="database-content">
            {/* Header */}
            <PageHeader title="Your database" subtitle="View and manage your different entities" />

            {/* Tabs */}
            <div className="px-8 pt-6 bg-[var(--bg-primary)] border-b border-[var(--border-light)]">
                <Tabs
                    items={[
                        { id: 'entities', label: 'Entities', icon: Database, badge: entities.length },
                        { id: 'documents', label: 'Documents', icon: FileText, badge: documents.length },
                        { id: 'folders', label: 'Folders', icon: Folder, badge: folders.length }
                    ]}
                    activeTab={activeTab}
                    onChange={(tabId) => setActiveTab(tabId as 'entities' | 'folders' | 'documents')}
                />
            </div>

            {/* Content */}
            <div data-tutorial="database-main" className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'entities' ? (
                    <>
                        {/* Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-[var(--text-secondary)]">
                                {searchQuery
                                    ? `Showing ${filteredEntities.length} of ${entities.length} entities`
                                    : `Total: ${entities.length} entities`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search entities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                <button className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                    <Funnel weight="light" size={14} className="mr-2" />
                                    Filter
                                </button>
                                <button
                                    onClick={() => setIsCreatingEntity(true)}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <Plus weight="light" size={14} className="mr-2" />
                                    Create Entity
                                </button>
                            </div>
                        </div>

                        {/* Entities Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                            {filteredEntities.map((entity) => {
                                const entityFolder = folders.find(f => f.entityIds.includes(entity.id));
                                return (
                                    <div key={entity.id} className="group relative">
                                        <EntityCard
                                            entity={entity}
                                            onClick={(e) => onNavigate(e.id)}
                                            onDelete={handleDeleteEntity}
                                        />
                                        {/* Folder assignment button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowFolderSelector({ type: 'entity', itemId: entity.id });
                                            }}
                                            className="absolute top-3 right-3 p-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] rounded-md text-[var(--text-secondary)] transition-colors shadow-sm opacity-0 group-hover:opacity-100 z-10"
                                            title="Add to folder"
                                        >
                                            <Folder weight="light" size={14} />
                                        </button>
                                        {/* Folder badge */}
                                        {entityFolder && (
                                            <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-xs text-[var(--text-secondary)] shadow-sm">
                                                <Folder weight="light" size={12} style={{ color: entityFolder.color || '#3b82f6' }} />
                                                <span className="truncate max-w-[100px]">{entityFolder.name}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Empty State / Add New Placeholder */}
                            <div
                                onClick={() => setIsCreatingEntity(true)}
                                className="border-2 border-dashed border-[var(--border-medium)] rounded-xl flex flex-col items-center justify-center min-h-[200px] text-[var(--text-tertiary)] hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all cursor-pointer group"
                            >
                                <div className="p-4 bg-[var(--bg-tertiary)] rounded-full mb-3 group-hover:bg-[var(--bg-card)]">
                                    <Plus weight="light" size={24} />
                                </div>
                                <span className="font-medium">Create new entity</span>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'folders' ? (
                    <>
                        {/* Folders Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-[var(--text-secondary)]">
                                {searchQuery
                                    ? `Showing ${filteredFolders.length} of ${folders.length} folders`
                                    : `Total: ${folders.length} folders`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search folders..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <FolderPlus weight="light" size={14} className="mr-2" />
                                    Create Folder
                                </button>
                            </div>
                        </div>

                        {/* Folders Grid */}
                        {isLoadingFolders ? (
                            <div className="flex items-center justify-center py-12">
                                <SpinnerGap weight="light" className="animate-spin text-[var(--text-tertiary)]" size={24} />
                            </div>
                        ) : filteredFolders.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                {filteredFolders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 hover:border-[var(--border-medium)] hover:shadow-md transition-all cursor-pointer flex flex-col"
                                        onClick={() => setSelectedFolder(folder)}
                                    >
                                        {/* Action buttons */}
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFolder(folder);
                                                }}
                                                className="p-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] rounded-md text-[var(--text-secondary)] transition-colors shadow-sm"
                                                title="Edit folder"
                                            >
                                                <PencilSimple weight="light" size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFolder(folder);
                                                }}
                                                className="p-1.5 bg-[var(--bg-card)] border border-red-200 hover:bg-red-50 rounded-md text-red-600 transition-colors shadow-sm"
                                                title="Delete folder"
                                            >
                                                <Trash weight="light" size={14} />
                                            </button>
                                        </div>

                                        {/* Header with icon and title */}
                                        <div className="flex items-start gap-3 pr-12 mb-3">
                                            <div 
                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all"
                                                style={{ backgroundColor: folder.color || '#3b82f6', opacity: 0.1 }}
                                            >
                                                <Folder 
                                                    weight="light"
                                                    size={20} 
                                                    style={{ color: folder.color || '#3b82f6' }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-normal text-sm text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors leading-tight" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                                    {folder.name}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {folder.description && (
                                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-4 leading-relaxed">
                                                {folder.description}
                                            </p>
                                        )}
                                        
                                        {/* Footer stats */}
                                        <div className="mt-auto pt-3 border-t border-[var(--border-light)] flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                            <div className="flex items-center gap-1.5">
                                                <FileText weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                <span className="font-medium text-[var(--text-secondary)]">{folder.documentIds.length}</span>
                                                <span>document{folder.documentIds.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            {folder.entityIds.length > 0 && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Database weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                        <span className="font-medium text-[var(--text-secondary)]">{folder.entityIds.length}</span>
                                                        <span>entit{folder.entityIds.length !== 1 ? 'ies' : 'y'}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-[var(--bg-card)] rounded-lg border-2 border-dashed border-[var(--border-medium)] p-12 text-center">
                                <Folder weight="light" className="mx-auto text-slate-300 mb-4" size={48} />
                                <h3 className="text-base font-normal text-[var(--text-primary)] mb-2">No folders found</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                    {searchQuery
                                        ? 'Try adjusting your search query'
                                        : 'Create folders to organize your documents and entities'
                                    }
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                                    >
                                        <FolderPlus weight="light" size={16} />
                                        Create Folder
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : activeTab === 'documents' ? (
                    <>
                        {/* Documents Toolbar */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-[var(--text-secondary)]">
                                {searchQuery
                                    ? `Showing ${filteredDocuments.length} of ${documents.length} documents`
                                    : `Total: ${documents.length} documents`
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search documents..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                <button className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                    <Funnel weight="light" size={14} className="mr-2" />
                                    Filter
                                </button>
                                <button
                                    onClick={() => documentFileInputRef.current?.click()}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <UploadSimple weight="light" size={14} className="mr-2" />
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
                                {filteredDocuments.map((doc) => {
                                    const folder = folders.find(f => f.documentIds.includes(doc.id));
                                    return (
                                        <div
                                            key={doc.id}
                                            className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] overflow-hidden transition-all duration-300 ease-out hover:shadow-md hover:border-[var(--border-medium)] hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                            <div className="flex-1">
                                                {/* Header */}
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--bg-hover)] transition-all duration-300">
                                                            <FileText weight="light" size={18} className="text-[var(--text-secondary)]" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-base font-normal text-[var(--text-primary)] transition-colors truncate" style={{ fontFamily: "'Berkeley Mono', monospace" }} title={doc.name}>
                                                                {doc.name}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    {/* Action buttons */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowFolderSelector({ type: 'document', itemId: doc.id });
                                                            }}
                                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                                            title="Add to folder"
                                                        >
                                                            <Folder weight="light" size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyCitation(doc);
                                                            }}
                                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                                            title="Copy citation"
                                                        >
                                                            {copiedDocId === doc.id ? <Check weight="light" size={14} className="text-green-500" /> : <LinkIcon weight="light" size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteDocument(doc.id);
                                                            }}
                                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 active:scale-90"
                                                            title="Delete document"
                                                        >
                                                            <Trash weight="light" size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {doc.summary && (
                                                    <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 leading-relaxed">
                                                        {doc.summary}
                                                    </p>
                                                )}

                                                {/* Metadata */}
                                                <div className="space-y-2 mt-5">
                                                    {folder && (
                                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                            <Folder weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                            <span>{folder.name}</span>
                                                        </div>
                                                    )}
                                                    {doc.fileSize && (
                                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                            <FileText weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                            <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                    )}
                                                    {doc.createdAt && (
                                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                            <Calendar weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                    {doc.tags && doc.tags.length > 0 && (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Tag weight="light" size={12} className="text-[var(--text-tertiary)]" />
                                                            <div className="flex items-center gap-1">
                                                                {doc.tags.slice(0, 2).map((tag: string, idx: number) => (
                                                                    <span key={idx} className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                                {doc.tags.length > 2 && <span className="text-[var(--text-tertiary)]">+{doc.tags.length - 2}</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer with hover action */}
                                            <div className="flex items-center justify-between mt-5">
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                                    <CaretRight weight="light" size={14} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-0.5" />
                                                    <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium text-[var(--text-primary)]">
                                                        {copiedDocId === doc.id ? 'Citation copied!' : 'View document'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText weight="light" size={48} className="text-slate-300 mb-4" />
                                <h3 className="text-lg font-normal text-[var(--text-primary)] mb-2">No documents yet</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-6">Upload your first document to start building your knowledge base</p>
                                <button
                                    onClick={() => documentFileInputRef.current?.click()}
                                    className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <UploadSimple weight="light" size={16} />
                                    Upload Document
                                </button>
                            </div>
                        )}

                        {/* Upload Progress */}
                        {isUploadingDocument && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl p-6 max-w-md">
                                    <div className="flex items-center gap-3 mb-4">
                                        <SpinnerGap weight="light" size={24} className="text-[var(--text-secondary)] animate-spin" />
                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)]">Uploading document</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">Processing and extracting content...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {/* Create/Edit Folder Modal */}
            {(isCreatingFolder || editingFolder) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => { setIsCreatingFolder(false); setEditingFolder(null); }}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                                    <FolderPlus weight="light" size={18} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                        {editingFolder ? 'Edit Folder' : 'Create Folder'}
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Organize your documents and entities</p>
                                </div>
                                <button
                                    onClick={() => { setIsCreatingFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderDescription(''); setNewFolderColor('#3b82f6'); }}
                                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                >
                                    <X weight="light" size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Folder Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editingFolder ? editingFolder.name : newFolderName}
                                    onChange={(e) => editingFolder ? setEditingFolder({...editingFolder, name: e.target.value}) : setNewFolderName(e.target.value)}
                                    placeholder="e.g., Quality Standards, Project Documents"
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={editingFolder ? editingFolder.description || '' : newFolderDescription}
                                    onChange={(e) => editingFolder ? setEditingFolder({...editingFolder, description: e.target.value}) : setNewFolderDescription(e.target.value)}
                                    placeholder="Optional description of what this folder contains"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    Color
                                </label>
                                <div className="flex gap-2">
                                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => editingFolder ? setEditingFolder({...editingFolder, color}) : setNewFolderColor(color)}
                                            className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                                (editingFolder ? editingFolder.color : newFolderColor) === color
                                                    ? 'border-slate-900 scale-110'
                                                    : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'
                                            }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-2 justify-end">
                            <button
                                onClick={() => { setIsCreatingFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderDescription(''); setNewFolderColor('#3b82f6'); }}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => editingFolder ? handleUpdateFolder(editingFolder) : handleCreateFolder()}
                                disabled={!((editingFolder ? editingFolder.name : newFolderName).trim())}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingFolder ? 'Save Changes' : 'Create Folder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Detail Modal */}
            {selectedFolder && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => setSelectedFolder(null)}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-2xl max-h-[80vh] pointer-events-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: selectedFolder.color || '#3b82f6', opacity: 0.1 }}
                                >
                                    <Folder weight="light" size={20} style={{ color: selectedFolder.color || '#3b82f6' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-[var(--text-primary)] truncate" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                        {selectedFolder.name}
                                    </h3>
                                    {selectedFolder.description && (
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedFolder.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopyFolderCitation(selectedFolder)}
                                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                        title="Copy citation"
                                    >
                                        {copiedDocId === selectedFolder.id ? <Check weight="light" size={18} /> : <LinkIcon weight="light" size={18} />}
                                    </button>
                                    <button
                                        onClick={() => setSelectedFolder(null)}
                                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                    >
                                        <X weight="light" size={18} />
                                    </button>
                                </div>
                            </div>
                            {copiedDocId === selectedFolder.id && (
                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                    <Check weight="light" size={12} />
                                    Citation copied! Use @{selectedFolder.name} to reference this folder
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {/* Documents Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-[var(--text-primary)]">Documents ({selectedFolder.documentIds.length})</h4>
                                    <button
                                        onClick={() => {
                                            setShowFolderSelector({ type: 'document', itemId: '' });
                                            setSelectedFolder(null);
                                        }}
                                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                                    >
                                        <Plus weight="light" size={12} />
                                        Add Document
                                    </button>
                                </div>
                                {selectedFolder.documentIds.length > 0 ? (
                                    <div className="space-y-2">
                                        {documents.filter(doc => selectedFolder.documentIds.includes(doc.id)).map((doc) => (
                                            <div key={doc.id} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <FileText weight="light" size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                                                    <span className="text-sm text-[var(--text-primary)] truncate">{doc.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFromFolder(selectedFolder.id, 'document', doc.id)}
                                                    className="p-1 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <X weight="light" size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-[var(--text-secondary)] text-center py-4">No documents in this folder</p>
                                )}
                            </div>

                            {/* Entities Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-[var(--text-primary)]">Entities ({selectedFolder.entityIds.length})</h4>
                                    <button
                                        onClick={() => {
                                            setShowFolderSelector({ type: 'entity', itemId: '' });
                                            setSelectedFolder(null);
                                        }}
                                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                                    >
                                        <Plus weight="light" size={12} />
                                        Add Entity
                                    </button>
                                </div>
                                {selectedFolder.entityIds.length > 0 ? (
                                    <div className="space-y-2">
                                        {entities.filter(entity => selectedFolder.entityIds.includes(entity.id)).map((entity) => (
                                            <div key={entity.id} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Database weight="light" size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                                                    <span className="text-sm text-[var(--text-primary)] truncate">{entity.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFromFolder(selectedFolder.id, 'entity', entity.id)}
                                                    className="p-1 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <X weight="light" size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-[var(--text-secondary)] text-center py-4">No entities in this folder</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Entity Modal */}
            {isCreatingEntity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCreatingEntity(false)}>
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6 py-5 shrink-0 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-normal text-[var(--text-primary)]">Create Entity</h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">Define a new entity for your database</p>
                            </div>
                            <button
                                onClick={() => setIsCreatingEntity(false)}
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <X weight="light" size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                                <button
                                    onClick={() => setUploadMode('manual')}
                                    className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                                        uploadMode === 'manual'
                                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-slate-800'
                                    }`}
                                >
                                    Manual
                                </button>
                                <button
                                    onClick={() => setUploadMode('file')}
                                    className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                                        uploadMode === 'file'
                                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-slate-800'
                                    }`}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <UploadSimple weight="light" size={14} />
                                        Upload File
                                    </span>
                                </button>
                            </div>

                            {uploadMode === 'manual' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Entity Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newEntityName}
                                            onChange={(e) => setNewEntityName(e.target.value)}
                                            placeholder="e.g., Customers, Products, Orders"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            value={newEntityDescription}
                                            onChange={(e) => setNewEntityDescription(e.target.value)}
                                            placeholder="Optional description of what this entity represents"
                                            rows={3}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] resize-none"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Entity Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newEntityName}
                                            onChange={(e) => setNewEntityName(e.target.value)}
                                            placeholder="Will use filename if empty"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Leave empty to use the filename as entity name</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Upload Excel or CSV File
                                        </label>
                                        <div className="border-2 border-dashed border-[var(--border-medium)] rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
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
                                                        <SpinnerGap weight="light" size={32} className="text-[var(--text-tertiary)] mb-2 animate-spin" />
                                                        <span className="text-sm text-[var(--text-secondary)]">Processing file...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center mb-3">
                                                            <Table weight="light" size={24} className="text-[var(--text-secondary)]" />
                                                        </div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] mb-1">Click to upload or drag and drop</span>
                                                        <span className="text-xs text-[var(--text-secondary)]">CSV, XLSX, or XLS (max 50MB)</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] mt-2">
                                            The entity will be created with properties based on the columns in your file. Data will be imported automatically.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-[var(--border-light)] px-6 py-4 shrink-0 flex items-center justify-end gap-3">
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
                                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            {uploadMode === 'manual' && (
                                <button
                                    onClick={handleCreateEntity}
                                    disabled={!newEntityName.trim()}
                                    className="px-4 py-2 bg-[var(--bg-selected)] text-white rounded-lg text-sm font-medium hover:bg-[#555555] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Create Entity
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Selector Modal */}
            {showFolderSelector && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => setShowFolderSelector(null)}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                                    <Folder weight="light" size={18} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                        {showFolderSelector.itemId ? 'Select Folder' : 'Add to Folder'}
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                        {showFolderSelector.itemId 
                                            ? `Choose a folder to add this ${showFolderSelector.type === 'document' ? 'document' : 'entity'} to`
                                            : `Select a ${showFolderSelector.type === 'document' ? 'document' : 'entity'} to add to a folder`
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowFolderSelector(null)}
                                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                >
                                    <X weight="light" size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
                            {showFolderSelector.itemId ? (
                                // Show folders to select
                                folders.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Folder weight="light" className="mx-auto text-slate-300 mb-3" size={32} />
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">No folders yet</p>
                                        <p className="text-xs text-[var(--text-secondary)] mb-4">Create a folder first to organize your items</p>
                                        <button
                                            onClick={() => {
                                                setShowFolderSelector(null);
                                                setIsCreatingFolder(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md mx-auto"
                                        >
                                            <FolderPlus weight="light" size={14} />
                                            Create Folder
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {folders.map((folder) => {
                                            const isInFolder = showFolderSelector.type === 'document'
                                                ? folder.documentIds.includes(showFolderSelector.itemId)
                                                : folder.entityIds.includes(showFolderSelector.itemId);
                                            
                                            return (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => {
                                                        if (isInFolder) {
                                                            handleRemoveFromFolder(folder.id, showFolderSelector.type, showFolderSelector.itemId);
                                                        } else {
                                                            handleAddToFolder(folder.id, showFolderSelector.type, showFolderSelector.itemId);
                                                        }
                                                        setShowFolderSelector(null);
                                                    }}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                                        isInFolder
                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)]'
                                                            : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                    }`}
                                                >
                                                    <div 
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: folder.color || '#3b82f6', opacity: 0.1 }}
                                                    >
                                                        <Folder 
                                                            weight="light"
                                                            size={16} 
                                                            style={{ color: folder.color || '#3b82f6' }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                                                                {folder.name}
                                                            </span>
                                                            {isInFolder && (
                                                                <Check weight="light" size={14} className="text-green-600 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        {folder.description && (
                                                            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                                                {folder.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                                                        {showFolderSelector.type === 'document' 
                                                            ? `${folder.documentIds.length} docs`
                                                            : `${folder.entityIds.length} entities`
                                                        }
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                                // Show items to select (when adding to folder from folder detail)
                                <div className="space-y-2">
                                    {showFolderSelector.type === 'document' ? (
                                        documents.map((doc) => {
                                            const isInFolder = selectedFolder?.documentIds.includes(doc.id) || false;
                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => {
                                                        if (selectedFolder) {
                                                            if (isInFolder) {
                                                                handleRemoveFromFolder(selectedFolder.id, 'document', doc.id);
                                                            } else {
                                                                handleAddToFolder(selectedFolder.id, 'document', doc.id);
                                                            }
                                                        }
                                                        setShowFolderSelector(null);
                                                    }}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                                        isInFolder
                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)]'
                                                            : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                    }`}
                                                >
                                                    <FileText weight="light" size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                                                    <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
                                                        {doc.name}
                                                    </span>
                                                    {isInFolder && <Check weight="light" size={14} className="text-green-600 flex-shrink-0" />}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        entities.map((entity) => {
                                            const isInFolder = selectedFolder?.entityIds.includes(entity.id) || false;
                                            return (
                                                <button
                                                    key={entity.id}
                                                    onClick={() => {
                                                        if (selectedFolder) {
                                                            if (isInFolder) {
                                                                handleRemoveFromFolder(selectedFolder.id, 'entity', entity.id);
                                                            } else {
                                                                handleAddToFolder(selectedFolder.id, 'entity', entity.id);
                                                            }
                                                        }
                                                        setShowFolderSelector(null);
                                                    }}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                                        isInFolder
                                                            ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)]'
                                                            : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                    }`}
                                                >
                                                    <Database weight="light" size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                                                    <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
                                                        {entity.name}
                                                    </span>
                                                    {isInFolder && <Check weight="light" size={14} className="text-green-600 flex-shrink-0" />}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-2 justify-end">
                            <button
                                onClick={() => setShowFolderSelector(null)}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                            {!showFolderSelector.itemId && folders.length === 0 && (
                                <button
                                    onClick={() => {
                                        setShowFolderSelector(null);
                                        setIsCreatingFolder(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <FolderPlus weight="light" size={14} />
                                    Create Folder
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Toast Notifications */}
            <ToastContainer notifications={notifications} onDismiss={removeNotification} position="bottom-right" />
        </div>
    );
};
