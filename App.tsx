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
import { ErrorBoundary, KeyboardShortcutsProvider, useShortcut, AnnouncerProvider, SkipLink } from './components/ui';
import { Entity, Property, PropertyType } from './types';
import { Plus, MagnifyingGlass, Funnel, ArrowLeft, Trash, Link as LinkIcon, TextT, Hash, PencilSimple, X, Code, Paperclip, Download, SpinnerGap, Sparkle, TreeStructure, CaretDown } from '@phosphor-icons/react';
import { Tabs } from './components/Tabs';
import { API_BASE } from './config';

// Helper: retry dynamic import once and auto-reload on chunk load failure (stale deploy)
function lazyWithRetry<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
    return React.lazy(() =>
        importFn().catch((error: Error) => {
            // Only auto-reload once to avoid infinite loops
            const hasReloaded = sessionStorage.getItem('chunk_reload');
            if (!hasReloaded) {
                sessionStorage.setItem('chunk_reload', '1');
                window.location.reload();
                // Return a never-resolving promise so React doesn't render the error
                return new Promise<{ default: T }>(() => {});
            }
            sessionStorage.removeItem('chunk_reload');
            throw error;
        })
    );
}

// Clear the reload flag on successful page load (new chunks loaded OK)
sessionStorage.removeItem('chunk_reload');

// Lazy-loaded components with auto-retry on stale chunk errors
const Workflows = lazyWithRetry(() => import('./components/Workflows').then(m => ({ default: m.Workflows as any })));
const ReportEditor = lazyWithRetry(() => import('./components/ReportEditor').then(m => ({ default: m.ReportEditor as any })));
const Dashboard = lazyWithRetry(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard as any })));
const Overview = lazyWithRetry(() => import('./components/Overview').then(m => ({ default: m.Overview as any })));
const Reporting = lazyWithRetry(() => import('./components/Reporting').then(m => ({ default: m.Reporting as any })));
const Copilots = lazyWithRetry(() => import('./components/Copilots').then(m => ({ default: m.Copilots as any })));
const InteligenciaAgentsPage = lazyWithRetry(() => import('./components/copilots/InteligenciaAgentsPage').then(m => ({ default: m.InteligenciaAgentsPage as any })));
const KnowledgeBase = lazyWithRetry(() => import('./components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase as any })));
const Lab = lazyWithRetry(() => import('./components/Lab').then(m => ({ default: m.Lab as any })));
const Settings = lazyWithRetry(() => import('./components/Settings').then(m => ({ default: m.Settings as any })));
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel as any })));
const LogsAndAlerts = lazyWithRetry(() => import('./components/LogsAndAlerts').then(m => ({ default: m.LogsAndAlerts as any })));
const Connections = lazyWithRetry(() => import('./components/Connections').then(m => ({ default: m.Connections as any })));
const Documentation = lazyWithRetry(() => import('./components/Documentation').then(m => ({ default: m.Documentation as any })));
const SharedDashboard = lazyWithRetry(() => import('./components/SharedDashboard').then(m => ({ default: m.SharedDashboard as any })));
const PublicWorkflowForm = lazyWithRetry(() => import('./components/PublicWorkflowForm').then(m => ({ default: m.PublicWorkflowForm as any })));
const InteractiveTutorial = lazyWithRetry(() => import('./components/InteractiveTutorial').then(m => ({ default: m.InteractiveTutorial as any })));
const IndustrialDashboard = lazyWithRetry(() => import('./components/IndustrialDashboard').then(m => ({ default: m.IndustrialDashboard as any })));
const UseCaseImport = lazyWithRetry(() => import('./components/UseCaseImport').then(m => ({ default: m.UseCaseImport as any })));
const EntityCreator = lazyWithRetry(() => import('./components/EntityCreator').then(m => ({ default: m.EntityCreator as any })));

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
        <ErrorBoundary>
            <ThemeProvider>
                <AnnouncerProvider>
                    <KeyboardShortcutsProvider>
                        <BrowserRouter>
                            <SkipLink href="#main-content" />
                            <Routes>
                                <Route path="/shared/:shareToken" element={<SharedDashboardWrapper />} />
                                <Route path="/*" element={
                                    <AuthProvider>
                                        <AuthenticatedApp />
                                    </AuthProvider>
                                } />
                            </Routes>
                        </BrowserRouter>
                    </KeyboardShortcutsProvider>
                </AnnouncerProvider>
            </ThemeProvider>
        </ErrorBoundary>
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
    
    // Global keyboard shortcuts
    useShortcut('go-home', {
        key: 'h',
        modifiers: ['cmd', 'shift'],
        description: 'Go to Overview',
        category: 'Navigation',
        action: () => navigate('/'),
        global: true
    }, [navigate]);
    
    useShortcut('go-workflows', {
        key: 'w',
        modifiers: ['cmd', 'shift'],
        description: 'Go to Workflows',
        category: 'Navigation',
        action: () => navigate('/workflows'),
        global: true
    }, [navigate]);
    
    useShortcut('go-dashboard', {
        key: 'd',
        modifiers: ['cmd', 'shift'],
        description: 'Go to Dashboard',
        category: 'Navigation',
        action: () => navigate('/dashboard'),
        global: true
    }, [navigate]);
    
    useShortcut('go-settings', {
        key: ',',
        modifiers: ['cmd'],
        description: 'Go to Settings',
        category: 'Navigation',
        action: () => navigate('/settings'),
        global: true
    }, [navigate]);
    
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
        if (path.startsWith('/lab')) return 'lab';
        if (path.startsWith('/workflow')) return 'workflows';
        if (path.startsWith('/database')) return 'database';
        if (path.startsWith('/templates')) return 'templates';
        if (path.startsWith('/documents')) return 'documents';
        if (path.startsWith('/inteligencia')) return 'inteligencia';
        if (path.startsWith('/copilots')) return 'inteligencia'; // Redirect old URLs
        if (path.startsWith('/logs')) return 'logs';
        if (path.startsWith('/connections')) return 'connections';
        if (path.startsWith('/industrial')) return 'industrial';
        if (path.startsWith('/documentation')) return 'documentation';
        if (path.startsWith('/import-use-case')) return 'import-use-case';
        if (path.startsWith('/settings')) return 'settings';
        if (path.startsWith('/admin')) return 'admin';
        return 'overview';
    };

    const currentView = getCurrentView();
    const hideSidebarForRoutes = location.pathname.match(/^\/documents\/[^/]+$/) ||
        location.pathname.match(/^\/workflow\/[^/]+$/) ||
        location.pathname.match(/^\/inteligencia/) ||
        location.pathname.match(/^\/copilots/) ||
        location.pathname.match(/^\/documentation/);

    // Navigation helper that maps view names to routes
    const handleNavigate = (view: string) => {
        const routes: Record<string, string> = {
            'overview': '/overview',
            'dashboard': '/dashboard',
            'lab': '/lab',
            'workflows': '/workflows',
            'database': '/database',
            'copilots': '/copilots',
            'logs': '/logs',
            'documentation': '/documentation',
            'import-use-case': '/import-use-case',
            'settings': '/settings',
            'settings-team': '/settings?tab=team',
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
    const [newPropUnit, setNewPropUnit] = useState<string>('');
    
    // Records table state
    const [recordSearch, setRecordSearch] = useState('');
    const [recordSortKey, setRecordSortKey] = useState<string | null>(null);
    const [recordSortDir, setRecordSortDir] = useState<'asc' | 'desc'>('asc');
    const [recordPage, setRecordPage] = useState(0);
    const recordsPerPage = 25;
    // Advanced filters: { propertyId: { op: '>', value: '100' } }
    const [recordFilters, setRecordFilters] = useState<Record<string, { op: string; value: string }>>({});
    const [showFilters, setShowFilters] = useState(false);
    // Inline editing
    const [inlineEditCell, setInlineEditCell] = useState<{ recordId: string; propId: string } | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState('');
    // Tags
    const [editingTagsRecordId, setEditingTagsRecordId] = useState<string | null>(null);

    // Predefined tag options
    const TAG_OPTIONS = ['verified', 'estimated', 'audited', 'pending', 'flagged', 'draft'] as const;

    // New Entity State
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityDescription, setNewEntityDescription] = useState('');
    const [showEntityExamplesMenu, setShowEntityExamplesMenu] = useState(false);
    const [isCreatingEntityExamples, setIsCreatingEntityExamples] = useState(false);
    const entityExamplesMenuRef = useRef<HTMLDivElement>(null);

    // Records State
    const [activeTab, setActiveTab] = useState<'structure' | 'data'>('data');
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

    // Smart Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importStep, setImportStep] = useState<'source' | 'preview' | 'importing'>('source');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importData, setImportData] = useState<any[]>([]);
    const [importColumns, setImportColumns] = useState<{
        name: string;
        detectedType: PropertyType;
        include: boolean;
        sample: any;
    }[]>([]);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);

    const activeEntity = entities.find(e => e.id === activeEntityId);

    useEffect(() => {
        if (!showEntityExamplesMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!entityExamplesMenuRef.current) return;
            if (!entityExamplesMenuRef.current.contains(event.target as Node)) {
                setShowEntityExamplesMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEntityExamplesMenu]);

    // Smart Import Functions
    const detectColumnType = (values: any[]): PropertyType => {
        const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
        if (validValues.length === 0) return 'text';
        
        // Check if all values are numbers
        const allNumbers = validValues.every(v => !isNaN(Number(v)) && v !== '');
        if (allNumbers) return 'number';
        
        // Check if values look like JSON
        const looksLikeJson = validValues.some(v => {
            if (typeof v === 'string') {
                const trimmed = v.trim();
                return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                       (trimmed.startsWith('[') && trimmed.endsWith(']'));
            }
            return typeof v === 'object';
        });
        if (looksLikeJson) return 'json';
        
        return 'text';
    };

    const parseCSV = (text: string): any[] => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const data: any[] = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            const row: Record<string, any> = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });
            data.push(row);
        }
        return data;
    };

    const handleImportFile = async (file: File) => {
        setImportError(null);
        setImportFile(file);
        
        try {
            const text = await file.text();
            let data: any[] = [];
            
            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(text);
                data = Array.isArray(parsed) ? parsed : [parsed];
            } else if (file.name.endsWith('.csv')) {
                data = parseCSV(text);
            } else {
                setImportError('Unsupported file format. Please use CSV or JSON.');
                return;
            }
            
            if (data.length === 0) {
                setImportError('No data found in file.');
                return;
            }
            
            // Detect columns and types
            const firstRow = data[0];
            const columns = Object.keys(firstRow).map(colName => {
                const values = data.slice(0, 100).map(row => row[colName]);
                return {
                    name: colName,
                    detectedType: detectColumnType(values),
                    include: true,
                    sample: firstRow[colName]
                };
            });
            
            setImportData(data);
            setImportColumns(columns);
            setImportStep('preview');
        } catch (error) {
            console.error('Error parsing file:', error);
            setImportError('Error parsing file. Please check the format.');
        }
    };

    // State for import mode
    const [importMode, setImportMode] = useState<'new' | 'existing'>('new');

    const executeImport = async () => {
        setImportStep('importing');
        setImportProgress(0);
        
        try {
            const includedColumns = importColumns.filter(c => c.include);
            let targetEntityId: string;
            
            if (importMode === 'new') {
                // CREATE NEW ENTITY from import
                const entityName = importFile?.name.replace(/\.(csv|json)$/i, '') || 'Imported Data';
                
                // Generate entity ID upfront
                const generatedEntityId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                targetEntityId = generatedEntityId;
                
                // Create properties from columns
                const newProps: Property[] = includedColumns.map((col, idx) => ({
                    id: `prop-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                    name: col.name,
                    type: col.detectedType,
                    defaultValue: ''
                }));
                
                // Build property map
                const propMap: Record<string, string> = {};
                includedColumns.forEach((col, idx) => {
                    propMap[col.name] = newProps[idx].id;
                });
                
                // Create new entity
                const newEntity = {
                    id: generatedEntityId,
                    name: entityName,
                    description: `Imported from ${importFile?.name}`,
                    properties: newProps,
                    author: user?.name || 'Unknown',
                    lastEdited: 'Just now'
                };
                
                const createRes = await fetch(`${API_BASE}/entities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(newEntity)
                });
                
                if (!createRes.ok) throw new Error('Failed to create entity');
                
                setImportProgress(10);
                
                // Import records
                const batchSize = 50;
                const totalRecords = importData.length;
                
                for (let i = 0; i < totalRecords; i += batchSize) {
                    const batch = importData.slice(i, i + batchSize);
                    
                    for (const row of batch) {
                        const values: Record<string, any> = {};
                        includedColumns.forEach(col => {
                            const propId = propMap[col.name];
                            if (propId) {
                                values[propId] = col.detectedType === 'json' 
                                    ? (typeof row[col.name] === 'string' ? row[col.name] : JSON.stringify(row[col.name]))
                                    : String(row[col.name] ?? '');
                            }
                        });
                        
                        await fetch(`${API_BASE}/entities/${targetEntityId}/records`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ values })
                        });
                    }
                    
                    setImportProgress(10 + Math.round(((i + batch.length) / totalRecords) * 90));
                }
                
                // Refresh and navigate to new entity
                await fetchEntities();
                setActiveEntityId(targetEntityId);
                
            } else {
                // ADD TO EXISTING ENTITY
                if (!activeEntity) return;
                targetEntityId = activeEntity.id;
                
                // Refresh entity from server to get latest property IDs
                const entityRes = await fetch(`${API_BASE}/entities/${targetEntityId}`, { credentials: 'include' });
                if (!entityRes.ok) throw new Error('Failed to fetch entity');
                const freshEntity = await entityRes.json();
                
                // Map columns to existing properties by name
                const propMap: Record<string, string> = {};
                includedColumns.forEach(col => {
                    const existingProp = freshEntity.properties?.find(
                        (p: Property) => p.name.toLowerCase() === col.name.toLowerCase()
                    );
                    if (existingProp) {
                        propMap[col.name] = existingProp.id;
                    }
                });
                
                // Check for unmapped columns
                const unmappedCols = includedColumns.filter(col => !propMap[col.name]);
                if (unmappedCols.length > 0) {
                    setImportError(`Columns not found in entity: ${unmappedCols.map(c => c.name).join(', ')}. Create properties first or use "Create New Entity".`);
                    setImportStep('preview');
                    return;
                }
                
                setImportProgress(10);
                
                // Import records
                const batchSize = 50;
                const totalRecords = importData.length;
                
                for (let i = 0; i < totalRecords; i += batchSize) {
                    const batch = importData.slice(i, i + batchSize);
                    
                    for (const row of batch) {
                        const values: Record<string, any> = {};
                        includedColumns.forEach(col => {
                            const propId = propMap[col.name];
                            if (propId) {
                                values[propId] = col.detectedType === 'json' 
                                    ? (typeof row[col.name] === 'string' ? row[col.name] : JSON.stringify(row[col.name]))
                                    : String(row[col.name] ?? '');
                            }
                        });
                        
                        await fetch(`${API_BASE}/entities/${targetEntityId}/records`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ values })
                        });
                    }
                    
                    setImportProgress(10 + Math.round(((i + batch.length) / totalRecords) * 90));
                }
                
                await fetchEntities();
            }
            
            // Refresh records for the target entity
            const recordsRes = await fetch(`${API_BASE}/entities/${targetEntityId}/records`, { credentials: 'include' });
            if (recordsRes.ok) {
                const recordsData = await recordsRes.json();
                setRecords(recordsData);
            }
            
            // Close modal
            setTimeout(() => {
                setIsImportModalOpen(false);
                resetImportState();
            }, 500);
            
        } catch (error) {
            console.error('Error importing data:', error);
            setImportError('Error importing data. Please try again.');
            setImportStep('preview');
        }
    };

    const resetImportState = () => {
        setImportStep('source');
        setImportFile(null);
        setImportData([]);
        setImportColumns([]);
        setImportProgress(0);
        setImportError(null);
        setIsDraggingFile(false);
        setImportMode('new');
    };

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
            
            // Extract entityId from URL path /database/:entityId
            const match = location.pathname.match(/^\/database\/(.+)$/);
            if (match && match[1] && match[1] !== 'null' && match[1] !== 'undefined' && match[1] !== 'new') {
                const urlEntityId = match[1];
                if (urlEntityId !== activeEntityId) {
                    setActiveEntityId(urlEntityId);
                }
            } else if ((location.pathname === '/database' || match?.[1] === 'null' || match?.[1] === 'undefined') && activeEntityId) {
                // Clear activeEntityId when navigating back to /database or invalid ID
                setActiveEntityId(null);
                if (match?.[1] === 'null' || match?.[1] === 'undefined') {
                    navigate('/database');
                }
            }
        }
    }, [location.pathname, location.search, activeEntityId]);

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
        // Reset table state when entity changes
        setRecordSearch('');
        setRecordSortKey(null);
        setRecordPage(0);
        setRecordFilters({});
        setShowFilters(false);
        setInlineEditCell(null);
    }, [activeEntityId, activeTab]);

    const fetchEntities = async () => {
        setEntitiesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/entities`, { credentials: 'include' });
            const data = await res.json();
            // Ensure data is an array and filter out any entities with null/undefined IDs
            if (Array.isArray(data)) {
                setEntities(data.filter((e: any) => e && e.id));
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
            // Limit to 100 records for preview to improve load time
            const res = await fetch(`${API_BASE}/entities/${activeEntityId}/records?limit=100`, { credentials: 'include' });
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

    const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

    const handleCreateEntityExamples = async (presetId: 'quality_core' | 'transitions_economics') => {
        if (isCreatingEntityExamples) return;
        setIsCreatingEntityExamples(true);
        try {
            const authorName = user?.name || user?.email?.split('@')[0] || 'User';
            const nowLabel = 'Just now';
            const entityBlueprints: Record<'quality_core' | 'transitions_economics', Array<{
                name: string;
                description: string;
                properties: Array<{ name: string; type: PropertyType; defaultValue?: string; unit?: string }>;
                records?: Array<Record<string, string | number>>;
            }>> = {
                quality_core: [
                    {
                        name: 'Example - Polymer Batches',
                        description: 'Batches with quality, productivity and energy indicators.',
                        properties: [
                            { name: 'Date', type: 'text' },
                            { name: 'Line', type: 'text' },
                            { name: 'Grade', type: 'text' },
                            { name: 'Melting Index (Mi2)', type: 'number', unit: 'g/10min' },
                            { name: 'Density', type: 'number', unit: 'g/cm3' },
                            { name: 'Scrap (%)', type: 'number', unit: '%' },
                            { name: 'Energy (kWh)', type: 'number', unit: 'kWh' },
                            { name: 'Quality Status', type: 'text' }
                        ],
                        records: [
                            { Date: '2026-02-01', Line: 'R1', Grade: 'M5309', 'Melting Index (Mi2)': 0.61, Density: 0.953, 'Scrap (%)': 1.4, 'Energy (kWh)': 14120, 'Quality Status': 'In spec' },
                            { Date: '2026-02-02', Line: 'R1', Grade: 'M5309', 'Melting Index (Mi2)': 0.58, Density: 0.952, 'Scrap (%)': 1.6, 'Energy (kWh)': 13980, 'Quality Status': 'In spec' },
                            { Date: '2026-02-03', Line: 'R2', Grade: '5803', 'Melting Index (Mi2)': 0.31, Density: 0.957, 'Scrap (%)': 3.2, 'Energy (kWh)': 14940, 'Quality Status': 'Transition' },
                            { Date: '2026-02-04', Line: 'R2', Grade: '5803', 'Melting Index (Mi2)': 0.27, Density: 0.956, 'Scrap (%)': 1.9, 'Energy (kWh)': 14410, 'Quality Status': 'In spec' }
                        ]
                    },
                    {
                        name: 'Example - Grade Transitions',
                        description: 'Transition windows and quality/economic context.',
                        properties: [
                            { name: 'Start Time', type: 'text' },
                            { name: 'End Time', type: 'text' },
                            { name: 'From Grade', type: 'text' },
                            { name: 'To Grade', type: 'text' },
                            { name: 'Operation Mode', type: 'text' },
                            { name: 'Lab-safe Duration (h)', type: 'number', unit: 'h' },
                            { name: 'Model Duration (h)', type: 'number', unit: 'h' },
                            { name: 'Secondary Polymer (t)', type: 'number', unit: 't' },
                            { name: 'Severity', type: 'text' }
                        ],
                        records: [
                            { 'Start Time': '2026-02-02 20:00', 'End Time': '2026-02-03 04:00', 'From Grade': 'M5309', 'To Grade': '5803', 'Operation Mode': 'Parallel->Series', 'Lab-safe Duration (h)': 8, 'Model Duration (h)': 4, 'Secondary Polymer (t)': 56, Severity: 'high' },
                            { 'Start Time': '2026-02-05 08:00', 'End Time': '2026-02-05 14:00', 'From Grade': '5803', 'To Grade': 'R4805', 'Operation Mode': 'Series', 'Lab-safe Duration (h)': 6, 'Model Duration (h)': 3.5, 'Secondary Polymer (t)': 39, Severity: 'medium' }
                        ]
                    }
                ],
                transitions_economics: [
                    {
                        name: 'Example - Transition Economics',
                        description: 'Economic impact assumptions to quantify yearly value from transition reduction.',
                        properties: [
                            { name: 'Scenario', type: 'text' },
                            { name: 'Transition Time LAB (h)', type: 'number', unit: 'h' },
                            { name: 'Transition Time Improved (h)', type: 'number', unit: 'h' },
                            { name: 'Production Rate (kg/h)', type: 'number', unit: 'kg/h' },
                            { name: 'Primary Price (EUR/kg)', type: 'number', unit: 'EUR/kg' },
                            { name: 'Secondary Price (EUR/kg)', type: 'number', unit: 'EUR/kg' },
                            { name: 'Estimated Gain (EUR/year)', type: 'number', unit: 'EUR/year' }
                        ],
                        records: [
                            { Scenario: 'Conservative', 'Transition Time LAB (h)': 8, 'Transition Time Improved (h)': 7.5, 'Production Rate (kg/h)': 14000, 'Primary Price (EUR/kg)': 1.45, 'Secondary Price (EUR/kg)': 1.05, 'Estimated Gain (EUR/year)': 267826 },
                            { Scenario: 'Aggressive', 'Transition Time LAB (h)': 8, 'Transition Time Improved (h)': 6.5, 'Production Rate (kg/h)': 14000, 'Primary Price (EUR/kg)': 1.45, 'Secondary Price (EUR/kg)': 1.05, 'Estimated Gain (EUR/year)': 803478 }
                        ]
                    },
                    {
                        name: 'Example - Circular Material Streams',
                        description: 'Circularity-related material movements with emissions context.',
                        properties: [
                            { name: 'Date', type: 'text' },
                            { name: 'Stream Type', type: 'text' },
                            { name: 'Origin', type: 'text' },
                            { name: 'Destination', type: 'text' },
                            { name: 'Tonnes', type: 'number', unit: 't' },
                            { name: 'Recycled Content (%)', type: 'number', unit: '%' },
                            { name: 'CO2e (kg/t)', type: 'number', unit: 'kg/t' },
                            { name: 'Status', type: 'text' }
                        ],
                        records: [
                            { Date: '2026-02-01', 'Stream Type': 'Regrind', Origin: 'Extrusion line 1', Destination: 'Compounding', Tonnes: 18, 'Recycled Content (%)': 75, 'CO2e (kg/t)': 280, Status: 'In reuse' },
                            { Date: '2026-02-02', 'Stream Type': 'Off-spec pellet', Origin: 'Transition buffer', Destination: 'External recycler', Tonnes: 26, 'Recycled Content (%)': 0, 'CO2e (kg/t)': 410, Status: 'Sold as secondary' }
                        ]
                    }
                ]
            };

            const selectedBlueprint = entityBlueprints[presetId];
            const existingByName = new Map(entities.map((entity) => [entity.name.toLowerCase(), entity]));
            let createdCount = 0;

            for (const blueprint of selectedBlueprint) {
                const existing = existingByName.get(blueprint.name.toLowerCase());
                let entityId = existing?.id;

                if (!entityId) {
                    entityId = makeId('ent_ex');
                    const properties = blueprint.properties.map((property) => ({
                        id: makeId('prop_ex'),
                        name: property.name,
                        type: property.type,
                        defaultValue: property.defaultValue || (property.type === 'number' ? '0' : ''),
                        unit: property.unit
                    }));

                    const createRes = await fetch(`${API_BASE}/entities`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            id: entityId,
                            name: blueprint.name,
                            description: blueprint.description,
                            author: authorName,
                            lastEdited: nowLabel,
                            entityType: 'example',
                            properties
                        })
                    });
                    if (!createRes.ok) {
                        throw new Error(`Failed creating entity: ${blueprint.name}`);
                    }
                    createdCount += 1;
                }

                // Seed example records only when entity was just created
                if (!existing && blueprint.records && blueprint.records.length > 0 && entityId) {
                    for (const row of blueprint.records) {
                        await fetch(`${API_BASE}/entities/${entityId}/records`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(row)
                        });
                    }
                }
            }

            await fetchEntities();
            setShowEntityExamplesMenu(false);
            if (createdCount > 0) {
                alert(`Created ${createdCount} example entities.`);
            } else {
                alert('Example entities already exist. Open and edit them directly.');
            }
        } catch (error) {
            console.error('Error creating entity examples:', error);
            alert('Failed creating example entities');
        } finally {
            setIsCreatingEntityExamples(false);
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
            unit: newPropType === 'number' ? newPropUnit || undefined : undefined,
            formula: undefined, // Can be set later via property editor
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
            setNewPropUnit('');
            setIsAddingProp(false);

        } catch (error) {
            console.error('Error adding property:', error);
        }
    };

    // Toggle tag on a record
    const toggleRecordTag = async (recordId: string, tag: string) => {
        const record = records.find(r => r.id === recordId);
        if (!record) return;
        let currentTags: string[] = [];
        try { currentTags = JSON.parse(record.tags || '[]'); } catch { currentTags = []; }
        const newTags = currentTags.includes(tag) ? currentTags.filter((t: string) => t !== tag) : [...currentTags, tag];
        try {
            await fetch(`${API_BASE}/records/${recordId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags }),
                credentials: 'include'
            });
            setRecords(prev => prev.map(r => r.id === recordId ? { ...r, tags: JSON.stringify(newTags) } : r));
        } catch (e) { console.error('Failed to update tags:', e); }
    };

    // Evaluate formula for calculated fields
    const evaluateFormula = (formula: string, record: any, properties: Property[]): string | number => {
        try {
            let expr = formula;
            // Replace {PropertyName} with actual values
            properties.forEach(p => {
                const val = record.values?.[p.id];
                const numVal = Number(val);
                const replacement = !isNaN(numVal) ? String(numVal) : '0';
                expr = expr.replace(new RegExp(`\\{${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), replacement);
            });
            // Only allow safe math operations
            if (/^[\d\s+\-*/().]+$/.test(expr)) {
                const result = Function('"use strict"; return (' + expr + ')')();
                return typeof result === 'number' && isFinite(result) ? Math.round(result * 10000) / 10000 : 'â€”';
            }
            return 'â€”';
        } catch { return 'â€”'; }
    };

    // Inline edit: save single cell
    const saveInlineEdit = async () => {
        if (!inlineEditCell || !activeEntityId) return;
        const { recordId, propId } = inlineEditCell;
        try {
            // Find current record values
            const record = records.find(r => r.id === recordId);
            if (!record) return;
            const updatedValues: Record<string, any> = {};
            activeEntity?.properties.forEach(p => {
                updatedValues[p.name] = p.id === propId ? inlineEditValue : (record.values[p.id] ?? '');
            });
            await fetch(`${API_BASE}/records/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: updatedValues }),
                credentials: 'include'
            });
            // Update local state immediately
            setRecords(prev => prev.map(r => 
                r.id === recordId ? { ...r, values: { ...r.values, [propId]: inlineEditValue } } : r
            ));
        } catch (error) {
            console.error('Inline edit failed:', error);
        }
        setInlineEditCell(null);
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
        if (value === undefined || value === null || value === '') return '-';

        // Number with unit
        if (prop.type === 'number' && prop.unit) {
            const num = Number(value);
            const formatted = isNaN(num) ? value : num.toLocaleString(undefined, { maximumFractionDigits: 4 });
            return <span>{formatted} <span className="text-[var(--text-tertiary)] text-xs">{prop.unit}</span></span>;
        }

        if (prop.type === 'json') {
            return (
                <div className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-1.5 rounded truncate max-w-[200px]" title={typeof value === 'string' ? value : JSON.stringify(value)}>
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
                                        onClick={(e) => { e.stopPropagation(); rec && handleRecordClick(rec, relatedInfo.entity); }}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
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

            <div className="flex-1 flex flex-col min-h-0 max-h-screen overflow-hidden z-30">
                {!hideSidebarForRoutes && (
                    <TopNav activeView={currentView} />
                )}
                <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[var(--bg-primary)] transition-colors duration-200" tabIndex={-1}>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                        <Workflows entities={entities} onViewChange={handleNavigate} onEntityCreated={fetchEntities} />
                    } />
                    <Route path="/workflow/:workflowId" element={
                        <Workflows entities={entities} onViewChange={handleNavigate} onEntityCreated={fetchEntities} />
                    } />
                    <Route path="/templates" element={
                        <Reporting entities={entities} companyInfo={undefined} onViewChange={handleNavigate} view="templates" />
                    } />
                    <Route path="/documents" element={
                        <Reporting entities={entities} companyInfo={undefined} onViewChange={handleNavigate} view="documents" />
                    } />
                    <Route path="/documents/:reportId" element={
                        <ReportEditor entities={entities} companyInfo={undefined} onViewChange={handleNavigate} />
                    } />
                    <Route path="/inteligencia" element={
                        <Copilots />
                    } />
                    <Route path="/inteligencia/agentes" element={
                        <Suspense fallback={<PageLoader />}><InteligenciaAgentsPage /></Suspense>
                    } />
                    {/* Redirect old copilots URL */}
                    <Route path="/copilots" element={
                        <Navigate to="/inteligencia" replace />
                    } />
                    <Route path="/logs" element={
                        <LogsAndAlerts />
                    } />
                    <Route path="/connections" element={
                        <Connections />
                    } />
                    <Route path="/industrial" element={
                        <Suspense fallback={<PageLoader />}><IndustrialDashboard /></Suspense>
                    } />
                    <Route path="/documentation" element={
                        <Documentation />
                    } />
                    <Route path="/import-use-case" element={
                        <UseCaseImport />
                    } />
                    <Route path="/settings" element={
                        <Settings onViewChange={handleNavigate} onShowTutorial={() => setShowTutorial(true)} />
                    } />
                    <Route path="/admin" element={
                        <AdminPanel onNavigate={handleNavigate} />
                    } />
                    <Route path="/lab" element={
                        <div className="h-full flex flex-col min-h-0 overflow-hidden">
                            <Lab 
                                entities={entities} 
                                onNavigate={(entityId) => {
                                    if (!entityId) return;
                                    setActiveEntityId(entityId);
                                    navigate(`/database/${entityId}`);
                                }}
                            />
                        </div>
                    } />
                    <Route path="/lab/:simulationId" element={
                        <div className="h-full flex flex-col min-h-0 overflow-hidden">
                            <Lab 
                                entities={entities} 
                                onNavigate={(entityId) => {
                                    if (!entityId) return;
                                    setActiveEntityId(entityId);
                                    navigate(`/database/${entityId}`);
                                }}
                            />
                        </div>
                    } />
                    <Route path="/lab/:simulationId/scenarios/:scenarioId" element={
                        <div className="h-full flex flex-col min-h-0 overflow-hidden">
                            <Lab 
                                entities={entities} 
                                onNavigate={(entityId) => {
                                    if (!entityId) return;
                                    setActiveEntityId(entityId);
                                    navigate(`/database/${entityId}`);
                                }}
                            />
                        </div>
                    } />
                    <Route path="/database" element={
                        <KnowledgeBase 
                            entities={entities}
                            onNavigate={(entityId) => {
                                if (!entityId) return;
                                setActiveEntityId(entityId);
                                navigate(`/database/${entityId}`);
                            }}
                            onEntityCreated={fetchEntities}
                        />
                    } />
                    <Route path="/database/new" element={
                        <NewEntityRedirect onEntityCreated={fetchEntities} />
                    } />
                    <Route path="/database/:entityId" element={
                    <div data-tutorial="database-content" className="contents">
                        <EntityCreatorRoute onEntityChanged={fetchEntities} key={location.pathname} />
                    </div>
                    } />
                </Routes>
                </Suspense>
                </div>
                </main>
            </div>
        </div>
    );
}

// Helper: Creates entity in backend immediately and redirects to its detail page
function NewEntityRedirect({ onEntityCreated }: { onEntityCreated: () => void }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [creating, setCreating] = React.useState(false);
    const hasCreated = React.useRef(false);

    React.useEffect(() => {
        if (hasCreated.current || creating) return;
        hasCreated.current = true;
        setCreating(true);

        const createEntity = async () => {
            try {
                const entityId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const namePropId = `prop-${Date.now()}-0-${Math.random().toString(36).substr(2, 5)}`;
                const newEntity = {
                    id: entityId,
                    name: 'Untitled',
                    description: '',
                    entityType: 'generic',
                    author: user?.name || user?.email?.split('@')[0] || 'User',
                    lastEdited: 'Just now',
                    properties: [{ id: namePropId, name: 'Name', type: 'text', defaultValue: '' }],
                };

                const res = await fetch(`${API_BASE}/entities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(newEntity),
                });

                if (!res.ok) throw new Error('Failed to create entity');
                onEntityCreated();
                navigate(`/database/${entityId}?new=1`, { replace: true });
            } catch (error) {
                console.error('Error creating entity:', error);
                navigate('/database', { replace: true });
            }
        };

        createEntity();
    }, []);

    return (
        <div className="flex items-center justify-center h-full">
            <SpinnerGap className="w-8 h-8 animate-spin text-[var(--text-tertiary)]" weight="light" />
        </div>
    );
}

// Helper: Renders EntityCreator with entityId from URL params
function EntityCreatorRoute({ onEntityChanged }: { onEntityChanged: () => void }) {
    const { entityId } = useParams();
    const location = useLocation();
    const isNew = new URLSearchParams(location.search).get('new') === '1';

    if (!entityId) return null;
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-full">
                <SpinnerGap className="w-8 h-8 animate-spin text-[var(--text-tertiary)]" weight="light" />
            </div>
        }>
            <EntityCreator entityId={entityId} isNew={isNew} onEntityChanged={onEntityChanged} />
        </Suspense>
    );
}
