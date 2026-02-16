/**
 * Pre-defined workflow templates
 * Provides ready-to-use workflow configurations for common use cases
 */

import { WorkflowNode, Connection } from './types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Compliance' | 'Process Optimization' | 'Planning' | 'Reporting' | 'Quality Assurance';
  nodes: WorkflowNode[];
  connections: Connection[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
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
  // OT/Industrial Templates
  {
    id: 'template-ot-continuous-ingestion',
    name: 'Ingesta Continua desde Shopfloor',
    description: 'Captura continua de datos desde PLCs y sensores industriales (OPC UA/MQTT) y almacenamiento en time-series para análisis posterior.',
    category: 'Process Optimization',
    nodes: [
      { id: 'ot1-trigger', type: 'trigger', label: 'Schedule Trigger', x: 100, y: 200 },
      { id: 'ot1-opcua', type: 'opcua', label: 'OPC UA Input', x: 300, y: 200, config: { opcuaPollingInterval: 5000 } },
      { id: 'ot1-aggregator', type: 'timeSeriesAggregator', label: 'Time-Series Aggregator', x: 500, y: 200, config: { timeSeriesAggregationType: 'avg', timeSeriesInterval: '5m' } },
      { id: 'ot1-save', type: 'saveRecords', label: 'Save to Time-Series', x: 700, y: 200 },
    ],
    connections: [
      { id: 'cot1-1', fromNodeId: 'ot1-trigger', toNodeId: 'ot1-opcua' },
      { id: 'cot1-2', fromNodeId: 'ot1-opcua', toNodeId: 'ot1-aggregator' },
      { id: 'cot1-3', fromNodeId: 'ot1-aggregator', toNodeId: 'ot1-save' },
    ]
  },
  {
    id: 'template-ot-mqtt-sensor-ingestion',
    name: 'Ingesta de Sensores IoT via MQTT',
    description: 'Suscripción a topics MQTT para capturar datos de sensores IoT y almacenarlos en time-series para monitoreo en tiempo real.',
    category: 'Process Optimization',
    nodes: [
      { id: 'ot2-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
      { id: 'ot2-mqtt', type: 'mqtt', label: 'MQTT Subscriber', x: 300, y: 200, config: { mqttQos: 1 } },
      { id: 'ot2-save', type: 'saveRecords', label: 'Save Sensor Data', x: 500, y: 200 },
    ],
    connections: [
      { id: 'cot2-1', fromNodeId: 'ot2-trigger', toNodeId: 'ot2-mqtt' },
      { id: 'cot2-2', fromNodeId: 'ot2-mqtt', toNodeId: 'ot2-save' },
    ]
  },
  {
    id: 'template-ot-quality-monitoring',
    name: 'Monitoreo de Calidad en Tiempo Real',
    description: 'Lectura de datos desde SCADA/MES, análisis de calidad y generación de alertas cuando se detectan desviaciones.',
    category: 'Quality Assurance',
    nodes: [
      { id: 'ot3-trigger', type: 'trigger', label: 'Schedule Trigger', x: 100, y: 200 },
      { id: 'ot3-scada', type: 'scada', label: 'SCADA Data', x: 300, y: 200 },
      { id: 'ot3-condition', type: 'condition', label: 'Check Quality Limits', x: 500, y: 200, config: { conditionField: 'quality', conditionOperator: 'greaterThan', conditionValue: 'threshold' } },
      { id: 'ot3-alert', type: 'sendEmail', label: 'Send Alert', x: 700, y: 150 },
      { id: 'ot3-save', type: 'saveRecords', label: 'Log Quality Data', x: 700, y: 250 },
    ],
    connections: [
      { id: 'cot3-1', fromNodeId: 'ot3-trigger', toNodeId: 'ot3-scada' },
      { id: 'cot3-2', fromNodeId: 'ot3-scada', toNodeId: 'ot3-condition' },
      { id: 'cot3-3', fromNodeId: 'ot3-condition', toNodeId: 'ot3-alert', outputType: 'true' },
      { id: 'cot3-4', fromNodeId: 'ot3-condition', toNodeId: 'ot3-save', outputType: 'false' },
    ]
  },
  {
    id: 'template-ot-production-analytics',
    name: 'Análisis de Producción desde MES',
    description: 'Extracción de datos de producción desde MES, agregación por turno/lote y generación de reportes de eficiencia.',
    category: 'Reporting',
    nodes: [
      { id: 'ot4-trigger', type: 'trigger', label: 'Schedule Trigger', x: 100, y: 200 },
      { id: 'ot4-mes', type: 'mes', label: 'MES Data', x: 300, y: 200 },
      { id: 'ot4-aggregator', type: 'timeSeriesAggregator', label: 'Aggregate by Shift', x: 500, y: 200, config: { timeSeriesAggregationType: 'sum', timeSeriesInterval: '8h' } },
      { id: 'ot4-visualization', type: 'dataVisualization', label: 'Production Dashboard', x: 700, y: 200 },
      { id: 'ot4-save', type: 'saveRecords', label: 'Save Analytics', x: 900, y: 200 },
    ],
    connections: [
      { id: 'cot4-1', fromNodeId: 'ot4-trigger', toNodeId: 'ot4-mes' },
      { id: 'cot4-2', fromNodeId: 'ot4-mes', toNodeId: 'ot4-aggregator' },
      { id: 'cot4-3', fromNodeId: 'ot4-aggregator', toNodeId: 'ot4-visualization' },
      { id: 'cot4-4', fromNodeId: 'ot4-visualization', toNodeId: 'ot4-save' },
    ]
  },
  {
    id: 'template-ot-historical-analysis',
    name: 'Análisis Histórico desde Data Historian',
    description: 'Consulta de datos históricos desde Data Historian, análisis estadístico y comparación con lotes de referencia.',
    category: 'Quality Assurance',
    nodes: [
      { id: 'ot5-trigger', type: 'trigger', label: 'Manual Trigger', x: 100, y: 200 },
      { id: 'ot5-historian', type: 'dataHistorian', label: 'Data Historian Query', x: 300, y: 200 },
      { id: 'ot5-statistical', type: 'statisticalAnalysis', label: 'Statistical Analysis', x: 500, y: 200, config: { statisticalMethod: 'spc' } },
      { id: 'ot5-output', type: 'output', label: 'Analysis Results', x: 700, y: 200 },
    ],
    connections: [
      { id: 'cot5-1', fromNodeId: 'ot5-trigger', toNodeId: 'ot5-historian' },
      { id: 'cot5-2', fromNodeId: 'ot5-historian', toNodeId: 'ot5-statistical' },
      { id: 'cot5-3', fromNodeId: 'ot5-statistical', toNodeId: 'ot5-output' },
    ]
  },
];

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: WorkflowTemplate['category']): WorkflowTemplate[] => {
  return WORKFLOW_TEMPLATES.filter(t => t.category === category);
};

/**
 * Get all unique categories
 */
export const getTemplateCategories = (): WorkflowTemplate['category'][] => {
  return [...new Set(WORKFLOW_TEMPLATES.map(t => t.category))];
};
