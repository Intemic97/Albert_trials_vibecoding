import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { EntityCard } from './components/EntityCard';
import { EntityTableView } from './components/EntityTableView';
import { Reporting } from './components/Reporting';
import { ReportEditor } from './components/ReportEditor';
import { Dashboard } from './components/Dashboard';
import { Overview } from './components/Overview';
import { Workflows } from './components/Workflows';
import { PublicWorkflowForm } from './components/PublicWorkflowForm';
import { LoginPage } from './components/LoginPage';
import { VerifyEmail } from './components/VerifyEmail';
import { AcceptInvite } from './components/AcceptInvite';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { InteractiveTutorial } from './components/InteractiveTutorial';
import { ReportBugModal } from './components/ReportBugModal';
import { Settings } from './components/Settings';
import { SharedDashboard } from './components/SharedDashboard';
import { AdminPanel } from './components/AdminPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Entity, Property, PropertyType } from './types';
import { Plus, Search, Filter, ArrowLeft, Trash2, Link as LinkIcon, Type, Hash, Pencil, X, Code, Paperclip, Download, Loader2, Sparkles } from 'lucide-react';
import { Copilots } from './components/Copilots';
import { LogsAndAlerts } from './components/LogsAndAlerts';
import { Connections } from './components/Connections';
import { Documentation } from './components/Documentation';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Tabs } from './components/Tabs';
import { API_BASE } from './config';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/shared/:shareToken" element={<SharedDashboardWrapper />} />
                <Route path="/*" element={
                    <AuthProvider>
                        <AuthenticatedApp />
                    </AuthProvider>
                } />
            </Routes>
        </BrowserRouter>
    );
}

function SharedDashboardWrapper() {
    const { shareToken } = useParams();
    return <SharedDashboard shareToken={shareToken || ''} />;
}

// Wrapper component to handle entity detail routing
function EntityDetailWrapper({ 
    children, 
    onEntityIdChange 
}: { 
    children: React.ReactNode; 
    onEntityIdChange: (id: string | null) => void;
}) {
    const { entityId } = useParams<{ entityId: string }>();
    
    useEffect(() => {
        if (entityId) {
            onEntityIdChange(entityId);
        }
        return () => {
            // Clean up when leaving the route
            onEntityIdChange(null);
        };
    }, [entityId, onEntityIdChange]);
    
    return <>{children}</>;
}

function AuthenticatedApp() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [entitiesLoading, setEntitiesLoading] = useState(true);
    const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
    const previousUserIdRef = React.useRef<string | undefined>(undefined);
    
    // Tutorial state
    const [showTutorial, setShowTutorial] = useState(false);
    const [showReportBug, setShowReportBug] = useState(false);
    
    // Listen for report bug event from Sidebar
    React.useEffect(() => {
        const handleShowReportBug = () => {
            setShowReportBug(true);
        };
        window.addEventListener('showReportBug', handleShowReportBug);
        return () => window.removeEventListener('showReportBug', handleShowReportBug);
    }, []);
    
    // Track if onboarding was pending to detect when it completes
    const wasOnboardingPendingRef = React.useRef<boolean>(false);

    // Get current view from URL path
    const getCurrentView = () => {
        const path = location.pathname;
        if (path.startsWith('/dashboard')) return 'dashboard';
        if (path.startsWith('/workflow')) return 'workflows';
        if (path.startsWith('/database')) return 'database';
        if (path.startsWith('/templates')) return 'templates';
        if (path.startsWith('/documents')) return 'documents';
        if (path.startsWith('/reports')) return 'reports';
        if (path.startsWith('/copilots')) return 'copilots';
        if (path.startsWith('/logs')) return 'logs';
        if (path.startsWith('/connections')) return 'connections';
        if (path.startsWith('/documentation')) return 'documentation';
        if (path.startsWith('/settings')) return 'settings';
        if (path.startsWith('/admin')) return 'admin';
        return 'overview';
    };

    const currentView = getCurrentView();
    const hideSidebarForRoutes = location.pathname.match(/^\/documents\/[^/]+$/) ||
        location.pathname.match(/^\/workflow\/[^/]+$/) ||
        location.pathname.match(/^\/copilots/) ||
        location.pathname.match(/^\/documentation/);

    // Navigation helper that maps view names to routes
    const handleNavigate = (view: string) => {
        const routes: Record<string, string> = {
            'overview': '/overview',
            'dashboard': '/dashboard',
            'workflows': '/workflows',
            'database': '/database',
            'reports': '/reports',
            'copilots': '/copilots',
            'logs': '/logs',
            'documentation': '/documentation',
            'settings': '/settings',
            'admin': '/admin',
        };
        navigate(routes[view] || '/overview');
    };

    // Reset view to overview when user changes (login/logout) - but not on first load
    useEffect(() => {
        // Only reset if the user ID actually changed (not on initial load)
        if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== user?.id) {
            navigate('/overview');
        }
        previousUserIdRef.current = user?.id;
    }, [user?.id, navigate]);

    // Detect when onboarding completes and show tutorial
    useEffect(() => {
        if (user && !user.onboardingCompleted) {
            // User is in onboarding state, mark it
            wasOnboardingPendingRef.current = true;
        } else if (user && user.onboardingCompleted && wasOnboardingPendingRef.current) {
            // Onboarding just completed - reset the ref and trigger post-onboarding actions
            wasOnboardingPendingRef.current = false;
            
            // Reload entities after onboarding completes
            fetchEntities();
            
            // Show tutorial if user hasn't seen it yet
            const hasSeenTutorial = localStorage.getItem('intemic_tutorial_completed');
            if (!hasSeenTutorial) {
                // Small delay to let the UI settle after onboarding modal closes
                setTimeout(() => setShowTutorial(true), 500);
            }
        }
    }, [user?.onboardingCompleted]);

    // New Entity State
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');

    // Legacy state variables (kept for backward compatibility with old functions)
    const [records, setRecords] = useState<any[]>([]);
    const [newRecordValues, setNewRecordValues] = useState<Record<string, any>>({});
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [relatedData, setRelatedData] = useState<Record<string, { entity: Entity, records: any[] }>>({});
    const [incomingData, setIncomingData] = useState<Record<string, { sourceEntity: Entity, sourceProperty: Property, records: any[] }>>({});
    const [newPropName, setNewPropName] = useState('');
    const [newPropType, setNewPropType] = useState<PropertyType>('text');
    const [newPropRelationId, setNewPropRelationId] = useState<string>('');
    const [isAddingProp, setIsAddingProp] = useState(false);

    // Side Panel State
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [selectedRecordEntity, setSelectedRecordEntity] = useState<Entity | null>(null);

    // Editing Schema State (for editing records from side panel)
    const [editingSchema, setEditingSchema] = useState<Entity | null>(null);

    // Incoming Relation Edit State (for standalone modal - keeping for potential future use)
    const [editingIncomingRelation, setEditingIncomingRelation] = useState<{
        targetRecordId: string;
        sourceEntity: Entity;
        sourceProperty: Property;
        sourceRecords: any[];
        selectedSourceRecordIds: string[];
    } | null>(null);

    // Incoming relations selections when editing a record
    const [editingIncomingSelections, setEditingIncomingSelections] = useState<Record<string, string[]>>({});

    // File Upload State
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

    const activeEntity = entities.find(e => e.id === activeEntityId);

    // File upload handler
    const handleFileUpload = async (propId: string, file: File) => {
        setUploadingFiles(prev => ({ ...prev, [propId]: true }));
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            
            const fileData = await response.json();
            setNewRecordValues(prev => ({
                ...prev,
                [propId]: JSON.stringify(fileData)
            }));
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file');
        } finally {
            setUploadingFiles(prev => ({ ...prev, [propId]: false }));
        }
    };

    // Entity Search State
    const [entitySearchQuery, setEntitySearchQuery] = useState('');

    useEffect(() => {
        if (location.pathname.startsWith('/database')) {
            const params = new URLSearchParams(location.search);
            const query = params.get('q');
            if (query !== null) {
                setEntitySearchQuery(query);
            }
        }
    }, [location.pathname, location.search]);

    // Fetch Entities on Mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchEntities();
        }
    }, [isAuthenticated]);

    // Fetch Records when active entity or tab changes
    // Entity table view now handles all record fetching and management
    // useEffect removed as it's no longer needed

    const fetchEntities = async () => {
        setEntitiesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/entities`, { credentials: 'include' });
            const data = await res.json();
            // Ensure data is an array before setting
            if (Array.isArray(data)) {
                setEntities(data);
            } else {
                console.error('Expected array from entities API, got:', data);
                setEntities([]);
            }
        } catch (error) {
            console.error('Error fetching entities:', error);
            setEntities([]);
        } finally {
            setEntitiesLoading(false);
        }
    };

    const fetchRecords = async () => {
        if (!activeEntityId) return;
        try {
            const res = await fetch(`${API_BASE}/entities/${activeEntityId}/records`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setRecords(data);
            } else {
                console.error('Expected array from records API, got:', data);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            setRecords([]);
        }
    };

    const fetchRelatedData = async () => {
        if (!activeEntity) return;

        const relationProps = activeEntity.properties.filter(p => p.type === 'relation' && p.relatedEntityId);
        const newRelatedData: Record<string, { entity: Entity, records: any[] }> = {};

        for (const prop of relationProps) {
            if (!prop.relatedEntityId) continue;
            try {
                const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);

                if (relatedEntity) {
                    const res = await fetch(`${API_BASE}/entities/${prop.relatedEntityId}/records`, { credentials: 'include' });
                    const records = await res.json();
                    newRelatedData[prop.relatedEntityId] = { entity: relatedEntity, records };
                }
            } catch (error) {
                console.error(`Error fetching related data for ${prop.relatedEntityId}:`, error);
            }
        }
        setRelatedData(newRelatedData);
    };

    const fetchIncomingData = async () => {
        if (!activeEntityId) return;

        const newIncomingData: Record<string, { sourceEntity: Entity, sourceProperty: Property, records: any[] }> = {};

        for (const entity of entities) {
            // Find properties in other entities that point to THIS entity
            const pointingProps = entity.properties.filter(p => p.type === 'relation' && p.relatedEntityId === activeEntityId);

            for (const prop of pointingProps) {
                try {
                    const res = await fetch(`${API_BASE}/entities/${entity.id}/records`, { credentials: 'include' });
                    const records = await res.json();
                    newIncomingData[prop.id] = { sourceEntity: entity, sourceProperty: prop, records };
                } catch (error) {
                    console.error(`Error fetching incoming data from ${entity.name}:`, error);
                }
            }
        }
        setIncomingData(newIncomingData);
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
            await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntity),
                credentials: 'include'
            });

            await fetchEntities();

            // Reset and Close
            setNewEntityName('');
            setNewEntityDescription('');
            setIsCreatingEntity(false);
        } catch (error) {
            console.error('Error creating entity:', error);
        }
    };

    const handleDeleteEntity = async (entity: Entity) => {
        try {
            await fetch(`${API_BASE}/entities/${entity.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchEntities();
        } catch (error) {
            console.error('Error deleting entity:', error);
        }
    };

    const handleAddProperty = async () => {
        if (!newPropName.trim() || !activeEntityId) return;

        const newProp: Property = {
            id: Math.random().toString(36).substr(2, 9),
            name: newPropName,
            type: newPropType,
            relatedEntityId: newPropType === 'relation' ? newPropRelationId : undefined,
            defaultValue: newPropType === 'number' ? 0 : '',
        };

        try {
            await fetch(`${API_BASE}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newProp, entityId: activeEntityId }),
                credentials: 'include'
            });

            // Refresh data
            await fetchEntities();

            // Reset Form
            setNewPropName('');
            setNewPropType('text');
            setNewPropRelationId('');
            setIsAddingProp(false);

        } catch (error) {
            console.error('Error adding property:', error);
        }
    };

    const deleteProperty = async (propId: string) => {
        try {
            await fetch(`${API_BASE}/properties/${propId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchEntities();
        } catch (error) {
            console.error('Error deleting property:', error);
        }
    };

    const handleSaveRecord = async () => {
        const targetEntityId = editingSchema?.id || activeEntityId;
        if (!targetEntityId) return;

        const processedValues = { ...newRecordValues };

        for (const key in processedValues) {
            if (Array.isArray(processedValues[key])) {
                processedValues[key] = JSON.stringify(processedValues[key]);
            }
        }

        try {
            if (editingRecordId) {
                // Update existing record
                await fetch(`${API_BASE}/records/${editingRecordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        values: processedValues
                    }),
                    credentials: 'include'
                });

                // Save incoming relation changes
                for (const [propId, { records: sourceRecords, sourceProperty }] of Object.entries(incomingData)) {
                    const selectedIds = editingIncomingSelections[propId] || [];
                    
                    for (const sourceRecord of sourceRecords) {
                        const currentVal = sourceRecord.values[sourceProperty.id];
                        let currentIds: string[] = [];
                        
                        try {
                            const parsed = JSON.parse(currentVal || '[]');
                            currentIds = Array.isArray(parsed) ? parsed : [];
                        } catch {
                            currentIds = currentVal ? [currentVal] : [];
                        }

                        const isCurrentlyLinked = currentIds.includes(editingRecordId);
                        const shouldBeLinked = selectedIds.includes(sourceRecord.id);

                        if (isCurrentlyLinked !== shouldBeLinked) {
                            let newIds: string[];
                            if (shouldBeLinked) {
                                newIds = [...currentIds, editingRecordId];
                            } else {
                                newIds = currentIds.filter(id => id !== editingRecordId);
                            }

                            await fetch(`${API_BASE}/records/${sourceRecord.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    values: { [sourceProperty.id]: JSON.stringify(newIds) }
                                }),
                                credentials: 'include'
                            });
                        }
                    }
                }
            } else {
                // Create new record
                const createResponse = await fetch(`${API_BASE}/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entityId: targetEntityId,
                        values: processedValues
                    }),
                    credentials: 'include'
                });

                // Save incoming relation changes for new record
                if (createResponse.ok) {
                    const createData = await createResponse.json();
                    const newRecordId = createData.id;

                    if (newRecordId && Object.keys(editingIncomingSelections).length > 0) {
                        for (const [propId, { records: sourceRecords, sourceProperty }] of Object.entries(incomingData)) {
                            const selectedIds = editingIncomingSelections[propId] || [];
                            
                            for (const sourceRecord of sourceRecords) {
                                const shouldBeLinked = selectedIds.includes(sourceRecord.id);

                                if (shouldBeLinked) {
                                    const currentVal = sourceRecord.values[sourceProperty.id];
                                    let currentIds: string[] = [];
                                    
                                    try {
                                        const parsed = JSON.parse(currentVal || '[]');
                                        currentIds = Array.isArray(parsed) ? parsed : [];
                                    } catch {
                                        currentIds = currentVal ? [currentVal] : [];
                                    }

                                    const newIds = [...currentIds, newRecordId];

                                    await fetch(`${API_BASE}/records/${sourceRecord.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            values: { [sourceProperty.id]: JSON.stringify(newIds) }
                                        }),
                                        credentials: 'include'
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Refresh all data to ensure consistency
            if (activeEntityId) {
                await fetchRecords();
                await fetchRelatedData();
                await fetchIncomingData();
            }

            setIsAddingRecord(false);
            setEditingRecordId(null);
            setEditingSchema(null);
            setNewRecordValues({});
            setEditingIncomingSelections({});
        } catch (error) {
            console.error('Error saving record:', error);
        }
    };

    const handleEditRecord = (record: any, entity?: Entity) => {
        const schema = entity || activeEntity;
        if (!schema) return;

        const values: Record<string, any> = {};

        // Parse JSON strings back to arrays for relations if needed
        schema.properties.forEach(prop => {
            const val = record.values[prop.id];
            if (prop.type === 'relation' && val) {
                try {
                    const parsed = JSON.parse(val);
                    values[prop.id] = parsed;
                } catch {
                    values[prop.id] = val;
                }
            } else {
                values[prop.id] = val;
            }
        });

        // Prepare incoming relation selections
        const incomingSelections: Record<string, string[]> = {};
        Object.entries(incomingData).forEach(([propId, { records: sourceRecords, sourceProperty }]) => {
            const linkedRecordIds = sourceRecords
                .filter(r => {
                    const val = r.values[sourceProperty.id];
                    if (!val) return false;
                    try {
                        const ids = JSON.parse(val);
                        return Array.isArray(ids) && ids.includes(record.id);
                    } catch {
                        return val === record.id;
                    }
                })
                .map(r => r.id);
            incomingSelections[propId] = linkedRecordIds;
        });

        setNewRecordValues(values);
        setEditingRecordId(record.id);
        setEditingSchema(schema);
        setEditingIncomingSelections(incomingSelections);
        setIsAddingRecord(true);
    };

    const deleteRecord = async (recordId: string) => {
        try {
            await fetch(`${API_BASE}/records/${recordId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchRecords();
        } catch (error) {
            console.error('Error deleting record:', error);
        }
    };

    // Open incoming relation edit modal
    const openIncomingRelationEdit = (
        targetRecordId: string,
        sourceEntity: Entity,
        sourceProperty: Property,
        sourceRecords: any[]
    ) => {
        // Find which source records currently link to this target record
        const selectedIds = sourceRecords
            .filter(r => {
                const val = r.values[sourceProperty.id];
                if (!val) return false;
                try {
                    const ids = JSON.parse(val);
                    return Array.isArray(ids) && ids.includes(targetRecordId);
                } catch {
                    return val === targetRecordId;
                }
            })
            .map(r => r.id);

        setEditingIncomingRelation({
            targetRecordId,
            sourceEntity,
            sourceProperty,
            sourceRecords,
            selectedSourceRecordIds: selectedIds
        });
    };

    // Save incoming relation changes
    const saveIncomingRelationChanges = async () => {
        if (!editingIncomingRelation) return;

        const { targetRecordId, sourceProperty, sourceRecords, selectedSourceRecordIds } = editingIncomingRelation;

        try {
            // For each source record, update its relation value
            for (const sourceRecord of sourceRecords) {
                const currentVal = sourceRecord.values[sourceProperty.id];
                let currentIds: string[] = [];
                
                try {
                    const parsed = JSON.parse(currentVal || '[]');
                    currentIds = Array.isArray(parsed) ? parsed : [];
                } catch {
                    currentIds = currentVal ? [currentVal] : [];
                }

                const isCurrentlyLinked = currentIds.includes(targetRecordId);
                const shouldBeLinked = selectedSourceRecordIds.includes(sourceRecord.id);

                if (isCurrentlyLinked !== shouldBeLinked) {
                    let newIds: string[];
                    if (shouldBeLinked) {
                        // Add targetRecordId to this source record's relation
                        newIds = [...currentIds, targetRecordId];
                    } else {
                        // Remove targetRecordId from this source record's relation
                        newIds = currentIds.filter(id => id !== targetRecordId);
                    }

                    // Update the source record
                    await fetch(`${API_BASE}/records/${sourceRecord.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            values: { [sourceProperty.id]: JSON.stringify(newIds) }
                        }),
                        credentials: 'include'
                    });
                }
            }

            // Refresh data
            await fetchRecords();
            await fetchIncomingData();
            setEditingIncomingRelation(null);
        } catch (error) {
            console.error('Error saving incoming relation:', error);
            alert('Failed to save changes');
        }
    };

    const getRelatedEntityName = (id?: string) => {
        if (!id) return 'Unknown';
        const found = entities.find(e => e.id === id);
        return found ? found.name : 'Deleted Entity';
    };

    const getRecordDisplayName = (record: any, entity: Entity) => {
        // 1. Try to find a property named "name" or "title"
        const nameProp = entity.properties.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
        if (nameProp && record.values[nameProp.id]) {
            return record.values[nameProp.id];
        }

        // 2. Fallback to the first "text" property
        const firstTextProp = entity.properties.find(p => p.type === 'text');
        if (firstTextProp && record.values[firstTextProp.id]) {
            return record.values[firstTextProp.id];
        }

        // 3. Fallback to the first "number" property
        const firstNumberProp = entity.properties.find(p => p.type === 'number');
        if (firstNumberProp && record.values[firstNumberProp.id]) {
            return record.values[firstNumberProp.id];
        }

        return 'Untitled Record';
    };

    const handleRecordClick = (record: any, entity: Entity) => {
        setSelectedRecord(record);
        setSelectedRecordEntity(entity);
    };

    const renderCellValue = (prop: Property, value: any) => {
        if (!value) return '-';

        if (prop.type === 'json') {
            return (
                <div className="font-mono text-xs text-slate-600 bg-slate-100 p-1 rounded truncate max-w-[200px]" title={typeof value === 'string' ? value : JSON.stringify(value)}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                </div>
            );
        }

        if (prop.type === 'file') {
            try {
                const fileData = typeof value === 'string' ? JSON.parse(value) : value;
                if (fileData && fileData.filename) {
                    return (
                        <a
                            href={`${API_BASE}/files/${fileData.filename}/download?originalName=${encodeURIComponent(fileData.originalName || fileData.filename)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors gap-1"
                        >
                            <Paperclip size={12} />
                            {fileData.originalName || fileData.filename}
                            <Download size={12} />
                        </a>
                    );
                }
            } catch (e) {
                return value;
            }
        }

        if (prop.type === 'relation' && prop.relatedEntityId) {
            try {
                const ids = JSON.parse(value);
                if (Array.isArray(ids)) {
                    const relatedInfo = relatedData[prop.relatedEntityId];
                    if (!relatedInfo) return 'Loading...';

                    return (
                        <div className="flex flex-wrap gap-1">
                            {ids.map(id => {
                                const rec = relatedInfo.records.find(r => r.id === id);
                                return (
                                    <button
                                        key={id}
                                        onClick={() => rec && handleRecordClick(rec, relatedInfo.entity)}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors"
                                    >
                                        {rec ? getRecordDisplayName(rec, relatedInfo.entity) : 'Unknown'}
                                    </button>
                                );
                            })}
                        </div>
                    );
                }
            } catch (e) {
                return value;
            }
        }
        return value;
    };

    const renderIconForType = (type: PropertyType) => {
        switch (type) {
            case 'text': return <Type size={16} className="text-slate-400" />;
            case 'number': return <Hash size={16} className="text-slate-400" />;
            case 'relation': return <LinkIcon size={16} className="text-teal-500" />;
            case 'json': return <Code size={16} className="text-amber-500" />;
            case 'file': return <Paperclip size={16} className="text-purple-500" />;
        }
    };

    const currentSchema = editingSchema || activeEntity;

    if (isLoading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
    }

    // These routes should be accessible regardless of authentication status
    const currentPath = location.pathname;
    const publicPaths = ['/verify-email', '/invite', '/forgot-password', '/reset-password', '/form'];
    const isPublicPath = publicPaths.some(path => currentPath.startsWith(path));

    if (isPublicPath) {
        return (
            <Routes>
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/invite" element={<AcceptInvite />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/form/:workflowId" element={<PublicWorkflowForm />} />
                <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
        );
    }

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="*" element={<LoginPage />} />
            </Routes>
        );
    }

    // Show onboarding modal for new users who haven't completed it
    const showOnboarding = user && !user.onboardingCompleted;

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 text-[15px]">
            {showOnboarding && (
                <OnboardingModal onComplete={() => {
                    // Post-onboarding actions (fetchEntities + tutorial) are handled by 
                    // the useEffect that watches user.onboardingCompleted to avoid race conditions
                }} />
            )}
            
            {showTutorial && (
                <InteractiveTutorial 
                    onComplete={() => {
                        localStorage.setItem('intemic_tutorial_completed', 'true');
                        setShowTutorial(false);
                        // Dispatch event so Settings can update its toggle
                        window.dispatchEvent(new Event('tutorialCompleted'));
                    }}
                    onSkip={() => {
                        localStorage.setItem('intemic_tutorial_completed', 'true');
                        setShowTutorial(false);
                        // Dispatch event so Settings can update its toggle
                        window.dispatchEvent(new Event('tutorialCompleted'));
                    }}
                />
            )}
            
            <ReportBugModal 
                isOpen={showReportBug} 
                onClose={() => setShowReportBug(false)} 
            />
            
            {/* Hide sidebar when in report editor, workflow editor, workflows, or copilots for more space */}
            {!hideSidebarForRoutes && (
                <Sidebar 
                    activeView={currentView} 
                    onNavigate={handleNavigate}
                    onShowTutorial={() => setShowTutorial(true)}
                />
            )}

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {!hideSidebarForRoutes && (
                    <TopNav activeView={currentView} />
                )}
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <Routes>
                    <Route path="/" element={<Navigate to="/overview" replace />} />
                    <Route path="/overview" element={
                        <Overview
                            entities={entities}
                            entitiesLoading={entitiesLoading}
                            onViewChange={handleNavigate}
                        />
                    } />
                    <Route path="/dashboard/:dashboardId?" element={
                        <Dashboard
                            entities={entities}
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate('/database');
                            }}
                            onViewChange={handleNavigate}
                        />
                    } />
                    <Route path="/workflows" element={
                        <Workflows entities={entities} onViewChange={handleNavigate} />
                    } />
                    <Route path="/workflow/:workflowId" element={
                        <Workflows entities={entities} onViewChange={handleNavigate} />
                    } />
                    <Route path="/templates" element={
                        <Reporting entities={entities} companyInfo={undefined} onViewChange={handleNavigate} view="templates" />
                    } />
                    <Route path="/documents" element={
                        <Reporting entities={entities} companyInfo={undefined} onViewChange={handleNavigate} view="documents" />
                    } />
                    <Route path="/reports" element={
                        <Reporting entities={entities} companyInfo={undefined} onViewChange={handleNavigate} view="reports" />
                    } />
                    <Route path="/documents/:reportId" element={
                        <ReportEditor entities={entities} companyInfo={undefined} onViewChange={handleNavigate} />
                    } />
                    <Route path="/copilots" element={
                        <Copilots />
                    } />
                    <Route path="/logs" element={
                        <LogsAndAlerts />
                    } />
                    <Route path="/connections" element={
                        <Connections />
                    } />
                    <Route path="/documentation" element={
                        <Documentation />
                    } />
                    <Route path="/settings" element={
                        <Settings onViewChange={handleNavigate} onShowTutorial={() => setShowTutorial(true)} />
                    } />
                    <Route path="/admin" element={
                        <AdminPanel onNavigate={handleNavigate} />
                    } />
                    <Route path="/database" element={
                        <KnowledgeBase 
                            entities={entities}
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                            onRefreshEntities={fetchEntities}
                        />
                    } />
                    <Route path="/database/:entityId" element={
                    <EntityDetailWrapper onEntityIdChange={setActiveEntityId}>
                    <div data-tutorial="database-content" className="contents">
                        {/* Top Header */}
                        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
                            {activeEntity ? (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => {
                                            setActiveEntityId(null);
                                            navigate('/database');
                                        }}
                                        className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h1 className="text-lg font-normal text-slate-900">
                                            {activeEntity.name}
                                        </h1>
                                        <p className="text-[11px] text-slate-500">Managing structure properties</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Your database</h1>
                                    <p className="text-[11px] text-slate-500">View and manage your different entities</p>
                                </div>
                            )}

                            <div />
                        </header>

                        {/* Content Area */}
                        <div data-tutorial="database-main" className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                            {/* LIST VIEW */}
                            {!activeEntityId && (
                                <div>
                                    {/* Toolbar */}
                                    <div className="flex justify-between items-center mb-6">
                                                <div className="text-sm text-slate-500">
                                                    {entitySearchQuery 
                                                        ? `Showing ${entities.filter(e => e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) || e.description?.toLowerCase().includes(entitySearchQuery.toLowerCase())).length} of ${entities.length} entities`
                                                        : `Total: ${entities.length} entities`
                                                    }
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                        <input
                                                            type="text"
                                                            placeholder="Search entities..."
                                                            value={entitySearchQuery}
                                                            onChange={(e) => setEntitySearchQuery(e.target.value)}
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

                                            {/* Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                                {entities
                                                    .filter(entity => 
                                                        entity.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) ||
                                                        entity.description?.toLowerCase().includes(entitySearchQuery.toLowerCase())
                                                    )
                                                    .map(entity => (
                                                    <EntityCard
                                                        key={entity.id}
                                                        entity={entity}
                                                        onClick={(e) => {
                                                            setActiveEntityId(e.id);
                                                        }}
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

                                </div>
                            )}

                            {/* DETAIL VIEW - Notion-style Table */}
                            {activeEntity && (
                                <div className="max-w-7xl mx-auto">
                                    <EntityTableView 
                                        entity={activeEntity}
                                        entities={entities}
                                        onUpdate={fetchEntities}
                                    />
                                </div>
                            )}

                        </div>
                    </div>
                    </EntityDetailWrapper>
                    } />
                </Routes>
                </main>
            </div>
        </div>
    );
}
