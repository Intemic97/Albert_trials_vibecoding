/**
 * Panel Component Generator
 * 
 * Reads raw panel extracts and generates self-managing component files.
 * Each component initializes its own local state from node.config.
 * 
 * Usage: node components/_generate_panels.cjs
 */

const fs = require('fs');
const path = require('path');

const PANELS_DIR = path.join(__dirname, 'Workflows', 'panels');
const RAW_DIR = path.join(PANELS_DIR, '_raw');
const WORKFLOWS_PATH = path.join(__dirname, 'Workflows.tsx');

// Read source for JSX extraction
const source = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
const srcLines = source.split('\n');

// ============================================================================
// PANEL DEFINITIONS
// ============================================================================

const panels = [
  {
    name: 'HttpConfigPanel',
    varName: 'configuringHttpNodeId',
    setterName: 'setConfiguringHttpNodeId',
    saveFnName: 'saveHttpConfig',
    title: 'Configure HTTP Request',
    icon: 'Globe',
    extraIcons: ['MessageSquare'],
    startLine: 7485, endLine: 7537,
    isIIFE: false,
    state: [
      { name: 'httpUrl', setter: 'setHttpUrl', default: "''", configKey: 'httpUrl' },
    ],
    saveConfig: '{ httpUrl }',
    saveCondition: '!httpUrl.trim()',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'WebhookConfigPanel',
    varName: 'configuringWebhookNodeId',
    setterName: 'setConfiguringWebhookNodeId',
    saveFnName: null, // no save, just close
    title: 'Webhook Configuration',
    icon: 'Globe',
    extraIcons: [],
    startLine: 7540, endLine: 7621,
    isIIFE: false,
    state: [
      { name: 'webhookUrl', setter: 'setWebhookUrl', default: "''", configKey: 'webhookUrl' },
      { name: 'webhookToken', setter: 'setWebhookToken', default: "''", configKey: 'webhookToken' },
    ],
    saveConfig: null, // webhook panel only shows info, no save
    extraProps: ['showToast', 'generateId', 'API_BASE'],
    needsFeedback: false,
    needsInitLogic: true, // needs to generate URL on mount if not configured
  },
  {
    name: 'WebhookResponseConfigPanel',
    varName: 'configuringWebhookResponseNodeId',
    setterName: 'setConfiguringWebhookResponseNodeId',
    saveFnName: null,
    title: 'Webhook Response',
    icon: 'Globe',
    extraIcons: ['MessageSquare'],
    startLine: 7624, endLine: 7822,
    isIIFE: true,
    state: [], // reads directly from node.config in IIFE
    saveConfig: null, // saves via setNodes inline
    extraProps: ['showToast'],
    needsFeedback: true,
    rawComponent: true, // needs manual handling
  },
  {
    name: 'MySQLConfigPanel',
    varName: 'configuringMySQLNodeId',
    setterName: 'setConfiguringMySQLNodeId',
    saveFnName: 'saveMySQLConfig',
    title: 'MySQL Connection',
    icon: 'Database',
    extraIcons: ['MessageSquare'],
    startLine: 7825, endLine: 7936,
    isIIFE: false,
    state: [
      { name: 'mysqlHost', setter: 'setMysqlHost', default: "'localhost'", configKey: 'mysqlHost' },
      { name: 'mysqlPort', setter: 'setMysqlPort', default: "'3306'", configKey: 'mysqlPort' },
      { name: 'mysqlDatabase', setter: 'setMysqlDatabase', default: "''", configKey: 'mysqlDatabase' },
      { name: 'mysqlUsername', setter: 'setMysqlUsername', default: "''", configKey: 'mysqlUsername' },
      { name: 'mysqlPassword', setter: 'setMysqlPassword', default: "''", configKey: 'mysqlPassword' },
      { name: 'mysqlQuery', setter: 'setMysqlQuery', default: "'SELECT * FROM '", configKey: 'mysqlQuery' },
    ],
    saveConfig: '{ mysqlHost, mysqlPort, mysqlDatabase, mysqlUsername, mysqlPassword, mysqlQuery }',
    labelTemplate: "`MySQL: ${mysqlDatabase || 'query'}`",
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'SAPConfigPanel',
    varName: 'configuringSAPNodeId',
    setterName: 'setConfiguringSAPNodeId',
    saveFnName: 'saveSAPConfig',
    title: 'SAP Connection (OData)',
    icon: 'Database',
    extraIcons: ['Eye', 'EyeSlash', 'MessageSquare'],
    startLine: 7939, endLine: 8093,
    isIIFE: false,
    state: [
      { name: 'sapConnectionName', setter: 'setSapConnectionName', default: "'SAP_Production'", configKey: 'sapConnectionName' },
      { name: 'sapAuthType', setter: 'setSapAuthType', default: "'OAuth2_Client_Credentials'", configKey: 'sapAuthType' },
      { name: 'sapClientId', setter: 'setSapClientId', default: "''", configKey: 'sapClientId' },
      { name: 'sapClientSecret', setter: 'setSapClientSecret', default: "''", configKey: 'sapClientSecret' },
      { name: 'sapTokenUrl', setter: 'setSapTokenUrl', default: "''", configKey: 'sapTokenUrl' },
      { name: 'sapBaseApiUrl', setter: 'setSapBaseApiUrl', default: "''", configKey: 'sapBaseApiUrl' },
      { name: 'sapServicePath', setter: 'setSapServicePath', default: "'/sap/opu/odata/sap/'", configKey: 'sapServicePath' },
      { name: 'sapEntity', setter: 'setSapEntity', default: "''", configKey: 'sapEntity' },
    ],
    saveConfig: '{ sapConnectionName, sapAuthType, sapClientId, sapClientSecret, sapTokenUrl, sapBaseApiUrl, sapServicePath, sapEntity }',
    labelTemplate: "`SAP: ${sapEntity || 'connection'}`",
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'OsiPiConfigPanel',
    varName: 'configuringOsiPiNodeId',
    setterName: 'setConfiguringOsiPiNodeId',
    saveFnName: 'saveOsiPiConfig',
    title: 'OSIsoft PI Configuration',
    icon: 'ChartLine',
    extraIcons: ['Eye', 'EyeSlash', 'Plus', 'Trash', 'MessageSquare'],
    startLine: 8096, endLine: 8251,
    isIIFE: false,
    state: [
      { name: 'osiPiHost', setter: 'setOsiPiHost', default: "''", configKey: 'osiPiHost' },
      { name: 'osiPiApiKey', setter: 'setOsiPiApiKey', default: "''", configKey: 'osiPiApiKey' },
      { name: 'osiPiGranularityValue', setter: 'setOsiPiGranularityValue', default: "'5'", configKey: 'osiPiGranularityValue' },
      { name: 'osiPiGranularityUnit', setter: 'setOsiPiGranularityUnit', default: "'seconds'", configKey: 'osiPiGranularityUnit' },
      { name: 'osiPiWebIds', setter: 'setOsiPiWebIds', default: "['', '']", configKey: 'osiPiWebIds' },
      { name: 'showOsiPiApiKey', setter: 'setShowOsiPiApiKey', default: 'false', configKey: null },
    ],
    saveConfig: '{ osiPiHost, osiPiApiKey, osiPiGranularityValue, osiPiGranularityUnit, osiPiWebIds }',
    labelTemplate: "`OSI PI: ${osiPiHost || 'config'}`",
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'FranmitConfigPanel',
    varName: 'configuringFranmitNodeId',
    setterName: 'setConfiguringFranmitNodeId',
    saveFnName: 'saveFranmitConfig',
    title: 'FranMIT Configuration',
    icon: 'Factory',
    extraIcons: ['Eye', 'EyeSlash', 'MessageSquare'],
    startLine: 8254, endLine: 8363,
    isIIFE: false,
    state: [
      { name: 'franmitApiSecretId', setter: 'setFranmitApiSecretId', default: "''", configKey: 'franmitApiSecretId' },
      { name: 'franmitReactorVolume', setter: 'setFranmitReactorVolume', default: "''", configKey: 'franmitReactorVolume' },
      { name: 'franmitReactionVolume', setter: 'setFranmitReactionVolume', default: "''", configKey: 'franmitReactionVolume' },
      { name: 'franmitCatalystScaleFactor', setter: 'setFranmitCatalystScaleFactor', default: "''", configKey: 'franmitCatalystScaleFactor' },
      { name: 'showFranmitApiSecret', setter: 'setShowFranmitApiSecret', default: 'false', configKey: null },
    ],
    saveConfig: '{ franmitApiSecretId, franmitReactorVolume, franmitReactionVolume, franmitCatalystScaleFactor }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'ConveyorConfigPanel',
    varName: 'configuringConveyorNodeId',
    setterName: 'setConfiguringConveyorNodeId',
    saveFnName: 'saveConveyorConfig',
    title: 'Conveyor Belt Configuration',
    icon: 'Gear',
    extraIcons: ['MessageSquare'],
    startLine: 8366, endLine: 8576,
    isIIFE: false,
    state: [
      { name: 'conveyorSpeed', setter: 'setConveyorSpeed', default: "''", configKey: 'conveyorSpeed' },
      { name: 'conveyorLength', setter: 'setConveyorLength', default: "''", configKey: 'conveyorLength' },
      { name: 'conveyorWidth', setter: 'setConveyorWidth', default: "''", configKey: 'conveyorWidth' },
      { name: 'conveyorInclination', setter: 'setConveyorInclination', default: "''", configKey: 'conveyorInclination' },
      { name: 'conveyorLoadCapacity', setter: 'setConveyorLoadCapacity', default: "''", configKey: 'conveyorLoadCapacity' },
      { name: 'conveyorBeltType', setter: 'setConveyorBeltType', default: "'flat'", configKey: 'conveyorBeltType' },
      { name: 'conveyorMotorPower', setter: 'setConveyorMotorPower', default: "''", configKey: 'conveyorMotorPower' },
      { name: 'conveyorFrictionCoeff', setter: 'setConveyorFrictionCoeff', default: "''", configKey: 'conveyorFrictionCoeff' },
    ],
    saveConfig: '{ conveyorSpeed, conveyorLength, conveyorWidth, conveyorInclination, conveyorLoadCapacity, conveyorBeltType, conveyorMotorPower, conveyorFrictionCoeff }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'LIMSConfigPanel',
    varName: 'configuringLIMSNodeId',
    setterName: 'setConfiguringLIMSNodeId',
    saveFnName: 'saveLIMSConfig',
    title: 'LIMS Connection',
    icon: 'Database',
    extraIcons: ['MessageSquare'],
    startLine: 8579, endLine: 8665,
    isIIFE: false,
    state: [
      { name: 'limsServerUrl', setter: 'setLimsServerUrl', default: "''", configKey: 'limsServerUrl' },
      { name: 'limsApiKey', setter: 'setLimsApiKey', default: "''", configKey: 'limsApiKey' },
      { name: 'limsEndpoint', setter: 'setLimsEndpoint', default: "'materials'", configKey: 'limsEndpoint' },
      { name: 'limsQuery', setter: 'setLimsQuery', default: "''", configKey: 'limsQuery' },
    ],
    saveConfig: '{ limsServerUrl, limsApiKey, limsEndpoint, limsQuery }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'StatisticalConfigPanel',
    varName: 'configuringStatisticalNodeId',
    setterName: 'setConfiguringStatisticalNodeId',
    saveFnName: 'saveStatisticalConfig',
    title: 'Statistical Analysis',
    icon: 'ChartBar',
    extraIcons: ['MessageSquare'],
    startLine: 8668, endLine: 8737,
    isIIFE: false,
    state: [
      { name: 'statisticalMethod', setter: 'setStatisticalMethod', default: "'goldenBatch'", configKey: 'statisticalMethod' },
      { name: 'statisticalParams', setter: 'setStatisticalParams', default: "'{}'", configKey: 'statisticalParams' },
      { name: 'goldenBatchId', setter: 'setGoldenBatchId', default: "''", configKey: 'goldenBatchId' },
    ],
    saveConfig: '{ statisticalMethod, statisticalParams, goldenBatchId }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'AlertAgentConfigPanel',
    varName: 'configuringAlertAgentNodeId',
    setterName: 'setConfiguringAlertAgentNodeId',
    saveFnName: 'saveAlertAgentConfig',
    title: 'Alert Agent',
    icon: 'Bell',
    extraIcons: ['MessageSquare'],
    startLine: 8740, endLine: 8827,
    isIIFE: false,
    state: [
      { name: 'alertConditions', setter: 'setAlertConditions', default: "'[]'", configKey: 'alertConditions' },
      { name: 'alertSeverity', setter: 'setAlertSeverity', default: "'warning'", configKey: 'alertSeverity' },
      { name: 'alertActions', setter: 'setAlertActions', default: "['email']", configKey: 'alertActions' },
      { name: 'alertRecipients', setter: 'setAlertRecipients', default: "''", configKey: 'alertRecipients' },
    ],
    saveConfig: '{ alertConditions, alertSeverity, alertActions, alertRecipients }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'PdfReportConfigPanel',
    varName: 'configuringPdfReportNodeId',
    setterName: 'setConfiguringPdfReportNodeId',
    saveFnName: 'savePdfReportConfig',
    title: 'PDF Report Generator',
    icon: 'FilePdf',
    extraIcons: ['MessageSquare'],
    startLine: 8830, endLine: 8898,
    isIIFE: false,
    state: [
      { name: 'pdfTemplate', setter: 'setPdfTemplate', default: "'standard'", configKey: 'pdfTemplate' },
      { name: 'pdfReportData', setter: 'setPdfReportData', default: "'{}'", configKey: 'pdfReportData' },
      { name: 'pdfOutputPath', setter: 'setPdfOutputPath', default: "''", configKey: 'pdfOutputPath' },
    ],
    saveConfig: '{ pdfTemplate, pdfReportData, pdfOutputPath }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'EsiosConfigPanel',
    varName: 'configuringEsiosNodeId',
    setterName: 'setConfiguringEsiosNodeId',
    saveFnName: 'saveEsiosConfig',
    title: 'ESIOS (REE) Configuration',
    icon: 'Lightning',
    extraIcons: ['MessageSquare'],
    startLine: 9742, endLine: 9809,
    isIIFE: false,
    state: [
      { name: 'esiosArchiveId', setter: 'setEsiosArchiveId', default: "'1001'", configKey: 'esiosArchiveId' },
      { name: 'esiosDate', setter: 'setEsiosDate', default: "new Date().toISOString().split('T')[0]", configKey: 'esiosDate' },
    ],
    saveConfig: '{ esiosArchiveId, esiosDate }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'AddFieldConfigPanel',
    varName: 'configuringAddFieldNodeId',
    setterName: 'setConfiguringAddFieldNodeId',
    saveFnName: 'saveAddFieldConfig',
    title: 'Add Field',
    icon: 'Plus',
    extraIcons: ['MessageSquare'],
    startLine: 10739, endLine: 10790,
    isIIFE: false,
    state: [
      { name: 'addFieldName', setter: 'setAddFieldName', default: "''", configKey: 'addFieldName' },
      { name: 'addFieldValue', setter: 'setAddFieldValue', default: "''", configKey: 'addFieldValue' },
    ],
    saveConfig: '{ addFieldName, addFieldValue }',
    extraProps: [],
    needsFeedback: true,
  },
  {
    name: 'ManualInputConfigPanel',
    varName: 'configuringManualInputNodeId',
    setterName: 'setConfiguringManualInputNodeId',
    saveFnName: 'saveManualInputConfig',
    title: 'Manual Input',
    icon: 'PencilSimple',
    extraIcons: ['MessageSquare'],
    startLine: 11808, endLine: 11862,
    isIIFE: false,
    state: [
      { name: 'manualInputVarName', setter: 'setManualInputVarName', default: "''", configKey: 'manualInputVarName' },
      { name: 'manualInputVarValue', setter: 'setManualInputVarValue', default: "''", configKey: 'manualInputVarValue' },
    ],
    saveConfig: '{ manualInputVarName, manualInputVarValue }',
    extraProps: [],
    needsFeedback: true,
  },
];

// ============================================================================
// HELPER: Extract JSX block from source
// ============================================================================

function extractJSX(startLine, endLine, isIIFE) {
  // startLine/endLine are 1-indexed
  const block = srcLines.slice(startLine - 1, endLine);
  
  // Remove the outer conditional wrapper
  let inner;
  if (isIIFE) {
    // {configuringXNodeId && (() => { ... })()}
    // Skip first line and last line
    inner = block.slice(1, -1);
  } else {
    // {configuringXNodeId && (  ...  )}
    inner = block.slice(1, -1);
  }
  
  // Find base indentation
  const firstContent = inner.find(l => l.trim().length > 0);
  if (!firstContent) return '';
  const baseIndent = firstContent.match(/^(\s*)/)[1].length;
  
  // Normalize indentation (remove base, add 4 spaces)
  const normalized = inner.map(line => {
    if (line.trim().length === 0) return '';
    const curr = line.match(/^(\s*)/)[1].length;
    const newIndent = Math.max(0, curr - baseIndent + 4);
    return ' '.repeat(newIndent) + line.trim();
  });
  
  return normalized.join('\n');
}

// ============================================================================
// GENERATE COMPONENT FILES
// ============================================================================

let generated = 0;
let totalLines = 0;

for (const panel of panels) {
  const jsx = extractJSX(panel.startLine, panel.endLine, panel.isIIFE);
  
  // Collect icon imports
  const allIcons = new Set([panel.icon, ...panel.extraIcons]);
  // Scan JSX for additional icon references
  const iconRe = /\b(Globe|Database|Code|ChartLine|ChartBar|Lightning|Factory|Gear|Bell|FilePdf|Plus|Trash|Eye|EyeSlash|PencilSimple|MessageSquare|X|CaretDown|CaretUp|Info|Warning|Check|Copy|Sparkle|Robot|EnvelopeSimple|Phone|WhatsappLogo|Timer|Calendar|User|Users|ShieldCheck|FloppyDisk|Wrench|CloudArrowUp|MagnifyingGlass|FileText|Table|Download|Upload|ArrowRight|ArrowsLeftRight|Play|GitBranch|TreeStructure|Swap|Funnel|FunnelSimple|Columns|SplitVertical|Palette|Leaf|Plugs|Activity|HandPalm|ChatCircleText|ClipboardText)\b/g;
  let m;
  while ((m = iconRe.exec(jsx)) !== null) {
    allIcons.add(m[1]);
  }
  
  // Build state initialization
  const stateInits = panel.state
    .map(s => {
      const defaultVal = s.configKey 
        ? `node?.config?.${s.configKey} || ${s.default}`
        : s.default;
      return `  const [${s.name}, ${s.setter}] = useState(${defaultVal});`;
    })
    .join('\n');
  
  // Build save handler
  let saveHandler = '';
  if (panel.saveConfig) {
    const labelLine = panel.labelTemplate 
      ? `\n    onSave(nodeId, ${panel.saveConfig}, ${panel.labelTemplate});`
      : `\n    onSave(nodeId, ${panel.saveConfig});`;
    
    saveHandler = `
  const handleSave = () => {${panel.saveCondition ? `\n    if (${panel.saveCondition}) return;` : ''}${labelLine}
  };`;
  }
  
  // Transform JSX: replace parent scope references with local equivalents
  let transformedJSX = jsx;
  
  // Replace setConfiguringXNodeId(null) with onClose()
  transformedJSX = transformedJSX.replace(
    new RegExp(`${panel.setterName}\\(null\\)`, 'g'),
    'onClose()'
  );
  
  // Replace saveXConfig references with handleSave
  if (panel.saveFnName) {
    transformedJSX = transformedJSX.replace(
      new RegExp(`${panel.saveFnName}`, 'g'),
      'handleSave'
    );
  }
  
  // Replace configuringXNodeId with nodeId (but not the setter)
  transformedJSX = transformedJSX.replace(
    new RegExp(`(?<!set)${panel.varName}`, 'g'),
    'nodeId'
  );
  
  // Replace closeWebhookConfig and similar specific close functions
  transformedJSX = transformedJSX.replace(
    /close\w+Config/g,
    'onClose'
  );
  
  // Build extra props
  const extraPropDefs = panel.extraProps
    .map(p => {
      if (p === 'showToast') return '  showToast: (message: string, type: string) => void;';
      if (p === 'generateId') return '  generateId: () => string;';
      if (p === 'API_BASE') return '  API_BASE: string;';
      if (p === 'entities') return '  entities: any[];';
      if (p === 'connections') return '  connections: any[];';
      if (p === 'token') return '  token: string;';
      return `  ${p}: any;`;
    })
    .join('\n');
  
  // Build props interface
  const propsInterface = `interface ${panel.name}Props {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
${extraPropDefs}
}`;

  // Build component
  const propsDestructure = [
    'nodeId', 'node', 'onSave', 'onClose',
    panel.needsFeedback ? 'openFeedbackPopup' : null,
    ...panel.extraProps,
  ].filter(Boolean).join(', ');
  
  const component = `/**
 * ${panel.name}
 * Extracted from Workflows.tsx lines ${panel.startLine}-${panel.endLine}
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { ${Array.from(allIcons).sort().join(', ')} } from '@phosphor-icons/react';

${propsInterface}

export const ${panel.name}: React.FC<${panel.name}Props> = ({ ${propsDestructure} }) => {
${stateInits}
${saveHandler}

  return (
${transformedJSX}
  );
};
`;

  // Write file
  const filePath = path.join(PANELS_DIR, `${panel.name}.tsx`);
  fs.writeFileSync(filePath, component);
  generated++;
  totalLines += component.split('\n').length;
  console.log(`  Generated: ${panel.name}.tsx (${component.split('\n').length} lines)`);
}

// ============================================================================
// GENERATE INDEX FILE
// ============================================================================

const indexContent = `/**
 * Config Panel Components
 * Extracted from Workflows.tsx - each panel self-manages its own state
 */

${panels.map(p => `export { ${p.name} } from './${p.name}';`).join('\n')}
`;

fs.writeFileSync(path.join(PANELS_DIR, 'index.ts'), indexContent);

// ============================================================================
// GENERATE REPLACEMENT SNIPPET FOR WORKFLOWS.TSX
// ============================================================================

let replacementSnippet = `
// ==================== CONFIG PANEL COMPONENTS ====================
// Import at top of file:
// import { ${panels.map(p => p.name).join(', ')} } from './Workflows/panels';

// Replace inline JSX panels (lines ${panels[0].startLine}-${panels[panels.length-1].endLine}) with:

`;

for (const panel of panels) {
  const propsStr = panel.extraProps.map(p => ` ${p}={${p}}`).join('');
  replacementSnippet += `                        <${panel.name}
                            nodeId={${panel.varName}}
                            node={nodes.find(n => n.id === ${panel.varName})}
                            onSave={handlePanelSave}
                            onClose={() => ${panel.setterName}(null)}${panel.needsFeedback ? '\n                            openFeedbackPopup={openFeedbackPopup}' : ''}${propsStr}
                        />\n\n`;
}

replacementSnippet += `
// Add this helper function in Workflows.tsx:
// const handlePanelSave = (nodeId: string, config: Record<string, any>, label?: string) => {
//     setNodes(prev => prev.map(n =>
//         n.id === nodeId
//             ? { ...n, ...(label ? { label } : {}), config: { ...n.config, ...config } }
//             : n
//     ));
// };
`;

fs.writeFileSync(path.join(PANELS_DIR, '_replacement_guide.txt'), replacementSnippet);

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n=== SUMMARY ===`);
console.log(`Generated: ${generated} component files`);
console.log(`Total lines: ${totalLines}`);
console.log(`Index file: panels/index.ts`);
console.log(`Replacement guide: panels/_replacement_guide.txt`);
console.log(`\nRemaining panels that need manual handling:`);
console.log(`- WebhookResponseConfigPanel (IIFE with inline config reads)`);
console.log(`- EmailConfigPanel (IIFE with connections lookup)`);
console.log(`- SMSConfigPanel (IIFE with connections lookup)`);
console.log(`- WhatsAppConfigPanel (IIFE with connections lookup)`);
console.log(`- RenameColumnsConfigPanel (IIFE with column rename logic)`);
console.log(`- VisualizationConfigPanel (IIFE with AI generation)`);
console.log(`- ClimatiqConfigPanel (API search)`);
console.log(`- HumanApprovalConfigPanel (API user loading)`);
console.log(`- ConditionConfigPanel (IIFE with complex logic)`);
console.log(`- JoinConfigPanel (IIFE)`);
console.log(`- SplitColumnsConfigPanel (IIFE with drag-drop)`);
console.log(`- ExcelConfigPanel (file upload)`);
console.log(`- PdfConfigPanel (file upload)`);
console.log(`- SaveRecordsConfigPanel (entity creation)`);
console.log(`- LLMConfigPanel (entity selection)`);
console.log(`- PythonConfigPanel (AI code generation)`);
console.log(`- ScheduleConfigPanel`);

