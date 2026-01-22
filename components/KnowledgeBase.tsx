import React, { useState, useEffect } from 'react';
import { Database, FileText, Upload, Search, X, Plus, File, ExternalLink, Tag, Link2, Calendar, Clock, Trash2, Sparkles, Shield, Plug, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { EntityCard } from './EntityCard';
import { Tabs } from './Tabs';
import { Pagination } from './Pagination';
import { API_BASE } from '../config';
import { Entity } from '../types';

interface KnowledgeDocument {
    id: string;
    name: string;
    type: string;
    source: string;
    filePath?: string;
    googleDriveId?: string;
    googleDriveUrl?: string;
    mimeType?: string;
    fileSize?: number;
    summary?: string;
    tags: string[];
    relatedEntityIds: string[];
    uploadedBy?: string;
    createdAt: string;
    updatedAt: string;
}

interface KnowledgeBaseProps {
    entities?: Entity[];
    onNavigate?: (entityId: string) => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ entities, onNavigate }) => {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
    const [activeTab, setActiveTab] = useState<'entities' | 'documents' | 'standards' | 'connections'>('entities');
    
    useEffect(() => {
        console.log('KnowledgeBase mounted, entities:', entities?.length || 0);
    }, [entities]);
    const [currentDocPage, setCurrentDocPage] = useState(1);
    const [currentEntityPage, setCurrentEntityPage] = useState(1);
    const [currentStandardPage, setCurrentStandardPage] = useState(1);
    const [currentConnectionPage, setCurrentConnectionPage] = useState(1);
    const itemsPerPage = 6;
    
    // Standards state
    const [standards, setStandards] = useState<any[]>([]);
    const [showStandardModal, setShowStandardModal] = useState(false);
    const [selectedStandard, setSelectedStandard] = useState<any | null>(null);
    const [standardSearchQuery, setStandardSearchQuery] = useState('');
    
    // Connections state
    const [connections, setConnections] = useState<any[]>([]);
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<any | null>(null);
    const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
    const [testingConnection, setTestingConnection] = useState<string | null>(null);

    useEffect(() => {
        console.log('KnowledgeBase useEffect - fetching data');
        fetchDocuments();
        fetchStandards();
        fetchConnections();
    }, []);
    
    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentDocPage(1);
    }, [searchQuery]);
    
    useEffect(() => {
        setCurrentStandardPage(1);
    }, [standardSearchQuery]);
    
    useEffect(() => {
        setCurrentConnectionPage(1);
    }, [connectionSearchQuery]);

    const fetchDocuments = async () => {
        try {
            const res = await fetch(`${API_BASE}/knowledge/documents`, { credentials: 'include' });
            const data = await res.json();
            setDocuments(data);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchStandards = async () => {
        try {
            const res = await fetch(`${API_BASE}/standards`, { credentials: 'include' });
            const data = await res.json();
            setStandards(data);
        } catch (error) {
            console.error('Error fetching standards:', error);
        }
    };
    
    const fetchConnections = async () => {
        try {
            const res = await fetch(`${API_BASE}/data-connections`, { credentials: 'include' });
            const data = await res.json();
            setConnections(data);
        } catch (error) {
            console.error('Error fetching connections:', error);
        }
    };

    const handleUpload = async (file: File, name?: string, tags?: string) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (name) formData.append('name', name);
            if (tags) formData.append('tags', tags);

            const res = await fetch(`${API_BASE}/knowledge/documents/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (res.ok) {
                await fetchDocuments();
                setShowUploadModal(false);
            } else {
                alert('Failed to upload document');
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const res = await fetch(`${API_BASE}/knowledge/documents/${docId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.id !== docId));
                if (selectedDocument?.id === docId) {
                    setSelectedDocument(null);
                }
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Failed to delete document');
        }
    };

    const filteredDocuments = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    const totalDocPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    const paginatedDocuments = filteredDocuments.slice(
        (currentDocPage - 1) * itemsPerPage,
        currentDocPage * itemsPerPage
    );
    
    const totalEntityPages = Math.ceil((entities?.length || 0) / itemsPerPage);
    const paginatedEntities = entities?.slice(
        (currentEntityPage - 1) * itemsPerPage,
        currentEntityPage * itemsPerPage
    ) || [];
    
    // Standards filtering and pagination
    const filteredStandards = standards.filter(s =>
        s.name.toLowerCase().includes(standardSearchQuery.toLowerCase()) ||
        s.code?.toLowerCase().includes(standardSearchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(standardSearchQuery.toLowerCase()) ||
        s.tags.some((tag: string) => tag.toLowerCase().includes(standardSearchQuery.toLowerCase()))
    );
    const totalStandardPages = Math.ceil(filteredStandards.length / itemsPerPage);
    const paginatedStandards = filteredStandards.slice(
        (currentStandardPage - 1) * itemsPerPage,
        currentStandardPage * itemsPerPage
    );
    
    // Connections filtering and pagination
    const filteredConnections = connections.filter(c =>
        c.name.toLowerCase().includes(connectionSearchQuery.toLowerCase()) ||
        c.type.toLowerCase().includes(connectionSearchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(connectionSearchQuery.toLowerCase())
    );
    const totalConnectionPages = Math.ceil(filteredConnections.length / itemsPerPage);
    const paginatedConnections = filteredConnections.slice(
        (currentConnectionPage - 1) * itemsPerPage,
        currentConnectionPage * itemsPerPage
    );

    const getFileIcon = (mimeType?: string) => {
        if (!mimeType) return File;
        if (mimeType.includes('pdf')) return File;
        if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return File;
        if (mimeType.includes('text')) return FileText;
        return File;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div>
                    <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                        Knowledge Base
                    </h1>
                    <p className="text-[11px] text-slate-500">Manage your data, documents, standards, and connections</p>
                </div>
                {activeTab === 'documents' && (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus size={14} className="mr-2" />
                        Add Knowledge
                    </button>
                )}
                {activeTab === 'standards' && (
                    <button
                        onClick={() => setShowStandardModal(true)}
                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus size={14} className="mr-2" />
                        Add Standard
                    </button>
                )}
                {activeTab === 'connections' && (
                    <button
                        onClick={() => setShowConnectionModal(true)}
                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus size={14} className="mr-2" />
                        Add Connection
                    </button>
                )}
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Tabs */}
                <div className="px-8 pt-6">
                    <Tabs
                        items={[
                            { id: 'entities', label: 'Master Data', icon: Database, badge: entities?.length || 0 },
                            { id: 'documents', label: 'Knowledge', icon: FileText, badge: documents.length },
                            { id: 'standards', label: 'Standards', icon: Shield, badge: standards.length },
                            { id: 'connections', label: 'Connections', icon: Plug, badge: connections.length }
                        ]}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'documents' ? (
                    <>
                        {/* Search */}
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search knowledge files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Documents Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-slate-400">Loading knowledge files...</div>
                            </div>
                        ) : filteredDocuments.length === 0 ? (
                            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                                <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                                <h3 className="text-base font-normal text-slate-700 mb-2">No knowledge files yet</h3>
                                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                                    Upload documents and files to build your knowledge base. Supported formats: PDF, Word, Excel, CSV, and text files.
                                </p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                                >
                                    Add Your First File
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {paginatedDocuments.map((doc) => {
                                    const FileIcon = getFileIcon(doc.mimeType);
                                    return (
                                        <div
                                            key={doc.id}
                                            onClick={() => setSelectedDocument(doc)}
                                            className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
                                                        <FileIcon size={18} className="text-slate-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                            {doc.name}
                                                        </h3>
                                                        {doc.summary && (
                                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                                {doc.summary}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(doc.id);
                                                    }}
                                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {doc.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {doc.tags.slice(0, 3).map((tag, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {doc.tags.length > 3 && (
                                                        <span className="px-2 py-0.5 text-slate-400 text-xs">
                                                            +{doc.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                                {doc.fileSize && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <File size={12} className="text-slate-400" />
                                                        <span>{formatFileSize(doc.fileSize)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    <span>Uploaded {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                                
                                {/* Pagination */}
                                {totalDocPages > 1 && (
                                    <div className="mt-6">
                                        <Pagination
                                            currentPage={currentDocPage}
                                            totalPages={totalDocPages}
                                            onPageChange={setCurrentDocPage}
                                            itemsPerPage={itemsPerPage}
                                            totalItems={filteredDocuments.length}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : activeTab === 'entities' ? (
                    <>
                        {/* Entities Grid */}
                        {!entities || entities.length === 0 ? (
                            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                                <Database className="mx-auto text-slate-300 mb-4" size={48} />
                                <h3 className="text-base font-normal text-slate-700 mb-2">No entities yet</h3>
                                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                                    Create entities to structure your data. Entities represent your core data models.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {paginatedEntities.map((entity) => (
                                    <EntityCard
                                        key={entity.id}
                                        entity={entity}
                                        onClick={(e) => {
                                            if (onNavigate) {
                                                onNavigate(e.id);
                                            }
                                        }}
                                    />
                                    ))}
                                </div>
                                
                                {/* Pagination */}
                                {totalEntityPages > 1 && (
                                    <div className="mt-6">
                                        <Pagination
                                            currentPage={currentEntityPage}
                                            totalPages={totalEntityPages}
                                            onPageChange={setCurrentEntityPage}
                                            itemsPerPage={itemsPerPage}
                                            totalItems={entities.length}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : activeTab === 'standards' ? (
                    <StandardsView
                        standards={paginatedStandards}
                        totalPages={totalStandardPages}
                        currentPage={currentStandardPage}
                        onPageChange={setCurrentStandardPage}
                        searchQuery={standardSearchQuery}
                        onSearchChange={setStandardSearchQuery}
                        onAdd={() => setShowStandardModal(true)}
                        onEdit={(standard) => {
                            setSelectedStandard(standard);
                            setShowStandardModal(true);
                        }}
                        onDelete={async (id) => {
                            if (confirm('Are you sure you want to delete this standard?')) {
                                try {
                                    await fetch(`${API_BASE}/standards/${id}`, {
                                        method: 'DELETE',
                                        credentials: 'include'
                                    });
                                    fetchStandards();
                                } catch (error) {
                                    console.error('Error deleting standard:', error);
                                    alert('Failed to delete standard');
                                }
                            }
                        }}
                        entities={entities}
                    />
                ) : activeTab === 'connections' ? (
                    <ConnectionsView
                        connections={paginatedConnections}
                        totalPages={totalConnectionPages}
                        currentPage={currentConnectionPage}
                        onPageChange={setCurrentConnectionPage}
                        searchQuery={connectionSearchQuery}
                        onSearchChange={setConnectionSearchQuery}
                        onAdd={() => setShowConnectionModal(true)}
                        onEdit={(connection) => {
                            setSelectedConnection(connection);
                            setShowConnectionModal(true);
                        }}
                        onDelete={async (id) => {
                            if (confirm('Are you sure you want to delete this connection?')) {
                                try {
                                    await fetch(`${API_BASE}/data-connections/${id}`, {
                                        method: 'DELETE',
                                        credentials: 'include'
                                    });
                                    fetchConnections();
                                } catch (error) {
                                    console.error('Error deleting connection:', error);
                                    alert('Failed to delete connection');
                                }
                            }
                        }}
                        onTest={async (id) => {
                            setTestingConnection(id);
                            try {
                                const res = await fetch(`${API_BASE}/data-connections/${id}/test`, {
                                    method: 'POST',
                                    credentials: 'include'
                                });
                                const result = await res.json();
                                if (result.success) {
                                    alert('Connection test successful!');
                                } else {
                                    alert(`Connection test failed: ${result.message}`);
                                }
                                fetchConnections();
                            } catch (error) {
                                console.error('Error testing connection:', error);
                                alert('Failed to test connection');
                            } finally {
                                setTestingConnection(null);
                            }
                        }}
                        testingConnection={testingConnection}
                    />
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        <p>Select a tab to view content</p>
                    </div>
                )}
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadModal
                    onClose={() => setShowUploadModal(false)}
                    onUpload={handleUpload}
                    uploading={uploading}
                />
            )}

            {/* Document Detail Modal */}
            {selectedDocument && (
                <DocumentDetailModal
                    document={selectedDocument}
                    onClose={() => setSelectedDocument(null)}
                    onDelete={() => {
                        handleDelete(selectedDocument.id);
                        setSelectedDocument(null);
                    }}
                    entities={entities}
                />
            )}

            {/* Standard Modal */}
            {showStandardModal && (
                <StandardModal
                    standard={selectedStandard}
                    onClose={() => {
                        setShowStandardModal(false);
                        setSelectedStandard(null);
                    }}
                    onSave={async (standardData) => {
                        try {
                            const id = selectedStandard?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            const url = selectedStandard 
                                ? `${API_BASE}/standards/${selectedStandard.id}`
                                : `${API_BASE}/standards`;
                            const method = selectedStandard ? 'PUT' : 'POST';
                            
                            await fetch(url, {
                                method,
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ ...standardData, id })
                            });
                            
                            fetchStandards();
                            setShowStandardModal(false);
                            setSelectedStandard(null);
                        } catch (error) {
                            console.error('Error saving standard:', error);
                            alert('Failed to save standard');
                        }
                    }}
                    entities={entities}
                />
            )}

            {/* Connection Modal */}
            {showConnectionModal && (
                <ConnectionModal
                    connection={selectedConnection}
                    onClose={() => {
                        setShowConnectionModal(false);
                        setSelectedConnection(null);
                    }}
                    onSave={async (connectionData) => {
                        try {
                            const id = selectedConnection?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            const url = selectedConnection 
                                ? `${API_BASE}/data-connections/${selectedConnection.id}`
                                : `${API_BASE}/data-connections`;
                            const method = selectedConnection ? 'PUT' : 'POST';
                            
                            await fetch(url, {
                                method,
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ ...connectionData, id })
                            });
                            
                            fetchConnections();
                            setShowConnectionModal(false);
                            setSelectedConnection(null);
                        } catch (error) {
                            console.error('Error saving connection:', error);
                            alert('Failed to save connection');
                        }
                    }}
                />
            )}
        </div>
    );
};

// Standards View Component
interface StandardsViewProps {
    standards: any[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onAdd: () => void;
    onEdit: (standard: any) => void;
    onDelete: (id: string) => void;
    entities?: Entity[];
}

const StandardsView: React.FC<StandardsViewProps> = ({
    standards,
    totalPages,
    currentPage,
    onPageChange,
    searchQuery,
    onSearchChange,
    onAdd,
    onEdit,
    onDelete,
    entities
}) => {
    return (
        <>
            {/* Search and Toolbar */}
            <div className="mb-6 flex items-center justify-between">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search standards..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                    />
                </div>
                <button
                    onClick={onAdd}
                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                >
                    <Plus size={14} className="mr-2" />
                    Add Standard
                </button>
            </div>

            {/* Standards Grid */}
            {standards.length === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                    <Shield className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-base font-normal text-slate-700 mb-2">No standards yet</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                        Create standards to document norms, specifications, and compliance requirements.
                    </p>
                    <button
                        onClick={onAdd}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                    >
                        Create Your First Standard
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {standards.map((standard) => (
                            <div
                                key={standard.id}
                                onClick={() => onEdit(standard)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
                                            <Shield size={18} className="text-slate-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                {standard.name}
                                            </h3>
                                            {standard.code && (
                                                <p className="text-xs text-slate-500 mt-1">Code: {standard.code}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(standard.id);
                                        }}
                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {standard.description && (
                                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                        {standard.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-3 mb-3">
                                    {standard.category && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                            {standard.category}
                                        </span>
                                    )}
                                    {standard.status && (
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            standard.status === 'active' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {standard.status}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                    {standard.version && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Tag size={12} className="text-slate-400" />
                                            <span>Version {standard.version}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Calendar size={12} className="text-slate-400" />
                                        <span>Updated {new Date(standard.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-6">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={onPageChange}
                                itemsPerPage={6}
                                totalItems={standards.length}
                            />
                        </div>
                    )}
                </>
            )}
        </>
    );
};

// Connections View Component
interface ConnectionsViewProps {
    connections: any[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onAdd: () => void;
    onEdit: (connection: any) => void;
    onDelete: (id: string) => void;
    onTest: (id: string) => void;
    testingConnection: string | null;
}

const ConnectionsView: React.FC<ConnectionsViewProps> = ({
    connections,
    totalPages,
    currentPage,
    onPageChange,
    searchQuery,
    onSearchChange,
    onAdd,
    onEdit,
    onDelete,
    onTest,
    testingConnection
}) => {
    const getConnectionTypeColor = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'mysql':
            case 'postgresql':
            case 'database':
                return 'text-indigo-600';
            case 'api':
            case 'rest':
            case 'http':
                return 'text-cyan-600';
            case 'ftp':
            case 'sftp':
                return 'text-blue-600';
            default:
                return 'text-slate-600';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircle size={14} className="text-green-600" />;
            case 'inactive':
                return <XCircle size={14} className="text-slate-400" />;
            case 'error':
                return <AlertCircle size={14} className="text-red-600" />;
            default:
                return <AlertCircle size={14} className="text-slate-400" />;
        }
    };

    return (
        <>
            {/* Search and Toolbar */}
            <div className="mb-6 flex items-center justify-between">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search connections..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                    />
                </div>
                <button
                    onClick={onAdd}
                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                >
                    <Plus size={14} className="mr-2" />
                    Add Connection
                </button>
            </div>

            {/* Connections Grid */}
            {connections.length === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                    <Plug className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-base font-normal text-slate-700 mb-2">No connections yet</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                        Create connections to integrate with external systems like ERP, MES, databases, and APIs.
                    </p>
                    <button
                        onClick={onAdd}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                    >
                        Create Your First Connection
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {connections.map((connection) => (
                            <div
                                key={connection.id}
                                onClick={() => onEdit(connection)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
                                            <Plug size={18} className={getConnectionTypeColor(connection.type)} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors truncate" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                                {connection.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 capitalize">{connection.type}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(connection.id);
                                        }}
                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {connection.description && (
                                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                        {connection.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-1.5">
                                        {getStatusIcon(connection.status)}
                                        <span className="text-xs text-slate-600 capitalize">{connection.status || 'inactive'}</span>
                                    </div>
                                    {connection.lastTestedAt && (
                                        <span className="text-xs text-slate-400">
                                            Tested {new Date(connection.lastTestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </span>
                                    )}
                                </div>

                                {connection.lastError && (
                                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                        {connection.lastError}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTest(connection.id);
                                        }}
                                        disabled={testingConnection === connection.id}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                        {testingConnection === connection.id ? (
                                            <>
                                                <Clock size={12} className="animate-spin" />
                                                Testing...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={12} />
                                                Test Connection
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-6">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={onPageChange}
                                itemsPerPage={6}
                                totalItems={connections.length}
                            />
                        </div>
                    )}
                </>
            )}
        </>
    );
};

// Upload Modal Component
interface UploadModalProps {
    onClose: () => void;
    onUpload: (file: File, name?: string, tags?: string) => void;
    uploading: boolean;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, uploading }) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!name) {
                setName(selectedFile.name);
            }
        }
    };

    const handleSubmit = () => {
        if (file) {
            onUpload(file, name || undefined, tags || undefined);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[500px]" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-normal text-slate-800 mb-4 flex items-center gap-2">
                    <Upload size={20} className="text-slate-600" />
                    Add Knowledge File
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">File</label>
                        <input
                            type="file"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                        {file && (
                            <p className="text-xs text-slate-500 mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Name (optional)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Document name"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tags (comma-separated, optional)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g., finance, report, 2024"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                            disabled={uploading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!file || uploading}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Document Detail Modal
interface DocumentDetailModalProps {
    document: KnowledgeDocument;
    onClose: () => void;
    onDelete: () => void;
    entities?: any[];
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose, onDelete, entities }) => {
    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[700px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-normal text-slate-800">{document.name}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {document.summary && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Summary</h4>
                            <p className="text-sm text-slate-600">{document.summary}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Type</h4>
                            <p className="text-sm text-slate-600">{document.type}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Source</h4>
                            <p className="text-sm text-slate-600 capitalize">{document.source}</p>
                        </div>
                        {document.fileSize && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-2">Size</h4>
                                <p className="text-sm text-slate-600">
                                    {document.fileSize < 1024 ? `${document.fileSize} B` :
                                     document.fileSize < 1024 * 1024 ? `${(document.fileSize / 1024).toFixed(1)} KB` :
                                     `${(document.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                </p>
                            </div>
                        )}
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Uploaded</h4>
                            <p className="text-sm text-slate-600">
                                {new Date(document.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {document.tags.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Tags</h4>
                            <div className="flex flex-wrap gap-2">
                                {document.tags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                        <button
                            onClick={onDelete}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                        >
                            Delete
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Standard Modal Component
interface StandardModalProps {
    standard?: any;
    onClose: () => void;
    onSave: (data: any) => void;
    entities?: Entity[];
}

const StandardModal: React.FC<StandardModalProps> = ({ standard, onClose, onSave, entities }) => {
    const [name, setName] = useState(standard?.name || '');
    const [code, setCode] = useState(standard?.code || '');
    const [category, setCategory] = useState(standard?.category || '');
    const [description, setDescription] = useState(standard?.description || '');
    const [version, setVersion] = useState(standard?.version || '');
    const [status, setStatus] = useState(standard?.status || 'active');
    const [effectiveDate, setEffectiveDate] = useState(standard?.effectiveDate || '');
    const [expiryDate, setExpiryDate] = useState(standard?.expiryDate || '');
    const [content, setContent] = useState(standard?.content || '');
    const [tags, setTags] = useState(standard?.tags?.join(', ') || '');

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Please enter a standard name');
            return;
        }
        onSave({
            name: name.trim(),
            code: code.trim() || null,
            category: category.trim() || null,
            description: description.trim() || null,
            version: version.trim() || null,
            status,
            effectiveDate: effectiveDate || null,
            expiryDate: expiryDate || null,
            content: content.trim() || null,
            tags: tags.split(',').map(t => t.trim()).filter(t => t)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[700px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-normal text-slate-800 flex items-center gap-2">
                        <Shield size={20} className="text-slate-600" />
                        {standard ? 'Edit Standard' : 'Create Standard'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="e.g., ISO 9001:2015"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="e.g., ISO-9001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="e.g., Quality, Safety, Environmental"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Version</label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="e.g., 1.0, 2015"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            placeholder="Describe the standard..."
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            >
                                <option value="active">Active</option>
                                <option value="draft">Draft</option>
                                <option value="deprecated">Deprecated</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Effective Date</label>
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 font-mono"
                            placeholder="Standard content, requirements, specifications..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            placeholder="e.g., quality, iso, compliance"
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                        >
                            {standard ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Connection Modal Component
interface ConnectionModalProps {
    connection?: any;
    onClose: () => void;
    onSave: (data: any) => void;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ connection, onClose, onSave }) => {
    const [name, setName] = useState(connection?.name || '');
    const [type, setType] = useState(connection?.type || 'mysql');
    const [description, setDescription] = useState(connection?.description || '');
    const [config, setConfig] = useState<any>(connection?.config || {});
    const [status, setStatus] = useState(connection?.status || 'inactive');

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Please enter a connection name');
            return;
        }
        onSave({
            name: name.trim(),
            type,
            description: description.trim() || null,
            config,
            status
        });
    };

    const renderConfigFields = () => {
        switch (type) {
            case 'mysql':
            case 'postgresql':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Host</label>
                                <input
                                    type="text"
                                    value={config.host || ''}
                                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    placeholder="localhost"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Port</label>
                                <input
                                    type="number"
                                    value={config.port || ''}
                                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 3306 })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    placeholder="3306"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                                <input
                                    type="text"
                                    value={config.username || ''}
                                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={config.password || ''}
                                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Database</label>
                            <input
                                type="text"
                                value={config.database || ''}
                                onChange={(e) => setConfig({ ...config, database: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            />
                        </div>
                    </div>
                );
            case 'api':
            case 'rest':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">URL</label>
                            <input
                                type="text"
                                value={config.url || ''}
                                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="https://api.example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Method</label>
                            <select
                                value={config.method || 'GET'}
                                onChange={(e) => setConfig({ ...config, method: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">API Key / Token</label>
                            <input
                                type="password"
                                value={config.apiKey || ''}
                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="Bearer token or API key"
                            />
                        </div>
                    </div>
                );
            default:
                return (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Configuration (JSON)</label>
                        <textarea
                            value={JSON.stringify(config, null, 2)}
                            onChange={(e) => {
                                try {
                                    setConfig(JSON.parse(e.target.value));
                                } catch (e) {
                                    // Invalid JSON, ignore
                                }
                            }}
                            rows={6}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 font-mono"
                        />
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-[700px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-normal text-slate-800 flex items-center gap-2">
                        <Plug size={20} className="text-slate-600" />
                        {connection ? 'Edit Connection' : 'Create Connection'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                placeholder="e.g., Production ERP Database"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
                            <select
                                value={type}
                                onChange={(e) => {
                                    setType(e.target.value);
                                    setConfig({}); // Reset config when type changes
                                }}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            >
                                <option value="mysql">MySQL</option>
                                <option value="postgresql">PostgreSQL</option>
                                <option value="api">REST API</option>
                                <option value="rest">REST API (Legacy)</option>
                                <option value="ftp">FTP</option>
                                <option value="sftp">SFTP</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                            placeholder="Describe the connection..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Configuration</label>
                        {renderConfigFields()}
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                        >
                            {connection ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
