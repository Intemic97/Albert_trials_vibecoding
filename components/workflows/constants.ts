import React from 'react';
import { 
  Play, 
  FlowArrow, 
  Globe, 
  Database, 
  FileXls, 
  FileText, 
  Lightning, 
  Leaf, 
  PencilSimple, 
  WarningCircle, 
  GitMerge, 
  Columns, 
  Robot, 
  Sparkle, 
  Code, 
  TrendUp, 
  Bell, 
  CheckCircle, 
  UserCheck, 
  Envelope, 
  DeviceMobile, 
  ChartBar, 
  FilePdf, 
  ChatCircle, 
  Flask,
  SlackLogo,
  DiscordLogo,
  MicrosoftTeamsLogo,
  TelegramLogo,
  GoogleLogo
} from '@phosphor-icons/react';
import { DraggableItem, NodeType } from './types';

/**
 * Draggable items for the node palette
 */
export const DRAGGABLE_ITEMS: DraggableItem[] = [
  // Triggers
  { type: 'trigger', label: 'Manual Trigger', icon: Play, description: 'Manually start the workflow', category: 'Triggers' },
  { type: 'trigger', label: 'Schedule', icon: FlowArrow, description: 'Run on a specific schedule', category: 'Triggers' },
  { type: 'webhook', label: 'Webhook', icon: Globe, description: 'Receive data from external services', category: 'Triggers' },
  
  // Data Sources
  { type: 'fetchData', label: 'Fetch Data', icon: Database, description: 'Get records from an entity', category: 'Data' },
  { type: 'excelInput', label: 'Excel/CSV Input', icon: FileXls, description: 'Load data from Excel or CSV', category: 'Data' },
  { type: 'pdfInput', label: 'PDF Input', icon: FileText, description: 'Extract text from PDF files', category: 'Data' },
  { type: 'saveRecords', label: 'Save to Database', icon: Database, description: 'Create or update records', category: 'Data' },
  { type: 'http', label: 'HTTP Request', icon: Globe, description: 'Fetch data from an external API', category: 'Data' },
  { type: 'mysql', label: 'MySQL', icon: Database, description: 'Query data from MySQL database', category: 'Data' },
  { type: 'sapFetch', label: 'SAP S/4HANA', icon: Database, description: 'Read data from SAP S/4HANA OData API', category: 'Data' },
  { type: 'limsFetch', label: 'LIMS Connector', icon: Flask, description: 'Fetch data from Laboratory Information Management System', category: 'Data' },
  { type: 'esios', label: 'Energy Prices', icon: Lightning, description: 'Fetch prices from Red Eléctrica', category: 'Data' },
  { type: 'climatiq', label: 'Emission Factors', icon: Leaf, description: 'Search CO2 emission factors', category: 'Data' },
  { type: 'manualInput', label: 'Manual Data Input', icon: PencilSimple, description: 'Define a variable with a value', category: 'Data' },
  
  // Logic
  { type: 'condition', label: 'If / Else', icon: WarningCircle, description: 'Branch based on conditions', category: 'Logic' },
  { type: 'join', label: 'Join', icon: GitMerge, description: 'Combine data from two sources', category: 'Logic' },
  { type: 'splitColumns', label: 'Split by Columns', icon: Columns, description: 'Split dataset by columns into two outputs', category: 'Logic' },
  { type: 'agent', label: 'AI Agent', icon: Robot, description: 'Autonomous AI agent that can execute workflows and make decisions', category: 'Logic' },
  { type: 'llm', label: 'AI Generation', icon: Sparkle, description: 'Generate text using AI', category: 'Logic' },
  { type: 'python', label: 'Python Code', icon: Code, description: 'Run Python script', category: 'Logic' },
  { type: 'statisticalAnalysis', label: 'Statistical Analysis', icon: TrendUp, description: 'Perform PCA, SPC, or compare with golden batch', category: 'Logic' },
  { type: 'alertAgent', label: 'Alert Agent', icon: Bell, description: 'Configure deterministic alerts with conditions and actions', category: 'Logic' },
  { type: 'addField', label: 'Add Field', icon: CheckCircle, description: 'Add a new field to data', category: 'Logic' },
  { type: 'humanApproval', label: 'Human in the Loop', icon: UserCheck, description: 'Wait for user approval to continue', category: 'Logic' },
  
  // Actions
  { type: 'sendEmail', label: 'Send Email', icon: Envelope, description: 'Send an email notification', category: 'Actions' },
  { type: 'sendSMS', label: 'Send SMS', icon: DeviceMobile, description: 'Send an SMS text message via Twilio', category: 'Actions' },
  { type: 'sendSlack', label: 'Send Slack', icon: SlackLogo, description: 'Send a message to Slack channel', category: 'Actions' },
  { type: 'sendDiscord', label: 'Send Discord', icon: DiscordLogo, description: 'Send a message to Discord channel', category: 'Actions' },
  { type: 'sendTeams', label: 'Send Teams', icon: MicrosoftTeamsLogo, description: 'Send a message to Microsoft Teams', category: 'Actions' },
  { type: 'sendTelegram', label: 'Send Telegram', icon: TelegramLogo, description: 'Send a message to Telegram', category: 'Actions' },
  { type: 'googleSheets', label: 'Google Sheets', icon: GoogleLogo, description: 'Read/write data from Google Sheets', category: 'Data' },
  { type: 'dataVisualization', label: 'Data Visualization', icon: ChartBar, description: 'Generate charts from data using AI', category: 'Actions' },
  { type: 'pdfReport', label: 'PDF Report Generator', icon: FilePdf, description: 'Generate structured PDF reports from data', category: 'Actions' },
  { type: 'action', label: 'Update Record', icon: CheckCircle, description: 'Modify existing records', category: 'Actions' },
  { type: 'output', label: 'Workflow Output', icon: CheckCircle, description: 'Set the final output', category: 'Actions' },
  
  // Other
  { type: 'comment', label: 'Comment', icon: ChatCircle, description: 'Add a comment or note', category: 'Other' },
];

/**
 * Node categories for the palette
 */
export const NODE_CATEGORIES = [
  { id: 'Recents', label: 'Recents', icon: null },
  { id: 'Triggers', label: 'Triggers', icon: Play },
  { id: 'Data', label: 'Data Sources', icon: Database },
  { id: 'Logic', label: 'Data Operations', icon: WarningCircle },
  { id: 'Actions', label: 'Control Flow', icon: CheckCircle },
  { id: 'Other', label: 'Models', icon: Sparkle },
];

/**
 * Node type to icon mapping
 */
export const NODE_ICONS: Record<NodeType, React.ElementType> = {
  trigger: Play,
  action: CheckCircle,
  condition: WarningCircle,
  fetchData: Database,
  addField: CheckCircle,
  saveRecords: Database,
  llm: Sparkle,
  python: Code,
  manualInput: PencilSimple,
  output: CheckCircle,
  comment: ChatCircle,
  http: Globe,
  esios: Lightning,
  climatiq: Leaf,
  humanApproval: UserCheck,
  join: GitMerge,
  excelInput: FileXls,
  pdfInput: FileText,
  splitColumns: Columns,
  mysql: Database,
  sendEmail: Envelope,
  sendSMS: DeviceMobile,
  dataVisualization: ChartBar,
  webhook: Globe,
  sapFetch: Database,
  opcua: Database,
  mqtt: Database,
  agent: Robot,
  limsFetch: Flask,
  statisticalAnalysis: TrendUp,
  alertAgent: Bell,
  pdfReport: FilePdf,
};

/**
 * Canvas constants
 */
export const CANVAS_CONSTANTS = {
  NODE_WIDTH: 320,
  NODE_HALF_WIDTH: 160,
  CONNECTOR_SIZE: 20,
  CONNECTOR_RADIUS: 10,
  DEFAULT_SCALE: 1,
  MIN_SCALE: 0.25,
  MAX_SCALE: 2,
  ZOOM_STEP: 0.1,
  GRID_SIZE: 20,
};

/**
 * Default node colors by status
 */
export const NODE_STATUS_COLORS = {
  idle: 'border-[var(--border-light)]',
  running: 'border-yellow-300 shadow-md',
  completed: 'border-green-300 shadow-md',
  error: 'border-red-300 shadow-md',
  waiting: 'border-orange-300 shadow-md',
};
