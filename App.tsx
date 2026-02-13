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
const WorkflowEditor = lazyWithRetry(() => import('./components/workflows/WorkflowEditor').then(m => ({ default: m.WorkflowEditor as any })));
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
        location.pathname.match(/^\/workflows-v2(\/|$)/) ||
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
            if (match && match[1] && match[1] !== 'null' && match[1] !== 'undefined') {
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
                return typeof result === 'number' && isFinite(result) ? Math.round(result * 10000) / 10000 : '—';
            }
            return '—';
        } catch { return '—'; }
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
                    {/* New modular workflow editor (v2) */}
                    <Route path="/workflows-v2" element={
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
                            <WorkflowEditor entities={entities} onViewChange={handleNavigate} />
                        </div>
                    } />
                    <Route path="/workflows-v2/:workflowId" element={
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
                            <WorkflowEditor entities={entities} onViewChange={handleNavigate} />
                        </div>
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
                        />
                    } />
                    <Route path="/database/:entityId" element={
                    <div data-tutorial="database-content" className="contents">
                        {/* Top Header */}
                        <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-8 z-10">
                            {activeEntity ? (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => {
                                            // Navigate first, useEffect will clear activeEntityId
                                            navigate('/database');
                                        }}
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
                                                    <div className="relative" ref={entityExamplesMenuRef}>
                                                        <button
                                                            onClick={() => setShowEntityExamplesMenu((prev) => !prev)}
                                                            disabled={isCreatingEntityExamples}
                                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {isCreatingEntityExamples ? 'Creating...' : 'Examples'}
                                                            <CaretDown size={12} className="ml-2" weight="bold" />
                                                        </button>
                                                        {showEntityExamplesMenu && (
                                                            <div className="absolute right-0 top-10 z-30 w-80 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl p-2">
                                                                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                                                    Example entity packs
                                                                </div>
                                                                <button
                                                                    onClick={() => handleCreateEntityExamples('quality_core')}
                                                                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                                                                >
                                                                    <div className="text-xs font-medium text-[var(--text-primary)]">Quality Core Pack</div>
                                                                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Polymer batches + grade transitions with process quality context.</div>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCreateEntityExamples('transitions_economics')}
                                                                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                                                                >
                                                                    <div className="text-xs font-medium text-[var(--text-primary)]">Transitions & Economics Pack</div>
                                                                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Transition economics + circular material streams.</div>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
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
                                <div className="max-w-6xl mx-auto space-y-4">

                                    {/* Metadata bar - subtle info */}
                                    <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                                        <div className="flex items-center gap-4">
                                            <span>Created by <span className="text-[var(--text-secondary)]">{activeEntity.author}</span></span>
                                            <span>·</span>
                                            <span>Modified <span className="text-[var(--text-secondary)]">{activeEntity.lastEdited}</span></span>
                                        </div>
                                        {activeEntity.description && (
                                            <span className="text-[var(--text-tertiary)] italic max-w-md truncate">{activeEntity.description}</span>
                                        )}
                                    </div>

                                    {/* Properties Section - Collapsible */}
                                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                                        <button
                                            onClick={() => setActiveTab(activeTab === 'structure' ? 'data' : 'structure')}
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <TreeStructure size={16} className="text-[var(--text-tertiary)]" />
                                                <span className="text-sm font-medium text-[var(--text-primary)]">Properties</span>
                                                <span className="text-xs text-[var(--text-tertiary)]">({activeEntity.properties.length})</span>
                                                {activeTab !== 'structure' && activeEntity.properties.length > 0 && (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        {activeEntity.properties.slice(0, 4).map((prop, propIdx) => (
                                                            <span 
                                                                key={prop.id || `collapsed-prop-${propIdx}`}
                                                                className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                                            >
                                                                {prop.name}
                                                            </span>
                                                        ))}
                                                        {activeEntity.properties.length > 4 && (
                                                            <span className="text-[10px] text-[var(--text-tertiary)]">+{activeEntity.properties.length - 4}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <svg 
                                                className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${activeTab === 'structure' ? 'rotate-180' : ''}`}
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {/* Expanded Properties Panel */}
                                        {activeTab === 'structure' && (
                                            <div className="border-t border-[var(--border-light)]">
                                                {/* Property List */}
                                                <div className="divide-y divide-[var(--border-light)]">
                                                    {activeEntity.properties.length === 0 ? (
                                                        <div className="p-6 text-center text-[var(--text-tertiary)] text-sm">
                                                            No properties defined. Add properties to define your data structure.
                                                        </div>
                                                    ) : (
                                                        activeEntity.properties.map((prop, idx) => (
                                                            <div key={prop.id || `prop-fallback-${idx}`} className="px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-light)]">
                                                                        {renderIconForType(prop.type)}
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-sm text-[var(--text-primary)]">{prop.name}</span>
                                                                        <span className="ml-2 text-[10px] uppercase text-[var(--text-tertiary)]">{prop.type}</span>
                                                                        {prop.type === 'relation' && (
                                                                            <span className="ml-1 text-[10px] text-[#419CAF]">→ {getRelatedEntityName(prop.relatedEntityId)}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => deleteProperty(prop.id)}
                                                                    className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash size={14} weight="light" />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Add Property - Inline */}
                                                {!isAddingProp ? (
                                                    <div className="px-4 py-3 border-t border-[var(--border-light)]">
                                                        <button
                                                            onClick={() => setIsAddingProp(true)}
                                                            className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[#419CAF] transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Add property</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-light)]">
                                                        <div className="flex items-end gap-3">
                                                            <div className="flex-1">
                                                                <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Name</label>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    value={newPropName}
                                                                    onChange={(e) => setNewPropName(e.target.value)}
                                                                    placeholder="Property name"
                                                                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#419CAF] focus:border-[#419CAF] focus:outline-none"
                                                                />
                                                            </div>
                                                            <div className="w-32">
                                                                <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Type</label>
                                                                <select
                                                                    value={newPropType}
                                                                    onChange={(e) => setNewPropType(e.target.value as PropertyType)}
                                                                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#419CAF] focus:outline-none"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="number">Number</option>
                                                                    <option value="json">JSON</option>
                                                                    <option value="relation">Relation</option>
                                                                    <option value="file">File</option>
                                                                </select>
                                                            </div>
                                                            {newPropType === 'relation' && (
                                                                <div className="w-40">
                                                                    <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Links to</label>
                                                                    <select
                                                                        value={newPropRelationId}
                                                                        onChange={(e) => setNewPropRelationId(e.target.value)}
                                                                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#419CAF] focus:outline-none"
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        {entities.filter(e => e.id !== activeEntity.id).map(e => (
                                                                            <option key={e.id} value={e.id}>{e.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                            {newPropType === 'number' && (
                                                                <div className="w-24">
                                                                    <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Unit</label>
                                                                    <input
                                                                        type="text"
                                                                        value={newPropUnit}
                                                                        onChange={(e) => setNewPropUnit(e.target.value)}
                                                                        placeholder="°C, bar, kg..."
                                                                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[#419CAF] focus:outline-none"
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={handleAddProperty}
                                                                    disabled={!newPropName || (newPropType === 'relation' && !newPropRelationId)}
                                                                    className="px-3 py-1.5 bg-[#419CAF] text-white rounded text-sm font-medium hover:bg-[#3a8a9d] disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    Add
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsAddingProp(false)}
                                                                    className="px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] rounded text-sm"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* DATA RECORDS - Always visible */}
                                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                                        {/* Records toolbar: search, completeness, actions */}
                                        <div className="px-4 py-3 border-b border-[var(--border-light)] space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-[var(--text-primary)]">Records</span>
                                                    <span className="text-xs text-[var(--text-tertiary)]">({records.length})</span>
                                                    {/* Data completeness badge */}
                                                    {records.length > 0 && activeEntity.properties.length > 0 && (() => {
                                                        const totalCells = records.length * activeEntity.properties.length;
                                                        const filledCells = records.reduce((sum, r) => {
                                                            return sum + activeEntity.properties.filter(p => {
                                                                const v = r.values?.[p.id];
                                                                return v !== undefined && v !== null && v !== '';
                                                            }).length;
                                                        }, 0);
                                                        const pct = Math.round((filledCells / totalCells) * 100);
                                                        const color = pct >= 90 ? 'text-green-600 bg-green-500/10' : pct >= 60 ? 'text-amber-600 bg-amber-500/10' : 'text-red-600 bg-red-500/10';
                                                        return (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`} title={`${filledCells}/${totalCells} fields filled`}>
                                                                {pct}% complete
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Export CSV */}
                                                    {records.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                const headers = activeEntity.properties.map(p => p.unit ? `${p.name} (${p.unit})` : p.name);
                                                                const rows = records.map(r => 
                                                                    activeEntity.properties.map(p => {
                                                                        const v = r.values?.[p.id];
                                                                        if (v === undefined || v === null) return '';
                                                                        const str = String(v);
                                                                        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
                                                                    })
                                                                );
                                                                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                                const link = document.createElement('a');
                                                                link.href = URL.createObjectURL(blob);
                                                                link.download = `${activeEntity.name.replace(/\s+/g, '_')}_records.csv`;
                                                                link.click();
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded text-xs font-medium transition-colors border border-[var(--border-light)]"
                                                        >
                                                            <Download size={14} />
                                                            Export CSV
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            resetImportState();
                                                            setIsImportModalOpen(true);
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded text-xs font-medium transition-colors border border-[var(--border-light)]"
                                                    >
                                                        <Download size={14} className="rotate-180" />
                                                        Import
                                                    </button>
                                                    <div className="relative group/addrecord">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRecordId(null);
                                                                setNewRecordValues({});
                                                                setIsAddingRecord(true);
                                                            }}
                                                            disabled={activeEntity.properties.length === 0}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#419CAF] hover:bg-[#3a8a9d] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Plus size={14} />
                                                            Add Record
                                                        </button>
                                                        {activeEntity.properties.length === 0 && (
                                                            <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[var(--bg-selected)] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/addrecord:opacity-100 transition-opacity pointer-events-none z-50">
                                                                Add properties first
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Search bar */}
                                            {records.length > 0 && (
                                                <div className="relative">
                                                    <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                                    <input
                                                        type="text"
                                                        value={recordSearch}
                                                        onChange={(e) => { setRecordSearch(e.target.value); setRecordPage(0); }}
                                                        placeholder="Search records..."
                                                        className="w-full pl-9 pr-8 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)]"
                                                    />
                                                    {recordSearch && (
                                                        <button onClick={() => setRecordSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* Advanced Filters */}
                                            {records.length > 0 && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => setShowFilters(!showFilters)}
                                                        className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                                                            Object.keys(recordFilters).length > 0 
                                                                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                                                : 'border-[var(--border-light)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                                        }`}
                                                    >
                                                        <Funnel size={10} />
                                                        Filters {Object.keys(recordFilters).length > 0 && `(${Object.keys(recordFilters).length})`}
                                                    </button>
                                                    {/* Active filter chips */}
                                                    {Object.entries(recordFilters).map(([propId, filter]) => {
                                                        const prop = activeEntity.properties.find(p => p.id === propId);
                                                        return (
                                                            <span key={propId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-[10px] rounded-full">
                                                                {prop?.name} {filter.op} {filter.value}
                                                                <button onClick={() => setRecordFilters(prev => { const next = { ...prev }; delete next[propId]; return next; })} className="hover:text-red-500">
                                                                    <X size={8} />
                                                                </button>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* Filter form */}
                                            {showFilters && (
                                                <div className="flex items-end gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Property</label>
                                                        <select id="filter-prop" className="w-full px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)]">
                                                            {activeEntity.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="w-20">
                                                        <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Operator</label>
                                                        <select id="filter-op" className="w-full px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)]">
                                                            <option value="contains">contains</option>
                                                            <option value="=">=</option>
                                                            <option value="!=">!=</option>
                                                            <option value=">">&gt;</option>
                                                            <option value="<">&lt;</option>
                                                            <option value=">=">&gt;=</option>
                                                            <option value="<=">&lt;=</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Value</label>
                                                        <input id="filter-value" type="text" placeholder="Value..." className="w-full px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-xs text-[var(--text-primary)]" />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const propEl = document.getElementById('filter-prop') as HTMLSelectElement;
                                                            const opEl = document.getElementById('filter-op') as HTMLSelectElement;
                                                            const valEl = document.getElementById('filter-value') as HTMLInputElement;
                                                            if (propEl && opEl && valEl && valEl.value) {
                                                                setRecordFilters(prev => ({ ...prev, [propEl.value]: { op: opEl.value, value: valEl.value } }));
                                                                valEl.value = '';
                                                                setRecordPage(0);
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-[var(--accent-primary)] text-white text-xs rounded font-medium hover:opacity-90"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-auto max-h-[500px] custom-scrollbar">
                                            {/* Compute filtered, sorted, paginated records */}
                                            {(() => {
                                                // Search filter
                                                let displayRecords = records;
                                                if (recordSearch.trim()) {
                                                    const q = recordSearch.toLowerCase();
                                                    displayRecords = displayRecords.filter(r => 
                                                        activeEntity.properties.some(p => {
                                                            const v = r.values?.[p.id];
                                                            return v && String(v).toLowerCase().includes(q);
                                                        })
                                                    );
                                                }
                                                // Advanced filters
                                                Object.entries(recordFilters).forEach(([propId, filter]) => {
                                                    displayRecords = displayRecords.filter(r => {
                                                        const v = r.values?.[propId];
                                                        if (v === undefined || v === null) return false;
                                                        const strV = String(v).toLowerCase();
                                                        const numV = Number(v);
                                                        const numF = Number(filter.value);
                                                        switch (filter.op) {
                                                            case 'contains': return strV.includes(filter.value.toLowerCase());
                                                            case '=': return strV === filter.value.toLowerCase() || (!isNaN(numV) && !isNaN(numF) && numV === numF);
                                                            case '!=': return strV !== filter.value.toLowerCase();
                                                            case '>': return !isNaN(numV) && !isNaN(numF) && numV > numF;
                                                            case '<': return !isNaN(numV) && !isNaN(numF) && numV < numF;
                                                            case '>=': return !isNaN(numV) && !isNaN(numF) && numV >= numF;
                                                            case '<=': return !isNaN(numV) && !isNaN(numF) && numV <= numF;
                                                            default: return true;
                                                        }
                                                    });
                                                });
                                                // Sort
                                                if (recordSortKey) {
                                                    displayRecords = [...displayRecords].sort((a, b) => {
                                                        const va = a.values?.[recordSortKey] ?? '';
                                                        const vb = b.values?.[recordSortKey] ?? '';
                                                        const numA = Number(va), numB = Number(vb);
                                                        const cmp = (!isNaN(numA) && !isNaN(numB)) ? numA - numB : String(va).localeCompare(String(vb));
                                                        return recordSortDir === 'asc' ? cmp : -cmp;
                                                    });
                                                }
                                                // Paginate
                                                const totalFiltered = displayRecords.length;
                                                const totalPages = Math.ceil(totalFiltered / recordsPerPage);
                                                const paged = displayRecords.slice(recordPage * recordsPerPage, (recordPage + 1) * recordsPerPage);
                                                
                                                return (
                                                    <>
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--border-light)]">
                                                        {activeEntity.properties.map((prop, pIdx) => (
                                                            <th 
                                                                key={prop.id || `th-${pIdx}`} 
                                                                className="px-4 py-2.5 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--bg-tertiary)] cursor-pointer hover:text-[var(--text-primary)] select-none"
                                                                onClick={() => {
                                                                    if (recordSortKey === prop.id) {
                                                                        setRecordSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                                    } else {
                                                                        setRecordSortKey(prop.id);
                                                                        setRecordSortDir('asc');
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span>{prop.name}{prop.unit ? ` (${prop.unit})` : ''}</span>
                                                                    {recordSortKey === prop.id && (
                                                                        <span className="text-[var(--accent-primary)]">{recordSortDir === 'asc' ? '↑' : '↓'}</span>
                                                                    )}
                                                                    {/* Sparkline for numeric columns */}
                                                                    {prop.type === 'number' && records.length > 1 && (() => {
                                                                        const vals = records.map(r => Number(r.values?.[prop.id])).filter(n => !isNaN(n));
                                                                        if (vals.length < 2) return null;
                                                                        const min = Math.min(...vals);
                                                                        const max = Math.max(...vals);
                                                                        const range = max - min || 1;
                                                                        const w = 40, h = 12;
                                                                        const points = vals.slice(-20).map((v, i, arr) => 
                                                                            `${(i / (arr.length - 1)) * w},${h - ((v - min) / range) * h}`
                                                                        ).join(' ');
                                                                        return (
                                                                            <svg width={w} height={h} className="ml-1 opacity-60">
                                                                                <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="1" />
                                                                            </svg>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </th>
                                                        ))}
                                                        {Object.values(incomingData).map(({ sourceEntity, sourceProperty }) => (
                                                            <th key={sourceProperty.id} className="px-4 py-2.5 text-[10px] font-medium text-[#419CAF] uppercase tracking-wider bg-[#419CAF]/5">
                                                                {sourceEntity.name}
                                                            </th>
                                                        ))}
                                                        <th className="px-4 py-2.5 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--bg-tertiary)] text-right w-24">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-light)]">
                                                    {paged.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={Math.max(activeEntity.properties.length, 1) + Object.keys(incomingData).length + 1} className="p-8 text-center text-[var(--text-tertiary)] text-sm">
                                                                {records.length === 0 
                                                                    ? (activeEntity.properties.length === 0 
                                                                        ? 'Add properties to define your data structure first.'
                                                                        : 'No records yet. Click "Add Record" to create one.')
                                                                    : `No records match "${recordSearch}"`}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        paged.map(record => (
                                                            <tr key={record.id} onClick={() => handleRecordClick(record, activeEntity)} className="hover:bg-[var(--bg-tertiary)] transition-colors group cursor-pointer">
                                                                {activeEntity.properties.map((prop, pIdx) => {
                                                                    const isEditing = inlineEditCell?.recordId === record.id && inlineEditCell?.propId === prop.id;
                                                                    const isCalculated = !!prop.formula;
                                                                    const cellValue = isCalculated 
                                                                        ? evaluateFormula(prop.formula!, record, activeEntity.properties)
                                                                        : record.values[prop.id];
                                                                    return (
                                                                        <td 
                                                                            key={prop.id || `td-${pIdx}`} 
                                                                            className={`px-4 py-3 text-sm ${isCalculated ? 'text-[var(--accent-primary)] italic' : 'text-[var(--text-secondary)]'}`}
                                                                            onDoubleClick={() => {
                                                                                if (!isCalculated && (prop.type === 'text' || prop.type === 'number')) {
                                                                                    setInlineEditCell({ recordId: record.id, propId: prop.id });
                                                                                    setInlineEditValue(record.values[prop.id] ?? '');
                                                                                }
                                                                            }}
                                                                            title={isCalculated ? `Formula: ${prop.formula}` : undefined}
                                                                        >
                                                                            {isEditing ? (
                                                                                <input
                                                                                    autoFocus
                                                                                    type={prop.type === 'number' ? 'number' : 'text'}
                                                                                    value={inlineEditValue}
                                                                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                                                                    onBlur={saveInlineEdit}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') saveInlineEdit();
                                                                                        if (e.key === 'Escape') setInlineEditCell(null);
                                                                                    }}
                                                                                    className="w-full px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--accent-primary)] rounded focus:outline-none text-[var(--text-primary)]"
                                                                                />
                                                                            ) : (
                                                                                renderCellValue(prop, cellValue)
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
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
                                                                        <td key={sourceProperty.id} className="px-4 py-3 text-sm text-[var(--text-secondary)] bg-[#419CAF]/5">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {linkedRecords.length > 0 ? linkedRecords.map(lr => (
                                                                                    <button
                                                                                        key={lr.id}
                                                                                        onClick={(e) => { e.stopPropagation(); handleRecordClick(lr, sourceEntity); }}
                                                                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#419CAF]/10 text-[#419CAF] hover:bg-[#419CAF]/20 transition-colors"
                                                                                    >
                                                                                        {getRecordDisplayName(lr, sourceEntity)}
                                                                                    </button>
                                                                                )) : <span className="text-[var(--text-tertiary)] text-xs">-</span>}
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleEditRecord(record, activeEntity); }}
                                                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                                                                            title="Edit record"
                                                                        >
                                                                            <PencilSimple size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (confirm('Delete this record?')) deleteRecord(record.id);
                                                                            }}
                                                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                            title="Delete record"
                                                                        >
                                                                            <Trash size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                                    {/* Pagination footer */}
                                                    {totalPages > 1 && (
                                                        <div className="px-4 py-2.5 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                                                            <span>
                                                                {recordPage * recordsPerPage + 1}-{Math.min((recordPage + 1) * recordsPerPage, totalFiltered)} of {totalFiltered}
                                                                {totalFiltered !== records.length && ` (filtered from ${records.length})`}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => setRecordPage(p => Math.max(0, p - 1))}
                                                                    disabled={recordPage === 0}
                                                                    className="px-2 py-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-colors"
                                                                >
                                                                    Previous
                                                                </button>
                                                                <span className="px-2 font-medium text-[var(--text-secondary)]">
                                                                    {recordPage + 1} / {totalPages}
                                                                </span>
                                                                <button
                                                                    onClick={() => setRecordPage(p => Math.min(totalPages - 1, p + 1))}
                                                                    disabled={recordPage >= totalPages - 1}
                                                                    className="px-2 py-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-colors"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Side Panel for Record Details */}
                        {selectedRecord && selectedRecordEntity && (
                            <div className="absolute inset-y-0 right-0 w-96 bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border-light)] z-50 flex flex-col">
                                <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                                    <div>
                                        <h2 className="text-lg font-normal text-[var(--text-primary)]">
                                            {getRecordDisplayName(selectedRecord, selectedRecordEntity)}
                                        </h2>
                                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-normal mt-1">
                                            {selectedRecordEntity.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {
                                                handleEditRecord(selectedRecord, selectedRecordEntity);
                                                setSelectedRecord(null);
                                            }}
                                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-full transition-colors"
                                            title="Edit record"
                                        >
                                            <PencilSimple size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('Delete this record?')) {
                                                    deleteRecord(selectedRecord.id);
                                                    setSelectedRecord(null);
                                                }
                                            }}
                                            className="p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                            title="Delete record"
                                        >
                                            <Trash size={20} />
                                        </button>
                                        <button
                                            onClick={() => setSelectedRecord(null)}
                                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                                        >
                                            <X size={20} weight="light" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {selectedRecordEntity.properties.map((prop, pIdx) => (
                                        <div key={prop.id || `detail-${pIdx}`}>
                                            <label className="block text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                                                {prop.name}
                                            </label>
                                            <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--border-light)]">
                                                {prop.type === 'relation' ? (
                                                    renderCellValue(prop, selectedRecord.values[prop.id])
                                                ) : (
                                                    selectedRecord.values[prop.id] || '-'
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-4 border-t border-[var(--border-light)]">
                                        <label className="block text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                                            Record ID
                                        </label>
                                        <p className="text-xs font-mono text-[var(--text-tertiary)]">{selectedRecord.id}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Smart Import Modal */}
                        {isImportModalOpen && activeEntity && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                                    {/* Header */}
                                    <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between flex-shrink-0">
                                        <div>
                                            <h2 className="text-lg font-medium text-[var(--text-primary)]">Import Data</h2>
                                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                                Import to <span className="text-[#419CAF]">{activeEntity.name}</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { setIsImportModalOpen(false); resetImportState(); }}
                                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Content - Scrollable */}
                                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                        {importStep === 'source' && (
                                            <div className="space-y-5">
                                                {/* Drag & Drop Zone */}
                                                <div
                                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                                                    onDragLeave={() => setIsDraggingFile(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDraggingFile(false);
                                                        const file = e.dataTransfer.files[0];
                                                        if (file) handleImportFile(file);
                                                    }}
                                                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                                                        isDraggingFile 
                                                            ? 'border-[#419CAF] bg-[#419CAF]/5' 
                                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                                            isDraggingFile ? 'bg-[#419CAF]/10' : 'bg-[var(--bg-tertiary)]'
                                                        }`}>
                                                            <Download size={24} className={`rotate-180 ${isDraggingFile ? 'text-[#419CAF]' : 'text-[var(--text-tertiary)]'}`} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                Drop your file here
                                                            </p>
                                                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                                or{' '}
                                                                <label className="text-[#419CAF] hover:underline cursor-pointer">
                                                                    browse
                                                                    <input
                                                                        type="file"
                                                                        accept=".csv,.json"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleImportFile(file);
                                                                        }}
                                                                        className="hidden"
                                                                    />
                                                                </label>
                                                            </p>
                                                        </div>
                                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">
                                                            Supports CSV, JSON
                                                        </p>
                                                    </div>
                                                </div>

                                                {importError && (
                                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                                        {importError}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {importStep === 'preview' && (
                                            <div className="space-y-5">
                                                {/* Import Mode Selector */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setImportMode('new')}
                                                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${
                                                            importMode === 'new'
                                                                ? 'border-[#419CAF] bg-[#419CAF]/10 text-[#419CAF]'
                                                                : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'
                                                        }`}
                                                    >
                                                        <div className="font-semibold">Create New Entity</div>
                                                        <div className="text-[10px] mt-0.5 opacity-70">
                                                            {importFile?.name.replace(/\.(csv|json)$/i, '')}
                                                        </div>
                                                    </button>
                                                    {activeEntity && (
                                                        <button
                                                            onClick={() => setImportMode('existing')}
                                                            className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${
                                                                importMode === 'existing'
                                                                    ? 'border-[#419CAF] bg-[#419CAF]/10 text-[#419CAF]'
                                                                    : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'
                                                            }`}
                                                        >
                                                            <div className="font-semibold">Add to Existing</div>
                                                            <div className="text-[10px] mt-0.5 opacity-70">{activeEntity.name}</div>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Warning for existing mode */}
                                                {importMode === 'existing' && activeEntity && (
                                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-500">
                                                        Column names must match existing properties exactly. Properties: {activeEntity.properties.map(p => p.name).join(', ') || 'None'}
                                                    </div>
                                                )}

                                                {/* Stats */}
                                                <div className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        <span className="text-sm text-[var(--text-primary)]">
                                                            <strong>{importData.length}</strong> rows
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-[#419CAF]"></div>
                                                        <span className="text-sm text-[var(--text-primary)]">
                                                            <strong>{importColumns.filter(c => c.include).length}</strong> columns
                                                        </span>
                                                    </div>
                                                    {importFile && (
                                                        <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                                                            {importFile.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Column mapping */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs font-medium text-[var(--text-secondary)]">
                                                            Column Mapping ({importColumns.length} columns)
                                                        </p>
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
                                                        {/* Fixed header */}
                                                        <div className="bg-[var(--bg-tertiary)] text-[10px] uppercase text-[var(--text-tertiary)] grid grid-cols-[32px_1fr_100px_150px] border-b border-[var(--border-light)]">
                                                            <div className="px-3 py-2"></div>
                                                            <div className="px-3 py-2">Column</div>
                                                            <div className="px-3 py-2">Type</div>
                                                            <div className="px-3 py-2">Sample</div>
                                                        </div>
                                                        {/* Scrollable body */}
                                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                            {importColumns.map((col, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`grid grid-cols-[32px_1fr_100px_150px] border-b border-[var(--border-light)] last:border-b-0 ${!col.include ? 'opacity-40' : ''}`}
                                                                >
                                                                    <div className="px-3 py-2 flex items-center">
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
                                                                    </div>
                                                                    <div className="px-3 py-2 text-sm font-medium text-[var(--text-primary)] truncate">
                                                                        {col.name}
                                                                    </div>
                                                                    <div className="px-3 py-2">
                                                                        <select
                                                                            value={col.detectedType}
                                                                            onChange={(e) => {
                                                                                const updated = [...importColumns];
                                                                                updated[idx].detectedType = e.target.value as PropertyType;
                                                                                setImportColumns(updated);
                                                                            }}
                                                                            className="w-full px-2 py-1 text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-[var(--text-primary)]"
                                                                        >
                                                                            <option value="text">Text</option>
                                                                            <option value="number">Number</option>
                                                                            <option value="json">JSON</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="px-3 py-2 text-[var(--text-tertiary)] font-mono text-[10px] truncate">
                                                                        {String(col.sample ?? '')}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Preview data */}
                                                <div>
                                                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">
                                                        Data Preview (first 5 rows)
                                                    </p>
                                                    <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                                        <div className="overflow-x-auto max-h-[150px] custom-scrollbar">
                                                            <table className="w-full text-xs">
                                                                <thead className="sticky top-0">
                                                                    <tr className="bg-[var(--bg-tertiary)]">
                                                                        {importColumns.filter(c => c.include).slice(0, 10).map((col, idx) => (
                                                                            <th key={idx} className="px-3 py-2 text-left text-[var(--text-tertiary)] font-medium whitespace-nowrap">
                                                                                {col.name}
                                                                            </th>
                                                                        ))}
                                                                        {importColumns.filter(c => c.include).length > 10 && (
                                                                            <th className="px-3 py-2 text-left text-[var(--text-tertiary)] font-medium whitespace-nowrap">
                                                                                +{importColumns.filter(c => c.include).length - 10} more
                                                                            </th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-[var(--border-light)]">
                                                                    {importData.slice(0, 5).map((row, rowIdx) => (
                                                                        <tr key={rowIdx}>
                                                                            {importColumns.filter(c => c.include).slice(0, 10).map((col, colIdx) => (
                                                                                <td key={colIdx} className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap max-w-[150px] truncate">
                                                                                    {String(row[col.name] ?? '')}
                                                                                </td>
                                                                            ))}
                                                                            {importColumns.filter(c => c.include).length > 10 && (
                                                                                <td className="px-3 py-2 text-[var(--text-tertiary)]">...</td>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>

                                                {importError && (
                                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                                        {importError}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {importStep === 'importing' && (
                                            <div className="py-10 text-center">
                                                <div className="w-16 h-16 mx-auto mb-4 relative">
                                                    <svg className="animate-spin" viewBox="0 0 100 100">
                                                        <circle 
                                                            cx="50" cy="50" r="40" 
                                                            fill="none" 
                                                            stroke="var(--border-light)" 
                                                            strokeWidth="8"
                                                        />
                                                        <circle 
                                                            cx="50" cy="50" r="40" 
                                                            fill="none" 
                                                            stroke="#419CAF" 
                                                            strokeWidth="8"
                                                            strokeLinecap="round"
                                                            strokeDasharray={`${importProgress * 2.51} 251`}
                                                            transform="rotate(-90 50 50)"
                                                        />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-[var(--text-primary)]">
                                                        {importProgress}%
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--text-primary)] font-medium">
                                                    Importing {importData.length} records...
                                                </p>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                    This may take a moment
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    {importStep !== 'importing' && (
                                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                                            <div>
                                                {importStep === 'preview' && (
                                                    <button
                                                        onClick={() => { setImportStep('source'); setImportError(null); }}
                                                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                    >
                                                        ← Back
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setIsImportModalOpen(false); resetImportState(); }}
                                                    className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                {importStep === 'preview' && (
                                                    <button
                                                        onClick={executeImport}
                                                        disabled={importColumns.filter(c => c.include).length === 0}
                                                        className="px-4 py-2 bg-[#419CAF] hover:bg-[#3a8a9d] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {importMode === 'new' 
                                                            ? `Create Entity with ${importData.length} Records`
                                                            : `Add ${importData.length} Records`
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Create Entity Modal */}
                        {isCreatingEntity && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                        <h2 className="text-sm font-normal text-[var(--text-primary)]">Create New Entity</h2>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Entity Name</label>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newEntityName}
                                                onChange={(e) => setNewEntityName(e.target.value)}
                                                placeholder="e.g. Products"
                                                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
                                            <textarea
                                                value={newEntityDescription}
                                                onChange={(e) => setNewEntityDescription(e.target.value)}
                                                placeholder="Describe what this entity represents..."
                                                rows={3}
                                                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none resize-none placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                        <button
                                            onClick={() => setIsCreatingEntity(false)}
                                            className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateEntity}
                                            disabled={!newEntityName.trim()}
                                            className="px-3 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-xs font-medium hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-normal text-[var(--text-primary)] mb-4">{editingRecordId ? 'Edit Record' : 'Add New Record'}</h2>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {currentSchema.properties.map((prop, propIndex) => {
                                            if (prop.type === 'relation' && prop.relatedEntityId) {
                                                const relatedInfo = relatedData[prop.relatedEntityId];
                                                return (
                                                    <div key={prop.id || `form-rel-${propIndex}`}>
                                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{prop.name}</label>
                                                        <select
                                                            multiple
                                                            value={newRecordValues[prop.id] || []}
                                                            onChange={(e) => {
                                                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                                                setNewRecordValues({ ...newRecordValues, [prop.id]: selectedOptions });
                                                            }}
                                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] focus:outline-none min-h-[100px] appearance-none cursor-pointer hover:border-[var(--border-medium)] transition-colors"
                                                        >
                                                            {relatedInfo?.records.map(rec => (
                                                                <option key={rec.id} value={rec.id}>
                                                                    {getRecordDisplayName(rec, relatedInfo.entity)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Hold Ctrl/Cmd to select multiple</p>
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
                                                    <div key={prop.id || `form-file-${propIndex}`}>
                                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{prop.name}</label>
                                                        <div className="space-y-2">
                                                            {fileInfo && (
                                                                <div className="flex items-center gap-2 p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                                                    <Paperclip size={16} className="text-violet-500" weight="light" />
                                                                    <span className="text-sm text-violet-500 truncate flex-1">
                                                                        {fileInfo.originalName || fileInfo.filename}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNewRecordValues({ ...newRecordValues, [prop.id]: '' })}
                                                                        className="p-1 hover:bg-violet-500/20 rounded transition-colors"
                                                                    >
                                                                        <X size={14} className="text-violet-500" weight="light" />
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
                                                                    className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-[var(--border-medium)] rounded-lg cursor-pointer hover:border-violet-500 hover:bg-violet-500/5 transition-colors ${uploadingFiles[prop.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {uploadingFiles[prop.id] ? (
                                                                        <>
                                                                            <SpinnerGap size={16} className="animate-spin text-violet-500" weight="light" />
                                                                            <span className="text-sm text-[var(--text-tertiary)]">Uploading...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Paperclip size={16} className="text-[var(--text-tertiary)]" weight="light" />
                                                                            <span className="text-sm text-[var(--text-tertiary)]">
                                                                                {fileInfo ? 'Replace file' : 'Choose file'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </label>
                                                            </div>
                                                            <p className="text-xs text-[var(--text-tertiary)]">PDF, Word, Excel, images, or text files (max 50MB)</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={prop.id || `form-input-${propIndex}`}>
                                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{prop.name}</label>
                                                    {prop.type === 'json' ? (
                                                        <textarea
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter valid JSON for ${prop.name}...`}
                                                            rows={4}
                                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:outline-none font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                                        />
                                                    ) : (
                                                        <input
                                                            type={prop.type === 'number' ? 'number' : 'text'}
                                                            value={newRecordValues[prop.id] || ''}
                                                            onChange={(e) => setNewRecordValues({ ...newRecordValues, [prop.id]: e.target.value })}
                                                            placeholder={`Enter ${prop.name}...`}
                                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Incoming Relations Section */}
                                        {Object.keys(incomingData).length > 0 && (
                                            <>
                                                <div className="border-t border-[var(--border-light)] pt-4 mt-4">
                                                    <p className="text-xs font-normal text-[var(--accent-primary)] uppercase tracking-wide mb-3">
                                                        Incoming Relations
                                                    </p>
                                                </div>
                                                {Object.entries(incomingData).map(([propId, { sourceEntity, sourceProperty, records: sourceRecords }]) => (
                                                    <div key={propId}>
                                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                                            {sourceEntity.name} <span className="text-[var(--text-tertiary)] font-normal">({sourceProperty.name})</span>
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
                                                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--accent-primary)]/30 rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:outline-none min-h-[100px] text-[var(--text-primary)]"
                                                        >
                                                            {sourceRecords.map(rec => (
                                                                <option key={rec.id} value={rec.id}>
                                                                    {getRecordDisplayName(rec, sourceEntity)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Hold Ctrl/Cmd to select multiple</p>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6">
                                        <button
                                            onClick={() => { setIsAddingRecord(false); setNewRecordValues({}); setEditingRecordId(null); setEditingSchema(null); setEditingIncomingSelections({}); }}
                                            className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveRecord}
                                            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:bg-[var(--accent-primary-hover)] transition-colors"
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
                                <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-normal text-[var(--text-primary)] mb-2">
                                        Edit Relation
                                    </h2>
                                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                                        Select which <span className="font-medium text-[var(--accent-primary)]">{editingIncomingRelation.sourceEntity.name}</span> records 
                                        should link to this record via <span className="font-medium">{editingIncomingRelation.sourceProperty.name}</span>
                                    </p>

                                    <div className="max-h-[300px] overflow-y-auto border border-[var(--border-light)] rounded-lg divide-y divide-[var(--border-light)]">
                                        {editingIncomingRelation.sourceRecords.length === 0 ? (
                                            <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                                                No records available in {editingIncomingRelation.sourceEntity.name}
                                            </div>
                                        ) : (
                                            editingIncomingRelation.sourceRecords.map(record => {
                                                const isSelected = editingIncomingRelation.selectedSourceRecordIds.includes(record.id);
                                                return (
                                                    <label
                                                        key={record.id}
                                                        className={`flex items-center p-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors ${isSelected ? 'bg-[var(--accent-primary)]/10' : ''}`}
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
                                                            className="w-4 h-4 text-[var(--accent-primary)] border-[var(--border-medium)] rounded focus:ring-[var(--accent-primary)]"
                                                        />
                                                        <span className={`ml-3 text-sm ${isSelected ? 'text-[var(--accent-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
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
                                            className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveIncomingRelationChanges}
                                            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:bg-[var(--accent-primary-hover)] transition-colors"
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
                </div>
                </main>
            </div>
        </div>
    );
}