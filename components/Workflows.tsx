import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FlowArrow as Workflow, Lightning as Zap, Play, CheckCircle, WarningCircle as AlertCircle, ArrowRight, ArrowLeft, X, FloppyDisk as Save, FolderOpen, Trash, PlayCircle, Check, XCircle, Database, Wrench, MagnifyingGlass as Search, CaretDoubleLeft as ChevronsLeft, CaretDoubleRight as ChevronsRight, Sparkle as Sparkles, Code, PencilSimple as Edit, SignOut as LogOut, ChatCircle as MessageSquare, Globe, Leaf, Share as Share2, UserCheck, GitMerge, FileXls as FileSpreadsheet, FileText, UploadSimple as Upload, Columns, DotsSixVertical as GripVertical, Users, Envelope as Mail, BookOpen, Copy, Eye, Clock, ClockCounterClockwise as History, ArrowsOut as Maximize2, MagnifyingGlassPlus as ZoomIn, MagnifyingGlassMinus as ZoomOut, Robot as Bot, DeviceMobile as Smartphone, ChartBar as BarChart3, User, Calendar, CaretRight as ChevronRight, CaretDown as ChevronDown, CaretUp as ChevronUp, Plus, Folder, ShieldCheck as Shield, Terminal, Tag, DotsThreeVertical as MoreVertical, WebhooksLogo as Webhook, Flask as FlaskConical, TrendUp, Bell, FilePdf, Bug, Pi } from '@phosphor-icons/react';
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
} from './workflows/index';

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
}

export const Workflows: React.FC<WorkflowsProps> = ({ entities, onViewChange }) => {
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
    const [conditionProcessingMode, setConditionProcessingMode] = useState<'batch' | 'perRow'>('batch');
    const [additionalConditions, setAdditionalConditions] = useState<Array<{id: string; field: string; operator: string; value: string}>>([]);
    const [conditionLogicalOperator, setConditionLogicalOperator] = useState<'AND' | 'OR'>('AND');
    const [connectingFromType, setConnectingFromType] = useState<'true' | 'false' | 'A' | 'B' | null>(null);
    const [configuringAddFieldNodeId, setConfiguringAddFieldNodeId] = useState<string | null>(null);
    const [addFieldName, setAddFieldName] = useState<string>('');
    const [addFieldValue, setAddFieldValue] = useState<string>('');
    const [configuringSaveNodeId, setConfiguringSaveNodeId] = useState<string | null>(null);
    const [saveEntityId, setSaveEntityId] = useState<string>('');

    // Sidebar State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Recents']));

    // LLM Node State
    const [configuringLLMNodeId, setConfiguringLLMNodeId] = useState<string | null>(null);
    const [llmPrompt, setLlmPrompt] = useState<string>('');
    const [llmContextEntities, setLlmContextEntities] = useState<string[]>([]);
    const [llmIncludeInput, setLlmIncludeInput] = useState<boolean>(true);
    const [llmProcessingMode, setLlmProcessingMode] = useState<'batch' | 'perRow'>('batch');

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
    const [splitColumnsAvailable, setSplitColumnsAvailable] = useState<string[]>([]);
    const [splitColumnsOutputA, setSplitColumnsOutputA] = useState<string[]>([]);
    const [splitColumnsOutputB, setSplitColumnsOutputB] = useState<string[]>([]);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

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
    const [manualInputVarName, setManualInputVarName] = useState<string>('');
    const [manualInputVarValue, setManualInputVarValue] = useState<string>('');

    // HTTP Node State
    const [configuringHttpNodeId, setConfiguringHttpNodeId] = useState<string | null>(null);
    const [httpUrl, setHttpUrl] = useState<string>('');

    // Webhook Node State
    const [configuringWebhookNodeId, setConfiguringWebhookNodeId] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string>('');
    const [webhookToken, setWebhookToken] = useState<string>('');

    // MySQL Node State
    const [configuringMySQLNodeId, setConfiguringMySQLNodeId] = useState<string | null>(null);
    const [mysqlHost, setMysqlHost] = useState<string>('localhost');
    const [mysqlPort, setMysqlPort] = useState<string>('3306');
    const [mysqlDatabase, setMysqlDatabase] = useState<string>('');
    const [mysqlUsername, setMysqlUsername] = useState<string>('');
    const [mysqlPassword, setMysqlPassword] = useState<string>('');
    const [mysqlQuery, setMysqlQuery] = useState<string>('SELECT * FROM ');

    // SAP Fetch Node State
    const [configuringSAPNodeId, setConfiguringSAPNodeId] = useState<string | null>(null);
    const [sapConnectionName, setSapConnectionName] = useState<string>('SAP_Production');
    const [sapAuthType, setSapAuthType] = useState<string>('OAuth2_Client_Credentials');
    const [sapClientId, setSapClientId] = useState<string>('');
    const [sapClientSecret, setSapClientSecret] = useState<string>('');
    const [sapTokenUrl, setSapTokenUrl] = useState<string>('');
    const [sapBaseApiUrl, setSapBaseApiUrl] = useState<string>('');
    const [sapServicePath, setSapServicePath] = useState<string>('/sap/opu/odata/sap/');
    const [sapEntity, setSapEntity] = useState<string>('');

    // Send Email Node State
    const [configuringEmailNodeId, setConfiguringEmailNodeId] = useState<string | null>(null);
    const [emailTo, setEmailTo] = useState<string>('');
    const [emailSubject, setEmailSubject] = useState<string>('');
    const [emailBody, setEmailBody] = useState<string>('');
    const [emailSmtpHost, setEmailSmtpHost] = useState<string>('smtp.gmail.com');
    const [emailSmtpPort, setEmailSmtpPort] = useState<string>('587');
    const [emailSmtpUser, setEmailSmtpUser] = useState<string>('');
    const [emailSmtpPass, setEmailSmtpPass] = useState<string>('');

    // Send SMS Node State
    const [configuringSMSNodeId, setConfiguringSMSNodeId] = useState<string | null>(null);
    const [smsTo, setSmsTo] = useState<string>('');
    const [smsBody, setSmsBody] = useState<string>('');
    const [twilioAccountSid, setTwilioAccountSid] = useState<string>('');
    const [twilioAuthToken, setTwilioAuthToken] = useState<string>('');
    const [twilioFromNumber, setTwilioFromNumber] = useState<string>('');
    const [showSMSTwilioSettings, setShowSMSTwilioSettings] = useState<boolean>(false);

    // Data Visualization Node State
    const [configuringVisualizationNodeId, setConfiguringVisualizationNodeId] = useState<string | null>(null);
    const [visualizationPrompt, setVisualizationPrompt] = useState<string>('');
    const [generatedWidget, setGeneratedWidget] = useState<WidgetConfig | null>(null);
    const [isGeneratingWidget, setIsGeneratingWidget] = useState<boolean>(false);
    const [showWidgetExplanation, setShowWidgetExplanation] = useState<boolean>(false);
    const [showEmailSmtpSettings, setShowEmailSmtpSettings] = useState<boolean>(false);

    // Schedule Node State
    const [configuringScheduleNodeId, setConfiguringScheduleNodeId] = useState<string | null>(null);
    const [scheduleIntervalValue, setScheduleIntervalValue] = useState<string>('5');
    const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
    const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(true);
    const [scheduleType, setScheduleType] = useState<'interval' | 'specific'>('interval');
    const [scheduleTime, setScheduleTime] = useState<string>('09:00');
    const [showScheduleUpgradeModal, setShowScheduleUpgradeModal] = useState<boolean>(false);
    const [showScheduleContactInfo, setShowScheduleContactInfo] = useState<boolean>(false);
    const [scheduleRepeat, setScheduleRepeat] = useState<'daily' | 'weekly' | 'none'>('daily');

    // OPC UA Node State
    const [configuringOpcuaNodeId, setConfiguringOpcuaNodeId] = useState<string | null>(null);
    const [opcuaEndpointUrl, setOpcuaEndpointUrl] = useState<string>('opc.tcp://localhost:4840');
    const [opcuaNodeId, setOpcuaNodeId] = useState<string>('ns=2;s=Temperature');
    const [opcuaUsername, setOpcuaUsername] = useState<string>('');
    const [opcuaPassword, setOpcuaPassword] = useState<string>('');
    const [opcuaSecurityMode, setOpcuaSecurityMode] = useState<'None' | 'Sign' | 'SignAndEncrypt'>('None');
    const [opcuaSecurityPolicy, setOpcuaSecurityPolicy] = useState<string>('None');
    const [opcuaPollInterval, setOpcuaPollInterval] = useState<string>('5000');

    // MQTT Node State
    const [configuringMqttNodeId, setConfiguringMqttNodeId] = useState<string | null>(null);
    const [mqttBrokerUrl, setMqttBrokerUrl] = useState<string>('mqtt://localhost');
    const [mqttPort, setMqttPort] = useState<string>('1883');
    const [mqttTopic, setMqttTopic] = useState<string>('sensors/#');
    const [mqttUsername, setMqttUsername] = useState<string>('');
    const [mqttPassword, setMqttPassword] = useState<string>('');
    const [mqttClientId, setMqttClientId] = useState<string>('');
    const [mqttQos, setMqttQos] = useState<'0' | '1' | '2'>('0');
    const [mqttCleanSession, setMqttCleanSession] = useState<boolean>(true);

    // OSIsoft PI Node State
    const [configuringOsiPiNodeId, setConfiguringOsiPiNodeId] = useState<string | null>(null);
    const [osiPiHost, setOsiPiHost] = useState<string>('');
    const [osiPiApiKey, setOsiPiApiKey] = useState<string>('');
    const [osiPiGranularityValue, setOsiPiGranularityValue] = useState<string>('5');
    const [osiPiGranularityUnit, setOsiPiGranularityUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days'>('seconds');
    const [osiPiWebIds, setOsiPiWebIds] = useState<string[]>(['', '']);
    const [showOsiPiApiKey, setShowOsiPiApiKey] = useState<boolean>(false);

    // FranMIT Node State
    const [configuringFranmitNodeId, setConfiguringFranmitNodeId] = useState<string | null>(null);
    const [franmitApiSecretId, setFranmitApiSecretId] = useState<string>('');
    const [franmitReactorVolume, setFranmitReactorVolume] = useState<string>('');
    const [franmitReactionVolume, setFranmitReactionVolume] = useState<string>('');
    const [franmitCatalystScaleFactor, setFranmitCatalystScaleFactor] = useState<string>('');
    const [showFranmitApiSecret, setShowFranmitApiSecret] = useState<boolean>(false);

    // Unsaved Changes Confirmation
    const [showExitConfirmation, setShowExitConfirmation] = useState<boolean>(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

    // ESIOS Node State
    const [configuringEsiosNodeId, setConfiguringEsiosNodeId] = useState<string | null>(null);
    const [esiosArchiveId, setEsiosArchiveId] = useState<string>('1001'); // PVPC indicator ID
    const [esiosDate, setEsiosDate] = useState<string>(new Date().toISOString().split('T')[0]); // Today YYYY-MM-DD

    // Climatiq Node State
    const [configuringClimatiqNodeId, setConfiguringClimatiqNodeId] = useState<string | null>(null);
    const [climatiqQuery, setClimatiqQuery] = useState<string>('Passenger Car');
    const [climatiqSearchResults, setClimatiqSearchResults] = useState<any[]>([]);
    const [climatiqSelectedIndex, setClimatiqSelectedIndex] = useState<number | null>(null);
    const [climatiqSearching, setClimatiqSearching] = useState<boolean>(false);

    // Human Approval Node State
    const [configuringHumanApprovalNodeId, setConfiguringHumanApprovalNodeId] = useState<string | null>(null);
    const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
    const [selectedApproverUserId, setSelectedApproverUserId] = useState<string>('');
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

    // LIMS Fetch Node State
    const [configuringLIMSNodeId, setConfiguringLIMSNodeId] = useState<string | null>(null);
    const [limsServerUrl, setLimsServerUrl] = useState<string>('');
    const [limsApiKey, setLimsApiKey] = useState<string>('');
    const [limsEndpoint, setLimsEndpoint] = useState<string>('materials');
    const [limsQuery, setLimsQuery] = useState<string>('');

    // Statistical Analysis Node State
    const [configuringStatisticalNodeId, setConfiguringStatisticalNodeId] = useState<string | null>(null);
    const [statisticalMethod, setStatisticalMethod] = useState<'pca' | 'spc' | 'regression' | 'goldenBatch'>('goldenBatch');
    const [statisticalParams, setStatisticalParams] = useState<string>('{}');
    const [goldenBatchId, setGoldenBatchId] = useState<string>('');

    // Alert Agent Node State
    const [configuringAlertAgentNodeId, setConfiguringAlertAgentNodeId] = useState<string | null>(null);
    const [alertConditions, setAlertConditions] = useState<string>('[]');
    const [alertSeverity, setAlertSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
    const [alertActions, setAlertActions] = useState<string[]>(['email']);
    const [alertRecipients, setAlertRecipients] = useState<string>('');

    // PDF Report Node State
    const [configuringPdfReportNodeId, setConfiguringPdfReportNodeId] = useState<string | null>(null);
    const [pdfTemplate, setPdfTemplate] = useState<string>('standard');
    const [pdfReportData, setPdfReportData] = useState<string>('{}');
    const [pdfOutputPath, setPdfOutputPath] = useState<string>('');

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
            
            // Scale factor to spread out nodes (nodes are larger now)
            const SPACING_SCALE = 1.4;
            
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
        if (node && node.type === 'condition') {
            setConfiguringConditionNodeId(nodeId);
            setConditionField(node.config?.conditionField || '');
            setConditionOperator(node.config?.conditionOperator || 'equals');
            setConditionValue(node.config?.conditionValue || '');
            setConditionProcessingMode(node.config?.processingMode || 'batch');
            setAdditionalConditions(node.config?.additionalConditions || []);
            setConditionLogicalOperator(node.config?.logicalOperator || 'AND');
            setNodeCustomTitle(node.config?.customName || '');
        }
    };

    const saveConditionConfig = () => {
        if (!configuringConditionNodeId || !conditionField) return;

        const finalLabel = nodeCustomTitle.trim() || 'If / Else';
        
        setNodes(prev => prev.map(n =>
            n.id === configuringConditionNodeId
                ? {
                    ...n,
                    label: finalLabel,
                    config: {
                        ...n.config,
                        conditionField,
                        conditionOperator,
                        conditionValue,
                        processingMode: conditionProcessingMode,
                        additionalConditions: additionalConditions,
                        logicalOperator: conditionLogicalOperator,
                        customName: nodeCustomTitle.trim() || undefined
                    }
                }
                : n
        ));
        setConfiguringConditionNodeId(null);
        setConditionField('');
        setConditionOperator('equals');
        setConditionValue('');
        setConditionProcessingMode('batch');
        setAdditionalConditions([]);
        setConditionLogicalOperator('AND');
        setNodeCustomTitle('');
    };

    const openAddFieldConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'addField') {
            setConfiguringAddFieldNodeId(nodeId);
            setAddFieldName(node.config?.conditionField || '');
            setAddFieldValue(node.config?.conditionValue || '');
        }
    };

    const saveAddFieldConfig = () => {
        if (!configuringAddFieldNodeId || !addFieldName) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringAddFieldNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        conditionField: addFieldName,
                        conditionValue: addFieldValue
                    }
                }
                : n
        ));
        setConfiguringAddFieldNodeId(null);
        setAddFieldName('');
        setAddFieldValue('');
    };

    const openJoinConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'join') {
            setConfiguringJoinNodeId(nodeId);
            setJoinStrategy(node.config?.joinStrategy || 'concat');
            setJoinType(node.config?.joinType || 'inner');
            setJoinKey(node.config?.joinKey || '');
        }
    };

    const saveJoinConfig = () => {
        if (!configuringJoinNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringJoinNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        joinStrategy,
                        joinType,
                        joinKey
                    }
                }
                : n
        ));
        setConfiguringJoinNodeId(null);
        setJoinStrategy('concat');
        setJoinType('inner');
        setJoinKey('');
    };

    const openSplitColumnsConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'splitColumns') {
            setConfiguringSplitColumnsNodeId(nodeId);
            
            // Get available columns from parent node's output data
            const parentConnection = connections.find(c => c.toNodeId === nodeId);
            const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
            
            // Handle splitColumns parent node
            let parentOutputData: any[] = [];
            if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
                parentOutputData = parentConnection?.outputType === 'B' 
                    ? parentNode.outputData.outputB || []
                    : parentNode.outputData.outputA || [];
            } else {
                parentOutputData = parentNode?.outputData || parentNode?.data || [];
            }
            
            const allColumns: string[] = [];
            if (Array.isArray(parentOutputData) && parentOutputData.length > 0) {
                const firstRecord = parentOutputData[0];
                if (firstRecord && typeof firstRecord === 'object') {
                    Object.keys(firstRecord).forEach(key => {
                        if (!allColumns.includes(key)) {
                            allColumns.push(key);
                        }
                    });
                }
            }
            
            // Initialize from existing config or default all to Output A
            const existingOutputA = node.config?.columnsOutputA || [];
            const existingOutputB = node.config?.columnsOutputB || [];
            
            if (existingOutputA.length > 0 || existingOutputB.length > 0) {
                // Use existing configuration, but only include columns that still exist
                setSplitColumnsOutputA(existingOutputA.filter((c: string) => allColumns.includes(c)));
                setSplitColumnsOutputB(existingOutputB.filter((c: string) => allColumns.includes(c)));
                // Any new columns go to available
                const usedColumns = [...existingOutputA, ...existingOutputB];
                setSplitColumnsAvailable(allColumns.filter(c => !usedColumns.includes(c)));
            } else {
                // Default: all columns go to Output A
                setSplitColumnsOutputA(allColumns);
                setSplitColumnsOutputB([]);
                setSplitColumnsAvailable([]);
            }
        }
    };

    const saveSplitColumnsConfig = () => {
        if (!configuringSplitColumnsNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringSplitColumnsNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        columnsOutputA: splitColumnsOutputA,
                        columnsOutputB: splitColumnsOutputB
                    }
                }
                : n
        ));
        setConfiguringSplitColumnsNodeId(null);
        setSplitColumnsAvailable([]);
        setSplitColumnsOutputA([]);
        setSplitColumnsOutputB([]);
        setDraggedColumn(null);
    };

    const openExcelConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'excelInput') {
            setConfiguringExcelNodeId(nodeId);
            // If the node already has data (GCS or inline), show preview
            if (node.config?.useGCS && node.config?.previewData) {
                // GCS data - use preview
                setExcelPreviewData({
                    headers: node.config.headers || [],
                    data: node.config.previewData.slice(0, 5),
                    rowCount: node.config.rowCount || node.config.previewData.length
                });
            } else if (node.config?.parsedData) {
                // Inline data
                setExcelPreviewData({
                    headers: node.config.headers || [],
                    data: node.config.parsedData.slice(0, 5),
                    rowCount: node.config.parsedData.length
                });
            } else {
                setExcelPreviewData(null);
            }
            setExcelFile(null);
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
            // If the node already has parsed data, show preview
            if (node.config?.pdfText) {
                setPdfPreviewData({
                    text: node.config.pdfText,
                    pages: node.config.pages || 0,
                    fileName: node.config.fileName || ''
                });
            } else {
                setPdfPreviewData(null);
            }
            setPdfFile(null);
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

            const res = await fetch(`${API_BASE}/parse-pdf`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to parse PDF');
            }

            const result = await res.json();
            setPdfPreviewData({
                text: result.text,
                pages: result.pages,
                fileName: result.fileName
            });

            // Save parsed data to node config
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
                                metadata: result.metadata
                            }
                        }
                        : n
                ));
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
        if (node && node.type === 'saveRecords') {
            setConfiguringSaveNodeId(nodeId);
            setSaveEntityId(node.config?.entityId || '');
            setNodeCustomTitle(node.config?.customName || '');
        }
    };

    const saveSaveRecordsConfig = () => {
        if (!configuringSaveNodeId || !saveEntityId) return;

        const entity = entities.find(e => e.id === saveEntityId);
        const defaultLabel = `Save to ${entity?.name || 'Database'}`;
        const finalLabel = nodeCustomTitle.trim() || defaultLabel;
        
        setNodes(prev => prev.map(n =>
            n.id === configuringSaveNodeId
                ? { 
                    ...n, 
                    label: finalLabel,
                    config: { 
                        entityId: saveEntityId, 
                        entityName: entity?.name || '',
                        customName: nodeCustomTitle.trim() || undefined
                    } 
                }
                : n
        ));
        setConfiguringSaveNodeId(null);
        setSaveEntityId('');
        setNodeCustomTitle('');
    };

    const openEquipmentConfig = async (nodeId: string) => {
        // Equipment node removed
    };

    const saveEquipmentConfig = () => {
        // Equipment node removed
    };

    const openLLMConfig = (nodeId: string) => {
        setConfiguringLLMNodeId(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setLlmPrompt(node.config?.llmPrompt || '');
            setLlmContextEntities(node.config?.llmContextEntities || []);
            setLlmIncludeInput(node.config?.llmIncludeInput !== undefined ? node.config.llmIncludeInput : true);
            setLlmProcessingMode(node.config?.processingMode || 'batch');
            setNodeCustomTitle(node.config?.customName || '');
        }
    };

    const saveLLMConfig = () => {
        if (!configuringLLMNodeId) return;

        const finalLabel = nodeCustomTitle.trim() || 'AI Generation';
        
        setNodes(prev => prev.map(n =>
            n.id === configuringLLMNodeId
                ? {
                    ...n,
                    label: finalLabel,
                    config: {
                        ...n.config,
                        llmPrompt,
                        llmContextEntities,
                        llmIncludeInput,
                        processingMode: llmProcessingMode,
                        customName: nodeCustomTitle.trim() || undefined
                    }
                }
                : n
        ));
        setConfiguringLLMNodeId(null);
        setLlmPrompt('');
        setLlmContextEntities([]);
        setLlmIncludeInput(true);
        setLlmProcessingMode('batch');
        setNodeCustomTitle('');
    };

    const openPythonConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setPythonCode(node.config?.pythonCode || 'def process(data):\n    # Modify data here\n    return data');
            setPythonAiPrompt(node.config?.pythonAiPrompt || '');
            setNodeCustomTitle(node.config?.customName || '');
            setConfiguringPythonNodeId(nodeId);
            setDebugSuggestion(null); // Clear any previous debug suggestion
        }
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

    const savePythonConfig = () => {
        if (configuringPythonNodeId) {
            const finalLabel = nodeCustomTitle.trim() || 'Python Code';
            
            setNodes(nodes.map(n => n.id === configuringPythonNodeId ? {
                ...n,
                label: finalLabel,
                config: { 
                    ...n.config, 
                    pythonCode, 
                    pythonAiPrompt,
                    customName: nodeCustomTitle.trim() || undefined
                }
            } : n));
            setConfiguringPythonNodeId(null);
            setNodeCustomTitle('');
        }
    };

    const openManualInputConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'manualInput') {
            setConfiguringManualInputNodeId(nodeId);
            setManualInputVarName(node.config?.inputVarName || '');
            setManualInputVarValue(node.config?.inputVarValue || '');
        }
    };

    const saveManualInputConfig = () => {
        if (!configuringManualInputNodeId || !manualInputVarName.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringManualInputNodeId
                ? {
                    ...n,
                    label: `${manualInputVarName}: ${manualInputVarValue}`,
                    config: {
                        ...n.config,
                        inputVarName: manualInputVarName,
                        inputVarValue: manualInputVarValue
                    }
                }
                : n
        ));
        setConfiguringManualInputNodeId(null);
        setManualInputVarName('');
        setManualInputVarValue('');
    };

    const openHttpConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'http') {
            setConfiguringHttpNodeId(nodeId);
            setHttpUrl(node.config?.httpUrl || '');
        }
    };

    const saveHttpConfig = () => {
        if (!configuringHttpNodeId || !httpUrl.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringHttpNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        httpUrl
                    }
                }
                : n
        ));
        setConfiguringHttpNodeId(null);
    };

    // SAP Node Functions
    const openSAPConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sapFetch') {
            setConfiguringSAPNodeId(nodeId);
            setSapConnectionName(node.config?.sapConnectionName || 'SAP_Production');
            setSapAuthType(node.config?.sapAuthType || 'OAuth2_Client_Credentials');
            setSapClientId(node.config?.sapClientId || '');
            setSapClientSecret(node.config?.sapClientSecret || '');
            setSapTokenUrl(node.config?.sapTokenUrl || '');
            setSapBaseApiUrl(node.config?.sapBaseApiUrl || '');
            setSapServicePath(node.config?.sapServicePath || '/sap/opu/odata/sap/');
            setSapEntity(node.config?.sapEntity || '');
        }
    };

    const saveSAPConfig = () => {
        if (!configuringSAPNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringSAPNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        sapConnectionName,
                        sapAuthType,
                        sapClientId,
                        sapClientSecret,
                        sapTokenUrl,
                        sapBaseApiUrl,
                        sapServicePath,
                        sapEntity
                    }
                }
                : n
        ));
        setConfiguringSAPNodeId(null);
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

    const openMySQLConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'mysql') {
            setConfiguringMySQLNodeId(nodeId);
            setMysqlHost(node.config?.mysqlHost || 'localhost');
            setMysqlPort(node.config?.mysqlPort || '3306');
            setMysqlDatabase(node.config?.mysqlDatabase || '');
            setMysqlUsername(node.config?.mysqlUsername || '');
            setMysqlPassword(node.config?.mysqlPassword || '');
            setMysqlQuery(node.config?.mysqlQuery || 'SELECT * FROM ');
        }
    };

    const saveMySQLConfig = () => {
        if (!configuringMySQLNodeId || !mysqlQuery.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringMySQLNodeId
                ? {
                    ...n,
                    label: mysqlDatabase ? `MySQL: ${mysqlDatabase}` : 'MySQL',
                    config: {
                        ...n.config,
                        mysqlHost: mysqlHost || undefined,
                        mysqlPort: mysqlPort || undefined,
                        mysqlDatabase: mysqlDatabase || undefined,
                        mysqlUsername: mysqlUsername || undefined,
                        mysqlPassword: mysqlPassword || undefined,
                        mysqlQuery
                    }
                }
                : n
        ));
        setConfiguringMySQLNodeId(null);
    };

    const openOpcuaConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'opcua') {
            setConfiguringOpcuaNodeId(nodeId);
            setOpcuaEndpointUrl(node.config?.opcuaEndpointUrl || 'opc.tcp://localhost:4840');
            setOpcuaNodeId(node.config?.opcuaNodeId || 'ns=2;s=Temperature');
            setOpcuaUsername(node.config?.opcuaUsername || '');
            setOpcuaPassword(node.config?.opcuaPassword || '');
            setOpcuaSecurityMode(node.config?.opcuaSecurityMode || 'None');
            setOpcuaSecurityPolicy(node.config?.opcuaSecurityPolicy || 'None');
            setOpcuaPollInterval(node.config?.opcuaPollInterval || '5000');
        }
    };

    const saveOpcuaConfig = () => {
        if (!configuringOpcuaNodeId || !opcuaEndpointUrl.trim() || !opcuaNodeId.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringOpcuaNodeId
                ? {
                    ...n,
                    label: opcuaNodeId ? `OPC UA: ${opcuaNodeId}` : 'OPC UA',
                    config: {
                        ...n.config,
                        opcuaEndpointUrl,
                        opcuaNodeId,
                        opcuaUsername: opcuaUsername || undefined,
                        opcuaPassword: opcuaPassword || undefined,
                        opcuaSecurityMode,
                        opcuaSecurityPolicy,
                        opcuaPollInterval
                    }
                }
                : n
        ));
        setConfiguringOpcuaNodeId(null);
    };

    const openMqttConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'mqtt') {
            setConfiguringMqttNodeId(nodeId);
            setMqttBrokerUrl(node.config?.mqttBrokerUrl || 'mqtt://localhost');
            setMqttPort(node.config?.mqttPort || '1883');
            setMqttTopic(node.config?.mqttTopic || 'sensors/#');
            setMqttUsername(node.config?.mqttUsername || '');
            setMqttPassword(node.config?.mqttPassword || '');
            setMqttClientId(node.config?.mqttClientId || '');
            setMqttQos(node.config?.mqttQos || '0');
            setMqttCleanSession(node.config?.mqttCleanSession !== undefined ? node.config.mqttCleanSession : true);
        }
    };

    const saveMqttConfig = () => {
        if (!configuringMqttNodeId || !mqttBrokerUrl.trim() || !mqttTopic.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringMqttNodeId
                ? {
                    ...n,
                    label: mqttTopic ? `MQTT: ${mqttTopic}` : 'MQTT',
                    config: {
                        ...n.config,
                        mqttBrokerUrl,
                        mqttPort,
                        mqttTopic,
                        mqttUsername: mqttUsername || undefined,
                        mqttPassword: mqttPassword || undefined,
                        mqttClientId: mqttClientId || undefined,
                        mqttQos,
                        mqttCleanSession
                    }
                }
                : n
        ));
        setConfiguringMqttNodeId(null);
    };

    // OSIsoft PI Node Functions
    const openOsiPiConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'osiPi') {
            setConfiguringOsiPiNodeId(nodeId);
            setOsiPiHost(node.config?.osiPiHost || '');
            setOsiPiApiKey(node.config?.osiPiApiKey || '');
            setOsiPiGranularityValue(node.config?.osiPiGranularityValue || '5');
            setOsiPiGranularityUnit(node.config?.osiPiGranularityUnit || 'seconds');
            setOsiPiWebIds(node.config?.osiPiWebIds?.length ? [...node.config.osiPiWebIds] : ['', '']);
            setShowOsiPiApiKey(false);
        }
    };

    const saveOsiPiConfig = () => {
        if (!configuringOsiPiNodeId || !osiPiHost.trim()) return;

        const filteredWebIds = osiPiWebIds.filter(id => id.trim() !== '');
        setNodes(prev => prev.map(n =>
            n.id === configuringOsiPiNodeId
                ? {
                    ...n,
                    label: osiPiHost ? `OSIsoft PI: ${new URL(osiPiHost).hostname || osiPiHost}` : 'OSIsoft PI',
                    config: {
                        ...n.config,
                        osiPiHost,
                        osiPiApiKey,
                        osiPiGranularityValue,
                        osiPiGranularityUnit,
                        osiPiWebIds: filteredWebIds,
                    }
                }
                : n
        ));
        setConfiguringOsiPiNodeId(null);
    };

    // FranMIT Node Functions
    const openFranmitConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'franmit') {
            setConfiguringFranmitNodeId(nodeId);
            setFranmitApiSecretId(node.config?.franmitApiSecretId || '');
            setFranmitReactorVolume(node.config?.franmitReactorVolume || '');
            setFranmitReactionVolume(node.config?.franmitReactionVolume || '');
            setFranmitCatalystScaleFactor(node.config?.franmitCatalystScaleFactor || '');
            setShowFranmitApiSecret(false);
        }
    };

    const saveFranmitConfig = () => {
        if (!configuringFranmitNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringFranmitNodeId
                ? {
                    ...n,
                    label: franmitApiSecretId ? `FranMIT Node` : 'FranMIT Node',
                    config: {
                        ...n.config,
                        franmitApiSecretId,
                        franmitReactorVolume,
                        franmitReactionVolume,
                        franmitCatalystScaleFactor,
                    }
                }
                : n
        ));
        setConfiguringFranmitNodeId(null);
    };

    const openEmailConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sendEmail') {
            setConfiguringEmailNodeId(nodeId);
            setEmailTo(node.config?.emailTo || '');
            setEmailSubject(node.config?.emailSubject || '');
            setEmailBody(node.config?.emailBody || '');
            setEmailSmtpHost(node.config?.emailSmtpHost || 'smtp.gmail.com');
            setEmailSmtpPort(node.config?.emailSmtpPort || '587');
            setEmailSmtpUser(node.config?.emailSmtpUser || '');
            setEmailSmtpPass(node.config?.emailSmtpPass || '');
            setShowEmailSmtpSettings(false);
        }
    };

    const saveEmailConfig = () => {
        if (!configuringEmailNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringEmailNodeId
                ? {
                    ...n,
                    label: emailTo ? `Email to: ${emailTo.split('@')[0]}...` : 'Send Email',
                    config: {
                        ...n.config,
                        emailTo,
                        emailSubject,
                        emailBody,
                        emailSmtpHost: emailSmtpHost || undefined,
                        emailSmtpPort: emailSmtpPort || undefined,
                        emailSmtpUser: emailSmtpUser || undefined,
                        emailSmtpPass: emailSmtpPass || undefined,
                    }
                }
                : n
        ));
        setConfiguringEmailNodeId(null);
    };

    const openSMSConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'sendSMS') {
            setConfiguringSMSNodeId(nodeId);
            setSmsTo(node.config?.smsTo || '');
            setSmsBody(node.config?.smsBody || '');
            setTwilioAccountSid(node.config?.twilioAccountSid || '');
            setTwilioAuthToken(node.config?.twilioAuthToken || '');
            setTwilioFromNumber(node.config?.twilioFromNumber || '');
        }
    };

    const saveSMSConfig = () => {
        if (!configuringSMSNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringSMSNodeId
                ? {
                    ...n,
                    label: smsTo ? `SMS to: ${smsTo.slice(-4)}...` : 'Send SMS',
                    config: {
                        ...n.config,
                        smsTo,
                        smsBody,
                        twilioAccountSid: twilioAccountSid || undefined,
                        twilioAuthToken: twilioAuthToken || undefined,
                        twilioFromNumber: twilioFromNumber || undefined,
                    }
                }
                : n
        ));
        setConfiguringSMSNodeId(null);
    };

    const openVisualizationConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'dataVisualization') {
            setConfiguringVisualizationNodeId(nodeId);
            setVisualizationPrompt(node.config?.visualizationPrompt || '');
            setGeneratedWidget(node.config?.generatedWidget || null);
            setShowWidgetExplanation(false);
        }
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

    const saveVisualizationConfig = () => {
        if (!configuringVisualizationNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringVisualizationNodeId
                ? {
                    ...n,
                    label: generatedWidget?.title || 'Data Visualization',
                    config: {
                        ...n.config,
                        visualizationPrompt,
                        generatedWidget
                    }
                }
                : n
        ));
        setConfiguringVisualizationNodeId(null);
        setGeneratedWidget(null);
        setVisualizationPrompt('');
    };

    const openScheduleConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        // Check if it's a schedule node (either by label or by having schedule config)
        if (node && node.type === 'trigger' && (node.label === 'Schedule' || node.label.startsWith('Schedule:') || node.config?.scheduleInterval)) {
            // Show upgrade modal instead of config
            setShowScheduleUpgradeModal(true);
            setShowScheduleContactInfo(false);
        }
    };

    const saveScheduleConfig = () => {
        if (!configuringScheduleNodeId) return;

        let defaultLabel = '';
        
        if (scheduleType === 'interval') {
            const interval = `${scheduleIntervalValue}${scheduleIntervalUnit.charAt(0)}`;
            defaultLabel = `Schedule: Every ${scheduleIntervalValue} ${scheduleIntervalUnit}`;
            
            setNodes(prev => prev.map(n =>
                n.id === configuringScheduleNodeId
                    ? {
                        ...n,
                        label: defaultLabel,
                        config: {
                            ...n.config,
                            scheduleInterval: interval,
                            scheduleIntervalValue,
                            scheduleIntervalUnit,
                            scheduleEnabled,
                            scheduleType: 'interval'
                        }
                    }
                    : n
            ));
        } else {
            // Specific time schedule
            const repeatText = scheduleRepeat === 'daily' ? 'Daily' : scheduleRepeat === 'weekly' ? 'Weekly' : '';
            defaultLabel = `Schedule: ${repeatText} at ${scheduleTime}`;
            
            setNodes(prev => prev.map(n =>
                n.id === configuringScheduleNodeId
                    ? {
                        ...n,
                        label: defaultLabel,
                        config: {
                            ...n.config,
                            scheduleType: 'specific',
                            scheduleTime,
                            scheduleRepeat,
                            scheduleEnabled
                        }
                    }
                    : n
            ));
        }
        
        closeScheduleConfig();
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
        if (node && node.type === 'esios') {
            setConfiguringEsiosNodeId(nodeId);
            setEsiosArchiveId(node.config?.esiosArchiveId || '1001');
            setEsiosDate(node.config?.esiosDate || new Date().toISOString().split('T')[0]);
        }
    };

    const saveEsiosConfig = () => {
        if (!configuringEsiosNodeId || !esiosArchiveId.trim()) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringEsiosNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        esiosArchiveId,
                        esiosDate
                    }
                }
                : n
        ));
        setConfiguringEsiosNodeId(null);
        setEsiosArchiveId('1001');
        setEsiosDate(new Date().toISOString().split('T')[0]);
    };

    const openClimatiqConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'climatiq') {
            setConfiguringClimatiqNodeId(nodeId);
            setClimatiqQuery(node.config?.climatiqQuery || 'Passenger Car');
            setClimatiqSearchResults([]);
            setClimatiqSelectedIndex(null);
        }
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

    const saveClimatiqConfig = () => {
        if (!configuringClimatiqNodeId) return;

        // Check if a factor is selected
        if (climatiqSelectedIndex === null || !climatiqSearchResults[climatiqSelectedIndex]) {
            alert('Please search and select an emission factor first');
            return;
        }

        const selected = climatiqSearchResults[climatiqSelectedIndex];

        setNodes(prev => prev.map(n =>
            n.id === configuringClimatiqNodeId
                ? {
                    ...n,
                    label: `${selected.name || 'Emission Factor'}`,
                    config: {
                        ...n.config,
                        climatiqQuery,
                        climatiqFactor: selected.factor,
                        climatiqUnit: selected.unit,
                        climatiqDescription: `${selected.name} (${selected.region_name || selected.region})`
                    }
                }
                : n
        ));
        setConfiguringClimatiqNodeId(null);
        setClimatiqQuery('Passenger Car');
        setClimatiqSearchResults([]);
        setClimatiqSelectedIndex(null);
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
        if (node && node.type === 'limsFetch') {
            setConfiguringLIMSNodeId(nodeId);
            setLimsServerUrl(node.config?.limsServerUrl || '');
            setLimsApiKey(node.config?.limsApiKey || '');
            setLimsEndpoint(node.config?.limsEndpoint || 'materials');
            setLimsQuery(node.config?.limsQuery || '');
        }
    };

    const saveLIMSConfig = () => {
        if (!configuringLIMSNodeId) return;
        setNodes(prev => prev.map(n =>
            n.id === configuringLIMSNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        limsServerUrl,
                        limsApiKey,
                        limsEndpoint,
                        limsQuery
                    }
                }
                : n
        ));
        setConfiguringLIMSNodeId(null);
    };

    // Statistical Analysis Node Functions
    const openStatisticalConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'statisticalAnalysis') {
            setConfiguringStatisticalNodeId(nodeId);
            setStatisticalMethod(node.config?.statisticalMethod || 'goldenBatch');
            setStatisticalParams(node.config?.statisticalParams || '{}');
            setGoldenBatchId(node.config?.goldenBatchId || '');
        }
    };

    const saveStatisticalConfig = () => {
        if (!configuringStatisticalNodeId) return;
        setNodes(prev => prev.map(n =>
            n.id === configuringStatisticalNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        statisticalMethod,
                        statisticalParams,
                        goldenBatchId
                    }
                }
                : n
        ));
        setConfiguringStatisticalNodeId(null);
    };

    // Alert Agent Node Functions
    const openAlertAgentConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'alertAgent') {
            setConfiguringAlertAgentNodeId(nodeId);
            setAlertConditions(node.config?.alertConditions || '[]');
            setAlertSeverity(node.config?.alertSeverity || 'warning');
            setAlertActions(node.config?.alertActions || ['email']);
            setAlertRecipients(node.config?.alertRecipients || '');
        }
    };

    const saveAlertAgentConfig = () => {
        if (!configuringAlertAgentNodeId) return;
        setNodes(prev => prev.map(n =>
            n.id === configuringAlertAgentNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        alertConditions,
                        alertSeverity,
                        alertActions,
                        alertRecipients
                    }
                }
                : n
        ));
        setConfiguringAlertAgentNodeId(null);
    };

    // PDF Report Node Functions
    const openPdfReportConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'pdfReport') {
            setConfiguringPdfReportNodeId(nodeId);
            setPdfTemplate(node.config?.pdfTemplate || 'standard');
            setPdfReportData(node.config?.pdfReportData || '{}');
            setPdfOutputPath(node.config?.pdfOutputPath || '');
        }
    };

    const savePdfReportConfig = () => {
        if (!configuringPdfReportNodeId) return;
        setNodes(prev => prev.map(n =>
            n.id === configuringPdfReportNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        pdfTemplate,
                        pdfReportData,
                        pdfOutputPath
                    }
                }
                : n
        ));
        setConfiguringPdfReportNodeId(null);
    };

    const openHumanApprovalConfig = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type === 'humanApproval') {
            setConfiguringHumanApprovalNodeId(nodeId);
            await fetchOrganizationUsers();
        }
    };

    const saveHumanApprovalConfig = (userId: string, userName: string, userProfilePhoto?: string) => {
        if (!configuringHumanApprovalNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringHumanApprovalNodeId
                ? {
                    ...n,
                    label: `Approval: ${userName}`,
                    config: {
                        ...n.config,
                        assignedUserId: userId,
                        assignedUserName: userName,
                        assignedUserPhoto: userProfilePhoto,
                        approvalStatus: 'pending'
                    }
                }
                : n
        ));
        setConfiguringHumanApprovalNodeId(null);
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

    const executeNode = async (nodeId: string, inputData: any = null, recursive: boolean = true) => {
        // Use a ref or get the latest node from the state setter to ensure we have the latest config?
        // For now, using 'nodes' from closure is fine for config, but we must be careful about 'status' checks if we needed them.
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Set to running and broadcast
        updateNodeAndBroadcast(nodeId, { status: 'running' as const, inputData });

        //Simulate work
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Set result based on type
        let result = '';
        let nodeData: any = null;
        let conditionResult: boolean | undefined = undefined;

        if (node.type === 'fetchData') {
            if (!node.config?.entityId) {
                result = 'Error: No entity configured';
                updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/entities/${node.config.entityId}/records`, { credentials: 'include' });
                const records = await res.json();

                // Flatten data using entity schema
                const entity = entities.find(e => e.id === node.config?.entityId);
                nodeData = records.map((record: any) => {
                    const flattened: any = {
                        id: record.id,
                        createdAt: record.createdAt
                    };

                    if (record.values) {
                        Object.entries(record.values).forEach(([propId, value]) => {
                            if (entity) {
                                const prop = entity.properties.find((p: any) => p.id === propId);
                                flattened[prop ? prop.name : propId] = value;
                            } else {
                                flattened[propId] = value;
                            }
                        });
                    }
                    return flattened;
                });

                result = `Fetched ${records.length} records from ${node.config.entityName}`;
            } catch (error) {
                result = 'Error fetching data';
                updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
                return;
            }
        } else {
            switch (node.type) {
                case 'trigger':
                    result = 'Triggered!';
                    break;
                case 'action':
                    result = 'Action executed!';
                    break;
                case 'condition':
                    // Evaluate condition (supports multiple conditions with AND/OR)
                    if (node.config?.conditionField && node.config?.conditionOperator) {
                        const dataToEval = inputData;
                        const processingMode = node.config.processingMode || 'batch';
                        const additionalConds = node.config.additionalConditions || [];
                        const logicalOp = node.config.logicalOperator || 'AND';

                        if (dataToEval && Array.isArray(dataToEval) && dataToEval.length > 0) {
                            // Helper to evaluate a single condition
                            const evaluateSingleCondition = (record: any, field: string, operator: string, value: string): boolean => {
                                const fieldValue = record[field];
                                switch (operator) {
                                    case 'isText': return typeof fieldValue === 'string';
                                    case 'isNumber': return !isNaN(Number(fieldValue));
                                    case 'equals': return String(fieldValue) === value;
                                    case 'not_equals':
                                    case 'notEquals': return String(fieldValue) !== value;
                                    case 'contains': return String(fieldValue).toLowerCase().includes((value || '').toLowerCase());
                                    case 'not_contains': return !String(fieldValue).toLowerCase().includes((value || '').toLowerCase());
                                    case 'greater_than':
                                    case 'greaterThan': return Number(fieldValue) > Number(value);
                                    case 'less_than':
                                    case 'lessThan': return Number(fieldValue) < Number(value);
                                    case 'greater_or_equal': return Number(fieldValue) >= Number(value);
                                    case 'less_or_equal': return Number(fieldValue) <= Number(value);
                                    case 'starts_with': return String(fieldValue).toLowerCase().startsWith((value || '').toLowerCase());
                                    case 'ends_with': return String(fieldValue).toLowerCase().endsWith((value || '').toLowerCase());
                                    case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
                                    case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
                                    default: return false;
                                }
                            };

                            // Evaluate all conditions for a record (with AND/OR logic)
                            const evaluateRecord = (record: any): boolean => {
                                // Primary condition
                                const primaryResult = evaluateSingleCondition(
                                    record, 
                                    node.config!.conditionField!, 
                                    node.config!.conditionOperator!, 
                                    node.config!.conditionValue || ''
                                );
                                
                                // If no additional conditions, return primary result
                                if (!additionalConds || additionalConds.length === 0) {
                                    return primaryResult;
                                }
                                
                                // Evaluate additional conditions
                                const allResults = [primaryResult];
                                for (const cond of additionalConds) {
                                    if (cond.field) {
                                        allResults.push(evaluateSingleCondition(record, cond.field, cond.operator, cond.value));
                                    }
                                }
                                
                                // Combine with AND/OR
                                if (logicalOp === 'AND') {
                                    return allResults.every(r => r);
                                } else {
                                    return allResults.some(r => r);
                                }
                            };

                            if (processingMode === 'perRow') {
                                // Per-row mode: filter data into TRUE and FALSE outputs
                                const trueRecords = dataToEval.filter(record => evaluateRecord(record));
                                const falseRecords = dataToEval.filter(record => !evaluateRecord(record));
                                
                                // Store both filtered arrays for routing
                                nodeData = { trueRecords, falseRecords };
                                conditionResult = trueRecords.length > 0; // For visual indication
                                const condCount = 1 + additionalConds.length;
                                result = `${condCount} condition${condCount > 1 ? 's' : ''} (${logicalOp}): ${trueRecords.length} TRUE, ${falseRecords.length} FALSE`;
                            } else {
                                // Batch mode: evaluate first record, route ALL data
                                const condResult = evaluateRecord(dataToEval[0]);
                                nodeData = dataToEval;
                                conditionResult = condResult;
                                const condCount = 1 + additionalConds.length;
                                result = `${condCount} condition${condCount > 1 ? 's' : ''} (${logicalOp}) → ${condResult ? '✓ All to TRUE' : '✗ All to FALSE'}`;
                            }
                        } else {
                            result = 'No data to evaluate';
                        }
                    } else {
                        result = 'Error: Condition not configured';
                        updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
                        return;
                    }
                    break;
                case 'addField':
                    // Add field to all records
                    if (node.config?.conditionField && inputData && Array.isArray(inputData)) {
                        const fieldName = node.config.conditionField;
                        const fieldValue = node.config.conditionValue || '';

                        nodeData = inputData.map(record => ({
                            ...record,
                            [fieldName]: fieldValue
                        }));

                        result = `Added field "${fieldName}" = "${fieldValue}" to ${nodeData.length} records`;
                    } else {
                        result = 'Not configured or no data';
                    }
                    break;
                case 'saveRecords':
                    // Save records to entity
                    if (node.config?.entityId && inputData && Array.isArray(inputData)) {
                        try {
                            let savedCount = 0;
                            let failedCount = 0;

                            for (const record of inputData) {
                                // Remove id to let database generate it
                                const { id, ...recordWithoutId } = record;

                                const response = await fetch(`${API_BASE}/entities/${node.config.entityId}/records`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(recordWithoutId),
                                    credentials: 'include'
                                });

                                if (response.ok) {
                                    savedCount++;
                                } else {
                                    failedCount++;
                                    console.error(`Failed to save record:`, record, await response.text());
                                }
                            }

                            nodeData = inputData;
                            result = failedCount > 0
                                ? `Saved ${savedCount}, Failed ${failedCount} to ${node.config.entityName}`
                                : `Saved ${savedCount} records to ${node.config.entityName}`;
                        } catch (error) {
                            console.error('Save records error:', error);
                            result = `Error: ${error.message || 'Failed to save'}`;
                        }
                    } else {
                        result = 'Not configured or no data';
                    }
                    break;
                case 'python':
                    if (node.config?.pythonCode) {
                        try {
                            const response = await fetch(`${API_BASE}/python/execute`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    code: node.config.pythonCode,
                                    inputData: inputData || []
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                
                                // Check if Lambda returned success: false with error details
                                if (data.success === false) {
                                    const error: any = new Error(data.error || 'Python execution failed');
                                    error.traceback = data.traceback;
                                    throw error;
                                }
                                
                                // Check if result contains an error from Python
                                if (data.result && typeof data.result === 'object' && data.result.error) {
                                    throw new Error(data.result.error);
                                }
                                
                                // Validate that we got meaningful data
                                if (data.result === null || data.result === undefined) {
                                    console.warn('[Python] Execution returned null/undefined result');
                                    nodeData = [];
                                    result = 'Warning: Python returned no data (null). Make sure your process() function returns a value.';
                                    // Mark as error since no data was produced
                                    updateNodeAndBroadcast(nodeId, { 
                                        status: 'error' as const, 
                                        executionResult: result,
                                        outputData: []
                                    });
                                    return;
                                } else if (Array.isArray(data.result) && data.result.length === 0) {
                                    nodeData = [];
                                    result = 'Python executed - returned empty array';
                                } else {
                                    nodeData = data.result;
                                    const recordCount = Array.isArray(data.result) ? data.result.length : 1;
                                    result = `Python executed successfully (${recordCount} ${recordCount === 1 ? 'record' : 'records'})`;
                                }
                            } else {
                                const errorData = await response.json();
                                const error: any = new Error(errorData.error || 'Python execution failed');
                                error.traceback = errorData.traceback;
                                throw error;
                            }
                        } catch (error) {
                            console.error('Python execution error:', error);
                            const errorMessage = error.message || 'Failed to execute';
                            // Extract traceback if available
                            const traceback = error.traceback || '';
                            result = `Error: ${errorMessage}${traceback ? '\n' + traceback : ''}`;
                            updateNodeAndBroadcast(nodeId, { 
                                status: 'error' as const, 
                                executionResult: result,
                                outputData: [{ error: errorMessage }]
                            });
                            return;
                        }
                    } else {
                        result = 'Code not configured';
                    }
                    break;
                case 'franmit':
                    try {
                        // Build receta from input data or use inputData directly
                        let franmitInput: any = {};
                        
                        if (inputData) {
                            if (Array.isArray(inputData) && inputData.length > 0) {
                                // If array, take first element
                                franmitInput = inputData[0];
                            } else if (typeof inputData === 'object') {
                                // If object, use directly
                                franmitInput = inputData;
                            }
                        }
                        
                        // Build reactor configuration from node config
                        const reactorConfiguration: any = {};
                        if (node.config?.franmitReactorVolume) {
                            reactorConfiguration.V_reb = parseFloat(node.config.franmitReactorVolume) || 53;
                        } else {
                            reactorConfiguration.V_reb = 53; // Default
                        }
                        if (node.config?.franmitCatalystScaleFactor) {
                            reactorConfiguration.scale_cat = parseFloat(node.config.franmitCatalystScaleFactor) || 1;
                        } else {
                            reactorConfiguration.scale_cat = 1; // Default
                        }

                        const response = await fetch(`${API_BASE}/franmit/execute`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                funName: 'solve_single_receta',
                                receta: franmitInput,
                                reactorConfiguration: reactorConfiguration
                            }),
                            credentials: 'include'
                        });

                        if (response.ok) {
                            const data = await response.json();
                            
                            if (data.success === false) {
                                const error: any = new Error(data.error || 'FranMIT execution failed');
                                error.traceback = data.traceback;
                                throw error;
                            }
                            
                            // Extract outputs from the result
                            // data.outs is a dict with grado as key, get the first value
                            const outs = data.outs || {};
                            const firstGrado = Object.keys(outs)[0];
                            const outputData = firstGrado ? outs[firstGrado] : outs;
                            
                            // Convert to array format for node output
                            nodeData = [outputData];
                            result = `FranMIT reactor model executed successfully`;
                        } else {
                            const errorData = await response.json();
                            const error: any = new Error(errorData.error || 'FranMIT execution failed');
                            error.traceback = errorData.traceback;
                            throw error;
                        }
                    } catch (error: any) {
                        console.error('FranMIT execution error:', error);
                        const errorMessage = error.message || 'Failed to execute';
                        const traceback = error.traceback || '';
                        result = `Error: ${errorMessage}${traceback ? '\n' + traceback : ''}`;
                        updateNodeAndBroadcast(nodeId, { 
                            status: 'error' as const, 
                            executionResult: result,
                            outputData: [{ error: errorMessage }]
                        });
                        return;
                    }
                    break;
                case 'llm':
                    if (node.config?.llmPrompt) {
                        const llmProcessingMode = node.config.processingMode || 'batch';
                        
                        try {
                            if (llmProcessingMode === 'perRow' && inputData && Array.isArray(inputData) && inputData.length > 0) {
                                // Per-row mode: process each record individually
                                const results: any[] = [];
                                
                                for (let i = 0; i < inputData.length; i++) {
                                    const record = inputData[i];
                                    // Replace placeholders in prompt with record values
                                    let personalizedPrompt = node.config.llmPrompt;
                                    Object.keys(record).forEach(key => {
                                        personalizedPrompt = personalizedPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(record[key]));
                                    });
                                    
                                    const response = await fetch(`${API_BASE}/generate`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            prompt: personalizedPrompt,
                                            mentionedEntityIds: node.config.llmContextEntities || [],
                                            additionalContext: node.config.llmIncludeInput ? [record] : undefined
                                        }),
                                        credentials: 'include'
                                    });

                                    if (response.ok) {
                                        const data = await response.json();
                                        results.push({
                                            ...record,
                                            ai_result: data.response
                                        });
                                    } else {
                                        results.push({
                                            ...record,
                                            ai_result: 'Error generating',
                                            ai_error: true
                                        });
                                    }
                                }
                                
                                nodeData = results;
                                result = `Generated for ${results.length} records`;
                            } else {
                                // Batch mode: single call with all data
                                const response = await fetch(`${API_BASE}/generate`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        prompt: node.config.llmPrompt,
                                        mentionedEntityIds: node.config.llmContextEntities || [],
                                        additionalContext: node.config.llmIncludeInput ? inputData : undefined
                                    }),
                                    credentials: 'include'
                                });

                                if (response.ok) {
                                    const data = await response.json();
                                    nodeData = [{ result: data.response }];
                                    result = 'Generated text successfully';
                                } else {
                                    const errorData = await response.json();
                                    throw new Error(errorData.error || 'Failed to generate text');
                                }
                            }
                        } catch (error) {
                            console.error('LLM generation error:', error);
                            result = `Error: ${error.message || 'Failed to generate'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Prompt not configured';
                    }
                    break;
                case 'manualInput':
                    // Create output data from the configured variable
                    if (node.config?.inputVarName) {
                        const varName = node.config.inputVarName;
                        const varValue = node.config.inputVarValue || '';
                        // Try to parse as number if possible
                        const parsedValue = !isNaN(Number(varValue)) && varValue.trim() !== ''
                            ? Number(varValue)
                            : varValue;
                        nodeData = [{ [varName]: parsedValue }];
                        result = `Set ${varName} = ${parsedValue}`;
                    } else {
                        result = 'Not configured';
                    }
                    break;
                case 'http':
                    if (node.config?.httpUrl) {
                        try {
                            const response = await fetch(`${API_BASE}/proxy`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: node.config.httpUrl,
                                    method: 'GET'
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                // Ensure output is an array of objects if possible, for compatibility
                                if (Array.isArray(data)) {
                                    nodeData = data;
                                } else if (typeof data === 'object') {
                                    nodeData = [data];
                                } else {
                                    nodeData = [{ result: data }];
                                }
                                result = `Fetched from ${node.config.httpUrl}`;
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Request failed');
                            }
                        } catch (error) {
                            console.error('HTTP request error:', error);
                            result = `Error: ${error.message || 'Failed to fetch'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'URL not configured';
                    }
                    break;
                case 'mysql':
                    if (node.config?.mysqlQuery) {
                        try {
                            const response = await fetch(`${API_BASE}/mysql/query`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    host: node.config.mysqlHost || 'localhost',
                                    port: node.config.mysqlPort || '3306',
                                    database: node.config.mysqlDatabase,
                                    username: node.config.mysqlUsername,
                                    password: node.config.mysqlPassword,
                                    query: node.config.mysqlQuery
                                }),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                nodeData = data.results || [];
                                result = `Fetched ${nodeData.length} rows from MySQL`;
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'MySQL query failed');
                            }
                        } catch (error) {
                            console.error('MySQL query error:', error);
                            result = `Error: ${error.message || 'Failed to query MySQL'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Query not configured';
                    }
                    break;
                case 'sapFetch':
                    if (node.config?.sapEntity && node.config?.sapBaseApiUrl) {
                        try {
                            // TODO: Implement SAP OData API call when backend endpoint is ready
                            // For now, return a placeholder message
                            result = `SAP S/4HANA configured: ${node.config.sapEntity}`;
                            nodeData = [{
                                _note: 'SAP S/4HANA integration pending backend implementation',
                                connection: node.config.sapConnectionName,
                                entity: node.config.sapEntity,
                                servicePath: node.config.sapServicePath
                            }];
                        } catch (error) {
                            console.error('SAP fetch error:', error);
                            result = `Error: ${error.message || 'Failed to fetch from SAP'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'SAP connection not configured';
                    }
                    break;
                case 'limsFetch':
                    if (node.config?.limsServerUrl && node.config?.limsApiKey) {
                        try {
                            const response = await fetch(`${API_BASE}/lims/fetch`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    serverUrl: node.config.limsServerUrl,
                                    apiKey: node.config.limsApiKey,
                                    endpoint: node.config.limsEndpoint || 'materials',
                                    query: node.config.limsQuery || ''
                                }),
                                credentials: 'include'
                            });
                            if (response.ok) {
                                const data = await response.json();
                                nodeData = Array.isArray(data) ? data : [data];
                                result = `Fetched ${nodeData.length} records from LIMS`;
                            } else {
                                const errorData = await response.json();
                                result = `Error: ${errorData.error || 'Failed to fetch from LIMS'}`;
                                nodeData = [{ error: errorData.error || 'Failed to fetch from LIMS' }];
                            }
                        } catch (error: any) {
                            result = `Error: ${error.message}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'LIMS not configured';
                    }
                    break;
                case 'statisticalAnalysis':
                    if (node.config?.statisticalMethod) {
                        try {
                            const params = node.config.statisticalParams ? JSON.parse(node.config.statisticalParams) : {};
                            const response = await fetch(`${API_BASE}/statistical/analyze`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    method: node.config.statisticalMethod,
                                    inputData: inputData,
                                    params: params,
                                    goldenBatchId: node.config.goldenBatchId || null
                                }),
                                credentials: 'include'
                            });
                            if (response.ok) {
                                const data = await response.json();
                                nodeData = data.results || [data];
                                result = `Analysis completed: ${node.config.statisticalMethod}`;
                            } else {
                                const errorData = await response.json();
                                result = `Error: ${errorData.error || 'Statistical analysis failed'}`;
                                nodeData = [{ error: errorData.error || 'Statistical analysis failed' }];
                            }
                        } catch (error: any) {
                            result = `Error: ${error.message}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Statistical analysis not configured';
                    }
                    break;
                case 'alertAgent':
                    if (node.config?.alertConditions) {
                        try {
                            const conditions = JSON.parse(node.config.alertConditions);
                            let alertTriggered = false;
                            let alertMessage = '';

                            // Evaluate conditions
                            if (inputData) {
                                const data = Array.isArray(inputData) ? inputData : [inputData];
                                for (const condition of conditions) {
                                    const field = condition.field;
                                    const operator = condition.operator;
                                    const value = condition.value;
                                    
                                    for (const record of data) {
                                        const fieldValue = record[field];
                                        let matches = false;
                                        
                                        switch (operator) {
                                            case '>':
                                                matches = Number(fieldValue) > Number(value);
                                                break;
                                            case '<':
                                                matches = Number(fieldValue) < Number(value);
                                                break;
                                            case '>=':
                                                matches = Number(fieldValue) >= Number(value);
                                                break;
                                            case '<=':
                                                matches = Number(fieldValue) <= Number(value);
                                                break;
                                            case '==':
                                                matches = String(fieldValue) === String(value);
                                                break;
                                            case '!=':
                                                matches = String(fieldValue) !== String(value);
                                                break;
                                        }
                                        
                                        if (matches) {
                                            alertTriggered = true;
                                            alertMessage = condition.message || `Alert: ${field} ${operator} ${value}`;
                                            break;
                                        }
                                    }
                                    if (alertTriggered) break;
                                }
                            }

                            if (alertTriggered) {
                                // Execute alert actions
                                const actions = node.config.alertActions || ['email'];
                                const recipients = node.config.alertRecipients?.split(',').map(r => r.trim()) || [];
                                
                                for (const action of actions) {
                                    if (action === 'email' && recipients.length > 0) {
                                        // Send email alert
                                        await fetch(`${API_BASE}/send-email`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                to: recipients.filter(r => r.includes('@')).join(','),
                                                subject: `[${node.config.alertSeverity?.toUpperCase()}] ${alertMessage}`,
                                                body: alertMessage
                                            }),
                                            credentials: 'include'
                                        });
                                    } else if (action === 'sms' && recipients.length > 0) {
                                        // Send SMS alert
                                        await fetch(`${API_BASE}/send-sms`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                to: recipients.filter(r => !r.includes('@')).join(','),
                                                body: alertMessage
                                            }),
                                            credentials: 'include'
                                        });
                                    }
                                }
                                
                                result = `Alert triggered: ${alertMessage}`;
                                nodeData = [{ alert: true, message: alertMessage, severity: node.config.alertSeverity }];
                            } else {
                                result = 'No alerts triggered';
                                nodeData = [{ alert: false }];
                            }
                        } catch (error: any) {
                            result = `Error: ${error.message}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Alert agent not configured';
                    }
                    break;
                case 'pdfReport':
                    if (node.config?.pdfTemplate) {
                        try {
                            const reportData = node.config.pdfReportData ? JSON.parse(node.config.pdfReportData) : inputData;
                            const response = await fetch(`${API_BASE}/pdf/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    template: node.config.pdfTemplate,
                                    data: reportData,
                                    outputPath: node.config.pdfOutputPath || ''
                                }),
                                credentials: 'include'
                            });
                            if (response.ok) {
                                const data = await response.json();
                                nodeData = [{ pdfPath: data.path, pdfUrl: data.url }];
                                result = `PDF report generated: ${data.path || data.url}`;
                            } else {
                                const errorData = await response.json();
                                result = `Error: ${errorData.error || 'PDF generation failed'}`;
                                nodeData = [{ error: errorData.error || 'PDF generation failed' }];
                            }
                        } catch (error: any) {
                            result = `Error: ${error.message}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'PDF report not configured';
                    }
                    break;
                case 'sendEmail':
                    if (node.config?.emailTo) {
                        try {
                            // Replace variables in email fields
                            const replaceVariables = (text: string, data: any) => {
                                if (!text || !data) return text;
                                let result = text;
                                // If data is an array, use first record
                                const record = Array.isArray(data) ? data[0] : data;
                                if (record && typeof record === 'object') {
                                    Object.keys(record).forEach(key => {
                                        const regex = new RegExp(`\\{${key}\\}`, 'g');
                                        result = result.replace(regex, String(record[key] ?? ''));
                                    });
                                }
                                return result;
                            };

                            const emailData = {
                                to: replaceVariables(node.config.emailTo, inputData),
                                subject: replaceVariables(node.config.emailSubject || '', inputData),
                                body: replaceVariables(node.config.emailBody || '', inputData),
                                smtpHost: node.config.emailSmtpHost || 'smtp.gmail.com',
                                smtpPort: node.config.emailSmtpPort || '587',
                                smtpUser: node.config.emailSmtpUser,
                                smtpPass: node.config.emailSmtpPass
                            };

                            const response = await fetch(`${API_BASE}/email/send`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(emailData),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                nodeData = inputData || [{ emailSent: true, to: emailData.to }];
                                result = `Email sent to ${emailData.to}`;
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to send email');
                            }
                        } catch (error) {
                            console.error('Email send error:', error);
                            result = `Error: ${error.message || 'Failed to send email'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Recipient not configured';
                    }
                    break;
                case 'sendSMS':
                    if (node.config?.smsTo) {
                        try {
                            // Replace variables in SMS fields
                            const replaceVariables = (text: string, data: any) => {
                                if (!text || !data) return text;
                                let result = text;
                                const record = Array.isArray(data) ? data[0] : data;
                                if (record && typeof record === 'object') {
                                    Object.keys(record).forEach(key => {
                                        const regex = new RegExp(`\\{${key}\\}`, 'g');
                                        result = result.replace(regex, String(record[key] ?? ''));
                                    });
                                }
                                return result;
                            };

                            const smsData = {
                                to: replaceVariables(node.config.smsTo, inputData),
                                body: replaceVariables(node.config.smsBody || '', inputData),
                                accountSid: node.config.twilioAccountSid,
                                authToken: node.config.twilioAuthToken,
                                fromNumber: node.config.twilioFromNumber
                            };

                            const response = await fetch(`${API_BASE}/sms/send`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(smsData),
                                credentials: 'include'
                            });

                            if (response.ok) {
                                const data = await response.json();
                                nodeData = inputData || [{ smsSent: true, to: smsData.to }];
                                result = `SMS sent to ${smsData.to}`;
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to send SMS');
                            }
                        } catch (error) {
                            console.error('SMS send error:', error);
                            result = `Error: ${error.message || 'Failed to send SMS'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Phone number not configured';
                    }
                    break;
                case 'dataVisualization':
                    if (node.config?.generatedWidget) {
                        nodeData = inputData;
                        result = `Chart: ${node.config.generatedWidget.title || 'Data Visualization'}`;
                    } else {
                        result = 'No visualization configured. Double-click to set up.';
                    }
                    break;
                case 'esios':
                    const indicatorId = node.config?.esiosArchiveId || '1001';
                    const esiosDate = node.config?.esiosDate || new Date().toISOString().split('T')[0];
                    // Use indicators endpoint with start_date and end_date
                    const startDate = `${esiosDate}T00:00`;
                    const endDate = `${esiosDate}T23:59`;
                    const url = `https://api.esios.ree.es/indicators/${indicatorId}?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;

                    try {
                        const response = await fetch(`${API_BASE}/proxy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: url,
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json; application/vnd.esios-api-v1+json',
                                    'x-api-key': 'd668c991cd9fbd6873796a76b80bca256bf0f26db8d4c1de702546642fecda64'
                                }
                            }),
                            credentials: 'include'
                        });

                        if (response.ok) {
                            const data = await response.json();
                            nodeData = [data]; // Wrap the full response object
                            result = `Fetched ESIOS Indicator ${indicatorId} for ${esiosDate}`;
                        } else {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `ESIOS Request failed: ${response.status}`);
                        }
                    } catch (error) {
                        console.error('ESIOS request error:', error);
                        result = `Error: ${error.message || 'Failed to fetch'}`;
                        nodeData = [{ error: error.message }];
                    }
                    break;
                case 'climatiq':
                    // Check if factor is configured
                    if (node.config?.climatiqFactor !== undefined) {
                        // Return the stored emission factor
                        const factor = node.config.climatiqFactor;
                        const unit = node.config.climatiqUnit || 'kg CO2e';
                        const description = node.config.climatiqDescription || 'Emission factor';

                        nodeData = [{
                            factor: factor,
                            unit: unit,
                            description: description,
                            query: node.config.climatiqQuery
                        }];
                        result = `Using ${description}: ${factor} ${unit}`;
                    } else {
                        result = 'Not configured - please select an emission factor';
                        nodeData = [{ error: 'No emission factor selected' }];
                    }
                    break;
                case 'excelInput':
                    // Excel/CSV Input node - output the parsed data
                    if (node.config?.useGCS && node.config?.gcsPath) {
                        // Data stored in GCS - use preview for visual display, full data loaded at execution
                        nodeData = node.config.previewData || [];
                        const totalRows = node.config.rowCount || nodeData.length;
                        result = `Loaded ${totalRows} rows from ${node.config.fileName || 'cloud'} (cloud storage)`;
                    } else if (node.config?.parsedData && Array.isArray(node.config.parsedData)) {
                        nodeData = node.config.parsedData;
                        result = `Loaded ${nodeData.length} rows from ${node.config.fileName || 'file'}`;
                    } else {
                        result = 'No file loaded - click to upload Excel/CSV file';
                        nodeData = [];
                    }
                    break;
                case 'pdfInput':
                    // PDF Input node - output the parsed text
                    if (node.config?.pdfText) {
                        nodeData = [{
                            text: node.config.pdfText,
                            pages: node.config.pages,
                            fileName: node.config.fileName,
                            metadata: node.config.metadata
                        }];
                        result = `Loaded PDF: ${node.config.fileName} (${node.config.pages} pages)`;
                    } else {
                        result = 'No PDF loaded - click to upload PDF file';
                        nodeData = [];
                    }
                    break;
                case 'join':
                    // Join node - merge data from two inputs
                    if (inputData && inputData.A && inputData.B) {
                        const dataA = Array.isArray(inputData.A) ? inputData.A : [inputData.A];
                        const dataB = Array.isArray(inputData.B) ? inputData.B : [inputData.B];
                        
                        const strategy = node.config?.joinStrategy || 'concat';
                        
                        if (strategy === 'concat') {
                            // Simple concatenation
                            nodeData = [...dataA, ...dataB];
                            result = `Concatenated ${dataA.length} + ${dataB.length} = ${nodeData.length} records`;
                        } else if (strategy === 'mergeByKey' && node.config?.joinKey) {
                            // Merge by common key
                            const key = node.config.joinKey;
                            const joinTypeConfig = node.config?.joinType || 'inner';
                            const merged: any[] = [];
                            
                            // Get field names from A and B to detect conflicts and normalize
                            const fieldsInA = dataA.length > 0 ? Object.keys(dataA[0]) : [];
                            const fieldsInB = dataB.length > 0 ? Object.keys(dataB[0]) : [];
                            
                            // Build the complete set of output fields
                            const allOutputFields = new Set<string>(fieldsInA);
                            for (const field of fieldsInB) {
                                if (field === key) continue; // Key field handled separately
                                if (fieldsInA.includes(field)) {
                                    allOutputFields.add(`B_${field}`);
                                } else {
                                    allOutputFields.add(field);
                                }
                            }
                            
                            // Process records from A
                            for (const recordA of dataA) {
                                const keyValue = recordA[key];
                                const matchingB = dataB.find((b: any) => b[key] === keyValue);
                                
                                if (matchingB) {
                                    // Merge fields from B, prefixing conflicting field names
                                    const mergedRecord: any = { ...recordA };
                                    for (const [fieldName, fieldValue] of Object.entries(matchingB)) {
                                        if (fieldName === key) {
                                            continue; // Skip the join key
                                        } else if (fieldsInA.includes(fieldName)) {
                                            mergedRecord[`B_${fieldName}`] = fieldValue;
                                        } else {
                                            mergedRecord[fieldName] = fieldValue;
                                        }
                                    }
                                    merged.push(mergedRecord);
                                } else if (joinTypeConfig === 'outer') {
                                    // Outer join: include unmatched A records with empty B fields
                                    merged.push(recordA);
                                }
                                // Inner join: skip unmatched A records
                            }
                            
                            // For outer join, add unmatched B records
                            if (joinTypeConfig === 'outer') {
                                for (const recordB of dataB) {
                                    const keyValue = recordB[key];
                                    const existsInA = dataA.some((a: any) => a[key] === keyValue);
                                    if (!existsInA) {
                                        const prefixedRecord: any = {};
                                        for (const [fieldName, fieldValue] of Object.entries(recordB)) {
                                            if (fieldsInA.includes(fieldName) && fieldName !== key) {
                                                prefixedRecord[`B_${fieldName}`] = fieldValue;
                                            } else {
                                                prefixedRecord[fieldName] = fieldValue;
                                            }
                                        }
                                        merged.push(prefixedRecord);
                                    }
                                }
                            }
                            
                            // Normalize all records to have the same columns
                            const normalizedMerged = merged.map(record => {
                                const normalized: any = {};
                                for (const field of allOutputFields) {
                                    normalized[field] = record[field] !== undefined ? record[field] : '';
                                }
                                return normalized;
                            });
                            
                            nodeData = normalizedMerged;
                            const joinTypeName = joinTypeConfig === 'inner' ? 'Inner' : 'Outer';
                            result = `${joinTypeName} Join by "${key}": ${nodeData.length} records`;
                        } else {
                            nodeData = [...dataA, ...dataB];
                            result = `Concatenated (no key configured): ${nodeData.length} records`;
                        }
                    } else {
                        result = 'Waiting for both inputs...';
                    }
                    break;
                case 'splitColumns':
                    // Split columns node - split dataset into two outputs by column selection
                    if (inputData && Array.isArray(inputData) && inputData.length > 0) {
                        const columnsA = node.config?.columnsOutputA || [];
                        const columnsB = node.config?.columnsOutputB || [];
                        
                        if (columnsA.length === 0 && columnsB.length === 0) {
                            // Not configured - send all data to output A
                            const allKeys = Object.keys(inputData[0] || {});
                            nodeData = {
                                outputA: inputData,
                                outputB: inputData.map(() => ({}))
                            };
                            result = `Not configured - all ${allKeys.length} columns to Output A`;
                        } else {
                            // Split by configured columns
                            const outputA = inputData.map((record: any) => {
                                const filtered: any = {};
                                columnsA.forEach((col: string) => {
                                    if (col in record) filtered[col] = record[col];
                                });
                                return filtered;
                            });
                            
                            const outputB = inputData.map((record: any) => {
                                const filtered: any = {};
                                columnsB.forEach((col: string) => {
                                    if (col in record) filtered[col] = record[col];
                                });
                                return filtered;
                            });
                            
                            nodeData = { outputA, outputB };
                            result = `Split: ${columnsA.length} cols → A, ${columnsB.length} cols → B (${inputData.length} rows)`;
                        }
                    } else {
                        result = 'No input data to split';
                        nodeData = { outputA: [], outputB: [] };
                    }
                    break;
                case 'output':
                    // Output node just displays the input data
                    if (inputData && Array.isArray(inputData) && inputData.length > 0) {
                        nodeData = inputData;
                        result = `Received ${inputData.length} record(s)`;
                    } else if (inputData) {
                        nodeData = [inputData];
                        result = 'Received data';
                    } else {
                        result = 'No input data';
                    }
                    break;
                case 'humanApproval':
                    // Human approval node - wait for user acceptance
                    if (!node.config?.assignedUserId) {
                        result = 'Error: No user assigned';
                        updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
                        return;
                    }

                    // Set to waiting status and broadcast
                    updateNodeAndBroadcast(nodeId, { status: 'waiting' as const, inputData });
                    setWaitingApprovalNodeId(nodeId);

                    // Wait for user approval
                    await new Promise<void>((resolve) => {
                        setPendingApprovalData({ inputData, resolve });
                    });

                    // After approval, continue
                    nodeData = inputData;
                    result = `Approved by ${node.config.assignedUserName}`;
                    break;
            }
        }

        // Set to completed
        // Set to completed and broadcast
        updateNodeAndBroadcast(nodeId, { 
            status: 'completed' as const, 
            executionResult: result, 
            data: nodeData, 
            outputData: nodeData,
            conditionResult: conditionResult !== undefined ? conditionResult : undefined
        });

        if (recursive) {
            // Find and execute connected nodes
            const nextConnections = connections.filter(conn => conn.fromNodeId === nodeId);

            // For condition nodes in perRow mode, send filtered data to each output
            if (node.type === 'condition' && node.config?.processingMode === 'perRow' && nodeData?.trueRecords !== undefined) {
                // Per-row mode: send trueRecords to TRUE connections, falseRecords to FALSE connections
                for (const conn of nextConnections) {
                    const targetNode = nodes.find(n => n.id === conn.toNodeId);
                    const dataToSend = conn.outputType === 'false' ? nodeData.falseRecords : nodeData.trueRecords;
                    
                    if (targetNode?.type === 'join') {
                        await executeJoinInput(conn.toNodeId, dataToSend, conn.inputPort || 'A');
                    } else {
                        await executeNode(conn.toNodeId, dataToSend);
                    }
                }
            } else if (node.type === 'splitColumns' && nodeData?.outputA !== undefined) {
                // Split columns node: send outputA to 'A' connections, outputB to 'B' connections
                for (const conn of nextConnections) {
                    const targetNode = nodes.find(n => n.id === conn.toNodeId);
                    const dataToSend = conn.outputType === 'B' ? nodeData.outputB : nodeData.outputA;
                    
                    if (targetNode?.type === 'join') {
                        await executeJoinInput(conn.toNodeId, dataToSend, conn.inputPort || 'A');
                    } else {
                        await executeNode(conn.toNodeId, dataToSend);
                    }
                }
            } else {
                // Batch mode or non-condition nodes
                const toExecute = node.type === 'condition' && conditionResult !== undefined
                    ? nextConnections.filter(c => {
                        if (conditionResult) {
                            return !c.outputType || c.outputType === 'true';
                        } else {
                            return c.outputType === 'false';
                        }
                    })
                    : nextConnections;

                for (const conn of toExecute) {
                    const targetNode = nodes.find(n => n.id === conn.toNodeId);

                    // For join nodes, we need to handle inputs differently
                    if (targetNode?.type === 'join') {
                        await executeJoinInput(conn.toNodeId, nodeData, conn.inputPort || 'A');
                    } else {
                        await executeNode(conn.toNodeId, nodeData);
                    }
                }
            }
        }
    };

    // Special handler for join node inputs
    const executeJoinInput = async (nodeId: string, inputData: any, inputPort: 'A' | 'B') => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'join') return;

        // Store the input data for the appropriate port and broadcast
        const updates = inputPort === 'A' 
            ? { inputDataA: inputData } 
            : { inputDataB: inputData };
        updateNodeAndBroadcast(nodeId, updates);

        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the updated node to check if both inputs are available
        // We need to read from the current state
        const updatedNodes = await new Promise<WorkflowNode[]>(resolve => {
            setNodes(prev => {
                resolve(prev);
                return prev;
            });
        });

        const updatedNode = updatedNodes.find(n => n.id === nodeId);
        
        // Check if both inputs are now available
        if (updatedNode?.inputDataA && updatedNode?.inputDataB) {
            // Both inputs available, execute the join
            await executeNode(nodeId, { A: updatedNode.inputDataA, B: updatedNode.inputDataB });
        } else {
            // Only one input available, mark as waiting
            setNodes(prev => prev.map(n =>
                n.id === nodeId ? { ...n, status: 'waiting' as const, executionResult: `Waiting for input ${inputPort === 'A' ? 'B' : 'A'}...` } : n
            ));
        }
    };

    const runWorkflow = async () => {
        if (isRunning) return;
        setIsRunning(true);

        try {
            // Save workflow before executing to ensure execution history has latest version
            await saveWorkflow();

            // Reset all nodes to idle (and clear join node inputs)
            setNodes(prev => prev.map(n => ({ 
                ...n, 
                status: 'idle' as const, 
                executionResult: undefined,
                inputDataA: undefined,
                inputDataB: undefined
            })));

            // Call backend to execute workflow and create execution record (in background)
            fetch(`${API_BASE}/workflow/${currentWorkflowId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ inputs: {} })
            }).catch(err => {
                console.error('Background execution error:', err);
            });

            // Execute locally in frontend for visual feedback
            // Find trigger nodes (nodes with no incoming connections)
            const triggerNodes = nodes.filter(node =>
                !connections.some(conn => conn.toNodeId === node.id)
            );

            if (triggerNodes.length === 0) {
                showToast('No trigger nodes found! Add a node without incoming connections.', 'error');
                setIsRunning(false);
                return;
            }

            // Execute all trigger nodes
            for (const trigger of triggerNodes) {
                await executeNode(trigger.id);
            }

            // Check if any nodes failed after execution
            // Wait a bit for state to update
            setTimeout(() => {
                setNodes(currentNodes => {
                    const hasErrors = currentNodes.some(n => n.status === 'error');
                    const hasCompleted = currentNodes.some(n => n.status === 'completed');
                    
                    if (hasErrors) {
                        showToast('There are configuration errors in some nodes, check the execution history for details', 'error');
                    } else if (hasCompleted) {
                        showToast('Workflow executed successfully!', 'success');
                    }
                    
                    return currentNodes; // Return unchanged
                });
            }, 500);

        } catch (error) {
            console.error('Error executing workflow:', error);
            showToast(`Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    const handleRunNode = async (nodeId: string) => {
        if (isRunning) return;

        const node = nodes.find(n => n.id === nodeId);
        
        // Reset node status to ensure 'running' state is visible
        // This forces React to re-render and show the running indicator
        setNodes(prev => prev.map(n => 
            n.id === nodeId ? { ...n, status: undefined, executionResult: undefined } : n
        ));
        // Small delay to ensure the reset is rendered before setting to 'running'
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Special handling for join nodes
        if (node?.type === 'join') {
            // Use the stored inputDataA and inputDataB
            if (node.inputDataA && node.inputDataB) {
                await executeNode(nodeId, { A: node.inputDataA, B: node.inputDataB }, false);
            } else {
                // Try to get data from parent nodes
                const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
                let dataA = node.inputDataA;
                let dataB = node.inputDataB;
                
                for (const conn of incomingConnections) {
                    const parentNode = nodes.find(n => n.id === conn.fromNodeId);
                    if (parentNode?.outputData) {
                        // Handle splitColumns parent node
                        let parentData;
                        if (parentNode.type === 'splitColumns') {
                            parentData = conn.outputType === 'B' 
                                ? parentNode.outputData.outputB 
                                : parentNode.outputData.outputA;
                        } else {
                            parentData = parentNode.outputData;
                        }
                        
                        if (conn.inputPort === 'A') {
                            dataA = parentData;
                        } else if (conn.inputPort === 'B') {
                            dataB = parentData;
                        }
                    }
                }
                
                // Update the node with the new data
                setNodes(prev => prev.map(n => 
                    n.id === nodeId ? { ...n, inputDataA: dataA, inputDataB: dataB } : n
                ));
                
                if (dataA && dataB) {
                    await executeNode(nodeId, { A: dataA, B: dataB }, false);
                } else {
                    alert(`Join node needs both inputs. Missing: ${!dataA ? 'A' : ''} ${!dataB ? 'B' : ''}`);
                }
            }
            return;
        }

        // Find input data from parent nodes if available
        const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
        let inputData = null;

        if (incomingConnections.length > 0) {
            // Use the data from the first connected parent that has output data
            for (const conn of incomingConnections) {
                const parentNode = nodes.find(n => n.id === conn.fromNodeId);
                if (parentNode && parentNode.outputData) {
                    // Handle splitColumns parent node
                    if (parentNode.type === 'splitColumns') {
                        inputData = conn.outputType === 'B' 
                            ? parentNode.outputData.outputB 
                            : parentNode.outputData.outputA;
                    } else {
                        inputData = parentNode.outputData;
                    }
                    break;
                }
            }
        }

        await executeNode(nodeId, inputData, false);
    };

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
            case 'trigger':
            case 'action':
            case 'output':
            case 'agent':
            case 'opcua':
            case 'mqtt':
                return true; // Estos tipos siempre están configurados
            case 'franmit':
                // Franmit está configurado si tiene al menos un parámetro configurado
                // (no requiere API Secret ID para ejecución local)
                return true; // Siempre permitir ejecución, validación se hace en el backend
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
            case 'action': return 'text-blue-600';
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
            case 'dataVisualization': return 'text-indigo-600';
            case 'webhook': return 'text-cyan-600';
            case 'agent': return 'text-purple-600';
            case 'opcua': return 'text-indigo-600';
            case 'mqtt': return 'text-cyan-600';
            case 'franmit': return 'text-teal-600';
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
                    <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6 py-2 flex items-center justify-between shadow-sm z-20 shrink-0">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                                onClick={backToList}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-sm font-medium text-[var(--text-secondary)] flex-shrink-0"
                            >
                                <ArrowLeft size={18} weight="light" />
                                Back
                            </button>
                            <div className="h-6 w-px bg-[var(--border-medium)] flex-shrink-0"></div>
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="text-lg font-normal text-[var(--text-primary)] bg-transparent border-none focus:outline-none flex-1 min-w-0"
                                placeholder="Workflow Name"
                            />
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => setShowTagsModal(true)}
                                disabled={!currentWorkflowId}
                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                                title="Manage Tags"
                            >
                                <Tag size={18} className="text-[var(--text-secondary)]" weight="light" />
                            </button>
                            {/* Auto-save indicator */}
                            {autoSaveStatus && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
                                    {autoSaveStatus === 'saving' ? (
                                        <>
                                            <span className="animate-spin">⟳</span>
                                            <span className="text-[var(--text-secondary)]">Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={14} className="text-emerald-600" weight="light" />
                                            <span className="text-emerald-600">Saved</span>
                                        </>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={saveWorkflow}
                                disabled={isSaving}
                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                                title="Save (Ctrl+S)"
                            >
                                {isSaving ? <span className="animate-spin">⟳</span> : <Save size={18} className="text-[var(--text-secondary)]" weight="light" />}
                            </button>
                            <button
                                onClick={openExecutionHistory}
                                disabled={!currentWorkflowId}
                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                                title="History"
                            >
                                <History size={18} className="text-[var(--text-secondary)]" weight="light" />
                            </button>
                            <button
                                onClick={runWorkflow}
                                disabled={isRunning || nodes.length === 0}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                            >
                                <Play size={16} weight="light" />
                                {isRunning ? 'Running...' : 'Run'}
                            </button>
                            <button
                                onClick={openWorkflowRunner}
                                disabled={nodes.length === 0}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                            >
                                <Share2 size={16} weight="light" />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Content Area (Sidebar + Canvas) */}
                    <div ref={contentAreaRef} className="flex flex-1 min-h-0 overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
                    {/* Sidebar */}
                    <div ref={sidebarRef} data-tutorial="node-palette" className={`${isSidebarCollapsed ? 'w-14' : 'w-64'} bg-[var(--bg-tertiary)] border-r border-[var(--border-light)] flex flex-col shadow-sm z-10 transition-all duration-300 overflow-hidden`} style={{ height: '100%', maxHeight: '100%' }}>

                        {!isSidebarCollapsed ? (
                            <>
                                <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-sm font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Components</h2>
                                        <button
                                            onClick={() => setIsSidebarCollapsed(true)}
                                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                                            title="Collapse panel"
                                        >
                                            <ChevronsLeft size={16} weight="light" />
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                        <input
                                            type="text"
                                            placeholder="Search"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                </div>

                                <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto bg-[var(--bg-card)] custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
                                    {/* Folder Structure */}
                                    {(() => {
                                        // Organize items into folders - reorganized for better clarity
                                        const folderStructure: { [key: string]: { icon: React.ElementType, items: DraggableItem[] } } = {
                                            'Recents': { icon: Clock, items: [] },
                                            'Triggers': { icon: Play, items: DRAGGABLE_ITEMS.filter(i => ['trigger', 'webhook'].includes(i.type)) },
                                            'Data Sources': { icon: Database, items: DRAGGABLE_ITEMS.filter(i => ['fetchData', 'excelInput', 'pdfInput', 'http', 'mysql', 'sapFetch', 'limsFetch', 'opcua', 'mqtt', 'esios', 'climatiq', 'manualInput'].includes(i.type)) },
                                            'Data Operations': { icon: GitMerge, items: DRAGGABLE_ITEMS.filter(i => ['join', 'splitColumns', 'addField', 'action'].includes(i.type)) },
                                            'Control Flow': { icon: AlertCircle, items: DRAGGABLE_ITEMS.filter(i => ['condition', 'humanApproval', 'alertAgent', 'dataVisualization'].includes(i.type)) },
                                            'Models': { icon: Sparkles, items: DRAGGABLE_ITEMS.filter(i => ['llm', 'statisticalAnalysis', 'franmit'].includes(i.type)) },
                                            'Code': { icon: Code, items: DRAGGABLE_ITEMS.filter(i => ['python'].includes(i.type)) },
                                            'Output & Logging': { icon: LogOut, items: DRAGGABLE_ITEMS.filter(i => ['output', 'saveRecords'].includes(i.type)) },
                                            'Notifications': { icon: Mail, items: DRAGGABLE_ITEMS.filter(i => ['sendEmail', 'sendSMS', 'pdfReport'].includes(i.type)) },
                                            'Utils': { icon: Wrench, items: DRAGGABLE_ITEMS.filter(i => ['comment'].includes(i.type)) },
                                        };

                                        // Add recently used items to Recents (empty for now, can be populated dynamically)
                                        folderStructure['Recents'].items = [];
                                        
                                        // Filter folders based on search and remove empty folders
                                        const visibleFolders = Object.entries(folderStructure).filter(([folderName, folder]) => {
                                            // Always show Recents even if empty
                                            if (folderName === 'Recents') return true;
                                            
                                            // Remove empty folders when not searching
                                            if (searchQuery === '' && folder.items.length === 0) return false;
                                            
                                            // When searching, show if folder name or items match
                                            if (searchQuery !== '') {
                                                const folderMatches = folderName.toLowerCase().includes(searchQuery.toLowerCase());
                                                const itemsMatch = folder.items.some(item => 
                                                    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    item.description.toLowerCase().includes(searchQuery.toLowerCase())
                                                );
                                                return folderMatches || itemsMatch;
                                            }
                                            
                                            return true;
                                        });

                                        return visibleFolders.map(([folderName, folder]) => {
                                            const filteredFolderItems = folder.items.filter(item => {
                                                if (searchQuery === '') return true;
                                                return item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    item.description.toLowerCase().includes(searchQuery.toLowerCase());
                                            });
                                            
                                            // Auto-expand folders when searching and they have matching items
                                            const isExpanded = expandedFolders.has(folderName) || (searchQuery !== '' && filteredFolderItems.length > 0);

                                            // Don't show folder if it has no items (except Recents)
                                            if (folderName !== 'Recents' && filteredFolderItems.length === 0 && searchQuery === '') return null;
                                            if (filteredFolderItems.length === 0 && searchQuery !== '') return null;

                                            return (
                                                <div key={folderName} className="border-b border-[var(--border-light)]">
                                                    {/* Folder Header */}
                                                    <button
                                                        onClick={() => {
                                                            const newExpanded = new Set(expandedFolders);
                                                            if (isExpanded) {
                                                                newExpanded.delete(folderName);
                                                            } else {
                                                                newExpanded.add(folderName);
                                                            }
                                                            setExpandedFolders(newExpanded);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-4 py-2 ${getCategoryColors(folderName).bg} ${getCategoryColors(folderName).hover} transition-colors text-left`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            {React.createElement(folder.icon, { size: 14, className: "text-[var(--text-secondary)] flex-shrink-0", weight: "light" })}
                                                            <span className="text-xs font-medium text-[var(--text-primary)]">{folderName}</span>
                                                        </div>
                                                        {isExpanded ? (
                                                            <ChevronDown size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                                        ) : (
                                                            <ChevronRight size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                                        )}
                                                    </button>

                                                    {/* Folder Items */}
                                                    {isExpanded && filteredFolderItems.length > 0 && (
                                                        <div className="pb-1">
                                                            {filteredFolderItems.map((item) => (
                                                                <div
                                                                    key={item.label}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, item)}
                                                                    className="flex items-center gap-2.5 px-4 py-1.5 pl-8 hover:bg-[var(--bg-tertiary)] cursor-grab transition-colors group"
                                                                >
                                                                    {React.createElement(item.icon, { size: 13, className: `${getNodeIconColor(item.type)} flex-shrink-0`, weight: "light" })}
                                                                    <span className="text-xs text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">{item.label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </>
                        ) : (
                            /* Collapsed view - icons only */
                            <>
                                <div className="p-2 border-b border-[var(--border-light)] bg-[var(--bg-card)] flex justify-center">
                                    <button
                                        onClick={() => setIsSidebarCollapsed(false)}
                                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                                        title="Expand panel"
                                    >
                                        <ChevronsRight size={18} weight="light" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto py-2 space-y-1.5 custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
                                    {filteredItems.map((item) => (
                                        <div
                                            key={item.label}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item)}
                                            className="mx-2 p-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md shadow-sm cursor-grab group flex items-center justify-center"
                                            title={item.label}
                                        >
                                            <div className={`p-1 rounded ${item.category === 'Triggers' ? 'bg-cyan-100 text-cyan-700' :
                                                item.category === 'Data' ? 'bg-[#256A65]/10 text-[#256A65]' :
                                                    item.category === 'Logic' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' :
                                                        'bg-[#84C4D1]/20 text-[#256A65]'
                                                }`}>
                                                {React.createElement(item.icon, { size: 16, weight: "light" })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

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

                                            // Open config for configurable nodes
                                            if (node.type === 'fetchData') {
                                                openNodeConfig(node.id);
                                            } else if (node.type === 'condition') {
                                                openConditionConfig(node.id);
                                            } else if (node.type === 'addField') {
                                                openAddFieldConfig(node.id);
                                            } else if (node.type === 'saveRecords') {
                                                openSaveRecordsConfig(node.id);
                                            } else if (node.type === 'agent') {
                                                openAgentConfig(node.id);
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
                                                                } else if (node.type === 'saveRecords') {
                                                                    openSaveConfig(node.id);
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
                                                                    className="flex-1 px-4 py-2 bg-[#256A65] hover:bg-[#1e554f] text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5"
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
                                                {node.type !== 'comment' && (
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
                                                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#256A65] text-white rounded-lg hover:bg-[#1e554f] transition-all font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02]"
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
                        {showAiAssistant && (
                            <div className="fixed top-0 right-0 w-[450px] h-screen bg-[var(--bg-card)] border-l border-[var(--border-light)] flex flex-col shadow-2xl z-50">
                                {/* Header */}
                            <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-light)] px-6 py-4 text-[var(--text-primary)] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles size={24} />
                                    <div>
                                        <h3 className="font-normal text-lg">AI Workflow Assistant</h3>
                                        <p className="text-sm text-[var(--text-tertiary)]">Ask me about your workflow</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAiAssistant(false)}
                                    className="p-1 hover:bg-[var(--bg-card)]/20 rounded-lg transition-colors"
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-tertiary)]">
                                {aiChatMessages.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--text-tertiary)]">
                                        <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                                        <p className="text-sm font-medium text-[var(--text-secondary)]">AI Workflow Assistant</p>
                                        <p className="text-xs mt-2 px-6">
                                            I can help you build workflows, suggest nodes, and answer questions about your automation.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {aiChatMessages.map(message => (
                                            <div
                                                key={message.id}
                                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[85%] rounded-lg p-3 ${
                                                    message.role === 'user'
                                                        ? 'bg-slate-700 text-white'
                                                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)]'
                                                }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    
                                                    {/* Workflow Suggestion Card */}
                                                    {message.workflowSuggestion && (
                                                        <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-medium)]">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Workflow size={16} className="text-[var(--text-secondary)]" />
                                                                <span className="text-xs font-normal text-[var(--text-primary)] uppercase tracking-wide">
                                                                    Workflow Suggestion
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-[var(--text-secondary)] mb-3">
                                                                {message.workflowSuggestion.description}
                                                            </p>
                                                            
                                                            {message.workflowSuggestion.status === 'pending' && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={handleAcceptWorkflowSuggestion}
                                                                        className="flex-1 px-3 py-1.5 bg-[#256A65] text-white rounded text-xs font-medium hover:bg-[#1e554f] transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <Check size={14} />
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        onClick={handleRejectWorkflowSuggestion}
                                                                        className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-medium hover:bg-[var(--border-medium)] transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <XCircle size={14} />
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                            
                                                            {message.workflowSuggestion.status === 'accepted' && (
                                                                <div className="flex items-center gap-2 text-[#256A65] text-xs font-medium">
                                                                    <CheckCircle size={14} />
                                                                    <span>Applied to workflow</span>
                                                                </div>
                                                            )}
                                                            
                                                            {message.workflowSuggestion.status === 'rejected' && (
                                                                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-medium">
                                                                    <XCircle size={14} />
                                                                    <span>Rejected</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={aiChatMessagesEndRef} />
                                    </>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-card)]">
                                {isAiChatLoading && (
                                    <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                        <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-slate-600 rounded-full animate-spin" />
                                        <span>Thinking...</span>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <textarea
                                        value={aiChatInput}
                                        onChange={(e) => setAiChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendWorkflowAiMessage();
                                            }
                                        }}
                                        placeholder="Ask me to add nodes, modify connections, or explain your workflow..."
                                        className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm resize-none focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                                        rows={2}
                                        disabled={isAiChatLoading}
                                    />
                                    <button
                                        onClick={handleSendWorkflowAiMessage}
                                        disabled={!aiChatInput.trim() || isAiChatLoading}
                                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-[#555555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Sparkles size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}

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
                            <NodeConfigSidePanel
                                isOpen={!!configuringHttpNodeId}
                                onClose={() => setConfiguringHttpNodeId(null)}
                                title="Configure HTTP Request"
                                icon={Globe}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringHttpNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveHttpConfig}
                                            disabled={!httpUrl.trim()}
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
                                            URL
                                        </label>
                                        <input
                                            type="text"
                                            value={httpUrl}
                                            onChange={(e) => setHttpUrl(e.target.value)}
                                            placeholder="https://api.example.com/data"
                                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                                            Enter the full URL to fetch data from (GET request).
                                        </p>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('http', 'HTTP Request')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Webhook Configuration Modal */}
                        {configuringWebhookNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringWebhookNodeId}
                                onClose={closeWebhookConfig}
                                title="Webhook Configuration"
                                icon={Globe}
                                footer={
                                    <button
                                        onClick={closeWebhookConfig}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                    >
                                        Close
                                    </button>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Your Webhook URL
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={webhookUrl}
                                                className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(webhookUrl);
                                                    showToast('Webhook URL copied!', 'success');
                                                }}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            URL with Token (more secure)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${webhookUrl}/${webhookToken}`}
                                                className="flex-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${webhookUrl}/${webhookToken}`);
                                                    showToast('Secure webhook URL copied!', 'success');
                                                }}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg p-3">
                                            <p className="font-medium text-[var(--text-primary)] mb-1">How to use:</p>
                                            <ol className="list-decimal list-inside space-y-1 text-[var(--text-primary)]">
                                                <li>Copy the webhook URL above</li>
                                                <li>Configure your external service to POST data to this URL</li>
                                                <li>The workflow will execute automatically when data is received</li>
                                            </ol>
                                    </div>

                                    <div className="text-xs text-[var(--text-secondary)]">
                                            <p className="font-medium mb-1">Example cURL:</p>
                                            <pre className="bg-slate-800 text-[#256A65] p-2 rounded overflow-x-auto">
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}
                                            </pre>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* MySQL Configuration Modal */}
                        {configuringMySQLNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringMySQLNodeId}
                                onClose={() => setConfiguringMySQLNodeId(null)}
                                title="MySQL"
                                icon={Database}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringMySQLNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveMySQLConfig}
                                            disabled={!mysqlQuery.trim()}
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
                                            Host
                                        </label>
                                            <input
                                                type="text"
                                                value={mysqlHost}
                                                onChange={(e) => setMysqlHost(e.target.value)}
                                                placeholder="localhost"
                                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Port
                                                </label>
                                                <input
                                                    type="text"
                                                    value={mysqlPort}
                                                    onChange={(e) => setMysqlPort(e.target.value)}
                                                    placeholder="3306"
                                                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Database
                                                </label>
                                                <input
                                                    type="text"
                                                    value={mysqlDatabase}
                                                    onChange={(e) => setMysqlDatabase(e.target.value)}
                                                    placeholder="mydb"
                                                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Username
                                            </label>
                                            <input
                                                type="text"
                                                value={mysqlUsername}
                                                onChange={(e) => setMysqlUsername(e.target.value)}
                                                placeholder="root"
                                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Password
                                            </label>
                                            <input
                                                type="password"
                                                value={mysqlPassword}
                                                onChange={(e) => setMysqlPassword(e.target.value)}
                                                placeholder="••••••"
                                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                SQL Query
                                            </label>
                                            <textarea
                                                value={mysqlQuery}
                                                onChange={(e) => setMysqlQuery(e.target.value)}
                                                placeholder="SELECT * FROM users"
                                                rows={3}
                                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] font-mono placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('mysql', 'MySQL')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* SAP Fetch Configuration Modal */}
                        {configuringSAPNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringSAPNodeId}
                                onClose={() => setConfiguringSAPNodeId(null)}
                                title="SAP S/4HANA"
                                description="Read data from SAP S/4HANA OData API"
                                icon={Database}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringSAPNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveSAPConfig}
                                            disabled={!sapBaseApiUrl.trim() || !sapEntity.trim()}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                    <div className="space-y-5">
                                        {/* Connection Settings */}
                                        <div className="border-b border-[var(--border-light)] pb-3">
                                            <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Connection</h4>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Connection Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={sapConnectionName}
                                                    onChange={(e) => setSapConnectionName(e.target.value)}
                                                    placeholder="SAP_Production"
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                            </div>
                                        </div>

                                        {/* Authentication */}
                                        <div className="border-b border-[var(--border-light)] pb-3">
                                            <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Authentication</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Auth Type
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapAuthType}
                                                        onChange={(e) => setSapAuthType(e.target.value)}
                                                        placeholder="OAuth2_Client_Credentials"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Client ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapClientId}
                                                        onChange={(e) => setSapClientId(e.target.value)}
                                                        placeholder="sb-83f9a9..."
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Client Secret
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={sapClientSecret}
                                                        onChange={(e) => setSapClientSecret(e.target.value)}
                                                        placeholder="********"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Token URL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapTokenUrl}
                                                        onChange={(e) => setSapTokenUrl(e.target.value)}
                                                        placeholder="https://company.authentication.eu10.hana.ondemand.com/oauth/token"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* API Configuration */}
                                        <div>
                                            <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">API Configuration</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Base API URL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapBaseApiUrl}
                                                        onChange={(e) => setSapBaseApiUrl(e.target.value)}
                                                        placeholder="https://company-api.s4hana.ondemand.com"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Service Path
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapServicePath}
                                                        onChange={(e) => setSapServicePath(e.target.value)}
                                                        placeholder="/sap/opu/odata/sap/API_PRODUCTION_ORDER_2_SRV"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Entity
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapEntity}
                                                        onChange={(e) => setSapEntity(e.target.value)}
                                                        placeholder="A_ProductionOrder"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('sapFetch', 'SAP S/4HANA')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* OSIsoft PI Configuration Panel */}
                        {configuringOsiPiNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringOsiPiNodeId}
                                onClose={() => setConfiguringOsiPiNodeId(null)}
                                title="OSIsoft PI"
                                description="AVEVA PI Connector"
                                icon={Pi}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringOsiPiNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveOsiPiConfig}
                                            disabled={!osiPiHost.trim() || !osiPiApiKey.trim() || osiPiWebIds.filter(id => id.trim()).length === 0}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    {/* Host */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Host
                                        </label>
                                        <input
                                            type="text"
                                            value={osiPiHost}
                                            onChange={(e) => setOsiPiHost(e.target.value)}
                                            placeholder="https://myserver/piwebapi/"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>

                                    {/* API Key Secret */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            API Key Secret
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showOsiPiApiKey ? 'text' : 'password'}
                                                value={osiPiApiKey}
                                                onChange={(e) => setOsiPiApiKey(e.target.value)}
                                                placeholder="########"
                                                className="w-full px-3 py-1.5 pr-10 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOsiPiApiKey(!showOsiPiApiKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                                title={showOsiPiApiKey ? 'Hide' : 'Show'}
                                            >
                                                <Eye size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Data Collection Section */}
                                    <div className="border-t border-[var(--border-light)] pt-4">
                                        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Data collection</h4>
                                        
                                        {/* Granularity */}
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2 flex items-center gap-1">
                                                Granularity
                                                <span className="text-[var(--text-tertiary)] cursor-help" title="Polling interval for data collection from PI Web API">
                                                    <AlertCircle size={12} />
                                                </span>
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={osiPiGranularityValue}
                                                    onChange={(e) => setOsiPiGranularityValue(e.target.value)}
                                                    placeholder="Value"
                                                    className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                                <select
                                                    value={osiPiGranularityUnit}
                                                    onChange={(e) => setOsiPiGranularityUnit(e.target.value as 'seconds' | 'minutes' | 'hours' | 'days')}
                                                    className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] bg-[var(--bg-card)]"
                                                >
                                                    <option value="seconds">seconds</option>
                                                    <option value="minutes">minutes</option>
                                                    <option value="hours">hours</option>
                                                    <option value="days">days</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Web IDs */}
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Web IDs</h4>
                                        <div className="space-y-2">
                                            {osiPiWebIds.map((webId, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <span className="text-[10px] text-[var(--text-tertiary)] w-8 flex-shrink-0">Id {index + 1}</span>
                                                    <input
                                                        type="text"
                                                        value={webId}
                                                        onChange={(e) => {
                                                            const newWebIds = [...osiPiWebIds];
                                                            newWebIds[index] = e.target.value;
                                                            setOsiPiWebIds(newWebIds);
                                                        }}
                                                        placeholder="Web Id"
                                                        className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                    {osiPiWebIds.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newWebIds = osiPiWebIds.filter((_, i) => i !== index);
                                                                setOsiPiWebIds(newWebIds);
                                                            }}
                                                            className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                                            title="Remove"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setOsiPiWebIds([...osiPiWebIds, ''])}
                                            className="mt-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-colors"
                                        >
                                            Add web id
                                        </button>
                                    </div>

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('osiPi', 'OSIsoft PI')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                    </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* FranMIT Configuration Panel */}
                        {configuringFranmitNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringFranmitNodeId}
                                onClose={() => setConfiguringFranmitNodeId(null)}
                                title="Franmit Node"
                                description="Franmit Node"
                                icon={FlaskConical}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringFranmitNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveFranmitConfig}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    {/* API Credentials Secret ID */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            API Credentials Secret ID
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showFranmitApiSecret ? 'text' : 'password'}
                                                value={franmitApiSecretId}
                                                onChange={(e) => setFranmitApiSecretId(e.target.value)}
                                                placeholder="Enter secret ID..."
                                                className="w-full px-3 py-1.5 pr-10 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowFranmitApiSecret(!showFranmitApiSecret)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                                title={showFranmitApiSecret ? 'Hide' : 'Show'}
                                            >
                                                <Eye size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Parameters Section */}
                                    <div className="border-t border-[var(--border-light)] pt-4">
                                        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Parameters</h4>

                                        {/* Reactor Volume */}
                                        <div className="mb-3">
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Reactor Volume (m³)
                                            </label>
                                            <input
                                                type="text"
                                                value={franmitReactorVolume}
                                                onChange={(e) => setFranmitReactorVolume(e.target.value)}
                                                placeholder="Reactor Volume"
                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>

                                        {/* Reaction Volume */}
                                        <div className="mb-3">
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Reaction Volume (m³)
                                            </label>
                                            <input
                                                type="text"
                                                value={franmitReactionVolume}
                                                onChange={(e) => setFranmitReactionVolume(e.target.value)}
                                                placeholder="Reaction Volume"
                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>

                                        {/* Catalyst Scale Factor */}
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Catalyst Scale Factor
                                            </label>
                                            <input
                                                type="text"
                                                value={franmitCatalystScaleFactor}
                                                onChange={(e) => setFranmitCatalystScaleFactor(e.target.value)}
                                                placeholder="Catalyst Scale Factor"
                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                    </div>

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('franmit', 'FranMIT')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* LIMS Connector Modal */}
                        {configuringLIMSNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringLIMSNodeId}
                                onClose={() => setConfiguringLIMSNodeId(null)}
                                title="LIMS Connector"
                                description="Fetch data from Laboratory Information Management System"
                                icon={FlaskConical}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringLIMSNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveLIMSConfig}
                                            disabled={!limsServerUrl.trim() || !limsApiKey.trim()}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Connection Settings</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    LIMS Server URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={limsServerUrl}
                                                    onChange={(e) => setLimsServerUrl(e.target.value)}
                                                    placeholder="https://lims.company.com/api"
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    API Key
                                                </label>
                                                <input
                                                    type="password"
                                                    value={limsApiKey}
                                                    onChange={(e) => setLimsApiKey(e.target.value)}
                                                    placeholder="Enter API key"
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Endpoint
                                                </label>
                                                <select
                                                    value={limsEndpoint}
                                                    onChange={(e) => setLimsEndpoint(e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                                >
                                                    <option value="materials">Materials (Raw Materials)</option>
                                                    <option value="batches">Batches</option>
                                                    <option value="qc">Quality Control Results</option>
                                                    <option value="analyses">Analyses</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Query (Optional)
                                                </label>
                                                <textarea
                                                    value={limsQuery}
                                                    onChange={(e) => setLimsQuery(e.target.value)}
                                                    placeholder='{"batchId": "BATCH123", "status": "approved"}'
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                                                    rows={3}
                                                />
                                                <p className="text-xs text-[var(--text-secondary)] mt-1">JSON query parameters</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Statistical Analysis Modal */}
                        {configuringStatisticalNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringStatisticalNodeId}
                                onClose={() => setConfiguringStatisticalNodeId(null)}
                                title="Statistical Analysis"
                                description="Perform PCA, SPC, or compare with golden batch"
                                icon={TrendUp}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringStatisticalNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveStatisticalConfig}
                                            disabled={!statisticalMethod}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Analysis Method</h4>
                                        <select
                                            value={statisticalMethod}
                                            onChange={(e) => setStatisticalMethod(e.target.value as any)}
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="goldenBatch">Compare with Golden Batch</option>
                                            <option value="pca">Principal Component Analysis (PCA)</option>
                                            <option value="spc">Statistical Process Control (SPC)</option>
                                            <option value="regression">Regression Analysis</option>
                                        </select>
                                    </div>
                                    {statisticalMethod === 'goldenBatch' && (
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Golden Batch ID
                                            </label>
                                            <input
                                                type="text"
                                                value={goldenBatchId}
                                                onChange={(e) => setGoldenBatchId(e.target.value)}
                                                placeholder="BATCH_REF_001"
                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Parameters (JSON)
                                        </label>
                                        <textarea
                                            value={statisticalParams}
                                            onChange={(e) => setStatisticalParams(e.target.value)}
                                            placeholder='{"n_components": 3, "tolerance": 0.05}'
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                                            rows={4}
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Analysis-specific parameters in JSON format</p>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Alert Agent Modal */}
                        {configuringAlertAgentNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringAlertAgentNodeId}
                                onClose={() => setConfiguringAlertAgentNodeId(null)}
                                title="Alert Agent"
                                description="Configure deterministic alerts with conditions and actions"
                                icon={Bell}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringAlertAgentNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveAlertAgentConfig}
                                            disabled={!alertConditions.trim()}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Alert Severity</h4>
                                        <select
                                            value={alertSeverity}
                                            onChange={(e) => setAlertSeverity(e.target.value as any)}
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="info">Info</option>
                                            <option value="warning">Warning</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Alert Conditions (JSON)</h4>
                                        <textarea
                                            value={alertConditions}
                                            onChange={(e) => setAlertConditions(e.target.value)}
                                            placeholder='[{"field": "temperature", "operator": ">", "value": 100, "message": "Temperature exceeded limit"}]'
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                                            rows={6}
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Array of condition objects. Operators: &gt;, &lt;, &gt;=, &lt;=, ==, !=</p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Actions</h4>
                                        <div className="space-y-2">
                                            {['email', 'sms', 'webhook', 'stop'].map(action => (
                                                <label key={action} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={alertActions.includes(action)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setAlertActions([...alertActions, action]);
                                                            } else {
                                                                setAlertActions(alertActions.filter(a => a !== action));
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-[var(--text-secondary)] border-[var(--border-medium)] rounded focus:ring-[var(--border-medium)]"
                                                    />
                                                    <span className="text-xs text-[var(--text-primary)] capitalize">{action}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Recipients (comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={alertRecipients}
                                            onChange={(e) => setAlertRecipients(e.target.value)}
                                            placeholder="email@example.com, +1234567890"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Emails or phone numbers</p>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* PDF Report Generator Modal */}
                        {configuringPdfReportNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringPdfReportNodeId}
                                onClose={() => setConfiguringPdfReportNodeId(null)}
                                title="PDF Report Generator"
                                description="Generate structured PDF reports from data"
                                icon={FilePdf}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringPdfReportNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={savePdfReportConfig}
                                            disabled={!pdfTemplate.trim()}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-3">Report Template</h4>
                                        <select
                                            value={pdfTemplate}
                                            onChange={(e) => setPdfTemplate(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="standard">Standard Report</option>
                                            <option value="goldenBatch">Golden Batch Analysis</option>
                                            <option value="qc">Quality Control Report</option>
                                            <option value="compliance">Compliance Report</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Report Data Structure (JSON)
                                        </label>
                                        <textarea
                                            value={pdfReportData}
                                            onChange={(e) => setPdfReportData(e.target.value)}
                                            placeholder='{"title": "Batch Analysis", "sections": [...]}'
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] font-mono"
                                            rows={6}
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Optional: Customize report structure. Leave empty to use input data.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Output Path (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={pdfOutputPath}
                                            onChange={(e) => setPdfOutputPath(e.target.value)}
                                            placeholder="/reports/batch_analysis.pdf"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Leave empty for auto-generated path</p>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Send Email Configuration Modal */}
                        {configuringEmailNodeId && (() => {
                            // Get input data from parent node for @ mentions
                            const parentConnection = connections.find(c => c.toNodeId === configuringEmailNodeId);
                            const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
                            let inputDataForEmail: any[] = [];
                            
                            if (parentNode) {
                                if (parentNode.type === 'splitColumns' && parentNode.outputData) {
                                    inputDataForEmail = parentConnection.outputType === 'B' 
                                        ? parentNode.outputData.outputB || []
                                        : parentNode.outputData.outputA || [];
                                } else {
                                    inputDataForEmail = parentNode.outputData || parentNode.config?.parsedData || [];
                                }
                            }

                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringEmailNodeId}
                                    onClose={() => setConfiguringEmailNodeId(null)}
                                    title="Send Email"
                                    icon={Mail}
                                    width="w-[550px]"
                                    footer={
                                        <>
                                            <button
                                                onClick={() => setConfiguringEmailNodeId(null)}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveEmailConfig}
                                                disabled={!emailTo.trim()}
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
                                                    To (recipient email)
                                                </label>
                                                <div className="h-16">
                                                    <PromptInput
                                                        entities={entities}
                                                        onGenerate={() => {}}
                                                        isGenerating={false}
                                                        initialValue={emailTo}
                                                        placeholder="recipient@example.com — Use @ to mention Input Data or entities"
                                                        hideButton={true}
                                                        onChange={(val) => setEmailTo(val)}
                                                        className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                                                        inputData={inputDataForEmail}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Subject
                                                </label>
                                                <div className="h-16">
                                                    <PromptInput
                                                        entities={entities}
                                                        onGenerate={() => {}}
                                                        isGenerating={false}
                                                        initialValue={emailSubject}
                                                        placeholder="Email subject — Use @ to mention data"
                                                        hideButton={true}
                                                        onChange={(val) => setEmailSubject(val)}
                                                        className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                                                        inputData={inputDataForEmail}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Body
                                                </label>
                                                <div className="h-48">
                                                    <PromptInput
                                                        entities={entities}
                                                        onGenerate={() => {}}
                                                        isGenerating={false}
                                                        initialValue={emailBody}
                                                        placeholder="Write your email body here...&#10;&#10;Use @ to mention Input Data or entities."
                                                        hideButton={true}
                                                        onChange={(val) => setEmailBody(val)}
                                                        className="h-full"
                                                        inputData={inputDataForEmail}
                                                    />
                                                </div>
                                            </div>

                                            {/* SMTP Settings (collapsible) */}
                                            <div className="border border-[var(--border-light)] rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmailSmtpSettings(!showEmailSmtpSettings)}
                                                    className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                                >
                                                    <span>⚙️ SMTP Settings</span>
                                                    <span>{showEmailSmtpSettings ? '▲' : '▼'}</span>
                                                </button>
                                                
                                                {showEmailSmtpSettings && (
                                                    <div className="p-4 border-t border-[var(--border-light)] space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                                                    SMTP Host
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={emailSmtpHost}
                                                                    onChange={(e) => setEmailSmtpHost(e.target.value)}
                                                                    placeholder="smtp.gmail.com"
                                                                    className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                                                    SMTP Port
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={emailSmtpPort}
                                                                    onChange={(e) => setEmailSmtpPort(e.target.value)}
                                                                    placeholder="587"
                                                                    className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                                                SMTP Username (email)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={emailSmtpUser}
                                                                onChange={(e) => setEmailSmtpUser(e.target.value)}
                                                                placeholder="your-email@gmail.com"
                                                                className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                                                                SMTP Password / App Password
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={emailSmtpPass}
                                                                onChange={(e) => setEmailSmtpPass(e.target.value)}
                                                                placeholder="••••••••••••"
                                                                className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                            />
                                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                                For Gmail, use an App Password (not your regular password)
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-[var(--border-light)]">
                                            <button
                                                onClick={() => openFeedbackPopup('sendEmail', 'Send Email')}
                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} weight="light" />
                                                What would you like this node to do?
                                            </button>
                                        </div>
                                </NodeConfigSidePanel>
                            );
                        })()}

                        {/* Send SMS Configuration Modal */}
                        {configuringSMSNodeId && (() => {
                            // Get input data from parent node for @ mentions
                            const parentConnection = connections.find(c => c.toNodeId === configuringSMSNodeId);
                            const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
                            let inputDataForSMS: any[] = [];
                            
                            if (parentNode) {
                                if (parentNode.type === 'splitColumns' && parentNode.outputData) {
                                    inputDataForSMS = parentConnection.outputType === 'B' 
                                        ? parentNode.outputData.outputB || []
                                        : parentNode.outputData.outputA || [];
                                } else {
                                    inputDataForSMS = parentNode.outputData || parentNode.config?.parsedData || [];
                                }
                            }

                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringSMSNodeId}
                                    onClose={() => setConfiguringSMSNodeId(null)}
                                    title="Send SMS"
                                    icon={Smartphone}
                                    width="w-[550px]"
                                    footer={
                                        <>
                                            <button
                                                onClick={() => setConfiguringSMSNodeId(null)}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveSMSConfig}
                                                disabled={!smsTo.trim()}
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
                                                    To (phone number with country code)
                                                </label>
                                                <div className="h-16">
                                                    <PromptInput
                                                        entities={entities}
                                                        onGenerate={() => {}}
                                                        isGenerating={false}
                                                        initialValue={smsTo}
                                                        placeholder="+34612345678 — Use @ to mention Input Data"
                                                        hideButton={true}
                                                        onChange={(val) => setSmsTo(val)}
                                                        className="h-full [&_textarea]:!h-10 [&_textarea]:!min-h-0 [&_textarea]:!p-2 [&_textarea]:!text-sm"
                                                        inputData={inputDataForSMS}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Message Body
                                                </label>
                                                <div className="h-32">
                                                    <PromptInput
                                                        entities={entities}
                                                        onGenerate={() => {}}
                                                        isGenerating={false}
                                                        initialValue={smsBody}
                                                        placeholder="Write your SMS message here...&#10;&#10;Use @ to mention Input Data or entities."
                                                        hideButton={true}
                                                        onChange={(val) => setSmsBody(val)}
                                                        className="h-full"
                                                        inputData={inputDataForSMS}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                    SMS messages are limited to 160 characters (or 70 with special characters)
                                                </p>
                                            </div>

                                            {/* Twilio Settings (collapsible) */}
                                            <div className="border border-[var(--border-light)] rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSMSTwilioSettings(!showSMSTwilioSettings)}
                                                    className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                                >
                                                    <span>⚙️ Twilio Settings</span>
                                                    <span>{showSMSTwilioSettings ? '▲' : '▼'}</span>
                                                </button>
                                                
                                                {showSMSTwilioSettings && (
                                                    <div className="p-4 border-t border-[var(--border-light)] space-y-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                                                Account SID
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={twilioAccountSid}
                                                                onChange={(e) => setTwilioAccountSid(e.target.value)}
                                                                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                                className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                                                Auth Token
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={twilioAuthToken}
                                                                onChange={(e) => setTwilioAuthToken(e.target.value)}
                                                                placeholder="••••••••••••"
                                                                className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                                                From Number (Twilio phone number)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={twilioFromNumber}
                                                                onChange={(e) => setTwilioFromNumber(e.target.value)}
                                                                placeholder="+1234567890"
                                                                className="w-full px-2 py-1.5 text-sm border border-[var(--border-medium)] rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                                Get your credentials from twilio.com/console
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-[var(--border-light)]">
                                            <button
                                                onClick={() => openFeedbackPopup('sendSMS', 'Send SMS')}
                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} weight="light" />
                                                What would you like this node to do?
                                            </button>
                                        </div>
                                </NodeConfigSidePanel>
                            );
                        })()}

                        {/* Data Visualization Configuration Modal */}
                        {configuringVisualizationNodeId && (() => {
                            // Get input data from parent node
                            const parentConnection = connections.find(c => c.toNodeId === configuringVisualizationNodeId);
                            const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
                            let inputDataForViz: any[] = [];
                            
                            if (parentNode) {
                                if (parentNode.type === 'splitColumns' && parentNode.outputData) {
                                    inputDataForViz = parentConnection.outputType === 'B' 
                                        ? parentNode.outputData.outputB || []
                                        : parentNode.outputData.outputA || [];
                                } else {
                                    inputDataForViz = parentNode.outputData || parentNode.config?.parsedData || [];
                                }
                            }

                            const hasInputData = inputDataForViz && Array.isArray(inputDataForViz) && inputDataForViz.length > 0;
                            const dataFields = hasInputData ? Object.keys(inputDataForViz[0] || {}) : [];

                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringVisualizationNodeId}
                                    onClose={() => { setConfiguringVisualizationNodeId(null); setGeneratedWidget(null); }}
                                    title="Data Visualization"
                                    icon={BarChart3}
                                    width="w-[700px]"
                                    footer={
                                        <>
                                            <button
                                                onClick={() => { setConfiguringVisualizationNodeId(null); setGeneratedWidget(null); }}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveVisualizationConfig}
                                                disabled={!generatedWidget}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save Visualization
                                            </button>
                                        </>
                                    }
                                >
                                        {/* Data Preview */}
                                        {hasInputData && (
                                            <div className="mb-4 border border-[var(--border-light)] rounded-lg overflow-hidden">
                                                <div className="bg-[var(--bg-tertiary)] px-3 py-2 border-b border-[var(--border-light)] flex items-center justify-between">
                                                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                                                        📊 Available Data ({inputDataForViz.length} rows, {dataFields.length} columns)
                                                    </span>
                                                    <span className="text-xs text-[var(--text-tertiary)]">Preview</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-[var(--bg-tertiary)]">
                                                            <tr>
                                                                {dataFields.map((field, idx) => (
                                                                    <th key={idx} className="px-3 py-2 text-left font-normal text-[var(--text-primary)] whitespace-nowrap border-b border-[var(--border-light)]">
                                                                        {field}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {inputDataForViz.slice(0, 4).map((row: any, rowIdx: number) => (
                                                                <tr key={rowIdx} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]">
                                                                    {dataFields.map((field, colIdx) => (
                                                                        <td key={colIdx} className="px-3 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                                                            {row[field] !== undefined && row[field] !== null ? String(row[field]) : '-'}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {inputDataForViz.length > 4 && (
                                                    <div className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] text-center border-t border-[var(--border-light)]">
                                                        ... and {inputDataForViz.length - 4} more rows
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Prompt Input with Generate Button */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-[var(--text-primary)]">
                                                    Describe the visualization you want
                                                </label>
                                                <button
                                                    onClick={generateWidgetFromPrompt}
                                                    disabled={!visualizationPrompt.trim() || !hasInputData || isGeneratingWidget}
                                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                                                >
                                                    {isGeneratingWidget ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles size={14} weight="light" />
                                                            Generate
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <textarea
                                                value={visualizationPrompt}
                                                onChange={(e) => setVisualizationPrompt(e.target.value)}
                                                placeholder="e.g., 'Show a bar chart of sales by month' or 'Create a pie chart showing the distribution of categories'"
                                                className="w-full px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)]"
                                                rows={3}
                                            />
                                            {!hasInputData && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    ⚠️ No input data available. Run the workflow first.
                                                </p>
                                            )}
                                        </div>

                                        {/* Generated Widget Preview */}
                                        {generatedWidget && (
                                            <div className="mb-4 border border-[var(--border-light)] rounded-lg overflow-hidden">
                                                <div className="bg-[var(--bg-tertiary)] px-4 py-2 border-b border-[var(--border-light)]">
                                                    <h4 className="font-medium text-xs text-[var(--text-primary)]">{generatedWidget.title}</h4>
                                                    <p className="text-xs text-[var(--text-secondary)]">{generatedWidget.description}</p>
                                                </div>
                                                <div className="p-4 bg-[var(--bg-card)]">
                                                    <DynamicChart config={generatedWidget} />
                                                </div>
                                                
                                                {/* Explanation Toggle */}
                                                {generatedWidget.explanation && (
                                                    <div className="border-t border-[var(--border-light)]">
                                                        <button
                                                            onClick={() => setShowWidgetExplanation(!showWidgetExplanation)}
                                                            className="w-full px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                                                        >
                                                            <span>How was this created?</span>
                                                            <span>{showWidgetExplanation ? '▲' : '▼'}</span>
                                                        </button>
                                                        {showWidgetExplanation && (
                                                            <div className="px-4 pb-4 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                                                                {generatedWidget.explanation}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-[var(--border-light)]">
                                            <button
                                                onClick={() => openFeedbackPopup('dataVisualization', 'Data Visualization')}
                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} weight="light" />
                                                What would you like this node to do?
                                            </button>
                                        </div>
                                </NodeConfigSidePanel>
                            );
                        })()}

                        {/* ESIOS Configuration Modal */}
                        {configuringEsiosNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringEsiosNodeId}
                                onClose={() => setConfiguringEsiosNodeId(null)}
                                title="Configure ESIOS Energy Prices"
                                icon={Leaf}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringEsiosNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveEsiosConfig}
                                            disabled={!esiosArchiveId.trim()}
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
                                            Indicator ID
                                        </label>
                                        <input
                                            type="text"
                                            value={esiosArchiveId}
                                            onChange={(e) => setEsiosArchiveId(e.target.value)}
                                            placeholder="e.g., 1001 for PVPC"
                                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                                            1001 = PVPC prices, 1739 = Spot prices, 10211 = Market price
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Date
                                        </label>
                                        <input
                                            type="date"
                                            value={esiosDate}
                                            onChange={(e) => setEsiosDate(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        />
                                    </div>
                                    <div className="p-3 border border-[var(--border-light)] rounded-lg">
                                        <p className="text-xs text-[var(--text-primary)] font-medium mb-1">Using Token:</p>
                                        <code className="text-[10px] text-[var(--text-secondary)] break-all">d668...da64</code>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('esios', 'ESIOS Energy Prices')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                    </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Climatiq Configuration Modal */}
                        {configuringClimatiqNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringClimatiqNodeId}
                                onClose={() => setConfiguringClimatiqNodeId(null)}
                                title="🌱 Get Emission Factors"
                                description="Search emission factors in the Climatiq database, to calculate your process and company emissions."
                                icon={Leaf}
                                width="w-[500px]"
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringClimatiqNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveClimatiqConfig}
                                            disabled={climatiqSelectedIndex === null}
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
                                            Search
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={climatiqQuery}
                                                onChange={(e) => setClimatiqQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && searchClimatiq()}
                                                placeholder="e.g., Passenger diesel car"
                                                className="flex-1 px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            />
                                            <button
                                                onClick={searchClimatiq}
                                                disabled={climatiqSearching || !climatiqQuery.trim()}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                                            >
                                                {climatiqSearching ? (
                                                    <>
                                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Searching...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={14} />
                                                        Search
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                                            Introduce your activity and click search
                                        </p>
                                    </div>

                                    {/* Results List */}
                                    {climatiqSearchResults.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Similar activities and its Emission factors
                                            </label>
                                            <div className="space-y-2">
                                                {climatiqSearchResults.map((result, index) => (
                                                    <div
                                                        key={index}
                                                        onClick={() => setClimatiqSelectedIndex(index)}
                                                        className={`p-2.5 border rounded-lg cursor-pointer transition-all ${climatiqSelectedIndex === index
                                                            ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]'
                                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${climatiqSelectedIndex === index
                                                                ? 'border-slate-700 bg-slate-700'
                                                                : 'border-[var(--border-medium)]'
                                                                }`}>
                                                                {climatiqSelectedIndex === index && (
                                                                    <Check size={10} className="text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-xs text-[var(--text-primary)]">
                                                                    {result.factor} {result.unit}
                                                                </p>
                                                                <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                                                    {result.name} ({result.region_name || result.region})
                                                                </p>
                                                                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                                                    Source: {result.source} • Year: {result.year}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* No results message */}
                                    {!climatiqSearching && climatiqSearchResults.length === 0 && climatiqQuery && (
                                        <div className="p-3 border border-[var(--border-light)] rounded-lg text-center">
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                Introduce your activity and click search
                                            </p>
                                        </div>
                                    )}

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <button
                                            onClick={() => openFeedbackPopup('climatiq', 'Climatiq Emissions')}
                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Human Approval Configuration Modal */}
                        {configuringHumanApprovalNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringHumanApprovalNodeId}
                                onClose={() => setConfiguringHumanApprovalNodeId(null)}
                                title="Human in the Loop"
                                description="Assign a user to approve this step"
                                icon={UserCheck}
                                width="w-[450px]"
                                footer={
                                    <button
                                        onClick={() => setConfiguringHumanApprovalNodeId(null)}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        Close
                                    </button>
                                }
                            >
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Assign to
                                            </label>
                                            {organizationUsers.length === 0 ? (
                                            <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
                                                <div className="w-5 h-5 border-2 border-[var(--border-medium)] border-t-teal-500 rounded-full animate-spin mr-2" />
                                                Loading users...
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {organizationUsers.map((user) => {
                                                    const currentNode = nodes.find(n => n.id === configuringHumanApprovalNodeId);
                                                    const isSelected = currentNode?.config?.assignedUserId === user.id;
                                                    return (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => saveHumanApprovalConfig(user.id, user.name || user.email, user.profilePhoto)}
                                                            className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                                                                isSelected
                                                                    ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]'
                                                                    : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]/50'
                                                            }`}
                                                        >
                                                            <UserAvatar name={user.name || user.email} profilePhoto={user.profilePhoto} size="sm" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-[var(--text-primary)] truncate">
                                                                    {user.name || 'Unnamed User'}
                                                                </div>
                                                                <div className="text-xs text-[var(--text-secondary)] truncate">
                                                                    {user.email}
                                                                </div>
                                                            </div>
                                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                                user.role === 'admin' 
                                                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' 
                                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                                            }`}>
                                                                {user.role}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        </div>
                                    </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Data Preview Modal */}
                        {viewingDataNodeId && (() => {
                            const node = nodes.find(n => n.id === viewingDataNodeId);
                            if (!node) return null;

                            // Helper function to normalize data to array format
                            const normalizeToArray = (data: any): any[] => {
                                if (!data) return [];
                                if (Array.isArray(data)) {
                                    // If array is empty or contains objects, return as is
                                    return data;
                                }
                                if (typeof data === 'object') {
                                    // Check if it's splitColumns format (has outputA or outputB)
                                    if (data.outputA !== undefined || data.outputB !== undefined) {
                                        // This is splitColumns format, return as is (not an array)
                                        return data as any;
                                    }
                                    // Single object, wrap it in array
                                    return [data];
                                }
                                // Primitive value, wrap it
                                return [{ value: data }];
                            };

                            // Special handling for splitColumns node
                            const isSplitColumnsNode = node.type === 'splitColumns';
                            
                            // Special handling for condition node with trueRecords/falseRecords
                            const isConditionWithBranches = node.type === 'condition' && 
                                node.outputData && 
                                typeof node.outputData === 'object' &&
                                (node.outputData.trueRecords !== undefined || node.outputData.falseRecords !== undefined);
                            
                            // Get data from various possible locations
                            // Input data should only come from explicit inputData (from previous nodes)
                            // Output data can come from outputData or fallback to node.data
                            let rawInputData = node.inputData; // Only use explicit inputData
                            let rawOutputData = node.outputData || node.data; // Use outputData or fallback to node.data
                            
                            // Don't use node.data as fallback for input - input should come from previous nodes
                            // If inputData doesn't exist, it means there's no input (e.g., trigger nodes)
                            
                            const nodeInputData = normalizeToArray(rawInputData);
                            const nodeOutputData = normalizeToArray(rawOutputData);
                            
                            const hasInput = rawInputData !== undefined && rawInputData !== null && Array.isArray(nodeInputData) && nodeInputData.length > 0;
                            const hasOutput = !isSplitColumnsNode && !isConditionWithBranches && rawOutputData !== undefined && rawOutputData !== null && Array.isArray(nodeOutputData) && nodeOutputData.length > 0;
                            const hasOutputA = isSplitColumnsNode && nodeOutputData?.outputA?.length > 0;
                            const hasOutputB = isSplitColumnsNode && nodeOutputData?.outputB?.length > 0;
                            
                            // For condition nodes with branches
                            const hasTrueRecords = isConditionWithBranches && Array.isArray(rawOutputData?.trueRecords) && rawOutputData.trueRecords.length > 0;
                            const hasFalseRecords = isConditionWithBranches && Array.isArray(rawOutputData?.falseRecords) && rawOutputData.falseRecords.length > 0;

                            if (!hasInput && !hasOutput && !hasOutputA && !hasOutputB && !hasTrueRecords && !hasFalseRecords) return null;
                            
                            // Determine the correct active tab based on available data
                            // Use output if available and selected, otherwise use input if available
                            // If current tab is invalid, use the available one
                            const effectiveTab = !isSplitColumnsNode 
                                ? ((dataViewTab === 'input' && hasInput) || (dataViewTab === 'output' && hasOutput) 
                                    ? dataViewTab 
                                    : (hasOutput ? 'output' : (hasInput ? 'input' : 'output')))
                                : dataViewTab;

                            return (
                                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40 backdrop-blur-sm pointer-events-none" onClick={() => setViewingDataNodeId(null)}>
                                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-[95vw] h-[90vh] overflow-hidden flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                                                    <Database className="text-[var(--text-secondary)]" size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                                        {node.label} - Data Preview
                                                    </h3>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">View node data</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setViewingDataNodeId(null)}
                                                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                                aria-label="Close"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        {/* Content with tabs */}
                                        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
                                            {/* Tabs - different for splitColumns and condition nodes */}
                                            {isSplitColumnsNode ? (
                                                <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
                                                    {hasInput && (
                                                        <button
                                                            onClick={() => setSplitViewTab('input')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'input'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                                                        </button>
                                                    )}
                                                    {hasOutputA && (
                                                        <button
                                                            onClick={() => setSplitViewTab('outputA')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'outputA'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                Output A ({nodeOutputData?.outputA?.length || 0})
                                                            </span>
                                                        </button>
                                                    )}
                                                    {hasOutputB && (
                                                        <button
                                                            onClick={() => setSplitViewTab('outputB')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'outputB'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                                Output B ({nodeOutputData?.outputB?.length || 0})
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : isConditionWithBranches ? (
                                                // Condition node with trueRecords/falseRecords
                                                <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
                                                    {hasInput && (
                                                        <button
                                                            onClick={() => setSplitViewTab('input')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'input'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                                                        </button>
                                                    )}
                                                    {hasTrueRecords && (
                                                        <button
                                                            onClick={() => setSplitViewTab('outputA')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'outputA'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                                True ({rawOutputData?.trueRecords?.length || 0})
                                                            </span>
                                                        </button>
                                                    )}
                                                    {hasFalseRecords && (
                                                        <button
                                                            onClick={() => setSplitViewTab('outputB')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${splitViewTab === 'outputB'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                False ({rawOutputData?.falseRecords?.length || 0})
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                // Only show tabs if both exist, or show single tab without tab styling
                                                (hasInput && hasOutput) ? (
                                                    <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-light)] mb-4 shrink-0">
                                                        <button
                                                            onClick={() => setDataViewTab('input')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${effectiveTab === 'input'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            Input ({Array.isArray(nodeInputData) ? nodeInputData.length : 0})
                                                        </button>
                                                        <button
                                                            onClick={() => setDataViewTab('output')}
                                                            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${effectiveTab === 'output'
                                                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            Output ({Array.isArray(nodeOutputData) ? nodeOutputData.length : 0})
                                                        </button>
                                                    </div>
                                                ) : (
                                                    // Single tab - show label without tab styling
                                                    <div className="mb-4 shrink-0">
                                                        <div className="text-sm font-medium text-[var(--text-primary)]">
                                                            {hasInput ? `Input (${Array.isArray(nodeInputData) ? nodeInputData.length : 0})` : `Output (${Array.isArray(nodeOutputData) ? nodeOutputData.length : 0})`}
                                                        </div>
                                                    </div>
                                                )
                                            )}

                                            {/* Table Container */}
                                            <div className="flex-1 overflow-auto -mx-6 px-6">
                                                {(() => {
                                                    let displayData: any[];
                                                    if (isSplitColumnsNode) {
                                                        displayData = splitViewTab === 'input' 
                                                            ? nodeInputData 
                                                            : splitViewTab === 'outputA' 
                                                                ? nodeOutputData?.outputA 
                                                                : nodeOutputData?.outputB;
                                                    } else if (isConditionWithBranches) {
                                                        // Condition node with trueRecords/falseRecords
                                                        displayData = splitViewTab === 'input' 
                                                            ? nodeInputData 
                                                            : splitViewTab === 'outputA' 
                                                                ? rawOutputData?.trueRecords 
                                                                : rawOutputData?.falseRecords;
                                                    } else {
                                                        // Use effectiveTab to determine which data to display
                                                        displayData = effectiveTab === 'input' ? nodeInputData : nodeOutputData;
                                                    }
                                                    
                                                    // Ensure displayData is an array
                                                    if (!Array.isArray(displayData)) {
                                                        if (displayData && typeof displayData === 'object') {
                                                            displayData = [displayData];
                                                        } else {
                                                            displayData = [];
                                                        }
                                                    }
                                                    
                                                    const MAX_PREVIEW_ROWS = 500;
                                                    const totalRows = displayData?.length || 0;
                                                    const limitedData = displayData?.slice(0, MAX_PREVIEW_ROWS) || [];
                                                    const isLimited = totalRows > MAX_PREVIEW_ROWS;
                                                    
                                                    // Flatten nested objects into flat key-value pairs
                                                    const flattenObject = (obj: any, prefix: string = ''): Record<string, any> => {
                                                        const flattened: Record<string, any> = {};
                                                        
                                                        if (obj === null || obj === undefined) {
                                                            return { [prefix || 'value']: null };
                                                        }
                                                        
                                                        if (Array.isArray(obj)) {
                                                            // For arrays, show as JSON string or count
                                                            flattened[prefix || 'value'] = `[${obj.length} items]`;
                                                            // Optionally, expand first few items
                                                            if (obj.length > 0 && obj.length <= 5) {
                                                                obj.forEach((item, idx) => {
                                                                    if (typeof item === 'object' && item !== null) {
                                                                        Object.assign(flattened, flattenObject(item, `${prefix || 'item'}[${idx}].`));
                                                                    } else {
                                                                        flattened[`${prefix || 'item'}[${idx}]`] = item;
                                                                    }
                                                                });
                                                            }
                                                            return flattened;
                                                        }
                                                        
                                                        if (typeof obj !== 'object') {
                                                            return { [prefix || 'value']: obj };
                                                        }
                                                        
                                                        // Recursively flatten object
                                                        for (const key in obj) {
                                                            if (obj.hasOwnProperty(key)) {
                                                                const newKey = prefix ? `${prefix}${key}` : key;
                                                                const value = obj[key];
                                                                
                                                                if (value === null || value === undefined) {
                                                                    flattened[newKey] = null;
                                                                } else if (Array.isArray(value)) {
                                                                    // Arrays: show count and optionally expand
                                                                    if (value.length === 0) {
                                                                        flattened[newKey] = '[]';
                                                                    } else if (value.length <= 3 && value.every(v => typeof v !== 'object' || v === null)) {
                                                                        // Small array of primitives: show values
                                                                        flattened[newKey] = `[${value.join(', ')}]`;
                                                                    } else {
                                                                        flattened[newKey] = `[${value.length} items]`;
                                                                    }
                                                                } else if (typeof value === 'object') {
                                                                    // Nested object: flatten recursively
                                                                    Object.assign(flattened, flattenObject(value, `${newKey}.`));
                                                                } else {
                                                                    flattened[newKey] = value;
                                                                }
                                                            }
                                                        }
                                                        
                                                        return flattened;
                                                    };
                                                    
                                                    // Flatten all records
                                                    const flattenedData = limitedData.map(record => flattenObject(record));
                                                    
                                                    // Get all unique keys from flattened records
                                                    const getAllKeys = (data: any[]): string[] => {
                                                        const keysSet = new Set<string>();
                                                        data.forEach(record => {
                                                            if (record && typeof record === 'object') {
                                                                Object.keys(record).forEach(key => keysSet.add(key));
                                                            }
                                                        });
                                                        return Array.from(keysSet).sort();
                                                    };
                                                    
                                                    const allKeys = getAllKeys(flattenedData);
                                                    
                                                    return displayData && displayData.length > 0 && allKeys.length > 0 ? (
                                                        <>
                                                            {isLimited && (
                                                                <div className="bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[var(--text-secondary)] px-4 py-2.5 rounded-lg mb-4 text-sm flex items-center gap-2 shrink-0">
                                                                    <AlertCircle size={16} />
                                                                    <span>Showing first {MAX_PREVIEW_ROWS.toLocaleString()} of {totalRows.toLocaleString()} rows</span>
                                                                </div>
                                                            )}
                                                            <div className="border border-[var(--border-light)] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-sm">
                                                                <div className="overflow-auto max-h-full">
                                                                    <table className="w-full text-sm">
                                                                        <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-light)] sticky top-0 z-10">
                                                                            <tr>
                                                                                {allKeys.map(key => (
                                                                                    <th key={key} className="px-4 py-3 text-left font-medium text-[var(--text-primary)] whitespace-nowrap">
                                                                                        {key}
                                                                                    </th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {flattenedData.map((record: any, idx: number) => (
                                                                                <tr key={idx} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                                                                                    {allKeys.map((key, vidx) => {
                                                                                        const value = record?.[key];
                                                                                        const displayValue = value === null || value === undefined 
                                                                                            ? '—' 
                                                                                            : typeof value === 'object' 
                                                                                                ? JSON.stringify(value) 
                                                                                                : String(value);
                                                                                        
                                                                                        return (
                                                                                            <td key={`${idx}-${vidx}`} className="px-4 py-3 text-[var(--text-secondary)]">
                                                                                                <div className="max-w-[400px] break-words" title={displayValue}>
                                                                                                    <span className={value === null || value === undefined ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>
                                                                                                        {displayValue}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </td>
                                                                                        );
                                                                                    })}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                            {totalRows > 0 && (
                                                                <div className="mt-4 text-sm text-[var(--text-secondary)] text-center shrink-0">
                                                                    <span className="font-medium">{totalRows.toLocaleString()}</span> {totalRows === 1 ? 'row' : 'rows'} total
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="text-center py-12">
                                                            <Database size={32} className="mx-auto text-[var(--text-tertiary)] mb-2" />
                                                            <p className="text-sm text-[var(--text-secondary)]">No data available</p>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Condition Configuration Modal */}
                        {configuringConditionNodeId && (() => {
                            // Find the parent node to get available fields
                            const parentConnection = connections.find(c => c.toNodeId === configuringConditionNodeId);
                            const parentNode = parentConnection ? nodes.find(n => n.id === parentConnection.fromNodeId) : null;
                            
                            // Handle splitColumns parent node - get the correct output based on connection type
                            let parentOutputData: any[] = [];
                            if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
                                if (parentConnection?.outputType === 'B') {
                                    parentOutputData = parentNode.outputData.outputB || [];
                                } else {
                                    parentOutputData = parentNode.outputData.outputA || [];
                                }
                            } else {
                                parentOutputData = parentNode?.outputData || parentNode?.data || [];
                            }
                            
                            // Extract field names from the parent's output data
                            const availableFields: string[] = [];
                            if (Array.isArray(parentOutputData) && parentOutputData.length > 0) {
                                const firstRecord = parentOutputData[0];
                                if (firstRecord && typeof firstRecord === 'object') {
                                    Object.keys(firstRecord).forEach(key => {
                                        if (!availableFields.includes(key)) {
                                            availableFields.push(key);
                                        }
                                    });
                                }
                            }
                            
                            const hasAvailableFields = availableFields.length > 0;
                            
                            const OPERATORS = [
                                { value: 'equals', label: 'Equals' },
                                { value: 'not_equals', label: 'Not Equals' },
                                { value: 'contains', label: 'Contains' },
                                { value: 'not_contains', label: 'Does Not Contain' },
                                { value: 'greater_than', label: 'Greater Than' },
                                { value: 'less_than', label: 'Less Than' },
                                { value: 'greater_or_equal', label: 'Greater or Equal' },
                                { value: 'less_or_equal', label: 'Less or Equal' },
                                { value: 'starts_with', label: 'Starts With' },
                                { value: 'ends_with', label: 'Ends With' },
                                { value: 'is_empty', label: 'Is Empty' },
                                { value: 'is_not_empty', label: 'Is Not Empty' },
                            ];
                            
                            const needsValue = (op: string) => !['is_empty', 'is_not_empty', 'isText', 'isNumber'].includes(op);
                            
                            const addCondition = () => {
                                const newCondition = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    field: availableFields[0] || '',
                                    operator: 'equals',
                                    value: ''
                                };
                                setAdditionalConditions([...additionalConditions, newCondition]);
                            };
                            
                            const removeCondition = (id: string) => {
                                setAdditionalConditions(additionalConditions.filter(c => c.id !== id));
                            };
                            
                            const updateCondition = (id: string, field: string, value: any) => {
                                setAdditionalConditions(additionalConditions.map(c => 
                                    c.id === id ? { ...c, [field]: value } : c
                                ));
                            };
                            
                            // Build preview string
                            const buildPreview = () => {
                                const conditions: string[] = [];
                                if (conditionField) {
                                    const op = OPERATORS.find(o => o.value === conditionOperator)?.label || conditionOperator;
                                    const val = needsValue(conditionOperator) ? ` "${conditionValue || '...'}"` : '';
                                    conditions.push(`${conditionField} ${op}${val}`);
                                }
                                additionalConditions.forEach(c => {
                                    if (c.field) {
                                        const op = OPERATORS.find(o => o.value === c.operator)?.label || c.operator;
                                        const val = needsValue(c.operator) ? ` "${c.value || '...'}"` : '';
                                        conditions.push(`${c.field} ${op}${val}`);
                                    }
                                });
                                return conditions.join(` ${conditionLogicalOperator} `);
                            };
                            
                            // Render a condition row
                            const renderConditionRow = (
                                field: string,
                                operator: string,
                                value: string,
                                onFieldChange: (v: string) => void,
                                onOperatorChange: (v: string) => void,
                                onValueChange: (v: string) => void,
                                onRemove?: () => void,
                                isFirst: boolean = false
                            ) => (
                                <div className="relative">
                                    {/* AND/OR connector */}
                                    {!isFirst && (
                                        <div className="flex items-center justify-center mb-3">
                                            <div className="flex-1 h-px bg-[var(--border-light)]" />
                                            <button
                                                onClick={() => setConditionLogicalOperator(conditionLogicalOperator === 'AND' ? 'OR' : 'AND')}
                                                className={`mx-3 px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                                                    conditionLogicalOperator === 'AND'
                                                        ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                                                        : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                                                }`}
                                            >
                                                {conditionLogicalOperator}
                                            </button>
                                            <div className="flex-1 h-px bg-[var(--border-light)]" />
                                        </div>
                                    )}
                                    
                                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)] relative">
                                        {onRemove && (
                                            <button
                                                onClick={onRemove}
                                                className="absolute top-2 right-2 p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                title="Remove condition"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        )}
                                        
                                        <div className="space-y-2.5">
                                            {/* Field */}
                                            <div>
                                                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                                                    Field
                                                </label>
                                                {hasAvailableFields ? (
                                                    <select
                                                        value={field}
                                                        onChange={(e) => onFieldChange(e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                                                    >
                                                        <option value="">Select field...</option>
                                                        {availableFields.map(f => (
                                                            <option key={f} value={f}>{f}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={field}
                                                        onChange={(e) => onFieldChange(e.target.value)}
                                                        placeholder="Field name"
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                )}
                                            </div>
                                            
                                            {/* Operator */}
                                            <div>
                                                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                                                    Operator
                                                </label>
                                                <select
                                                    value={operator}
                                                    onChange={(e) => onOperatorChange(e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
                                                >
                                                    {OPERATORS.map(op => (
                                                        <option key={op.value} value={op.value}>{op.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* Value */}
                                            {needsValue(operator) && (
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                                                        Value
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => onValueChange(e.target.value)}
                                                        placeholder="Enter value..."
                                                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                            
                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringConditionNodeId}
                                    onClose={() => setConfiguringConditionNodeId(null)}
                                    title="Configure Condition"
                                    icon={AlertCircle}
                                    footer={
                                        <>
                                            <button
                                                onClick={() => setConfiguringConditionNodeId(null)}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveConditionConfig}
                                                disabled={!conditionField}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="space-y-4">
                                        {/* No fields warning */}
                                        {!hasAvailableFields && (
                                            <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 rounded-lg">
                                                <AlertCircle size={14} className="text-amber-500 shrink-0" weight="fill" />
                                                <p className="text-xs text-amber-500">
                                                    Run the previous node first to see available fields
                                                </p>
                                            </div>
                                        )}
                                        
                                        {hasAvailableFields && parentNode?.config?.fileName && (
                                            <p className="text-xs text-[var(--text-tertiary)]">
                                                Fields from {parentNode.config.fileName}
                                            </p>
                                        )}
                                        
                                        {/* Primary Condition */}
                                        {renderConditionRow(
                                            conditionField,
                                            conditionOperator,
                                            conditionValue,
                                            setConditionField,
                                            setConditionOperator,
                                            setConditionValue,
                                            undefined,
                                            true
                                        )}
                                        
                                        {/* Additional Conditions */}
                                        {additionalConditions.map((condition) => (
                                            <div key={condition.id}>
                                                {renderConditionRow(
                                                    condition.field,
                                                    condition.operator,
                                                    condition.value,
                                                    (v) => updateCondition(condition.id, 'field', v),
                                                    (v) => updateCondition(condition.id, 'operator', v),
                                                    (v) => updateCondition(condition.id, 'value', v),
                                                    () => removeCondition(condition.id),
                                                    false
                                                )}
                                            </div>
                                        ))}
                                        
                                        {/* Add Condition Button */}
                                        <button
                                            onClick={addCondition}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all"
                                        >
                                            <Plus size={14} weight="bold" />
                                            Add Condition
                                        </button>

                                        {/* Processing Mode */}
                                        <div className="pt-3 border-t border-[var(--border-light)]">
                                            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                Processing Mode
                                            </label>
                                            <div className="space-y-2">
                                                <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'batch' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                    <input
                                                        type="radio"
                                                        name="processingMode"
                                                        value="batch"
                                                        checked={conditionProcessingMode === 'batch'}
                                                        onChange={() => setConditionProcessingMode('batch')}
                                                        className="mt-0.5 mr-3"
                                                    />
                                                    <div>
                                                        <span className="font-medium text-sm text-[var(--text-primary)]">Batch (all rows)</span>
                                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                            Evaluate first row → route ALL data to TRUE or FALSE
                                                        </p>
                                                    </div>
                                                </label>
                                                <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'perRow' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                    <input
                                                        type="radio"
                                                        name="processingMode"
                                                        value="perRow"
                                                        checked={conditionProcessingMode === 'perRow'}
                                                        onChange={() => setConditionProcessingMode('perRow')}
                                                        className="mt-0.5 mr-3"
                                                    />
                                                    <div>
                                                        <span className="font-medium text-sm text-[var(--text-primary)]">Per Row (filter)</span>
                                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                            Evaluate each row → matching to TRUE, non-matching to FALSE
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        
                                        {/* Preview */}
                                        {conditionField && (
                                            <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
                                                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 font-medium">
                                                    Condition Preview
                                                </p>
                                                <code className="text-xs text-[var(--accent-primary)] font-mono break-all leading-relaxed">
                                                    {buildPreview()}
                                                </code>
                                            </div>
                                        )}
                                        
                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-[var(--border-light)]">
                                            <button
                                                onClick={() => openFeedbackPopup('condition', 'Condition')}
                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} weight="light" />
                                                What would you like this node to do?
                                            </button>
                                        </div>
                                    </div>
                            </NodeConfigSidePanel>
                            );
                        })()}

                        {/* Add Field Configuration Modal */}
                        {configuringAddFieldNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringAddFieldNodeId}
                                onClose={() => setConfiguringAddFieldNodeId(null)}
                                title="Add Field to Records"
                                icon={Plus}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringAddFieldNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveAddFieldConfig}
                                            disabled={!addFieldName}
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
                                            Field Name
                                        </label>
                                        <input
                                            type="text"
                                            value={addFieldName}
                                            onChange={(e) => setAddFieldName(e.target.value)}
                                            placeholder="e.g., Nombre, Category"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Field Value
                                        </label>
                                        <input
                                            type="text"
                                            value={addFieldValue}
                                            onChange={(e) => setAddFieldValue(e.target.value)}
                                            placeholder="e.g., Albert, Active"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Join Configuration Modal */}
                        {configuringJoinNodeId && (() => {
                            // Find input nodes to get available fields
                            const joinNode = nodes.find(n => n.id === configuringJoinNodeId);
                            
                            // Try to get data from inputDataA/B first, then from parent nodes
                            let inputAData = joinNode?.inputDataA;
                            let inputBData = joinNode?.inputDataB;
                            
                            // If inputDataA/B not available, look at parent nodes' outputData
                            if (!inputAData || !inputBData) {
                                const incomingConns = connections.filter(c => c.toNodeId === configuringJoinNodeId);
                                for (const conn of incomingConns) {
                                    const parentNode = nodes.find(n => n.id === conn.fromNodeId);
                                    if (parentNode?.outputData) {
                                        // Handle splitColumns parent node
                                        let parentData;
                                        if (parentNode.type === 'splitColumns') {
                                            parentData = conn.outputType === 'B' 
                                                ? parentNode.outputData.outputB 
                                                : parentNode.outputData.outputA;
                                        } else {
                                            parentData = parentNode.outputData;
                                        }
                                        
                                        if (conn.inputPort === 'A' && !inputAData) {
                                            inputAData = parentData;
                                        } else if (conn.inputPort === 'B' && !inputBData) {
                                            inputBData = parentData;
                                        }
                                    }
                                }
                            }
                            
                            // Extract common fields from both inputs
                            const fieldsA = inputAData && Array.isArray(inputAData) && inputAData.length > 0 
                                ? Object.keys(inputAData[0]) 
                                : [];
                            const fieldsB = inputBData && Array.isArray(inputBData) && inputBData.length > 0 
                                ? Object.keys(inputBData[0]) 
                                : [];
                            const commonFields = fieldsA.filter(f => fieldsB.includes(f));
                            const allFields = [...new Set([...fieldsA, ...fieldsB])];
                            
                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringJoinNodeId}
                                    onClose={() => setConfiguringJoinNodeId(null)}
                                    title="Configure Join"
                                    icon={GitMerge}
                                    footer={
                                        <>
                                            <button
                                                onClick={() => setConfiguringJoinNodeId(null)}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveJoinConfig}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                    Join Strategy
                                                </label>
                                                <select
                                                    value={joinStrategy}
                                                    onChange={(e) => setJoinStrategy(e.target.value as 'concat' | 'mergeByKey')}
                                                    className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                                >
                                                    <option value="concat">Concatenate (combine all records)</option>
                                                    <option value="mergeByKey">Merge by common key</option>
                                                </select>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
                                                    {joinStrategy === 'concat' 
                                                        ? 'All records from A and B will be combined into one list'
                                                        : 'Records with matching key values will be merged together'}
                                                </p>
                                            </div>
                                            
                                            {joinStrategy === 'mergeByKey' && (
                                                <>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Join Type
                                                    </label>
                                                    <div className="space-y-2">
                                                        <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'inner' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                            <input
                                                                type="radio"
                                                                name="joinType"
                                                                value="inner"
                                                                checked={joinType === 'inner'}
                                                                onChange={() => setJoinType('inner')}
                                                                className="mt-0.5 mr-3"
                                                            />
                                                            <div>
                                                                <span className="font-medium text-xs text-[var(--text-primary)]">Inner Join</span>
                                                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                                                    Only records that match in both inputs
                                                                </p>
                                                            </div>
                                                        </label>
                                                        <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'outer' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                            <input
                                                                type="radio"
                                                                name="joinType"
                                                                value="outer"
                                                                checked={joinType === 'outer'}
                                                                onChange={() => setJoinType('outer')}
                                                                className="mt-0.5 mr-3"
                                                            />
                                                            <div>
                                                                <span className="font-medium text-xs text-[var(--text-primary)]">Outer Join</span>
                                                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                                                    All records from both inputs (empty where no match)
                                                                </p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                                        Common Key Field
                                                    </label>
                                                    {allFields.length > 0 ? (
                                                        <>
                                                            <select
                                                                value={joinKey}
                                                                onChange={(e) => setJoinKey(e.target.value)}
                                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                                            >
                                                                <option value="">Select a field...</option>
                                                                {commonFields.length > 0 && (
                                                                    <optgroup label="Common fields (recommended)">
                                                                        {commonFields.map(field => (
                                                                            <option key={field} value={field}>{field}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                                <optgroup label="All fields">
                                                                    {allFields.map(field => (
                                                                        <option key={field} value={field}>{field}</option>
                                                                    ))}
                                                                </optgroup>
                                                            </select>
                                                            {commonFields.length > 0 && (
                                                                <p className="text-xs text-[#256A65] mt-1.5">
                                                                    ✓ {commonFields.length} common field(s) found
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={joinKey}
                                                                onChange={(e) => setJoinKey(e.target.value)}
                                                                placeholder="e.g., id, name"
                                                                className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                                            />
                                                            <p className="text-xs text-amber-600 mt-1.5">
                                                                ⚠️ Run the input nodes first to see available fields
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                </>
                                            )}
                                    </div>
                                </NodeConfigSidePanel>
                            );
                        })()}

                        {/* Split Columns Configuration Modal */}
                        {configuringSplitColumnsNodeId && (() => {
                            const allColumns = [...splitColumnsAvailable, ...splitColumnsOutputA, ...splitColumnsOutputB];
                            
                            const handleDragStart = (column: string) => {
                                setDraggedColumn(column);
                            };
                            
                            const handleDragEnd = () => {
                                setDraggedColumn(null);
                            };
                            
                            const handleDropOnOutputA = (e: React.DragEvent) => {
                                e.preventDefault();
                                if (!draggedColumn) return;
                                
                                // Remove from other lists
                                setSplitColumnsAvailable(prev => prev.filter(c => c !== draggedColumn));
                                setSplitColumnsOutputB(prev => prev.filter(c => c !== draggedColumn));
                                
                                // Add to Output A if not already there
                                    if (!splitColumnsOutputA.includes(draggedColumn)) {
                                            setSplitColumnsOutputA(prev => [...prev, draggedColumn]);
                                }
                                setDraggedColumn(null);
                            };
                            
                            const handleDropOnOutputB = (e: React.DragEvent) => {
                                e.preventDefault();
                                if (!draggedColumn) return;
                                
                                // Remove from other lists
                                setSplitColumnsAvailable(prev => prev.filter(c => c !== draggedColumn));
                                setSplitColumnsOutputA(prev => prev.filter(c => c !== draggedColumn));
                                
                                // Add to Output B if not already there
                                    if (!splitColumnsOutputB.includes(draggedColumn)) {
                                            setSplitColumnsOutputB(prev => [...prev, draggedColumn]);
                                }
                                setDraggedColumn(null);
                            };
                            
                            const handleDragOver = (e: React.DragEvent) => {
                                e.preventDefault();
                            };
                            
                            const moveColumnToA = (column: string) => {
                                setSplitColumnsOutputB(prev => prev.filter(c => c !== column));
                                if (!splitColumnsOutputA.includes(column)) {
                                    setSplitColumnsOutputA(prev => [...prev, column]);
                                }
                            };
                            
                            const moveColumnToB = (column: string) => {
                                setSplitColumnsOutputA(prev => prev.filter(c => c !== column));
                                if (!splitColumnsOutputB.includes(column)) {
                                    setSplitColumnsOutputB(prev => [...prev, column]);
                                }
                            };
                            
                            const moveAllToA = () => {
                                setSplitColumnsOutputA([...splitColumnsOutputA, ...splitColumnsOutputB]);
                                setSplitColumnsOutputB([]);
                            };
                            
                            const moveAllToB = () => {
                                setSplitColumnsOutputB([...splitColumnsOutputB, ...splitColumnsOutputA]);
                                setSplitColumnsOutputA([]);
                            };
                            
                            return (
                                <NodeConfigSidePanel
                                    isOpen={!!configuringSplitColumnsNodeId}
                                    onClose={() => setConfiguringSplitColumnsNodeId(null)}
                                    title="Split by Columns"
                                    description="Drag columns between outputs A and B"
                                    icon={Columns}
                                    width="w-[600px]"
                                    footer={
                                        <>
                                            <button
                                                onClick={() => setConfiguringSplitColumnsNodeId(null)}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveSplitColumnsConfig}
                                                disabled={splitColumnsOutputA.length === 0 && splitColumnsOutputB.length === 0}
                                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save Configuration
                                            </button>
                                        </>
                                    }
                                >
                                        {allColumns.length === 0 ? (
                                            <div className="text-center py-8 text-[var(--text-secondary)]">
                                                <Columns size={32} className="mx-auto mb-2 opacity-50" />
                                                <p className="font-medium">No columns available</p>
                                                <p className="text-sm">Run the previous node first to detect columns</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-4 flex-1 overflow-hidden">
                                                    {/* Output A Column */}
                                                    <div 
                                                        className="flex-1 flex flex-col"
                                                        onDragOver={handleDragOver}
                                                        onDrop={handleDropOnOutputA}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                                                                <span className="text-xs font-medium text-[var(--text-primary)]">Output A</span>
                                                                <span className="text-xs text-[var(--text-secondary)]">({splitColumnsOutputA.length} cols)</span>
                                                            </div>
                                                            <button
                                                                onClick={moveAllToA}
                                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                                                            >
                                                                Move all here
                                                            </button>
                                                        </div>
                                                        <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputA.includes(draggedColumn) ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] bg-[var(--bg-card)]'}`}>
                                                            {splitColumnsOutputA.length === 0 ? (
                                                                <div className="text-center py-8 text-[var(--text-tertiary)] text-xs">
                                                                    Drop columns here
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {splitColumnsOutputA.map(column => (
                                                                        <div
                                                                            key={column}
                                                                            draggable
                                                                            onDragStart={() => handleDragStart(column)}
                                                                            onDragEnd={handleDragEnd}
                                                                            className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-light)] cursor-grab group"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <GripVertical size={12} className="text-[var(--text-tertiary)]" />
                                                                                <span className="text-xs font-medium text-[var(--text-primary)]">{column}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => moveColumnToB(column)}
                                                                                className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity"
                                                                            >
                                                                                → B
                                                                                </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Output B Column */}
                                                    <div 
                                                        className="flex-1 flex flex-col"
                                                        onDragOver={handleDragOver}
                                                        onDrop={handleDropOnOutputB}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                                                                <span className="text-xs font-medium text-[var(--text-primary)]">Output B</span>
                                                                <span className="text-xs text-[var(--text-secondary)]">({splitColumnsOutputB.length} cols)</span>
                                                            </div>
                                                            <button
                                                                onClick={moveAllToB}
                                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                                                            >
                                                                Move all here
                                                            </button>
                                                        </div>
                                                        <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputB.includes(draggedColumn) ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] bg-[var(--bg-card)]'}`}>
                                                            {splitColumnsOutputB.length === 0 ? (
                                                                <div className="text-center py-8 text-[var(--text-tertiary)] text-xs">
                                                                    Drop columns here
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {splitColumnsOutputB.map(column => (
                                                                        <div
                                                                            key={column}
                                                                            draggable
                                                                            onDragStart={() => handleDragStart(column)}
                                                                            onDragEnd={handleDragEnd}
                                                                            className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-light)] cursor-grab group"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <GripVertical size={12} className="text-[var(--text-tertiary)]" />
                                                                                <span className="text-xs font-medium text-[var(--text-primary)]">{column}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => moveColumnToA(column)}
                                                                                className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity"
                                                                            >
                                                                                ← A
                                                                                </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                                                    <p className="text-xs text-[var(--text-secondary)]">
                                                        <span className="font-medium">Tip:</span> Drag columns between outputs, or use the arrow buttons. Each row will be split into two datasets with the selected columns.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                </NodeConfigSidePanel>
                            );
                        })()}

                        {/* Excel Input Configuration Side Panel */}
                        {configuringExcelNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringExcelNodeId}
                                onClose={closeExcelConfig}
                                title="Excel/CSV Input"
                                icon={FileSpreadsheet}
                                width="w-[400px]"
                            >
                                <div className="space-y-5">
                                    {/* File Upload Area */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Upload File
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={handleExcelFileChange}
                                                className="hidden"
                                                id="excel-file-input"
                                                disabled={isParsingExcel}
                                            />
                                            <label
                                                htmlFor="excel-file-input"
                                                className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                                                    isParsingExcel 
                                                        ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)] cursor-wait'
                                                        : 'border-[var(--border-medium)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                }`}
                                            >
                                                {isParsingExcel ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-xs text-[var(--text-secondary)]">Parsing file...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="text-[var(--text-secondary)]" size={18} />
                                                        <div className="text-center">
                                                            <span className="text-xs text-[var(--text-primary)] font-medium">Click to upload</span>
                                                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">CSV, XLS, XLSX supported</p>
                                                        </div>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    {excelPreviewData && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-xs font-medium text-[var(--text-primary)]">
                                                    Preview
                                                </label>
                                                <span className="text-[10px] text-[var(--text-secondary)]">
                                                    {excelPreviewData.rowCount} total rows • {excelPreviewData.headers.length} columns
                                                </span>
                                            </div>
                                            <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
                                                <div className="overflow-x-auto max-h-48">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                                                            <tr>
                                                                {excelPreviewData.headers.map((header, i) => (
                                                                    <th key={i} className="px-2 py-1.5 text-left font-medium text-[var(--text-primary)] whitespace-nowrap text-xs">
                                                                        {header}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {excelPreviewData.data.map((row, i) => (
                                                                <tr key={i} className="hover:bg-[var(--bg-tertiary)]">
                                                                    {excelPreviewData.headers.map((header, j) => (
                                                                        <td key={j} className="px-2 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate text-xs">
                                                                            {row[header] || '-'}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {excelPreviewData.rowCount > 5 && (
                                                    <div className="px-3 py-1.5 border-t border-[var(--border-light)] text-[10px] text-[var(--text-secondary)] text-center">
                                                        Showing first 5 of {excelPreviewData.rowCount} rows
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Current File Info */}
                                    {nodes.find(n => n.id === configuringExcelNodeId)?.config?.fileName && !excelFile && (
                                        <div className="p-3 border border-[var(--border-light)] rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="text-[var(--text-secondary)]" size={14} />
                                                <span className="text-xs font-medium text-[var(--text-primary)]">
                                                    {nodes.find(n => n.id === configuringExcelNodeId)?.config?.fileName}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                {nodes.find(n => n.id === configuringExcelNodeId)?.config?.rowCount} rows loaded
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* PDF Input Configuration Modal */}
                        {configuringPdfNodeId && (
                            <NodeConfigSidePanel
                                isOpen={!!configuringPdfNodeId}
                                onClose={closePdfConfig}
                                title="PDF Input"
                                icon={FileText}
                                footer={
                                    <button
                                        onClick={closePdfConfig}
                                        disabled={!pdfFile && !nodes.find(n => n.id === configuringPdfNodeId)?.config?.fileName}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Done
                                    </button>
                                }
                            >
                                <div className="space-y-5">
                                    {/* File Upload Area */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Upload PDF File
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handlePdfFileChange}
                                                className="hidden"
                                                id="pdf-file-input"
                                                disabled={isParsingPdf}
                                            />
                                            <label
                                                htmlFor="pdf-file-input"
                                                className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                                                    isParsingPdf 
                                                        ? 'bg-[var(--bg-tertiary)] border-[var(--border-medium)] cursor-wait'
                                                        : 'border-[var(--border-medium)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                                }`}
                                            >
                                                {isParsingPdf ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-xs text-[var(--text-secondary)]">Parsing PDF...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="text-[var(--text-secondary)]" size={18} />
                                                        <div className="text-center">
                                                            <span className="text-xs text-[var(--text-primary)] font-medium">Click to upload</span>
                                                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">PDF files supported</p>
                                                        </div>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    {pdfPreviewData && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-xs font-medium text-[var(--text-primary)]">
                                                    Extracted Text Preview
                                                </label>
                                                <span className="text-[10px] text-[var(--text-secondary)]">
                                                    {pdfPreviewData.pages} pages
                                                </span>
                                            </div>
                                            <div className="border border-[var(--border-light)] rounded-lg p-3 max-h-64 overflow-y-auto">
                                                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
                                                    {pdfPreviewData.text.substring(0, 1000)}
                                                    {pdfPreviewData.text.length > 1000 && '\n\n... (text truncated for preview)'}
                                                </pre>
                                            </div>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                                                Full text ({pdfPreviewData.text.length} characters) will be available to the workflow
                                            </p>
                                        </div>
                                    )}

                                    {/* Current File Info */}
                                    {nodes.find(n => n.id === configuringPdfNodeId)?.config?.fileName && !pdfFile && (
                                        <div className="p-3 border border-[var(--border-light)] rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <FileText className="text-[var(--text-secondary)]" size={14} />
                                                <span className="text-xs font-medium text-[var(--text-primary)]">
                                                    {nodes.find(n => n.id === configuringPdfNodeId)?.config?.fileName}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                {nodes.find(n => n.id === configuringPdfNodeId)?.config?.pages} pages • {nodes.find(n => n.id === configuringPdfNodeId)?.config?.pdfText?.length || 0} characters
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </NodeConfigSidePanel>
                        )}

                        {/* Save Records Configuration Modal */}
                        {configuringSaveNodeId && (
                            <NodeConfigSidePanel
                                    isOpen={!!configuringSaveNodeId}
                                onClose={() => setConfiguringSaveNodeId(null)}
                                title="Save to Database"
                                icon={Database}
                                footer={
                                    <>
                                        <button
                                            onClick={() => setConfiguringSaveNodeId(null)}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveSaveRecordsConfig}
                                            disabled={!saveEntityId}
                                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Select Entity
                                        </label>
                                        <select
                                            value={saveEntityId}
                                            onChange={(e) => setSaveEntityId(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="">Choose entity...</option>
                                            {entities.map(entity => (
                                                <option key={entity.id} value={entity.id}>{entity.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </NodeConfigSidePanel>
                        )}
                    </div>

                    {/* LLM Config Modal */}
                    {configuringLLMNodeId && (
                        <NodeConfigSidePanel
                            isOpen={!!configuringLLMNodeId}
                            onClose={() => setConfiguringLLMNodeId(null)}
                            title="Configure AI Generation"
                            icon={Sparkles}
                            width="w-[500px]"
                            footer={
                                <>
                                    <button
                                        onClick={() => setConfiguringLLMNodeId(null)}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveLLMConfig}
                                        disabled={!llmPrompt.trim()}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Prompt
                                        </label>
                                        <div className="h-48">
                                            <PromptInput
                                                entities={entities}
                                                onGenerate={() => { }} // Not used here
                                                isGenerating={false}
                                                initialValue={llmPrompt}
                                                placeholder="Ask a question... Use @ to mention entities or Input Data."
                                                hideButton={true}
                                                onChange={(val, ids) => {
                                                    setLlmPrompt(val);
                                                    setLlmContextEntities(ids);
                                                    // Auto-enable include input if @Input Data is mentioned
                                                    if (val.includes('@Input Data')) {
                                                        setLlmIncludeInput(true);
                                                    }
                                                }}
                                                className="h-full"
                                                inputData={(() => {
                                                    // Get input data from parent node
                                                    const parentConnection = connections.find(c => c.toNodeId === configuringLLMNodeId);
                                                    if (parentConnection) {
                                                        const parentNode = nodes.find(n => n.id === parentConnection.fromNodeId);
                                                        // Handle splitColumns parent node
                                                        if (parentNode?.type === 'splitColumns' && parentNode.outputData) {
                                                            return parentConnection.outputType === 'B' 
                                                                ? parentNode.outputData.outputB || []
                                                                : parentNode.outputData.outputA || [];
                                                        }
                                                        return parentNode?.outputData || parentNode?.data || [];
                                                    }
                                                    return [];
                                                })()}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="checkbox"
                                            id="includeInput"
                                            checked={llmIncludeInput}
                                            onChange={(e) => setLlmIncludeInput(e.target.checked)}
                                            className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="includeInput" className="text-sm text-[var(--text-primary)] cursor-pointer">
                                            Include Input Data (from previous node)
                                        </label>
                                    </div>

                                    {/* Processing Mode */}
                                    <div className="pt-3 border-t border-[var(--border-light)]">
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                            Processing Mode
                                        </label>
                                        <div className="space-y-2">
                                            <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'batch' ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                <input
                                                    type="radio"
                                                    name="llmProcessingMode"
                                                    value="batch"
                                                    checked={llmProcessingMode === 'batch'}
                                                    onChange={() => setLlmProcessingMode('batch')}
                                                    className="mt-0.5 mr-3"
                                                />
                                                <div>
                                                    <span className="font-medium text-sm">Batch (all rows)</span>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                        Send all data in one AI call → single result
                                                    </p>
                                                </div>
                                            </label>
                                            <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'perRow' ? 'border-violet-500 bg-violet-50' : 'border-[var(--border-light)] hover:border-[var(--border-medium)]'}`}>
                                                <input
                                                    type="radio"
                                                    name="llmProcessingMode"
                                                    value="perRow"
                                                    checked={llmProcessingMode === 'perRow'}
                                                    onChange={() => setLlmProcessingMode('perRow')}
                                                    className="mt-0.5 mr-3"
                                                />
                                                <div>
                                                    <span className="font-medium text-sm">Per Row</span>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                        Call AI for each row → adds <code className="bg-[var(--bg-tertiary)] px-1 rounded">ai_result</code> field.
                                                        Use <code className="bg-[var(--bg-tertiary)] px-1 rounded">{'{field}'}</code> in prompt for row values.
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback Link */}
                                <div className="pt-3 border-t border-[var(--border-light)]">
                                    <button
                                        onClick={() => openFeedbackPopup('llm', 'LLM / AI Generate')}
                                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                    >
                                        <MessageSquare size={12} />
                                        What would you like this node to do?
                                    </button>
                                </div>
                        </NodeConfigSidePanel>
                    )}

                    {/* Python Config Modal */}
                    {configuringPythonNodeId && (
                        <NodeConfigSidePanel
                            isOpen={!!configuringPythonNodeId}
                            onClose={() => setConfiguringPythonNodeId(null)}
                            title="Configure Python Code"
                            icon={Code}
                            width="w-[600px]"
                            footer={
                                <>
                                    <button
                                        onClick={() => setConfiguringPythonNodeId(null)}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={savePythonConfig}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-5">
                                    {/* AI Debug Suggestion - shown when debugging */}
                                    {(isDebuggingPython || debugSuggestion) && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Bug size={16} className="text-amber-600" />
                                                <span className="text-sm font-medium text-amber-800">AI Debug Assistant</span>
                                            </div>
                                            {isDebuggingPython ? (
                                                <div className="flex items-center gap-2 text-sm text-amber-700">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent" />
                                                    Analyzing error and generating fix...
                                                </div>
                                            ) : debugSuggestion ? (
                                                <div className="space-y-3">
                                                    <p className="text-xs text-amber-700">
                                                        AI has analyzed the error and suggests a fix. Review and apply if it looks correct.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setPythonCode(debugSuggestion);
                                                                setDebugSuggestion(null);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700 transition-colors"
                                                        >
                                                            <Check size={14} />
                                                            Apply Fix
                                                        </button>
                                                        <button
                                                            onClick={() => setDebugSuggestion(null)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-50 transition-colors"
                                                        >
                                                            <X size={14} />
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                    {/* Preview of the fix */}
                                                    <details className="mt-2">
                                                        <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-800">
                                                            Preview suggested code
                                                        </summary>
                                                        <pre className="mt-2 p-2 bg-slate-800 text-slate-100 text-xs rounded overflow-x-auto max-h-40">
                                                            {debugSuggestion}
                                                        </pre>
                                                    </details>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* AI Assistant Section */}
                                    <AIPromptSection
                                        label="Ask AI to write code"
                                        placeholder="e.g., Filter records where price > 100"
                                        value={pythonAiPrompt}
                                        onChange={setPythonAiPrompt}
                                        onGenerate={generatePythonCode}
                                        isGenerating={isGeneratingCode}
                                        generatingText="Generating..."
                                        icon={Sparkles}
                                        buttonText="Generate"
                                    />

                                    {/* Code Editor */}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Python Code
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={pythonCode}
                                                onChange={(e) => setPythonCode(e.target.value)}
                                                className="w-full px-4 py-3 bg-[var(--bg-selected)] text-slate-50 font-mono text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-64 resize-none"
                                                spellCheck={false}
                                            />
                                            <div className="absolute top-2 right-2 text-xs text-[var(--text-secondary)] bg-slate-800 px-2 py-1 rounded">
                                                Python 3
                                            </div>
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                                            Function must be named <code>process(data)</code> and return a list.
                                        </p>
                                    </div>
                                </div>

                                {/* Feedback Link */}
                                <div className="pt-3 border-t border-[var(--border-light)]">
                                    <button
                                        onClick={() => openFeedbackPopup('python', 'Python Code')}
                                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                                    >
                                        <MessageSquare size={12} />
                                        What would you like this node to do?
                                    </button>
                                </div>
                        </NodeConfigSidePanel>
                    )}

                    {/* Manual Input Config Modal */}
                    {configuringManualInputNodeId && (
                        <NodeConfigSidePanel
                            isOpen={!!configuringManualInputNodeId}
                            onClose={() => setConfiguringManualInputNodeId(null)}
                            title="Configure Manual Data Input"
                            icon={Edit}
                            footer={
                                <>
                                    <button
                                        onClick={() => setConfiguringManualInputNodeId(null)}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveManualInputConfig}
                                        disabled={!manualInputVarName.trim()}
                                        className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Variable Name
                                        </label>
                                        <input
                                            type="text"
                                            value={manualInputVarName}
                                            onChange={(e) => setManualInputVarName(e.target.value)}
                                            placeholder="e.g., temperature, count, status"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                            Value
                                        </label>
                                        <input
                                            type="text"
                                            value={manualInputVarValue}
                                            onChange={(e) => setManualInputVarValue(e.target.value)}
                                            placeholder="e.g., 25, Active, Hello World"
                                            className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                                            Numbers will be parsed automatically.
                                        </p>
                                    </div>
                                </div>
                        </NodeConfigSidePanel>
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
            {showExecutionHistory && (
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none" onClick={() => setShowExecutionHistory(false)}>
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 text-white rounded-t-xl shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <History size={24} />
                                    <div>
                                        <h3 className="font-normal text-lg">Execution History</h3>
                                        <p className="text-teal-200 text-sm">View past workflow executions and their results</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowExecutionHistory(false)} className="text-white/80 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex">
                            {/* Executions List */}
                            <div className="w-1/3 border-r border-[var(--border-light)] overflow-y-auto">
                                <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                                    <button
                                        onClick={loadExecutionHistory}
                                        className="w-full px-3 py-2 bg-teal-100 text-[#1e554f] rounded-lg text-sm font-medium hover:bg-teal-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {loadingExecutions ? (
                                            <div className="w-4 h-4 border-2 border-[#256A65] border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <History size={14} />
                                        )}
                                        Refresh
                                    </button>
                                </div>
                                {loadingExecutions ? (
                                    <div className="p-8 text-center text-[var(--text-secondary)]">
                                        <div className="w-8 h-8 border-2 border-[#256A65] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Loading...
                                    </div>
                                ) : executionHistory.length === 0 ? (
                                    <div className="p-8 text-center text-[var(--text-secondary)]">
                                        <History size={32} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                                        <p>No executions yet</p>
                                        <p className="text-xs mt-1">Run the workflow or send a webhook to see executions here</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {executionHistory.map((exec) => (
                                            <button
                                                key={exec.id}
                                                onClick={() => setSelectedExecution(exec)}
                                                className={`w-full p-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors ${selectedExecution?.id === exec.id ? 'bg-[#256A65]/5 border-l-2 border-[#256A65]' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                        exec.status === 'completed' ? 'bg-[#256A65]/10 text-[#1e554f]' :
                                                        exec.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        exec.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                                    }`}>
                                                        {exec.status}
                                                    </span>
                                                    {exec.triggerType && (
                                                        <span className="text-xs text-[var(--text-tertiary)]">{exec.triggerType}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)]">{formatDate(exec.createdAt)}</p>
                                                <p className="text-xs text-[var(--text-tertiary)] font-mono truncate">{exec.id}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Execution Details */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {selectedExecution ? (
                                    <div className="space-y-4">
                                        <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                                            <h4 className="font-normal text-[var(--text-primary)] mb-2">Execution Details</h4>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-[var(--text-secondary)]">Status:</span>
                                                    <span className={`ml-2 font-medium ${
                                                        selectedExecution.status === 'completed' ? 'text-[#256A65]' :
                                                        selectedExecution.status === 'failed' ? 'text-red-600' :
                                                        'text-[var(--text-secondary)]'
                                                    }`}>{selectedExecution.status}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--text-secondary)]">Trigger:</span>
                                                    <span className="ml-2 font-medium text-[var(--text-primary)]">{selectedExecution.triggerType || 'manual'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--text-secondary)]">Started:</span>
                                                    <span className="ml-2 text-[var(--text-primary)]">{formatDate(selectedExecution.startedAt)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--text-secondary)]">Completed:</span>
                                                    <span className="ml-2 text-[var(--text-primary)]">{formatDate(selectedExecution.completedAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedExecution.inputs && Object.keys(selectedExecution.inputs).length > 0 && (
                                            <div className="bg-blue-500/10 rounded-lg p-4">
                                                <h4 className="font-normal text-blue-500 mb-2 flex items-center gap-2">
                                                    <ArrowRight size={16} />
                                                    Inputs
                                                </h4>
                                                <pre className="text-xs bg-[var(--bg-card)] p-3 rounded border border-blue-100 overflow-x-auto max-h-40">
                                                    {JSON.stringify(selectedExecution.inputs, null, 2)}
                                                </pre>
                                            </div>
                                        )}

                                        {selectedExecution.nodeResults && Object.keys(selectedExecution.nodeResults).length > 0 && (
                                            <div className="bg-[#256A65]/5 rounded-lg p-4">
                                                <h4 className="font-normal text-[#1e554f] mb-2 flex items-center gap-2">
                                                    <CheckCircle size={16} />
                                                    Node Results
                                                </h4>
                                                <div className="space-y-2">
                                                    {Object.entries(selectedExecution.nodeResults).map(([nodeId, result]: [string, any]) => {
                                                        const node = nodes.find(n => n.id === nodeId);
                                                        // Try to get node label from multiple sources
                                                        const nodeLabel = node?.label || result.nodeLabel || result.label || `Node ${nodeId.substring(0, 8)}`;
                                                        const nodeType = node?.type || result.nodeType || '';
                                                        
                                                        return (
                                                            <div key={nodeId} className="bg-[var(--bg-card)] p-3 rounded border border-[#256A65]/20">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-medium text-[var(--text-primary)]">{nodeLabel}</span>
                                                                    {nodeType && <span className="text-xs text-[var(--text-tertiary)]">({nodeType})</span>}
                                                                    {result.success && <Check size={14} className="text-[#256A65]" />}
                                                                </div>
                                                                {result.message && (
                                                                    <p className="text-xs text-[var(--text-secondary)] mb-1">{result.message}</p>
                                                                )}
                                                                {result.outputData && (
                                                                    <pre className="text-xs bg-[var(--bg-tertiary)] p-2 rounded overflow-x-auto max-h-32">
                                                                        {JSON.stringify(result.outputData, null, 2)}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {selectedExecution.error && (
                                            <div className="bg-red-50 rounded-lg p-4">
                                                <h4 className="font-normal text-red-800 mb-2 flex items-center gap-2">
                                                    <XCircle size={16} />
                                                    Error
                                                </h4>
                                                <pre className="text-xs bg-[var(--bg-card)] p-3 rounded border border-red-100 text-red-600 overflow-x-auto">
                                                    {selectedExecution.error}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
                                        <div className="text-center">
                                            <Eye size={48} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
                                            <p>Select an execution to view details</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Node Feedback Popup */}
            {feedbackPopupNodeId && (
                <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 bg-black/40 backdrop-blur-sm pointer-events-none" onClick={closeFeedbackPopup}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                                    <MessageSquare size={18} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                        Share Your Feedback
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Node: {feedbackPopupNodeLabel}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    What would you like this node to do?
                                </label>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="Describe the functionality you'd like to see, any improvements, or share your ideas..."
                                    rows={4}
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                    autoFocus
                                />
                                <p className="text-xs text-[var(--text-secondary)] mt-2">
                                    Your feedback helps us improve the platform. Thank you!
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-2 justify-end">
                            <button
                                onClick={closeFeedbackPopup}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitFeedback}
                                disabled={!feedbackText.trim() || isSubmittingFeedback}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingFeedback ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    'Submit Feedback'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Confirmation Modal */}
            {showExitConfirmation && (
                <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none" onClick={() => setShowExitConfirmation(false)}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                                    <AlertCircle size={20} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Unsaved Changes</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Do you want to save your workflow before leaving?</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 flex gap-2 justify-end">
                            <button
                                onClick={() => setShowExitConfirmation(false)}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmExitWithoutSaving}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Don't Save
                            </button>
                            <button
                                onClick={confirmExitWithSaving}
                                disabled={isSaving}
                                className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        Save & Exit
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Templates Modal - Enhanced */}
            {showTemplatesModal && !previewingTemplate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !isCopyingTemplate && setShowTemplatesModal(false)}>
                    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--border-light)] shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#256A65] to-[#84C4D1] flex items-center justify-center">
                                        <BookOpen size={24} className="text-white" weight="light" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-medium text-[var(--text-primary)]">Template Gallery</h3>
                                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">Start with a pre-built workflow and customize it</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowTemplatesModal(false)}
                                    disabled={isCopyingTemplate}
                                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <X size={20} weight="light" />
                                </button>
                            </div>
                        </div>

                        {/* Category Filter with Icons */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)] shrink-0 bg-[var(--bg-tertiary)]/30">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {[
                                    { name: 'All', icon: <Workflow size={14} weight="light" />, color: 'from-slate-500 to-slate-600' },
                                    { name: 'Compliance', icon: <Shield size={14} weight="light" />, color: 'from-blue-500 to-blue-600' },
                                    { name: 'Process Optimization', icon: <Zap size={14} weight="light" />, color: 'from-amber-500 to-orange-500' },
                                    { name: 'Planning', icon: <Calendar size={14} weight="light" />, color: 'from-purple-500 to-purple-600' },
                                    { name: 'Reporting', icon: <BarChart3 size={14} weight="light" />, color: 'from-emerald-500 to-teal-500' },
                                    { name: 'Quality Assurance', icon: <CheckCircle size={14} weight="light" />, color: 'from-rose-500 to-pink-500' }
                                ].map(({ name, icon, color }) => (
                                    <button
                                        key={name}
                                        onClick={() => setSelectedTemplateCategory(name)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                            selectedTemplateCategory === name
                                                ? `bg-gradient-to-r ${color} text-white shadow-md`
                                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {icon}
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Templates Grid */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTemplates.map(template => {
                                    const categoryColors: { [key: string]: string } = {
                                        'Compliance': 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
                                        'Process Optimization': 'from-amber-500/10 to-orange-500/5 border-amber-500/20',
                                        'Planning': 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
                                        'Reporting': 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20',
                                        'Quality Assurance': 'from-rose-500/10 to-pink-500/5 border-rose-500/20'
                                    };
                                    const categoryTextColors: { [key: string]: string } = {
                                        'Compliance': 'text-blue-600',
                                        'Process Optimization': 'text-amber-600',
                                        'Planning': 'text-purple-600',
                                        'Reporting': 'text-emerald-600',
                                        'Quality Assurance': 'text-rose-600'
                                    };
                                    return (
                                        <div
                                            key={template.id}
                                            className={`bg-gradient-to-br ${categoryColors[template.category] || 'from-slate-500/10 to-slate-600/5 border-slate-500/20'} border rounded-xl p-4 group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                                            onClick={() => setPreviewingTemplate(template)}
                                        >
                                            {/* Category badge */}
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`text-[10px] font-medium uppercase tracking-wider ${categoryTextColors[template.category] || 'text-slate-600'}`}>
                                                    {template.category}
                                                </span>
                                                <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                                    {template.nodes.length} nodes
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 line-clamp-2 min-h-[40px]">
                                                {template.name}
                                            </h4>
                                            
                                            {/* Description */}
                                            <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 min-h-[32px]">
                                                {template.description}
                                            </p>

                                            {/* Visual workflow preview */}
                                            <div className="bg-[var(--bg-card)]/60 backdrop-blur-sm rounded-lg p-2.5 mb-3 border border-[var(--border-light)]">
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {template.nodes.slice(0, 5).map((node, idx) => (
                                                        <React.Fragment key={idx}>
                                                            <div className="flex-shrink-0 w-6 h-6 rounded bg-[var(--bg-tertiary)] border border-[var(--border-light)] flex items-center justify-center" title={node.label}>
                                                                <Workflow size={10} className="text-[var(--text-tertiary)]" weight="light" />
                                                            </div>
                                                            {idx < Math.min(template.nodes.length - 1, 4) && (
                                                                <ArrowRight size={10} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                    {template.nodes.length > 5 && (
                                                        <span className="text-[10px] text-[var(--text-tertiary)] ml-1">+{template.nodes.length - 5}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewingTemplate(template);
                                                    }}
                                                    className="flex-1 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Eye size={14} weight="light" />
                                                    Preview
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyTemplateToWorkflows(template);
                                                    }}
                                                    disabled={isCopyingTemplate}
                                                    className="flex-1 py-2 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                                                >
                                                    {isCopyingTemplate ? (
                                                        <>
                                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            Copying...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={14} weight="light" />
                                                            Use Template
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredTemplates.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
                                        <BookOpen size={32} className="text-[var(--text-tertiary)]" weight="light" />
                                    </div>
                                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">No templates found</h3>
                                    <p className="text-sm text-[var(--text-secondary)]">Try selecting a different category</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0 bg-[var(--bg-tertiary)]/30">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Showing {filteredTemplates.length} of {WORKFLOW_TEMPLATES.length} templates
                                </p>
                                <button
                                    onClick={() => setShowTemplatesModal(false)}
                                    disabled={isCopyingTemplate}
                                    className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Preview Modal */}
            {previewingTemplate && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewingTemplate(null)}>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--border-light)] shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                                        <Eye size={20} className="text-[var(--text-secondary)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Template Preview</h3>
                                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{previewingTemplate.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Preview Canvas */}
                        <div className="overflow-hidden bg-[var(--bg-tertiary)] relative border-b border-[var(--border-light)]" style={{ height: '400px' }}>
                            <div 
                                className="absolute inset-0 overflow-auto pt-4 px-8 pb-8 custom-scrollbar"
                                style={{
                                    backgroundImage: `
                                        linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                                        linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                                    `,
                                    backgroundSize: '20px 20px'
                                }}
                            >
                                {/* SVG Connections - offset by padding */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '900px', minHeight: '400px' }}>
                                    {previewingTemplate.connections.map(conn => {
                                        const fromNode = previewingTemplate.nodes.find(n => n.id === conn.fromNodeId);
                                        const toNode = previewingTemplate.nodes.find(n => n.id === conn.toNodeId);
                                        if (!fromNode || !toNode) return null;
                                        
                                        // Reduced padding for better node visibility
                                        const padding = 16;
                                        const nodeHeight = 52; // Approximate node height
                                        const nodeWidth = 140;
                                        
                                        const startX = fromNode.x + nodeWidth + padding;
                                        const startY = fromNode.y + (nodeHeight / 2) + padding;
                                        const endX = toNode.x + padding;
                                        const endY = toNode.y + (nodeHeight / 2) + padding;
                                        const midX = (startX + endX) / 2;
                                        
                                        // Color based on connection type
                                        let strokeColor = '#cbd5e1';
                                        if (conn.outputType === 'true') strokeColor = '#22c55e';
                                        if (conn.outputType === 'false') strokeColor = '#ef4444';
                                        
                                        return (
                                            <g key={conn.id}>
                                                <path
                                                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                                                    stroke={strokeColor}
                                                    strokeWidth="2.5"
                                                    fill="none"
                                                    strokeDasharray="5 4"
                                                />
                                                <circle cx={endX} cy={endY} r="4" fill={strokeColor} />
                                            </g>
                                        );
                                    })}
                                </svg>

                                {/* Nodes */}
                                <div className="relative" style={{ minWidth: '900px', minHeight: '400px' }}>
                                    {previewingTemplate.nodes.map(node => {
                                        const IconComponent = getNodeIcon(node.type);
                                        const iconBg = getNodeIconBg(node.type);
                                        
                                        return (
                                            <div
                                                key={node.id}
                                                className="absolute bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-sm p-3 w-[140px] hover:shadow-md transition-shadow"
                                                style={{ left: node.x, top: node.y }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">
                                                        <IconComponent size={14} className={iconBg} />
                                                    </div>
                                                    <span className="text-xs font-normal text-[var(--text-primary)] truncate flex-1" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                                        {node.label}
                                                    </span>
                                                </div>
                                                {node.type === 'condition' && (
                                                    <div className="flex gap-1 mt-2">
                                                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">TRUE</span>
                                                        <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium">FALSE</span>
                                                    </div>
                                                )}
                                                {node.type === 'comment' && node.config?.commentText && (
                                                    <p className="text-[10px] text-[var(--text-secondary)] mt-2 line-clamp-2">
                                                        {node.config.commentText}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Template Info */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h4 className="text-base font-normal text-[var(--text-primary)] mb-1" style={{ fontFamily: "'Berkeley Mono', monospace" }}>{previewingTemplate.name}</h4>
                                    <p className="text-sm text-[var(--text-secondary)]">{previewingTemplate.description}</p>
                                </div>
                                <span className="px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs rounded ml-4 flex-shrink-0">
                                    {previewingTemplate.category}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                    {previewingTemplate.nodes.length} nodes
                                </span>
                                <span className="text-[var(--text-tertiary)]">•</span>
                                <span className="flex items-center gap-1.5">
                                    <ArrowRight size={12} className="text-[var(--text-tertiary)]" weight="light" />
                                    {previewingTemplate.connections.length} connections
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] shrink-0">
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => {
                                        copyTemplateToWorkflows(previewingTemplate);
                                        setPreviewingTemplate(null);
                                    }}
                                    disabled={isCopyingTemplate}
                                    className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                                >
                                    {isCopyingTemplate ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Copying...
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} weight="light" />
                                            Use This Template
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Connect Component Search Modal */}
            {showComponentSearch && connectingFromNodeId && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => {
                    setShowComponentSearch(false);
                    setConnectingFromNodeId(null);
                    setComponentSearchQuery('');
                }}>
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--border-light)] bg-gradient-to-r from-[#256A65]/5 to-transparent">
                            <h3 className="text-base font-normal text-[var(--text-primary)]">Connect Component</h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Search and select a component to connect</p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} weight="light" />
                                <input
                                    type="text"
                                    value={componentSearchQuery}
                                    onChange={(e) => setComponentSearchQuery(e.target.value)}
                                    placeholder="Search components..."
                                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-medium)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Components List */}
                        <div className="px-6 py-4 max-h-96 overflow-y-auto">
                            {DRAGGABLE_ITEMS
                                .filter(item => 
                                    item.type !== 'trigger' && // Don't show triggers (can't connect after trigger)
                                    item.type !== 'comment' && // Don't show comments
                                    (componentSearchQuery === '' || 
                                     item.label.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
                                     item.description.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
                                     item.category.toLowerCase().includes(componentSearchQuery.toLowerCase()))
                                )
                                .map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.type}
                                            onClick={() => handleQuickConnect(item.type)}
                                            className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:border-[#256A65] hover:bg-[#256A65]/5 transition-all text-left mb-2 group"
                                        >
                                            <div className="p-1.5 rounded-lg flex-shrink-0">
                                                <Icon size={14} className={getNodeIconBg(item.type)} weight="light" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-normal text-sm text-[var(--text-primary)] group-hover:text-[#256A65] transition-colors">
                                                    {item.label}
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                    {item.description}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
                                                    {item.category}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            {DRAGGABLE_ITEMS.filter(item => 
                                item.type !== 'trigger' && 
                                item.type !== 'comment' &&
                                (componentSearchQuery === '' || 
                                 item.label.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
                                 item.description.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
                                 item.category.toLowerCase().includes(componentSearchQuery.toLowerCase()))
                            ).length === 0 && (
                                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
                                    No components found
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end">
                            <button
                                onClick={() => {
                                    setShowComponentSearch(false);
                                    setConnectingFromNodeId(null);
                                    setComponentSearchQuery('');
                                }}
                                className="px-4 py-2 border border-[var(--border-medium)] rounded-lg hover:bg-[var(--bg-tertiary)] text-sm font-medium text-[var(--text-primary)] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tags Modal */}
            {showTagsModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowTagsModal(false)}>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[var(--border-light)]">
                            <h3 className="text-lg font-normal text-[var(--text-primary)] flex items-center gap-2">
                                <Tag size={20} className="text-[var(--text-secondary)]" weight="light" />
                                Manage Tags
                            </h3>
                        </div>
                        <div className="px-6 py-4">
                            {/* Current Tags */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Current Tags</label>
                                {workflowTags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {workflowTags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)]"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => {
                                                        setWorkflowTags(workflowTags.filter((_, i) => i !== idx));
                                                    }}
                                                    className="ml-1 hover:text-red-600 transition-colors"
                                                >
                                                    <X size={14} weight="light" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--text-secondary)]">No tags added yet</p>
                                )}
                            </div>

                            {/* Add New Tag */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Add Tag</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newTagInput.trim()) {
                                                e.preventDefault();
                                                if (!workflowTags.includes(newTagInput.trim())) {
                                                    setWorkflowTags([...workflowTags, newTagInput.trim()]);
                                                    setNewTagInput('');
                                                }
                                            }
                                        }}
                                        placeholder="Enter tag name..."
                                        className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newTagInput.trim() && !workflowTags.includes(newTagInput.trim())) {
                                                setWorkflowTags([...workflowTags, newTagInput.trim()]);
                                                setNewTagInput('');
                                            }
                                        }}
                                        className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowTagsModal(false);
                                    setNewTagInput('');
                                }}
                                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    // Save tags when closing modal
                                    if (currentWorkflowId) {
                                        try {
                                            const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ 
                                                    name: workflowName, 
                                                    data: { nodes, connections },
                                                    tags: workflowTags,
                                                    lastEditedByName: user?.name || user?.email?.split('@')[0] || 'Unknown'
                                                }),
                                                credentials: 'include'
                                            });
                                            if (res.ok) {
                                                await fetchWorkflows();
                                                showToast('Tags updated successfully!', 'success');
                                            }
                                        } catch (error) {
                                            console.error('Error saving tags:', error);
                                        }
                                    }
                                    setShowTagsModal(false);
                                    setNewTagInput('');
                                }}
                                className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Upgrade Modal */}
            {showScheduleUpgradeModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowScheduleUpgradeModal(false); setShowScheduleContactInfo(false); }}>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl p-6 w-[400px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-medium text-[var(--text-primary)]">
                                Schedule Workflows
                            </h3>
                            <button
                                onClick={() => { setShowScheduleUpgradeModal(false); setShowScheduleContactInfo(false); }}
                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
                            </button>
                        </div>

                        <div className="py-4 text-center">
                            <h4 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                                Upgrade to create schedules for workflows
                            </h4>
                            <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-sm mx-auto">
                                Automate your workflows by scheduling them to run at specific times or intervals with our Business or Enterprise plan.
                            </p>
                            <div className="flex flex-col gap-3 items-center">
                                <button
                                    onClick={() => setShowScheduleContactInfo(true)}
                                    className="px-6 py-2.5 bg-[#2D3748] hover:bg-[#1A202C] text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg"
                                >
                                    Contact Sales
                                </button>
                                <button
                                    onClick={() => { setShowScheduleUpgradeModal(false); setShowScheduleContactInfo(false); }}
                                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                            
                            {/* Contact Info Popup */}
                            {showScheduleContactInfo && (
                                <div className="mt-4 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-left">
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Write us at <a href="mailto:info@intemic.com" className="text-[#419CAF] hover:underline font-medium">info@intemic.com</a> about your requirements and we will provide a personalized proposal.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};