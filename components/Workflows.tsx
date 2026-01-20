
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Workflow, Zap, Play, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, X, Save, FolderOpen, Trash2, PlayCircle, Check, XCircle, Database, Wrench, Search, ChevronsLeft, ChevronsRight, Sparkles, Code, Edit, LogOut, MessageSquare, Globe, Leaf, Share2, UserCheck, GitMerge, FileSpreadsheet, FileText, Upload, Columns, GripVertical, Users, Mail, BookOpen, Copy, Eye, Clock, History, Maximize2, ZoomIn, ZoomOut, Bot, Smartphone, BarChart3, User, Calendar, ChevronRight, ChevronDown, ChevronUp, Plus, Folder, Shield, Terminal } from 'lucide-react';
import { NodeConfigSidePanel } from './NodeConfigSidePanel';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { PromptInput } from './PromptInput';
import { ProfileMenu, UserAvatar } from './ProfileMenu';
import { AIPromptSection } from './AIPromptSection';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useCollaborativeCursors } from '../hooks/useCollaborativeCursors';

// Generate UUID that works in non-HTTPS contexts
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for HTTP contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface WorkflowNode {
    id: string;
    type: 'trigger' | 'action' | 'condition' | 'fetchData' | 'addField' | 'saveRecords' | 'llm' | 'python' | 'manualInput' | 'output' | 'comment' | 'http' | 'esios' | 'climatiq' | 'humanApproval' | 'join' | 'excelInput' | 'pdfInput' | 'splitColumns' | 'mysql' | 'sendEmail' | 'sendSMS' | 'dataVisualization' | 'webhook';
    label: string;
    x: number;
    y: number;
    status?: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
    config?: {
        entityId?: string;
        entityName?: string;
        // For condition nodes:
        conditionField?: string;
        conditionOperator?: string;
        conditionValue?: string;
        recordId?: string;
        recordName?: string;
        llmPrompt?: string;
        llmContextEntities?: string[];
        llmIncludeInput?: boolean;
        pythonCode?: string;
        pythonAiPrompt?: string;
        // For manual input nodes:
        inputVarName?: string;
        inputVarValue?: string;
        // For comment nodes:
        commentText?: string;
        // For http nodes:
        httpUrl?: string;
        // For esios nodes:
        esiosArchiveId?: string;
        esiosDate?: string;
        // For climatiq nodes:
        climatiqQuery?: string;
        climatiqFactor?: number;
        climatiqUnit?: string;
        climatiqDescription?: string;
        // For human approval nodes:
        assignedUserId?: string;
        assignedUserName?: string;
        assignedUserPhoto?: string;
        approvalStatus?: 'pending' | 'approved' | 'rejected';
        // For join nodes:
        joinStrategy?: 'concat' | 'mergeByKey';
        joinType?: 'inner' | 'outer';  // inner = only matching, outer = all records
        joinKey?: string;
        // For excel input nodes:
        fileName?: string;
        headers?: string[];
        parsedData?: any[];
        previewData?: any[];  // Preview for GCS-stored data
        rowCount?: number;
        gcsPath?: string;     // GCS path for cloud-stored data
        useGCS?: boolean;     // Whether data is stored in GCS
        // For PDF input nodes:
        pdfText?: string;
        pages?: number;
        info?: any;
        metadata?: any;
        // Processing mode (for condition, llm, etc.)
        processingMode?: 'batch' | 'perRow';  // batch = all rows together, perRow = filter/process each row
        // For split columns nodes:
        columnsOutputA?: string[];  // Columns to send to output A
        columnsOutputB?: string[];  // Columns to send to output B
        // For MySQL nodes:
        mysqlHost?: string;
        mysqlPort?: string;
        mysqlDatabase?: string;
        mysqlUsername?: string;
        mysqlPassword?: string;
        mysqlQuery?: string;
        // For Send Email nodes:
        emailTo?: string;
        emailSubject?: string;
        emailBody?: string;
        emailSmtpHost?: string;
        emailSmtpPort?: string;
        emailSmtpUser?: string;
        emailSmtpPass?: string;
        // For Send SMS nodes:
        smsTo?: string;
        smsBody?: string;
        twilioAccountSid?: string;
        twilioAuthToken?: string;
        twilioFromNumber?: string;
        // For Data Visualization nodes:
        visualizationPrompt?: string;
        generatedWidget?: WidgetConfig;
        // For SAP Fetch nodes:
        sapConnectionName?: string;
        sapAuthType?: string;
        sapClientId?: string;
        sapClientSecret?: string;
        sapTokenUrl?: string;
        sapBaseApiUrl?: string;
        sapServicePath?: string;
        sapEntity?: string;
        // Custom node name
        customName?: string;
    };
    executionResult?: string;
    data?: any;
    inputData?: any;
    inputDataA?: any;  // For join nodes - input from port A
    inputDataB?: any;  // For join nodes - input from port B
    outputData?: any;
    conditionResult?: boolean;  // Store evaluation result
}

interface Connection {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    outputType?: 'true' | 'false' | 'A' | 'B';  // For condition nodes (true/false) and splitColumns nodes (A/B)
    inputPort?: 'A' | 'B';  // For join nodes
}

interface DraggableItem {
    type: 'trigger' | 'action' | 'condition' | 'fetchData' | 'addField' | 'saveRecords' | 'llm' | 'python' | 'manualInput' | 'output' | 'comment' | 'http' | 'esios' | 'climatiq' | 'humanApproval' | 'join' | 'excelInput' | 'pdfInput' | 'splitColumns' | 'mysql' | 'sendEmail' | 'sendSMS' | 'dataVisualization' | 'webhook' | 'sapFetch';
    label: string;
    icon: React.ElementType;
    description: string;
    category: 'Triggers' | 'Data' | 'Logic' | 'Actions' | 'Other';
}

const DRAGGABLE_ITEMS: DraggableItem[] = [
    { type: 'trigger', label: 'Manual Trigger', icon: Play, description: 'Manually start the workflow', category: 'Triggers' },
    { type: 'trigger', label: 'Schedule', icon: Workflow, description: 'Run on a specific schedule', category: 'Triggers' },
    { type: 'webhook', label: 'Webhook', icon: Globe, description: 'Receive data from external services', category: 'Triggers' },
    { type: 'fetchData', label: 'Fetch Data', icon: Database, description: 'Get records from an entity', category: 'Data' },
    { type: 'excelInput', label: 'Excel/CSV Input', icon: FileSpreadsheet, description: 'Load data from Excel or CSV', category: 'Data' },
    { type: 'pdfInput', label: 'PDF Input', icon: FileText, description: 'Extract text from PDF files', category: 'Data' },
    { type: 'saveRecords', label: 'Save to Database', icon: Database, description: 'Create or update records', category: 'Data' },
    { type: 'http', label: 'HTTP Request', icon: Globe, description: 'Fetch data from an external API', category: 'Data' },
    { type: 'mysql', label: 'MySQL', icon: Database, description: 'Query data from MySQL database', category: 'Data' },
    { type: 'sapFetch', label: 'SAP S/4HANA', icon: Database, description: 'Read data from SAP S/4HANA OData API', category: 'Data' },
    { type: 'esios', label: 'Energy Prices', icon: Zap, description: 'Fetch prices from Red Eléctrica', category: 'Data' },
    { type: 'climatiq', label: 'Emission Factors', icon: Leaf, description: 'Search CO2 emission factors', category: 'Data' },
    { type: 'manualInput', label: 'Manual Data Input', icon: Edit, description: 'Define a variable with a value', category: 'Data' },
    { type: 'condition', label: 'If / Else', icon: AlertCircle, description: 'Branch based on conditions', category: 'Logic' },
    { type: 'join', label: 'Join', icon: GitMerge, description: 'Combine data from two sources', category: 'Logic' },
    { type: 'splitColumns', label: 'Split by Columns', icon: Columns, description: 'Split dataset by columns into two outputs', category: 'Logic' },
    { type: 'llm', label: 'AI Generation', icon: Sparkles, description: 'Generate text using AI', category: 'Logic' },
    { type: 'python', label: 'Python Code', icon: Code, description: 'Run Python script', category: 'Logic' },
    { type: 'addField', label: 'Add Field', icon: CheckCircle, description: 'Add a new field to data', category: 'Logic' },
    { type: 'humanApproval', label: 'Human in the Loop', icon: UserCheck, description: 'Wait for user approval to continue', category: 'Logic' },
    { type: 'sendEmail', label: 'Send Email', icon: Mail, description: 'Send an email notification', category: 'Actions' },
    { type: 'sendSMS', label: 'Send SMS', icon: Smartphone, description: 'Send an SMS text message via Twilio', category: 'Actions' },
    { type: 'dataVisualization', label: 'Data Visualization', icon: BarChart3, description: 'Generate charts from data using AI', category: 'Actions' },
    { type: 'action', label: 'Update Record', icon: CheckCircle, description: 'Modify existing records', category: 'Actions' },
    { type: 'output', label: 'Output', icon: LogOut, description: 'Display workflow output data', category: 'Actions' },
    { type: 'comment', label: 'Comment', icon: MessageSquare, description: 'Add a note or comment', category: 'Other' },
];

// AI Workflow Assistant interfaces
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


// Pre-defined workflow templates
interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'Compliance' | 'Process Optimization' | 'Planning' | 'Reporting' | 'Quality Assurance';
    nodes: WorkflowNode[];
    connections: Connection[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'template-data-filtering',
        name: 'Advanced control and monitorization of a chemical process',
        description: 'Read equipment sensor data, and calculate process and product quality metrics to ensure compliance with specifications and improve efficiency.',
        category: 'Process Optimization',
        nodes: [
            { id: 't1-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't1-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't1-condition', type: 'condition', label: 'Filter Records', x: 500, y: 200, config: { conditionField: 'status', conditionOperator: 'equals', conditionValue: 'active', processingMode: 'perRow' } },
            { id: 't1-output', type: 'output', label: 'Output Results', x: 700, y: 150 },
            { id: 't1-comment', type: 'comment', label: 'Comment', x: 500, y: 350, config: { commentText: 'This workflow filters records and outputs only those matching the condition.' } },
        ],
        connections: [
            { id: 'c1-1', fromNodeId: 't1-trigger', toNodeId: 't1-fetch' },
            { id: 'c1-2', fromNodeId: 't1-fetch', toNodeId: 't1-condition' },
            { id: 'c1-3', fromNodeId: 't1-condition', toNodeId: 't1-output', outputType: 'true' },
        ]
    },
    {
        id: 'template-ai-enrichment',
        name: 'Automated data collection for quality reporting in wineries',
        description: 'Centralization of climate, laboratory, production and storage data for automated reporting to regulatory authorities, clients and stakeholders.',
        category: 'Reporting',
        nodes: [
            { id: 't2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't2-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't2-llm', type: 'llm', label: 'AI Analysis', x: 500, y: 200, config: { llmPrompt: 'Analyze this data and provide insights:', llmIncludeInput: true } },
            { id: 't2-add-field', type: 'addField', label: 'Add Insights Field', x: 700, y: 200 },
            { id: 't2-save', type: 'saveRecords', label: 'Save Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c2-1', fromNodeId: 't2-trigger', toNodeId: 't2-fetch' },
            { id: 'c2-2', fromNodeId: 't2-fetch', toNodeId: 't2-llm' },
            { id: 'c2-3', fromNodeId: 't2-llm', toNodeId: 't2-add-field' },
            { id: 'c2-4', fromNodeId: 't2-add-field', toNodeId: 't2-save' },
        ]
    },
    {
        id: 'template-ai-enrichment-32',
        name: 'Scope 3 emissions automated reporting',
        description: 'Automated collection of supplier and customer data for scope 3 emissions calculation and reporting.',
        category: 'Reporting',
        nodes: [
            { id: 't2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't2-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't2-llm', type: 'llm', label: 'AI Analysis', x: 500, y: 200, config: { llmPrompt: 'Analyze this data and provide insights:', llmIncludeInput: true } },
            { id: 't2-add-field', type: 'addField', label: 'Add Insights Field', x: 700, y: 200 },
            { id: 't2-save', type: 'saveRecords', label: 'Save Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c2-1', fromNodeId: 't2-trigger', toNodeId: 't2-fetch' },
            { id: 'c2-2', fromNodeId: 't2-fetch', toNodeId: 't2-llm' },
            { id: 'c2-3', fromNodeId: 't2-llm', toNodeId: 't2-add-field' },
            { id: 'c2-4', fromNodeId: 't2-add-field', toNodeId: 't2-save' },
        ]
    },
    {
        id: 'template-ai-enrichment-4',
        name: 'Renewable energy assets portfolio management and reporting',
        description: 'Automated collection of climate, asset performance & maintenance data for reporting to renewable energy asset owners and stakeholders.',
        category: 'Reporting',
        nodes: [
            { id: 't2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't2-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't2-llm', type: 'llm', label: 'AI Analysis', x: 500, y: 200, config: { llmPrompt: 'Analyze this data and provide insights:', llmIncludeInput: true } },
            { id: 't2-add-field', type: 'addField', label: 'Add Insights Field', x: 700, y: 200 },
            { id: 't2-save', type: 'saveRecords', label: 'Save Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c2-1', fromNodeId: 't2-trigger', toNodeId: 't2-fetch' },
            { id: 'c2-2', fromNodeId: 't2-fetch', toNodeId: 't2-llm' },
            { id: 'c2-3', fromNodeId: 't2-llm', toNodeId: 't2-add-field' },
            { id: 'c2-4', fromNodeId: 't2-add-field', toNodeId: 't2-save' },
        ]
    },
    {
        id: 'template-ai-enrichment-2',
        name: 'Predictive maintenance planning Agent',
        description: 'Read equipment specs and documentation, sensor data and current maintenance scheduling information to provide insights, alerts and recommendations of improved plannings, as well as its estimated saving costs.',
        category: 'Planning',
        nodes: [
            { id: 't2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't2-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't2-llm', type: 'llm', label: 'AI Analysis', x: 500, y: 200, config: { llmPrompt: 'Analyze this data and provide insights:', llmIncludeInput: true } },
            { id: 't2-add-field', type: 'addField', label: 'Add Insights Field', x: 700, y: 200 },
            { id: 't2-save', type: 'saveRecords', label: 'Save Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c2-1', fromNodeId: 't2-trigger', toNodeId: 't2-fetch' },
            { id: 'c2-2', fromNodeId: 't2-fetch', toNodeId: 't2-llm' },
            { id: 'c2-3', fromNodeId: 't2-llm', toNodeId: 't2-add-field' },
            { id: 'c2-4', fromNodeId: 't2-add-field', toNodeId: 't2-save' },
        ]
    },
    {
        id: 'template-ai-enrichment-3',
        name: 'Overall equipment effectiveness (OEE) calculation',
        description: 'Read production data, equipment availability and maintenance records to calculate the Overall Equipment Effectiveness (OEE) of a manufacturing process and provide it in a dashboard.',
        category: 'Planning',
        nodes: [
            { id: 't2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't2-fetch', type: 'fetchData', label: 'Fetch Data', x: 300, y: 200 },
            { id: 't2-llm', type: 'llm', label: 'AI Analysis', x: 500, y: 200, config: { llmPrompt: 'Analyze this data and provide insights:', llmIncludeInput: true } },
            { id: 't2-add-field', type: 'addField', label: 'Add Insights Field', x: 700, y: 200 },
            { id: 't2-save', type: 'saveRecords', label: 'Save Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c2-1', fromNodeId: 't2-trigger', toNodeId: 't2-fetch' },
            { id: 'c2-2', fromNodeId: 't2-fetch', toNodeId: 't2-llm' },
            { id: 'c2-3', fromNodeId: 't2-llm', toNodeId: 't2-add-field' },
            { id: 'c2-4', fromNodeId: 't2-add-field', toNodeId: 't2-save' },
        ]
    },
    
    {
        id: 'template-approval-flow',
        name: 'Good Manufacturing Practices (GMP) report',
        description: 'Read auditor observations, manufacturing process data, and products information to generate a GMP report and its CAPAs (Corrective and Preventive Actions).',
        category: 'Compliance',
        nodes: [
            { id: 't3-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't3-input', type: 'manualInput', label: 'Request Details', x: 300, y: 200, config: { inputVarName: 'request', inputVarValue: '' } },
            { id: 't3-approval', type: 'humanApproval', label: 'Manager Approval', x: 500, y: 200 },
            { id: 't3-approved', type: 'output', label: 'Approved Output', x: 700, y: 100 },
            { id: 't3-rejected', type: 'output', label: 'Rejected Output', x: 700, y: 300 },
        ],
        connections: [
            { id: 'c3-1', fromNodeId: 't3-trigger', toNodeId: 't3-input' },
            { id: 'c3-2', fromNodeId: 't3-input', toNodeId: 't3-approval' },
            { id: 'c3-3', fromNodeId: 't3-approval', toNodeId: 't3-approved', outputType: 'true' },
            { id: 'c3-4', fromNodeId: 't3-approval', toNodeId: 't3-rejected', outputType: 'false' },
        ]
    },
    {
        id: 'template-approval-flow-2',
        name: 'Regulatory compliance reporting',
        description: 'Read regulations, reporting request, and automate the reporting of assets and activities to ensure compliance with regulations and standards.',
        category: 'Compliance',
        nodes: [
            { id: 't3-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't3-input', type: 'manualInput', label: 'Request Details', x: 300, y: 200, config: { inputVarName: 'request', inputVarValue: '' } },
            { id: 't3-approval', type: 'humanApproval', label: 'Manager Approval', x: 500, y: 200 },
            { id: 't3-approved', type: 'output', label: 'Approved Output', x: 700, y: 100 },
            { id: 't3-rejected', type: 'output', label: 'Rejected Output', x: 700, y: 300 },
        ],
        connections: [
            { id: 'c3-1', fromNodeId: 't3-trigger', toNodeId: 't3-input' },
            { id: 'c3-2', fromNodeId: 't3-input', toNodeId: 't3-approval' },
            { id: 'c3-3', fromNodeId: 't3-approval', toNodeId: 't3-approved', outputType: 'true' },
            { id: 'c3-4', fromNodeId: 't3-approval', toNodeId: 't3-rejected', outputType: 'false' },
        ]
    },
    {
        id: 'template-data-merge',
        name: 'What-if scenario analysis for production optimization',
        description: 'Combine data from two different sources into a unified dataset.',
        category: 'Process Optimization',
        nodes: [
            { id: 't4-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 250 },
            { id: 't4-fetch1', type: 'fetchData', label: 'Source A', x: 300, y: 150 },
            { id: 't4-fetch2', type: 'fetchData', label: 'Source B', x: 300, y: 350 },
            { id: 't4-join', type: 'join', label: 'Merge Data', x: 550, y: 250, config: { joinStrategy: 'concat' } },
            { id: 't4-output', type: 'output', label: 'Combined Output', x: 750, y: 250 },
        ],
        connections: [
            { id: 'c4-1', fromNodeId: 't4-trigger', toNodeId: 't4-fetch1' },
            { id: 'c4-2', fromNodeId: 't4-trigger', toNodeId: 't4-fetch2' },
            { id: 'c4-3', fromNodeId: 't4-fetch1', toNodeId: 't4-join', inputPort: 'A' },
            { id: 'c4-4', fromNodeId: 't4-fetch2', toNodeId: 't4-join', inputPort: 'B' },
            { id: 'c4-5', fromNodeId: 't4-join', toNodeId: 't4-output' },
        ]
    },
    {
        id: 'template-api-integration',
        name: 'Energy costs reduction Agent',
        description: 'Personalized recommendations for reducing energy costs while maintaining the same quality of products and services.',
        category: 'Process Optimization',
        nodes: [
            { id: 't5-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't5-http', type: 'http', label: 'API Request', x: 300, y: 200, config: { httpUrl: 'https://api.example.com/data' } },
            { id: 't5-python', type: 'python', label: 'Transform Data', x: 500, y: 200, config: { pythonCode: '# Transform the API response\nresult = input_data' } },
            { id: 't5-save', type: 'saveRecords', label: 'Save to DB', x: 700, y: 200 },
            { id: 't5-output', type: 'output', label: 'Show Results', x: 900, y: 200 },
        ],
        connections: [
            { id: 'c5-1', fromNodeId: 't5-trigger', toNodeId: 't5-http' },
            { id: 'c5-2', fromNodeId: 't5-http', toNodeId: 't5-python' },
            { id: 'c5-3', fromNodeId: 't5-python', toNodeId: 't5-save' },
            { id: 'c5-4', fromNodeId: 't5-save', toNodeId: 't5-output' },
        ]
    },
    {
        id: 'template-email-notification',
        name: 'Real-time plastic quality prediction',
        description: 'Usage of manufacturing sensor data to calculate plastic properties every 5 minutes to ensure the quality control and send alerts when deviations occur.',
        category: 'Quality Assurance',
        nodes: [
            { id: 't6-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't6-fetch', type: 'fetchData', label: 'Fetch Records', x: 300, y: 200 },
            { id: 't6-condition', type: 'condition', label: 'Check Condition', x: 500, y: 200, config: { processingMode: 'batch' } },
            { id: 't6-email', type: 'sendEmail', label: 'Send Alert', x: 700, y: 100 },
            { id: 't6-output', type: 'output', label: 'Log Status', x: 700, y: 300 },
        ],
        connections: [
            { id: 'c6-1', fromNodeId: 't6-trigger', toNodeId: 't6-fetch' },
            { id: 'c6-2', fromNodeId: 't6-fetch', toNodeId: 't6-condition' },
            { id: 'c6-3', fromNodeId: 't6-condition', toNodeId: 't6-email', outputType: 'true' },
            { id: 'c6-4', fromNodeId: 't6-condition', toNodeId: 't6-output', outputType: 'false' },
        ]
    },
    {
        id: 'template-email-notification-2',
        name: 'Pharmaceutical batch release validation',
        description: 'Automated analysis of production process data and batch record documentation to approve or reject the release of a pharmaceutical products ensuring compliance with regulations and standards.',
        category: 'Quality Assurance',
        nodes: [
            { id: 't6-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't6-fetch', type: 'fetchData', label: 'Fetch Records', x: 300, y: 200 },
            { id: 't6-condition', type: 'condition', label: 'Check Condition', x: 500, y: 200, config: { processingMode: 'batch' } },
            { id: 't6-email', type: 'sendEmail', label: 'Send Alert', x: 700, y: 100 },
            { id: 't6-output', type: 'output', label: 'Log Status', x: 700, y: 300 },
        ],
        connections: [
            { id: 'c6-1', fromNodeId: 't6-trigger', toNodeId: 't6-fetch' },
            { id: 'c6-2', fromNodeId: 't6-fetch', toNodeId: 't6-condition' },
            { id: 'c6-3', fromNodeId: 't6-condition', toNodeId: 't6-email', outputType: 'true' },
            { id: 'c6-4', fromNodeId: 't6-condition', toNodeId: 't6-output', outputType: 'false' },
        ]
    },
    {
        id: 'template-email-notification-3',
        name: 'Classification of deviations and feedbacks for prioritization',
        description: 'Automated collection and analysis of reclamations and feedbacks to classify them into categories and prioritize them for further action.',
        category: 'Quality Assurance',
        nodes: [
            { id: 't6-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
            { id: 't6-fetch', type: 'fetchData', label: 'Fetch Records', x: 300, y: 200 },
            { id: 't6-condition', type: 'condition', label: 'Check Condition', x: 500, y: 200, config: { processingMode: 'batch' } },
            { id: 't6-email', type: 'sendEmail', label: 'Send Alert', x: 700, y: 100 },
            { id: 't6-output', type: 'output', label: 'Log Status', x: 700, y: 300 },
        ],
        connections: [
            { id: 'c6-1', fromNodeId: 't6-trigger', toNodeId: 't6-fetch' },
            { id: 'c6-2', fromNodeId: 't6-fetch', toNodeId: 't6-condition' },
            { id: 'c6-3', fromNodeId: 't6-condition', toNodeId: 't6-email', outputType: 'true' },
            { id: 'c6-4', fromNodeId: 't6-condition', toNodeId: 't6-output', outputType: 'false' },
        ]
    },
];

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
    const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [viewingDataNodeId, setViewingDataNodeId] = useState<string | null>(null);
    const [configuringConditionNodeId, setConfiguringConditionNodeId] = useState<string | null>(null);
    const [conditionField, setConditionField] = useState<string>('');
    const [conditionOperator, setConditionOperator] = useState<string>('isText');
    const [conditionValue, setConditionValue] = useState<string>('');
    const [conditionProcessingMode, setConditionProcessingMode] = useState<'batch' | 'perRow'>('batch');
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

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
        setTimeout(() => setToast(null), 3000);
    };

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
            
            const newNodes = template.nodes.map(node => {
                const newId = generateUUID();
                idMapping[node.id] = newId;
                return {
                    ...node,
                    id: newId,
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
            if (!res.ok) throw new Error('Failed to load workflow');
            const workflow = await res.json();
            setWorkflowName(workflow.name);
            setCurrentWorkflowId(workflow.id);
            setNodes(workflow.data.nodes || []);
            setConnections(workflow.data.connections || []);
            lastLoadedWorkflowIdRef.current = workflow.id;
            // Update URL to reflect the loaded workflow
            if (updateUrl) {
                navigate(`/workflow/${workflow.id}`, { replace: true });
            }
        } catch (error) {
            console.error('Error loading workflow:', error);
        }
    };

    const saveWorkflow = async () => {
        if (!workflowName.trim()) {
            alert('Please enter a workflow name');
            return;
        }

        setIsSaving(true);
        try {
            const data = { nodes, connections };

            if (currentWorkflowId) {
                // Update existing
                const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: workflowName, 
                        data,
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
        
        console.log('[Workflows] URL sync - pathname:', location.pathname, 'isListView:', isListView, 'isNewWorkflow:', isNewWorkflow, 'isWorkflowView:', isWorkflowView);
        
        if (isListView) {
            // On /workflows, show list view and clear current workflow
            console.log('[Workflows] Switching to list view');
            setCurrentView('list');
            setCurrentWorkflowId(null);
            setNodes([]);
            setConnections([]);
            setWorkflowName('Untitled Workflow');
            lastLoadedWorkflowIdRef.current = null;
        } else if (isNewWorkflow) {
            // On /workflow/new, show canvas with empty workflow
            console.log('[Workflows] New workflow - showing canvas');
            setCurrentView('canvas');
            setCurrentWorkflowId(null);
            setNodes([]);
            setConnections([]);
            setWorkflowName('Untitled Workflow');
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
        }
    };

    const saveNodeConfig = () => {
        if (!configuringNodeId || !selectedEntityId) return;

        const entity = entities.find(e => e.id === selectedEntityId);
        setNodes(prev => prev.map(n =>
            n.id === configuringNodeId
                ? { ...n, config: { entityId: selectedEntityId, entityName: entity?.name || '' } }
                : n
        ));
        setConfiguringNodeId(null);
        setSelectedEntityId('');
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
            setConditionOperator(node.config?.conditionOperator || 'isText');
            setConditionValue(node.config?.conditionValue || '');
            setConditionProcessingMode(node.config?.processingMode || 'batch');
        }
    };

    const saveConditionConfig = () => {
        if (!configuringConditionNodeId || !conditionField) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringConditionNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        conditionField,
                        conditionOperator,
                        conditionValue,
                        processingMode: conditionProcessingMode
                    }
                }
                : n
        ));
        setConfiguringConditionNodeId(null);
        setConditionField('');
        setConditionOperator('isText');
        setConditionValue('');
        setConditionProcessingMode('batch');
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
        }
    };

    const saveSaveRecordsConfig = () => {
        if (!configuringSaveNodeId || !saveEntityId) return;

        const entity = entities.find(e => e.id === saveEntityId);
        setNodes(prev => prev.map(n =>
            n.id === configuringSaveNodeId
                ? { ...n, config: { entityId: saveEntityId, entityName: entity?.name || '' } }
                : n
        ));
        setConfiguringSaveNodeId(null);
        setSaveEntityId('');
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
        }
    };

    const saveLLMConfig = () => {
        if (!configuringLLMNodeId) return;

        setNodes(prev => prev.map(n =>
            n.id === configuringLLMNodeId
                ? {
                    ...n,
                    config: {
                        ...n.config,
                        llmPrompt,
                        llmContextEntities,
                        llmIncludeInput,
                        processingMode: llmProcessingMode
                    }
                }
                : n
        ));
        setConfiguringLLMNodeId(null);
        setLlmPrompt('');
        setLlmContextEntities([]);
        setLlmIncludeInput(true);
        setLlmProcessingMode('batch');
    };

    const openPythonConfig = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setPythonCode(node.config?.pythonCode || 'def process(data):\n    # Modify data here\n    return data');
            setPythonAiPrompt(node.config?.pythonAiPrompt || '');
            setConfiguringPythonNodeId(nodeId);
        }
    };

    const savePythonConfig = () => {
        if (configuringPythonNodeId) {
            setNodes(nodes.map(n => n.id === configuringPythonNodeId ? {
                ...n,
                config: { ...n.config, pythonCode, pythonAiPrompt }
            } : n));
            setConfiguringPythonNodeId(null);
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
                    // Evaluate condition
                    if (node.config?.conditionField && node.config?.conditionOperator) {
                        const dataToEval = inputData;
                        const processingMode = node.config.processingMode || 'batch';

                        if (dataToEval && Array.isArray(dataToEval) && dataToEval.length > 0) {
                            const evaluateRecord = (record: any): boolean => {
                                const fieldValue = record[node.config!.conditionField!];
                                switch (node.config!.conditionOperator) {
                                    case 'isText': return typeof fieldValue === 'string';
                                    case 'isNumber': return !isNaN(Number(fieldValue));
                                    case 'equals': return String(fieldValue) === node.config!.conditionValue;
                                    case 'notEquals': return String(fieldValue) !== node.config!.conditionValue;
                                    case 'contains': return String(fieldValue).includes(node.config!.conditionValue || '');
                                    case 'greaterThan': return Number(fieldValue) > Number(node.config!.conditionValue);
                                    case 'lessThan': return Number(fieldValue) < Number(node.config!.conditionValue);
                                    default: return false;
                                }
                            };

                            if (processingMode === 'perRow') {
                                // Per-row mode: filter data into TRUE and FALSE outputs
                                const trueRecords = dataToEval.filter(record => evaluateRecord(record));
                                const falseRecords = dataToEval.filter(record => !evaluateRecord(record));
                                
                                // Store both filtered arrays for routing
                                nodeData = { trueRecords, falseRecords };
                                conditionResult = trueRecords.length > 0; // For visual indication
                                result = `Filtered: ${trueRecords.length} TRUE, ${falseRecords.length} FALSE`;
                            } else {
                                // Batch mode: evaluate first record, route ALL data
                                const condResult = evaluateRecord(dataToEval[0]);
                                nodeData = dataToEval;
                                conditionResult = condResult;
                                result = `${node.config.conditionField} ${node.config.conditionOperator} → ${condResult ? '✓ All to TRUE' : '✗ All to FALSE'}`;
                            }
                        } else {
                            result = 'No data to evaluate';
                        }
                    } else {
                        result = 'Not configured';
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
                                nodeData = data.result;
                                result = 'Python code executed successfully';
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Python execution failed');
                            }
                        } catch (error) {
                            console.error('Python execution error:', error);
                            result = `Error: ${error.message || 'Failed to execute'}`;
                            nodeData = [{ error: error.message }];
                        }
                    } else {
                        result = 'Code not configured';
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

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        
        if (!canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        // Mouse position relative to the canvas element
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate the point in canvas coordinates that's under the mouse
        const worldX = (mouseX - canvasOffset.x) / canvasZoom;
        const worldY = (mouseY - canvasOffset.y) / canvasZoom;
        
        // Calculate new zoom level
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(canvasZoom * delta, 0.25), 3);
        
        // Calculate new offset to keep the same point under the mouse
        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;
        
        setCanvasZoom(newZoom);
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    };

    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [nodeDragged, setNodeDragged] = useState<boolean>(false);

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

            // Calculate new position in canvas coordinates
            const x = (e.clientX - canvasRect.left - canvasOffset.x) / canvasZoom;
            const y = (e.clientY - canvasRect.top - canvasOffset.y) / canvasZoom;

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
        // Reset nodeDragged after a small delay to allow onClick to check it
        setTimeout(() => setNodeDragged(false), 10);
        // Clear connection drag if dropped on canvas (not on a valid connector)
        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        if (e.button === 0) { // Left click only
            e.stopPropagation(); // Prevent canvas panning
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
        
        // Send node add to other users
        sendNodeAdd(newNode);
    };

    const removeNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        // Also remove connections involving this node
        setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
        
        // Send node delete to other users
        sendNodeDelete(id);
    };

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

        // Create connection
        const newConnection: Connection = {
            id: generateUUID(),
            fromNodeId: connectingFromNodeId,
            toNodeId: newNode.id
        };
        setConnections(prev => [...prev, newConnection]);
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
            
            // Send connection add to other users
            sendConnectionAdd(newConnection);
        }

        setDragConnectionStart(null);
        setDragConnectionCurrent(null);
    };

    const getNodeColor = (type: string, status?: string) => {
        if (status === 'running') return 'bg-white border border-yellow-400/60 text-slate-900 shadow-sm';
        if (status === 'completed') return 'bg-white border border-[#256A65]/60 text-slate-900 shadow-sm';
        if (status === 'error') return 'bg-white border border-red-400/60 text-slate-900 shadow-sm';
        if (status === 'waiting') return 'bg-white border border-orange-400/60 text-slate-900 shadow-sm';

        // Idle/not executed nodes are white
        if (type === 'comment') return 'bg-amber-50 border border-amber-300/60 text-amber-900';
        return 'bg-white border border-slate-300 text-slate-700';
    };

    // Get icon for node type (matches sidebar icons)
    const getNodeIcon = (type: string): React.ElementType => {
        const item = DRAGGABLE_ITEMS.find(i => i.type === type);
        return item?.icon || Workflow;
    };

    // Get icon background color for node type
    const getNodeIconBg = (type: string) => {
        switch (type) {
            case 'trigger': return 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border border-cyan-200';
            case 'action': return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-200';
            case 'condition': return 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border border-slate-200';
            case 'fetchData': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'humanApproval': return 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 border border-sky-200';
            case 'addField': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'saveRecords': return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-200';
            case 'llm': return 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border border-slate-200';
            case 'python': return 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 border border-sky-200';
            case 'manualInput': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'output': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'http': return 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border border-cyan-200';
            case 'mysql': return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-200';
            case 'sapFetch': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'esios': return 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border border-cyan-200';
            case 'climatiq': return 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 border border-sky-200';
            case 'join': return 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border border-cyan-200';
            case 'splitColumns': return 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 border border-sky-200';
            case 'excelInput': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'pdfInput': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'sendEmail': return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-200';
            case 'sendSMS': return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-200';
            case 'dataVisualization': return 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200';
            case 'webhook': return 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border border-cyan-200';
            default: return 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border border-slate-200';
        }
    };

    const filteredItems = DRAGGABLE_ITEMS.filter(item => {
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Filter workflows for search
    const filteredWorkflows = savedWorkflows.filter(wf =>
        wf.name.toLowerCase().includes(workflowSearchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col bg-slate-50" data-tutorial="workflows-content" style={{ height: '100%', maxHeight: '100vh', overflow: 'hidden' }}>
            {currentView === 'list' ? (
                /* Workflows List View */
                <>
                    {/* Top Header */}
                    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                        <div>
                            <h1 className="text-lg font-normal text-slate-900">Workflows</h1>
                            <p className="text-[11px] text-slate-500">Manage and execute your automation workflows</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <ProfileMenu onNavigate={onViewChange} />
                        </div>
                    </header>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search workflows..."
                                        value={workflowSearchQuery}
                                        onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-60 placeholder:text-slate-400"
                                    />
                                </div>
                                <p className="text-sm text-slate-500">
                                    {filteredWorkflows.length} {filteredWorkflows.length === 1 ? 'workflow' : 'workflows'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowTemplatesModal(true)}
                                    className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <BookOpen size={14} className="mr-2" />
                                    Open Templates
                                </button>
                                <button
                                    onClick={createNewWorkflow}
                                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                >
                                    <Workflow size={14} className="mr-2" />
                                    Create Workflow
                                </button>
                            </div>
                        </div>

                    {/* Workflows Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                        {filteredWorkflows.map((workflow) => (
                            <div
                                key={workflow.id}
                                onClick={() => openWorkflow(workflow.id)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px]"
                            >
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-2.5 bg-slate-50 rounded-lg flex-shrink-0 group-hover:bg-slate-100 transition-colors">
                                                <Workflow size={18} className="text-slate-600" />
                                            </div>
                                            <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-700 transition-colors truncate flex-1">
                                                {workflow.name}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteWorkflow(workflow.id);
                                            }}
                                            className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="space-y-2 mt-5 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <User size={12} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-slate-600">{workflow.createdByName || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Calendar size={12} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-slate-600">{workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}</span>
                                        </div>
                                        {workflow.updatedAt && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Clock size={12} className="text-slate-400 flex-shrink-0" />
                                                <span className="text-slate-600">
                                                    Edited {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}
                                                    {workflow.lastEditedByName && (
                                                        <span className="text-slate-400"> by {workflow.lastEditedByName}</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-slate-600">Open workflow</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Create New Card */}
                        <div
                            data-tutorial="create-workflow"
                            onClick={createNewWorkflow}
                            className="border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center min-h-[200px] text-slate-400 cursor-pointer group"
                        >
                            <div className="p-4 bg-slate-100 rounded-full mb-3">
                                <Workflow size={24} />
                            </div>
                            <span className="font-medium">Create new workflow</span>
                        </div>

                        {filteredWorkflows.length === 0 && workflowSearchQuery !== '' && (
                            <div className="col-span-full text-center py-12 text-slate-500">
                                No workflows found matching "{workflowSearchQuery}"
                            </div>
                        )}
                    </div>
                    </div>
                </>
            ) : (
                /* Canvas View */
                <div data-tutorial="workflow-editor" className="flex flex-col min-h-0 overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
                    {/* Top Bar */}
                    <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm z-20 shrink-0">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                                onClick={backToList}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium text-slate-600 flex-shrink-0"
                            >
                                <ArrowLeft size={18} />
                                Back
                            </button>
                            <div className="h-6 w-px bg-slate-300 flex-shrink-0"></div>
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="text-lg font-normal text-slate-700 bg-transparent border-none focus:outline-none flex-1 min-w-0"
                                placeholder="Workflow Name"
                            />
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={saveWorkflow}
                                disabled={isSaving}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Save"
                            >
                                {isSaving ? <span className="animate-spin">⟳</span> : <Save size={18} className="text-slate-600" />}
                            </button>
                            <button
                                onClick={openExecutionHistory}
                                disabled={!currentWorkflowId}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                title="History"
                            >
                                <History size={18} className="text-slate-600" />
                            </button>
                            <button
                                onClick={runWorkflow}
                                disabled={isRunning || nodes.length === 0}
                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                            >
                                <Play size={16} />
                                {isRunning ? 'Running...' : 'Run'}
                            </button>
                            <button
                                onClick={openWorkflowRunner}
                                disabled={nodes.length === 0}
                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                            >
                                <Share2 size={16} />
                                Export
                            </button>
                            <div className="h-6 w-px bg-slate-300 mx-2"></div>
                            <ProfileMenu onNavigate={onViewChange} />
                        </div>
                    </div>

                    {/* Content Area (Sidebar + Canvas) */}
                    <div ref={contentAreaRef} className="flex flex-1 min-h-0 overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
                    {/* Sidebar */}
                    <div ref={sidebarRef} data-tutorial="node-palette" className={`${isSidebarCollapsed ? 'w-14' : 'w-64'} bg-slate-50 border-r border-slate-200 flex flex-col shadow-sm z-10 transition-all duration-300 overflow-hidden`} style={{ height: '100%', maxHeight: '100%' }}>

                        {!isSidebarCollapsed ? (
                            <>
                                <div className="p-4 border-b border-slate-200 bg-white shrink-0">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-sm font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Components</h2>
                                        <button
                                            onClick={() => setIsSidebarCollapsed(true)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                            title="Collapse panel"
                                        >
                                            <ChevronsLeft size={16} />
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto bg-white custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
                                    {/* Folder Structure */}
                                    {(() => {
                                        // Organize items into folders
                                        const folderStructure: { [key: string]: { icon: React.ElementType, items: DraggableItem[] } } = {
                                            'Recents': { icon: Clock, items: [] },
                                            'Control Flow': { icon: GitMerge, items: DRAGGABLE_ITEMS.filter(i => ['condition', 'join', 'splitColumns'].includes(i.type)) },
                                            'Data and Variables': { icon: Database, items: DRAGGABLE_ITEMS.filter(i => ['fetchData', 'manualInput', 'saveRecords', 'esios', 'climatiq'].includes(i.type)) },
                                            'String Operations': { icon: MessageSquare, items: [] },
                                            'Date and Time': { icon: Calendar, items: [] },
                                            'Output and Logging': { icon: LogOut, items: DRAGGABLE_ITEMS.filter(i => ['output', 'comment', 'dataVisualization'].includes(i.type)) },
                                            'File & Folder Operations': { icon: FolderOpen, items: DRAGGABLE_ITEMS.filter(i => ['pdfInput'].includes(i.type)) },
                                            'Excel / Spreadsheet': { icon: FileSpreadsheet, items: DRAGGABLE_ITEMS.filter(i => ['excelInput'].includes(i.type)) },
                                            'CSV': { icon: FileSpreadsheet, items: [] },
                                            'Database': { icon: Database, items: DRAGGABLE_ITEMS.filter(i => ['mysql', 'sapFetch'].includes(i.type)) },
                                            'Web and API': { icon: Globe, items: DRAGGABLE_ITEMS.filter(i => ['http', 'webhook'].includes(i.type)) },
                                            'Email': { icon: Mail, items: DRAGGABLE_ITEMS.filter(i => ['sendEmail', 'sendSMS'].includes(i.type)) },
                                            'FTP/SFTP': { icon: FolderOpen, items: [] },
                                            'Security': { icon: Shield, items: [] },
                                            'Code Block': { icon: Code, items: DRAGGABLE_ITEMS.filter(i => ['python', 'llm'].includes(i.type)) },
                                            'Exception Handling': { icon: AlertCircle, items: [] },
                                            'Advanced Logic': { icon: Sparkles, items: DRAGGABLE_ITEMS.filter(i => ['humanApproval', 'addField', 'action'].includes(i.type)) },
                                        };

                                        // Add triggers to Recents (as example)
                                        folderStructure['Recents'].items = DRAGGABLE_ITEMS.filter(i => ['trigger', 'webhook'].includes(i.type));
                                        
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
                                            const isExpanded = expandedFolders.has(folderName);
                                            const filteredFolderItems = folder.items.filter(item => {
                                                if (searchQuery === '') return true;
                                                return item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    item.description.toLowerCase().includes(searchQuery.toLowerCase());
                                            });

                                            // Don't show folder if it has no items (except Recents)
                                            if (folderName !== 'Recents' && filteredFolderItems.length === 0 && searchQuery === '') return null;
                                            if (filteredFolderItems.length === 0 && searchQuery !== '') return null;

                                            return (
                                                <div key={folderName} className="border-b border-slate-100">
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
                                                        className="w-full flex items-center justify-between px-4 py-2 bg-[#F4F5F5] hover:bg-[#E8EAEA] transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <folder.icon size={14} className="text-slate-600 flex-shrink-0" />
                                                            <span className="text-xs font-medium text-slate-900">{folderName}</span>
                                                        </div>
                                                        {isExpanded ? (
                                                            <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
                                                        ) : (
                                                            <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
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
                                                                    className="flex items-center gap-2.5 px-4 py-1.5 pl-8 hover:bg-slate-50 cursor-grab transition-colors group"
                                                                >
                                                                    <item.icon size={13} className="text-slate-600 flex-shrink-0" />
                                                                    <span className="text-xs text-slate-700 group-hover:text-slate-900 transition-colors">{item.label}</span>
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
                                <div className="p-2 border-b border-slate-200 bg-white flex justify-center">
                                    <button
                                        onClick={() => setIsSidebarCollapsed(false)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                        title="Expand panel"
                                    >
                                        <ChevronsRight size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto py-2 space-y-1.5 custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
                                    {filteredItems.map((item) => (
                                        <div
                                            key={item.label}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item)}
                                            className="mx-2 p-1.5 bg-white border border-slate-200 rounded-md shadow-sm cursor-grab group flex items-center justify-center"
                                            title={item.label}
                                        >
                                            <div className={`p-1 rounded ${item.category === 'Triggers' ? 'bg-cyan-100 text-cyan-700' :
                                                item.category === 'Data' ? 'bg-indigo-100 text-indigo-700' :
                                                    item.category === 'Logic' ? 'bg-slate-100 text-slate-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                <item.icon size={16} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Canvas */}
                    <div data-tutorial="workflow-canvas" className="flex-1 flex flex-col relative overflow-hidden bg-slate-50">
                        {/* Canvas Area */}
                        <div className="flex-1 relative overflow-hidden" style={{ 
                            background: 'radial-gradient(ellipse at center, #fafbfc 0%, #f8fafc 100%)'
                        }}>

                        <div
                            ref={canvasRef}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onWheel={handleWheel}
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
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white rounded-full shadow-sm border border-slate-200 px-4 py-2">
                                {/* AI Assistant Button */}
                                <button
                                    onClick={() => setShowAiAssistant(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors"
                                    title="AI Workflow Assistant"
                                >
                                    <Sparkles size={16} className="text-slate-700" />
                                    <span className="text-sm font-medium text-slate-700">Ask</span>
                                </button>
                                
                                <div className="w-px h-6 bg-slate-300"></div>
                                
                                {/* Zoom Out */}
                                <button
                                    onClick={() => setCanvasZoom(prev => Math.max(prev / 1.2, 0.25))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={18} className="text-slate-600" />
                                </button>
                                
                                {/* Zoom Level */}
                                <div className="px-3 py-1 text-sm font-medium text-slate-600 min-w-[60px] text-center">
                                    {Math.round(canvasZoom * 100)}%
                                </div>
                                
                                {/* Zoom In */}
                                <button
                                    onClick={() => setCanvasZoom(prev => Math.min(prev * 1.2, 3))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={18} className="text-slate-600" />
                                </button>
                                
                                <div className="w-px h-6 bg-slate-300"></div>
                                
                                {/* Fit View */}
                                <button
                                    onClick={resetView}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Fit view to screen"
                                >
                                    <Maximize2 size={18} className="text-slate-600" />
                                </button>
                            </div>

                            {/* Content with transform */}
                            <div style={{
                                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
                                transformOrigin: '0 0',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }}>
                                {/* SVG Layer for Connections */}
                                <svg
                                    className="absolute pointer-events-none"
                                    style={{
                                        zIndex: 0,
                                        overflow: 'visible',
                                        left: 0,
                                        top: 0,
                                        width: '10000px',
                                        height: '10000px'
                                    }}
                                >
                                    {connections.map(conn => {
                                        const fromNode = nodes.find(n => n.id === conn.fromNodeId);
                                        const toNode = nodes.find(n => n.id === conn.toNodeId);
                                        if (!fromNode || !toNode) return null;

                                        // Calculate line positions (from right of fromNode to left of toNode)
                                        const x1 = fromNode.x + 96; // Half width of node (192px / 2)
                                        
                                        // For condition and splitColumns nodes, adjust Y position based on output type
                                        // Connectors use top-[28px] and top-[calc(100%-28px)]
                                        // Since nodes use translate(-50%, -50%), we need to offset from center
                                        let y1 = fromNode.y;
                                        if (fromNode.type === 'condition') {
                                            // Use fixed offset of 28px from center to match connector positions
                                            if (conn.outputType === 'true') {
                                                y1 = fromNode.y - 28; // TRUE connector position
                                            } else if (conn.outputType === 'false') {
                                                y1 = fromNode.y + 28; // FALSE connector position
                                            }
                                        } else if (fromNode.type === 'splitColumns') {
                                            // Use fixed offset of 28px from center to match connector positions
                                            if (conn.outputType === 'A') {
                                                y1 = fromNode.y - 28; // Output A position
                                            } else if (conn.outputType === 'B') {
                                                y1 = fromNode.y + 28; // Output B position
                                            }
                                        }
                                        
                                        const x2 = toNode.x - 96;
                                        
                                        // For join nodes, adjust Y position based on input port
                                        let y2 = toNode.y;
                                        if (toNode.type === 'join') {
                                            // Use fixed offset of 28px from center to match connector positions
                                            if (conn.inputPort === 'A') {
                                                y2 = toNode.y - 28; // Input A position
                                            } else if (conn.inputPort === 'B') {
                                                y2 = toNode.y + 28; // Input B position
                                            }
                                        }

                                        // Control points for Bezier curve
                                        const c1x = x1 + Math.abs(x2 - x1) / 2;
                                        const c1y = y1;
                                        const c2x = x2 - Math.abs(x2 - x1) / 2;
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
                                                        onMouseLeave={() => setHoveredConnection(null)}
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
                                                        transition: 'all 0.2s ease',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                                {/* End point circle (replaces arrow) - same size as connector circles (w-4 h-4 = 16px, so r=8) */}
                                                <circle
                                                    cx={x2}
                                                    cy={y2}
                                                    r="8"
                                                    fill={strokeColor}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                                {/* Delete button on hover */}
                                                {!isRunning && hoveredConnection === conn.id && (
                                                    <g style={{ pointerEvents: 'auto' }}>
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
                                            }
                                        }}
                                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                        style={{
                                            position: 'absolute',
                                            left: node.x,
                                            top: node.y,
                                            transform: 'translate(-50%, -50%)', // Center on drop point
                                            width: '192px', // Enforce fixed width (w-48)
                                            cursor: (node.data || ['fetchData', 'condition', 'addField', 'saveRecords', 'llm'].includes(node.type)) ? 'grab' : 'default',
                                            zIndex: 10,
                                            // Fixed height for nodes with dual connectors to ensure consistent positioning
                                            ...(node.type === 'condition' || node.type === 'join' || node.type === 'splitColumns' ? { minHeight: '112px' } : {})
                                        }}
                                        className={`flex flex-col p-4 rounded-xl border shadow-sm w-48 group relative select-none backdrop-blur-sm ${draggingNodeId === node.id ? '' : 'transition-all duration-300'} ${getNodeColor(node.type, node.status)} ${node.status === 'completed' ? 'ring-2 ring-[#256A65]/30' : ''}`}
                                    >
                                        {/* Hover Action Buttons - Above Node */}
                                        <div 
                                            className="absolute -top-7 left-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-md shadow-sm border border-slate-200 p-0.5"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRunNode(node.id);
                                                }}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-[#256A65] transition-all"
                                                title="Run Node"
                                            >
                                                <Play size={12} fill="currentColor" />
                                            </button>
                                            {((node.data && Array.isArray(node.data) && node.data.length > 0) || 
                                              (node.type === 'splitColumns' && node.data && (node.data.outputA?.length > 0 || node.data.outputB?.length > 0))) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingDataNodeId(node.id);
                                                    }}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800 transition-all"
                                                    title="View Data"
                                                >
                                                    <Database size={12} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeNode(node.id);
                                                }}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-red-500 transition-all"
                                                title="Delete Node"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>

                                        {/* Node Content */}
                                        {node.type === 'comment' ? (
                                            /* Comment Node Special Layout */
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-normal">
                                                        A
                                                    </div>
                                                    <span className="text-xs text-slate-500">Comment</span>
                                                </div>
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
                                                    className="w-full p-2 text-xs bg-transparent border-none resize-none focus:outline-none text-slate-700 min-h-[40px]"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        ) : (
                                            /* Regular Node Layout */
                                            <>
                                                <div className="flex items-center gap-2.5">
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
                                                        <div className={`p-2 rounded-lg flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 ${getNodeIconBg(node.type)}`}>
                                                            {React.createElement(getNodeIcon(node.type), { size: 18 })}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 font-normal text-sm truncate text-slate-900" title={node.label}>{node.label}</div>
                                                    {node.status === 'completed' && (
                                                        <div className="flex-shrink-0 p-1 bg-[#256A65]/10 rounded-full">
                                                            <Check size={14} className="text-[#256A65]" />
                                                        </div>
                                                    )}
                                                    {node.status === 'error' && (
                                                        <div className="flex-shrink-0 p-1 bg-red-100 rounded-full">
                                                            <XCircle size={14} className="text-red-600" />
                                                        </div>
                                                    )}
                                                    {node.status === 'running' && (
                                                        <div className="flex-shrink-0 p-1 bg-yellow-100 rounded-full">
                                                            <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                    {node.status === 'waiting' && (
                                                        <div className="flex-shrink-0 p-1 bg-orange-100 rounded-full">
                                                            <UserCheck size={14} className="text-orange-600 animate-pulse" />
                                                        </div>
                                                    )}
                                                </div>

                                                {node.executionResult && (
                                                    <div className="mt-2 text-xs italic opacity-75">
                                                        {node.executionResult}
                                                    </div>
                                                )}

                                                {/* Human Approval Waiting UI */}
                                                {node.type === 'humanApproval' && node.status === 'waiting' && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-xs text-orange-700 font-medium flex items-center gap-1">
                                                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                                            Waiting for approval...
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleApproval(true);
                                                                }}
                                                                className="flex-1 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e554f] text-white text-xs font-normal rounded-md transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <Check size={14} />
                                                                Accept
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleApproval(false);
                                                                }}
                                                                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-normal rounded-md transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <X size={14} />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {node.type === 'fetchData' && node.config?.entityName && (
                                            <div className="mt-2 text-xs font-medium text-[#256A65]">
                                                Entity: {node.config.entityName}
                                                {node.data && (
                                                    <span className="ml-2 text-[#256A65]">({node.data.length} records)</span>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'join' && (
                                            <div className="mt-2 text-xs font-medium text-cyan-700">
                                                {node.config?.joinStrategy === 'mergeByKey'
                                                    ? `${node.config?.joinType === 'outer' ? 'Outer' : 'Inner'} Join: ${node.config?.joinKey || 'key not set'}`
                                                    : 'Strategy: Concatenate'}
                                                {node.inputDataA && node.inputDataB && (
                                                    <span className="ml-2 text-[#256A65]">✓ Ready</span>
                                                )}
                                                {(node.inputDataA || node.inputDataB) && !(node.inputDataA && node.inputDataB) && (
                                                    <span className="ml-2 text-amber-600">⏳ {node.inputDataA ? 'B' : 'A'}</span>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'excelInput' && (
                                            <div className="mt-2 text-xs font-medium text-emerald-700">
                                                {node.config?.fileName ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="truncate max-w-[160px]" title={node.config.fileName}>
                                                            📄 {node.config.fileName}
                                                        </span>
                                                        <span className="text-slate-500">
                                                            {node.config.rowCount} rows • {node.config.headers?.length || 0} cols
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Click to upload file</span>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'condition' && (
                                            <div className="mt-2 text-xs font-medium text-amber-700">
                                                {node.config?.conditionField ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>
                                                            {node.config.conditionField} {node.config.conditionOperator} {node.config.conditionValue || ''}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${node.config.processingMode === 'perRow' ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                                                            {node.config.processingMode === 'perRow' ? '⚡ Per Row (filter)' : '📦 Batch'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Not configured</span>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'splitColumns' && (
                                            <div className="mt-2 text-xs font-medium text-sky-700">
                                                {(node.config?.columnsOutputA?.length || 0) > 0 || (node.config?.columnsOutputB?.length || 0) > 0 ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-blue-600 font-normal">A:</span>
                                                            <span>{node.config?.columnsOutputA?.length || 0} cols</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-purple-600 font-normal">B:</span>
                                                            <span>{node.config?.columnsOutputB?.length || 0} cols</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Click to configure</span>
                                                )}
                                            </div>
                                        )}

                                        {node.type === 'llm' && (
                                            <div className="mt-2 text-xs font-medium text-violet-700">
                                                {node.config?.llmPrompt ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="truncate max-w-[160px]" title={node.config.llmPrompt}>
                                                            {node.config.llmPrompt.slice(0, 30)}{node.config.llmPrompt.length > 30 ? '...' : ''}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${node.config.processingMode === 'perRow' ? 'bg-violet-200 text-violet-800' : 'bg-slate-200 text-slate-600'}`}>
                                                            {node.config.processingMode === 'perRow' ? '⚡ Per Row' : '📦 Batch'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Not configured</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Connector Points - not for comment nodes */}
                                        {node.type !== 'comment' && (
                                            <>
                                                {/* Output connectors */}
                                                {node.type === 'condition' ? (
                                                    // Condition nodes have TWO output connectors: TRUE and FALSE
                                                    <>
                                                        {/* TRUE output - top right (green) - fixed position */}
                                                        <div className="absolute -right-2 group/connector z-30 pointer-events-auto" style={{ top: '28px', transform: 'translateY(-50%)' }}>
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
                                                            <div className={`w-4 h-4 bg-green-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'true' ? 'border-green-500 scale-125 bg-green-100 shadow-md' : 'border-green-400 group-hover/connector:border-green-500 group-hover/connector:bg-green-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} title="TRUE path" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-[#256A65]" style={{ top: '28px', transform: 'translateY(-50%)' }}>✓</span>

                                                        {/* FALSE output - bottom right (red) - fixed position */}
                                                        <div className="absolute -right-2 group/connector z-30 pointer-events-auto" style={{ bottom: '28px', transform: 'translateY(50%)' }}>
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
                                                            <div className={`w-4 h-4 bg-red-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'false' ? 'border-red-500 scale-125 bg-red-100 shadow-md' : 'border-red-400 group-hover/connector:border-red-500 group-hover/connector:bg-red-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} title="FALSE path" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-red-600" style={{ bottom: '28px', transform: 'translateY(50%)' }}>✗</span>
                                                    </>
                                                ) : node.type === 'splitColumns' ? (
                                                    // Split Columns nodes have TWO output connectors: A and B
                                                    <>
                                                        {/* Output A - top right (blue) - fixed position */}
                                                        <div className="absolute -right-2 group/connector z-30 pointer-events-auto" style={{ top: '28px', transform: 'translateY(-50%)' }}>
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
                                                            <div className={`w-4 h-4 bg-blue-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'A' ? 'border-blue-500 scale-125 bg-blue-100 shadow-md' : 'border-blue-400 group-hover/connector:border-blue-500 group-hover/connector:bg-blue-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} title="Output A" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-blue-600" style={{ top: '28px', transform: 'translateY(-50%)' }}>A</span>

                                                        {/* Output B - bottom right (purple) - fixed position */}
                                                        <div className="absolute -right-2 group/connector z-30 pointer-events-auto" style={{ bottom: '28px', transform: 'translateY(50%)' }}>
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
                                                            <div className={`w-4 h-4 bg-purple-50 border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id && dragConnectionStart?.outputType === 'B' ? 'border-purple-500 scale-125 bg-purple-100 shadow-md' : 'border-purple-400 group-hover/connector:border-purple-500 group-hover/connector:bg-purple-100 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} title="Output B" />
                                                        </div>
                                                        <span className="absolute -right-6 text-[9px] font-normal text-purple-600" style={{ bottom: '28px', transform: 'translateY(50%)' }}>B</span>
                                                    </>
                                                ) : (
                                                    // Regular nodes have ONE output connector
                                                    <div 
                                                        className="absolute -right-2 top-1/2 -translate-y-1/2 group/connector cursor-crosshair z-30 pointer-events-auto"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            handleConnectorMouseDown(e, node.id);
                                                        }}
                                                        onMouseUp={(e) => {
                                                            e.stopPropagation();
                                                            handleConnectorMouseUp(e, node.id);
                                                        }}
                                                    >
                                                        {/* Visible connector point */}
                                                        <div className={`w-4 h-4 bg-white border-2 rounded-full transition-all shadow-sm pointer-events-none ${dragConnectionStart?.nodeId === node.id ? 'border-[#256A65] scale-125 bg-[#256A65]/10 shadow-md' : 'border-slate-400 group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 group-hover/connector:scale-110 group-hover/connector:shadow-md'}`} />
                                                    </div>
                                                )}
                                                
                                                {/* Input connector(s) - all nodes except triggers */}
                                                {node.type !== 'trigger' && (
                                                    node.type === 'join' ? (
                                                        // Join nodes have TWO input connectors: A and B - fixed positions
                                                        <>
                                                            {/* Input A - top left */}
                                                            <div className="absolute -left-2 group/connector z-30 pointer-events-auto" style={{ top: '28px', transform: 'translateY(-50%)' }}>
                                                                {/* Larger hit area */}
                                                                <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                    onMouseUp={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConnectorMouseUp(e, node.id, 'A');
                                                                    }}
                                                                />
                                                                {/* Visible connector point */}
                                                                <div className={`w-4 h-4 bg-white border-2 rounded-full transition-all shadow-sm pointer-events-none border-slate-400 group-hover/connector:border-cyan-500 group-hover/connector:bg-cyan-50 group-hover/connector:scale-110 group-hover/connector:shadow-md`} title="Input A" />
                                                            </div>
                                                            {/* Input B - bottom left */}
                                                            <div className="absolute -left-2 group/connector z-30 pointer-events-auto" style={{ bottom: '28px', transform: 'translateY(50%)' }}>
                                                                {/* Larger hit area */}
                                                                <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                    onMouseUp={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConnectorMouseUp(e, node.id, 'B');
                                                                    }}
                                                                />
                                                                {/* Visible connector point */}
                                                                <div className={`w-4 h-4 bg-white border-2 rounded-full transition-all shadow-sm pointer-events-none border-slate-400 group-hover/connector:border-cyan-500 group-hover/connector:bg-cyan-50 group-hover/connector:scale-110 group-hover/connector:shadow-md`} title="Input B" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        // Regular nodes have ONE input connector
                                                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 group/connector z-30 pointer-events-auto">
                                                            {/* Larger hit area */}
                                                            <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" 
                                                                onMouseUp={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConnectorMouseUp(e, node.id);
                                                                }}
                                                            />
                                                            {/* Visible connector point */}
                                                            <div className={`w-4 h-4 bg-white border-2 rounded-full transition-all shadow-sm pointer-events-none border-slate-400 group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 group-hover/connector:scale-110 group-hover/connector:shadow-md`} />
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
                                                        className="absolute -right-14 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-slate-300 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-[#256A65] hover:bg-[#256A65]/10 hover:scale-110 shadow-sm z-25 pointer-events-auto"
                                                        title="Quick connect component"
                                                    >
                                                        <Plus size={14} className="text-slate-600 group-hover:text-[#256A65]" />
                                                    </button>
                                                )}
                                            </>
                                        )}

                                    </div>
                                ))}

                                {/* Temporary Connection Line */}
                                {dragConnectionStart && dragConnectionCurrent && (() => {
                                    const startNode = nodes.find(n => n.id === dragConnectionStart.nodeId)!;
                                    const startX = startNode.x + 96;
                                    
                                    // Adjust Y position for condition and splitColumns node outputs
                                    let startY = startNode.y;
                                    if (startNode.type === 'condition') {
                                        if (dragConnectionStart.outputType === 'true') {
                                            startY = startNode.y - 20;
                                        } else if (dragConnectionStart.outputType === 'false') {
                                            startY = startNode.y + 20;
                                        }
                                    } else if (startNode.type === 'splitColumns') {
                                        if (dragConnectionStart.outputType === 'A') {
                                            startY = startNode.y - 20;
                                        } else if (dragConnectionStart.outputType === 'B') {
                                            startY = startNode.y + 20;
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
                                        {/* Shadow/glow */}
                                        <path
                                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${dragConnectionCurrent.x - 50} ${dragConnectionCurrent.y}, ${dragConnectionCurrent.x} ${dragConnectionCurrent.y}`}
                                            stroke={strokeColor}
                                            strokeWidth="4"
                                            fill="none"
                                            strokeDasharray="5,5"
                                            opacity="0.2"
                                        />
                                        {/* Main line */}
                                        <path
                                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${dragConnectionCurrent.x - 50} ${dragConnectionCurrent.y}, ${dragConnectionCurrent.x} ${dragConnectionCurrent.y}`}
                                            stroke={strokeColor}
                                            strokeWidth="3"
                                            fill="none"
                                            strokeDasharray="5,5"
                                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                                        />
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
                                        <div className="text-center max-w-md px-6">
                                            <div className="mb-6">
                                                <Workflow size={64} className="mx-auto mb-4 text-slate-300" />
                                                <h3 className="text-xl font-normal text-slate-700 mb-2">Start building your workflow</h3>
                                                <p className="text-sm text-slate-500 mb-6">
                                                    Drag components from the sidebar or create your workflow with AI
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                                <button
                                                    onClick={() => setShowAiAssistant(true)}
                                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#256A65] text-white rounded-lg hover:bg-[#1e554f] transition-colors font-medium shadow-sm"
                                                >
                                                    <Sparkles size={18} />
                                                    Create with AI
                                                </button>
                                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                                    <span className="h-px w-8 bg-slate-300"></span>
                                                    <span>or</span>
                                                    <span className="h-px w-8 bg-slate-300"></span>
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                                                    <span>Drag components</span>
                                                    <ChevronRight size={14} className="text-slate-400" />
                                                </div>
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
                            <div className="fixed top-0 right-0 w-[450px] h-screen bg-white border-l border-slate-200 flex flex-col shadow-2xl z-50">
                                {/* Header */}
                            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles size={24} />
                                    <div>
                                        <h3 className="font-normal text-lg">AI Workflow Assistant</h3>
                                        <p className="text-sm text-slate-300">Ask me about your workflow</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAiAssistant(false)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                                {aiChatMessages.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                                        <p className="text-sm font-medium text-slate-600">AI Workflow Assistant</p>
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
                                                        : 'bg-white text-slate-700 border border-slate-200'
                                                }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    
                                                    {/* Workflow Suggestion Card */}
                                                    {message.workflowSuggestion && (
                                                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-300">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Workflow size={16} className="text-slate-600" />
                                                                <span className="text-xs font-normal text-slate-700 uppercase tracking-wide">
                                                                    Workflow Suggestion
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-600 mb-3">
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
                                                                        className="flex-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-300 transition-colors flex items-center justify-center gap-1"
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
                                                                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
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
                            <div className="p-4 border-t border-slate-200 bg-white">
                                {isAiChatLoading && (
                                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
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
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                                        rows={2}
                                        disabled={isAiChatLoading}
                                    />
                                    <button
                                        onClick={handleSendWorkflowAiMessage}
                                        disabled={!aiChatInput.trim() || isAiChatLoading}
                                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveNodeConfig}
                                            disabled={!selectedEntityId}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Select Entity
                                        </label>
                                        <select
                                            value={selectedEntityId}
                                            onChange={(e) => setSelectedEntityId(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                        >
                                            <option value="">Choose entity...</option>
                                            {entities.map(entity => (
                                                <option key={entity.id} value={entity.id}>{entity.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('fetchData', 'Fetch Data')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1 transition-colors"
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveHttpConfig}
                                            disabled={!httpUrl.trim()}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            URL
                                        </label>
                                        <input
                                            type="text"
                                            value={httpUrl}
                                            onChange={(e) => setHttpUrl(e.target.value)}
                                            placeholder="https://api.example.com/data"
                                            className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1.5">
                                            Enter the full URL to fetch data from (GET request).
                                        </p>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('http', 'HTTP Request')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1 transition-colors"
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
                                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                    >
                                        Close
                                    </button>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Your Webhook URL
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={webhookUrl}
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(webhookUrl);
                                                    showToast('Webhook URL copied!', 'success');
                                                }}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            URL with Token (more secure)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${webhookUrl}/${webhookToken}`}
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${webhookUrl}/${webhookToken}`);
                                                    showToast('Secure webhook URL copied!', 'success');
                                                }}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                                            <p className="font-medium text-slate-800 mb-1">How to use:</p>
                                            <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                                <li>Copy the webhook URL above</li>
                                                <li>Configure your external service to POST data to this URL</li>
                                                <li>The workflow will execute automatically when data is received</li>
                                            </ol>
                                    </div>

                                    <div className="text-xs text-slate-500">
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveMySQLConfig}
                                            disabled={!mysqlQuery.trim()}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Host
                                        </label>
                                            <input
                                                type="text"
                                                value={mysqlHost}
                                                onChange={(e) => setMysqlHost(e.target.value)}
                                                placeholder="localhost"
                                                className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Port
                                                </label>
                                                <input
                                                    type="text"
                                                    value={mysqlPort}
                                                    onChange={(e) => setMysqlPort(e.target.value)}
                                                    placeholder="3306"
                                                    className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Database
                                                </label>
                                                <input
                                                    type="text"
                                                    value={mysqlDatabase}
                                                    onChange={(e) => setMysqlDatabase(e.target.value)}
                                                    placeholder="mydb"
                                                    className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                                Username
                                            </label>
                                            <input
                                                type="text"
                                                value={mysqlUsername}
                                                onChange={(e) => setMysqlUsername(e.target.value)}
                                                placeholder="root"
                                                className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                                Password
                                            </label>
                                            <input
                                                type="password"
                                                value={mysqlPassword}
                                                onChange={(e) => setMysqlPassword(e.target.value)}
                                                placeholder="••••••"
                                                className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                                SQL Query
                                            </label>
                                            <textarea
                                                value={mysqlQuery}
                                                onChange={(e) => setMysqlQuery(e.target.value)}
                                                placeholder="SELECT * FROM users"
                                                rows={3}
                                                className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 font-mono placeholder:text-slate-400"
                                            />
                                        </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('mysql', 'MySQL')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1 transition-colors"
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveSAPConfig}
                                            disabled={!sapBaseApiUrl.trim() || !sapEntity.trim()}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                    <div className="space-y-5">
                                        {/* Connection Settings */}
                                        <div className="border-b border-slate-200 pb-3">
                                            <h4 className="text-xs font-medium text-slate-700 mb-3">Connection</h4>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Connection Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={sapConnectionName}
                                                    onChange={(e) => setSapConnectionName(e.target.value)}
                                                    placeholder="SAP_Production"
                                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                />
                                            </div>
                                        </div>

                                        {/* Authentication */}
                                        <div className="border-b border-slate-200 pb-3">
                                            <h4 className="text-xs font-medium text-slate-700 mb-3">Authentication</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Auth Type
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapAuthType}
                                                        onChange={(e) => setSapAuthType(e.target.value)}
                                                        placeholder="OAuth2_Client_Credentials"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Client ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapClientId}
                                                        onChange={(e) => setSapClientId(e.target.value)}
                                                        placeholder="sb-83f9a9..."
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Client Secret
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={sapClientSecret}
                                                        onChange={(e) => setSapClientSecret(e.target.value)}
                                                        placeholder="********"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Token URL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapTokenUrl}
                                                        onChange={(e) => setSapTokenUrl(e.target.value)}
                                                        placeholder="https://company.authentication.eu10.hana.ondemand.com/oauth/token"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* API Configuration */}
                                        <div>
                                            <h4 className="text-xs font-medium text-slate-700 mb-3">API Configuration</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Base API URL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapBaseApiUrl}
                                                        onChange={(e) => setSapBaseApiUrl(e.target.value)}
                                                        placeholder="https://company-api.s4hana.ondemand.com"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Service Path
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapServicePath}
                                                        onChange={(e) => setSapServicePath(e.target.value)}
                                                        placeholder="/sap/opu/odata/sap/API_PRODUCTION_ORDER_2_SRV"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Entity
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={sapEntity}
                                                        onChange={(e) => setSapEntity(e.target.value)}
                                                        placeholder="A_ProductionOrder"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('sapFetch', 'SAP S/4HANA')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={12} />
                                            What would you like this node to do?
                                        </button>
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveEmailConfig}
                                                disabled={!emailTo.trim()}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                            <div className="border border-slate-200 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmailSmtpSettings(!showEmailSmtpSettings)}
                                                    className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                    <span>⚙️ SMTP Settings</span>
                                                    <span>{showEmailSmtpSettings ? '▲' : '▼'}</span>
                                                </button>
                                                
                                                {showEmailSmtpSettings && (
                                                    <div className="p-4 border-t border-slate-200 space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                    SMTP Host
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={emailSmtpHost}
                                                                    onChange={(e) => setEmailSmtpHost(e.target.value)}
                                                                    placeholder="smtp.gmail.com"
                                                                    className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                    SMTP Port
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={emailSmtpPort}
                                                                    onChange={(e) => setEmailSmtpPort(e.target.value)}
                                                                    placeholder="587"
                                                                    className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                SMTP Username (email)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={emailSmtpUser}
                                                                onChange={(e) => setEmailSmtpUser(e.target.value)}
                                                                placeholder="your-email@gmail.com"
                                                                className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                SMTP Password / App Password
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={emailSmtpPass}
                                                                onChange={(e) => setEmailSmtpPass(e.target.value)}
                                                                placeholder="••••••••••••"
                                                                className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                            />
                                                            <p className="text-[10px] text-slate-500 mt-1">
                                                                For Gmail, use an App Password (not your regular password)
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-slate-200">
                                            <button
                                                onClick={() => openFeedbackPopup('sendEmail', 'Send Email')}
                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} />
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveSMSConfig}
                                                disabled={!smsTo.trim()}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    SMS messages are limited to 160 characters (or 70 with special characters)
                                                </p>
                                            </div>

                                            {/* Twilio Settings (collapsible) */}
                                            <div className="border border-slate-200 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSMSTwilioSettings(!showSMSTwilioSettings)}
                                                    className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                    <span>⚙️ Twilio Settings</span>
                                                    <span>{showSMSTwilioSettings ? '▲' : '▼'}</span>
                                                </button>
                                                
                                                {showSMSTwilioSettings && (
                                                    <div className="p-4 border-t border-slate-200 space-y-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                                Account SID
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={twilioAccountSid}
                                                                onChange={(e) => setTwilioAccountSid(e.target.value)}
                                                                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                                Auth Token
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={twilioAuthToken}
                                                                onChange={(e) => setTwilioAuthToken(e.target.value)}
                                                                placeholder="••••••••••••"
                                                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                                From Number (Twilio phone number)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={twilioFromNumber}
                                                                onChange={(e) => setTwilioFromNumber(e.target.value)}
                                                                placeholder="+1234567890"
                                                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                                                            />
                                                            <p className="text-[10px] text-slate-500 mt-1">
                                                                Get your credentials from twilio.com/console
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-slate-200">
                                            <button
                                                onClick={() => openFeedbackPopup('sendSMS', 'Send SMS')}
                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} />
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveVisualizationConfig}
                                                disabled={!generatedWidget}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save Visualization
                                            </button>
                                        </>
                                    }
                                >
                                        {/* Data Preview */}
                                        {hasInputData && (
                                            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-medium text-slate-600">
                                                        📊 Available Data ({inputDataForViz.length} rows, {dataFields.length} columns)
                                                    </span>
                                                    <span className="text-xs text-slate-400">Preview</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-100">
                                                            <tr>
                                                                {dataFields.map((field, idx) => (
                                                                    <th key={idx} className="px-3 py-2 text-left font-normal text-slate-700 whitespace-nowrap border-b border-slate-200">
                                                                        {field}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {inputDataForViz.slice(0, 4).map((row: any, rowIdx: number) => (
                                                                <tr key={rowIdx} className="border-b border-slate-100 hover:bg-slate-50">
                                                                    {dataFields.map((field, colIdx) => (
                                                                        <td key={colIdx} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate">
                                                                            {row[field] !== undefined && row[field] !== null ? String(row[field]) : '-'}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {inputDataForViz.length > 4 && (
                                                    <div className="px-3 py-1.5 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-200">
                                                        ... and {inputDataForViz.length - 4} more rows
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Prompt Input with Generate Button */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Describe the visualization you want
                                                </label>
                                                <button
                                                    onClick={generateWidgetFromPrompt}
                                                    disabled={!visualizationPrompt.trim() || !hasInputData || isGeneratingWidget}
                                                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                                                >
                                                    {isGeneratingWidget ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles size={14} />
                                                            Generate
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <textarea
                                                value={visualizationPrompt}
                                                onChange={(e) => setVisualizationPrompt(e.target.value)}
                                                placeholder="e.g., 'Show a bar chart of sales by month' or 'Create a pie chart showing the distribution of categories'"
                                                className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none placeholder:text-slate-400"
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
                                            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                                    <h4 className="font-medium text-xs text-slate-800">{generatedWidget.title}</h4>
                                                    <p className="text-xs text-slate-600">{generatedWidget.description}</p>
                                                </div>
                                                <div className="p-4 bg-white">
                                                    <DynamicChart config={generatedWidget} />
                                                </div>
                                                
                                                {/* Explanation Toggle */}
                                                {generatedWidget.explanation && (
                                                    <div className="border-t border-slate-200">
                                                        <button
                                                            onClick={() => setShowWidgetExplanation(!showWidgetExplanation)}
                                                            className="w-full px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-between"
                                                        >
                                                            <span>How was this created?</span>
                                                            <span>{showWidgetExplanation ? '▲' : '▼'}</span>
                                                        </button>
                                                        {showWidgetExplanation && (
                                                            <div className="px-4 pb-4 text-xs text-slate-600 whitespace-pre-wrap">
                                                                {generatedWidget.explanation}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-slate-200">
                                            <button
                                                onClick={() => openFeedbackPopup('dataVisualization', 'Data Visualization')}
                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} />
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveEsiosConfig}
                                            disabled={!esiosArchiveId.trim()}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                    <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Indicator ID
                                        </label>
                                        <input
                                            type="text"
                                            value={esiosArchiveId}
                                            onChange={(e) => setEsiosArchiveId(e.target.value)}
                                            placeholder="e.g., 1001 for PVPC"
                                            className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            1001 = PVPC prices, 1739 = Spot prices, 10211 = Market price
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Date
                                        </label>
                                        <input
                                            type="date"
                                            value={esiosDate}
                                            onChange={(e) => setEsiosDate(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                        />
                                    </div>
                                    <div className="p-3 border border-slate-200 rounded-lg">
                                        <p className="text-xs text-slate-700 font-medium mb-1">Using Token:</p>
                                        <code className="text-[10px] text-slate-600 break-all">d668...da64</code>
                                    </div>
                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('esios', 'ESIOS Energy Prices')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveClimatiqConfig}
                                            disabled={climatiqSelectedIndex === null}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Search
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={climatiqQuery}
                                                onChange={(e) => setClimatiqQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && searchClimatiq()}
                                                placeholder="e.g., Passenger diesel car"
                                                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                            />
                                            <button
                                                onClick={searchClimatiq}
                                                disabled={climatiqSearching || !climatiqQuery.trim()}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
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
                                        <p className="text-[10px] text-slate-500 mt-1.5">
                                            Introduce your activity and click search
                                        </p>
                                    </div>

                                    {/* Results List */}
                                    {climatiqSearchResults.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                                Similar activities and its Emission factors
                                            </label>
                                            <div className="space-y-2">
                                                {climatiqSearchResults.map((result, index) => (
                                                    <div
                                                        key={index}
                                                        onClick={() => setClimatiqSelectedIndex(index)}
                                                        className={`p-2.5 border rounded-lg cursor-pointer transition-all ${climatiqSelectedIndex === index
                                                            ? 'border-slate-400 bg-slate-50'
                                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${climatiqSelectedIndex === index
                                                                ? 'border-slate-700 bg-slate-700'
                                                                : 'border-slate-300'
                                                                }`}>
                                                                {climatiqSelectedIndex === index && (
                                                                    <Check size={10} className="text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-xs text-slate-800">
                                                                    {result.factor} {result.unit}
                                                                </p>
                                                                <p className="text-xs text-slate-600 truncate mt-0.5">
                                                                    {result.name} ({result.region_name || result.region})
                                                                </p>
                                                                <p className="text-[10px] text-slate-500 mt-0.5">
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
                                        <div className="p-3 border border-slate-200 rounded-lg text-center">
                                            <p className="text-xs text-slate-500">
                                                Introduce your activity and click search
                                            </p>
                                        </div>
                                    )}

                                    {/* Feedback Link */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => openFeedbackPopup('climatiq', 'Climatiq Emissions')}
                                            className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
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
                                        className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Close
                                    </button>
                                }
                            >
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                                Assign to
                                            </label>
                                            {organizationUsers.length === 0 ? (
                                            <div className="flex items-center justify-center py-8 text-slate-400">
                                                <div className="w-5 h-5 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin mr-2" />
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
                                                                    ? 'border-slate-400 bg-slate-50'
                                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                                            }`}
                                                        >
                                                            <UserAvatar name={user.name || user.email} profilePhoto={user.profilePhoto} size="sm" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-slate-800 truncate">
                                                                    {user.name || 'Unnamed User'}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate">
                                                                    {user.email}
                                                                </div>
                                                            </div>
                                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                                user.role === 'admin' 
                                                                    ? 'bg-slate-100 text-slate-700' 
                                                                    : 'bg-slate-100 text-slate-600'
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

                            // Special handling for splitColumns node
                            const isSplitColumnsNode = node.type === 'splitColumns';
                            const hasInput = node.inputData && Array.isArray(node.inputData) && node.inputData.length > 0;
                            const hasOutput = !isSplitColumnsNode && node.outputData && Array.isArray(node.outputData) && node.outputData.length > 0;
                            const hasOutputA = isSplitColumnsNode && node.outputData?.outputA?.length > 0;
                            const hasOutputB = isSplitColumnsNode && node.outputData?.outputB?.length > 0;

                            if (!hasInput && !hasOutput && !hasOutputA && !hasOutputB) return null;

                            return (
                                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => setViewingDataNodeId(null)}>
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md max-w-4xl max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-normal text-slate-800">
                                                {node.label} - Data Preview
                                            </h3>
                                            <button
                                                onClick={() => setViewingDataNodeId(null)}
                                                className="p-1 hover:bg-slate-100 rounded"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>

                                        {/* Tabs - different for splitColumns */}
                                        {isSplitColumnsNode ? (
                                            <div className="flex gap-2 mb-4 border-b">
                                                {hasInput && (
                                                    <button
                                                        onClick={() => setSplitViewTab('input')}
                                                        className={`px-4 py-2 font-medium transition-all ${splitViewTab === 'input'
                                                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                                                            : 'text-slate-600 hover:text-slate-800'
                                                            }`}
                                                    >
                                                        Input ({node.inputData.length})
                                                    </button>
                                                )}
                                                {hasOutputA && (
                                                    <button
                                                        onClick={() => setSplitViewTab('outputA')}
                                                        className={`px-4 py-2 font-medium transition-all ${splitViewTab === 'outputA'
                                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                                            : 'text-slate-600 hover:text-slate-800'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                            Output A ({node.outputData.outputA.length})
                                                        </span>
                                                    </button>
                                                )}
                                                {hasOutputB && (
                                                    <button
                                                        onClick={() => setSplitViewTab('outputB')}
                                                        className={`px-4 py-2 font-medium transition-all ${splitViewTab === 'outputB'
                                                            ? 'text-purple-600 border-b-2 border-purple-600'
                                                            : 'text-slate-600 hover:text-slate-800'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                                            Output B ({node.outputData.outputB.length})
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 mb-4 border-b">
                                                {hasInput && (
                                                    <button
                                                        onClick={() => setDataViewTab('input')}
                                                        className={`px-4 py-2 font-medium transition-all ${dataViewTab === 'input'
                                                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                                                            : 'text-slate-600 hover:text-slate-800'
                                                            }`}
                                                    >
                                                        Input ({node.inputData.length})
                                                    </button>
                                                )}
                                                {hasOutput && (
                                                    <button
                                                        onClick={() => setDataViewTab('output')}
                                                        className={`px-4 py-2 font-medium transition-all ${dataViewTab === 'output'
                                                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                                                            : 'text-slate-600 hover:text-slate-800'
                                                            }`}
                                                    >
                                                        Output ({node.outputData.length})
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className="overflow-auto flex-1">
                                            {(() => {
                                                let displayData: any[];
                                                if (isSplitColumnsNode) {
                                                    displayData = splitViewTab === 'input' 
                                                        ? node.inputData 
                                                        : splitViewTab === 'outputA' 
                                                            ? node.outputData?.outputA 
                                                            : node.outputData?.outputB;
                                                } else {
                                                    displayData = dataViewTab === 'input' ? node.inputData : node.outputData;
                                                }
                                                
                                                const MAX_PREVIEW_ROWS = 500;
                                                const totalRows = displayData?.length || 0;
                                                const limitedData = displayData?.slice(0, MAX_PREVIEW_ROWS) || [];
                                                const isLimited = totalRows > MAX_PREVIEW_ROWS;
                                                
                                                return displayData && displayData.length > 0 ? (
                                                    <>
                                                        {isLimited && (
                                                            <div className="bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2 rounded-lg mb-3 text-xs flex items-center gap-2">
                                                                <span>⚠️</span>
                                                                <span>Showing first {MAX_PREVIEW_ROWS} of {totalRows.toLocaleString()} rows for performance</span>
                                                            </div>
                                                        )}
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-100 sticky top-0">
                                                                <tr>
                                                                    {Object.keys(displayData[0]).map(key => (
                                                                        <th key={key} className="px-4 py-2 text-left font-normal text-slate-700 border-b">
                                                                            {key}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {limitedData.map((record: any, idx: number) => (
                                                                    <tr key={idx} className="border-b hover:bg-slate-50">
                                                                        {Object.values(record).map((value: any, vidx: number) => (
                                                                            <td key={vidx} className="px-4 py-2">
                                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </>
                                                ) : (
                                                    <p className="text-slate-500 text-center py-8">No data available</p>
                                                );
                                            })()}
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
                                // Get the correct output based on the connection's outputType
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveConditionConfig}
                                                disabled={!conditionField}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Field Name
                                                </label>
                                                {hasAvailableFields ? (
                                                    <>
                                                        <select
                                                            value={conditionField}
                                                            onChange={(e) => setConditionField(e.target.value)}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                                        >
                                                            <option value="">Select a field...</option>
                                                            {availableFields.map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Fields from {parentNode?.label || 'previous node'}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={conditionField}
                                                            onChange={(e) => setConditionField(e.target.value)}
                                                            placeholder="e.g., status, price, name"
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                        />
                                                        <p className="text-xs text-amber-600 mt-1">
                                                            ⚠️ Run the previous node first to see available fields
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Operator
                                                </label>
                                                <select
                                                    value={conditionOperator}
                                                    onChange={(e) => setConditionOperator(e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                                >
                                                    <option value="equals">Equals</option>
                                                    <option value="notEquals">Not Equals</option>
                                                    <option value="contains">Contains</option>
                                                    <option value="greaterThan">Greater Than</option>
                                                    <option value="lessThan">Less Than</option>
                                                    <option value="isText">Is Text</option>
                                                    <option value="isNumber">Is Number</option>
                                                </select>
                                            </div>
                                            {['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan'].includes(conditionOperator) && (
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Value
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={conditionValue}
                                                        onChange={(e) => setConditionValue(e.target.value)}
                                                        placeholder="Comparison value"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                    />
                                                </div>
                                            )}

                                            {/* Processing Mode */}
                                            <div className="pt-2 border-t border-slate-200">
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Processing Mode
                                                </label>
                                                <div className="space-y-2">
                                                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'batch' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        <input
                                                            type="radio"
                                                            name="processingMode"
                                                            value="batch"
                                                            checked={conditionProcessingMode === 'batch'}
                                                            onChange={() => setConditionProcessingMode('batch')}
                                                            className="mt-0.5 mr-3"
                                                        />
                                                        <div>
                                                            <span className="font-medium text-sm">Batch (all rows)</span>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Evaluate first row → route ALL data to TRUE or FALSE
                                                            </p>
                                                        </div>
                                                    </label>
                                                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${conditionProcessingMode === 'perRow' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        <input
                                                            type="radio"
                                                            name="processingMode"
                                                            value="perRow"
                                                            checked={conditionProcessingMode === 'perRow'}
                                                            onChange={() => setConditionProcessingMode('perRow')}
                                                            className="mt-0.5 mr-3"
                                                        />
                                                        <div>
                                                            <span className="font-medium text-sm">Per Row (filter)</span>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Evaluate each row → matching to TRUE, non-matching to FALSE
                                                            </p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        {/* Feedback Link */}
                                        <div className="pt-3 border-t border-slate-200">
                                            <button
                                                onClick={() => openFeedbackPopup('condition', 'Condition')}
                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                                            >
                                                <MessageSquare size={12} />
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveAddFieldConfig}
                                            disabled={!addFieldName}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Field Name
                                        </label>
                                        <input
                                            type="text"
                                            value={addFieldName}
                                            onChange={(e) => setAddFieldName(e.target.value)}
                                            placeholder="e.g., Nombre, Category"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Field Value
                                        </label>
                                        <input
                                            type="text"
                                            value={addFieldValue}
                                            onChange={(e) => setAddFieldValue(e.target.value)}
                                            placeholder="e.g., Albert, Active"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveJoinConfig}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                            >
                                                Save
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                                    Join Strategy
                                                </label>
                                                <select
                                                    value={joinStrategy}
                                                    onChange={(e) => setJoinStrategy(e.target.value as 'concat' | 'mergeByKey')}
                                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                                >
                                                    <option value="concat">Concatenate (combine all records)</option>
                                                    <option value="mergeByKey">Merge by common key</option>
                                                </select>
                                                <p className="text-xs text-slate-400 mt-1.5">
                                                    {joinStrategy === 'concat' 
                                                        ? 'All records from A and B will be combined into one list'
                                                        : 'Records with matching key values will be merged together'}
                                                </p>
                                            </div>
                                            
                                            {joinStrategy === 'mergeByKey' && (
                                                <>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Join Type
                                                    </label>
                                                    <div className="space-y-2">
                                                        <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'inner' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                            <input
                                                                type="radio"
                                                                name="joinType"
                                                                value="inner"
                                                                checked={joinType === 'inner'}
                                                                onChange={() => setJoinType('inner')}
                                                                className="mt-0.5 mr-3"
                                                            />
                                                            <div>
                                                                <span className="font-medium text-xs text-slate-900">Inner Join</span>
                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    Only records that match in both inputs
                                                                </p>
                                                            </div>
                                                        </label>
                                                        <label className={`flex items-start p-2.5 border rounded-lg cursor-pointer transition-all ${joinType === 'outer' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                            <input
                                                                type="radio"
                                                                name="joinType"
                                                                value="outer"
                                                                checked={joinType === 'outer'}
                                                                onChange={() => setJoinType('outer')}
                                                                className="mt-0.5 mr-3"
                                                            />
                                                            <div>
                                                                <span className="font-medium text-xs text-slate-900">Outer Join</span>
                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    All records from both inputs (empty where no match)
                                                                </p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                                        Common Key Field
                                                    </label>
                                                    {allFields.length > 0 ? (
                                                        <>
                                                            <select
                                                                value={joinKey}
                                                                onChange={(e) => setJoinKey(e.target.value)}
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
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
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
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
                                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveSplitColumnsConfig}
                                                disabled={splitColumnsOutputA.length === 0 && splitColumnsOutputB.length === 0}
                                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save Configuration
                                            </button>
                                        </>
                                    }
                                >
                                        {allColumns.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500">
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
                                                                <span className="text-xs font-medium text-slate-700">Output A</span>
                                                                <span className="text-xs text-slate-500">({splitColumnsOutputA.length} cols)</span>
                                                            </div>
                                                            <button
                                                                onClick={moveAllToA}
                                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
                                                            >
                                                                Move all here
                                                            </button>
                                                        </div>
                                                        <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputA.includes(draggedColumn) ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                                                            {splitColumnsOutputA.length === 0 ? (
                                                                <div className="text-center py-8 text-slate-400 text-xs">
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
                                                                            className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded border border-slate-200 cursor-grab group"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <GripVertical size={12} className="text-slate-400" />
                                                                                <span className="text-xs font-medium text-slate-700">{column}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => moveColumnToB(column)}
                                                                                className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 hover:text-slate-900 transition-opacity"
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
                                                                <span className="text-xs font-medium text-slate-700">Output B</span>
                                                                <span className="text-xs text-slate-500">({splitColumnsOutputB.length} cols)</span>
                                                            </div>
                                                            <button
                                                                onClick={moveAllToB}
                                                                className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
                                                            >
                                                                Move all here
                                                            </button>
                                                        </div>
                                                        <div className={`flex-1 border-2 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto transition-colors ${draggedColumn && !splitColumnsOutputB.includes(draggedColumn) ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                                                            {splitColumnsOutputB.length === 0 ? (
                                                                <div className="text-center py-8 text-slate-400 text-xs">
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
                                                                            className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded border border-slate-200 cursor-grab group"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <GripVertical size={12} className="text-slate-400" />
                                                                                <span className="text-xs font-medium text-slate-700">{column}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => moveColumnToA(column)}
                                                                                className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 hover:text-slate-900 transition-opacity"
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
                                                
                                                <div className="mt-4 pt-3 border-t border-slate-200">
                                                    <p className="text-xs text-slate-500">
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
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                        ? 'bg-slate-50 border-slate-300 cursor-wait'
                                                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                                }`}
                                            >
                                                {isParsingExcel ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-xs text-slate-600">Parsing file...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="text-slate-600" size={18} />
                                                        <div className="text-center">
                                                            <span className="text-xs text-slate-700 font-medium">Click to upload</span>
                                                            <p className="text-[10px] text-slate-400 mt-1">CSV, XLS, XLSX supported</p>
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
                                                <label className="block text-xs font-medium text-slate-700">
                                                    Preview
                                                </label>
                                                <span className="text-[10px] text-slate-500">
                                                    {excelPreviewData.rowCount} total rows • {excelPreviewData.headers.length} columns
                                                </span>
                                            </div>
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="overflow-x-auto max-h-48">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 sticky top-0">
                                                            <tr>
                                                                {excelPreviewData.headers.map((header, i) => (
                                                                    <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-700 whitespace-nowrap text-xs">
                                                                        {header}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {excelPreviewData.data.map((row, i) => (
                                                                <tr key={i} className="hover:bg-slate-50">
                                                                    {excelPreviewData.headers.map((header, j) => (
                                                                        <td key={j} className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate text-xs">
                                                                            {row[header] || '-'}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {excelPreviewData.rowCount > 5 && (
                                                    <div className="px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                                                        Showing first 5 of {excelPreviewData.rowCount} rows
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Current File Info */}
                                    {nodes.find(n => n.id === configuringExcelNodeId)?.config?.fileName && !excelFile && (
                                        <div className="p-3 border border-slate-200 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="text-slate-600" size={14} />
                                                <span className="text-xs font-medium text-slate-700">
                                                    {nodes.find(n => n.id === configuringExcelNodeId)?.config?.fileName}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1">
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
                                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Done
                                    </button>
                                }
                            >
                                <div className="space-y-5">
                                    {/* File Upload Area */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                                        ? 'bg-slate-50 border-slate-300 cursor-wait'
                                                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                                }`}
                                            >
                                                {isParsingPdf ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-xs text-slate-600">Parsing PDF...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="text-slate-600" size={18} />
                                                        <div className="text-center">
                                                            <span className="text-xs text-slate-700 font-medium">Click to upload</span>
                                                            <p className="text-[10px] text-slate-400 mt-1">PDF files supported</p>
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
                                                <label className="block text-xs font-medium text-slate-700">
                                                    Extracted Text Preview
                                                </label>
                                                <span className="text-[10px] text-slate-500">
                                                    {pdfPreviewData.pages} pages
                                                </span>
                                            </div>
                                            <div className="border border-slate-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                                                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                                                    {pdfPreviewData.text.substring(0, 1000)}
                                                    {pdfPreviewData.text.length > 1000 && '\n\n... (text truncated for preview)'}
                                                </pre>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Full text ({pdfPreviewData.text.length} characters) will be available to the workflow
                                            </p>
                                        </div>
                                    )}

                                    {/* Current File Info */}
                                    {nodes.find(n => n.id === configuringPdfNodeId)?.config?.fileName && !pdfFile && (
                                        <div className="p-3 border border-slate-200 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <FileText className="text-slate-600" size={14} />
                                                <span className="text-xs font-medium text-slate-700">
                                                    {nodes.find(n => n.id === configuringPdfNodeId)?.config?.fileName}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1">
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
                                            className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveSaveRecordsConfig}
                                            disabled={!saveEntityId}
                                            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save
                                        </button>
                                    </>
                                }
                            >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Select Entity
                                        </label>
                                        <select
                                            value={saveEntityId}
                                            onChange={(e) => setSaveEntityId(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
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
                                        className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveLLMConfig}
                                        disabled={!llmPrompt.trim()}
                                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
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
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="includeInput" className="text-sm text-slate-700 cursor-pointer">
                                            Include Input Data (from previous node)
                                        </label>
                                    </div>

                                    {/* Processing Mode */}
                                    <div className="pt-3 border-t border-slate-200">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Processing Mode
                                        </label>
                                        <div className="space-y-2">
                                            <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'batch' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
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
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Send all data in one AI call → single result
                                                    </p>
                                                </div>
                                            </label>
                                            <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${llmProcessingMode === 'perRow' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
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
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Call AI for each row → adds <code className="bg-slate-100 px-1 rounded">ai_result</code> field.
                                                        Use <code className="bg-slate-100 px-1 rounded">{'{field}'}</code> in prompt for row values.
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback Link */}
                                <div className="pt-3 border-t border-slate-200">
                                    <button
                                        onClick={() => openFeedbackPopup('llm', 'LLM / AI Generate')}
                                        className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
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
                                        className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={savePythonConfig}
                                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-5">
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
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Python Code
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={pythonCode}
                                                onChange={(e) => setPythonCode(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-900 text-slate-50 font-mono text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-64 resize-none"
                                                spellCheck={false}
                                            />
                                            <div className="absolute top-2 right-2 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                                Python 3
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Function must be named <code>process(data)</code> and return a list.
                                        </p>
                                    </div>
                                </div>

                                {/* Feedback Link */}
                                <div className="pt-3 border-t border-slate-200">
                                    <button
                                        onClick={() => openFeedbackPopup('python', 'Python Code')}
                                        className="text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
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
                                        className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveManualInputConfig}
                                        disabled={!manualInputVarName.trim()}
                                        className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save
                                    </button>
                                </>
                            }
                        >
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Variable Name
                                        </label>
                                        <input
                                            type="text"
                                            value={manualInputVarName}
                                            onChange={(e) => setManualInputVarName(e.target.value)}
                                            placeholder="e.g., temperature, count, status"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-2">
                                            Value
                                        </label>
                                        <input
                                            type="text"
                                            value={manualInputVarValue}
                                            onChange={(e) => setManualInputVarValue(e.target.value)}
                                            placeholder="e.g., 25, Active, Hello World"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Numbers will be parsed automatically.
                                        </p>
                                    </div>
                                </div>
                        </NodeConfigSidePanel>
                    )}

                    {/* Workflow Runner Modal */}
                    {showRunnerModal && (
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none" onClick={() => setShowRunnerModal(false)}>
                            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-normal text-slate-800">Export Workflow</h2>
                                        <button
                                            onClick={() => setShowRunnerModal(false)}
                                            className="text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">Export and share your workflow as a form</p>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* Share & Embed Section */}
                                    <div className="mb-6 space-y-4">
                                        {/* Shareable Link */}
                                        <div className="bg-gradient-to-r from-[#256A65]/5 to-[#256A65]/10 rounded-xl p-4 border border-[#256A65]/20">
                                            <label className="block text-sm font-normal text-teal-800 mb-2 flex items-center gap-2">
                                                <Globe size={16} />
                                                Published Interface
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={getShareableUrl()}
                                                    className="flex-1 px-3 py-2 bg-white border border-[#256A65]/30 rounded-lg text-sm text-slate-600 focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(getShareableUrl(), 'Link copied to clipboard!')}
                                                    className="px-4 py-2 bg-white border border-[#256A65]/30 rounded-lg hover:bg-[#256A65]/5 transition-colors text-[#1e554f] font-medium text-sm flex items-center gap-2"
                                                >
                                                    <Share2 size={16} />
                                                    Copy
                                                </button>
                                            </div>
                                        </div>

                                        {/* Embed Code Toggle */}
                                        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                            <button
                                                onClick={() => setShowEmbedCode(!showEmbedCode)}
                                                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                                            >
                                                <span className="font-normal text-slate-700 flex items-center gap-2">
                                                    <Code size={16} />
                                                    Embed Code
                                                </span>
                                                <span className={`text-slate-400 transition-transform ${showEmbedCode ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </span>
                                            </button>
                                            {showEmbedCode && (
                                                <div className="px-4 pb-4 border-t border-slate-200 pt-3">
                                                    <p className="text-xs text-slate-500 mb-2">Copy this code to embed the form in your website or application:</p>
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
                                    <div className="border-t border-slate-200 my-6"></div>

                                    {/* File Input Form */}
                                    {nodes.filter(n => n.type === 'excelInput' || n.type === 'pdfInput').length > 0 && (
                                        <div className="space-y-4 mb-6">
                                            <h3 className="font-normal text-slate-700 flex items-center gap-2">
                                                <Upload size={18} />
                                                File Inputs
                                            </h3>
                                            {nodes.filter(n => n.type === 'excelInput' || n.type === 'pdfInput').map(node => (
                                                <div key={node.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
                                                            className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#256A65] hover:bg-[#256A65]/5 transition-all"
                                                        >
                                                            {runnerFileInputs[node.id] ? (
                                                                <>
                                                                    <CheckCircle className="text-[#256A65]" size={20} />
                                                                    <span className="text-slate-700 font-medium">{runnerFileInputs[node.id]?.name}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="text-slate-400" size={20} />
                                                                    <span className="text-slate-600">Click to upload {node.type === 'excelInput' ? 'Excel/CSV' : 'PDF'}</span>
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
                                            <h3 className="font-normal text-slate-700 flex items-center gap-2">
                                                <Edit size={18} />
                                                Inputs
                                            </h3>
                                            {Object.entries(runnerInputs).map(([nodeId, value]) => {
                                                const node = nodes.find(n => n.id === nodeId);
                                                return (
                                                    <div key={nodeId} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
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
                                                            className="w-full px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
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
                                            : 'bg-slate-800 hover:bg-slate-900'
                                            }`}
                                    >
                                        {isRunningWorkflow ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Running...
                                            </>
                                        ) : (
                                            <>
                                                <PlayCircle size={20} />
                                                Submit
                                            </>
                                        )}
                                    </button>

                                    {/* Output Display */}
                                    {Object.keys(runnerOutputs).length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            <h3 className="font-normal text-slate-700 flex items-center gap-2 border-t pt-6">
                                                <Database size={18} />
                                                Output
                                            </h3>
                                            {Object.entries(runnerOutputs).map(([nodeId, data]) => {
                                                const node = nodes.find(n => n.id === nodeId);
                                                return (
                                                    <div key={nodeId} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                        <h4 className="font-medium text-slate-700 mb-2">{node?.label || 'Output'}</h4>
                                                        <div className="bg-white p-3 rounded border border-slate-300 max-h-64 overflow-auto">
                                                            <pre className="text-xs text-slate-600 whitespace-pre-wrap">
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

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-4 fade-in duration-300 ${
                    toast.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                        {toast.type === 'success' ? (
                            <Check size={18} className="text-emerald-600" />
                        ) : (
                            <X size={18} className="text-red-600" />
                        )}
                    </div>
                    <span className="font-medium text-sm">{toast.message}</span>
                    <button 
                        onClick={() => setToast(null)}
                        className={`ml-2 p-1 rounded-full transition-colors ${
                            toast.type === 'success' 
                                ? 'hover:bg-emerald-100 text-emerald-500' 
                                : 'hover:bg-red-100 text-red-500'
                        }`}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* AI Confirm Dialog */}
            {showAiConfirmDialog && aiGeneratedWorkflow && (
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <Sparkles size={20} className="text-slate-700" />
                                </div>
                                <div>
                                    <h3 className="font-normal text-lg text-slate-800">Workflow Generated!</h3>
                                    <p className="text-sm text-slate-500">
                                        {aiGeneratedWorkflow.nodes.length} nodes, {aiGeneratedWorkflow.connections.length} connections
                                    </p>
                                </div>
                            </div>

                            <p className="text-slate-600 mb-4">
                                How would you like to add this workflow to the canvas?
                            </p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => applyAiWorkflow('replace')}
                                    className="w-full p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                                >
                                    <span className="font-medium text-slate-800">Replace canvas</span>
                                    <p className="text-xs text-slate-500 mt-0.5">Clear existing nodes and start fresh</p>
                                </button>
                                <button
                                    onClick={() => applyAiWorkflow('add')}
                                    className="w-full p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                                >
                                    <span className="font-medium text-slate-800">Add to canvas</span>
                                    <p className="text-xs text-slate-500 mt-0.5">Append nodes to existing workflow</p>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setShowAiConfirmDialog(false);
                                    setAiGeneratedWorkflow(null);
                                }}
                                className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                            <div className="w-1/3 border-r border-slate-200 overflow-y-auto">
                                <div className="p-3 border-b border-slate-100 bg-slate-50">
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
                                    <div className="p-8 text-center text-slate-500">
                                        <div className="w-8 h-8 border-2 border-[#256A65] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Loading...
                                    </div>
                                ) : executionHistory.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        <History size={32} className="mx-auto mb-2 text-slate-300" />
                                        <p>No executions yet</p>
                                        <p className="text-xs mt-1">Run the workflow or send a webhook to see executions here</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {executionHistory.map((exec) => (
                                            <button
                                                key={exec.id}
                                                onClick={() => setSelectedExecution(exec)}
                                                className={`w-full p-3 text-left hover:bg-slate-50 transition-colors ${selectedExecution?.id === exec.id ? 'bg-[#256A65]/5 border-l-2 border-[#256A65]' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                        exec.status === 'completed' ? 'bg-[#256A65]/10 text-[#1e554f]' :
                                                        exec.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        exec.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {exec.status}
                                                    </span>
                                                    {exec.triggerType && (
                                                        <span className="text-xs text-slate-400">{exec.triggerType}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500">{formatDate(exec.createdAt)}</p>
                                                <p className="text-xs text-slate-400 font-mono truncate">{exec.id}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Execution Details */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {selectedExecution ? (
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 rounded-lg p-4">
                                            <h4 className="font-normal text-slate-800 mb-2">Execution Details</h4>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-slate-500">Status:</span>
                                                    <span className={`ml-2 font-medium ${
                                                        selectedExecution.status === 'completed' ? 'text-[#256A65]' :
                                                        selectedExecution.status === 'failed' ? 'text-red-600' :
                                                        'text-slate-600'
                                                    }`}>{selectedExecution.status}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Trigger:</span>
                                                    <span className="ml-2 font-medium text-slate-700">{selectedExecution.triggerType || 'manual'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Started:</span>
                                                    <span className="ml-2 text-slate-700">{formatDate(selectedExecution.startedAt)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Completed:</span>
                                                    <span className="ml-2 text-slate-700">{formatDate(selectedExecution.completedAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedExecution.inputs && Object.keys(selectedExecution.inputs).length > 0 && (
                                            <div className="bg-blue-50 rounded-lg p-4">
                                                <h4 className="font-normal text-blue-800 mb-2 flex items-center gap-2">
                                                    <ArrowRight size={16} />
                                                    Inputs
                                                </h4>
                                                <pre className="text-xs bg-white p-3 rounded border border-blue-100 overflow-x-auto max-h-40">
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
                                                            <div key={nodeId} className="bg-white p-3 rounded border border-[#256A65]/20">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-medium text-slate-700">{nodeLabel}</span>
                                                                    {nodeType && <span className="text-xs text-slate-400">({nodeType})</span>}
                                                                    {result.success && <Check size={14} className="text-[#256A65]" />}
                                                                </div>
                                                                {result.message && (
                                                                    <p className="text-xs text-slate-500 mb-1">{result.message}</p>
                                                                )}
                                                                {result.outputData && (
                                                                    <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-32">
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
                                                <pre className="text-xs bg-white p-3 rounded border border-red-100 text-red-600 overflow-x-auto">
                                                    {selectedExecution.error}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400">
                                        <div className="text-center">
                                            <Eye size={48} className="mx-auto mb-3 text-slate-300" />
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
                <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none" onClick={closeFeedbackPopup}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-[450px] max-w-[90vw] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                <MessageSquare size={20} className="text-[#256A65]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-normal text-slate-800">Share Your Feedback</h3>
                                <p className="text-sm text-slate-500">Node: {feedbackPopupNodeLabel}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                What would you like this node to do?
                            </label>
                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Describe the functionality you'd like to see, any improvements, or share your ideas..."
                                rows={4}
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none placeholder:text-slate-400"
                                autoFocus
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Your feedback helps us improve the platform. Thank you!
                            </p>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={closeFeedbackPopup}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitFeedback}
                                disabled={!feedbackText.trim() || isSubmittingFeedback}
                                className="px-4 py-2 bg-[#256A65] text-white rounded-lg hover:bg-[#1e554f] disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                            >
                                {isSubmittingFeedback ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle size={20} className="text-slate-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Unsaved Changes</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Do you want to save your workflow before leaving?</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 flex gap-2 justify-end">
                            <button
                                onClick={() => setShowExitConfirmation(false)}
                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmExitWithoutSaving}
                                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Don't Save
                            </button>
                            <button
                                onClick={confirmExitWithSaving}
                                disabled={isSaving}
                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
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

            {/* Workflow Templates Modal */}
            {showTemplatesModal && !previewingTemplate && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none" onClick={() => !isCopyingTemplate && setShowTemplatesModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5 text-white rounded-t-xl shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BookOpen size={28} />
                                    <div>
                                        <h3 className="font-normal text-xl">Workflow Templates</h3>
                                        <p className="text-slate-300 text-sm">Pre-built workflows to get you started quickly</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowTemplatesModal(false)}
                                    disabled={isCopyingTemplate}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">Category:</span>
                                <div className="flex gap-2">
                                    {templateCategories.map(category => (
                                        <button
                                            key={category}
                                            onClick={() => setSelectedTemplateCategory(category)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                                selectedTemplateCategory === category
                                                    ? 'bg-slate-700 text-white'
                                                    : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Templates Grid */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map(template => (
                                    <div
                                        key={template.id}
                                        className="bg-white border border-slate-200 rounded-lg p-5 group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-normal text-lg text-slate-800 group-hover:text-slate-900 transition-colors">
                                                    {template.name}
                                                </h4>
                                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full mt-1">
                                                    {template.category}
                                                </span>
                                            </div>
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                                                <Workflow size={20} />
                                            </div>
                                        </div>
                                        
                                        <p className="text-sm text-slate-600 mb-4 min-h-[40px]">
                                            {template.description}
                                        </p>

                                        {/* Mini workflow preview */}
                                        <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-100">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-[#256A65]/50 rounded-full"></div>
                                                    {template.nodes.length} nodes
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="flex items-center gap-1">
                                                    <ArrowRight size={12} />
                                                    {template.connections.length} connections
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {template.nodes.slice(0, 5).map((node, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 bg-white text-slate-600 text-xs rounded border border-slate-200"
                                                    >
                                                        {node.label}
                                                    </span>
                                                ))}
                                                {template.nodes.length > 5 && (
                                                    <span className="px-2 py-0.5 text-slate-400 text-xs">
                                                        +{template.nodes.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setPreviewingTemplate(template)}
                                                className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Eye size={16} />
                                                Preview
                                            </button>
                                            <button
                                                onClick={() => copyTemplateToWorkflows(template)}
                                                disabled={isCopyingTemplate}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg font-medium hover:from-slate-800 hover:to-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
                                            >
                                                {isCopyingTemplate ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Copying...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={16} />
                                                        Use Template
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {filteredTemplates.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                                    <p>No templates found in this category.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl shrink-0">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
                                </p>
                                <button
                                    onClick={() => setShowTemplatesModal(false)}
                                    disabled={isCopyingTemplate}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 font-medium"
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
                <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none" onClick={() => setPreviewingTemplate(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 text-white rounded-t-xl shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Eye size={24} />
                                    <div>
                                        <h3 className="font-normal text-lg">Template Preview</h3>
                                        <p className="text-slate-300 text-sm">{previewingTemplate.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Preview Canvas */}
                        <div className="overflow-hidden bg-slate-100 relative" style={{ height: '400px' }}>
                            <div 
                                className="absolute inset-0 overflow-auto p-8"
                                style={{
                                    backgroundImage: `
                                        linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                                        linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                                    `,
                                    backgroundSize: '20px 20px'
                                }}
                            >
                                {/* SVG Connections - offset by padding (32px) */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '900px', minHeight: '500px' }}>
                                    {previewingTemplate.connections.map(conn => {
                                        const fromNode = previewingTemplate.nodes.find(n => n.id === conn.fromNodeId);
                                        const toNode = previewingTemplate.nodes.find(n => n.id === conn.toNodeId);
                                        if (!fromNode || !toNode) return null;
                                        
                                        // Add 32px offset for the p-8 padding on the container
                                        const padding = 32;
                                        const nodeHeight = 52; // Approximate node height
                                        const nodeWidth = 140;
                                        
                                        const startX = fromNode.x + nodeWidth + padding;
                                        const startY = fromNode.y + (nodeHeight / 2) + padding;
                                        const endX = toNode.x + padding;
                                        const endY = toNode.y + (nodeHeight / 2) + padding;
                                        const midX = (startX + endX) / 2;
                                        
                                        // Color based on connection type
                                        let strokeColor = '#94a3b8';
                                        if (conn.outputType === 'true') strokeColor = '#22c55e';
                                        if (conn.outputType === 'false') strokeColor = '#ef4444';
                                        
                                        return (
                                            <g key={conn.id}>
                                                <path
                                                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                                                    stroke={strokeColor}
                                                    strokeWidth="2"
                                                    fill="none"
                                                    strokeDasharray="6 3"
                                                />
                                                <circle cx={endX} cy={endY} r="4" fill={strokeColor} />
                                            </g>
                                        );
                                    })}
                                </svg>

                                {/* Nodes */}
                                <div className="relative" style={{ minWidth: '900px', minHeight: '500px' }}>
                                    {previewingTemplate.nodes.map(node => {
                                        const IconComponent = getNodeIcon(node.type);
                                        const iconBg = getNodeIconBg(node.type);
                                        
                                        return (
                                            <div
                                                key={node.id}
                                                className="absolute bg-white rounded-lg border-2 border-slate-300 shadow-md p-3 w-[140px]"
                                                style={{ left: node.x, top: node.y }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconBg}`}>
                                                        <IconComponent size={14} />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-700 truncate flex-1">
                                                        {node.label}
                                                    </span>
                                                </div>
                                                {node.type === 'condition' && (
                                                    <div className="flex gap-1 mt-2 text-[10px]">
                                                        <span className="px-1.5 py-0.5 bg-[#256A65]/10 text-[#1e554f] rounded">TRUE</span>
                                                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">FALSE</span>
                                                    </div>
                                                )}
                                                {node.type === 'comment' && node.config?.commentText && (
                                                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
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
                        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h4 className="font-normal text-slate-800">{previewingTemplate.name}</h4>
                                    <p className="text-sm text-slate-500">{previewingTemplate.description}</p>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
                                    {previewingTemplate.category}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-[#256A65]/50 rounded-full"></div>
                                    {previewingTemplate.nodes.length} nodes
                                </span>
                                <span className="flex items-center gap-1">
                                    <ArrowRight size={14} />
                                    {previewingTemplate.connections.length} connections
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl shrink-0">
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                >
                                    Back to Templates
                                </button>
                                <button
                                    onClick={() => {
                                        copyTemplateToWorkflows(previewingTemplate);
                                        setPreviewingTemplate(null);
                                    }}
                                    disabled={isCopyingTemplate}
                                    className="px-5 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg font-medium hover:from-slate-800 hover:to-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                                >
                                    {isCopyingTemplate ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Copying...
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-[#256A65]/5 to-transparent">
                            <h3 className="text-base font-normal text-slate-900">Connect Component</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Search and select a component to connect</p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="px-6 py-4 border-b border-slate-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={componentSearchQuery}
                                    onChange={(e) => setComponentSearchQuery(e.target.value)}
                                    placeholder="Search components..."
                                    className="w-full pl-10 pr-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-slate-400"
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
                                            className="w-full flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-[#256A65] hover:bg-[#256A65]/5 transition-all text-left mb-2 group"
                                        >
                                            <div className={`p-2 rounded-lg flex-shrink-0 ${getNodeIconBg(item.type)}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-normal text-sm text-slate-900 group-hover:text-[#256A65] transition-colors">
                                                    {item.label}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {item.description}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
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
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No components found
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowComponentSearch(false);
                                    setConnectingFromNodeId(null);
                                    setComponentSearchQuery('');
                                }}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};