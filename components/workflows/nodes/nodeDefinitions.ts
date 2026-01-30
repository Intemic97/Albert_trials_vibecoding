import React from 'react';
import { 
  Play, 
  Database, 
  WarningCircle, 
  Sparkle, 
  Code, 
  CheckCircle,
  Globe,
  Lightning,
  Leaf,
  PencilSimple,
  ChatCircle,
  UserCheck,
  GitMerge,
  FileXls,
  FileText,
  Columns,
  Envelope,
  DeviceMobile,
  ChartBar,
  Robot,
  Flask,
  TrendUp,
  Bell,
  FilePdf,
} from '@phosphor-icons/react';
import { NodeType, NodeStatus } from '../types';

/**
 * Node category definitions
 */
export type NodeCategory = 'triggers' | 'data' | 'logic' | 'actions' | 'other';

/**
 * Definition for a node type
 */
export interface NodeDefinition {
  type: NodeType;
  label: string;
  description: string;
  category: NodeCategory;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  hasMultipleOutputs?: boolean;
  hasMultipleInputs?: boolean;
  outputLabels?: string[];
  inputLabels?: string[];
  configFields?: string[];
  validationRules?: {
    requiredConfig?: string[];
    maxConnections?: { input?: number; output?: number };
  };
}

/**
 * Node definitions registry
 */
export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  // Triggers
  trigger: {
    type: 'trigger',
    label: 'Manual Trigger',
    description: 'Manually start the workflow',
    category: 'triggers',
    icon: Play,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  webhook: {
    type: 'webhook',
    label: 'Webhook',
    description: 'Receive data from external services',
    category: 'triggers',
    icon: Globe,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },

  // Data Sources
  fetchData: {
    type: 'fetchData',
    label: 'Fetch Data',
    description: 'Get records from an entity',
    category: 'data',
    icon: Database,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    configFields: ['entityId', 'entityName'],
    validationRules: {
      requiredConfig: ['entityId'],
    },
  },
  excelInput: {
    type: 'excelInput',
    label: 'Excel/CSV Input',
    description: 'Load data from Excel or CSV',
    category: 'data',
    icon: FileXls,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  pdfInput: {
    type: 'pdfInput',
    label: 'PDF Input',
    description: 'Extract text from PDF files',
    category: 'data',
    icon: FileText,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  saveRecords: {
    type: 'saveRecords',
    label: 'Save to Database',
    description: 'Create or update records',
    category: 'data',
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  http: {
    type: 'http',
    label: 'HTTP Request',
    description: 'Fetch data from an external API',
    category: 'data',
    icon: Globe,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    configFields: ['httpUrl'],
  },
  mysql: {
    type: 'mysql',
    label: 'MySQL',
    description: 'Query data from MySQL database',
    category: 'data',
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  sapFetch: {
    type: 'sapFetch',
    label: 'SAP S/4HANA',
    description: 'Read data from SAP S/4HANA OData API',
    category: 'data',
    icon: Database,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  limsFetch: {
    type: 'limsFetch',
    label: 'LIMS Connector',
    description: 'Fetch data from Laboratory Information Management System',
    category: 'data',
    icon: Flask,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  esios: {
    type: 'esios',
    label: 'Energy Prices',
    description: 'Fetch prices from Red Eléctrica',
    category: 'data',
    icon: Lightning,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  climatiq: {
    type: 'climatiq',
    label: 'Emission Factors',
    description: 'Search CO2 emission factors',
    category: 'data',
    icon: Leaf,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  manualInput: {
    type: 'manualInput',
    label: 'Manual Data Input',
    description: 'Define a variable with a value',
    category: 'data',
    icon: PencilSimple,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },

  // Logic
  condition: {
    type: 'condition',
    label: 'If / Else',
    description: 'Branch based on conditions',
    category: 'logic',
    icon: WarningCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hasMultipleOutputs: true,
    outputLabels: ['True', 'False'],
    configFields: ['conditionField', 'conditionOperator', 'conditionValue', 'processingMode'],
  },
  join: {
    type: 'join',
    label: 'Join',
    description: 'Combine data from two sources',
    category: 'logic',
    icon: GitMerge,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    hasMultipleInputs: true,
    inputLabels: ['A', 'B'],
  },
  splitColumns: {
    type: 'splitColumns',
    label: 'Split by Columns',
    description: 'Split dataset by columns into two outputs',
    category: 'logic',
    icon: Columns,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    hasMultipleOutputs: true,
    outputLabels: ['A', 'B'],
  },
  agent: {
    type: 'agent',
    label: 'AI Agent',
    description: 'Autonomous AI agent that can execute workflows',
    category: 'logic',
    icon: Robot,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  llm: {
    type: 'llm',
    label: 'AI Generation',
    description: 'Generate text using AI',
    category: 'logic',
    icon: Sparkle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    configFields: ['llmPrompt', 'llmContextEntities', 'llmIncludeInput'],
  },
  python: {
    type: 'python',
    label: 'Python Code',
    description: 'Run Python script',
    category: 'logic',
    icon: Code,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    configFields: ['pythonCode', 'pythonAiPrompt'],
  },
  statisticalAnalysis: {
    type: 'statisticalAnalysis',
    label: 'Statistical Analysis',
    description: 'Perform PCA, SPC, or compare with golden batch',
    category: 'logic',
    icon: TrendUp,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  alertAgent: {
    type: 'alertAgent',
    label: 'Alert Agent',
    description: 'Configure deterministic alerts with conditions',
    category: 'logic',
    icon: Bell,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  addField: {
    type: 'addField',
    label: 'Add Field',
    description: 'Add a new field to data',
    category: 'logic',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  humanApproval: {
    type: 'humanApproval',
    label: 'Human in the Loop',
    description: 'Wait for user approval to continue',
    category: 'logic',
    icon: UserCheck,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },

  // Actions
  sendEmail: {
    type: 'sendEmail',
    label: 'Send Email',
    description: 'Send an email notification',
    category: 'actions',
    icon: Envelope,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  sendSMS: {
    type: 'sendSMS',
    label: 'Send SMS',
    description: 'Send an SMS text message via Twilio',
    category: 'actions',
    icon: DeviceMobile,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  dataVisualization: {
    type: 'dataVisualization',
    label: 'Data Visualization',
    description: 'Generate charts from data using AI',
    category: 'actions',
    icon: ChartBar,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  pdfReport: {
    type: 'pdfReport',
    label: 'PDF Report Generator',
    description: 'Generate structured PDF reports from data',
    category: 'actions',
    icon: FilePdf,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  action: {
    type: 'action',
    label: 'Update Record',
    description: 'Modify existing records',
    category: 'actions',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  output: {
    type: 'output',
    label: 'Workflow Output',
    description: 'Set the final output',
    category: 'actions',
    icon: CheckCircle,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },

  // Other
  comment: {
    type: 'comment',
    label: 'Comment',
    description: 'Add a comment or note',
    category: 'other',
    icon: ChatCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },

  // Industrial/IoT (placeholders)
  opcua: {
    type: 'opcua',
    label: 'OPC UA',
    description: 'Connect to OPC UA servers',
    category: 'data',
    icon: Database,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  mqtt: {
    type: 'mqtt',
    label: 'MQTT',
    description: 'Subscribe to MQTT topics',
    category: 'data',
    icon: Database,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

/**
 * Get node definition by type
 */
export const getNodeDefinition = (type: NodeType): NodeDefinition => {
  return NODE_DEFINITIONS[type];
};

/**
 * Get all nodes of a category
 */
export const getNodesByCategory = (category: NodeCategory): NodeDefinition[] => {
  return Object.values(NODE_DEFINITIONS).filter(def => def.category === category);
};

/**
 * Check if node type has multiple outputs
 */
export const hasMultipleOutputs = (type: NodeType): boolean => {
  return NODE_DEFINITIONS[type]?.hasMultipleOutputs ?? false;
};

/**
 * Check if node type has multiple inputs
 */
export const hasMultipleInputs = (type: NodeType): boolean => {
  return NODE_DEFINITIONS[type]?.hasMultipleInputs ?? false;
};

/**
 * Get status colors for nodes
 */
export const getStatusStyles = (status?: NodeStatus): { border: string; shadow: string } => {
  switch (status) {
    case 'running':
      return { border: 'border-yellow-400', shadow: 'shadow-yellow-100' };
    case 'completed':
      return { border: 'border-green-400', shadow: 'shadow-green-100' };
    case 'error':
      return { border: 'border-red-400', shadow: 'shadow-red-100' };
    case 'waiting':
      return { border: 'border-orange-400', shadow: 'shadow-orange-100' };
    default:
      return { border: 'border-[var(--border-light)]', shadow: '' };
  }
};
