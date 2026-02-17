import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Database, Plus, MagnifyingGlass, Funnel, X, FileText, Folder, FolderPlus, 
    UploadSimple, Table, SpinnerGap, File, DownloadSimple, Trash, Eye, 
    Link as LinkIcon, Copy, Check, CheckSquare, PencilSimple, Calendar, Tag, CaretRight,
    FolderOpen, House, GridFour, List, SortAscending, DotsThree, TreeStructure,
    Factory, Gear, Thermometer, Flask, Lightning, ShieldCheck, Sparkle
} from '@phosphor-icons/react';
import { Entity, EntityType, ENTITY_TYPE_OPTIONS } from '../types';
import { EntityCard } from './EntityCard';
import { PageHeader } from './PageHeader';
import { Breadcrumbs, BreadcrumbItem, FolderTree, FolderNode } from './ui';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { ToastContainer } from './ui/Toast';
import { KnowledgeGraph } from './KnowledgeGraph';

interface KnowledgeBaseProps {
    entities: Entity[];
    onNavigate: (entityId: string) => void;
    onEntityCreated?: () => void;
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

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate, onEntityCreated }) => {
    const navigate = useNavigate();
    const { notifications, removeNotification, success, error: showError, warning } = useNotifications(3000);
    const location = useLocation();
    const { user } = useAuth();
    
    // Navigation state
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
    
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
    const [newEntityType, setNewEntityType] = useState<EntityType>('generic');
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    
    // Upload state
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadMode, setUploadMode] = useState<'manual' | 'file'>('manual');
    const documentFileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
    const [documentForTableView, setDocumentForTableView] = useState<{ id: string; name: string } | null>(null);
    const [documentPreviewText, setDocumentPreviewText] = useState<string | null>(null);
    const [tableRows, setTableRows] = useState<Record<string, string | number>[]>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [creatingEntityFromTable, setCreatingEntityFromTable] = useState(false);
    const [tableAssistantInstruction, setTableAssistantInstruction] = useState('');
    const [tableAssistantLoading, setTableAssistantLoading] = useState(false);
    
    // Import preview state
    const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing'>('upload');
    const [importPreviewData, setImportPreviewData] = useState<Record<string, string>[]>([]);
    const [importColumns, setImportColumns] = useState<{
        name: string;
        detectedType: 'text' | 'number' | 'json';
        include: boolean;
    }[]>([]);
    const [importFileName, setImportFileName] = useState('');
    
    // Drag state
    const [draggedItem, setDraggedItem] = useState<{ type: 'entity' | 'document' | 'folder'; id: string } | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // Bulk selection (entities only)
    const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    // Load data on mount and restore folder navigation
    useEffect(() => {
        fetchFolders();
        fetchDocuments();
        
        // Restore folder navigation after reload
        const savedFolder = sessionStorage.getItem('kb_currentFolder');
        if (savedFolder) {
            setCurrentFolderId(savedFolder);
            sessionStorage.removeItem('kb_currentFolder');
        }
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
        if (!confirm(`¿Estás seguro de que quieres borrar la carpeta «${folder.name}»? El contenido se moverá a la carpeta superior.`)) return;

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
            entityType: newEntityType,
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
                setNewEntityType('generic');
                setIsCreatingEntity(false);
                
                // Save current folder and reload
                if (currentFolderId) {
                    sessionStorage.setItem('kb_currentFolder', currentFolderId);
                }
                window.location.reload();
            }
        } catch (error) {
            console.error('Error creating entity:', error);
            showError('Failed to create entity');
        }
    };

    const handleDeleteEntity = async (entity: Entity) => {
        if (!confirm(`¿Estás seguro de que quieres borrar la entidad «${entity.name}»? Se eliminarán también todos sus registros.`)) return;

        try {
            await fetch(`${API_BASE}/entities/${entity.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            // Save current folder and reload
            if (currentFolderId) {
                sessionStorage.setItem('kb_currentFolder', currentFolderId);
            }
            window.location.reload();
        } catch (error) {
            console.error('Error deleting entity:', error);
            showError('Failed to delete entity');
        }
    };

    const toggleEntitySelection = (entityId: string) => {
        setSelectedEntityIds(prev => {
            const next = new Set(prev);
            if (next.has(entityId)) next.delete(entityId);
            else next.add(entityId);
            return next;
        });
    };

    const selectAllEntitiesInView = () => {
        const ids = currentFolderItems.entities.map(e => e.id);
        setSelectedEntityIds(prev => {
            const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
            return allSelected ? new Set() : new Set(ids);
        });
    };

    const clearEntitySelection = () => setSelectedEntityIds(new Set());

    const handleBulkMove = async (targetFolderId: string | null) => {
        const ids = Array.from(selectedEntityIds);
        if (ids.length === 0) return;
        setBulkActionLoading(true);
        try {
            for (const entityId of ids) {
                const currentFolder = folders.find(f => f.entityIds.includes(entityId));
                if (currentFolder) {
                    await fetch(`${API_BASE}/knowledge/folders/${currentFolder.id}/remove`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'entity', itemId: entityId }),
                        credentials: 'include'
                    });
                }
                if (targetFolderId) {
                    await fetch(`${API_BASE}/knowledge/folders/${targetFolderId}/add`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'entity', itemId: entityId }),
                        credentials: 'include'
                    });
                }
            }
            await fetchFolders();
            clearEntitySelection();
            setShowMoveModal(false);
            success(`${ids.length} entidad(es) movida(s)`);
        } catch {
            showError('Error al mover');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedEntityIds);
        if (ids.length === 0) return;
        if (!confirm(`¿Estás seguro de que quieres borrar ${ids.length} entidad(es)? Se eliminarán también todos sus registros. Esta acción no se puede deshacer.`)) return;
        setBulkActionLoading(true);
        try {
            for (const entityId of ids) {
                await fetch(`${API_BASE}/entities/${entityId}`, { method: 'DELETE', credentials: 'include' });
            }
            if (currentFolderId) sessionStorage.setItem('kb_currentFolder', currentFolderId);
            clearEntitySelection();
            success(`${ids.length} entidad(es) eliminada(s)`);
            window.location.reload();
        } catch {
            showError('Error al borrar');
        } finally {
            setBulkActionLoading(false);
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
        if (!confirm('¿Estás seguro de que quieres borrar este documento?')) return;

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

    const handleExtractDocumentStructure = async (doc: Document) => {
        if (!doc?.id || extractingDocId) return;
        setExtractingDocId(doc.id);
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${doc.id}/extract-structured`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ mode: 'auto' })
            });

            const contentType = res.headers.get('content-type') || '';
            const raw = await res.text();
            const data = contentType.includes('application/json') && raw ? JSON.parse(raw) : {};

            if (!res.ok) {
                throw new Error(data?.error || 'Failed to extract structured data');
            }

            const extractedItems =
                data?.structuredExtraction?.stats?.extractedItems ??
                (Array.isArray(data?.structuredExtraction?.extractions)
                    ? data.structuredExtraction.extractions.length
                    : 0);
            const provider = data?.structuredExtraction?.provider || 'unknown';
            success(
                data?.reused
                    ? `Structured extraction already available (${provider})`
                    : `Structured extraction completed: ${extractedItems} items (${provider})`
            );
        } catch (error: any) {
            console.error('Error extracting structured document data:', error);
            showError('Failed to extract structured data', error?.message);
        } finally {
            setExtractingDocId(null);
        }
    };

    // Convert document extractions (LangExtract) to table rows for "View as table"
    const handleViewAsTable = async (doc: Document) => {
        if (!doc?.id) return;
        setTableLoading(true);
        setDocumentForTableView({ id: doc.id, name: doc.name });
        setTableRows([]);
        setDocumentPreviewText(null);
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${doc.id}`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to load document');
            const rawText = typeof data.extractedText === 'string' ? data.extractedText.trim() : '';
            setDocumentPreviewText(rawText || null);
            const meta = data.metadata || {};
            const extraction = meta.structuredExtraction;
            const extractions = Array.isArray(extraction?.extractions) ? extraction.extractions : Array.isArray(extraction?.extractedParameters) ? extraction.extractedParameters : [];
            if (extractions.length === 0) {
                setTableRows([]);
                setTableLoading(false);
                return;
            }
            const rows: Record<string, string | number>[] = extractions.map((item: { extraction_class?: string; extraction_text?: string; attributes?: Record<string, unknown> }) => {
                const row: Record<string, string | number> = {
                    type: item.extraction_class ?? '',
                    text: item.extraction_text ?? '',
                };
                const attrs = item.attributes || {};
                Object.keys(attrs).forEach((k) => {
                    const v = attrs[k];
                    row[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
                });
                return row;
            });
            setTableRows(rows);
        } catch (e: any) {
            showError('Failed to load document for table', e?.message);
            setDocumentForTableView(null);
        } finally {
            setTableLoading(false);
        }
    };

    const handleCloseTableView = () => {
        setDocumentForTableView(null);
        setDocumentPreviewText(null);
        setTableRows([]);
    };

    // Run extraction from inside the table modal when there's no structured data yet
    const handleExtractFromTableModal = async () => {
        if (!documentForTableView?.id) return;
        setTableLoading(true);
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${documentForTableView.id}/extract-structured`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ mode: 'auto' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Extraction failed');
            const raw = data?.structuredExtraction;
            const extractions = Array.isArray(raw?.extractions) ? raw.extractions : Array.isArray(raw?.extractedParameters) ? raw.extractedParameters : [];
            const rows: Record<string, string | number>[] = extractions.map((item: { extraction_class?: string; extraction_text?: string; attributes?: Record<string, unknown> }) => {
                const row: Record<string, string | number> = {
                    type: item.extraction_class ?? '',
                    text: item.extraction_text ?? '',
                };
                const attrs = item.attributes || {};
                Object.keys(attrs).forEach((k) => {
                    const v = attrs[k];
                    row[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
                });
                return row;
            });
            setTableRows(rows);
            if (extractions.length) {
                success(`Extracted ${extractions.length} items`);
            } else {
                success('Extraction ran but found 0 items. Try a document with parameters, limits or technical terms, or install LangExtract (pip install langextract) for richer extraction.');
            }
        } catch (e: any) {
            showError('Extraction failed', e?.message);
        } finally {
            setTableLoading(false);
        }
    };

    // AI assistant: extract/filter table by natural language instruction (e.g. "solo datos de sensores")
    const handleExtractWithInstruction = async () => {
        if (!documentForTableView?.id || !tableAssistantInstruction.trim()) return;
        setTableAssistantLoading(true);
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${documentForTableView.id}/extract-with-instruction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ instruction: tableAssistantInstruction.trim() })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Extraction failed');
            const raw = data?.structuredExtraction;
            const extractions = Array.isArray(raw?.extractions) ? raw.extractions : [];
            const rows: Record<string, string | number>[] = extractions.map((item: { extraction_class?: string; extraction_text?: string; attributes?: Record<string, unknown> }) => {
                const row: Record<string, string | number> = {
                    type: item.extraction_class ?? '',
                    text: item.extraction_text ?? '',
                };
                const attrs = item.attributes || {};
                Object.keys(attrs).forEach((k) => {
                    const v = attrs[k];
                    row[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
                });
                return row;
            });
            setTableRows(rows);
            if (rows.length) success(`Extraídos ${rows.length} ítems según tu instrucción.`);
            else success('La IA no encontró datos que coincidan con la instrucción. Prueba otra frase.');
        } catch (e: any) {
            showError('Error del asistente', e?.message);
        } finally {
            setTableAssistantLoading(false);
        }
    };

    const handleExportTableCSV = () => {
        if (tableRows.length === 0) return;
        const headers = Array.from(new Set(tableRows.flatMap((r) => Object.keys(r))));
        const line = (arr: string[]) => arr.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
        const csv = [line(headers), ...tableRows.map((r) => line(headers.map((h) => String(r[h] ?? ''))))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentForTableView?.name || 'document'}-table.csv`;
        a.click();
        URL.revokeObjectURL(url);
        success('CSV downloaded');
    };

    // Group table rows by type/extraction_class for multiple tables
    const tableGroups = useMemo(() => {
        if (tableRows.length === 0) return [];
        const typeKey = Object.keys(tableRows[0]).find(
            (k) => k.toLowerCase() === 'type' || k.toLowerCase() === 'extraction_class'
        );
        if (!typeKey) return [{ key: 'default', label: 'Data', rows: tableRows }];
        const byType: Record<string, Record<string, string | number>[]> = {};
        tableRows.forEach((row) => {
            const t = String(row[typeKey] ?? 'Other').trim() || 'Other';
            if (!byType[t]) byType[t] = [];
            byType[t].push(row);
        });
        return Object.entries(byType).map(([key, rows]) => ({ key, label: key, rows }));
    }, [tableRows]);

    const handleCreateEntityFromTable = async (rows: Record<string, string | number>[]) => {
        if (rows.length === 0) return;
        setCreatingEntityFromTable(true);
        try {
            const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
            const entityId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const properties = headers.map((col, idx) => ({
                id: `prop-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                name: col,
                type: 'text' as const,
                defaultValue: ''
            }));
            const entityName = `${documentForTableView?.name || 'Document'} (extracted)`;
            const newEntity = {
                id: entityId,
                name: entityName,
                description: `Created from document "${documentForTableView?.name || ''}" (${rows.length} records)`,
                author: user?.name || user?.email?.split('@')[0] || undefined,
                lastEdited: new Date().toISOString(),
                properties,
                folderId: currentFolderId || undefined
            };
            const createRes = await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newEntity)
            });
            if (!createRes.ok) {
                const err = await createRes.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to create entity');
            }
            const BATCH = 50;
            for (let i = 0; i < rows.length; i += BATCH) {
                const batch = rows.slice(i, i + BATCH);
                const records = batch.map((row) => {
                    const rec: Record<string, string | number> = {};
                    headers.forEach((h) => { rec[h] = row[h] ?? ''; });
                    return rec;
                });
                const recRes = await fetch(`${API_BASE}/entities/${entityId}/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(records)
                });
                if (!recRes.ok) {
                    const err = await recRes.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to add records');
                }
            }
            success(`Entity "${entityName}" created with ${rows.length} records`);
            handleCloseTableView();
            onEntityCreated?.();
            onNavigate(entityId);
        } catch (e) {
            showError('Create entity failed', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setCreatingEntityFromTable(false);
        }
    };

    // Helper to parse CSV (handles quoted values with commas)
    const parseCSV = (text: string): { headers: string[], data: Record<string, string>[] } => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 1) return { headers: [], data: [] };
        
        // Parse a CSV line respecting quoted values
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"' && !inQuotes) {
                    inQuotes = true;
                } else if (char === '"' && inQuotes) {
                    if (nextChar === '"') {
                        current += '"';
                        i++; // Skip escaped quote
                    } else {
                        inQuotes = false;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };
        
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
        const data: Record<string, string>[] = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
                row[header] = (values[idx] || '').replace(/^["']|["']$/g, '');
            });
            data.push(row);
        }
        return { headers, data };
    };

    // Detect column type
    const detectColumnType = (values: string[]): 'text' | 'number' | 'json' => {
        const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
        if (validValues.length === 0) return 'text';
        const allNumbers = validValues.every(v => !isNaN(Number(v)) && v !== '');
        if (allNumbers) return 'number';
        return 'text';
    };

    // Step 1: Parse file and show preview
    const handleFileUpload = async (file: File) => {
        if (!file) return;

        const allowedExtensions = ['.csv'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            warning('Invalid file type', 'Please upload a CSV file (.csv)');
            return;
        }

        try {
            const text = await file.text();
            const { headers, data } = parseCSV(text);
            
            if (headers.length === 0 || data.length === 0) {
                showError('Invalid file', 'The CSV file appears to be empty or malformed');
                return;
            }

            // Detect column types and create preview columns
            const columns = headers.map(header => {
                const values = data.slice(0, 100).map(row => row[header]);
                return {
                    name: header,
                    detectedType: detectColumnType(values),
                    include: true
                };
            });

            setImportFileName(file.name);
            setImportPreviewData(data);
            setImportColumns(columns);
            setImportStep('preview');
            
        } catch (error) {
            console.error('Error parsing file:', error);
            showError('Failed to parse file', 'Check the file format and try again');
        }
    };
    
    // Step 2: Execute the actual import
    const executeImport = async () => {
        setImportStep('importing');
        setIsUploadingFile(true);
        
        try {
            const includedColumns = importColumns.filter(c => c.include);
            
            if (includedColumns.length === 0) {
                showError('No columns selected', 'Please select at least one column to import');
                setImportStep('preview');
                setIsUploadingFile(false);
                return;
            }
            
            // Generate entity ID
            const entityId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create properties from selected columns
            const properties = includedColumns.map((col, idx) => ({
                id: `prop-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                name: col.name,
                type: col.detectedType,
                defaultValue: ''
            }));

            // Create entity
            const entityName = newEntityName.trim() || importFileName.replace(/\.[^/.]+$/, '');
            const newEntity = {
                id: entityId,
                name: entityName,
                description: `Imported from ${importFileName} (${importPreviewData.length} records)`,
                properties,
                folderId: currentFolderId || undefined
            };

            const createRes = await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newEntity)
            });

            if (!createRes.ok) {
                throw new Error('Failed to create entity');
            }

            // Import records in batches (only included columns)
            const batchSize = 50;
            for (let i = 0; i < importPreviewData.length; i += batchSize) {
                const batch = importPreviewData.slice(i, i + batchSize);
                
                for (const row of batch) {
                    const filteredRow: Record<string, string> = {};
                    includedColumns.forEach(col => {
                        filteredRow[col.name] = row[col.name] || '';
                    });
                    
                    await fetch(`${API_BASE}/entities/${entityId}/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(filteredRow)
                    });
                }
            }

            success(`Entity "${entityName}" created with ${importPreviewData.length} records`);
            resetImportState();
            setIsCreatingEntity(false);
            
            // Save current folder and reload
            if (currentFolderId) {
                sessionStorage.setItem('kb_currentFolder', currentFolderId);
            }
            window.location.reload();
            
        } catch (error) {
            console.error('Error uploading file:', error);
            showError('Failed to upload file', 'Check the file format and try again');
            setImportStep('preview');
        } finally {
            setIsUploadingFile(false);
        }
    };
    
    // Reset import state
    const resetImportState = () => {
        setImportStep('upload');
        setImportPreviewData([]);
        setImportColumns([]);
        setImportFileName('');
        setNewEntityName('');
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
            
            {/* Knowledge Graph Modal */}
            {showKnowledgeGraph && (
                <KnowledgeGraph
                    entities={entities}
                    folders={folders}
                    onNavigate={onNavigate}
                    onClose={() => setShowKnowledgeGraph(false)}
                />
            )}
            
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
                            onClick={() => setShowKnowledgeGraph(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-lg text-xs font-medium transition-colors"
                            title="View knowledge graph"
                        >
                            <TreeStructure size={14} weight="light" />
                            Knowledge Graph
                        </button>
                        <div className="w-px h-5 bg-[var(--border-light)]" />
                        <button
                            onClick={() => navigate('/database/new')}
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
                            Upload Document
                        </button>
                        <button
                            onClick={() => openCreateFolderModal(currentFolderId)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors"
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
                    <div className="flex flex-col border-b border-[var(--border-light)] bg-[var(--bg-primary)]">
                        <div className="flex items-center justify-between px-6 py-3">
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
                            <div className="flex items-center border border-[var(--accent-primary)] rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                >
                                    <GridFour size={16} weight="light" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                >
                                    <List size={16} weight="light" />
                                </button>
                            </div>
                        </div>
                        </div>
                        {/* Bulk actions bar (entities) */}
                        {selectedEntityIds.size > 0 && (
                            <div className="flex items-center gap-3 px-6 py-2 bg-[var(--accent-primary)]/10 border-t border-[var(--accent-primary)]/20">
                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                    {selectedEntityIds.size} entidad(es) seleccionada(s)
                                </span>
                                <button
                                    onClick={() => setShowMoveModal(true)}
                                    disabled={bulkActionLoading}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] disabled:opacity-50"
                                >
                                    <Folder size={14} weight="light" />
                                    Mover
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={bulkActionLoading}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50"
                                >
                                    <Trash size={14} weight="light" />
                                    Borrar
                                </button>
                                <button
                                    onClick={clearEntitySelection}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                                >
                                    Desmarcar
                                </button>
                            </div>
                        )}
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
                                            onClick={() => navigate('/database/new')}
                                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <Database size={14} weight="light" />
                                            New Entity
                                        </button>
                                        <button
                                            onClick={() => openCreateFolderModal(currentFolderId)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors"
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
                                                            className="p-1 hover:bg-red-500/10 rounded text-red-500"
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
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); selectAllEntitiesInView(); }}
                                                className="flex items-center gap-2 rounded p-0.5 hover:bg-[var(--bg-hover)]"
                                                title={currentFolderItems.entities.every(e => selectedEntityIds.has(e.id)) ? 'Desmarcar todas' : 'Seleccionar todas'}
                                            >
                                                {currentFolderItems.entities.every(e => selectedEntityIds.has(e.id)) ? (
                                                    <CheckSquare size={16} weight="fill" className="text-[var(--accent-primary)]" />
                                                ) : (
                                                    <span className="w-4 h-4 rounded border border-[var(--border-light)] bg-transparent" />
                                                )}
                                            </button>
                                            <Database size={12} weight="light" />
                                            Entities ({currentFolderItems.entities.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {currentFolderItems.entities.map((entity) => (
                                                <div
                                                    key={entity.id || `entity-${Math.random()}`}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        handleDragStart('entity', entity.id);
                                                    }}
                                                    className="relative"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); toggleEntitySelection(entity.id); }}
                                                        className="absolute top-2 left-2 z-10 p-1 rounded bg-[var(--bg-card)]/90 border border-[var(--border-light)] hover:bg-[var(--bg-hover)]"
                                                        title={selectedEntityIds.has(entity.id) ? 'Desmarcar' : 'Seleccionar'}
                                                    >
                                                        {selectedEntityIds.has(entity.id) ? (
                                                            <CheckSquare size={14} weight="fill" className="text-[var(--accent-primary)]" />
                                                        ) : (
                                                            <span className="block w-3.5 h-3.5 rounded border border-[var(--border-light)] bg-transparent" />
                                                        )}
                                                    </button>
                                                    <EntityCard
                                                        entity={entity}
                                                        onClick={(e) => {
                                                            if (e.id) onNavigate(e.id);
                                                        }}
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
                                                    onClick={() => handleViewAsTable(doc)}
                                                    className="group relative bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4 hover:border-[var(--border-medium)] hover:shadow-md transition-all cursor-pointer"
                                                >
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleViewAsTable(doc); }}
                                                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]"
                                                            title="Ver como tabla"
                                                        >
                                                            <Table size={12} weight="light" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleExtractDocumentStructure(doc); }}
                                                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]"
                                                            title="Extract structured data"
                                                            disabled={extractingDocId === doc.id}
                                                        >
                                                            {extractingDocId === doc.id ? (
                                                                <SpinnerGap size={12} weight="light" className="animate-spin" />
                                                            ) : (
                                                                <Gear size={12} weight="light" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                                                            className="p-1 hover:bg-red-500/10 rounded text-red-500"
                                                        >
                                                            <Trash size={12} weight="light" />
                                                        </button>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
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
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1 hover:bg-red-500/10 rounded" title="Delete folder">
                                                <Trash size={14} weight="light" className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Entities */}
                                {currentFolderItems.entities.length > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); selectAllEntitiesInView(); }}
                                            className="flex items-center gap-2 rounded p-0.5 hover:bg-[var(--bg-hover)]"
                                            title={currentFolderItems.entities.every(e => selectedEntityIds.has(e.id)) ? 'Desmarcar todas' : 'Seleccionar todas'}
                                        >
                                            {currentFolderItems.entities.every(e => selectedEntityIds.has(e.id)) ? (
                                                <CheckSquare size={14} weight="fill" className="text-[var(--accent-primary)]" />
                                            ) : (
                                                <span className="block w-3.5 h-3.5 rounded border border-[var(--border-light)] bg-transparent" />
                                            )}
                                        </button>
                                        <Database size={12} weight="light" />
                                        Entities ({currentFolderItems.entities.length})
                                    </div>
                                )}
                                {currentFolderItems.entities.map((entity) => (
                                    <div
                                        key={entity.id}
                                        draggable
                                        onDragStart={() => handleDragStart('entity', entity.id)}
                                        onClick={() => onNavigate(entity.id)}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleEntitySelection(entity.id); }}
                                            className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                                        >
                                            {selectedEntityIds.has(entity.id) ? (
                                                <CheckSquare size={18} weight="fill" className="text-[var(--accent-primary)]" />
                                            ) : (
                                                <span className="block w-[18px] h-[18px] rounded border border-[var(--border-light)] bg-transparent" />
                                            )}
                                        </button>
                                        <Database size={20} weight="light" className="text-emerald-500 shrink-0" />
                                        <span className="flex-1 text-sm text-[var(--text-primary)]">{entity.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">{entity.properties?.length || 0} properties</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteEntity(entity); }} className="p-1 hover:bg-red-500/10 rounded">
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
                                        onClick={() => handleViewAsTable(doc)}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
                                    >
                                        <FileText size={20} weight="light" className="text-blue-500" />
                                        <span className="flex-1 text-sm text-[var(--text-primary)]">{doc.name}</span>
                                        <span className="text-xs text-[var(--text-tertiary)]">{doc.type}</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleViewAsTable(doc); }}
                                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                                                title="Ver como tabla"
                                            >
                                                <Table size={14} weight="light" className="text-[var(--text-secondary)]" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleExtractDocumentStructure(doc); }}
                                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                                                title="Extract structured data"
                                                disabled={extractingDocId === doc.id}
                                            >
                                                {extractingDocId === doc.id ? (
                                                    <SpinnerGap size={14} weight="light" className="text-[var(--text-secondary)] animate-spin" />
                                                ) : (
                                                    <Gear size={14} weight="light" className="text-[var(--text-secondary)]" />
                                                )}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="p-1 hover:bg-red-500/10 rounded">
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
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />

            {/* Move entities modal (bulk) */}
            {showMoveModal && selectedEntityIds.size > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !bulkActionLoading && setShowMoveModal(false)}>
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Mover entidades</h2>
                            <button onClick={() => !bulkActionLoading && setShowMoveModal(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">
                            {selectedEntityIds.size} entidad(es) seleccionada(s). Elige carpeta destino:
                        </p>
                        <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                            <button
                                type="button"
                                onClick={() => handleBulkMove(null)}
                                disabled={bulkActionLoading}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                            >
                                <House size={18} weight="light" className="text-[var(--text-tertiary)]" />
                                Raíz (sin carpeta)
                            </button>
                            {folders.map((folder) => (
                                <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => handleBulkMove(folder.id)}
                                    disabled={bulkActionLoading}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                                >
                                    <Folder size={18} weight="light" style={{ color: folder.color || '#6b7280' }} />
                                    <span className="truncate">{folder.name}</span>
                                </button>
                            ))}
                        </div>
                        {bulkActionLoading && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                                <SpinnerGap size={14} weight="light" className="animate-spin" />
                                Moviendo…
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                className="px-4 py-2 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Entity Modal */}
            {isCreatingEntity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`bg-[var(--bg-card)] rounded-xl shadow-2xl w-full p-6 transition-all ${importStep === 'preview' ? 'max-w-3xl' : 'max-w-md'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-medium text-[var(--text-primary)]">
                                    {importStep === 'preview' ? 'Configure Import' : importStep === 'importing' ? 'Importing...' : 'Create Entity'}
                                </h2>
                                {importStep === 'preview' && (
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                        {importPreviewData.length} rows · {importColumns.filter(c => c.include).length} columns selected
                                    </p>
                                )}
                            </div>
                            <button onClick={() => { setIsCreatingEntity(false); resetImportState(); }} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
                                <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        
                        {currentFolderId && importStep === 'upload' && (
                            <div className="mb-4 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)] flex items-center gap-2">
                                <Folder size={14} weight="light" style={{ color: currentFolder?.color }} />
                                Creating in: <span className="font-medium text-[var(--text-primary)]">{currentFolder?.name}</span>
                            </div>
                        )}
                        
                        {/* Step: Upload */}
                        {importStep === 'upload' && (
                            <>
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
                                    
                                    {/* Entity Type Selector */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Type</label>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {ENTITY_TYPE_OPTIONS.map(opt => {
                                                const IconMap: Record<string, React.ElementType> = {
                                                    Database, Factory, Gear, Thermometer, Flask, Lightning, ShieldCheck
                                                };
                                                const Icon = IconMap[opt.iconName] || Database;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setNewEntityType(opt.value)}
                                                        className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs transition-all ${
                                                            newEntityType === opt.value
                                                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                                                : 'border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-secondary)]'
                                                        }`}
                                                        title={opt.description}
                                                    >
                                                        <Icon size={18} weight="light" />
                                                        <span className="font-medium truncate w-full text-center" style={{ fontSize: '10px' }}>{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    {uploadMode === 'manual' ? (
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                                            <textarea
                                                value={newEntityDescription}
                                                onChange={(e) => setNewEntityDescription(e.target.value)}
                                                placeholder="Brief description"
                                                rows={2}
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
                                                <p className="text-sm text-[var(--text-secondary)]">Click to upload CSV file</p>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">.csv</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={() => { setIsCreatingEntity(false); resetImportState(); }}
                                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    {uploadMode === 'manual' && (
                                        <button
                                            onClick={handleCreateEntity}
                                            disabled={!newEntityName.trim()}
                                            className="px-4 py-2 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                        
                        {/* Step: Preview */}
                        {importStep === 'preview' && (
                            <>
                                {/* Entity Name */}
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Entity Name</label>
                                    <input
                                        type="text"
                                        value={newEntityName}
                                        onChange={(e) => setNewEntityName(e.target.value)}
                                        placeholder={importFileName.replace(/\.[^/.]+$/, '')}
                                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                    />
                                </div>
                                
                                {/* Column Selection */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                                            Columns to Import
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setImportColumns(prev => prev.map(c => ({ ...c, include: true })))}
                                                className="text-[10px] text-[#419CAF] hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-[var(--text-tertiary)]">|</span>
                                            <button
                                                onClick={() => setImportColumns(prev => prev.map(c => ({ ...c, include: false })))}
                                                className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                        <div className="grid grid-cols-[auto,1fr,100px,80px] gap-2 px-3 py-2 bg-[var(--bg-tertiary)] text-[10px] font-medium text-[var(--text-tertiary)] uppercase">
                                            <span></span>
                                            <span>Column</span>
                                            <span>Type</span>
                                            <span>Sample</span>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {importColumns.map((col, idx) => (
                                                <div key={idx} className={`grid grid-cols-[auto,1fr,100px,80px] gap-2 px-3 py-2 items-center border-b border-[var(--border-light)] last:border-b-0 ${!col.include ? 'opacity-50' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={col.include}
                                                        onChange={(e) => {
                                                            const updated = [...importColumns];
                                                            updated[idx].include = e.target.checked;
                                                            setImportColumns(updated);
                                                        }}
                                                        className="rounded border-[var(--border-medium)] text-[#419CAF] focus:ring-[#419CAF]"
                                                    />
                                                    <span className="text-sm text-[var(--text-primary)] truncate">{col.name}</span>
                                                    <select
                                                        value={col.detectedType}
                                                        onChange={(e) => {
                                                            const updated = [...importColumns];
                                                            updated[idx].detectedType = e.target.value as 'text' | 'number' | 'json';
                                                            setImportColumns(updated);
                                                        }}
                                                        className="px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-light)] rounded text-[var(--text-primary)]"
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="number">Number</option>
                                                        <option value="json">JSON</option>
                                                    </select>
                                                    <span className="text-[10px] text-[var(--text-tertiary)] truncate">
                                                        {importPreviewData[0]?.[col.name] || '-'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Data Preview */}
                                <div className="mb-4">
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
                                        Data Preview (first 5 rows)
                                    </label>
                                    <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                        <div className="overflow-x-auto max-h-[150px] custom-scrollbar">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0">
                                                    <tr className="bg-[var(--bg-tertiary)]">
                                                        {importColumns.filter(c => c.include).slice(0, 8).map((col, idx) => (
                                                            <th key={idx} className="px-3 py-2 text-left text-[var(--text-tertiary)] font-medium whitespace-nowrap bg-[var(--bg-tertiary)]">
                                                                {col.name}
                                                            </th>
                                                        ))}
                                                        {importColumns.filter(c => c.include).length > 8 && (
                                                            <th className="px-3 py-2 text-left text-[var(--text-tertiary)] font-medium bg-[var(--bg-tertiary)]">
                                                                +{importColumns.filter(c => c.include).length - 8}
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importPreviewData.slice(0, 5).map((row, rowIdx) => (
                                                        <tr key={rowIdx} className="border-t border-[var(--border-light)]">
                                                            {importColumns.filter(c => c.include).slice(0, 8).map((col, colIdx) => (
                                                                <td key={colIdx} className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap max-w-[150px] truncate">
                                                                    {row[col.name] || '-'}
                                                                </td>
                                                            ))}
                                                            {importColumns.filter(c => c.include).length > 8 && (
                                                                <td className="px-3 py-2 text-[var(--text-tertiary)]">...</td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center mt-6">
                                    <button
                                        onClick={() => { setImportStep('upload'); }}
                                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    >
                                        ← Back
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setIsCreatingEntity(false); resetImportState(); }}
                                            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={executeImport}
                                            disabled={importColumns.filter(c => c.include).length === 0}
                                            className="px-4 py-2 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Import {importPreviewData.length} Records
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {/* Step: Importing */}
                        {importStep === 'importing' && (
                            <div className="py-12 text-center">
                                <div className="w-12 h-12 mx-auto mb-4 relative">
                                    <svg className="animate-spin" viewBox="0 0 50 50">
                                        <circle cx="25" cy="25" r="20" fill="none" stroke="var(--border-medium)" strokeWidth="4" />
                                        <circle cx="25" cy="25" r="20" fill="none" stroke="#419CAF" strokeWidth="4" strokeLinecap="round" strokeDasharray="80, 200" />
                                    </svg>
                                </div>
                                <p className="text-sm text-[var(--text-primary)]">Importing {importPreviewData.length} records...</p>
                                <p className="text-xs text-[var(--text-tertiary)] mt-1">This may take a moment</p>
                            </div>
                        )}
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
                                className="px-4 py-2 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document → Table modal (LangExtract extractions as table); render in body so it sits above sidebar */}
            {documentForTableView && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4" onClick={(e) => e.target === e.currentTarget && handleCloseTableView()}>
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-[var(--border-light)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
                            <h2 className="text-base font-medium text-[var(--text-primary)]">
                                {documentForTableView.name} — Table
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportTableCSV}
                                    disabled={tableRows.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <DownloadSimple size={16} weight="light" />
                                    Export CSV
                                </button>
                                <button
                                    onClick={() => handleCreateEntityFromTable(tableRows)}
                                    disabled={tableRows.length === 0 || creatingEntityFromTable}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {creatingEntityFromTable ? <SpinnerGap size={16} weight="light" className="animate-spin" /> : <Database size={16} weight="light" />}
                                    Create entity
                                </button>
                                <button onClick={handleCloseTableView} className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg">
                                    <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Document preview: text extracted on upload (used for structured extraction) */}
                            <div className="rounded-lg border border-[var(--border-light)] overflow-hidden">
                                <div className="px-3 py-2 bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                    Document preview (text used for extraction)
                                </div>
                                <div className="p-3 max-h-64 overflow-y-auto bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] whitespace-pre-wrap custom-scrollbar">
                                    {documentPreviewText ? (
                                        documentPreviewText
                                    ) : (
                                        <span className="text-[var(--text-tertiary)]">
                                            No text was extracted from this document on upload. Upload a PDF or TXT so the system can extract text, then &quot;Extract structured data&quot; can run.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Asistente de IA: extraer/filtrar tabla por instrucción en lenguaje natural */}
                            <div className="rounded-lg border border-[var(--border-light)] overflow-hidden">
                                <div className="px-3 py-2 bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] flex items-center gap-2">
                                    <Sparkle size={14} weight="duotone" className="text-[var(--accent-primary)]" />
                                    Asistente de IA
                                </div>
                                <div className="p-3 bg-[var(--bg-primary)] space-y-2">
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        Indica qué datos quieres extraer y la IA generará la tabla (ej: &quot;solo datos de sensores&quot;, &quot;solo parámetros de proceso&quot;, &quot;límites de calidad&quot;).
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={tableAssistantInstruction}
                                            onChange={(e) => setTableAssistantInstruction(e.target.value)}
                                            placeholder="Ej: solo datos de sensores, parámetros de proceso..."
                                            className="flex-1 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                                            onKeyDown={(e) => e.key === 'Enter' && handleExtractWithInstruction()}
                                            disabled={tableAssistantLoading || !documentPreviewText}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleExtractWithInstruction}
                                            disabled={tableAssistantLoading || !documentPreviewText || !tableAssistantInstruction.trim()}
                                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                        >
                                            {tableAssistantLoading ? (
                                                <SpinnerGap size={18} weight="light" className="animate-spin" />
                                            ) : (
                                                <Sparkle size={18} weight="light" />
                                            )}
                                            Generar tabla
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {tableLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <SpinnerGap size={24} weight="light" className="animate-spin text-[var(--text-tertiary)]" />
                                </div>
                            ) : tableRows.length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-sm text-[var(--text-tertiary)] mb-4">No structured data yet. Run extraction to get a table from the document text above.</p>
                                    <button
                                        type="button"
                                        onClick={handleExtractFromTableModal}
                                        disabled={tableLoading || !documentPreviewText}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Gear size={18} weight="light" />
                                        Extract structured data
                                    </button>
                                    {!documentPreviewText && (
                                        <p className="text-xs text-[var(--text-tertiary)] mt-2">Need document text in the preview first.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {tableGroups.map(({ key, label, rows }) => (
                                        <div key={key} className="rounded-lg border border-[var(--border-light)] overflow-hidden">
                                            <div className="px-3 py-2 bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)]">
                                                {label} ({rows.length})
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-[var(--border-medium)]">
                                                            {Object.keys(rows[0]).map((col) => (
                                                                <th key={col} className="text-left py-2 px-3 font-medium text-[var(--text-secondary)] capitalize">
                                                                    {col}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map((row, idx) => (
                                                            <tr key={idx} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-hover)]">
                                                                {Object.keys(rows[0]).map((col) => (
                                                                    <td key={col} className="py-2 px-3 text-[var(--text-primary)] max-w-[200px] truncate" title={String(row[col] ?? '')}>
                                                                        {String(row[col] ?? '')}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
