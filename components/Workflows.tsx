import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FlowArrow as Workflow, Lightning as Zap, Play, CheckCircle, WarningCircle as AlertCircle, ArrowRight, ArrowLeft, X, FloppyDisk as Save, FolderOpen, Trash, PlayCircle, Check, XCircle, Database, Wrench, MagnifyingGlass as Search, CaretDoubleLeft as ChevronsLeft, CaretDoubleRight as ChevronsRight, Sparkle as Sparkles, Code, PencilSimple as Edit, SignOut as LogOut, ChatCircle as MessageSquare, Globe, Leaf, Share as Share2, UserCheck, GitMerge, FileXls as FileSpreadsheet, FileText, UploadSimple as Upload, Columns, DotsSixVertical as GripVertical, Users, Envelope as Mail, BookOpen, Copy, Eye, Clock, ClockCounterClockwise as History, ArrowsOut as Maximize2, MagnifyingGlassPlus as ZoomIn, MagnifyingGlassMinus as ZoomOut, Robot as Bot, DeviceMobile as Smartphone, ChartBar as BarChart3, User, Calendar, CaretRight as ChevronRight, CaretDown as ChevronDown, CaretUp as ChevronUp, Plus, Folder, ShieldCheck as Shield, Terminal, Tag, DotsThreeVertical as MoreVertical, WebhooksLogo as Webhook, Flask as FlaskConical, TrendUp, Bell, FilePdf, Bug, Pi, WhatsappLogo, TextAa } from '@phosphor-icons/react';
import { NodeConfigSidePanel } from './NodeConfigSidePanel';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { PromptInput } from './PromptInput';
import { ProfileMenu, UserAvatar } from './ProfileMenu';
import { AIPromptSection } from './AIPromptSection';
import { Pagination } from './Pagination';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useCollaborativeCursors } from '../hooks/useCollaborativeCursors';
import { generateUUID } from '../utils/uuid';

// Import modular workflow types, constants and utilities
// Using explicit path to avoid conflict with Workflows.tsx on case-insensitive filesystems
import {
  // Types
  type WorkflowNode,
  type Connection,
  type DraggableItem,
  // Constants
  DRAGGABLE_ITEMS as WORKFLOW_DRAGGABLE_ITEMS,
  CANVAS_CONSTANTS,
  NODE_ICONS,
  // Templates
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
  // Node utilities
  getNodeDefinition,
  getNodeDisplayName,
  getNodeSummary,
  getStatusStyles,
  validateNodeConfig,
  isTriggerNode,
  // Helper utilities (from utils module)
  getNodeColor as getNodeColorUtil,
  isNodeConfigured as isNodeConfiguredUtil,
  getNodeTopTag as getNodeTopTagUtil,
  getNodeIconColorUtil,
  getNodeIconBg as getNodeIconBgUtil,
  getCategoryColors as getCategoryColorsUtil,
  // Views
  WorkflowsListView,
  type WorkflowListItem,
  // Modals
  TemplatesGalleryModal,
  ExecutionHistoryModal,
  WorkflowRunnerModal,
  // Hooks
  useWorkflowHistory,
} from './Workflows/index';

// Import extracted config panel components
import {
  HttpConfigPanel, WebhookConfigPanel, WebhookResponseConfigPanel,
  MySQLConfigPanel, SAPConfigPanel, OsiPiConfigPanel,
  FranmitConfigPanel, ConveyorConfigPanel, LIMSConfigPanel,
  StatisticalConfigPanel, AlertAgentConfigPanel, PdfReportConfigPanel,
  EsiosConfigPanel, AddFieldConfigPanel, ManualInputConfigPanel,
  EmailConfigPanel, SMSConfigPanel, WhatsAppConfigPanel,
  ConditionConfigPanel, JoinConfigPanel, SplitColumnsConfigPanel,
  RenameColumnsConfigPanel, VisualizationConfigPanel, ClimatiqConfigPanel,
  HumanApprovalConfigPanel, ExcelConfigPanel, PdfConfigPanel,
  SaveRecordsConfigPanel, LLMConfigPanel, PythonConfigPanel,
  ScheduleConfigPanel,
} from './Workflows/panels';

// Import node execution hook
import { useNodeExecution } from './Workflows/hooks/useNodeExecution';

// Import extracted modal components
import { DataPreviewModal } from './Workflows/modals/DataPreviewModal';
import { ExecutionHistoryInlineModal } from './Workflows/modals/ExecutionHistoryInlineModal';
import { FeedbackPopupModal } from './Workflows/modals/FeedbackPopupModal';
import { ExitConfirmationModal } from './Workflows/modals/ExitConfirmationModal';
import { QuickConnectModal } from './Workflows/modals/QuickConnectModal';
import { TagsManageModal } from './Workflows/modals/TagsManageModal';
import { TemplatesGalleryInlineModal } from './Workflows/modals/TemplatesGalleryInlineModal';
import { TemplatePreviewModal } from './Workflows/modals/TemplatePreviewModal';
import { AIAssistantSidePanel } from './Workflows/modals/AIAssistantSidePanel';
import { WorkflowEditorToolbar } from './Workflows/modals/WorkflowEditorToolbar';
import { NodePaletteSidebar } from './Workflows/modals/NodePaletteSidebar';

// Use imported DRAGGABLE_ITEMS from workflows module
const DRAGGABLE_ITEMS = WORKFLOW_DRAGGABLE_ITEMS;

// AI Workflow Assistant interfaces (local to this component)
interface AIWorkflowMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    workflowSuggestion?: WorkflowSuggestion;
}

interface WorkflowSuggestion {
    type: 'nodes' | 'connections' | 'modification';
    description: string;
    nodes?: WorkflowNode[];
    connections?: Connection[];
    status: 'pending' | 'accepted' | 'rejected';
}

interface WorkflowsProps {
    entities: any[];
    onViewChange?: (view: string) => void;
    onEntityCreated?: () => void;
}

export const Workflows: React.FC<WorkflowsProps> = ({ entities, onViewChange, onEntityCreated }) => {
    const { workflowId: urlWorkflowId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    
    // Undo/Redo history
    const { canUndo, canRedo, undo, redo, pushState } = useWorkflowHistory({
        maxHistoryLength: 50,
    });
    const isUndoRedoRef = useRef(false);
    const lastHistoryStateRef = useRef<string>('');
    
    // Save state to history when nodes/connections change (debounced)
    useEffect(() => {
        if (isUndoRedoRef.current) return;
        if (nodes.length === 0 && connections.length === 0) return;
        
        const stateKey = JSON.stringify({ n: nodes.length, c: connections.length, ids: nodes.map(n => n.id).join(',') });
        if (stateKey === lastHistoryStateRef.current) return;
        
        const timeoutId = setTimeout(() => {
            lastHistoryStateRef.current = stateKey;
            pushState({ nodes, connections });
        }, 500);
        
        return () => clearTimeout(timeoutId);
    }, [nodes, connections, pushState]);
    
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    const [draggingItem, setDraggingItem] = useState<DraggableItem | null>(null);
    const [workflowName, setWorkflowName] = useState<string>('Untitled Workflow');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(urlWorkflowId === 'new' ? null : urlWorkflowId || null);
    
    // Track the last loaded workflow ID to avoid re-loading
    const lastLoadedWorkflowIdRef = useRef<string | null>(null);
    
    // Collaborative cursors and real-time sync
    const { 
        remoteCursors, 
        remoteUsers,
        sendCursorPosition,
        sendNodeMove,
        sendNodeAdd,
        sendNodeDelete,
        sendConnectionAdd,
        sendConnectionDelete,
        sendNodePropsUpdate,
        sendWorkflowRunStart,
        sendWorkflowRunComplete,
        isConnected: wsConnected, 
        myColor,
        activeUsers 
    } = useCollaborativeCursors({
        workflowId: currentWorkflowId,
        user,
        enabled: !!currentWorkflowId,
        onNodeUpdate: (nodeId, x, y) => {
            // Update node position from remote user
            setNodes(prev => prev.map(n => 
                n.id === nodeId ? { ...n, x, y } : n
            ));
        },
        onNodeAdded: (node) => {
            // Add node from remote user
            setNodes(prev => {
                // Check if node already exists
                if (prev.some(n => n.id === node.id)) return prev;
                return [...prev, node];
            });
        },
        onNodeDeleted: (nodeId) => {
            // Delete node from remote user
            setNodes(prev => prev.filter(n => n.id !== nodeId));
            setConnections(prev => prev.filter(c => 
                c.fromNodeId !== nodeId && c.toNodeId !== nodeId
            ));
        },
        onConnectionAdded: (connection) => {
            // Add connection from remote user
            setConnections(prev => {
                if (prev.some(c => c.id === connection.id)) return prev;
                return [...prev, connection];
            });
        },
        onConnectionDeleted: (connectionId) => {
            // Delete connection from remote user
            setConnections(prev => prev.filter(c => c.id !== connectionId));
        },
        onNodePropsUpdated: (nodeId, updates) => {
            // Update node properties from remote user
            setNodes(prev => prev.map(n => 
                n.id === nodeId ? { 
                    ...n, 
                    ...updates,
                    // Ensure status type is correct
                    status: updates.status as WorkflowNode['status'] ?? n.status
                } : n
            ));
        },
        onWorkflowRunning: (userName) => {
            // Show notification that another user started running
            console.log(`${userName} started running the workflow`);
        },
        onWorkflowCompleted: (userName) => {
            // Show notification that another user finished running
            console.log(`${userName} finished running the workflow`);
        }
    });
    const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [workflowTags, setWorkflowTags] = useState<string[]>([]);
    const [showTagsModal, setShowTagsModal] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [nodeCustomTitle, setNodeCustomTitle] = useState<string>(''); // General state for node custom titles
    const [viewingDataNodeId, setViewingDataNodeId] = useState<string | null>(null);
    const [configuringConditionNodeId, setConfiguringConditionNodeId] = useState<string | null>(null);
    const [conditionField, setConditionField] = useState<string>('');
    const [conditionOperator, setConditionOperator] = useState<string>('equals');
    const [conditionValue, setConditionValue] = useState<string>('');
    const [configuringAddFieldNodeId, setConfiguringAddFieldNodeId] = useState<string | null>(null);
    const [configuringSaveNodeId, setConfiguringSaveNodeId] = useState<string | null>(null);
    const [saveEntityId, setSaveEntityId] = useState<string>('');
    const [isCreatingNewEntity, setIsCreatingNewEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);
    const [localCreatedEntities, setLocalCreatedEntities] = useState<Array<{ id: string; name: string; properties?: any[] }>>([]);

    // Sidebar State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Recents']));

    // LLM Node State
    const [configuringLLMNodeId, setConfiguringLLMNodeId] = useState<string | null>(null);
    const [llmPrompt, setLlmPrompt] = useState<string>('');
    // Python Node State
    const [configuringPythonNodeId, setConfiguringPythonNodeId] = useState<string | null>(null);
    const [pythonCode, setPythonCode] = useState<string>('def process(data):\n    # Modify data here\n    return data');
    const [pythonAiPrompt, setPythonAiPrompt] = useState<string>('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [isDebuggingPython, setIsDebuggingPython] = useState(false);
    const [debugSuggestion, setDebugSuggestion] = useState<string | null>(null);

    // Join Node State
    const [configuringJoinNodeId, setConfiguringJoinNodeId] = useState<string | null>(null);
    const [joinStrategy, setJoinStrategy] = useState<'concat' | 'mergeByKey'>('concat');
    const [joinType, setJoinType] = useState<'inner' | 'outer'>('inner');
    const [joinKey, setJoinKey] = useState<string>('');

    // Split Columns Node State
    const [configuringSplitColumnsNodeId, setConfiguringSplitColumnsNodeId] = useState<string | null>(null);
    // Excel Input Node State
    const [configuringExcelNodeId, setConfiguringExcelNodeId] = useState<string | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [excelPreviewData, setExcelPreviewData] = useState<{ headers: string[], data: any[], rowCount: number } | null>(null);
    const [isParsingExcel, setIsParsingExcel] = useState(false);

    // PDF Input Node State
    const [configuringPdfNodeId, setConfiguringPdfNodeId] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfPreviewData, setPdfPreviewData] = useState<{ text: string, pages: number, fileName: string } | null>(null);
    const [isParsingPdf, setIsParsingPdf] = useState(false);

    // Manual Input Node State
    const [configuringManualInputNodeId, setConfiguringManualInputNodeId] = useState<string | null>(null);
    // HTTP Node State
    const [configuringHttpNodeId, setConfiguringHttpNodeId] = useState<string | null>(null);
    const [httpUrl, setHttpUrl] = useState<string>('');

    // Webhook Node State
    const [configuringWebhookNodeId, setConfiguringWebhookNodeId] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string>('');
    const [webhookToken, setWebhookToken] = useState<string>('');

    // Webhook Response Node State
    const [configuringWebhookResponseNodeId, setConfiguringWebhookResponseNodeId] = useState<string | null>(null);

    // MySQL Node State
    const [configuringMySQLNodeId, setConfiguringMySQLNodeId] = useState<string | null>(null);
    const [mysqlQuery, setMysqlQuery] = useState<string>('SELECT * FROM ');

    // SAP Fetch Node State
    const [configuringSAPNodeId, setConfiguringSAPNodeId] = useState<string | null>(null);
    // Send Email Node State
    const [configuringEmailNodeId, setConfiguringEmailNodeId] = useState<string | null>(null);
    const [emailTo, setEmailTo] = useState<string>('');
    // Send SMS Node State
    const [configuringSMSNodeId, setConfiguringSMSNodeId] = useState<string | null>(null);
    const [smsTo, setSmsTo] = useState<string>('');
    // Send WhatsApp Node State
    const [configuringWhatsAppNodeId, setConfiguringWhatsAppNodeId] = useState<string | null>(null);
    const [whatsappTo, setWhatsappTo] = useState<string>('');
    // Rename Columns Node State
    const [configuringRenameColumnsNodeId, setConfiguringRenameColumnsNodeId] = useState<string | null>(null);
    const [columnRenames, setColumnRenames] = useState<{ oldName: string; newName: string }[]>([{ oldName: '', newName: '' }]);

    // Data Visualization Node State
    const [configuringVisualizationNodeId, setConfiguringVisualizationNodeId] = useState<string | null>(null);
    const [visualizationPrompt, setVisualizationPrompt] = useState<string>('');
    const [generatedWidget, setGeneratedWidget] = useState<WidgetConfig | null>(null);
    const [isGeneratingWidget, setIsGeneratingWidget] = useState<boolean>(false);
    // Schedule Node State
    const [configuringScheduleNodeId, setConfiguringScheduleNodeId] = useState<string | null>(null);
    const [scheduleIntervalValue, setScheduleIntervalValue] = useState<string>('5');
    const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
    const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(true);
    const [scheduleType, setScheduleType] = useState<'interval' | 'specific'>('interval');
    const [scheduleTime, setScheduleTime] = useState<string>('09:00');
    const [scheduleRepeat, setScheduleRepeat] = useState<'daily' | 'weekly' | 'none'>('daily');

    // OPC UA Node State
    const [configuringOpcuaNodeId, setConfiguringOpcuaNodeId] = useState<string | null>(null);
    // MQTT Node State
    const [configuringMqttNodeId, setConfiguringMqttNodeId] = useState<string | null>(null);
    // OSIsoft PI Node State
    const [configuringOsiPiNodeId, setConfiguringOsiPiNodeId] = useState<string | null>(null);
    // FranMIT Node State
    const [configuringFranmitNodeId, setConfiguringFranmitNodeId] = useState<string | null>(null);
    // Conveyor Node State
    const [configuringConveyorNodeId, setConfiguringConveyorNodeId] = useState<string | null>(null);
    const [conveyorSpeed, setConveyorSpeed] = useState<string>('');
    const [conveyorLength, setConveyorLength] = useState<string>('');
    // Unsaved Changes Confirmation
    const [showExitConfirmation, setShowExitConfirmation] = useState<boolean>(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

    // ESIOS Node State
    const [configuringEsiosNodeId, setConfiguringEsiosNodeId] = useState<string | null>(null);
    const [esiosArchiveId, setEsiosArchiveId] = useState<string>('1001'); // PVPC indicator ID
    // Climatiq Node State
    const [configuringClimatiqNodeId, setConfiguringClimatiqNodeId] = useState<string | null>(null);
    const [climatiqQuery, setClimatiqQuery] = useState<string>('Passenger Car');
    const [climatiqSearchResults, setClimatiqSearchResults] = useState<any[]>([]);
    const [climatiqSelectedIndex, setClimatiqSelectedIndex] = useState<number | null>(null);
    const [climatiqSearching, setClimatiqSearching] = useState<boolean>(false);

    // Human Approval Node State
    const [configuringHumanApprovalNodeId, setConfiguringHumanApprovalNodeId] = useState<string | null>(null);
    const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
    // LIMS Fetch Node State
    const [configuringLIMSNodeId, setConfiguringLIMSNodeId] = useState<string | null>(null);
    const [limsServerUrl, setLimsServerUrl] = useState<string>('');
    const [limsApiKey, setLimsApiKey] = useState<string>('');
    const [limsEndpoint, setLimsEndpoint] = useState<string>('materials');
    // Statistical Analysis Node State
    const [configuringStatisticalNodeId, setConfiguringStatisticalNodeId] = useState<string | null>(null);
    const [statisticalMethod, setStatisticalMethod] = useState<'pca' | 'spc' | 'regression' | 'goldenBatch'>('goldenBatch');
    const [goldenBatchId, setGoldenBatchId] = useState<string>('');

    // Access control state
    const [noAccessWorkflowInfo, setNoAccessWorkflowInfo] = useState<{ workflowId: string; workflowName: string; organizationName: string } | null>(null);
    const [showNoAccessModal, setShowNoAccessModal] = useState(false);
    const [isRequestingAccess, setIsRequestingAccess] = useState(false);

    // Alert Agent Node State
    const [configuringAlertAgentNodeId, setConfiguringAlertAgentNodeId] = useState<string | null>(null);
    const [alertConditions, setAlertConditions] = useState<string>('[]');
    const [alertSeverity, setAlertSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
    const [alertActions, setAlertActions] = useState<string[]>(['email']);
    // PDF Report Node State
    const [configuringPdfReportNodeId, setConfiguringPdfReportNodeId] = useState<string | null>(null);
    const [pdfTemplate, setPdfTemplate] = useState<string>('standard');
    const [dataViewTab, setDataViewTab] = useState<'input' | 'output'>('output');
    const [splitViewTab, setSplitViewTab] = useState<'input' | 'outputA' | 'outputB'>('outputA');
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [canvasZoom, setCanvasZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);
    const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);

    // Workflow Runner State
    const [showRunnerModal, setShowRunnerModal] = useState<boolean>(false);
    const [runnerInputs, setRunnerInputs] = useState<{ [nodeId: string]: string }>({});
    const [runnerFileInputs, setRunnerFileInputs] = useState<{ [nodeId: string]: File | null }>({});
    const [runnerOutputs, setRunnerOutputs] = useState<{ [nodeId: string]: any }>({});
    const [isRunningWorkflow, setIsRunningWorkflow] = useState<boolean>(false);

    // Execution History State
    const [showExecutionHistory, setShowExecutionHistory] = useState<boolean>(false);
    const [executionHistory, setExecutionHistory] = useState<any[]>([]);
    const [loadingExecutions, setLoadingExecutions] = useState<boolean>(false);
    const [selectedExecution, setSelectedExecution] = useState<any>(null);

    // Workflows List View State
    const [currentView, setCurrentView] = useState<'list' | 'canvas'>('list');
    const [workflowSearchQuery, setWorkflowSearchQuery] = useState<string>('');
    const [currentWorkflowPage, setCurrentWorkflowPage] = useState(1);
    const workflowsPerPage = 6;
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);

    // Export Modal State
    const [showEmbedCode, setShowEmbedCode] = useState(false);

    // Human Approval Waiting State
    const [waitingApprovalNodeId, setWaitingApprovalNodeId] = useState<string | null>(null);
    const [pendingApprovalData, setPendingApprovalData] = useState<{ inputData: any, resolve: () => void } | null>(null);

    // AI Workflow Assistant State (Chat Panel)
    const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
    const [aiChatMessages, setAiChatMessages] = useState<AIWorkflowMessage[]>([]);
    const [aiChatInput, setAiChatInput] = useState<string>('');
    const [isAiChatLoading, setIsAiChatLoading] = useState<boolean>(false);
    const [pendingWorkflowSuggestion, setPendingWorkflowSuggestion] = useState<WorkflowSuggestion | null>(null);
    const aiChatMessagesEndRef = useRef<HTMLDivElement>(null);

    // Node Feedback Popup State
    const [feedbackPopupNodeId, setFeedbackPopupNodeId] = useState<string | null>(null);
    const [feedbackPopupNodeType, setFeedbackPopupNodeType] = useState<string>('');
    const [feedbackPopupNodeLabel, setFeedbackPopupNodeLabel] = useState<string>('');
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
    const [aiPrompt, setAiPrompt] = useState<string>('');
    const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState<boolean>(false);
    const [aiGeneratedWorkflow, setAiGeneratedWorkflow] = useState<{ nodes: any[], connections: any[] } | null>(null);
    const [showAiConfirmDialog, setShowAiConfirmDialog] = useState<boolean>(false);
    
    // Quick Connect Component Search State
    const [showComponentSearch, setShowComponentSearch] = useState<boolean>(false);
    const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
    const [componentSearchQuery, setComponentSearchQuery] = useState<string>('');

    // Templates Modal State
    const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
    const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>('All');
    const [isCopyingTemplate, setIsCopyingTemplate] = useState<boolean>(false);
    const [previewingTemplate, setPreviewingTemplate] = useState<WorkflowTemplate | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Auto-save functionality
    useEffect(() => {
        if (!currentWorkflowId || !hasUnsavedChanges) return;
        
        const autoSaveTimer = setTimeout(async () => {
            if (workflowName.trim()) {
                setAutoSaveStatus('saving');
                try {
                    const data = { nodes, connections };
                    const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            name: workflowName, 
                            data,
                            tags: workflowTags,
                            lastEditedByName: user?.name || user?.email?.split('@')[0] || 'Unknown'
                        }),
                        credentials: 'include'
                    });
                    if (res.ok) {
                        setAutoSaveStatus('saved');
                        setHasUnsavedChanges(false);
                        setTimeout(() => setAutoSaveStatus(null), 2000);
                    }
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    setAutoSaveStatus(null);
                }
            }
        }, 2000); // Auto-save after 2 seconds of inactivity

        return () => clearTimeout(autoSaveTimer);
    }, [nodes, connections, workflowName, workflowTags, currentWorkflowId, hasUnsavedChanges]);

    // Generate shareable URL and embed code
    const getShareableUrl = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/form/${currentWorkflowId || 'draft'}`;
    };

    const getEmbedCode = () => {
        const url = getShareableUrl();
        return `<iframe 
  src="${url}"
  width="100%" 
  height="600" 
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  allow="clipboard-write"
></iframe>`;
    };

    const copyToClipboard = (text: string, message: string) => {
        navigator.clipboard.writeText(text);
        showToast(message, 'success');
    };

    // Copy a template to user's workflows
    const copyTemplateToWorkflows = async (template: WorkflowTemplate) => {
        setIsCopyingTemplate(true);
        try {
            // Generate new unique IDs for nodes and connections
            const idMapping: { [oldId: string]: string } = {};
            
            // Scale factor to spread out nodes (canvas nodes are 320px wide, templates use 200px gaps)
            const SPACING_SCALE = 2.5;
            
            // Find the minimum x and y to use as origin for scaling
            const minX = Math.min(...template.nodes.map(n => n.x));
            const minY = Math.min(...template.nodes.map(n => n.y));
            
            const newNodes = template.nodes.map(node => {
                const newId = generateUUID();
                idMapping[node.id] = newId;
                
                // Scale positions relative to the minimum point
                const scaledX = minX + (node.x - minX) * SPACING_SCALE;
                const scaledY = minY + (node.y - minY) * SPACING_SCALE;
                
                return {
                    ...node,
                    id: newId,
                    x: scaledX,
                    y: scaledY,
                    status: undefined, // Reset status
                    inputData: undefined,
                    outputData: undefined,
                };
            });

            const newConnections = template.connections.map(conn => ({
                ...conn,
                id: generateUUID(),
                fromNodeId: idMapping[conn.fromNodeId],
                toNodeId: idMapping[conn.toNodeId],
            }));

            const workflowData = { nodes: newNodes, connections: newConnections };
            const workflowName = `${template.name} (Copy)`;

            // Create the new workflow via API
            const res = await fetch(`${API_BASE}/workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: workflowName,
                    data: workflowData,
                    createdByName: user?.name || user?.email?.split('@')[0] || 'Unknown'
                }),
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Failed to create workflow from template');
            
            const newWorkflow = await res.json();
            
            // Refresh the workflows list
            await fetchWorkflows();
            
            // Close templates modal
            setShowTemplatesModal(false);
            
            showToast(`Template "${template.name}" copied to your workflows!`, 'success');

            // Optionally open the new workflow
            navigate(`/workflow/${newWorkflow.id}`);
            setCurrentView('canvas');
        } catch (error) {
            console.error('Error copying template:', error);
            showToast('Failed to copy template', 'error');
        } finally {
            setIsCopyingTemplate(false);
        }
    };

    // Get filtered templates by category
    const filteredTemplates = WORKFLOW_TEMPLATES.filter(template =>
        selectedTemplateCategory === 'All' || template.category === selectedTemplateCategory
    );

    // Template categories in fixed order
    const templateCategories = ['All', 'Compliance', 'Process Optimization', 'Planning', 'Reporting', 'Quality Assurance'];

    const fetchWorkflows = async () => {
        try {
            const res = await fetch(`${API_BASE}/workflows`, { credentials: 'include' });
            if (!res.ok) {
                console.error('Failed to fetch workflows');
                setSavedWorkflows([]);
                return;
            }
            const data = await res.json();

            if (Array.isArray(data)) {
                setSavedWorkflows(data);
                // URL syncing is now handled by the useEffect above
            } else {
                console.error('Workflows API returned non-array:', data);
                setSavedWorkflows([]);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
            setSavedWorkflows([]);
        }
    };

    const loadWorkflow = async (id: string, updateUrl = true) => {
        try {
            const res = await fetch(`${API_BASE}/workflows/${id}`, { credentials: 'include' });
            
            // Check if user doesn't have access to this workflow
            if (res.status === 403) {
                const errorData = await res.json();
                // Show no access modal with workflow info
                setNoAccessWorkflowInfo({
                    workflowId: id,
                    workflowName: errorData.workflowName || 'Unknown Workflow',
                    organizationName: errorData.organizationName || 'Unknown Organization'
                });
                setShowNoAccessModal(true);
                return;
            }
            
            if (!res.ok) throw new Error('Failed to load workflow');
            const workflow = await res.json();
            setWorkflowName(workflow.name);
            setCurrentWorkflowId(workflow.id);
            setNodes(workflow.data.nodes || []);
            setConnections(workflow.data.connections || []);
            setWorkflowTags(workflow.tags || []);
            lastLoadedWorkflowIdRef.current = workflow.id;
            // Update URL to reflect the loaded workflow
            if (updateUrl) {
                navigate(`/workflow/${workflow.id}`, { replace: true });
            }
        } catch (error) {
            console.error('Error loading workflow:', error);
        }
    };

    const requestWorkflowAccess = async () => {
        if (!noAccessWorkflowInfo) return;
        
        setIsRequestingAccess(true);
        try {
            const res = await fetch(`${API_BASE}/workflows/${noAccessWorkflowInfo.workflowId}/request-access`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (res.ok) {
                showToast('Access request sent successfully', 'success');
                setShowNoAccessModal(false);
                navigate('/workflows');
            } else {
                const errorData = await res.json();
                showToast(errorData.error || 'Failed to request access', 'error');
            }
        } catch (error) {
            console.error('Error requesting access:', error);
            showToast('Failed to request access', 'error');
        } finally {
            setIsRequestingAccess(false);
        }
    };

    const saveWorkflow = async () => {
        if (!workflowName.trim()) {
            alert('Please enter a workflow name');
            return;
        }

        setIsSaving(true);
        try {
            // Limit data size while preserving execution state for UX
            // This prevents 413 "Request Entity Too Large" errors while keeping useful info
            const MAX_RECORDS_TO_SAVE = 50; // Limit records to prevent large payloads
            
            const cleanedNodes = nodes.map(node => {
                // Helper to limit array data
                const limitData = (data: any) => {
                    if (!data) return undefined;
                    if (Array.isArray(data)) {
                        return data.slice(0, MAX_RECORDS_TO_SAVE);
                    }
                    // For objects with trueRecords/falseRecords (condition nodes)
                    if (data.trueRecords || data.falseRecords) {
                        return {
                            ...data,
                            trueRecords: data.trueRecords?.slice(0, MAX_RECORDS_TO_SAVE),
                            falseRecords: data.falseRecords?.slice(0, MAX_RECORDS_TO_SAVE)
                        };
                    }
                    return data;
                };
                
                // Keep status and executionResult (small, needed for UI state)
                // Limit data arrays to prevent large payloads
                const cleanedNode = {
                    ...node,
                    outputData: limitData(node.outputData),
                    inputData: limitData(node.inputData),
                    inputDataA: limitData(node.inputDataA),
                    inputDataB: limitData(node.inputDataB),
                    data: limitData(node.data),
                    // Keep status and executionResult for showing green/red states
                    status: node.status,
                    executionResult: node.executionResult,
                    conditionResult: node.conditionResult
                };
                
                // For excelInput nodes with GCS storage, keep only essential config
                // (previewData is limited, full data is in GCS)
                if (cleanedNode.config?.parsedData && !cleanedNode.config?.useGCS) {
                    // For inline data, limit to first 100 rows to prevent large payloads
                    cleanedNode.config = {
                        ...cleanedNode.config,
                        parsedData: cleanedNode.config.parsedData.slice(0, 100)
                    };
                }
                
                return cleanedNode;
            });
            
            const data = { nodes: cleanedNodes, connections };

            if (currentWorkflowId) {
                // Update existing
                const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: workflowName, 
                        data,
                        tags: workflowTags,
                        lastEditedByName: user?.name || user?.email?.split('@')[0] || 'Unknown'
                    }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Failed to update workflow');
            } else {
                // Create new
                const res = await fetch(`${API_BASE}/workflows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: workflowName, 
                        data,
                        tags: workflowTags,
                        createdByName: user?.name || user?.email?.split('@')[0] || 'Unknown'
                    }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Failed to create workflow');
                const newWorkflow = await res.json();
                setCurrentWorkflowId(newWorkflow.id);
                // Update URL with new workflow ID
                navigate(`/workflow/${newWorkflow.id}`, { replace: true });
            }

            await fetchWorkflows();
            showToast('Workflow saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving workflow:', error);
            showToast('Failed to save workflow', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            const res = await fetch(`${API_BASE}/workflows/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to delete workflow');
            await fetchWorkflows();
            if (currentWorkflowId === id) {
                setCurrentWorkflowId(null);
            setWorkflowName('Untitled Workflow');
            setNodes([]);
            setWorkflowTags([]);
                setConnections([]);
                navigate('/workflows', { replace: true });
            }
            setToast({ message: 'Workflow deleted successfully', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Error deleting workflow:', error);
            setToast({ message: 'Failed to delete workflow', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const newWorkflow = () => {
        setCurrentWorkflowId(null);
            setWorkflowName('Untitled Workflow');
            setNodes([]);
            setWorkflowTags([]);
        setConnections([]);
        setConnectingFrom(null);
        navigate('/workflow/new', { replace: true });
    };

    // View Navigation Functions
    const openWorkflow = (id: string) => {
        loadWorkflow(id); // This will update the URL
        setCurrentView('canvas');
    };

    const backToList = () => {
        // Show confirmation popup if there might be unsaved changes
        if (currentView === 'canvas' && (nodes.length > 0 || workflowName.trim())) {
            setShowExitConfirmation(true);
        } else {
            navigate('/workflows');
        }
        // The useEffect will handle setting currentView to 'list'
    };

    const confirmExitWithoutSaving = () => {
        setShowExitConfirmation(false);
        setHasUnsavedChanges(false);
        navigate('/workflows');
    };

    const confirmExitWithSaving = async () => {
        setShowExitConfirmation(false);
        await saveWorkflow();
        navigate('/workflows');
    };

    // Load workflows on mount
    useEffect(() => {
        fetchWorkflows();
    }, []);

    
    // Set correct tab when opening data preview modal
    useEffect(() => {
        if (!viewingDataNodeId) return;
        
        const node = nodes.find(n => n.id === viewingDataNodeId);
        if (!node) return;
        
        const isSplitColumnsNode = node.type === 'splitColumns';
        if (isSplitColumnsNode) return; // Split columns has its own tab logic
        
        // Check what data is available
        const hasInput = node.inputData !== undefined && node.inputData !== null;
        const hasOutput = (node.outputData !== undefined && node.outputData !== null) || 
                         (node.data !== undefined && node.data !== null);
        
        // Set tab to output if available, otherwise input
        if (hasOutput) {
            setDataViewTab('output');
        } else if (hasInput) {
            setDataViewTab('input');
        }
    }, [viewingDataNodeId, nodes]);
    
    // Debug: Measure heights when canvas view is active
    useEffect(() => {
        if (currentView !== 'canvas') return;
        
        const measureHeights = () => {
            // #region agent log
            const root = document.querySelector('[data-tutorial="workflows-content"]');
            const editor = document.querySelector('[data-tutorial="workflow-editor"]');
            const topBar = editor?.querySelector('div:first-child');
            const contentArea = contentAreaRef.current;
            const sidebar = sidebarRef.current;
            const scrollArea = sidebarScrollRef.current;
            
            const measurements = {
                viewportHeight: window.innerHeight,
                rootHeight: root?.getBoundingClientRect().height || 0,
                rootComputedHeight: root ? window.getComputedStyle(root).height : 'none',
                editorHeight: editor?.getBoundingClientRect().height || 0,
                editorComputedHeight: editor ? window.getComputedStyle(editor).height : 'none',
                topBarHeight: topBar?.getBoundingClientRect().height || 0,
                contentAreaHeight: contentArea?.getBoundingClientRect().height || 0,
                contentAreaComputedHeight: contentArea ? window.getComputedStyle(contentArea).height : 'none',
                sidebarHeight: sidebar?.getBoundingClientRect().height || 0,
                sidebarScrollHeight: sidebar?.scrollHeight || 0,
                sidebarComputedHeight: sidebar ? window.getComputedStyle(sidebar).height : 'none',
                scrollAreaHeight: scrollArea?.getBoundingClientRect().height || 0,
                scrollAreaScrollHeight: scrollArea?.scrollHeight || 0,
                scrollAreaComputedHeight: scrollArea ? window.getComputedStyle(scrollArea).height : 'none',
            };
            
            // Debug logging disabled to prevent performance issues
            // fetch('http://127.0.0.1:7243/ingest/fd608484-a148-4cb0-9431-b6404421dcde',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Workflows.tsx:1020',message:'Height measurements',data:measurements,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
            // #endregion
        };
        
        // Measure after a short delay to allow DOM to settle
        // Throttle resize events to prevent excessive calls
        let resizeTimeout: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(measureHeights, 200);
        };
        
        const timeoutId = setTimeout(measureHeights, 100);
        window.addEventListener('resize', handleResize);
        
        return () => {
            clearTimeout(timeoutId);
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', handleResize);
        };
    }, [currentView, isSidebarCollapsed]);
    
    // Sync URL with component state
    useEffect(() => {
        const isListView = location.pathname === '/workflows';
        const isNewWorkflow = location.pathname === '/workflow/new';
        const isWorkflowView = location.pathname.startsWith('/workflow/') && !isNewWorkflow;
        
        if (isListView) {
            setCurrentView('list');
            setCurrentWorkflowId(null);
            setNodes([]);
            setConnections([]);
            setWorkflowName('Untitled Workflow');
            lastLoadedWorkflowIdRef.current = null;
        } else if (isNewWorkflow) {
            setCurrentView('canvas');
            setCurrentWorkflowId(null);
            setNodes([]);
            setConnections([]);
            setWorkflowName('Untitled Workflow');
            setWorkflowTags([]);
            lastLoadedWorkflowIdRef.current = null;
        } else if (isWorkflowView && urlWorkflowId) {
            // On /workflow/:id, load the workflow if not already loaded
            if (urlWorkflowId !== lastLoadedWorkflowIdRef.current) {
                loadWorkflow(urlWorkflowId, false);
            }
            setCurrentView('canvas');
        }
    }, [location.pathname, urlWorkflowId]);

    const createNewWorkflow = () => {
        newWorkflow();
        // useEffect will handle setting currentView to 'canvas' based on /workflow/new URL
    };

    // Close ALL config panels — prevents overlapping side panels
    const closeAllConfigs = () => {
        setConfiguringNodeId(null);
        setConfiguringConditionNodeId(null);
        setConfiguringAddFieldNodeId(null);
        setConfiguringSaveNodeId(null);
        setConfiguringLLMNodeId(null);
        setConfiguringPythonNodeId(null);
        setConfiguringJoinNodeId(null);
        setConfiguringSplitColumnsNodeId(null);
        setConfiguringExcelNodeId(null);
        setConfiguringPdfNodeId(null);
        setConfiguringManualInputNodeId(null);
        setConfiguringHttpNodeId(null);
        setConfiguringWebhookNodeId(null);
        setConfiguringWebhookResponseNodeId(null);
        setConfiguringMySQLNodeId(null);
        setConfiguringSAPNodeId(null);
        setConfiguringEmailNodeId(null);
        setConfiguringSMSNodeId(null);
        setConfiguringWhatsAppNodeId(null);
        setConfiguringRenameColumnsNodeId(null);
        setConfiguringVisualizationNodeId(null);
        setConfiguringScheduleNodeId(null);
        setConfiguringOpcuaNodeId(null);
        setConfiguringMqttNodeId(null);
        setConfiguringOsiPiNodeId(null);
        setConfiguringFranmitNodeId(null);
        setConfiguringConveyorNodeId(null);
        setConfiguringEsiosNodeId(null);
        setConfiguringClimatiqNodeId(null);
        setConfiguringHumanApprovalNodeId(null);
        setConfiguringLIMSNodeId(null);
        setConfiguringStatisticalNodeId(null);
        setConfiguringAlertAgentNodeId(null);
        setConfiguringPdfReportNodeId(null);
    };

    // Generic save handler for extracted panel components
    const handlePanelSave = (nodeId: string, config: Record<string, any>, label?: string) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId
                ? { ...n, ...(label ? { label } : {}), config: { ...n.config, ...config } }
                : n
        ));
    };

    const openNodeConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'fetchData') {
            setConfiguringNodeId(nodeId);
            setSelectedEntityId(node.config?.entityId || '');
            setNodeCustomTitle(node.config?.customName || '');
        }
    };

    const saveNodeConfig = () => {
        if (!configuringNodeId || !selectedEntityId) return;

        const entity = entities.find(e => e.id === selectedEntityId);
        const defaultLabel = entity?.name || 'Fetch Data';
        const finalLabel = nodeCustomTitle.trim() || defaultLabel;
        
        setNodes(prev => prev.map(n =>
            n.id === configuringNodeId
                ? { 
                    ...n, 
                    label: finalLabel,
                    config: { 
                        entityId: selectedEntityId, 
                        entityName: entity?.name || '',
                        customName: nodeCustomTitle.trim() || undefined
                    } 
                }
                : n
        ));
        setConfiguringNodeId(null);
        setSelectedEntityId('');
        setNodeCustomTitle('');
    };

    // Node Feedback Functions
    const openFeedbackPopup = (nodeType: string, nodeLabel: string) => {
        setFeedbackPopupNodeType(nodeType);
        setFeedbackPopupNodeLabel(nodeLabel);
        setFeedbackText('');
        setFeedbackPopupNodeId(nodeType); // Using nodeType as a simple identifier
    };

    const closeFeedbackPopup = () => {
        setFeedbackPopupNodeId(null);
        setFeedbackPopupNodeType('');
        setFeedbackPopupNodeLabel('');
        setFeedbackText('');
    };

    const submitFeedback = async () => {
        if (!feedbackText.trim()) return;
        
        setIsSubmittingFeedback(true);
        try {
            const response = await fetch(`${API_BASE}/node-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    nodeType: feedbackPopupNodeType,
                    nodeLabel: feedbackPopupNodeLabel,
                    feedbackText: feedbackText.trim(),
                    workflowId: currentWorkflowId,
                    workflowName: workflowName
                })
            });

            if (response.ok) {
                setToast({ message: 'Thank you for your feedback!', type: 'success' });
                closeFeedbackPopup();
            } else {
                setToast({ message: 'Failed to submit feedback', type: 'error' });
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            setToast({ message: 'Failed to submit feedback', type: 'error' });
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const openConditionConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'condition') setConfiguringConditionNodeId(nodeId);
    };

    const openAddFieldConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'addField') setConfiguringAddFieldNodeId(nodeId);
    };

    const openJoinConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'join') setConfiguringJoinNodeId(nodeId);
    };

    const openSplitColumnsConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'splitColumns') setConfiguringSplitColumnsNodeId(nodeId);
    };

    const openExcelConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'excelInput') {
            setConfiguringExcelNodeId(nodeId);
            setExcelFile(null);
            // Reconstruct preview data from node config
            const rawData = node.config?.parsedData || node.config?.previewData || null;
            if (rawData && Array.isArray(rawData) && rawData.length > 0) {
                setExcelPreviewData({
                    headers: Object.keys(rawData[0]),
                    data: rawData,
                    rowCount: node.config?.rowCount || rawData.length
                });
            } else {
                setExcelPreviewData(null);
            }
        }
    };

    const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setExcelFile(file);
        setIsParsingExcel(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // If we have a workflow and node, try to use GCS for large files
            if (currentWorkflowId && configuringExcelNodeId) {
                formData.append('workflowId', currentWorkflowId);
                formData.append('nodeId', configuringExcelNodeId);
                
                const res = await fetch(`${API_BASE}/upload-spreadsheet-gcs`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!res.ok) {
                    throw new Error('Failed to parse file');
                }

                const result = await res.json();
                
                if (result.useGCS) {
                    // Data stored in GCS - save reference only
                    setExcelPreviewData({
                        headers: result.headers,
                        data: result.previewData.slice(0, 5),
                        rowCount: result.totalRows
                    });

                    setNodes(prev => prev.map(n =>
                        n.id === configuringExcelNodeId
                            ? {
                                ...n,
                                label: file.name,
                                config: {
                                    ...n.config,
                                    fileName: result.fileName,
                                    headers: result.headers,
                                    gcsPath: result.gcsPath,
                                    previewData: result.previewData,
                                    rowCount: result.totalRows,
                                    useGCS: true
                                }
                            }
                            : n
                    ));
                    
                    showToast(`Uploaded ${result.totalRows} rows to cloud storage`, 'success');
                } else {
                    // Small file - data inline
                    setExcelPreviewData({
                        headers: result.headers,
                        data: result.data.slice(0, 5),
                        rowCount: result.rowCount
                    });

                    setNodes(prev => prev.map(n =>
                        n.id === configuringExcelNodeId
                            ? {
                                ...n,
                                label: file.name,
                                config: {
                                    ...n.config,
                                    fileName: result.fileName,
                                    headers: result.headers,
                                    parsedData: result.data,
                                    rowCount: result.rowCount,
                                    useGCS: false
                                }
                            }
                            : n
                    ));
                }
            } else {
                // Fallback to old endpoint if no workflow context
                const res = await fetch(`${API_BASE}/parse-spreadsheet`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!res.ok) {
                    throw new Error('Failed to parse file');
                }

                const result = await res.json();
                setExcelPreviewData({
                    headers: result.headers,
                    data: result.data.slice(0, 5),
                    rowCount: result.rowCount
                });

                if (configuringExcelNodeId) {
                    setNodes(prev => prev.map(n =>
                        n.id === configuringExcelNodeId
                            ? {
                                ...n,
                                label: file.name,
                                config: {
                                    ...n.config,
                                    fileName: file.name,
                                    headers: result.headers,
                                    parsedData: result.data,
                                    rowCount: result.rowCount
                                }
                            }
                            : n
                    ));
                }
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            showToast('Failed to parse file. Make sure it\'s a valid Excel or CSV file.', 'error');
            setExcelPreviewData(null);
        } finally {
            setIsParsingExcel(false);
        }
    };

    const closeExcelConfig = () => {
        setConfiguringExcelNodeId(null);
        setExcelFile(null);
        setExcelPreviewData(null);
    };

    const openPdfConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'pdfInput') {
            setConfiguringPdfNodeId(nodeId);
            setPdfFile(null);
            setPdfPreviewData(node.config?.pdfText ? { text: node.config.pdfText, pages: node.config.pages, fileName: node.config.fileName || 'document.pdf' } : null);
        }
    };

    const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPdfFile(file);
        setIsParsingPdf(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Send workflowId and nodeId so backend can upload to GCS for large PDFs
            if (currentWorkflowId && configuringPdfNodeId) {
                formData.append('workflowId', currentWorkflowId);
                formData.append('nodeId', configuringPdfNodeId);
            }

            const res = await fetch(`${API_BASE}/parse-pdf`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to parse PDF');
            }

            const result = await res.json();

            if (result.useGCS) {
                // PDF text stored in GCS - save reference only
                setPdfPreviewData({
                    text: result.pdfTextPreview,
                    pages: result.pages,
                    fileName: result.fileName
                });

                if (configuringPdfNodeId) {
                    setNodes(prev => prev.map(n =>
                        n.id === configuringPdfNodeId
                            ? {
                                ...n,
                                label: file.name,
                                config: {
                                    ...n.config,
                                    fileName: file.name,
                                    gcsPath: result.gcsPath,
                                    pdfTextPreview: result.pdfTextPreview,
                                    pages: result.pages,
                                    info: result.info,
                                    metadata: result.metadata,
                                    useGCS: true,
                                    pdfText: undefined // Remove inline text to save space
                                }
                            }
                            : n
                    ));
                }

                showToast(`PDF uploaded to cloud storage (${result.pages} pages)`, 'success');
            } else {
                // Small PDF or GCS unavailable - store inline
                setPdfPreviewData({
                    text: result.text,
                    pages: result.pages,
                    fileName: result.fileName
                });

                if (configuringPdfNodeId) {
                    setNodes(prev => prev.map(n =>
                        n.id === configuringPdfNodeId
                            ? {
                                ...n,
                                label: file.name,
                                config: {
                                    ...n.config,
                                    fileName: file.name,
                                    pdfText: result.text,
                                    pages: result.pages,
                                    info: result.info,
                                    metadata: result.metadata,
                                    useGCS: false
                                }
                            }
                            : n
                    ));
                }
            }
        } catch (error) {
            console.error('Error parsing PDF:', error);
            showToast('Failed to parse PDF. Make sure it\'s a valid PDF file.', 'error');
            setPdfPreviewData(null);
        } finally {
            setIsParsingPdf(false);
        }
    };

    const closePdfConfig = () => {
        setConfiguringPdfNodeId(null);
        setPdfFile(null);
        setPdfPreviewData(null);
    };

    const openSaveRecordsConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'saveRecords') setConfiguringSaveNodeId(nodeId);
    };

    /** Infer property type from a JS value */
    const inferPropertyType = (value: any): string => {
        if (value === null || value === undefined) return 'text';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'text';
        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
            const num = Number(value);
            if (!isNaN(num) && value.trim() !== '') return 'number';
        }
        return 'text';
    };

    /** Get output data from the parent node connected to a given node.
     *  Falls back to synthesizing from node.config when not yet executed. */
    const getParentNodeOutputData = (nodeId: string): any[] | null => {
        const incoming = connections.filter(c => c.toNodeId === nodeId);
        for (const conn of incoming) {
            const parent = nodes.find(n => n.id === conn.fromNodeId);
            if (!parent) continue;

            // 1. Try already-executed output data
            const executed = parent.outputData || parent.data;
            if (executed) {
                const data = parent.type === 'splitColumns'
                    ? (conn as any).outputType === 'B' ? executed.outputB : executed.outputA
                    : executed;
                if (Array.isArray(data) && data.length > 0) return data;
                if (data && typeof data === 'object' && !Array.isArray(data)) return [data];
            }

            // 2. Fallback: synthesize from node config for known types
            if (parent.type === 'manualInput' && parent.config?.inputVarName) {
                const varName = parent.config.inputVarName;
                const varValue = parent.config.inputVarValue || '';
                const parsed = !isNaN(Number(varValue)) && varValue.trim() !== '' ? Number(varValue) : varValue;
                return [{ [varName]: parsed }];
            }
            if (parent.type === 'excelInput' && parent.config?.parsedData && parent.config.parsedData.length > 0) {
                return parent.config.parsedData;
            }
            if (parent.type === 'excelInput' && parent.config?.previewData && parent.config.previewData.length > 0) {
                return parent.config.previewData;
            }
            if (parent.type === 'excelInput' && parent.config?.headers && parent.config.headers.length > 0) {
                // Build a synthetic row with column names
                const row: Record<string, string> = {};
                parent.config.headers.forEach((h: string) => { row[h] = ''; });
                return [row];
            }
        }
        return null;
    };

    /** Create a new entity with auto-detected properties from parent node data */
    const handleCreateNewEntity = async () => {
        if (!newEntityName.trim() || !configuringSaveNodeId) return;
        setIsCreatingEntity(true);

        try {
            const entityId = generateUUID();
            const now = new Date().toISOString();

            // Detect properties from parent node output
            const parentData = getParentNodeOutputData(configuringSaveNodeId);
            const properties: Array<{ id: string; name: string; type: string; defaultValue: string }> = [];

            if (parentData && parentData.length > 0) {
                // Sample first rows to detect columns & types
                const sample = parentData.slice(0, Math.min(5, parentData.length));
                const allKeys = new Set<string>();
                sample.forEach(row => {
                    if (row && typeof row === 'object') {
                        Object.keys(row).forEach(k => allKeys.add(k));
                    }
                });

                // Skip internal/meta keys
                const skipKeys = new Set(['id', 'createdAt', 'updatedAt', 'entityId', 'metadata', 'raw', '__index']);
                allKeys.forEach(key => {
                    if (skipKeys.has(key)) return;
                    // Find first non-null value to infer type
                    let sampleValue: any = undefined;
                    for (const row of sample) {
                        if (row[key] !== null && row[key] !== undefined) {
                            sampleValue = row[key];
                            break;
                        }
                    }
                    properties.push({
                        id: generateUUID(),
                        name: key,
                        type: inferPropertyType(sampleValue),
                        defaultValue: ''
                    });
                });
            }

            // Call API to create entity
            const res = await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: entityId,
                    name: newEntityName.trim(),
                    description: `Created from workflow`,
                    author: 'Workflow',
                    lastEdited: now,
                    entityType: 'generic',
                    properties
                })
            });

            if (!res.ok) throw new Error('Failed to create entity');

            // Add to local cache so the dropdown shows it immediately
            setLocalCreatedEntities(prev => [...prev, { id: entityId, name: newEntityName.trim(), properties }]);

            // Notify parent (App.tsx) to refresh global entities list
            onEntityCreated?.();

            // Select the newly created entity
            setSaveEntityId(entityId);
            setIsCreatingNewEntity(false);
            setNewEntityName('');
        } catch (error) {
            console.error('Error creating entity:', error);
        } finally {
            setIsCreatingEntity(false);
        }
    };

    /** Merged entities list: props + locally created ones */
    const allEntities = React.useMemo(() => {
        const ids = new Set(entities.map(e => e.id));
        const extra = localCreatedEntities.filter(e => !ids.has(e.id));
        return [...entities, ...extra];
    }, [entities, localCreatedEntities]);

    const openLLMConfig = (nodeId: string) => {
        setConfiguringLLMNodeId(nodeId);
    };

    const openPythonConfig = (nodeId: string) => {
        setConfiguringPythonNodeId(nodeId);
    };

    // Debug Python node with AI - analyzes error and suggests fix
    const handleDebugPythonNode = async (node: WorkflowNode) => {
        if (!node.config?.pythonCode || !node.executionResult) return;
        
        // First, open the Python config panel
        setPythonCode(node.config.pythonCode);
        setPythonAiPrompt('');
        setNodeCustomTitle(node.config?.customName || '');
        setConfiguringPythonNodeId(node.id);
        setIsDebuggingPython(true);
        setDebugSuggestion(null);
        
        try {
            // Call OpenAI to analyze the error and suggest a fix
            const response = await fetch(`${API_BASE}/debug-python-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: node.config.pythonCode,
                    error: node.executionResult,
                    inputDataSample: node.inputData?.slice(0, 3) // Send sample of input data for context
                }),
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.fixedCode) {
                    setDebugSuggestion(data.fixedCode);
                    // Show explanation in a toast or in the panel
                    if (data.explanation) {
                        console.log('[Debug AI] Explanation:', data.explanation);
                    }
                }
            }
        } catch (error) {
            console.error('Error debugging Python code:', error);
        } finally {
            setIsDebuggingPython(false);
        }
    };

    const openManualInputConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'manualInput') setConfiguringManualInputNodeId(nodeId);
    };

    const openHttpConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'http') setConfiguringHttpNodeId(nodeId);
    };

    // SAP Node Functions
    const openSAPConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sapFetch') setConfiguringSAPNodeId(nodeId);
    };

    // Webhook Node Functions
    const openWebhookConfig = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'webhook') {
            setConfiguringWebhookNodeId(nodeId);
            // Fetch webhook URL from backend
            try {
                const res = await fetch(`${API_BASE}/workflow/${currentWorkflowId}/webhook-url`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setWebhookUrl(data.webhookUrl || '');
                    setWebhookToken(data.token || '');
                }
            } catch (e) {
                console.error('Failed to fetch webhook URL:', e);
                // Fallback to local URL
                setWebhookUrl(`${window.location.origin.replace(':5173', ':3001')}/api/webhook/${currentWorkflowId}`);
            }
        }
    };

    const closeWebhookConfig = () => {
        setConfiguringWebhookNodeId(null);
        setWebhookUrl('');
        setWebhookToken('');
        setHttpUrl('');
    };

    // Webhook Response Node Functions
    const openWebhookResponseConfig = (nodeId: string) => {
        setConfiguringWebhookResponseNodeId(nodeId);
    };

    const closeWebhookResponseConfig = () => {
        setConfiguringWebhookResponseNodeId(null);
    };

    const updateWebhookResponseConfig = (field: string, value: any) => {
        if (!configuringWebhookResponseNodeId) return;
        setNodes(prev => prev.map(n => {
            if (n.id === configuringWebhookResponseNodeId) {
                return { ...n, config: { ...n.config, [field]: value } };
            }
            return n;
        }));
    };

    const openMySQLConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'mysql') setConfiguringMySQLNodeId(nodeId);
    };

    // OSIsoft PI Node Functions
    const openOsiPiConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'osiPi') setConfiguringOsiPiNodeId(nodeId);
    };

    // FranMIT Node Functions
    const openFranmitConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'franmit') setConfiguringFranmitNodeId(nodeId);
    };

    // Conveyor Node Functions
    const openConveyorConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'conveyor') setConfiguringConveyorNodeId(nodeId);
    };

    const openEmailConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sendEmail') setConfiguringEmailNodeId(nodeId);
    };

    const openSMSConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sendSMS') setConfiguringSMSNodeId(nodeId);
    };

    const openWhatsAppConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sendWhatsApp') setConfiguringWhatsAppNodeId(nodeId);
    };

    const openRenameColumnsConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'action') setConfiguringRenameColumnsNodeId(nodeId);
    };

    const openVisualizationConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'dataVisualization') setConfiguringVisualizationNodeId(nodeId);
    };

    const generateWidgetFromPrompt = async () => {
        if (!configuringVisualizationNodeId || !visualizationPrompt.trim()) return;

        // Get input data from parent node
        const parentConnection = connections.find(c => c.toNodeId === configuringVisualizationNodeId);
        const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
        let inputData: any[] = [];
        
        if (parentNode) {
            if (parentNode.type === 'splitColumns' && parentNode.outputData) {
                inputData = parentConnection.outputType === 'B' 
                    ? parentNode.outputData.outputB || []
                    : parentNode.outputData.outputA || [];
            } else {
                inputData = parentNode.outputData || parentNode.config?.parsedData || [];
            }
        }

        if (!inputData || (Array.isArray(inputData) && inputData.length === 0)) {
            alert('No input data available. Please run the workflow first to populate data.');
            return;
        }

        setIsGeneratingWidget(true);
        try {
            const response = await fetch(`${API_BASE}/generate-widget-from-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: visualizationPrompt,
                    data: inputData
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate widget');
            }

            const widgetConfig = await response.json();
            setGeneratedWidget(widgetConfig);
        } catch (error) {
            console.error('Error generating widget:', error);
            alert(`Failed to generate visualization: ${error.message}`);
        } finally {
            setIsGeneratingWidget(false);
        }
    };

    const openScheduleConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'trigger') setConfiguringScheduleNodeId(nodeId);
    };

    const closeScheduleConfig = () => {
        setConfiguringScheduleNodeId(null);
        setScheduleIntervalValue('5');
        setScheduleIntervalUnit('minutes');
        setScheduleEnabled(true);
        setScheduleType('interval');
        setScheduleTime('09:00');
        setScheduleRepeat('daily');
    };

    const openEsiosConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'esios') setConfiguringEsiosNodeId(nodeId);
    };

    const openClimatiqConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'climatiq') setConfiguringClimatiqNodeId(nodeId);
    };

    const searchClimatiq = async () => {
        if (!climatiqQuery.trim()) return;

        setClimatiqSearching(true);
        setClimatiqSearchResults([]);
        setClimatiqSelectedIndex(null);

        try {
            const response = await fetch(`${API_BASE}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: `https://api.climatiq.io/data/v1/search?query=${encodeURIComponent(climatiqQuery)}&data_version=^20`,
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer TWCZKXAGES4F76M3F468EE3VMC'
                    }
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Climatiq search response:', data);
                // Extract top 10 results
                const results = data.results?.slice(0, 10) || [];
                setClimatiqSearchResults(results);
            } else {
                const errorText = await response.text();
                console.error('Climatiq search failed:', response.status, errorText);
                alert(`Search failed: ${response.status} - ${errorText.substring(0, 100)}`);
            }
        } catch (error) {
            console.error('Climatiq search error:', error);
        } finally {
            setClimatiqSearching(false);
        }
    };

    const generatePythonCode = async () => {
        if (!pythonAiPrompt.trim()) return;

        setIsGeneratingCode(true);
        try {
            // Get input data schema from parent node
            let inputDataSchema: { columns: string[], sampleData?: any[] } | null = null;
            
            if (configuringPythonNodeId) {
                const parentConnection = connections.find(c => c.toNodeId === configuringPythonNodeId);
                if (parentConnection) {
                    const parentNode = nodes.find(n => n.id === parentConnection.fromNodeId);
                    if (parentNode) {
                        // Try to get data from different sources
                        let parentData = parentNode.outputData || parentNode.inputDataA || null;
                        
                        // Handle splitColumns parent node
                        if (parentNode.type === 'splitColumns' && parentNode.outputData) {
                            parentData = parentConnection.outputType === 'B' 
                                ? parentNode.outputData.outputB 
                                : parentNode.outputData.outputA;
                        }
                        
                        // Handle manualInput node
                        if (parentNode.type === 'manualInput' && parentNode.config) {
                            const varName = parentNode.config.inputVarName || 'value';
                            const varValue = parentNode.config.inputVarValue;
                            parentData = [{ [varName]: varValue }];
                        }
                        
                        if (parentData && Array.isArray(parentData) && parentData.length > 0) {
                            const columns = Object.keys(parentData[0]);
                            inputDataSchema = {
                                columns,
                                sampleData: parentData.slice(0, 3) // Send first 3 records as sample
                            };
                            console.log('Python AI - Input data schema:', inputDataSchema);
                        }
                    }
                }
            }

            console.log('Python AI - Sending to API:', { prompt: pythonAiPrompt, inputDataSchema });
            const response = await fetch(`${API_BASE}/python/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: pythonAiPrompt,
                    inputDataSchema 
                }),
                credentials: 'include'
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse JSON:', text);
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate code');
            }

            setPythonCode(data.code);
        } catch (error) {
            console.error('Error generating python code:', error);
            alert(`Failed to generate code: ${error.message}`);
        } finally {
            setIsGeneratingCode(false);
        }
    };

    // Human Approval Node Functions
    const fetchOrganizationUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/organization/users`, { credentials: 'include' });
            if (res.ok) {
                const users = await res.json();
                if (Array.isArray(users)) {
                    setOrganizationUsers(users);
                } else {
                    console.error('Expected array from organization users API, got:', users);
                    setOrganizationUsers([]);
                }
            }
        } catch (error) {
            console.error('Error fetching organization users:', error);
            setOrganizationUsers([]);
        }
    };

    // LIMS Fetch Node Functions
    const openLIMSConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'limsFetch') setConfiguringLIMSNodeId(nodeId);
    };

    // Statistical Analysis Node Functions
    const openStatisticalConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'statisticalAnalysis') setConfiguringStatisticalNodeId(nodeId);
    };

    // Alert Agent Node Functions
    const openAlertAgentConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'alertAgent') setConfiguringAlertAgentNodeId(nodeId);
    };

    // PDF Report Node Functions
    const openPdfReportConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'pdfReport') setConfiguringPdfReportNodeId(nodeId);
    };

    const openHumanApprovalConfig = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'humanApproval') {
            setConfiguringHumanApprovalNodeId(nodeId);
            await fetchOrganizationUsers();
        }
    };

    const handleApproval = (approved: boolean) => {
        if (!waitingApprovalNodeId || !pendingApprovalData) return;

        if (approved) {
            // Resolve the promise to continue workflow
            pendingApprovalData.resolve();
            showToast(`Step approved! Workflow continuing...`, 'success');
        } else {
            // Set node to error state and broadcast
            updateNodeAndBroadcast(waitingApprovalNodeId, { 
                status: 'error' as const, 
                executionResult: 'Rejected by user' 
            });
            // Stop the workflow execution
            setIsRunning(false);
            setIsRunningWorkflow(false);
            showToast('Step rejected. Workflow stopped.', 'error');
        }

        setWaitingApprovalNodeId(null);
        setPendingApprovalData(null);
    };

    // Workflow Runner Functions
    const openWorkflowRunner = () => {
        const inputNodes = nodes.filter(n => n.type === 'manualInput');
        const fileInputNodes = nodes.filter(n => n.type === 'excelInput' || n.type === 'pdfInput');
        
        const initialInputs: { [nodeId: string]: string } = {};

        inputNodes.forEach(node => {
            initialInputs[node.id] = node.config?.inputVarValue || '';
        });

        setRunnerInputs(initialInputs);
        setRunnerOutputs({});
        setShowRunnerModal(true);
    };

    // Execution History Functions
    const loadExecutionHistory = async () => {
        if (!currentWorkflowId) return;
        
        setLoadingExecutions(true);
        try {
            const res = await fetch(`${API_BASE}/workflow/${currentWorkflowId}/executions?limit=20`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                // Parse JSON strings for inputs and nodeResults
                const parsedData = data.map((exec: any) => ({
                    ...exec,
                    inputs: exec.inputs ? (typeof exec.inputs === 'string' ? JSON.parse(exec.inputs) : exec.inputs) : null,
                    nodeResults: exec.nodeResults ? (typeof exec.nodeResults === 'string' ? JSON.parse(exec.nodeResults) : exec.nodeResults) : null
                }));
                setExecutionHistory(parsedData);
            }
        } catch (error) {
            console.error('Failed to load execution history:', error);
        } finally {
            setLoadingExecutions(false);
        }
    };

    const openExecutionHistory = () => {
        loadExecutionHistory();
        setShowExecutionHistory(true);
        setSelectedExecution(null);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const runWorkflowFromRunner = async () => {
        setIsRunningWorkflow(true);
        setRunnerOutputs({});

        try {
            // Process file inputs first
            const fileInputNodes = nodes.filter(n => (n.type === 'excelInput' || n.type === 'pdfInput') && runnerFileInputs[n.id]);
            
            for (const node of fileInputNodes) {
                const file = runnerFileInputs[node.id];
                if (!file) continue;

                const formData = new FormData();
                formData.append('file', file);

                try {
                    if (node.type === 'excelInput') {
                        const res = await fetch(`${API_BASE}/parse-spreadsheet`, {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                        });

                        if (res.ok) {
                            const result = await res.json();
                            setNodes(prev => prev.map(n =>
                                n.id === node.id
                                    ? {
                                        ...n,
                                        label: file.name,
                                        config: {
                                            ...n.config,
                                            fileName: file.name,
                                            headers: result.headers,
                                            parsedData: result.data,
                                            rowCount: result.rowCount
                                        }
                                    }
                                    : n
                            ));
                        }
                    } else if (node.type === 'pdfInput') {
                        const res = await fetch(`${API_BASE}/parse-pdf`, {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                        });

                        if (res.ok) {
                            const result = await res.json();
                            setNodes(prev => prev.map(n =>
                                n.id === node.id
                                    ? {
                                        ...n,
                                        label: file.name,
                                        config: {
                                            ...n.config,
                                            fileName: file.name,
                                            pdfText: result.text,
                                            pages: result.pages,
                                            info: result.info,
                                            metadata: result.metadata
                                        }
                                    }
                                    : n
                            ));
                        }
                    }
                } catch (error) {
                    console.error('Error processing file:', error);
                    showToast(`Failed to process ${file.name}`, 'error');
                }
            }

            // Update manual input node values
            setNodes(prev => prev.map(node => {
                if (node.type === 'manualInput' && runnerInputs[node.id] !== undefined) {
                    return {
                        ...node,
                        config: {
                            ...node.config,
                            inputVarValue: runnerInputs[node.id]
                        }
                    };
                }
                return node;
            }));

            await new Promise(resolve => setTimeout(resolve, 200));
            await runWorkflow();
            await new Promise(resolve => setTimeout(resolve, 500));

            const outputNodes = nodes.filter(n => n.type === 'output');
            const outputs: { [nodeId: string]: any } = {};

            outputNodes.forEach((node) => {
                outputs[node.id] = node.outputData || null;
            });

            setRunnerOutputs(outputs);
        } catch (error) {
            console.error('Error running workflow from runner:', error);
            showToast('Failed to run workflow', 'error');
        } finally {
            setIsRunningWorkflow(false);
        }
    };


    // Helper to update node and broadcast to other users
    const updateNodeAndBroadcast = (nodeId: string, updates: Partial<WorkflowNode>) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, ...updates } : n
        ));
        // Broadcast to other users
        sendNodePropsUpdate(nodeId, updates);
    };

    // Node execution logic (extracted to hook)
    const { executeNode, executeJoinInput, handleRunNode, runWorkflow } = useNodeExecution({
        nodes,
        connections,
        entities,
        setNodes,
        setConnections,
        updateNodeAndBroadcast,
        showToast,
        isRunning,
        setIsRunning,
        currentWorkflowId,
        workflowName,
        saveWorkflow,
        setWaitingApprovalNodeId,
        setPendingApprovalData,
    });

    // AI Workflow Assistant Functions
    const handleGenerateWorkflow = async () => {
        if (!aiPrompt.trim() || isGeneratingWorkflow) return;
        
        setIsGeneratingWorkflow(true);

        // Save prompt as feedback for analytics
        try {
            await fetch(`${API_BASE}/node-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeType: 'workflow_assistant_prompt',
                    nodeLabel: 'AI Workflow Assistant',
                    feedbackText: aiPrompt,
                    workflowId: currentWorkflowId,
                    workflowName: workflowName
                }),
                credentials: 'include'
            });
        } catch (e) {
            // Silent fail - don't block workflow generation
        }

        try {
            const res = await fetch(`${API_BASE}/generate-workflow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    entities: entities.map(e => ({
                        id: e.id,
                        name: e.name,
                        properties: e.properties?.map((p: any) => ({ name: p.name, type: p.type })) || []
                    }))
                }),
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to generate workflow');
            }

            const data = await res.json();
            
            if (data.nodes && data.connections) {
                setAiGeneratedWorkflow(data);
                setShowAiAssistant(false);
                setShowAiConfirmDialog(true);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error generating workflow:', error);
            showToast('Failed to generate workflow. Please try again.', 'error');
        } finally {
            setIsGeneratingWorkflow(false);
        }
    };

    const applyAiWorkflow = (mode: 'replace' | 'add') => {
        if (!aiGeneratedWorkflow) return;

        const { nodes: newNodes, connections: newConnections } = aiGeneratedWorkflow;

        if (mode === 'replace') {
            // Replace: clear canvas and add new nodes
            const processedNodes: WorkflowNode[] = newNodes.map((n: any) => ({
                id: generateUUID(),
                type: n.type,
                label: n.label,
                x: n.x,
                y: n.y,
                config: n.config || {},
                status: 'idle' as const
            }));

            // Map old IDs to new IDs for connections
            const idMap: { [oldId: string]: string } = {};
            newNodes.forEach((n: any, i: number) => {
                idMap[n.id] = processedNodes[i].id;
            });

            const processedConnections: Connection[] = newConnections.map((c: any) => ({
                id: generateUUID(),
                fromNodeId: idMap[c.fromNodeId],
                toNodeId: idMap[c.toNodeId],
                outputType: c.outputType,
                inputPort: c.inputPort
            })).filter((c: Connection) => c.fromNodeId && c.toNodeId);

            setNodes(processedNodes);
            setConnections(processedConnections);
        } else {
            // Add: offset nodes and append to canvas
            const maxX = nodes.length > 0 ? Math.max(...nodes.map(n => n.x)) + 300 : 0;
            const offsetX = maxX;

            const processedNodes: WorkflowNode[] = newNodes.map((n: any) => ({
                id: generateUUID(),
                type: n.type,
                label: n.label,
                x: n.x + offsetX,
                y: n.y,
                config: n.config || {},
                status: 'idle' as const
            }));

            // Map old IDs to new IDs for connections
            const idMap: { [oldId: string]: string } = {};
            newNodes.forEach((n: any, i: number) => {
                idMap[n.id] = processedNodes[i].id;
            });

            const processedConnections: Connection[] = newConnections.map((c: any) => ({
                id: generateUUID(),
                fromNodeId: idMap[c.fromNodeId],
                toNodeId: idMap[c.toNodeId],
                outputType: c.outputType,
                inputPort: c.inputPort
            })).filter((c: Connection) => c.fromNodeId && c.toNodeId);

            setNodes(prev => [...prev, ...processedNodes]);
            setConnections(prev => [...prev, ...processedConnections]);
        }

        // Cleanup
        setShowAiConfirmDialog(false);
        setAiGeneratedWorkflow(null);
        setAiPrompt('');
        showToast(`Workflow ${mode === 'replace' ? 'created' : 'added'} successfully!`, 'success');
    };

    // AI Chat Assistant Functions
    const handleSendWorkflowAiMessage = async () => {
        if (!aiChatInput.trim() || isAiChatLoading) return;

        const userMessage: AIWorkflowMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: aiChatInput,
            timestamp: new Date()
        };

        setAiChatMessages(prev => [...prev, userMessage]);
        setAiChatInput('');
        setIsAiChatLoading(true);

        // Scroll to bottom
        setTimeout(() => {
            aiChatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        try {
            const res = await fetch(`${API_BASE}/workflows/assistant/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: aiChatInput,
                    workflowId: currentWorkflowId,
                    workflowName: workflowName,
                    nodes: nodes,
                    connections: connections,
                    entities: entities.map(e => ({
                        id: e.id,
                        name: e.name,
                        properties: e.properties?.map((p: any) => ({ name: p.name, type: p.type })) || []
                    }))
                }),
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to get AI response');
            }

            const data = await res.json();
            
            const assistantMessage: AIWorkflowMessage = {
                id: `msg-${Date.now()}-assistant`,
                role: 'assistant',
                content: data.message,
                timestamp: new Date(),
                workflowSuggestion: data.suggestion ? {
                    type: data.suggestion.type,
                    description: data.suggestion.description,
                    nodes: data.suggestion.nodes,
                    connections: data.suggestion.connections,
                    status: 'pending'
                } : undefined
            };

            setAiChatMessages(prev => [...prev, assistantMessage]);
            
            if (assistantMessage.workflowSuggestion) {
                setPendingWorkflowSuggestion(assistantMessage.workflowSuggestion);
            }

            // Scroll to bottom
            setTimeout(() => {
                aiChatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

        } catch (error) {
            console.error('Error sending AI message:', error);
            const errorMessage: AIWorkflowMessage = {
                id: `msg-${Date.now()}-error`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setAiChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAiChatLoading(false);
        }
    };

    const handleAcceptWorkflowSuggestion = () => {
        if (!pendingWorkflowSuggestion) return;

        const { type, nodes: suggestedNodes, connections: suggestedConnections } = pendingWorkflowSuggestion;

        if (type === 'nodes' && suggestedNodes) {
            // Add new nodes to canvas
            const processedNodes = suggestedNodes.map(n => ({
                ...n,
                id: generateUUID(),
                status: 'idle' as const
            }));

            setNodes(prev => [...prev, ...processedNodes]);

            if (suggestedConnections) {
                // Create ID mapping
                const idMap: { [key: string]: string } = {};
                suggestedNodes.forEach((oldNode, i) => {
                    idMap[oldNode.id] = processedNodes[i].id;
                });

                const processedConnections = suggestedConnections.map(c => ({
                    ...c,
                    id: generateUUID(),
                    fromNodeId: idMap[c.fromNodeId] || c.fromNodeId,
                    toNodeId: idMap[c.toNodeId] || c.toNodeId
                }));

                setConnections(prev => [...prev, ...processedConnections]);
            }

            showToast('Workflow nodes added successfully!', 'success');
        }

        // Update message status
        setAiChatMessages(prev => prev.map(msg =>
            msg.workflowSuggestion === pendingWorkflowSuggestion
                ? { ...msg, workflowSuggestion: { ...msg.workflowSuggestion!, status: 'accepted' } }
                : msg
        ));

        setPendingWorkflowSuggestion(null);
    };

    const handleRejectWorkflowSuggestion = () => {
        if (!pendingWorkflowSuggestion) return;

        // Update message status
        setAiChatMessages(prev => prev.map(msg =>
            msg.workflowSuggestion === pendingWorkflowSuggestion
                ? { ...msg, workflowSuggestion: { ...msg.workflowSuggestion!, status: 'rejected' } }
                : msg
        ));

        setPendingWorkflowSuggestion(null);
        showToast('Suggestion rejected', 'success');
    };

    const handleDragStart = (e: React.DragEvent, item: DraggableItem) => {
        setDraggingItem(item);
        e.dataTransfer.effectAllowed = 'copy';
        // Set a transparent image or custom drag image if needed, 
        // but default is usually fine for simple cases.
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    // Refs to read current values without recreating handler
    const zoomRef = useRef(canvasZoom);
    const offsetRef = useRef(canvasOffset);
    
    // Keep refs in sync with state
    useEffect(() => {
        zoomRef.current = canvasZoom;
        offsetRef.current = canvasOffset;
    }, [canvasZoom, canvasOffset]);

    // Wheel handler - stable, updates state directly for immediate response
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Read from refs (always current, no stale closure)
            const currentZoom = zoomRef.current;
            const currentOffset = offsetRef.current;
            
            const worldX = (mouseX - currentOffset.x) / currentZoom;
            const worldY = (mouseY - currentOffset.y) / currentZoom;
            
            let zoomDelta: number;
            
            // Always use continuous zoom, but adjust sensitivity
            // Trackpad typically has ctrlKey/metaKey or smaller deltaY values
            const isTrackpad = e.ctrlKey || e.metaKey || Math.abs(e.deltaY) < 50;
            
            if (isTrackpad) {
                // Trackpad: more sensitive, continuous zoom
                // deltaY is negative for zoom in, positive for zoom out
                zoomDelta = 1 - (e.deltaY * 0.015);
            } else {
                // Mouse wheel: less sensitive, still continuous but larger steps
                zoomDelta = 1 - (e.deltaY * 0.003);
            }
            
            const newZoom = Math.min(Math.max(currentZoom * zoomDelta, 0.1), 4);
            const newOffsetX = mouseX - worldX * newZoom;
            const newOffsetY = mouseY - worldY * newZoom;
            
            // Update refs immediately for next event
            zoomRef.current = newZoom;
            offsetRef.current = { x: newOffsetX, y: newOffsetY };
            
            // Update state directly - React batches these automatically
            setCanvasZoom(newZoom);
            setCanvasOffset({ x: newOffsetX, y: newOffsetY });
        };
        
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [currentView]); // Re-attach when view changes (canvas mounts/unmounts)

    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [nodeDragged, setNodeDragged] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Panning logic (Middle mouse or Left mouse on canvas)
        if (e.button === 1 || (e.button === 0 && !draggingNodeId)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
            e.preventDefault();
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setCanvasOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        } else if (draggingNodeId) {
            // Node dragging logic
            if (!canvasRef.current) return;
            const canvasRect = canvasRef.current.getBoundingClientRect();

            // Calculate new position in canvas coordinates, applying the drag offset
            const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom - dragOffset.x;
            const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom - dragOffset.y;

            // Mark that the node was actually dragged (moved)
            setNodeDragged(true);

            setNodes(prev => prev.map(n =>
                n.id === draggingNodeId
                    ? { ...n, x, y }
                    : n
            ));
            
            // Send node position update to other users
            sendNodeMove(draggingNodeId, x, y);
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        setDraggingNodeId(null);
        setDragOffset({ x: 0, y: 0 });
        // Reset nodeDragged after a small delay to allow onClick to check it
        setTimeout(() => setNodeDragged(false), 10);
        // Clear connection drag if dropped on canvas (not on a valid connector)
        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        if (e.button === 0) { // Left click only
            e.stopPropagation(); // Prevent canvas panning
            
            // Calculate offset between mouse position and node position
            // This allows dragging the node from any point, not just the center
            if (canvasRef.current) {
                const canvasRect = canvasRef.current.getBoundingClientRect();
                const mouseX = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
                const mouseY = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;
                
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    setDragOffset({
                        x: mouseX - node.x,
                        y: mouseY - node.y
                    });
                }
            }
            
            setDraggingNodeId(nodeId);
        }
    };

    const resetView = () => {
        setCanvasOffset({ x: 0, y: 0 });
        setCanvasZoom(1);
    };

    // Navigate to a remote user's cursor position
    const goToUserCursor = useCallback((userId: string) => {
        if (!canvasRef.current) return;
        
        // Find all cursor instances for this user (might have multiple tabs)
        const userCursors: { cursor: { x: number; y: number } }[] = [];
        remoteCursors.forEach((remote) => {
            if (remote.user.id === userId && remote.cursor && remote.cursor.x >= 0) {
                userCursors.push({ cursor: remote.cursor });
            }
        });
        
        if (userCursors.length === 0) return;
        
        // Get the first available cursor position
        const cursorPos = userCursors[0].cursor;
        
        // Get canvas dimensions
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        // Calculate new offset to center the user's cursor on screen
        const newOffsetX = centerX - cursorPos.x * canvasZoom;
        const newOffsetY = centerY - cursorPos.y * canvasZoom;
        
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
        
        // Highlight the user's cursor temporarily
        setHighlightedUserId(userId);
        setTimeout(() => setHighlightedUserId(null), 2000);
    }, [remoteCursors, canvasZoom]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingItem || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

        const newNode: WorkflowNode = {
            id: generateUUID(),
            type: draggingItem.type,
            label: draggingItem.label,
            x,
            y
        };

        setNodes(prev => [...prev, newNode]);
        setDraggingItem(null);
        setHasUnsavedChanges(true);
        
        // Send node add to other users
        sendNodeAdd(newNode);
    };

    const removeNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        // Also remove connections involving this node
        setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
        
        // Send node delete to other users
        sendNodeDelete(id);
        setHasUnsavedChanges(true);
    };

    // Duplicate node function
    const duplicateNode = (id: string) => {
        const nodeToDuplicate = nodes.find(n => n.id === id);
        if (!nodeToDuplicate) return;

        const newNode: WorkflowNode = {
            ...nodeToDuplicate,
            id: generateUUID(),
            x: nodeToDuplicate.x + 50,
            y: nodeToDuplicate.y + 50,
            status: 'idle',
            executionResult: undefined,
            data: undefined,
            inputData: undefined,
            outputData: undefined,
            conditionResult: undefined
        };

        setNodes(prev => [...prev, newNode]);
        sendNodeAdd(newNode);
        setHasUnsavedChanges(true);
        showToast('Node duplicated', 'success');
    };

    // Track selected node for duplication
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            
            // Ctrl/Cmd + Z to undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    isUndoRedoRef.current = true;
                    const state = undo();
                    if (state) {
                        setNodes(state.nodes);
                        setConnections(state.connections);
                    }
                    setTimeout(() => { isUndoRedoRef.current = false; }, 100);
                }
            }
            // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y to redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (canRedo) {
                    isUndoRedoRef.current = true;
                    const state = redo();
                    if (state) {
                        setNodes(state.nodes);
                        setConnections(state.connections);
                    }
                    setTimeout(() => { isUndoRedoRef.current = false; }, 100);
                }
            }
            // Ctrl/Cmd + D to duplicate selected node
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNodeId) {
                e.preventDefault();
                duplicateNode(selectedNodeId);
            }
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (currentWorkflowId && workflowName.trim()) {
                    saveWorkflow();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, nodes, currentWorkflowId, workflowName, canUndo, canRedo, undo, redo]);

    // Quick connect component function
    const handleQuickConnect = (componentType: string) => {
        if (!connectingFromNodeId) return;
        
        const fromNode = nodes.find(n => n.id === connectingFromNodeId);
        if (!fromNode) return;

        // Find the component item
        const componentItem = DRAGGABLE_ITEMS.find(item => item.type === componentType);
        if (!componentItem) return;

        // Calculate position for new node (to the right of the source node)
        const newNodeX = fromNode.x + 300; // 300px to the right
        const newNodeY = fromNode.y;

        // Create new node
        const newNode: WorkflowNode = {
            id: generateUUID(),
            type: componentItem.type as any,
            label: componentItem.label,
            x: newNodeX,
            y: newNodeY
        };

        // Add node
        setNodes(prev => [...prev, newNode]);
        sendNodeAdd(newNode);
        setHasUnsavedChanges(true);

        // Create connection
        const newConnection: Connection = {
            id: generateUUID(),
            fromNodeId: connectingFromNodeId,
            toNodeId: newNode.id
        };
        setConnections(prev => [...prev, newConnection]);
        setHasUnsavedChanges(true);
        sendConnectionAdd(newConnection);

        // Close modal
        setShowComponentSearch(false);
        setConnectingFromNodeId(null);
        setComponentSearchQuery('');
    };

    const [dragConnectionStart, setDragConnectionStart] = useState<{ nodeId: string, outputType?: 'true' | 'false' | 'A' | 'B', x: number, y: number } | null>(null);
    const [dragConnectionCurrent, setDragConnectionCurrent] = useState<{ x: number, y: number } | null>(null);
    const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);

    const handleConnectorMouseDown = (e: React.MouseEvent, nodeId: string, outputType?: 'true' | 'false' | 'A' | 'B') => {
        e.stopPropagation();
        e.preventDefault();

        // Calculate start position relative to canvas
        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

        setDragConnectionStart({ nodeId, outputType, x, y });
        setDragConnectionCurrent({ x, y });
    };

    const handleConnectorMouseUp = (e: React.MouseEvent, targetNodeId: string, inputPort?: 'A' | 'B') => {
        e.stopPropagation();
        e.preventDefault();

        if (dragConnectionStart && dragConnectionStart.nodeId !== targetNodeId) {
            // Complete connection
            let finalOutputType = dragConnectionStart.outputType;
            let finalInputPort = inputPort;

            // If connecting from a condition node and no type was set, ask the user
            // (This is a fallback - users should use the colored TRUE/FALSE connectors)
            const fromNode = nodes.find(n => n.id === dragConnectionStart.nodeId);
            if (fromNode?.type === 'condition' && !finalOutputType) {
                const choice = window.confirm('Use the green (✓) or red (✗) connectors on the If/Else node.\n\nAs fallback: OK = TRUE path, Cancel = FALSE path');
                finalOutputType = choice ? 'true' : 'false';
            }

            // If connecting to a join node and no input port was set, ask the user
            const toNode = nodes.find(n => n.id === targetNodeId);
            if (toNode?.type === 'join' && !finalInputPort) {
                const choice = window.confirm('Use the A or B input connectors on the Join node.\n\nAs fallback: OK = Input A, Cancel = Input B');
                finalInputPort = choice ? 'A' : 'B';
            }

            const newConnection: Connection = {
                id: generateUUID(),
                fromNodeId: dragConnectionStart.nodeId,
                toNodeId: targetNodeId,
                outputType: finalOutputType,
                inputPort: finalInputPort
            };
            setConnections(prev => [...prev, newConnection]);
            setHasUnsavedChanges(true);
            
            // Send connection add to other users
            sendConnectionAdd(newConnection);
        }

        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    };

    const getNodeColor = (type: string, status?: string) => {
        // Todos los nodos tienen el mismo estilo base - diseño consistente y limpio
        const baseStyle = 'bg-[var(--bg-card)] text-[var(--text-primary)]';
        
        if (status === 'completed') return `${baseStyle} border-2 border-green-200 shadow-md`;
        if (status === 'running') return `${baseStyle} border border-[var(--border-light)] shadow-md`;
        if (status === 'error') return `${baseStyle} border border-red-100 shadow-md`;
        if (status === 'waiting') return `${baseStyle} border border-[var(--border-light)] shadow-md`;

        // Idle/not executed nodes - diseño consistente
        return `${baseStyle} border border-[var(--border-light)] shadow-sm`;
    };

    // Función para verificar si un nodo está configurado
    const isNodeConfigured = (node: WorkflowNode): boolean => {
        switch (node.type) {
            case 'fetchData':
                return !!node.config?.entityId;
            case 'condition':
                return !!node.config?.conditionField;
            case 'addField':
                return !!node.config?.conditionField;
            case 'saveRecords':
                return !!node.config?.entityId;
            case 'llm':
                return !!node.config?.llmPrompt;
            case 'python':
                return !!node.config?.pythonCode;
            case 'join':
                return !!node.config?.joinStrategy;
            case 'splitColumns':
                return (node.config?.columnsOutputA?.length || 0) > 0 || (node.config?.columnsOutputB?.length || 0) > 0;
            case 'excelInput':
                return !!node.config?.fileName;
            case 'pdfInput':
                return !!node.config?.pdfText;
            case 'manualInput':
                return !!node.config?.inputVarName;
            case 'http':
                return !!node.config?.httpUrl;
            case 'webhook':
                return true; // Webhooks siempre están configurados
            case 'webhookResponse':
                return true; // Webhook Response siempre configurado
            case 'mysql':
                return !!node.config?.mysqlQuery;
            case 'sapFetch':
                return true; // SAP siempre está configurado
            case 'limsFetch':
                return !!(node.config?.limsServerUrl && node.config?.limsApiKey);
            case 'statisticalAnalysis':
                return !!node.config?.statisticalMethod;
            case 'alertAgent':
                return !!node.config?.alertConditions;
            case 'pdfReport':
                return !!node.config?.pdfTemplate;
            case 'sendEmail':
                return !!node.config?.emailTo;
            case 'sendSMS':
                return !!node.config?.smsTo;
            case 'sendWhatsApp':
                return !!node.config?.whatsappTo;
            case 'dataVisualization':
                return !!node.config?.generatedWidget;
            case 'esios':
                return !!node.config?.esiosArchiveId;
            case 'climatiq':
                return !!node.config?.climatiqFactor;
            case 'humanApproval':
                return !!node.config?.assignedUserId;
            case 'comment':
                return !!node.config?.commentText;
            case 'action':
                return (node.config?.columnRenames?.length || 0) > 0;
            case 'trigger':
            case 'output':
            case 'agent':
            case 'opcua':
            case 'mqtt':
                return true; // Estos tipos siempre están configurados
            case 'franmit':
                // Franmit está configurado si tiene al menos un parámetro configurado
                // (no requiere API Secret ID para ejecución local)
                return true; // Siempre permitir ejecución, validación se hace en el backend
            case 'conveyor':
                return !!(node.config?.conveyorSpeed && node.config?.conveyorLength);
            default:
                return false;
        }
    };

    // Función para obtener el tag que se muestra arriba del nodo
    // Solo se muestra si NO hay información en la sección de feedback (executionResult o not configured)
    const getNodeTopTag = (node: WorkflowNode): { label: string; color: string; icon: React.ElementType } | null => {
        // PRIORITY: Always show "Running" status when node is actively running
        // This ensures the badge appears on subsequent runs, not just the first
        if (node.status === 'running') {
            return { label: 'Running', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: Play };
        }
        
        // Si hay executionResult o no está configurado, NO mostrar el tag arriba (se muestra abajo en feedback)
        const hasFeedback = node.executionResult || !isNodeConfigured(node);
        if (hasFeedback) {
            return null;
        }
        
        // Si tiene estado de ejecución y no hay feedback, mostrar el estado arriba
        if (node.status && node.status !== 'idle') {
            // Los errores siempre se muestran arriba si no hay feedback
            if (node.status === 'error') {
                return { label: 'Error', color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle };
            }
            
            // Otros estados solo si está configurado
            if (isNodeConfigured(node)) {
                const statusMap: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
                    'completed': { label: 'Completed', color: 'bg-green-50 border-green-200 text-green-700', icon: CheckCircle },
                    'waiting': { label: 'Waiting', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: Clock }
                };
                return statusMap[node.status] || null;
            }
        }
        
        return null;
    };

    // Get icon for node type (matches sidebar icons)
    const getNodeIcon = (type: string): React.ElementType => {
        const item = DRAGGABLE_ITEMS.find(i => i.type === type);
        return item?.icon || Workflow;
    };

    // Get icon background color for node type - Usa los mismos colores que el sidebar
    const getNodeIconBg = (type: string) => {
        // Devuelve solo el color de texto como en el sidebar, sin fondo ni bordes
        return getNodeIconColor(type);
    };

    // Get icon text color for node type (for palette items)
    const getNodeIconColor = (type: string): string => {
        switch (type) {
            case 'trigger': return 'text-cyan-600';
            case 'action': return 'text-amber-600';
            case 'condition': return 'text-[var(--text-secondary)]';
            case 'fetchData': return 'text-indigo-600';
            case 'humanApproval': return 'text-sky-600';
            case 'addField': return 'text-indigo-600';
            case 'saveRecords': return 'text-blue-600';
            case 'llm': return 'text-[var(--text-secondary)]';
            case 'python': return 'text-sky-600';
            case 'manualInput': return 'text-indigo-600';
            case 'output': return 'text-indigo-600';
            case 'http': return 'text-cyan-600';
            case 'mysql': return 'text-blue-600';
            case 'sapFetch': return 'text-indigo-600';
            case 'limsFetch': return 'text-purple-600';
            case 'statisticalAnalysis': return 'text-emerald-600';
            case 'alertAgent': return 'text-orange-600';
            case 'pdfReport': return 'text-red-600';
            case 'esios': return 'text-cyan-600';
            case 'climatiq': return 'text-sky-600';
            case 'join': return 'text-cyan-600';
            case 'splitColumns': return 'text-sky-600';
            case 'excelInput': return 'text-indigo-600';
            case 'pdfInput': return 'text-indigo-600';
            case 'sendEmail': return 'text-blue-600';
            case 'sendSMS': return 'text-blue-600';
            case 'sendWhatsApp': return 'text-green-600';
            case 'dataVisualization': return 'text-indigo-600';
            case 'webhook': return 'text-cyan-600';
            case 'webhookResponse': return 'text-orange-600';
            case 'agent': return 'text-purple-600';
            case 'opcua': return 'text-indigo-600';
            case 'mqtt': return 'text-cyan-600';
            case 'franmit': return 'text-teal-600';
            case 'conveyor': return 'text-amber-600';
            default: return 'text-[var(--text-secondary)]';
        }
    };

    const filteredItems = DRAGGABLE_ITEMS.filter(item => {
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Function to get subtle colors for each category
    const getCategoryColors = (categoryName: string): { bg: string; hover: string } => {
        const colorMap: { [key: string]: { bg: string; hover: string } } = {
            'Recents': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Triggers': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Data Sources': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Data Operations': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Control Flow': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Models': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Code': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Output & Logging': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Notifications': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' },
            'Utils': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        };
        return colorMap[categoryName] || { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' };
    };

    // Get all unique tags from workflows
    const allTags = Array.from(new Set(
        savedWorkflows
            .flatMap(wf => wf.tags || [])
            .filter(Boolean)
    )).sort();

    // Filter workflows for search and tags
    const filteredWorkflows = savedWorkflows.filter(wf => {
        const matchesSearch = wf.name.toLowerCase().includes(workflowSearchQuery.toLowerCase());
        const matchesTag = !selectedTagFilter || (wf.tags && Array.isArray(wf.tags) && wf.tags.includes(selectedTagFilter));
        return matchesSearch && matchesTag;
    });
    
    const totalWorkflowPages = Math.ceil(filteredWorkflows.length / workflowsPerPage);
    const paginatedWorkflows = filteredWorkflows.slice(
        (currentWorkflowPage - 1) * workflowsPerPage,
        currentWorkflowPage * workflowsPerPage
    );
    
    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentWorkflowPage(1);
    }, [workflowSearchQuery, selectedTagFilter]);

    return (
        <div className="flex flex-col bg-[var(--bg-primary)]" data-tutorial="workflows-content" style={{ height: '100%', maxHeight: '100vh', overflow: 'hidden' }}>
            {currentView === 'list' ? (
                /* Workflows List View */
                <>
                    {/* Top Header */}
                    <PageHeader title="Workflows" subtitle="Manage and execute your automation workflows" />

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                    <input
                                        type="text"
                                        placeholder="Search workflows..."
                                        value={workflowSearchQuery}
                                        onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                                        autoComplete="off"
                                        name="workflow-search-nofill"
                                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                                {/* Tag Filter */}
                                {allTags.length > 0 && (
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                        <select
                                            value={selectedTagFilter || ''}
                                            onChange={(e) => setSelectedTagFilter(e.target.value || null)}
                                            className="pl-8 pr-8 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer"
                                        >
                                            <option value="">All Tags</option>
                                            {allTags.map(tag => (
                                                <option key={tag} value={tag}>{tag}</option>
                                            ))}
                                        </select>
                                        {selectedTagFilter && (
                                            <button
                                                onClick={() => setSelectedTagFilter(null)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                            >
                                                <X size={12} weight="light" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {filteredWorkflows.length} {filteredWorkflows.length === 1 ? 'workflow' : 'workflows'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowTemplatesModal(true)}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                    <BookOpen size={14} className="mr-2" weight="light" />
                                    Open Templates
                                </button>
                                <button
                                    onClick={createNewWorkflow}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <Workflow size={14} className="mr-2" weight="light" />
                                    Create Workflow
                                </button>
                            </div>
                        </div>

                    {/* Workflows Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {paginatedWorkflows.map((workflow) => (
                            <div
                                key={workflow.id}
                                onClick={() => openWorkflow(workflow.id)}
                                className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] transition-all duration-300 ease-out hover:shadow-md hover:border-[var(--border-medium)] hover:scale-[1.01] active:scale-[0.99]"
                            >
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-2.5 bg-[var(--bg-tertiary)] rounded-lg flex-shrink-0 group-hover:bg-[var(--bg-hover)] transition-colors">
                                                <Workflow size={18} className="text-[var(--text-secondary)]" weight="light" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-normal text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                                                    {workflow.name}
                                                </h3>
                                                {/* Tags - directly below title */}
                                                {workflow.tags && workflow.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {workflow.tags.map((tag: string, idx: number) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)]"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteWorkflow(workflow.id);
                                            }}
                                            className="text-[var(--text-tertiary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        >
                                            <Trash size={16} weight="light" />
                                        </button>
                                    </div>

                                    <div className="space-y-2 mt-5">
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                            <User size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                            <span className="text-[var(--text-secondary)]">{workflow.createdByName || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                            <Calendar size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                            <span className="text-[var(--text-secondary)]">{workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}</span>
                                        </div>
                                        {workflow.updatedAt && (
                                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                <Clock size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                                <span className="text-[var(--text-secondary)]">
                                                    Edited {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}
                                                    {workflow.lastEditedByName && (
                                                        <span className="text-[var(--text-tertiary)]"> by {workflow.lastEditedByName}</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-5">
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" weight="light" />
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[var(--text-secondary)]">Open workflow</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Create New Card */}
                        <div
                            data-tutorial="create-workflow"
                            onClick={createNewWorkflow}
                            className="border border-dashed border-[var(--border-medium)] rounded-lg flex flex-col items-center justify-center min-h-[200px] text-[var(--text-tertiary)] cursor-pointer group"
                        >
                            <div className="p-4 bg-[var(--bg-tertiary)] rounded-full mb-3">
                                <Workflow size={24} weight="light" />
                            </div>
                            <span className="font-medium">Create new workflow</span>
                        </div>

                        {filteredWorkflows.length === 0 && workflowSearchQuery !== '' && (
                            <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
                                No workflows found matching "{workflowSearchQuery}"
                            </div>
                        )}
                    </div>
                    
                    {/* Pagination */}
                    {totalWorkflowPages > 1 && (
                        <div className="mt-6">
                            <Pagination
                                currentPage={currentWorkflowPage}
                                totalPages={totalWorkflowPages}
                                onPageChange={setCurrentWorkflowPage}
                                itemsPerPage={workflowsPerPage}
                                totalItems={filteredWorkflows.length}
                            />
                        </div>
                    )}
                    </div>
                </>
            ) : (
                /* Canvas View */
                <div data-tutorial="workflow-editor" className="flex flex-col min-h-0 overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
                    {/* Top Bar */}
                    <WorkflowEditorToolbar
                        workflowName={workflowName}
                        setWorkflowName={setWorkflowName}
                        currentWorkflowId={currentWorkflowId}
                        autoSaveStatus={autoSaveStatus}
                        isSaving={isSaving}
                        isRunning={isRunning}
                        nodesCount={nodes.length}
                        backToList={backToList}
                        saveWorkflow={saveWorkflow}
                        openExecutionHistory={openExecutionHistory}
                        runWorkflow={runWorkflow}
                        openWorkflowRunner={openWorkflowRunner}
                        setShowTagsModal={setShowTagsModal}
                    />

                    {/* Content Area (Sidebar + Canvas) */}
                    <div ref={contentAreaRef} className="flex flex-1 min-h-0 overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
                    {/* Sidebar */}
                    <NodePaletteSidebar
                        sidebarRef={sidebarRef}
                        sidebarScrollRef={sidebarScrollRef}
                        isSidebarCollapsed={isSidebarCollapsed}
                        setIsSidebarCollapsed={setIsSidebarCollapsed}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        expandedFolders={expandedFolders}
                        setExpandedFolders={setExpandedFolders}
                        DRAGGABLE_ITEMS={DRAGGABLE_ITEMS}
                        filteredItems={filteredItems}
                        handleDragStart={handleDragStart}
                        getCategoryColors={getCategoryColors}
                        getNodeIconColor={getNodeIconColor}
                    />

                    {/* Canvas */}
                    <div data-tutorial="workflow-canvas" className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-primary)]">
                        {/* Canvas Area */}
                        <div className="flex-1 relative overflow-hidden bg-[var(--bg-secondary)]">

                        <div
                            ref={canvasRef}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={(e) => {
                                handleCanvasMouseMove(e);
                                
                                // Update drag connection line while dragging
                                if (dragConnectionStart && canvasRef.current) {
                                    const rect = canvasRef.current.getBoundingClientRect();
                                    const x = (e.clientX - rect.left - canvasOffset.x) / canvasZoom;
                                    const y = (e.clientY - rect.top - canvasOffset.y) / canvasZoom;
                                    setDragConnectionCurrent({ x, y });
                                }
                                
                                // Send cursor position for collaboration
                                // Convert to canvas coordinates (accounting for pan and zoom)
                                if (canvasRef.current && currentWorkflowId) {
                                    const rect = canvasRef.current.getBoundingClientRect();
                                    const screenX = e.clientX - rect.left;
                                    const screenY = e.clientY - rect.top;
                                    // Convert to canvas space (same coordinate system as nodes)
                                    const canvasX = (screenX - canvasOffset.x) / canvasZoom;
                                    const canvasY = (screenY - canvasOffset.y) / canvasZoom;
                                    sendCursorPosition(canvasX, canvasY, screenX, screenY);
                                }
                            }}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={() => {
                                handleCanvasMouseUp();
                                // Hide cursor when leaving canvas
                                sendCursorPosition(-100, -100, -100, -100);
                            }}
                            className="w-full h-full relative"
                            style={{ 
                                cursor: isPanning ? 'grabbing' : 'default'
                            }}
                        >
                            {/* Dotted background pattern - follows zoom */}
                            <div 
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    backgroundImage: `radial-gradient(circle, var(--text-tertiary) 1px, transparent 1px)`,
                                    backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`,
                                    backgroundPosition: `${canvasOffset.x % (20 * canvasZoom)}px ${canvasOffset.y % (20 * canvasZoom)}px`,
                                    opacity: 0.3
                                }}
                            />
                            {/* Remote Cursors */}
                            {Array.from(remoteCursors.values()).map((remote) => {
                                if (!remote.cursor || remote.cursor.x < 0) return null;
                                // Transform canvas coordinates to screen coordinates using local pan/zoom
                                const screenX = remote.cursor.x * canvasZoom + canvasOffset.x;
                                const screenY = remote.cursor.y * canvasZoom + canvasOffset.y;
                                const isHighlighted = highlightedUserId === remote.user.id;
                                return (
                                    <div
                                        key={remote.id}
                                        className="absolute pointer-events-none z-[100] transition-all duration-75"
                                        style={{
                                            left: screenX,
                                            top: screenY,
                                            transform: 'translate(-2px, -2px)'
                                        }}
                                    >
                                        {/* Highlight pulse ring when user is being followed */}
                                        {isHighlighted && (
                                            <>
                                                <div 
                                                    className="absolute -inset-8 rounded-full animate-ping"
                                                    style={{ 
                                                        backgroundColor: remote.user.color,
                                                        opacity: 0.3,
                                                        animationDuration: '1s'
                                                    }}
                                                />
                                                <div 
                                                    className="absolute -inset-4 rounded-full animate-pulse"
                                                    style={{ 
                                                        backgroundColor: remote.user.color,
                                                        opacity: 0.4
                                                    }}
                                                />
                                            </>
                                        )}
                                        {/* Cursor arrow */}
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            style={{ 
                                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                                transform: isHighlighted ? 'scale(1.3)' : 'scale(1)',
                                                transition: 'transform 0.2s ease-out'
                                            }}
                                        >
                                            <path
                                                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.88a.5.5 0 0 0-.85.33Z"
                                                fill={remote.user.color}
                                                stroke="white"
                                                strokeWidth="1.5"
                                            />
                                        </svg>
                                        {/* User name label */}
                                        <div
                                            className={`absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap transition-all ${isHighlighted ? 'scale-110 shadow-lg' : ''}`}
                                            style={{ backgroundColor: remote.user.color }}
                                        >
                                            {remote.user.name}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Canvas Controls - Centered at Bottom */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[var(--bg-card)] rounded-full shadow-sm border border-[var(--border-light)] px-4 py-2">
                                {/* AI Assistant Button */}
                                <button
                                    onClick={() => setShowAiAssistant(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                    title="AI Workflow Assistant"
                                >
                                    <Sparkles size={16} className="text-[var(--text-primary)]" weight="light" />
                                    <span className="text-sm font-medium text-[var(--text-primary)]">Ask</span>
                                </button>
                                
                                <div className="w-px h-6 bg-[var(--border-medium)]"></div>
                                
                                {/* Zoom Out */}
                                <button
                                    onClick={() => setCanvasZoom(prev => Math.max(prev / 1.2, 0.25))}
                                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={18} className="text-[var(--text-secondary)]" weight="light" />
                                </button>
                                
                                {/* Zoom Level */}
                                <div className="px-3 py-1 text-sm font-medium text-[var(--text-secondary)] min-w-[60px] text-center">
                                    {Math.round(canvasZoom * 100)}%
                                </div>
                                
                                {/* Zoom In */}
                                <button
                                    onClick={() => setCanvasZoom(prev => Math.min(prev * 1.2, 3))}
                                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={18} className="text-[var(--text-secondary)]" weight="light" />
                                </button>
                                
                                <div className="w-px h-6 bg-[var(--border-medium)]"></div>
                                
                                {/* Fit View */}
                                <button
                                    onClick={resetView}
                                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                    title="Fit view to screen"
                                >
                                    <Maximize2 size={18} className="text-[var(--text-secondary)]" weight="light" />
                                </button>
                            </div>

                            {/* Content with transform */}
                            <div style={{
                                transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${canvasZoom})`,
                                transformOrigin: '0 0',
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                willChange: isPanning || draggingNodeId ? 'transform' : 'auto',
                            }}>
                                {/* Dot Grid Background - Moves and scales with canvas */}
                                <div 
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: '-5000px',
                                        top: '-5000px',
                                        width: '10000px',
                                        height: '10000px',
                                        backgroundImage: `radial-gradient(circle, var(--border-medium) 1px, transparent 1px)`,
                                        backgroundSize: '20px 20px',
                                        opacity: 0.4,
                                        zIndex: -1
                                    }}
                                />
                                {/* SVG Layer for Connections */}
                                <svg
                                    className="absolute pointer-events-none"
                                    style={{
                                        zIndex: 0,
                                        overflow: 'visible',
                                        left: 0,
                                        top: 0,
                                        width: '10000px',
                                        height: '10000px',
                                        willChange: draggingNodeId ? 'contents' : 'auto',
                                    }}
                                >
                                    {connections.map(conn => {
                                        const fromNode = nodes.find(n => n.id === conn.fromNodeId);
                                        const toNode = nodes.find(n => n.id === conn.toNodeId);
                                        if (!fromNode || !toNode) return null;

                                        // Calculate line positions (from right of fromNode to left of toNode)
                                        // IMPORTANT: Nodes use transform: translate(-50%, -50%), so node.x and node.y are the CENTER of the node
                                        const { NODE_WIDTH, NODE_HALF_WIDTH, CONNECTOR_SIZE, CONNECTOR_RADIUS } = CANVAS_CONSTANTS;
                                        
                                        // OUTPUT CONNECTORS (right side of fromNode)
                                        // right-0 = borde derecho del nodo = node.x + 160
                                        // translate-x-1/2 mueve el contenedor 10px a la derecha (50% de 20px)
                                        // Centro del círculo = node.x + 160 + 10
                                        const x1 = fromNode.x + NODE_HALF_WIDTH + CONNECTOR_RADIUS;
                                        
                                        // Calculate Y1 - use fixed offsets from node center
                                        let y1 = fromNode.y;
                                        
                                        if (fromNode.type === 'condition' || fromNode.type === 'splitColumns') {
                                            // Use fixed vertical offsets that match the connector positions
                                            // TRUE/A connector: 37px above center
                                            // FALSE/B connector: 37px below center
                                            if ((fromNode.type === 'condition' && conn.outputType === 'true') ||
                                                (fromNode.type === 'splitColumns' && conn.outputType === 'A')) {
                                                y1 = fromNode.y - 37;
                                            } else if ((fromNode.type === 'condition' && conn.outputType === 'false') ||
                                                       (fromNode.type === 'splitColumns' && conn.outputType === 'B')) {
                                                y1 = fromNode.y + 37;
                                            }
                                        }
                                        
                                        // INPUT CONNECTORS (left side of toNode)
                                        const x2 = toNode.x - NODE_HALF_WIDTH - CONNECTOR_RADIUS;
                                        
                                        // Calculate Y2 - use fixed offsets from node center
                                        let y2 = toNode.y;
                                        
                                        if (toNode.type === 'join') {
                                            // Join node has fixed connector positions
                                            // Input A: 5px above center, Input B: 25px below center
                                            if (conn.inputPort === 'A') {
                                                y2 = toNode.y - 5;
                                            } else if (conn.inputPort === 'B') {
                                                y2 = toNode.y + 25;
                                            }
                                        }

                                        // Control points for Bezier curve - smoother curves
                                        const dx = Math.abs(x2 - x1);
                                        const curvature = Math.min(dx * 0.5, Math.max(80, dx * 0.4));
                                        const c1x = x1 + curvature;
                                        const c1y = y1;
                                        const c2x = x2 - curvature;
                                        const c2y = y2;

                                        // Color based on running state
                                        // When running, use #CFE8ED for all connections
                                        // When not running, use light gray
                                        const strokeColor = isRunning 
                                            ? '#CFE8ED'
                                            : '#cbd5e1'; // Light gray when not running
                                        
                                        // Use different arrowhead colors
                                        const arrowId = conn.outputType === 'true' ? 'arrow-green'
                                            : conn.outputType === 'false' ? 'arrow-red'
                                            : conn.outputType === 'A' ? 'arrow-blue'
                                            : conn.outputType === 'B' ? 'arrow-purple'
                                                : 'workflow-arrowhead';

                                        const pathId = `connection-path-${conn.id}`;
                                        
                                        return (
                                            <g 
                                                key={conn.id}
                                                className="connection-group"
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {/* Invisible wider path for hover detection - only on the line itself */}
                                                {!isRunning && (
                                                    <path
                                                        d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                                                        stroke="transparent"
                                                        strokeWidth="8"
                                                        fill="none"
                                                        className="cursor-pointer"
                                                        style={{ 
                                                            pointerEvents: 'stroke'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            // Only show delete if not hovering over a connector
                                                            const target = e.target as SVGElement;
                                                            const relatedTarget = (e.nativeEvent as MouseEvent).relatedTarget as HTMLElement;
                                                            if (!relatedTarget?.closest('.group\\/connector')) {
                                                                setHoveredConnection(conn.id);
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            // Don't hide if moving to delete button
                                                            const relatedTarget = e.relatedTarget as Element;
                                                            if (relatedTarget?.closest('[data-delete-button]')) {
                                                                return;
                                                            }
                                                            setHoveredConnection(null);
                                                        }}
                                                        onClick={(e) => {
                                                            // Don't delete if clicking on a connector
                                                            const target = e.target as HTMLElement;
                                                            if (target.closest('.group\\/connector')) {
                                                                return;
                                                            }
                                                            e.stopPropagation();
                                                            setConnections(prev => prev.filter(c => c.id !== conn.id));
                                                            if (sendConnectionDelete) {
                                                                sendConnectionDelete(conn.id);
                                                            }
                                                        }}
                                                    />
                                                )}
                                                {/* Shadow/glow effect - only when running */}
                                                {isRunning && (
                                                    <path
                                                        d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                                                        stroke={strokeColor}
                                                        strokeWidth="4"
                                                        fill="none"
                                                        opacity="0.2"
                                                    />
                                                )}
                                                {/* Main line */}
                                                <path
                                                    id={pathId}
                                                    d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                                                    stroke={strokeColor}
                                                    strokeWidth={isRunning ? "3" : "2"}
                                                    fill="none"
                                                    strokeDasharray={isRunning ? "none" : "5,5"}
                                                    style={{ 
                                                        filter: isRunning ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : 'none',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                                {/* End point circle (replaces arrow) - perfectly aligned with connector point */}
                                                {/* Connector circles are w-5 h-5 (20px) with border-2 (2px border on each side = 4px total) */}
                                                {/* Inner circle diameter = 20px - 4px = 16px, so radius = 8px */}
                                                {/* The visual center of the connector is at (x2, y2) */}
                                                {/* We match the inner circle radius for perfect visual alignment */}
                                                {/* Using r="8" to match the inner filled area of the connector circle */}
                                                <circle
                                                    cx={x2}
                                                    cy={y2}
                                                    r="8"
                                                    fill={strokeColor}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    style={{ 
                                                        pointerEvents: 'none',
                                                        shapeRendering: 'geometricPrecision',
                                                        // Ensure perfect pixel alignment
                                                        transform: 'translate(0, 0)'
                                                    }}
                                                />
                                                {/* Delete button on hover */}
                                                {!isRunning && hoveredConnection === conn.id && (
                                                    <g 
                                                        data-delete-button="true"
                                                        style={{ pointerEvents: 'auto' }}
                                                        onMouseLeave={(e) => {
                                                            // Hide when leaving the delete button area
                                                            const relatedTarget = e.relatedTarget as Element;
                                                            if (!relatedTarget?.closest('[data-delete-button]')) {
                                                                setHoveredConnection(null);
                                                            }
                                                        }}
                                                    >
                                                        {/* Delete button circle */}
                                                        <circle
                                                            cx={(x1 + x2) / 2}
                                                            cy={(y1 + y2) / 2}
                                                            r="12"
                                                            fill="#ef4444"
                                                            stroke="white"
                                                            strokeWidth="2"
                                                            className="cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConnections(prev => prev.filter(c => c.id !== conn.id));
                                                                if (sendConnectionDelete) {
                                                                    sendConnectionDelete(conn.id);
                                                                }
                                                            }}
                                                        />
                                                        {/* X icon */}
                                                        <text
                                                            x={(x1 + x2) / 2}
                                                            y={(y1 + y2) / 2}
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            fill="white"
                                                            fontSize="14"
                                                            fontWeight="bold"
                                                            className="pointer-events-none"
                                                            style={{ userSelect: 'none' }}
                                                        >
                                                            ×
                                                        </text>
                                                    </g>
                                                )}
                                                {/* Animated ball when running */}
                                                {isRunning && (
                                                    <circle
                                                        r="6"
                                                        fill={strokeColor}
                                                        stroke="white"
                                                        strokeWidth="2"
                                                        style={{ 
                                                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                                            pointerEvents: 'none'
                                                        }}
                                                    >
                                                        <animateMotion
                                                            dur="1.5s"
                                                            repeatCount="indefinite"
                                                            path={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                                                        />
                                                    </circle>
                                                )}
                                            </g>
                                        );
                                    })}
                                    {/* Marker definitions removed - using circles instead of arrows */}
                                    <defs>
                                    </defs>
                                </svg>

                                {nodes.map((node) => (
                                    <div
                                        key={node.id}

                                        onClick={(e) => {
                                            // Don't trigger on connector points or delete button
                                            if ((e.target as HTMLElement).closest('.connector-point, button')) return;
                                            
                                            // Select node for duplication
                                            setSelectedNodeId(node.id);
                                            
                                            // Don't open modal if node was dragged
                                            if (nodeDragged) return;

                                            // Close any open config panel before opening a new one
                                            closeAllConfigs();

                                            // Open config for configurable nodes
                                            if (node.type === 'fetchData') {
                                                openNodeConfig(node.id);
                                            } else if (node.type === 'condition') {
                                                openConditionConfig(node.id);
                                            } else if (node.type === 'addField') {
                                                openAddFieldConfig(node.id);
                                            } else if (node.type === 'action') {
                                                openRenameColumnsConfig(node.id);
                                            } else if (node.type === 'saveRecords') {
                                                openSaveRecordsConfig(node.id);
                                            } else if (node.type === 'agent') {
                                                openAlertAgentConfig(node.id);
                                            } else if (node.type === 'llm') {
                                                openLLMConfig(node.id);
                                            } else if (node.type === 'python') {
                                                openPythonConfig(node.id);
                                            } else if (node.type === 'manualInput') {
                                                openManualInputConfig(node.id);
                                            } else if (node.type === 'http') {
                                                openHttpConfig(node.id);
                                            } else if (node.type === 'webhook') {
                                                openWebhookConfig(node.id);
                                            } else if (node.type === 'webhookResponse') {
                                                openWebhookResponseConfig(node.id);
                                            } else if (node.type === 'mysql') {
                                                openMySQLConfig(node.id);
                                            } else if (node.type === 'sapFetch') {
                                                openSAPConfig(node.id);
                                            } else if (node.type === 'limsFetch') {
                                                openLIMSConfig(node.id);
                                            } else if (node.type === 'statisticalAnalysis') {
                                                openStatisticalConfig(node.id);
                                            } else if (node.type === 'alertAgent') {
                                                openAlertAgentConfig(node.id);
                                            } else if (node.type === 'pdfReport') {
                                                openPdfReportConfig(node.id);
                                            } else if (node.type === 'sendEmail') {
                                                openEmailConfig(node.id);
                                            } else if (node.type === 'sendSMS') {
                                                openSMSConfig(node.id);
                                            } else if (node.type === 'sendWhatsApp') {
                                                openWhatsAppConfig(node.id);
                                            } else if (node.type === 'dataVisualization') {
                                                openVisualizationConfig(node.id);
                                            } else if (node.type === 'esios') {
                                                openEsiosConfig(node.id);
                                            } else if (node.type === 'climatiq') {
                                                openClimatiqConfig(node.id);
                                            } else if (node.type === 'humanApproval') {
                                                openHumanApprovalConfig(node.id);
                                            } else if (node.type === 'join') {
                                                openJoinConfig(node.id);
                                            } else if (node.type === 'splitColumns') {
                                                openSplitColumnsConfig(node.id);
                                            } else if (node.type === 'excelInput') {
                                                openExcelConfig(node.id);
                                            } else if (node.type === 'pdfInput') {
                                                openPdfConfig(node.id);
                                            } else if (node.type === 'osiPi') {
                                                openOsiPiConfig(node.id);
                                            } else if (node.type === 'franmit') {
                                                openFranmitConfig(node.id);
                                            } else if (node.type === 'conveyor') {
                                                openConveyorConfig(node.id);
                                            } else if (node.type === 'trigger' && (node.label === 'Schedule' || node.label.startsWith('Schedule:') || node.config?.scheduleInterval)) {
                                                openScheduleConfig(node.id);
                                            }
                                        }}
                                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                        style={{
                                            position: 'absolute',
                                            left: node.x,
                                            top: node.y,
                                            transform: 'translate(-50%, -50%)',
                                            width: '320px',
                                            minHeight: 'auto',
                                            cursor: (node.data || ['fetchData', 'condition', 'addField', 'saveRecords', 'llm'].includes(node.type)) ? 'grab' : 'default',
                                            zIndex: selectedNodeId === node.id ? 20 : 10,
                                            willChange: draggingNodeId === node.id ? 'transform' : 'auto',
                                        }}
                                        className={`flex flex-col rounded-xl shadow-md group relative select-none ${draggingNodeId === node.id ? '' : 'transition-shadow duration-150'} ${getNodeColor(node.type, node.status)} hover:shadow-lg ${node.status === 'completed' ? 'hover:border-green-300' : 'hover:border-[var(--border-medium)]'}`}
                                    >
                                        {/* Top Tag - Not Configured o Estado de Ejecución - Centrado arriba, sin solaparse */}
                                        {getNodeTopTag(node) && (
                                            <div 
                                                className={`absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap z-20 ${getNodeTopTag(node)!.color} shadow-md max-w-[calc(100%-80px)]`}
                                                style={{ 
                                                    transform: 'translate(-50%, 0)',
                                                    pointerEvents: 'none'
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                {React.createElement(getNodeTopTag(node)!.icon, { size: 13, weight: "light" })}
                                                <span className="truncate">{getNodeTopTag(node)!.label}</span>
                                            </div>
                                        )}

                                        {/* Hover Action Buttons - Top right */}
                                        <div 
                                            className="absolute -top-9 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-30"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRunNode(node.id);
                                                }}
                                                className="p-2 bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[#256A65] transition-all"
                                                title="Run Node"
                                            >
                                                <Play size={14} fill="currentColor" weight="light" />
                                            </button>
                                            {((node.data && (Array.isArray(node.data) && node.data.length > 0 || (typeof node.data === 'object' && node.data !== null))) ||
                                              (node.inputData && (Array.isArray(node.inputData) && node.inputData.length > 0 || (typeof node.inputData === 'object' && node.inputData !== null))) ||
                                              (node.outputData && (Array.isArray(node.outputData) && node.outputData.length > 0 || (typeof node.outputData === 'object' && node.outputData !== null))) ||
                                              (node.type === 'splitColumns' && node.outputData && (node.outputData.outputA?.length > 0 || node.outputData.outputB?.length > 0))) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingDataNodeId(node.id);
                                                    }}
                                                    className="p-2 bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                                                    title="View Data"
                                                >
                                                    <Database size={14} weight="light" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    duplicateNode(node.id);
                                                }}
                                                className="p-2 bg-[var(--bg-card)] hover:bg-[#256A65]/10 rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[#256A65] transition-all"
                                                title="Duplicate Node (Ctrl+D)"
                                            >
                                                <Copy size={14} weight="light" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeNode(node.id);
                                                }}
                                                className="p-2 bg-[var(--bg-card)] hover:bg-red-50 rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-red-600 transition-all"
                                                title="Delete Node"
                                            >
                                                <X size={14} weight="light" />
                                            </button>
                                        </div>

                                        {/* Node Content */}
                                        <div className="flex flex-col p-5 min-w-0">
                                            {node.type === 'comment' ? (
                                                /* Comment Node Special Layout */
                                                <div className="flex flex-col">
                                                    <textarea
                                                        value={node.config?.commentText || ''}
                                                        onChange={(e) => {
                                                            const newText = e.target.value;
                                                            setNodes(prev => prev.map(n =>
                                                                n.id === node.id
                                                                    ? { ...n, config: { ...n.config, commentText: newText } }
                                                                    : n
                                                            ));
                                                        }}
                                                        placeholder="Write a comment..."
                                                        className="w-full p-3 text-sm bg-transparent border-none resize-none focus:outline-none text-[var(--text-primary)] min-h-[60px] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            ) : (
                                                /* Regular Node Layout - Estructura Reorganizada */
                                                <>
                                                    {/* Sección 1: Header - Solo Título e Icono - Alineado a la izquierda */}
                                                    <div className="flex items-center gap-4 py-2">
                                                        {/* Node Icon */}
                                                        {node.type === 'humanApproval' && node.config?.assignedUserId ? (
                                                            <div className="flex-shrink-0">
                                                                <UserAvatar 
                                                                    name={node.config.assignedUserName} 
                                                                    profilePhoto={node.config.assignedUserPhoto} 
                                                                    size="sm" 
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center">
                                                                {React.createElement(getNodeIcon(node.type), { size: 20, className: getNodeIconBg(node.type), weight: "light" })}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Title */}
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-xl font-normal text-[var(--text-primary)] break-words leading-snug" title={node.label} style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                                                {node.label}
                                                            </h3>
                                                        </div>

                                                        {/* Options Menu - Posicionado absolutamente */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Abrir menú de opciones o configurar nodo
                                                                if (node.type === 'fetchData') {
                                                                    openNodeConfig(node.id);
                                                                } else if (node.type === 'condition') {
                                                                    openConditionConfig(node.id);
                                                                } else if (node.type === 'addField') {
                                                                    openAddFieldConfig(node.id);
                                                                } else if (node.type === 'action') {
                                                                    openRenameColumnsConfig(node.id);
                                                } else if (node.type === 'saveRecords') {
                                                    openSaveRecordsConfig(node.id);
                                                } else if (node.type === 'llm') {
                                                    openLLMConfig(node.id);
                                                } else if (node.type === 'python') {
                                                    openPythonConfig(node.id);
                                                } else if (node.type === 'join') {
                                                    openJoinConfig(node.id);
                                                } else if (node.type === 'splitColumns') {
                                                                    openSplitColumnsConfig(node.id);
                                                                } else if (node.type === 'excelInput') {
                                                                    openExcelConfig(node.id);
                                                                } else if (node.type === 'pdfInput') {
                                                                    openPdfConfig(node.id);
                                                                } else if (node.type === 'manualInput') {
                                                                    openManualInputConfig(node.id);
                                                                } else if (node.type === 'http') {
                                                                    openHttpConfig(node.id);
                                                                } else if (node.type === 'webhook') {
                                                                    openWebhookConfig(node.id);
                                                                } else if (node.type === 'webhookResponse') {
                                                                    openWebhookResponseConfig(node.id);
                                                                } else if (node.type === 'mysql') {
                                                                    openMySQLConfig(node.id);
                                                                } else if (node.type === 'sapFetch') {
                                                                    openSAPConfig(node.id);
                                                                } else if (node.type === 'limsFetch') {
                                                                    openLIMSConfig(node.id);
                                                                } else if (node.type === 'statisticalAnalysis') {
                                                                    openStatisticalConfig(node.id);
                                                                } else if (node.type === 'alertAgent') {
                                                                    openAlertAgentConfig(node.id);
                                                                } else if (node.type === 'pdfReport') {
                                                                    openPdfReportConfig(node.id);
                                                                } else if (node.type === 'sendEmail') {
                                                                    openEmailConfig(node.id);
                                                                } else if (node.type === 'sendSMS') {
                                                                    openSMSConfig(node.id);
                                                                } else if (node.type === 'sendWhatsApp') {
                                                                    openWhatsAppConfig(node.id);
                                                                } else if (node.type === 'dataVisualization') {
                                                                    openVisualizationConfig(node.id);
                                                                } else if (node.type === 'esios') {
                                                                    openEsiosConfig(node.id);
                                                                } else if (node.type === 'climatiq') {
                                                                    openClimatiqConfig(node.id);
                                                                } else if (node.type === 'humanApproval') {
                                                                    openHumanApprovalConfig(node.id);
                                                                } else if (node.type === 'osiPi') {
                                                                    openOsiPiConfig(node.id);
                                                                } else if (node.type === 'franmit') {
                                                                    openFranmitConfig(node.id);
                                                                }
                                                            }}
                                                            className="absolute top-2 right-2 p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                                            title="Configure"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                    </div>

                                                    {/* Human Approval Waiting UI - Sección de Datos Relevantes */}
                                                    {node.type === 'humanApproval' && node.status === 'waiting' && (
                                                        <div className="mb-4 space-y-3 pt-4 border-t border-[var(--border-light)]">
                                                            <div className="text-xs text-orange-700 font-medium flex items-center gap-2">
                                                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                                                Waiting for approval...
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleApproval(true);
                                                                    }}
                                                                    className="flex-1 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5"
                                                                >
                                                                    <Check size={14} />
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleApproval(false);
                                                                    }}
                                                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5"
                                                                >
                                                                    <X size={14} weight="light" />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Node Details - Consistent styling */}
                                        {node.type === 'fetchData' && node.config?.entityName && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                    <span className="font-medium">{node.config.entityName}</span>
                                                    {node.data && (
                                                        <span className="ml-2 text-[var(--text-secondary)]">• {node.data.length} records</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {node.type === 'limsFetch' && node.config?.limsEndpoint && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                    <span className="font-medium">Endpoint: {node.config.limsEndpoint}</span>
                                                    {node.data && (
                                                        <span className="ml-2 text-[var(--text-secondary)]">• {Array.isArray(node.data) ? node.data.length : 1} records</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {node.type === 'statisticalAnalysis' && node.config?.statisticalMethod && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                    <span className="font-medium">Method: {node.config.statisticalMethod}</span>
                                                    {node.config.goldenBatchId && (
                                                        <span className="ml-2 text-[var(--text-secondary)]">• Golden Batch: {node.config.goldenBatchId}</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {node.type === 'alertAgent' && node.config?.alertSeverity && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                    <span className="font-medium capitalize">Severity: {node.config.alertSeverity}</span>
                                                    {node.config.alertActions && node.config.alertActions.length > 0 && (
                                                        <span className="ml-2 text-[var(--text-secondary)]">• Actions: {node.config.alertActions.join(', ')}</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {node.type === 'pdfReport' && node.config?.pdfTemplate && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                    <span className="font-medium">Template: {node.config.pdfTemplate}</span>
                                                    {node.data && node.data[0]?.pdfPath && (
                                                        <span className="ml-2 text-[var(--text-secondary)]">• Generated</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {node.type === 'join' && (
                                            <div className="px-5 pb-5 pt-4">
                                                <div className="flex flex-col gap-2">
                                                    {/* Strategy info */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                                                            {node.config?.joinStrategy === 'mergeByKey'
                                                                ? `${node.config?.joinType === 'outer' ? 'Outer' : 'Inner'} Join`
                                                                : 'Concatenate'}
                                                        </span>
                                                        {node.config?.joinStrategy === 'mergeByKey' && node.config?.joinKey && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                                                                key: {node.config.joinKey}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Input status */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2 h-2 rounded-full ${node.inputDataA ? 'bg-green-500' : 'bg-[var(--border-medium)]'}`} />
                                                            <span className="text-[10px] text-[var(--text-tertiary)]">Input A</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2 h-2 rounded-full ${node.inputDataB ? 'bg-green-500' : 'bg-[var(--border-medium)]'}`} />
                                                            <span className="text-[10px] text-[var(--text-tertiary)]">Input B</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {node.type === 'excelInput' && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                {node.config?.fileName ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-xs text-[var(--text-secondary)] font-medium break-words" title={node.config.fileName}>
                                                            {node.config.fileName}
                                                        </p>
                                                        <p className="text-xs text-[var(--text-tertiary)]">
                                                            {node.config.rowCount} rows • {node.config.headers?.length || 0} cols
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic">Click to upload file</p>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'condition' && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                {node.config?.conditionField ? (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed">
                                                            <span className="font-medium">{node.config.conditionField}</span> {node.config.conditionOperator} <span className="font-medium">{node.config.conditionValue || ''}</span>
                                                        </p>
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-full w-fit font-medium ${node.config.processingMode === 'perRow' ? 'bg-[var(--bg-tertiary)] text-amber-600 border border-[var(--border-light)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)]'}`}>
                                                            {node.config.processingMode === 'perRow' ? 'Per Row' : 'Batch'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic">Not configured</p>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'splitColumns' && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                {(node.config?.columnsOutputA?.length || 0) > 0 || (node.config?.columnsOutputB?.length || 0) > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-xs text-[var(--text-secondary)] break-words">
                                                            <span className="font-medium text-[#256A65]">A:</span> {node.config?.columnsOutputA?.length || 0} cols
                                                        </p>
                                                        <p className="text-xs text-[var(--text-secondary)] break-words">
                                                            <span className="font-medium text-[#84C4D1]">B:</span> {node.config?.columnsOutputB?.length || 0} cols
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic">Click to configure</p>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'llm' && (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                {node.config?.llmPrompt ? (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-xs text-[var(--text-secondary)] break-words leading-relaxed" title={node.config.llmPrompt}>
                                                            {node.config.llmPrompt}
                                                        </p>
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-full w-fit font-medium ${node.config.processingMode === 'perRow' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)]'}`}>
                                                            {node.config.processingMode === 'perRow' ? 'Per Row' : 'Batch'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic">Not configured</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Sección 3: Errores y Estado - Al final del nodo */}
                                        {/* Skip "Waiting for input" messages for join nodes since they show input status above */}
                                        {(node.executionResult && !(node.type === 'join' && node.executionResult?.includes('Waiting for input'))) || (!isNodeConfigured(node) && node.type !== 'comment' && node.type !== 'join') ? (
                                            <div className="px-5 pb-5 pt-4 border-t border-[var(--border-light)]">
                                                {(() => {
                                                    // Si hay executionResult, usarlo; si no, mostrar "Not Configured"
                                                    const message = node.executionResult || 'Not Configured';
                                                    
                                                    // Determinar el color según el tipo de mensaje
                                                    const isError = node.status === 'error' || message.toLowerCase().includes('error');
                                                    const isNotConfigured = !node.executionResult || 
                                                                          message.toLowerCase().includes('not configured') || 
                                                                          message.toLowerCase().includes('not set') ||
                                                                          message.toLowerCase().includes('click to');
                                                    
                                                    let textColor = 'text-[var(--text-secondary)]';
                                                    let bgColor = 'bg-[var(--bg-tertiary)]';
                                                    let borderColor = 'border-[var(--border-light)]';
                                                    
                                                    if (isError) {
                                                        textColor = 'text-red-700';
                                                        bgColor = 'bg-red-50';
                                                        borderColor = 'border-red-200';
                                                    } else if (isNotConfigured) {
                                                        textColor = 'text-[var(--text-secondary)]';
                                                        bgColor = 'bg-[var(--bg-tertiary)]';
                                                        borderColor = 'border-[var(--border-light)]';
                                                    }
                                                    
                                                    return (
                                                        <div className={`px-3 py-2 rounded-lg border ${bgColor} ${borderColor} text-left w-full`}>
                                                            <p className={`text-xs font-medium break-words leading-relaxed ${textColor} text-left`}>
                                                                {message}
                                                            </p>
                                                            {/* Debug button for Python nodes with errors */}
                                                            {isError && node.type === 'python' && node.config?.pythonCode && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDebugPythonNode(node);
                                                                    }}
                                                                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Bug size={14} />
                                                                    Debug with AI
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : null}

                                        {/* Connector Points - not for comment nodes */}
                                        {node.type !== 'comment' && (
                                            <>
                                                {/* Output connectors */}
                                                {node.type === 'condition' ? (
                                                    // Condition nodes have TWO output connectors: TRUE and FALSE
                                                    <>
                                                        {/* TRUE output - above center (green) */}
                                                        <div className="absolute right-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% - 37px)', transform: 'translate(50%, -50%)' }}>
                                                            {/* Larger hit area */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseDown(e, node.id, 'true');
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-5 h-5 bg-green-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'true' ? 'border-green-500 scale-125 bg-green-100 shadow-md' : 'border-green-400 group-hover/connector:border-green-500 group-hover/connector:bg-green-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} 
                                                                title="TRUE path" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-[#256A65]" style={{ top: 'calc(50% - 37px)', transform: 'translateY(-50%)' }}>✓</span>

                                                        {/* FALSE output - below center (red) */}
                                                        <div className="absolute right-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% + 37px)', transform: 'translate(50%, -50%)' }}>
                                                            {/* Larger hit area */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseDown(e, node.id, 'false');
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-5 h-5 bg-red-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'false' ? 'border-red-500 scale-125 bg-red-100 shadow-md' : 'border-red-400 group-hover/connector:border-red-500 group-hover/connector:bg-red-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} 
                                                                title="FALSE path" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-red-600" style={{ top: 'calc(50% + 37px)', transform: 'translateY(-50%)' }}>✗</span>
                                                    </>
                                                ) : node.type === 'splitColumns' ? (
                                                    // Split Columns nodes have TWO output connectors: A and B
                                                    <>
                                                        {/* Output A - above center (blue) */}
                                                        <div className="absolute right-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% - 37px)', transform: 'translate(50%, -50%)' }}>
                                                            {/* Larger hit area */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseDown(e, node.id, 'A');
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-5 h-5 bg-[#256A65]/10 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'A' ? 'border-[#256A65] scale-125 bg-[#256A65]/20 shadow-md' : 'border-[#256A65]/60 group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/20 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} 
                                                                title="Output A" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-blue-600" style={{ top: 'calc(50% - 37px)', transform: 'translateY(-50%)' }}>A</span>

                                                        {/* Output B - below center (purple) */}
                                                        <div className="absolute right-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% + 37px)', transform: 'translate(50%, -50%)' }}>
                                                            {/* Larger hit area */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseDown(e, node.id, 'B');
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-5 h-5 bg-purple-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'B' ? 'border-purple-500 scale-125 bg-purple-100 shadow-md' : 'border-purple-400 group-hover/connector:border-purple-500 group-hover/connector:bg-purple-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} 
                                                                title="Output B" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-purple-600" style={{ top: 'calc(50% + 37px)', transform: 'translateY(-50%)' }}>B</span>
                                                    </>
                                                ) : (
                                                    // Regular nodes have ONE output connector - centered on right edge
                                                    <div 
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 group/connector cursor-crosshair z-30 pointer-events-auto"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            handleConnectorMouseDown(e, node.id);
                                                        }}
                                                        onMouseUp={(e) => {
                                                            e.stopPropagation();
                                                            handleConnectorMouseUp(e, node.id);
                                                        }}
                                                    >
                                                        {/* Larger hit area for easier clicking */}
                                                        <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" />
                                                        {/* Visible connector point */}
                                                        <div className={`w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id ? 'border-[#256A65] scale-125 bg-[#256A65]/10 shadow-md' : 'border-[var(--border-medium)] group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} />
                                                    </div>
                                                )}
                                                
                                                {/* Input connector(s) - all nodes except triggers */}
                                                {node.type !== 'trigger' && (
                                                    node.type === 'join' ? (
                                                        // Join nodes have TWO input connectors: A and B - positioned relative to center
                                                        <>
                                                            {/* Input A - above center */}
                                                            <div className="absolute left-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% - 5px)', transform: 'translate(-50%, -50%)' }}>
                                                                {/* Larger hit area */}
                                                                <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                    onMouseUp={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConnectorMouseUp(e, node.id, 'A');
                                                                    }}
                                                                />
                                                                {/* Visible connector point */}
                                                                <div className={`w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none border-[var(--border-medium)] group-hover/connector:border-cyan-500 group-hover/connector:bg-cyan-50 group-hover/connector:scale-110 group-hover/connector:shadow-md`}
                                                                    title="Input A" />
                                                            </div>
                                                            {/* Input B - below center */}
                                                            <div className="absolute left-0 group/connector z-30 pointer-events-auto" style={{ top: 'calc(50% + 25px)', transform: 'translate(-50%, -50%)' }}>
                                                                {/* Larger hit area */}
                                                                <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                    onMouseUp={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConnectorMouseUp(e, node.id, 'B');
                                                                    }}
                                                                />
                                                                {/* Visible connector point */}
                                                                <div className={`w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none border-[var(--border-medium)] group-hover/connector:border-cyan-500 group-hover/connector:bg-cyan-50 group-hover/connector:scale-110 group-hover/connector:shadow-md`}
                                                                    title="Input B" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        // Regular nodes have ONE input connector - centered on left edge
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 group/connector z-30 pointer-events-auto">
                                                            {/* Larger hit area for easier clicking */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none border-[var(--border-medium)] group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 group-hover/connector:scale-110 group-hover/connector:shadow-md`} />
                                                        </div>
                                                    )
                                                )}
                                                
                                                {/* Quick Connect Button - Right Side */}
                                                {(node.type as string) !== 'comment' && (
                                                    <button
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConnectingFromNodeId(node.id);
                                                            setShowComponentSearch(true);
                                                            setComponentSearchQuery('');
                                                        }}
                                                        className="absolute -right-14 top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--bg-card)] border-2 border-[var(--border-medium)] rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-[#256A65] hover:bg-[#256A65]/10 hover:scale-110 shadow-sm z-25 pointer-events-auto"
                                                        title="Quick connect component"
                                                    >
                                                        <Plus size={14} className="text-[var(--text-secondary)] group-hover:text-[#256A65]" />
                                                    </button>
                                                )}
                                            </>
                                        )}

                                    </div>
                                ))}

                                {/* Temporary Connection Line */}
                                {dragConnectionStart && dragConnectionCurrent && (() => {
                                    const startNode = nodes.find(n => n.id === dragConnectionStart.nodeId)!;
                                    const { NODE_WIDTH, NODE_HALF_WIDTH, CONNECTOR_SIZE, CONNECTOR_RADIUS } = CANVAS_CONSTANTS;
                                    
                                    // Use the actual clicked position if available, otherwise calculate
                                    const startX = dragConnectionStart.x || (startNode.x + NODE_HALF_WIDTH + CONNECTOR_RADIUS);
                                    let startY = dragConnectionStart.y || startNode.y;
                                    
                                    // Calculate Y position for special node types using fixed offsets
                                    if (!dragConnectionStart.y) {
                                        if (startNode.type === 'condition') {
                                            if (dragConnectionStart.outputType === 'true') {
                                                startY = startNode.y - 37;
                                            } else if (dragConnectionStart.outputType === 'false') {
                                                startY = startNode.y + 37;
                                            }
                                        } else if (startNode.type === 'splitColumns') {
                                            if (dragConnectionStart.outputType === 'A') {
                                                startY = startNode.y - 37;
                                            } else if (dragConnectionStart.outputType === 'B') {
                                                startY = startNode.y + 37;
                                            }
                                        }
                                    }
                                    
                                    // Color based on output type
                                    const strokeColor = dragConnectionStart.outputType === 'true' ? '#10b981'
                                        : dragConnectionStart.outputType === 'false' ? '#ef4444'
                                        : dragConnectionStart.outputType === 'A' ? '#3b82f6'
                                        : dragConnectionStart.outputType === 'B' ? '#a855f7'
                                            : '#256A65';
                                    
                                    return (
                                    <svg
                                        className="absolute pointer-events-none"
                                        style={{
                                            zIndex: 20,
                                            overflow: 'visible',
                                            left: 0,
                                            top: 0,
                                            width: '10000px',
                                            height: '10000px'
                                        }}
                                    >
                                        <defs>
                                        </defs>
                                        {(() => {
                                            const dx = Math.abs(dragConnectionCurrent.x - startX);
                                            const curvature = Math.min(dx * 0.5, Math.max(80, dx * 0.4));
                                            const c1x = startX + curvature;
                                            const c2x = dragConnectionCurrent.x - curvature;
                                            const path = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${dragConnectionCurrent.y}, ${dragConnectionCurrent.x} ${dragConnectionCurrent.y}`;
                                            return (
                                                <>
                                                    {/* Shadow/glow */}
                                                    <path
                                                        d={path}
                                                        stroke={strokeColor}
                                                        strokeWidth="4"
                                                        fill="none"
                                                        strokeDasharray="5,5"
                                                        opacity="0.2"
                                                    />
                                                    {/* Main line */}
                                                    <path
                                                        d={path}
                                                        stroke={strokeColor}
                                                        strokeWidth="3"
                                                        fill="none"
                                                        strokeDasharray="5,5"
                                                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                                                    />
                                                </>
                                            );
                                        })()}
                                        {/* End point circle (replaces arrow) */}
                                        <circle
                                            cx={dragConnectionCurrent.x}
                                            cy={dragConnectionCurrent.y}
                                            r="8"
                                            fill={strokeColor}
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                    </svg>
                                    );
                                })()}

                                {nodes.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                                        <div className="text-center max-w-lg px-6">
                                            <div className="mb-8">
                                                <div className="relative mb-6">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[#256A65]/10 to-[var(--bg-tertiary)] rounded-full blur-3xl"></div>
                                                    <Workflow size={80} className="mx-auto relative text-[var(--text-tertiary)]" />
                                                </div>
                                                <h3 className="text-2xl font-normal text-[var(--text-primary)] mb-3">Start building your workflow</h3>
                                                <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
                                                    Create powerful automation workflows by dragging components from the sidebar or let AI help you build one
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <button
                                                    onClick={() => setShowAiAssistant(true)}
                                                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-all font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                                                >
                                                    <Sparkles size={20} />
                                                    Create with AI Assistant
                                                </button>
                                                <div className="flex items-center gap-3 my-2">
                                                    <span className="h-px flex-1 bg-[var(--bg-tertiary)]"></span>
                                                    <span className="text-xs text-[var(--text-tertiary)] font-medium">OR</span>
                                                    <span className="h-px flex-1 bg-[var(--bg-tertiary)]"></span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const triggerItem = DRAGGABLE_ITEMS.find(i => i.type === 'trigger' && i.label === 'Manual Trigger');
                                                            if (triggerItem) {
                                                                handleDragStart({ dataTransfer: { setData: () => {} } } as any, triggerItem);
                                                                const centerX = canvasRef.current ? canvasRef.current.getBoundingClientRect().width / 2 : 400;
                                                                const centerY = canvasRef.current ? canvasRef.current.getBoundingClientRect().height / 2 : 300;
                                                                handleDrop({ clientX: centerX, clientY: centerY } as any);
                                                            }
                                                        }}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all text-sm font-medium text-[var(--text-primary)] shadow-sm hover:shadow-md"
                                                    >
                                                        <Play size={16} className="text-[var(--text-secondary)]" />
                                                        Add Trigger
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const fetchItem = DRAGGABLE_ITEMS.find(i => i.type === 'fetchData');
                                                            if (fetchItem) {
                                                                handleDragStart({ dataTransfer: { setData: () => {} } } as any, fetchItem);
                                                                const centerX = canvasRef.current ? canvasRef.current.getBoundingClientRect().width / 2 : 400;
                                                                const centerY = canvasRef.current ? canvasRef.current.getBoundingClientRect().height / 2 : 300;
                                                                handleDrop({ clientX: centerX, clientY: centerY } as any);
                                                            }
                                                        }}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all text-sm font-medium text-[var(--text-primary)] shadow-sm hover:shadow-md"
                                                    >
                                                        <Database size={16} className="text-[var(--text-secondary)]" />
                                                        Add Data Source
                                                    </button>
                                                </div>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-4">
                                                    💡 Tip: Drag components from the sidebar to get started
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div> {/* Close transform div */}
                        </div> {/* Close Canvas Area */}
                        </div> {/* Close canvas div */}
                    </div> {/* Close Content Area (Sidebar + Canvas) */}

                        {/* AI Assistant Panel (Right Side) */}
                        <AIAssistantSidePanel
                            show={showAiAssistant}
                            onClose={() => setShowAiAssistant(false)}
                            messages={aiChatMessages}
                            chatInput={aiChatInput}
                            setChatInput={setAiChatInput}
                            isLoading={isAiChatLoading}
                            onSend={handleSendWorkflowAiMessage}
                            onAcceptSuggestion={handleAcceptWorkflowSuggestion}
                            onRejectSuggestion={handleRejectWorkflowSuggestion}
                            messagesEndRef={aiChatMessagesEndRef}
                        />

                        {/* Configuration Modal */}
                        {configuringNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringNodeId}
                                onClose={() => setConfiguringNodeId(null)}
                                title="Configure Fetch Data"
                                icon={Database}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveNodeConfig}
                                            disabled={!selectedEntityId}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Select Entity
                                        </label>
                                        <select
                                            value={selectedEntityId}
                                            onChange={(e) => setSelectedEntityId(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="">Choose entity...</option>
                                            {entities.map(entity => (
                                                <option key={entity.id} value={entity.id}>{entity.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('fetchData', 'Fetch Data')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* HTTP Configuration Modal */}
                        {configuringHttpNodeId && (
                            <HttpConfigPanel
                                nodeId={configuringHttpNodeId!}
                                node={nodes.find(n => n.id === configuringHttpNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringHttpNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Webhook Configuration Modal */}
                        {configuringWebhookNodeId && (
                            <WebhookConfigPanel
                                nodeId={configuringWebhookNodeId!}
                                node={nodes.find(n => n.id === configuringWebhookNodeId)}
                                workflowId={currentWorkflowId || ''}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringWebhookNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                                showToast={showToast}
                                generateId={generateUUID}
                                API_BASE={API_BASE}
                            />
                        )}

                        {/* Webhook Response Configuration Modal */}
                        {configuringWebhookResponseNodeId && (
                            <WebhookResponseConfigPanel
                                nodeId={configuringWebhookResponseNodeId!}
                                nodes={nodes}
                                onUpdateConfig={handlePanelSave}
                                onClose={() => setConfiguringWebhookResponseNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* MySQL Configuration Modal */}
                        {configuringMySQLNodeId && (
                            <MySQLConfigPanel
                                nodeId={configuringMySQLNodeId!}
                                node={nodes.find(n => n.id === configuringMySQLNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringMySQLNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* SAP Fetch Configuration Modal */}
                        {configuringSAPNodeId && (
                            <SAPConfigPanel
                                nodeId={configuringSAPNodeId!}
                                node={nodes.find(n => n.id === configuringSAPNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringSAPNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* OSIsoft PI Configuration Panel */}
                        {configuringOsiPiNodeId && (
                            <OsiPiConfigPanel
                                nodeId={configuringOsiPiNodeId!}
                                node={nodes.find(n => n.id === configuringOsiPiNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringOsiPiNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* FranMIT Configuration Panel */}
                        {configuringFranmitNodeId && (
                            <FranmitConfigPanel
                                nodeId={configuringFranmitNodeId!}
                                node={nodes.find(n => n.id === configuringFranmitNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringFranmitNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Conveyor Belt Configuration Panel */}
                        {configuringConveyorNodeId && (
                            <ConveyorConfigPanel
                                nodeId={configuringConveyorNodeId!}
                                node={nodes.find(n => n.id === configuringConveyorNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringConveyorNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* LIMS Connector Modal */}
                        {configuringLIMSNodeId && (
                            <LIMSConfigPanel
                                nodeId={configuringLIMSNodeId!}
                                node={nodes.find(n => n.id === configuringLIMSNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringLIMSNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Statistical Analysis Modal */}
                        {configuringStatisticalNodeId && (
                            <StatisticalConfigPanel
                                nodeId={configuringStatisticalNodeId!}
                                node={nodes.find(n => n.id === configuringStatisticalNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringStatisticalNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Alert Agent Modal */}
                        {configuringAlertAgentNodeId && (
                            <AlertAgentConfigPanel
                                nodeId={configuringAlertAgentNodeId!}
                                node={nodes.find(n => n.id === configuringAlertAgentNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringAlertAgentNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* PDF Report Generator Modal */}
                        {configuringPdfReportNodeId && (
                            <PdfReportConfigPanel
                                nodeId={configuringPdfReportNodeId!}
                                node={nodes.find(n => n.id === configuringPdfReportNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringPdfReportNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Send Email Configuration Modal */}
                        {configuringEmailNodeId && (
                            <EmailConfigPanel
                                nodeId={configuringEmailNodeId!}
                                node={nodes.find(n => n.id === configuringEmailNodeId)}
                                nodes={nodes}
                                connections={connections}
                                entities={entities}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringEmailNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Send SMS Configuration Modal */}
                        {configuringSMSNodeId && (
                            <SMSConfigPanel
                                nodeId={configuringSMSNodeId!}
                                node={nodes.find(n => n.id === configuringSMSNodeId)}
                                nodes={nodes}
                                connections={connections}
                                entities={entities}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringSMSNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Send WhatsApp Configuration Modal */}
                        {configuringWhatsAppNodeId && (
                            <WhatsAppConfigPanel
                                nodeId={configuringWhatsAppNodeId!}
                                node={nodes.find(n => n.id === configuringWhatsAppNodeId)}
                                nodes={nodes}
                                connections={connections}
                                entities={entities}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringWhatsAppNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Rename Columns Configuration Modal */}
                        {configuringRenameColumnsNodeId && (
                            <RenameColumnsConfigPanel
                                nodeId={configuringRenameColumnsNodeId!}
                                node={nodes.find(n => n.id === configuringRenameColumnsNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringRenameColumnsNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            nodes={nodes}
                            connections={connections}
                            />
                        )}

                        {/* Data Visualization Configuration Modal */}
                        {configuringVisualizationNodeId && (
                            <VisualizationConfigPanel
                                nodeId={configuringVisualizationNodeId!}
                                node={nodes.find(n => n.id === configuringVisualizationNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringVisualizationNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                                nodes={nodes}
                                connections={connections}
                            />
                        )}

                        {/* ESIOS Configuration Modal */}
                        {configuringEsiosNodeId && (
                            <EsiosConfigPanel
                                nodeId={configuringEsiosNodeId!}
                                node={nodes.find(n => n.id === configuringEsiosNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringEsiosNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Climatiq Configuration Modal */}
                        {configuringClimatiqNodeId && (
                            <ClimatiqConfigPanel
                                nodeId={configuringClimatiqNodeId!}
                                node={nodes.find(n => n.id === configuringClimatiqNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringClimatiqNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Human Approval Configuration Modal */}
                        {configuringHumanApprovalNodeId && (
                            <HumanApprovalConfigPanel
                                nodeId={configuringHumanApprovalNodeId!}
                                node={nodes.find(n => n.id === configuringHumanApprovalNodeId)}
                                nodes={nodes}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringHumanApprovalNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Data Preview Modal */}
                        <DataPreviewModal
                            nodes={nodes}
                            viewingDataNodeId={viewingDataNodeId}
                            onClose={() => setViewingDataNodeId(null)}
                            dataViewTab={dataViewTab}
                            setDataViewTab={setDataViewTab}
                            splitViewTab={splitViewTab}
                            setSplitViewTab={setSplitViewTab}
                        />

                        {/* Condition Configuration Modal */}
                        {configuringConditionNodeId && (
                            <ConditionConfigPanel
                                nodeId={configuringConditionNodeId!}
                                node={nodes.find(n => n.id === configuringConditionNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringConditionNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            nodes={nodes}
                            connections={connections}
                            />
                        )}

                        {/* Add Field Configuration Modal */}
                        {configuringAddFieldNodeId && (
                            <AddFieldConfigPanel
                                nodeId={configuringAddFieldNodeId!}
                                node={nodes.find(n => n.id === configuringAddFieldNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringAddFieldNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                        {/* Join Configuration Modal */}
                        {configuringJoinNodeId && (
                            <JoinConfigPanel
                                nodeId={configuringJoinNodeId!}
                                node={nodes.find(n => n.id === configuringJoinNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringJoinNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            nodes={nodes}
                            connections={connections}
                            />
                        )}

                        {/* Split Columns Configuration Modal */}
                        {configuringSplitColumnsNodeId && (
                            <SplitColumnsConfigPanel
                                nodeId={configuringSplitColumnsNodeId!}
                                node={nodes.find(n => n.id === configuringSplitColumnsNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringSplitColumnsNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            nodes={nodes}
                            connections={connections}
                            />
                        )}

                        {/* Excel Input Configuration Side Panel */}
                        {configuringExcelNodeId && (
                            <ExcelConfigPanel
                                nodeId={configuringExcelNodeId!}
                                node={nodes.find(n => n.id === configuringExcelNodeId)}
                                nodes={nodes}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringExcelNodeId(null)}
                                onRun={handleRunNode}
                                openFeedbackPopup={openFeedbackPopup}
                                handleExcelFileChange={handleExcelFileChange}
                                excelFile={excelFile}
                                excelPreviewData={excelPreviewData}
                                isParsingExcel={isParsingExcel}
                            />
                        )}

                        {/* PDF Input Configuration Modal */}
                        {configuringPdfNodeId && (
                            <PdfConfigPanel
                                nodeId={configuringPdfNodeId!}
                                node={nodes.find(n => n.id === configuringPdfNodeId)}
                                nodes={nodes}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringPdfNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                                handlePdfFileChange={handlePdfFileChange}
                                pdfFile={pdfFile}
                                pdfPreviewData={pdfPreviewData}
                                isParsingPdf={isParsingPdf}
                            />
                        )}

                        {/* Save Records Configuration Modal */}
                        {configuringSaveNodeId && (
                            <SaveRecordsConfigPanel
                                nodeId={configuringSaveNodeId!}
                                node={nodes.find(n => n.id === configuringSaveNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringSaveNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                                entities={entities}
                            />
                        )}
                    </div>

                    {/* LLM Config Modal */}
                        {configuringLLMNodeId && (
                            <LLMConfigPanel
                                nodeId={configuringLLMNodeId!}
                                node={nodes.find(n => n.id === configuringLLMNodeId)}
                                nodes={nodes}
                                connections={connections}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringLLMNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                                entities={entities}
                            />
                        )}

                    {/* Python Config Modal */}
                        {configuringPythonNodeId && (
                            <PythonConfigPanel
                                nodeId={configuringPythonNodeId!}
                                node={nodes.find(n => n.id === configuringPythonNodeId)}
                                nodes={nodes}
                                connections={connections}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringPythonNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                    {/* Manual Input Config Modal */}
                        {configuringManualInputNodeId && (
                            <ManualInputConfigPanel
                                nodeId={configuringManualInputNodeId!}
                                node={nodes.find(n => n.id === configuringManualInputNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringManualInputNodeId(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}

                    {/* Workflow Runner Modal */}
                    {showRunnerModal && (
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none" onClick={() => setShowRunnerModal(false)}>
                            <div className="bg-[var(--bg-card)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-normal text-[var(--text-primary)]">Export Workflow</h2>
                                        <button
                                            onClick={() => setShowRunnerModal(false)}
                                            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                        >
                                            <X size={24} weight="light" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)] mt-1">Export and share your workflow as a form</p>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* Share & Embed Section */}
                                    <div className="mb-6 space-y-4">
                                        {/* Shareable Link */}
                                        <div className="bg-gradient-to-r from-[#256A65]/5 to-[#256A65]/10 rounded-xl p-4 border border-[#256A65]/20">
                                            <label className="block text-sm font-normal text-teal-800 mb-2 flex items-center gap-2">
                                                <Globe size={16} weight="light" />
                                                Published Interface
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={getShareableUrl()}
                                                    className="flex-1 px-3 py-2 bg-[var(--bg-card)] border border-[#256A65]/30 rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(getShareableUrl(), 'Link copied to clipboard!')}
                                                    className="px-4 py-2 bg-[var(--bg-card)] border border-[#256A65]/30 rounded-lg hover:bg-[#256A65]/5 transition-colors text-[#1e554f] font-medium text-sm flex items-center gap-2"
                                                >
                                                    <Share2 size={16} weight="light" />
                                                    Copy
                                                </button>
                                            </div>
                                        </div>

                                        {/* Embed Code Toggle */}
                                        <div className="bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                                            <button
                                                onClick={() => setShowEmbedCode(!showEmbedCode)}
                                                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--bg-hover)] transition-colors"
                                            >
                                                <span className="font-normal text-[var(--text-primary)] flex items-center gap-2">
                                                    <Code size={16} weight="light" />
                                                    Embed Code
                                                </span>
                                                <span className={`text-[var(--text-tertiary)] transition-transform ${showEmbedCode ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </span>
                                            </button>
                                            {showEmbedCode && (
                                                <div className="px-4 pb-4 border-t border-[var(--border-light)] pt-3">
                                                    <p className="text-xs text-[var(--text-secondary)] mb-2">Copy this code to embed the form in your website or application:</p>
                                                    <div className="relative">
                                                        <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto font-mono">
                                                            {getEmbedCode()}
                                                        </pre>
                                                        <button
                                                            onClick={() => copyToClipboard(getEmbedCode(), 'Embed code copied!')}
                                                            className="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-[var(--border-light)] my-6"></div>

                                    {/* File Input Form */}
                                    {nodes.filter(n => n.type === 'excelInput' || n.type === 'pdfInput').length > 0 && (
                                        <div className="space-y-4 mb-6">
                                            <h3 className="font-normal text-[var(--text-primary)] flex items-center gap-2">
                                                <Upload size={18} />
                                                File Inputs
                                            </h3>
                                            {nodes.filter(n => n.type === 'excelInput' || n.type === 'pdfInput').map(node => (
                                                <div key={node.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-light)]">
                                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                                        {node.label || (node.type === 'excelInput' ? 'Excel/CSV File' : 'PDF File')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="file"
                                                            accept={node.type === 'excelInput' ? '.csv,.xlsx,.xls' : '.pdf'}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setRunnerFileInputs(prev => ({
                                                                        ...prev,
                                                                        [node.id]: file
                                                                    }));
                                                                }
                                                            }}
                                                            className="hidden"
                                                            id={`runner-file-${node.id}`}
                                                        />
                                                        <label
                                                            htmlFor={`runner-file-${node.id}`}
                                                            className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-[var(--border-medium)] rounded-lg cursor-pointer hover:border-[#256A65] hover:bg-[#256A65]/5 transition-all"
                                                        >
                                                            {runnerFileInputs[node.id] ? (
                                                                <>
                                                                    <CheckCircle className="text-[#256A65]" size={20} weight="light" />
                                                                    <span className="text-[var(--text-primary)] font-medium">{runnerFileInputs[node.id]?.name}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="text-[var(--text-tertiary)]" size={20} weight="light" />
                                                                    <span className="text-[var(--text-secondary)]">Click to upload {node.type === 'excelInput' ? 'Excel/CSV' : 'PDF'}</span>
                                                                </>
                                                            )}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Input Form */}
                                    {Object.keys(runnerInputs).length > 0 ? (
                                        <div className="space-y-4 mb-6">
                                            <h3 className="font-normal text-[var(--text-primary)] flex items-center gap-2">
                                                <Edit size={18} weight="light" />
                                                Inputs
                                            </h3>
                                            {Object.entries(runnerInputs).map(([nodeId, value]) => {
                                                const node = nodes.find(n => n.id === nodeId);
                                                return (
                                                    <div key={nodeId} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-light)]">
                                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                                            {node?.config?.inputVarName || 'Input'}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={value}
                                                            onChange={(e) => setRunnerInputs(prev => ({
                                                                ...prev,
                                                                [nodeId]: e.target.value
                                                            }))}
                                                            placeholder="Enter value..."
                                                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-[var(--text-secondary)]">
                                            <p>No manual input nodes found in this workflow.</p>
                                            <p className="text-sm mt-1">Add "Manual Data Input" nodes to create form fields.</p>
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <button
                                        onClick={runWorkflowFromRunner}
                                        disabled={isRunningWorkflow}
                                        className={`w-full py-3 rounded-lg font-normal text-white flex items-center justify-center gap-2 transition-all ${isRunningWorkflow
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : 'bg-slate-800 hover:bg-[var(--bg-selected)]'
                                            }`}
                                    >
                                        {isRunningWorkflow ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Running...
                                            </>
                                        ) : (
                                            <>
                                                <PlayCircle size={20} weight="light" />
                                                Submit
                                            </>
                                        )}
                                    </button>

                                    {/* Output Display */}
                                    {Object.keys(runnerOutputs).length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            <h3 className="font-normal text-[var(--text-primary)] flex items-center gap-2 border-t pt-6">
                                                <Database size={18} weight="light" />
                                                Output
                                            </h3>
                                            {Object.entries(runnerOutputs).map(([nodeId, data]) => {
                                                const node = nodes.find(n => n.id === nodeId);
                                                return (
                                                    <div key={nodeId} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-light)]">
                                                        <h4 className="font-medium text-[var(--text-primary)] mb-2">{node?.label || 'Output'}</h4>
                                                        <div className="bg-[var(--bg-card)] p-3 rounded border border-[var(--border-medium)] max-h-64 overflow-auto">
                                                            <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                                                                {JSON.stringify(data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Toast Notification - Improved Design */}
            {toast && (
                <div 
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-300 ${
                        toast.type === 'success' 
                            ? 'bg-emerald-50/95 border-emerald-200/50 text-emerald-900' 
                            : 'bg-red-50/95 border-red-200/50 text-red-900'
                    }`}
                    style={{
                        animation: 'slideInUp 0.3s ease-out',
                    }}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                        {toast.type === 'success' ? (
                            <CheckCircle size={20} className="text-emerald-600" />
                        ) : (
                            <XCircle size={20} className="text-red-600" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm block">{toast.message}</span>
                    </div>
                    <button 
                        onClick={() => setToast(null)}
                        className={`ml-2 p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                            toast.type === 'success' 
                                ? 'hover:bg-emerald-100/50 text-emerald-600' 
                                : 'hover:bg-red-100/50 text-red-600'
                        }`}
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* AI Confirm Dialog */}
            {showAiConfirmDialog && aiGeneratedWorkflow && (
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-[400px] overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
                                    <Sparkles size={20} className="text-[var(--text-primary)]" />
                                </div>
                                <div>
                                    <h3 className="font-normal text-lg text-[var(--text-primary)]">Workflow Generated!</h3>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        {aiGeneratedWorkflow.nodes.length} nodes, {aiGeneratedWorkflow.connections.length} connections
                                    </p>
                                </div>
                            </div>

                            <p className="text-[var(--text-secondary)] mb-4">
                                How would you like to add this workflow to the canvas?
                            </p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => applyAiWorkflow('replace')}
                                    className="w-full p-3 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                >
                                    <span className="font-medium text-[var(--text-primary)]">Replace canvas</span>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Clear existing nodes and start fresh</p>
                                </button>
                                <button
                                    onClick={() => applyAiWorkflow('add')}
                                    className="w-full p-3 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                >
                                    <span className="font-medium text-[var(--text-primary)]">Add to canvas</span>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Append nodes to existing workflow</p>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-light)]">
                            <button
                                onClick={() => {
                                    setShowAiConfirmDialog(false);
                                    setAiGeneratedWorkflow(null);
                                }}
                                className="w-full px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Execution History Modal */}
            <ExecutionHistoryInlineModal
                showExecutionHistory={showExecutionHistory}
                onClose={() => setShowExecutionHistory(false)}
                executionHistory={executionHistory}
                selectedExecution={selectedExecution}
                setSelectedExecution={setSelectedExecution}
                loadExecutionHistory={loadExecutionHistory}
                loadingExecutions={loadingExecutions}
                nodes={nodes}
                formatDate={formatDate}
            />

            {/* Node Feedback Popup */}
            <FeedbackPopupModal
                feedbackPopupNodeId={feedbackPopupNodeId}
                feedbackPopupNodeLabel={feedbackPopupNodeLabel}
                feedbackText={feedbackText}
                setFeedbackText={setFeedbackText}
                isSubmittingFeedback={isSubmittingFeedback}
                onSubmit={submitFeedback}
                onClose={closeFeedbackPopup}
            />

            {/* Exit Confirmation Modal */}
            <ExitConfirmationModal
                show={showExitConfirmation}
                onClose={() => setShowExitConfirmation(false)}
                onExitWithoutSaving={confirmExitWithoutSaving}
                onExitWithSaving={confirmExitWithSaving}
                isSaving={isSaving}
            />

            {/* Workflow Templates Modal */}
            <TemplatesGalleryInlineModal
                show={showTemplatesModal && !previewingTemplate}
                onClose={() => setShowTemplatesModal(false)}
                filteredTemplates={filteredTemplates}
                allTemplatesCount={WORKFLOW_TEMPLATES.length}
                selectedTemplateCategory={selectedTemplateCategory}
                setSelectedTemplateCategory={setSelectedTemplateCategory}
                setPreviewingTemplate={setPreviewingTemplate}
                copyTemplateToWorkflows={copyTemplateToWorkflows}
                isCopyingTemplate={isCopyingTemplate}
            />

            {/* Template Preview Modal */}
            <TemplatePreviewModal
                template={previewingTemplate}
                onClose={() => setPreviewingTemplate(null)}
                copyTemplateToWorkflows={copyTemplateToWorkflows}
                isCopyingTemplate={isCopyingTemplate}
                getNodeIcon={getNodeIcon}
                getNodeIconBg={getNodeIconBg}
            />

            {/* Quick Connect Component Search Modal */}
            <QuickConnectModal
                show={showComponentSearch}
                connectingFromNodeId={connectingFromNodeId}
                componentSearchQuery={componentSearchQuery}
                setComponentSearchQuery={setComponentSearchQuery}
                onClose={() => {
                    setShowComponentSearch(false);
                    setConnectingFromNodeId(null);
                    setComponentSearchQuery('');
                }}
                onSelect={handleQuickConnect}
                draggableItems={DRAGGABLE_ITEMS}
                getNodeIconBg={getNodeIconBg}
            />

            {/* Tags Modal */}
            <TagsManageModal
                show={showTagsModal}
                onClose={() => setShowTagsModal(false)}
                workflowTags={workflowTags}
                setWorkflowTags={setWorkflowTags}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                currentWorkflowId={currentWorkflowId}
                workflowName={workflowName}
                nodes={nodes}
                connections={connections}
                userName={user?.name || user?.email?.split('@')[0] || 'Unknown'}
                fetchWorkflows={fetchWorkflows}
                showToast={showToast}
            />

            {/* Schedule Config Modal */}
                        {configuringScheduleNodeId && (
                            <ScheduleConfigPanel
                                nodeId={configuringScheduleNodeId!}
                                node={nodes.find(n => n.id === configuringScheduleNodeId)}
                                onSave={handlePanelSave}
                                onClose={() => setConfiguringScheduleNodeId(null)}
                            />
                        )}
        </div>

    );
};