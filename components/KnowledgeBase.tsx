import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Database, Plus, MagnifyingGlass, Funnel, X, FileText, Folder, FolderPlus, 
    UploadSimple, Table, SpinnerGap, File, DownloadSimple, Trash, Eye, 
    Link as LinkIcon, Copy, Check, PencilSimple, Calendar, Tag, CaretRight,
    FolderOpen, House, GridFour, List, SortAscending, DotsThree
} from '@phosphor-icons/react';
import { Entity } from '../types';
import { EntityCard } from './EntityCard';
import { PageHeader } from './PageHeader';
import { Breadcrumbs, BreadcrumbItem, FolderTree, FolderNode } from './ui';
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
    parentId?: string | null;
    documentIds: string[];
    entityIds: string[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

interface Document {
    id: string;
    name: string;
    type: string;
    size: number;
    summary?: string;
    tags?: string[];
    createdAt: string;
    folderId?: string;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'type';

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate }) => {
    const navigate = useNavigate();
    const { notifications, removeNotification, success, error: showError, warning } = useNotifications(3000);
    const location = useLocation();
    const { user } = useAuth();
    
    // Navigation state
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    
    // Data state
    const [folders, setFolders] = useState<Folder[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    
    // Modal states
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderDescription, setNewFolderDescription] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    
    // Upload state
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadMode, setUploadMode] = useState<'manual' | 'file'>('manual');
    const documentFileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    // Drag state
    const [draggedItem, setDraggedItem] = useState<{ type: 'entity' | 'document' | 'folder'; id: string } | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // Load data on mount
    useEffect(() => {
        fetchFolders();
        fetchDocuments();
    }, []);

    // API calls
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

    // Build breadcrumb path
    const breadcrumbPath = useMemo((): BreadcrumbItem[] => {
        if (!currentFolderId) return [];
        
        const path: BreadcrumbItem[] = [];
        let folder = folders.find(f => f.id === currentFolderId);
        
        while (folder) {
            path.unshift({
                id: folder.id,
                label: folder.name,
                icon: <Folder size={14} weight="light" style={{ color: folder.color }} />
            });
            folder = folder.parentId ? folders.find(f => f.id === folder!.parentId) : undefined;
        }
        
        return path;
    }, [currentFolderId, folders]);

    // Get current folder
    const currentFolder = useMemo(() => {
        return currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
    }, [currentFolderId, folders]);

    // Get items in current folder
    const currentFolderItems = useMemo(() => {
        // Subfolders
        const subfolders = folders.filter(f => {
            if (currentFolderId) {
                return f.parentId === currentFolderId;
            }
            return !f.parentId;
        });

        // Entities in folder
        let folderEntities: Entity[] = [];
        if (currentFolder) {
            folderEntities = entities.filter(e => currentFolder.entityIds.includes(e.id));
        } else {
            // Root: show entities not in any folder
            const allEntityIdsInFolders = new Set(folders.flatMap(f => f.entityIds));
            folderEntities = entities.filter(e => !allEntityIdsInFolders.has(e.id));
        }

        // Documents in folder
        let folderDocuments: Document[] = [];
        if (currentFolder) {
            folderDocuments = documents.filter(d => currentFolder.documentIds.includes(d.id));
        } else {
            // Root: show documents not in any folder
            const allDocIdsInFolders = new Set(folders.flatMap(f => f.documentIds));
            folderDocuments = documents.filter(d => !allDocIdsInFolders.has(d.id));
        }

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return {
                subfolders: subfolders.filter(f => 
                    f.name.toLowerCase().includes(query) || 
                    f.description?.toLowerCase().includes(query)
                ),
                entities: folderEntities.filter(e => 
                    e.name.toLowerCase().includes(query) || 
                    e.description?.toLowerCase().includes(query)
                ),
                documents: folderDocuments.filter(d => 
                    d.name.toLowerCase().includes(query) || 
                    d.summary?.toLowerCase().includes(query)
                )
            };
        }

        return { subfolders, entities: folderEntities, documents: folderDocuments };
    }, [currentFolderId, currentFolder, folders, entities, documents, searchQuery]);

    // Folder tree data
    const folderTreeData = useMemo((): FolderNode[] => {
        return folders.map(f => ({
            id: f.id,
            name: f.name,
            color: f.color,
            parentId: f.parentId,
            documentCount: f.documentIds.length,
            entityCount: f.entityIds.length
        }));
    }, [folders]);

    // Handlers
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        const newFolder = {
            name: newFolderName.trim(),
            description: newFolderDescription.trim() || undefined,
            color: newFolderColor,
            parentId: parentFolderForNew,
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
                setParentFolderForNew(null);
                await fetchFolders();
                success('Folder created');
            } else {
                showError('Failed to create folder');
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            showError('Failed to create folder');
        }
    };

    const handleDeleteFolder = async (folder: Folder) => {
        if (!confirm(`Delete "${folder.name}"? Contents will be moved to parent folder.`)) return;

        try {
            const res = await fetch(`${API_BASE}/knowledge/folders/${folder.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                if (currentFolderId === folder.id) {
                    setCurrentFolderId(folder.parentId || null);
                }
                await fetchFolders();
                success('Folder deleted');
            } else {
                showError('Failed to delete folder');
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            showError('Failed to delete folder');
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
                    color: folder.color,
                    parentId: folder.parentId
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

    const handleMoveToFolder = async (itemType: 'entity' | 'document', itemId: string, targetFolderId: string | null) => {
        // Find current folder containing item
        const currentFolder = folders.find(f => 
            itemType === 'entity' ? f.entityIds.includes(itemId) : f.documentIds.includes(itemId)
        );

        try {
            // Remove from current folder if exists
            if (currentFolder) {
                await fetch(`${API_BASE}/knowledge/folders/${currentFolder.id}/remove`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: itemType, itemId }),
                    credentials: 'include'
                });
            }

            // Add to target folder if not root
            if (targetFolderId) {
                await fetch(`${API_BASE}/knowledge/folders/${targetFolderId}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: itemType, itemId }),
                    credentials: 'include'
                });
            }

            await fetchFolders();
            success('Item moved');
        } catch (error) {
            console.error('Error moving item:', error);
            showError('Failed to move item');
        }
    };

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
            const res = await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntity),
                credentials: 'include'
            });

            if (res.ok) {
                // If in a folder, add entity to it
                if (currentFolderId) {
                    const data = await res.json();
                    await handleMoveToFolder('entity', data.id || newEntity.id, currentFolderId);
                }
                
                setNewEntityName('');
                setNewEntityDescription('');
                setIsCreatingEntity(false);
                window.location.reload();
            }
        } catch (error) {
            console.error('Error creating entity:', error);
            showError('Failed to create entity');
        }
    };

    const handleDeleteEntity = async (entity: Entity) => {
        if (!confirm(`Delete "${entity.name}"? This will also delete all its records.`)) return;

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

    const handleUploadDocument = async (file: File) => {
        if (!file) return;

        setIsUploadingDocument(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (currentFolderId) {
                formData.append('folderId', currentFolderId);
            }

            const res = await fetch(`${API_BASE}/knowledge/documents`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) {
                await fetchDocuments();
                await fetchFolders();
                if (documentFileInputRef.current) {
                    documentFileInputRef.current.value = '';
                }
                success('Document uploaded');
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
        if (!confirm('Delete this document?')) return;

        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${docId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                await fetchDocuments();
                success('Document deleted');
            } else {
                showError('Failed to delete document');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            showError('Failed to delete document');
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            warning('Invalid file type', 'Please upload a CSV or Excel file');
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
                setNewEntityName('');
                setIsCreatingEntity(false);
                window.location.reload();
            } else {
                const errorData = await res.json();
                showError('Failed to create entity', errorData.error);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showError('Failed to upload file');
        } finally {
            setIsUploadingFile(false);
        }
    };

    // Drag handlers
    const handleDragStart = (type: 'entity' | 'document' | 'folder', id: string) => {
        setDraggedItem({ type, id });
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        setDragOverFolderId(folderId);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        setDragOverFolderId(null);
        
        if (!draggedItem) return;
        
        if (draggedItem.type === 'folder') {
            // Move folder to new parent
            const folder = folders.find(f => f.id === draggedItem.id);
            if (folder && folder.id !== targetFolderId) {
                await handleUpdateFolder({ ...folder, parentId: targetFolderId });
            }
        } else {
            await handleMoveToFolder(draggedItem.type, draggedItem.id, targetFolderId);
        }
        
        setDraggedItem(null);
    };

    const openCreateFolderModal = (parentId: string | null = null) => {
        setParentFolderForNew(parentId);
        setIsCreatingFolder(true);
    };

    const totalItems = currentFolderItems.subfolders.length + 
                       currentFolderItems.entities.length + 
                       currentFolderItems.documents.length;

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-tutorial="database-content">
            <ToastContainer notifications={notifications} onDismiss={removeNotification} />
            
            {/* Header */}
            <div className="px-8 pt-6 pb-4 bg-[var(--bg-primary)] border-b border-[var(--border-light)]">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Knowledge Base
                        </h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            Organize your entities, documents and data
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCreatingEntity(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-xs font-medium text-[var(--text-primary)] transition-colors"
                            title={currentFolder ? `Create entity in "${currentFolder.name}"` : 'Create new entity'}
                        >
                            <Database size={14} weight="light" />
                            New Entity
                        </button>
                        <button
                            onClick={() => documentFileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-xs font-medium text-[var(--text-primary)] transition-colors"
                            title={currentFolder ? `Upload document to "${currentFolder.name}"` : 'Upload document'}
                        >
                            <UploadSimple size={14} weight="light" />
                            Upload
                        </button>
                        <button
                            onClick={() => openCreateFolderModal(currentFolderId)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-colors"
                            title={currentFolder ? `Create subfolder in "${currentFolder.name}"` : 'Create new folder'}
                        >
                            <FolderPlus size={14} weight="light" />
                            New Folder
                        </button>
                    </div>
                </div>
                
                {/* Breadcrumbs */}
                <Breadcrumbs
                    items={breadcrumbPath}
                    onNavigate={setCurrentFolderId}
                />
            </div>

            {/* Main content with sidebar */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Folder Tree */}
                <div className="w-64 border-r border-[var(--border-light)] bg-[var(--bg-secondary)] p-4 overflow-y-auto custom-scrollbar">
                    <FolderTree
                        folders={folderTreeData}
                        currentFolderId={currentFolderId}
                        onSelectFolder={setCurrentFolderId}
                        onCreateFolder={openCreateFolderModal}
                    />
                </div>

                {/* Main content area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-light)] bg-[var(--bg-primary)]">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-[var(--text-secondary)]">
                                {searchQuery ? `Found ${totalItems} items` : `${totalItems} items`}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] w-48 placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>
                            
                            {/* View toggle */}
                            <div className="flex items-center border border-[var(--border-light)] rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[var(--bg-selected)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                >
                                    <GridFour size={16} weight="light" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[var(--bg-selected)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                >
                                    <List size={16} weight="light" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div 
                        className="flex-1 overflow-y-auto p-6 custom-scrollbar"
                        onDragOver={(e) => handleDragOver(e, currentFolderId)}
                        onDrop={(e) => handleDrop(e, currentFolderId)}
                    >
                        {isLoadingFolders || isLoadingDocuments ? (
                            <div className="flex items-center justify-center py-12">
                                <SpinnerGap weight="light" className="animate-spin text-[var(--text-tertiary)]" size={24} />
                            </div>
                        ) : totalItems === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                                    {currentFolderId ? (
                                        <FolderOpen size={32} weight="light" className="text-[var(--text-tertiary)]" />
                                    ) : (
                                        <Database size={32} weight="light" className="text-[var(--text-tertiary)]" />
                                    )}
                                </div>
                                <h3 className="text-base font-normal text-[var(--text-primary)] mb-2">
                                    {searchQuery ? 'No results found' : 'This folder is empty'}
                                </h3>
                                <p className="text-sm text-[var(--text-secondary)] max-w-md mb-4">
                                    {searchQuery 
                                        ? 'Try adjusting your search query'
                                        : 'Create entities, upload documents, or add folders to get started'
                                    }
                                </p>
                                {!searchQuery && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsCreatingEntity(true)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <Database size={14} weight="light" />
                                            New Entity
                                        </button>
                                        <button
                                            onClick={() => openCreateFolderModal(currentFolderId)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <FolderPlus size={14} weight="light" />
                                            New Folder
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="space-y-8">
                                {/* Subfolders */}
                                {currentFolderItems.subfolders.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Folder size={12} weight="light" />
                                            Folders ({currentFolderItems.subfolders.length})
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                            {currentFolderItems.subfolders.map((folder) => (
                                                <div
                                                    key={folder.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart('folder', folder.id)}
                                                    onDragOver={(e) => handleDragOver(e, folder.id)}
                                                    onDrop={(e) => handleDrop(e, folder.id)}
                                                    onClick={() => setCurrentFolderId(folder.id)}
                                                    className={`
                                                        group relative bg-[var(--bg-card)] border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md
                                                        ${dragOverFolderId === folder.id 
                                                            ? 'border-[var(--bg-selected)] bg-[var(--bg-hover)] scale-105' 
                                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'
                                                        }
                                                    `}
                                                >
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openCreateFolderModal(folder.id); }}
                                                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]"
                                                            title="Create subfolder"
                                                        >
                                                            <FolderPlus size={12} weight="light" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); }}
                                                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]"
                                                            title="Edit folder"
                                                        >
                                                            <PencilSimple size={12} weight="light" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                                                            className="p-1 hover:bg-red-50 rounded text-red-500"
                                                            title="Delete folder"
                                                        >
                                                            <Trash size={12} weight="light" />
                                                        </button>
                                                    </div>
                                                    <div 
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                                                        style={{ backgroundColor: `${folder.color}15` }}
                                                    >
                                                        <Folder size={20} weight="light" style={{ color: folder.color }} />
                                                    </div>
                                                    <h4 className="text-sm font-medium text-[var(--text-primary)] truncate mb-1">{folder.name}</h4>
                                                    <p className="text-xs text-[var(--text-tertiary)]">
                                                        {folder.entityIds.length + folder.documentIds.length} items
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Entities */}
                                {currentFolderItems.entities.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Database size={12} weight="light" />
                                            Entities ({currentFolderItems.entities.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {currentFolderItems.entities.map((entity) => (
                                                <div
                                                    key={entity.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart('entity', entity.id)}
                                                >
                                                    <EntityCard
                                                        entity={entity}
                                                        onClick={(e) => onNavigate(e.id)}
                                                        onDelete={handleDeleteEntity}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Documents */}
                                {currentFolderItems.documents.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <FileText size={12} weight="light" />
                                            Documents ({currentFolderItems.documents.length})
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                            {currentFolderItems.documents.map((doc) => (
                                                <div
                                                    key={doc.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart('document', doc.id)}
                                                    className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 hover:border-[var(--border-medium)] hover:shadow-md transition-all cursor-pointer"
                                                >
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                                                            className="p-1 hover:bg-red-50 rounded text-red-500"
                                                        >
                                                            <Trash size={12} weight="light" />
                                                        </button>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                                                        <FileText size={20} weight="light" className="text-blue-500" />
                                                    </div>
                                                    <h4 className="text-sm font-medium text-[var(--text-primary)] truncate mb-1">{doc.name}</h4>
                                                    <p className="text-xs text-[var(--text-tertiary)]">{doc.type}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* List view */
                            <div className="space-y-1">
                                {/* Subfolders */}
                                {currentFolderItems.subfolders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        draggable
                                        onDragStart={() => handleDragStart('folder', folder.id)}
                                        onDragOver={(e) => handleDragOver(e, folder.id)}
                                        onDrop={(e) => handleDrop(e, folder.id)}
                                        onClick={() => setCurrentFolderId(folder.id)}
                                        className={`
                                            group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all
                                            ${dragOverFolderId === folder.id 
                                                ? 'bg-[var(--bg-hover)] border border-[var(--bg-selected)]' 
                                                : 'hover:bg-[var(--bg-hover)]'
                                            }
                                        `}
                                    >
                                        <Folder size={20} weight="light" style={{ color: folder.color }} />
                                        <span className="flex-1 text-sm text-[var(--text-primary)]">{folder.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">{folder.entityIds.length + folder.documentIds.length} items</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); openCreateFolderModal(folder.id); }} className="p-1 hover:bg-[var(--bg-tertiary)] rounded" title="Create subfolder">
                                                <FolderPlus size={14} weight="light" className="text-[var(--text-secondary)]" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); }} className="p-1 hover:bg-[var(--bg-tertiary)] rounded" title="Edit folder">
                                                <PencilSimple size={14} weight="light" className="text-[var(--text-secondary)]" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1 hover:bg-red-50 rounded" title="Delete folder">
                                                <Trash size={14} weight="light" className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Entities */}
                                {currentFolderItems.entities.map((entity) => (
                                    <div
                                        key={entity.id}
                                        draggable
                                        onDragStart={() => handleDragStart('entity', entity.id)}
                                        onClick={() => onNavigate(entity.id)}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
                                    >
                                        <Database size={20} weight="light" className="text-emerald-500" />
                                        <span className="flex-1 text-sm text-[var(--text-primary)]">{entity.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">{entity.properties?.length || 0} properties</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteEntity(entity); }} className="p-1 hover:bg-red-50 rounded">
                                                <Trash size={14} weight="light" className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Documents */}
                                {currentFolderItems.documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        draggable
                                        onDragStart={() => handleDragStart('document', doc.id)}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
                                    >
                                        <FileText size={20} weight="light" className="text-blue-500" />
                                        <span className="flex-1 text-sm text-[var(--text-primary)]">{doc.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">{doc.type}</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="p-1 hover:bg-red-50 rounded">
                                                <Trash size={14} weight="light" className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file inputs */}
            <input
                ref={documentFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadDocument(e.target.files[0])}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />

            {/* Create Folder Modal */}
            {isCreatingFolder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Create Folder</h2>
                            <button onClick={() => { setIsCreatingFolder(false); setParentFolderForNew(null); }} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        
                        {parentFolderForNew && (
                            <div className="mb-4 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)]">
                                Creating inside: <span className="font-medium text-[var(--text-primary)]">{folders.find(f => f.id === parentFolderForNew)?.name}</span>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Folder name"
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description (optional)</label>
                                <input
                                    type="text"
                                    value={newFolderDescription}
                                    onChange={(e) => setNewFolderDescription(e.target.value)}
                                    placeholder="Brief description"
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Color</label>
                                <div className="flex gap-2">
                                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setNewFolderColor(color)}
                                            className={`w-8 h-8 rounded-full transition-transform ${newFolderColor === color ? 'scale-110 ring-2 ring-offset-2 ring-[var(--border-medium)]' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => { setIsCreatingFolder(false); setParentFolderForNew(null); }}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                className="px-4 py-2 text-sm bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Entity Modal */}
            {isCreatingEntity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Create Entity</h2>
                            <button onClick={() => setIsCreatingEntity(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        
                        {currentFolderId && (
                            <div className="mb-4 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)] flex items-center gap-2">
                                <Folder size={14} weight="light" style={{ color: currentFolder?.color }} />
                                Creating in: <span className="font-medium text-[var(--text-primary)]">{currentFolder?.name}</span>
                            </div>
                        )}
                        
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setUploadMode('manual')}
                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${uploadMode === 'manual' ? 'bg-[var(--bg-selected)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
                            >
                                Manual
                            </button>
                            <button
                                onClick={() => setUploadMode('file')}
                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${uploadMode === 'file' ? 'bg-[var(--bg-selected)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
                            >
                                From File
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={newEntityName}
                                    onChange={(e) => setNewEntityName(e.target.value)}
                                    placeholder="Entity name"
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                    autoFocus
                                />
                            </div>
                            
                            {uploadMode === 'manual' ? (
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                                    <textarea
                                        value={newEntityDescription}
                                        onChange={(e) => setNewEntityDescription(e.target.value)}
                                        placeholder="Brief description"
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] resize-none"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Upload File</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-[var(--border-light)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--border-medium)] transition-colors"
                                    >
                                        <UploadSimple size={32} weight="light" className="mx-auto text-[var(--text-tertiary)] mb-2" />
                                        <p className="text-sm text-[var(--text-secondary)]">Click to upload CSV or Excel</p>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">.csv, .xlsx, .xls</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsCreatingEntity(false)}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEntity}
                                disabled={!newEntityName.trim() || isUploadingFile}
                                className="px-4 py-2 text-sm bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploadingFile ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Folder Modal */}
            {editingFolder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Edit Folder</h2>
                            <button onClick={() => setEditingFolder(null)} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={editingFolder.name}
                                    onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                                <input
                                    type="text"
                                    value={editingFolder.description || ''}
                                    onChange={(e) => setEditingFolder({ ...editingFolder, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Color</label>
                                <div className="flex gap-2">
                                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setEditingFolder({ ...editingFolder, color })}
                                            className={`w-8 h-8 rounded-full transition-transform ${editingFolder.color === color ? 'scale-110 ring-2 ring-offset-2 ring-[var(--border-medium)]' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setEditingFolder(null)}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUpdateFolder(editingFolder)}
                                className="px-4 py-2 text-sm bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
