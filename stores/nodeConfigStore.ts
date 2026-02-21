import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types for each node configuration
// ============================================================================

export interface ConditionConfig {
  field: string;
  operator: string;
  value: string;
  processingMode: 'batch' | 'perRow';
}

export interface LLMConfig {
  prompt: string;
  contextEntities: string[];
  includeInput: boolean;
  processingMode: 'batch' | 'perRow';
}

export interface PythonConfig {
  code: string;
  aiPrompt: string;
}

export interface JoinConfig {
  strategy: 'concat' | 'mergeByKey';
  joinType: 'inner' | 'outer';
  joinKey: string;
}

export interface SplitColumnsConfig {
  availableColumns: string[];
  outputA: string[];
  outputB: string[];
}

export interface ExcelConfig {
  file: File | null;
  previewData: { headers: string[]; data: any[]; rowCount: number } | null;
}

export interface PdfConfig {
  file: File | null;
  previewData: { text: string; pages: number; fileName: string } | null;
}

export interface ManualInputConfig {
  varName: string;
  varValue: string;
}

export interface HttpConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body: string;
}

export interface WebhookConfig {
  url: string;
  token: string;
}

export interface MySQLConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  query: string;
}

export interface SAPConfig {
  connectionName: string;
  authType: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  baseApiUrl: string;
  servicePath: string;
  entity: string;
}

export interface EmailConfig {
  to: string;
  subject: string;
  body: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
}

export interface SMSConfig {
  to: string;
  message: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface ESIOSConfig {
  indicator: string;
  startDate: string;
  endDate: string;
}

export interface ClimatiqConfig {
  query: string;
  region: string;
  category: string;
}

export interface LIMSConfig {
  server: string;
  database: string;
  query: string;
}

export interface StatisticalConfig {
  analysisType: 'pca' | 'spc' | 'goldenBatch';
  variables: string[];
  targetVariable: string;
}

export interface AlertAgentConfig {
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  actions: Array<{
    type: 'email' | 'sms' | 'webhook';
    config: Record<string, string>;
  }>;
}

export interface PdfReportConfig {
  template: string;
  title: string;
  sections: string[];
}

export interface AddFieldConfig {
  fieldName: string;
  fieldValue: string;
}

export interface SaveRecordsConfig {
  entityId: string;
}

// ============================================================================
// Store State
// ============================================================================

type ConfiguringNodeType = 
  | 'trigger'
  | 'condition'
  | 'llm'
  | 'python'
  | 'join'
  | 'splitColumns'
  | 'excel'
  | 'pdf'
  | 'manualInput'
  | 'http'
  | 'weather'
  | 'webhook'
  | 'mysql'
  | 'sap'
  | 'email'
  | 'sms'
  | 'esios'
  | 'climatiq'
  | 'lims'
  | 'statistical'
  | 'alertAgent'
  | 'pdfReport'
  | 'addField'
  | 'saveRecords'
  | 'fetchData'
  | 'humanApproval'
  | null;

interface NodeConfigState {
  // Currently configuring
  configuringNodeId: string | null;
  configuringNodeType: ConfiguringNodeType;
  
  // Viewing data
  viewingDataNodeId: string | null;
  
  // Loading states
  isGeneratingCode: boolean;
  isParsingFile: boolean;
  
  // Temp configs (while modal is open)
  condition: ConditionConfig;
  llm: LLMConfig;
  python: PythonConfig;
  join: JoinConfig;
  splitColumns: SplitColumnsConfig;
  excel: ExcelConfig;
  pdf: PdfConfig;
  manualInput: ManualInputConfig;
  http: HttpConfig;
  webhook: WebhookConfig;
  mysql: MySQLConfig;
  sap: SAPConfig;
  email: EmailConfig;
  sms: SMSConfig;
  esios: ESIOSConfig;
  climatiq: ClimatiqConfig;
  lims: LIMSConfig;
  statistical: StatisticalConfig;
  alertAgent: AlertAgentConfig;
  pdfReport: PdfReportConfig;
  addField: AddFieldConfig;
  saveRecords: SaveRecordsConfig;
  fetchData: { entityId: string };
  humanApproval: { message: string };
  
  // Actions
  openConfig: (nodeId: string, nodeType: ConfiguringNodeType, existingConfig?: any) => void;
  closeConfig: () => void;
  openDataViewer: (nodeId: string) => void;
  closeDataViewer: () => void;
  
  // Update config actions
  updateCondition: (updates: Partial<ConditionConfig>) => void;
  updateLLM: (updates: Partial<LLMConfig>) => void;
  updatePython: (updates: Partial<PythonConfig>) => void;
  updateJoin: (updates: Partial<JoinConfig>) => void;
  updateSplitColumns: (updates: Partial<SplitColumnsConfig>) => void;
  updateExcel: (updates: Partial<ExcelConfig>) => void;
  updatePdf: (updates: Partial<PdfConfig>) => void;
  updateManualInput: (updates: Partial<ManualInputConfig>) => void;
  updateHttp: (updates: Partial<HttpConfig>) => void;
  updateWebhook: (updates: Partial<WebhookConfig>) => void;
  updateMySQL: (updates: Partial<MySQLConfig>) => void;
  updateSAP: (updates: Partial<SAPConfig>) => void;
  updateEmail: (updates: Partial<EmailConfig>) => void;
  updateSMS: (updates: Partial<SMSConfig>) => void;
  updateESIOS: (updates: Partial<ESIOSConfig>) => void;
  updateClimatiq: (updates: Partial<ClimatiqConfig>) => void;
  updateLIMS: (updates: Partial<LIMSConfig>) => void;
  updateStatistical: (updates: Partial<StatisticalConfig>) => void;
  updateAlertAgent: (updates: Partial<AlertAgentConfig>) => void;
  updatePdfReport: (updates: Partial<PdfReportConfig>) => void;
  updateAddField: (updates: Partial<AddFieldConfig>) => void;
  updateSaveRecords: (updates: Partial<SaveRecordsConfig>) => void;
  updateFetchData: (updates: { entityId: string }) => void;
  updateHumanApproval: (updates: { message: string }) => void;
  
  // Loading states
  setGeneratingCode: (loading: boolean) => void;
  setParsingFile: (loading: boolean) => void;
  
  // Get current config for saving
  getCurrentConfig: () => any;
}

// ============================================================================
// Initial Configs
// ============================================================================

const initialCondition: ConditionConfig = {
  field: '',
  operator: 'isText',
  value: '',
  processingMode: 'batch',
};

const initialLLM: LLMConfig = {
  prompt: '',
  contextEntities: [],
  includeInput: true,
  processingMode: 'batch',
};

const initialPython: PythonConfig = {
  code: 'def process(data):\n    # Modify data here\n    return data',
  aiPrompt: '',
};

const initialJoin: JoinConfig = {
  strategy: 'concat',
  joinType: 'inner',
  joinKey: '',
};

const initialSplitColumns: SplitColumnsConfig = {
  availableColumns: [],
  outputA: [],
  outputB: [],
};

const initialExcel: ExcelConfig = {
  file: null,
  previewData: null,
};

const initialPdf: PdfConfig = {
  file: null,
  previewData: null,
};

const initialManualInput: ManualInputConfig = {
  varName: '',
  varValue: '',
};

const initialHttp: HttpConfig = {
  url: '',
  method: 'GET',
  headers: {},
  body: '',
};

const initialWebhook: WebhookConfig = {
  url: '',
  token: '',
};

const initialMySQL: MySQLConfig = {
  host: 'localhost',
  port: '3306',
  database: '',
  username: '',
  password: '',
  query: 'SELECT * FROM ',
};

const initialSAP: SAPConfig = {
  connectionName: 'SAP_Production',
  authType: 'OAuth2_Client_Credentials',
  clientId: '',
  clientSecret: '',
  tokenUrl: '',
  baseApiUrl: '',
  servicePath: '/sap/opu/odata/sap/',
  entity: '',
};

const initialEmail: EmailConfig = {
  to: '',
  subject: '',
  body: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
};

const initialSMS: SMSConfig = {
  to: '',
  message: '',
  accountSid: '',
  authToken: '',
  fromNumber: '',
};

const initialESIOS: ESIOSConfig = {
  indicator: '',
  startDate: '',
  endDate: '',
};

const initialClimatiq: ClimatiqConfig = {
  query: '',
  region: '',
  category: '',
};

const initialLIMS: LIMSConfig = {
  server: '',
  database: '',
  query: '',
};

const initialStatistical: StatisticalConfig = {
  analysisType: 'pca',
  variables: [],
  targetVariable: '',
};

const initialAlertAgent: AlertAgentConfig = {
  conditions: [],
  actions: [],
};

const initialPdfReport: PdfReportConfig = {
  template: '',
  title: '',
  sections: [],
};

const initialAddField: AddFieldConfig = {
  fieldName: '',
  fieldValue: '',
};

const initialSaveRecords: SaveRecordsConfig = {
  entityId: '',
};

// ============================================================================
// Store
// ============================================================================

export const useNodeConfigStore = create<NodeConfigState>()(
  devtools(
    (set, get) => ({
      configuringNodeId: null,
      configuringNodeType: null,
      viewingDataNodeId: null,
      isGeneratingCode: false,
      isParsingFile: false,
      
      condition: { ...initialCondition },
      llm: { ...initialLLM },
      python: { ...initialPython },
      join: { ...initialJoin },
      splitColumns: { ...initialSplitColumns },
      excel: { ...initialExcel },
      pdf: { ...initialPdf },
      manualInput: { ...initialManualInput },
      http: { ...initialHttp },
      webhook: { ...initialWebhook },
      mysql: { ...initialMySQL },
      sap: { ...initialSAP },
      email: { ...initialEmail },
      sms: { ...initialSMS },
      esios: { ...initialESIOS },
      climatiq: { ...initialClimatiq },
      lims: { ...initialLIMS },
      statistical: { ...initialStatistical },
      alertAgent: { ...initialAlertAgent },
      pdfReport: { ...initialPdfReport },
      addField: { ...initialAddField },
      saveRecords: { ...initialSaveRecords },
      fetchData: { entityId: '' },
      humanApproval: { message: '' },
      
      openConfig: (nodeId, nodeType, existingConfig) => {
        const updates: Partial<NodeConfigState> = {
          configuringNodeId: nodeId,
          configuringNodeType: nodeType,
        };
        
        // Load existing config if provided
        if (existingConfig && nodeType) {
          switch (nodeType) {
            case 'condition':
              updates.condition = { ...initialCondition, ...existingConfig };
              break;
            case 'llm':
              updates.llm = { ...initialLLM, ...existingConfig };
              break;
            case 'python':
              updates.python = { ...initialPython, ...existingConfig };
              break;
            case 'join':
              updates.join = { ...initialJoin, ...existingConfig };
              break;
            case 'splitColumns':
              updates.splitColumns = { ...initialSplitColumns, ...existingConfig };
              break;
            case 'http':
              updates.http = { ...initialHttp, ...existingConfig };
              break;
            case 'mysql':
              updates.mysql = { ...initialMySQL, ...existingConfig };
              break;
            case 'sap':
              updates.sap = { ...initialSAP, ...existingConfig };
              break;
            case 'email':
              updates.email = { ...initialEmail, ...existingConfig };
              break;
            case 'sms':
              updates.sms = { ...initialSMS, ...existingConfig };
              break;
            case 'esios':
              updates.esios = { ...initialESIOS, ...existingConfig };
              break;
            case 'climatiq':
              updates.climatiq = { ...initialClimatiq, ...existingConfig };
              break;
            case 'statistical':
              updates.statistical = { ...initialStatistical, ...existingConfig };
              break;
            case 'alertAgent':
              updates.alertAgent = { ...initialAlertAgent, ...existingConfig };
              break;
            case 'pdfReport':
              updates.pdfReport = { ...initialPdfReport, ...existingConfig };
              break;
            case 'addField':
              updates.addField = { ...initialAddField, ...existingConfig };
              break;
            case 'saveRecords':
              updates.saveRecords = { ...initialSaveRecords, ...existingConfig };
              break;
            case 'fetchData':
              updates.fetchData = { entityId: existingConfig.entityId || '' };
              break;
            case 'manualInput':
              updates.manualInput = { ...initialManualInput, ...existingConfig };
              break;
            case 'webhook':
              updates.webhook = { ...initialWebhook, ...existingConfig };
              break;
            case 'humanApproval':
              updates.humanApproval = { message: existingConfig.message || '' };
              break;
          }
        }
        
        set(updates as any);
      },
      
      closeConfig: () => set({
        configuringNodeId: null,
        configuringNodeType: null,
        // Reset all configs to initial state
        condition: { ...initialCondition },
        llm: { ...initialLLM },
        python: { ...initialPython },
        join: { ...initialJoin },
        splitColumns: { ...initialSplitColumns },
        excel: { ...initialExcel },
        pdf: { ...initialPdf },
        manualInput: { ...initialManualInput },
        http: { ...initialHttp },
        webhook: { ...initialWebhook },
        mysql: { ...initialMySQL },
        sap: { ...initialSAP },
        email: { ...initialEmail },
        sms: { ...initialSMS },
        esios: { ...initialESIOS },
        climatiq: { ...initialClimatiq },
        lims: { ...initialLIMS },
        statistical: { ...initialStatistical },
        alertAgent: { ...initialAlertAgent },
        pdfReport: { ...initialPdfReport },
        addField: { ...initialAddField },
        saveRecords: { ...initialSaveRecords },
        fetchData: { entityId: '' },
        humanApproval: { message: '' },
      }),
      
      openDataViewer: (nodeId) => set({ viewingDataNodeId: nodeId }),
      closeDataViewer: () => set({ viewingDataNodeId: null }),
      
      // Update functions
      updateCondition: (updates) => set((state) => ({
        condition: { ...state.condition, ...updates },
      })),
      updateLLM: (updates) => set((state) => ({
        llm: { ...state.llm, ...updates },
      })),
      updatePython: (updates) => set((state) => ({
        python: { ...state.python, ...updates },
      })),
      updateJoin: (updates) => set((state) => ({
        join: { ...state.join, ...updates },
      })),
      updateSplitColumns: (updates) => set((state) => ({
        splitColumns: { ...state.splitColumns, ...updates },
      })),
      updateExcel: (updates) => set((state) => ({
        excel: { ...state.excel, ...updates },
      })),
      updatePdf: (updates) => set((state) => ({
        pdf: { ...state.pdf, ...updates },
      })),
      updateManualInput: (updates) => set((state) => ({
        manualInput: { ...state.manualInput, ...updates },
      })),
      updateHttp: (updates) => set((state) => ({
        http: { ...state.http, ...updates },
      })),
      updateWebhook: (updates) => set((state) => ({
        webhook: { ...state.webhook, ...updates },
      })),
      updateMySQL: (updates) => set((state) => ({
        mysql: { ...state.mysql, ...updates },
      })),
      updateSAP: (updates) => set((state) => ({
        sap: { ...state.sap, ...updates },
      })),
      updateEmail: (updates) => set((state) => ({
        email: { ...state.email, ...updates },
      })),
      updateSMS: (updates) => set((state) => ({
        sms: { ...state.sms, ...updates },
      })),
      updateESIOS: (updates) => set((state) => ({
        esios: { ...state.esios, ...updates },
      })),
      updateClimatiq: (updates) => set((state) => ({
        climatiq: { ...state.climatiq, ...updates },
      })),
      updateLIMS: (updates) => set((state) => ({
        lims: { ...state.lims, ...updates },
      })),
      updateStatistical: (updates) => set((state) => ({
        statistical: { ...state.statistical, ...updates },
      })),
      updateAlertAgent: (updates) => set((state) => ({
        alertAgent: { ...state.alertAgent, ...updates },
      })),
      updatePdfReport: (updates) => set((state) => ({
        pdfReport: { ...state.pdfReport, ...updates },
      })),
      updateAddField: (updates) => set((state) => ({
        addField: { ...state.addField, ...updates },
      })),
      updateSaveRecords: (updates) => set((state) => ({
        saveRecords: { ...state.saveRecords, ...updates },
      })),
      updateFetchData: (updates) => set({ fetchData: updates }),
      updateHumanApproval: (updates) => set({ humanApproval: updates }),
      
      setGeneratingCode: (loading) => set({ isGeneratingCode: loading }),
      setParsingFile: (loading) => set({ isParsingFile: loading }),
      
      getCurrentConfig: () => {
        const state = get();
        switch (state.configuringNodeType) {
          case 'condition': return state.condition;
          case 'llm': return state.llm;
          case 'python': return state.python;
          case 'join': return state.join;
          case 'splitColumns': return state.splitColumns;
          case 'excel': return state.excel;
          case 'pdf': return state.pdf;
          case 'manualInput': return state.manualInput;
          case 'http': return state.http;
          case 'webhook': return state.webhook;
          case 'mysql': return state.mysql;
          case 'sap': return state.sap;
          case 'email': return state.email;
          case 'sms': return state.sms;
          case 'esios': return state.esios;
          case 'climatiq': return state.climatiq;
          case 'lims': return state.lims;
          case 'statistical': return state.statistical;
          case 'alertAgent': return state.alertAgent;
          case 'pdfReport': return state.pdfReport;
          case 'addField': return state.addField;
          case 'saveRecords': return state.saveRecords;
          case 'fetchData': return state.fetchData;
          case 'humanApproval': return state.humanApproval;
          default: return null;
        }
      },
    }),
    { name: 'node-config-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsConfiguring = (state: NodeConfigState) => state.configuringNodeId !== null;
export const selectConfiguringNodeId = (state: NodeConfigState) => state.configuringNodeId;
export const selectConfiguringNodeType = (state: NodeConfigState) => state.configuringNodeType;
export const selectViewingDataNodeId = (state: NodeConfigState) => state.viewingDataNodeId;
