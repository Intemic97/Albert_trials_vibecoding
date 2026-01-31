/**
 * Node Helper Utilities
 * Functions for node styling, icons, and configuration validation
 */

import { 
    Workflow,
    Lightning,
    Database,
    GitBranch,
    Robot,
    Code,
    EnvelopeSimple,
    ChartBar,
    Plug,
    Table,
    FilePdf,
    FileXls,
    ArrowsLeftRight,
    Columns,
    Globe,
    CloudArrowDown,
    Brain,
    ChatCircle,
    PencilSimple,
    Cpu,
    CloudArrowUp,
    Leaf,
    Flask,
    ShieldWarning,
    Bell,
    UserCheck,
    CheckCircle,
    XCircle,
    Play,
    Clock
} from '@phosphor-icons/react';
import { WorkflowNode } from '../types';
import { DRAGGABLE_ITEMS } from '../constants';

// ============================================================================
// NODE STYLING
// ============================================================================

/**
 * Get CSS classes for node based on type and execution status
 */
export const getNodeColor = (type: string, status?: string): string => {
    const baseStyle = 'bg-[var(--bg-card)] text-[var(--text-primary)]';
    
    if (status === 'completed') return `${baseStyle} border-2 border-green-200 shadow-md`;
    if (status === 'running') return `${baseStyle} border border-[var(--border-light)] shadow-md`;
    if (status === 'error') return `${baseStyle} border border-red-100 shadow-md`;
    if (status === 'waiting') return `${baseStyle} border border-[var(--border-light)] shadow-md`;

    return `${baseStyle} border border-[var(--border-light)] shadow-sm`;
};

/**
 * Get icon text color for node type
 */
export const getNodeIconColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
        'trigger': 'text-cyan-600',
        'action': 'text-blue-600',
        'condition': 'text-[var(--text-secondary)]',
        'fetchData': 'text-indigo-600',
        'humanApproval': 'text-sky-600',
        'addField': 'text-indigo-600',
        'saveRecords': 'text-blue-600',
        'llm': 'text-[var(--text-secondary)]',
        'python': 'text-sky-600',
        'manualInput': 'text-indigo-600',
        'output': 'text-indigo-600',
        'http': 'text-cyan-600',
        'mysql': 'text-blue-600',
        'sapFetch': 'text-indigo-600',
        'limsFetch': 'text-purple-600',
        'statisticalAnalysis': 'text-emerald-600',
        'alertAgent': 'text-orange-600',
        'pdfReport': 'text-red-600',
        'esios': 'text-cyan-600',
        'climatiq': 'text-sky-600',
        'join': 'text-cyan-600',
        'splitColumns': 'text-sky-600',
        'excelInput': 'text-indigo-600',
        'pdfInput': 'text-indigo-600',
        'sendEmail': 'text-blue-600',
        'sendSMS': 'text-blue-600',
        'dataVisualization': 'text-indigo-600',
        'webhook': 'text-cyan-600',
        'agent': 'text-purple-600',
        'opcua': 'text-indigo-600',
        'mqtt': 'text-cyan-600'
    };
    return colorMap[type] || 'text-[var(--text-secondary)]';
};

/**
 * Get icon background color (same as icon color for consistency)
 */
export const getNodeIconBg = (type: string): string => {
    return getNodeIconColor(type);
};

/**
 * Get icon component for node type
 */
export const getNodeIcon = (type: string): React.ElementType => {
    const item = DRAGGABLE_ITEMS.find(i => i.type === type);
    return item?.icon || Workflow;
};

// ============================================================================
// NODE CONFIGURATION VALIDATION
// ============================================================================

/**
 * Check if a node is properly configured
 */
export const isNodeConfigured = (node: WorkflowNode): boolean => {
    const configChecks: { [key: string]: (node: WorkflowNode) => boolean } = {
        'fetchData': (n) => !!n.config?.entityId,
        'condition': (n) => !!n.config?.conditionField,
        'addField': (n) => !!n.config?.conditionField,
        'saveRecords': (n) => !!n.config?.entityId,
        'llm': (n) => !!n.config?.llmPrompt,
        'python': (n) => !!n.config?.pythonCode,
        'join': (n) => !!n.config?.joinStrategy,
        'splitColumns': (n) => (n.config?.columnsOutputA?.length || 0) > 0 || (n.config?.columnsOutputB?.length || 0) > 0,
        'excelInput': (n) => !!n.config?.fileName,
        'pdfInput': (n) => !!n.config?.pdfText,
        'manualInput': (n) => !!n.config?.inputVarName,
        'http': (n) => !!n.config?.httpUrl,
        'webhook': () => true,
        'mysql': (n) => !!n.config?.mysqlQuery,
        'sapFetch': () => true,
        'limsFetch': (n) => !!(n.config?.limsServerUrl && n.config?.limsApiKey),
        'statisticalAnalysis': (n) => !!n.config?.statisticalMethod,
        'alertAgent': (n) => !!n.config?.alertConditions,
        'pdfReport': (n) => !!n.config?.pdfTemplate,
        'sendEmail': (n) => !!n.config?.emailTo,
        'sendSMS': (n) => !!n.config?.smsTo,
        'dataVisualization': (n) => !!n.config?.generatedWidget,
        'esios': (n) => !!n.config?.esiosArchiveId,
        'climatiq': (n) => !!n.config?.climatiqFactor,
        'humanApproval': (n) => !!n.config?.assignedUserId,
        'comment': (n) => !!n.config?.commentText,
        'trigger': () => true,
        'action': () => true,
        'output': () => true,
        'agent': () => true,
        'opcua': () => true,
        'mqtt': () => true
    };

    const check = configChecks[node.type];
    return check ? check(node) : false;
};

// ============================================================================
// NODE STATUS TAGS
// ============================================================================

interface NodeTag {
    label: string;
    color: string;
    icon: React.ElementType;
}

/**
 * Get the status tag to display above a node
 */
export const getNodeTopTag = (node: WorkflowNode): NodeTag | null => {
    const hasFeedback = node.executionResult || !isNodeConfigured(node);
    if (hasFeedback) {
        return null;
    }
    
    if (node.status && node.status !== 'idle') {
        if (node.status === 'error') {
            return { label: 'Error', color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle };
        }
        
        if (isNodeConfigured(node)) {
            const statusMap: { [key: string]: NodeTag } = {
                'completed': { label: 'Completed', color: 'bg-green-50 border-green-200 text-green-700', icon: CheckCircle },
                'running': { label: 'Running', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: Play },
                'waiting': { label: 'Waiting', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: Clock }
            };
            return statusMap[node.status] || null;
        }
    }
    
    return null;
};

// ============================================================================
// CATEGORY STYLING
// ============================================================================

interface CategoryColors {
    bg: string;
    hover: string;
}

/**
 * Get colors for category styling
 */
export const getCategoryColors = (categoryName: string): CategoryColors => {
    const colorMap: { [key: string]: CategoryColors } = {
        'Recents': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Triggers': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Data Sources': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Data Operations': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Control Flow': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Models': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Agents': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Code': { bg: 'bg-[var(--bg-primary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Output & Logging': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Notifications': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' },
        'Advanced': { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' }
    };
    return colorMap[categoryName] || { bg: 'bg-[var(--bg-tertiary)]', hover: 'hover:bg-[var(--bg-hover)]' };
};

// ============================================================================
// TEMPLATE CATEGORY STYLING
// ============================================================================

export const TEMPLATE_CATEGORY_COLORS: { [key: string]: string } = {
    'Compliance': 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    'Process Optimization': 'from-amber-500/10 to-orange-500/5 border-amber-500/20',
    'Planning': 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    'Reporting': 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20',
    'Quality Assurance': 'from-rose-500/10 to-pink-500/5 border-rose-500/20'
};

export const TEMPLATE_TEXT_COLORS: { [key: string]: string } = {
    'Compliance': 'text-blue-600',
    'Process Optimization': 'text-amber-600',
    'Planning': 'text-purple-600',
    'Reporting': 'text-emerald-600',
    'Quality Assurance': 'text-rose-600'
};
