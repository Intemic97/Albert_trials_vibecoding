import { WidgetConfig } from '../DynamicChart';

/**
 * Types for Workflow components
 */

export type NodeType = 
  | 'trigger' 
  | 'action' 
  | 'condition' 
  | 'fetchData' 
  | 'addField' 
  | 'saveRecords' 
  | 'llm' 
  | 'python' 
  | 'manualInput' 
  | 'output' 
  | 'comment' 
  | 'http' 
  | 'esios' 
  | 'climatiq' 
  | 'humanApproval' 
  | 'join' 
  | 'excelInput' 
  | 'pdfInput' 
  | 'splitColumns' 
  | 'mysql' 
  | 'sendEmail' 
  | 'sendSMS' 
  | 'dataVisualization' 
  | 'webhook' 
  | 'sapFetch' 
  | 'opcua' 
  | 'mqtt' 
  | 'modbus'
  | 'kafka'
  | 'restApi'
  | 'scada'
  | 'mes'
  | 'dataHistorian'
  | 'timeSeriesAggregator'
  | 'agent' 
  | 'limsFetch' 
  | 'statisticalAnalysis' 
  | 'alertAgent' 
  | 'pdfReport';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'waiting';

export interface NodeConfig {
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
  joinType?: 'inner' | 'outer';
  joinKey?: string;
  // For excel input nodes:
  fileName?: string;
  headers?: string[];
  parsedData?: any[];
  previewData?: any[];
  rowCount?: number;
  gcsPath?: string;
  useGCS?: boolean;
  // For PDF input nodes:
  pdfText?: string;
  pages?: number;
  info?: any;
  metadata?: any;
  // Processing mode
  processingMode?: 'batch' | 'perRow';
  // For split columns nodes:
  columnsOutputA?: string[];
  columnsOutputB?: string[];
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
  // For LIMS Fetch nodes:
  limsServerUrl?: string;
  limsApiKey?: string;
  limsEndpoint?: string;
  limsQuery?: string;
  // For Statistical Analysis nodes:
  statisticalMethod?: 'pca' | 'spc' | 'regression' | 'goldenBatch';
  statisticalParams?: string;
  goldenBatchId?: string;
  // For Alert Agent nodes:
  alertConditions?: string;
  alertSeverity?: 'critical' | 'warning' | 'info';
  alertActions?: string[];
  alertRecipients?: string;
  // For PDF Report nodes:
  pdfTemplate?: string;
  pdfReportData?: string;
  pdfOutputPath?: string;
  // For OPC UA nodes:
  opcuaConnectionId?: string;
  opcuaNodeIds?: string[];
  opcuaPollingInterval?: number;
  // For MQTT nodes:
  mqttConnectionId?: string;
  mqttTopics?: string[];
  mqttQos?: number;
  // For Modbus nodes:
  modbusConnectionId?: string;
  modbusAddresses?: string[];
  modbusFunctionCode?: number;
  // For SCADA nodes:
  scadaConnectionId?: string;
  scadaTags?: string[];
  scadaPollingInterval?: number;
  // For MES nodes:
  mesConnectionId?: string;
  mesEndpoint?: string;
  mesQuery?: string;
  // For Data Historian nodes:
  dataHistorianConnectionId?: string;
  dataHistorianTags?: string[];
  dataHistorianStartTime?: string;
  dataHistorianEndTime?: string;
  dataHistorianAggregation?: string;
  // For Time-Series Aggregator nodes:
  timeSeriesAggregationType?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  timeSeriesInterval?: string; // e.g., "5m", "1h", "1d"
  timeSeriesFields?: string[];
  // Alert configuration
  alerts?: {
    enabled: boolean;
    cooldown?: number; // milliseconds
    thresholds?: Record<string, {
      min?: number;
      max?: number;
      operator: 'gt' | 'lt' | 'range' | 'warning_gt' | 'warning_lt';
    }>;
  };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  status?: NodeStatus;
  config?: NodeConfig;
  executionResult?: string;
  data?: any;
  inputData?: any;
  inputDataA?: any;
  inputDataB?: any;
  outputData?: any;
  conditionResult?: boolean;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  outputType?: 'true' | 'false' | 'A' | 'B';
  inputPort?: 'A' | 'B';
}

export interface DraggableItem {
  type: NodeType;
  label: string;
  icon: React.ElementType;
  description: string;
  category: 'Triggers' | 'Data' | 'Logic' | 'Actions' | 'Other';
}

export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  lastEditedByName?: string;
  tags?: string[];
  publicAccess?: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  nodeResults?: Record<string, any>;
  duration?: number;
}

// Canvas state
export interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Drag state
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  nodeId?: string;
}

// Connection drag state
export interface ConnectionDragState {
  nodeId: string;
  x?: number;
  y?: number;
  outputType?: 'true' | 'false' | 'A' | 'B';
}
