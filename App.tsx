import React, { useState, useEffect, useRef, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { EntityCard } from './components/EntityCard';
import { LoginPage } from './components/LoginPage';
import { VerifyEmail } from './components/VerifyEmail';
import { AcceptInvite } from './components/AcceptInvite';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { ReportBugModal } from './components/ReportBugModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Entity, Property, PropertyType } from './types';
import { Plus, MagnifyingGlass, Funnel, ArrowLeft, Trash, Link as LinkIcon, TextT, Hash, PencilSimple, X, Code, Paperclip, Download, SpinnerGap, Sparkle } from '@phosphor-icons/react';
import { Tabs } from './components/Tabs';
import { API_BASE } from './config';

// Lazy-loaded components for better performance
const Workflows = React.lazy(() => import('./components/Workflows').then(m => ({ default: m.Workflows })));
const ReportEditor = React.lazy(() => import('./components/ReportEditor').then(m => ({ default: m.ReportEditor })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Overview = React.lazy(() => import('./components/Overview').then(m => ({ default: m.Overview })));
const Reporting = React.lazy(() => import('./components/Reporting').then(m => ({ default: m.Reporting })));
const Copilots = React.lazy(() => import('./components/Copilots').then(m => ({ default: m.Copilots })));
const KnowledgeBase = React.lazy(() => import('./components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const Simulations = React.lazy(() => import('./components/Simulations').then(m => ({ default: m.Simulations })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const LogsAndAlerts = React.lazy(() => import('./components/LogsAndAlerts').then(m => ({ default: m.LogsAndAlerts })));
const Connections = React.lazy(() => import('./components/Connections').then(m => ({ default: m.Connections })));
const Documentation = React.lazy(() => import('./components/Documentation').then(m => ({ default: m.Documentation })));
const SharedDashboard = React.lazy(() => import('./components/SharedDashboard').then(m => ({ default: m.SharedDashboard })));
const PublicWorkflowForm = React.lazy(() => import('./components/PublicWorkflowForm').then(m => ({ default: m.PublicWorkflowForm })));
const InteractiveTutorial = React.lazy(() => import('./components/InteractiveTutorial').then(m => ({ default: m.InteractiveTutorial })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <SpinnerGap className="w-8 h-8 animate-spin text-[var(--text-tertiary)]" weight="light" />
      <span className="text-sm text-[var(--text-tertiary)]">Loading...</span>
    </div>
  </div>
);

export default function App() {
    return (
        <ThemeProvider>
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
        </ThemeProvider>
    );
}

function SharedDashboardWrapper() {
    const { shareToken } = useParams();
    return (
        <Suspense fallback={<PageLoader />}>
            <SharedDashboard shareToken={shareToken || ''} />
        </Suspense>
    );
}

function AuthenticatedApp() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [entitiesLoading, setEntitiesLoading] = useState(true);
    const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
    const previousUserIdRef = React.useRef<string | undefined>(undefined);
    
    // Command Palette (Cmd+K)
    const commandPalette = useCommandPalette();
    
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
        if (path.startsWith('/simulations')) return 'simulations';
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
            'simulations': '/simulations',
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

    // New Property State
    const [isAddingProp, setIsAddingProp] = useState(false);
    const [newPropName, setNewPropName] = useState('');
    const [newPropType, setNewPropType] = useState<PropertyType>('text');
    const [newPropRelationId, setNewPropRelationId] = useState<string>('');

    // New Entity State
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');

    // Records State
    const [activeTab, setActiveTab] = useState<'structure' | 'data'>('structure');
    const [records, setRecords] = useState<any[]>([]);
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [newRecordValues, setNewRecordValues] = useState<Record<string, any>>({});

    // Relations State
    const [relatedData, setRelatedData] = useState<Record<string, { entity: Entity, records: any[] }>>({});
    const [incomingData, setIncomingData] = useState<Record<string, { sourceEntity: Entity, sourceProperty: Property, records: any[] }>>({});

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
    useEffect(() => {
        if (activeEntityId && activeTab === 'data') {
            fetchRecords();
            fetchRelatedData();
            fetchIncomingData();
        }
    }, [activeEntityId, activeTab]);

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
                            <Paperclip size={12} weight="light" />
                            {fileData.originalName || fileData.filename}
                            <Download size={12} weight="light" />
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
            case 'text': return <TextT size={16} className="text-slate-400" weight="light" />;
            case 'number': return <Hash size={16} className="text-slate-400" weight="light" />;
            case 'relation': return <LinkIcon size={16} className="text-teal-500" weight="light" />;
            case 'json': return <Code size={16} className="text-amber-500" weight="light" />;
            case 'file': return <Paperclip size={16} className="text-purple-500" weight="light" />;
        }
    };

    const currentSchema = editingSchema || activeEntity;

    if (isLoading) {
        return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-primary)] transition-colors duration-200">Loading...</div>;
    }

    // These routes should be accessible regardless of authentication status
    const currentPath = location.pathname;
    const publicPaths = ['/verify-email', '/invite', '/forgot-password', '/reset-password', '/form'];
    const isPublicPath = publicPaths.some(path => currentPath.startsWith(path));

    if (isPublicPath) {
        return (
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/invite" element={<AcceptInvite />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/form/:workflowId" element={<PublicWorkflowForm />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                </Routes>
            </Suspense>
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
        <div className="flex min-h-screen bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] text-[15px] transition-colors duration-200">
            {showOnboarding && (
                <OnboardingModal onComplete={() => {
                    // Post-onboarding actions (fetchEntities + tutorial) are handled by 
                    // the useEffect that watches user.onboardingCompleted to avoid race conditions
                }} />
            )}
            
            {showTutorial && (
                <Suspense fallback={<PageLoader />}>
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
                </Suspense>
            )}
            
            <ReportBugModal 
                isOpen={showReportBug} 
                onClose={() => setShowReportBug(false)} 
            />
            
            {/* Command Palette (Cmd+K) */}
            <CommandPalette 
                isOpen={commandPalette.isOpen} 
                onClose={commandPalette.close} 
                entities={entities}
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
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[var(--bg-primary)] transition-colors duration-200">
                <Suspense fallback={<PageLoader />}>
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
                                setActiveTab('data');
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
                    <Route path="/simulations" element={
                        <Simulations 
                            entities={entities} 
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                        />
                    } />
                    <Route path="/simulations/:simulationId" element={
                        <Simulations 
                            entities={entities} 
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                        />
                    } />
                    <Route path="/simulations/:simulationId/scenarios/:scenarioId" element={
                        <Simulations 
                            entities={entities} 
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                        />
                    } />
                    <Route path="/database" element={
                        <KnowledgeBase 
                            entities={entities}
                            onNavigate={(entityId) => {
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                        />
                    } />
                    <Route path="/database/:entityId" element={
                    <div data-tutorial="database-content" className="contents">
                        {/* Top Header */}
                        <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-8 z-10">
                            {activeEntity ? (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setActiveEntityId(null)}
                                        className="mr-4 p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors text-[var(--text-secondary)]"
                                    >
                                        <ArrowLeft size={20} weight="light" />
                                    </button>
                                    <div>
                                        <h1 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                            {activeEntity.name}
                                        </h1>
                                        <p className="text-[11px] text-[var(--text-secondary)]">Managing structure properties</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Your database</h1>
                                    <p className="text-[11px] text-[var(--text-secondary)]">View and manage your different entities</p>
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
                                                <div className="text-sm text-[var(--text-secondary)]">
                                                    {entitySearchQuery 
                                                        ? `Showing ${entities.filter(e => e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) || e.description?.toLowerCase().includes(entitySearchQuery.toLowerCase())).length} of ${entities.length} entities`
                                                        : `Total: ${entities.length} entities`
                                                    }
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search entities..."
                                                            value={entitySearchQuery}
                                                            onChange={(e) => setEntitySearchQuery(e.target.value)}
                                                            className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#256A65] focus:border-[#256A65] w-60 placeholder:text-[var(--text-tertiary)]"
                                                        />
                                                    </div>
                                                    <button className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                                        <Funnel size={14} className="mr-2" weight="light" />
                                                        Filter
                                                    </button>
                                                    <button
                                                        onClick={() => setIsCreatingEntity(true)}
                                                        className="flex items-center px-3 py-1.5 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                                    >
                                                        <Plus size={14} className="mr-2" weight="light" />
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
                                                            setActiveTab('data');
                                                        }}
                                                        onDelete={handleDeleteEntity}
                                                    />
                                                ))}

                                                {/* Empty State / Add New Placeholder */}
                                                <div
                                                    onClick={() => setIsCreatingEntity(true)}
                                                    className="border-2 border-dashed border-[var(--border-medium)] rounded-xl flex flex-col items-center justify-center min-h-[200px] text-[var(--text-tertiary)] hover:border-[#256A65] hover:text-[#256A65] hover:bg-[#256A65]/5 transition-all cursor-pointer group"
                                                >
                                                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-full mb-3 group-hover:bg-[var(--bg-card)]">
                                                        <Plus size={24} weight="light" />
                                                    </div>
                                                    <span className="font-medium">Create new entity</span>
                                                </div>
                                            </div>

                                </div>
                            )}

                            {/* DETAIL VIEW */}
                            {activeEntity && (
                                <div className="max-w-6xl mx-auto space-y-8">

                                    {/* Tab Switcher */}
                                    <Tabs
                                        items={[
                                            { id: 'structure', label: 'Structure & Properties' },
                                            { id: 'data', label: 'Data Records' }
                                        ]}
                                        activeTab={activeTab}
                                        onChange={setActiveTab}
                                    />

                                    {/* STRUCTURE TAB */}
                                    {activeTab === 'structure' && (
                                        <>
                                            {/* Overview Panel */}
                                            <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] p-6">
                                                <h2 className="text-lg font-normal text-[var(--text-primary)] mb-4" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Structure Overview</h2>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Description</label>
                                                        <p className="text-[var(--text-secondary)]">{activeEntity.description || 'No description provided.'}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Metadata</label>
                                                        <div className="text-sm text-[var(--text-secondary)] space-y-1">
                                                            <p>Created by: <span className="font-medium text-[var(--text-primary)]">{activeEntity.author}</span></p>
                                                            <p>Last modified: <span className="font-medium text-[var(--text-primary)]">{activeEntity.lastEdited}</span></p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Properties Panel */}
                                            <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden">
                                                <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                                                    <div>
                                                        <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Properties</h2>
                                                        <p className="text-sm text-[var(--text-secondary)]">Define the data structure for this entity.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsAddingProp(true)}
                                                        className="flex items-center px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                                    >
                                                        <Plus size={16} className="mr-2" weight="light" />
                                                        Add Property
                                                    </button>
                                                </div>
                                                {/* Property List */}
                                                <div className="divide-y divide-[var(--border-light)]">
                                                    {activeEntity.properties.length === 0 ? (
                                                        <div className="p-12 text-center text-[var(--text-secondary)]">
                                                            No properties defined yet. Click "Add Property" to start modeling.
                                                        </div>
                                                    ) : (
                                                        activeEntity.properties.map(prop => (
                                                            <div key={prop.id} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-light)]">
                                                                        {renderIconForType(prop.type)}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-sm font-normal text-[var(--text-primary)]">{prop.name}</h3>
                                                                        <p className="text-xs text-[var(--text-tertiary)] flex items-center mt-0.5">
                                                                            <span className="uppercase tracking-wider font-normal mr-2">{prop.type}</span>
                                                                            {prop.type === 'relation' && (
                                                                                <span className="bg-[#256A65]/10 text-[#256A65] px-1.5 rounded text-[10px]">
                                                                                    → {getRelatedEntityName(prop.relatedEntityId)}
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="text-xs text-right text-[var(--text-tertiary)] mr-4">
                                                                        Example Value:<br />
                                                                        <span className="text-[var(--text-secondary)] font-mono">
                                                                            {prop.type === 'relation' ? 'ID-REF-123' : prop.type === 'file' ? 'document.pdf' : prop.defaultValue}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => deleteProperty(prop.id)}
                                                                        className="p-2 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash size={16} weight="light" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Add Property Form Area */}
                                                {isAddingProp && (
                                                    <div className="p-6 bg-[var(--bg-tertiary)] border-t border-[var(--border-light)] animate-in fade-in slide-in-from-top-4 duration-200">
                                                        <h3 className="text-sm font-normal text-[var(--text-primary)] mb-4">New Property</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                                            <div className="md:col-span-4">
                                                                <label className="block text-xs font-normal text-[var(--text-tertiary)] mb-1">Name</label>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    value={newPropName}
                                                                    onChange={(e) => setNewPropName(e.target.value)}
                                                                    placeholder="e.g. Serial Number"
                                                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#256A65] focus:border-[#256A65] focus:outline-none placeholder:text-[var(--text-tertiary)]"
                                                                />
                                                            </div>
                                                            <div className="md:col-span-3">
                                                                <label className="block text-xs font-normal text-[var(--text-tertiary)] mb-1">Type</label>
                                                                <select
                                                                    value={newPropType}
                                                                    onChange={(e) => setNewPropType(e.target.value as PropertyType)}
                                                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#256A65] focus:border-[#256A65] focus:outline-none"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="number">Number</option>
                                                                    <option value="json">JSON</option>
                                                                    <option value="relation">Relation</option>
                                                                    <option value="file">File</option>
                                                                </select>
                                                            </div>

                                                            {newPropType === 'relation' && (
                                                                <div className="md:col-span-3">
                                                                    <label className="block text-xs font-normal text-[var(--text-tertiary)] mb-1">Related Structure</label>
                                                                    <select
                                                                        value={newPropRelationId}
                                                                        onChange={(e) => setNewPropRelationId(e.target.value)}
                                                                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#256A65] focus:border-[#256A65] focus:outline-none"
                                                                    >
                                                                        <option value="">Select entity...</option>
                                                                        {entities
                                                                            .filter(e => e.id !== activeEntity.id) // Prevent self-reference for simplicity
                                                                            .map(e => (
                                                                                <option key={e.id} value={e.id}>{e.name}</option>
                                                                            ))}
                                                                    </select>
                                                                </div>
                                                            )}

                                                            <div className="md:col-span-2 flex space-x-2">
                                                                <button
                                                                    onClick={handleAddProperty}
                                                                    disabled={!newPropName || (newPropType === 'relation' && !newPropRelationId)}
                                                                    className="flex-1 py-2 bg-[#256A65] text-white rounded-md text-sm font-medium hover:bg-[#1e5a55] disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsAddingProp(false)}
                                                                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)] rounded-md text-sm font-medium hover:bg-[var(--bg-tertiary)]"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* DATA TAB */}
                                    {activeTab === 'data' && (
                                        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-light)] overflow-hidden">
                                            <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                                                <div>
                                                    <h2 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Data Records</h2>
                                                    <p className="text-sm text-[var(--text-secondary)]">Manage the actual data for this entity.</p>
                                                </div>
                                                <div className="relative group/addrecord">
                                                    <button
                                                        onClick={() => {
                                                            setEditingRecordId(null);
                                                            setNewRecordValues({});
                                                            setIsAddingRecord(true);
                                                        }}
                                                        disabled={activeEntity.properties.length === 0}
                                                        className="flex items-center px-4 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Plus size={16} className="mr-2" weight="light" />
                                                        Add Record
                                                    </button>
                                                    {activeEntity.properties.length === 0 && (
                                                        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[var(--bg-selected)] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/addrecord:opacity-100 transition-opacity pointer-events-none z-50">
                                                            Add properties to your entity to start adding records
                                                            <div className="absolute bottom-full right-4 border-4 border-transparent border-b-[var(--bg-selected)]"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--border-light)]">
                                                            {activeEntity.properties.map(prop => (
                                                                <th key={prop.id} className="px-6 py-3 text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wider">
                                                                    {prop.name}
                                                                </th>
                                                            ))}
                                                            {/* Incoming Relations Headers */}
                                                            {Object.values(incomingData).map(({ sourceEntity, sourceProperty }) => (
                                                                <th key={sourceProperty.id} className="px-6 py-3 text-xs font-normal text-[#256A65] uppercase tracking-wider bg-[#256A65]/5">
                                                                    {sourceEntity.name} ({sourceProperty.name})
                                                                </th>
                                                            ))}
                                                            <th className="px-6 py-3 text-right text-[var(--text-tertiary)]">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--border-light)]">
                                                        {records.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={Math.max(activeEntity.properties.length, 1) + 1 + Object.keys(incomingData).length} className="p-12 text-center text-[var(--text-secondary)]">
                                                                    {activeEntity.properties.length === 0 
                                                                        ? 'Add properties to your entity first, then you can start adding records.'
                                                                        : 'No records found. Click "Add Record" to create one.'}
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            records.map(record => (
                                                                <tr key={record.id} className="hover:bg-[var(--bg-tertiary)] transition-colors group">
                                                                    {activeEntity.properties.map(prop => (
                                                                        <td key={prop.id} className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                                                            {renderCellValue(prop, record.values[prop.id])}
                                                                        </td>
                                                                    ))}
                                                                    {/* Incoming Relations Cells */}
                                                                    {Object.values(incomingData).map(({ sourceEntity, sourceProperty, records: sourceRecords }) => {
                                                                        const linkedRecords = sourceRecords.filter(r => {
                                                                            const val = r.values[sourceProperty.id];
                                                                            if (!val) return false;
                                                                            try {
                                                                                const ids = JSON.parse(val);
                                                                                return Array.isArray(ids) && ids.includes(record.id);
                                                                            } catch {
                                                                                return val === record.id;
                                                                            }
                                                                        });

                                                                        return (
                                                                            <td key={sourceProperty.id} className="px-6 py-4 text-sm text-[var(--text-secondary)] bg-[#256A65]/5">
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {linkedRecords.length > 0 ? linkedRecords.map(lr => (
                                                                                        <button
                                                                                            key={lr.id}
                                                                                            onClick={() => handleRecordClick(lr, sourceEntity)}
                                                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#256A65]/10 text-[#256A65] border border-[#256A65]/20 hover:bg-[#256A65]/20 transition-colors"
                                                                                        >
                                                                                            {getRecordDisplayName(lr, sourceEntity)}
                                                                                        </button>
                                                                                    )) : <span className="text-[var(--text-tertiary)] text-xs italic">None</span>}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button
                                                                            onClick={() => handleEditRecord(record)}
                                                                            className="p-2 text-[var(--text-tertiary)] hover:text-[#256A65] hover:bg-[#256A65]/10 rounded transition-colors opacity-0 group-hover:opacity-100 mr-2"
                                                                        >
                                                                            <PencilSimple size={16} weight="light" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteRecord(record.id)}
                                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash size={16} weight="light" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Side Panel for Record Details */}
                        {selectedRecord && selectedRecordEntity && (
                            <div className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h2 className="text-lg font-normal text-slate-800">
                                            {getRecordDisplayName(selectedRecord, selectedRecordEntity)}
                                        </h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-normal mt-1">
                                            {selectedRecordEntity.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {
                                                handleEditRecord(selectedRecord, selectedRecordEntity);
                                                setSelectedRecord(null);
                                            }}
                                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                        <button
                                            onClick={() => setSelectedRecord(null)}
                                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                                        >
                                            <X size={20} weight="light" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {selectedRecordEntity.properties.map(prop => (
                                        <div key={prop.id}>
                                            <label className="block text-xs font-normal text-slate-500 uppercase tracking-wide mb-1">
                                                {prop.name}
                                            </label>
                                            <div className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                {prop.type === 'relation' ? (
                                                    renderCellValue(prop, selectedRecord.values[prop.id])
                                                ) : (
                                                    selectedRecord.values[prop.id] || '-'
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="block text-xs font-normal text-slate-400 uppercase tracking-wide mb-1">
                                            Record ID
                                        </label>
                                        <p className="text-xs font-mono text-slate-400">{selectedRecord.id}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Create Entity Modal */}
                        {isCreatingEntity && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg border border-slate-200 shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                                        <h2 className="text-sm font-normal text-slate-700">Create New Entity</h2>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Entity Name</label>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newEntityName}
                                                onChange={(e) => setNewEntityName(e.target.value)}
                                                placeholder="e.g. Products"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-300 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                                            <textarea
                                                value={newEntityDescription}
                                                onChange={(e) => setNewEntityDescription(e.target.value)}
                                                placeholder="Describe what this entity represents..."
                                                rows={3}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-300 focus:outline-none resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/50">
                                        <button
                                            onClick={() => setIsCreatingEntity(false)}
                                            className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateEntity}
                                            disabled={!newEntityName.trim()}
                                            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Create Entity
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add/Edit Record Modal */}
                        {isAddingRecord && currentSchema && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-normal text-slate-800 mb-4">{editingRecordId ? 'Edit Record' : 'Add New Record'}</h2>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {currentSchema.properties.map(prop => {
                                            if (prop.type === 'relation' && prop.relatedEntityId) {
                                                const relatedInfo = relatedData[prop.relatedEntityId];
                                                return (
                                                    <div key={prop.id}>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{prop.name}</label>
                                                        <select
                                                            multiple
                                                            value={newRecordValues[prop.id] || []}
                                                            onChange={(e) => {
                                                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                                                setNewRecordValues({ ...newRecordValues, [prop.id]: selectedOptions });
                                                            }}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-1 focus:ring-slate-300 focus:border-slate-300 focus:outline-none min-h-[100px] appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                                        >
                                                            {relatedInfo?.records.map(rec => (
                                                                <option key={rec.id} value={rec.id}>
                                                                    {getRecordDisplayName(rec, relatedInfo.entity)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                                    </div>
                                                );
                                            }
                                            if (prop.type === 'file') {
                                                const currentFile = newRecordValues[prop.id];
                                                let fileInfo = null;
                                                try {
                                                    fileInfo = currentFile ? JSON.parse(currentFile) : null;
                                                } catch (e) {}
                                                
                                                return (
                                                    <div key={prop.id}>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{prop.name}</label>
                                                        <div className="space-y-2">
                                                            {fileInfo && (
                                                                <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                                                    <Paperclip size={16} className="text-purple-500" weight="light" />
                                                                    <span className="text-sm text-purple-800 truncate flex-1">
                                                                        {fileInfo.originalName || fileInfo.filename}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNewRecordValues({ ...newRecordValues, [prop.id]: '' })}
                                                                        className="p-1 hover:bg-purple-200 rounded transition-colors"
                                                                    >
                                                                        <X size={14} className="text-purple-600" weight="light" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleFileUpload(prop.id, file);
                                                                    }}
                                                                    className="hidden"
                                                                    id={`file-input-${prop.id}`}
                                                                    disabled={uploadingFiles[prop.id]}
                                                                />
                                                                <label
                                                                    htmlFor={`file-input-${prop.id}`}
                                                                    className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors ${uploadingFiles[prop.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {uploadingFiles[prop.id] ? (
                                                                        <>
                                                                            <SpinnerGap size={16} className="animate-spin text-purple-500" weight="light" />
                                                                            <span className="text-sm text-slate-500">Uploading...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Paperclip size={16} className="text-slate-400" weight="light" />
                                                                            <span className="text-sm text-slate-500">
                                                                                {fileInfo ? 'Replace file' : 'Choose file'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </label>
                                                            </div>
                                                            <p className="text-xs text-slate-500">PDF, Word, Excel, images, or text files (max 50MB)</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={prop.id}>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">{prop.name}</label>
                                                    {prop.type === 'json' ? (
                                                        <textarea
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter valid JSON for ${prop.name}...`}
                                                            rows={4}
                                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono text-sm"
                                                        />
                                                    ) : (
                                                        <input
                                                            type={prop.type === 'number' ? 'number' : 'text'}
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter ${prop.name}...`}
                                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Incoming Relations Section */}
                                        {Object.keys(incomingData).length > 0 && (
                                            <>
                                                <div className="border-t border-slate-200 pt-4 mt-4">
                                                    <p className="text-xs font-normal text-indigo-600 uppercase tracking-wide mb-3">
                                                        Incoming Relations
                                                    </p>
                                                </div>
                                                {Object.entries(incomingData).map(([propId, { sourceEntity, sourceProperty, records: sourceRecords }]) => (
                                                    <div key={propId}>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            {sourceEntity.name} <span className="text-slate-400 font-normal">({sourceProperty.name})</span>
                                                        </label>
                                                        <select
                                                            multiple
                                                            value={editingIncomingSelections[propId] || []}
                                                            onChange={(e) => {
                                                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                                                setEditingIncomingSelections(prev => ({
                                                                    ...prev,
                                                                    [propId]: selectedOptions
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px]"
                                                        >
                                                            {sourceRecords.map(rec => (
                                                                <option key={rec.id} value={rec.id}>
                                                                    {getRecordDisplayName(rec, sourceEntity)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6">
                                        <button
                                            onClick={() => { setIsAddingRecord(false); setNewRecordValues({}); setEditingRecordId(null); setEditingSchema(null); setEditingIncomingSelections({}); }}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveRecord}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                        >
                                            {editingRecordId ? 'Save Changes' : 'Add Record'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Edit Incoming Relation Modal */}
                        {editingIncomingRelation && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-normal text-slate-800 mb-2">
                                        Edit Relation
                                    </h2>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Select which <span className="font-medium text-indigo-600">{editingIncomingRelation.sourceEntity.name}</span> records 
                                        should link to this record via <span className="font-medium">{editingIncomingRelation.sourceProperty.name}</span>
                                    </p>

                                    <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                        {editingIncomingRelation.sourceRecords.length === 0 ? (
                                            <div className="p-4 text-center text-slate-500 text-sm">
                                                No records available in {editingIncomingRelation.sourceEntity.name}
                                            </div>
                                        ) : (
                                            editingIncomingRelation.sourceRecords.map(record => {
                                                const isSelected = editingIncomingRelation.selectedSourceRecordIds.includes(record.id);
                                                return (
                                                    <label
                                                        key={record.id}
                                                        className={`flex items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                setEditingIncomingRelation(prev => {
                                                                    if (!prev) return null;
                                                                    const newIds = e.target.checked
                                                                        ? [...prev.selectedSourceRecordIds, record.id]
                                                                        : prev.selectedSourceRecordIds.filter(id => id !== record.id);
                                                                    return { ...prev, selectedSourceRecordIds: newIds };
                                                                });
                                                            }}
                                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                        />
                                                        <span className={`ml-3 text-sm ${isSelected ? 'text-indigo-800 font-medium' : 'text-slate-700'}`}>
                                                            {getRecordDisplayName(record, editingIncomingRelation.sourceEntity)}
                                                        </span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6">
                                        <button
                                            onClick={() => setEditingIncomingRelation(null)}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveIncomingRelationChanges}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                    } />
                </Routes>
                </Suspense>
                </main>
            </div>
        </div>
    );
}