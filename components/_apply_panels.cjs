/**
 * Apply Panel Components to Workflows.tsx
 * 
 * Replaces inline panel JSX blocks with component calls.
 * Also adds the import statement and helper function.
 * 
 * Usage: node components/_apply_panels.cjs
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_PATH = path.join(__dirname, 'Workflows.tsx');

// Read source
let source = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
const originalLines = source.split('\n').length;

// ============================================================================
// PANEL DEFINITIONS (start line -> component call)
// ============================================================================

// Each panel: start line (1-indexed), varName, component name, extra props
const panels = [
  // These are ordered from LAST to FIRST so replacements don't shift line numbers
  { startLine: 13044, varName: 'configuringScheduleNodeId', component: 'ScheduleConfigPanel', 
    extraProps: '' },
  { startLine: 11808, varName: 'configuringManualInputNodeId', component: 'ManualInputConfigPanel',
    extraProps: '' },
  { startLine: 11684, varName: 'configuringPythonNodeId', component: 'PythonConfigPanel',
    extraProps: '\n                            token={token}' },
  { startLine: 11548, varName: 'configuringLLMNodeId', component: 'LLMConfigPanel',
    extraProps: '\n                            entities={entities}' },
  { startLine: 11405, varName: 'configuringSaveNodeId', component: 'SaveRecordsConfigPanel',
    extraProps: '\n                            entities={entities}\n                            token={token}\n                            organizationId={organizationId}' },
  { startLine: 11306, varName: 'configuringPdfNodeId', component: 'PdfConfigPanel',
    extraProps: '\n                            handlePdfFileChange={handlePdfFileChange}\n                            pdfFile={pdfFile}\n                            pdfPreviewData={pdfPreviewData}\n                            isParsingPdf={isParsingPdf}' },
  { startLine: 11193, varName: 'configuringExcelNodeId', component: 'ExcelConfigPanel',
    extraProps: '\n                            handleExcelFileChange={handleExcelFileChange}\n                            excelFile={excelFile}\n                            excelPreviewData={excelPreviewData}\n                            isParsingExcel={isParsingExcel}' },
  { startLine: 10974, varName: 'configuringSplitColumnsNodeId', component: 'SplitColumnsConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 10793, varName: 'configuringJoinNodeId', component: 'JoinConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 10739, varName: 'configuringAddFieldNodeId', component: 'AddFieldConfigPanel',
    extraProps: '' },
  { startLine: 10400, varName: 'configuringConditionNodeId', component: 'ConditionConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 9942, varName: 'configuringHumanApprovalNodeId', component: 'HumanApprovalConfigPanel',
    extraProps: '\n                            token={token}\n                            organizationId={organizationId}' },
  { startLine: 9812, varName: 'configuringClimatiqNodeId', component: 'ClimatiqConfigPanel',
    extraProps: '\n                            token={token}' },
  { startLine: 9742, varName: 'configuringEsiosNodeId', component: 'EsiosConfigPanel',
    extraProps: '' },
  { startLine: 9573, varName: 'configuringVisualizationNodeId', component: 'VisualizationConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}\n                            token={token}' },
  { startLine: 9396, varName: 'configuringRenameColumnsNodeId', component: 'RenameColumnsConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 9241, varName: 'configuringWhatsAppNodeId', component: 'WhatsAppConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 9086, varName: 'configuringSMSNodeId', component: 'SMSConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 8901, varName: 'configuringEmailNodeId', component: 'EmailConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            connections={connections}' },
  { startLine: 8830, varName: 'configuringPdfReportNodeId', component: 'PdfReportConfigPanel',
    extraProps: '' },
  { startLine: 8740, varName: 'configuringAlertAgentNodeId', component: 'AlertAgentConfigPanel',
    extraProps: '' },
  { startLine: 8668, varName: 'configuringStatisticalNodeId', component: 'StatisticalConfigPanel',
    extraProps: '' },
  { startLine: 8579, varName: 'configuringLIMSNodeId', component: 'LIMSConfigPanel',
    extraProps: '' },
  { startLine: 8366, varName: 'configuringConveyorNodeId', component: 'ConveyorConfigPanel',
    extraProps: '' },
  { startLine: 8254, varName: 'configuringFranmitNodeId', component: 'FranmitConfigPanel',
    extraProps: '' },
  { startLine: 8096, varName: 'configuringOsiPiNodeId', component: 'OsiPiConfigPanel',
    extraProps: '' },
  { startLine: 7939, varName: 'configuringSAPNodeId', component: 'SAPConfigPanel',
    extraProps: '' },
  { startLine: 7825, varName: 'configuringMySQLNodeId', component: 'MySQLConfigPanel',
    extraProps: '' },
  { startLine: 7624, varName: 'configuringWebhookResponseNodeId', component: 'WebhookResponseConfigPanel',
    extraProps: '\n                            nodes={nodes}\n                            onUpdateConfig={handlePanelSave}',
    isWebhookResponse: true },
  { startLine: 7540, varName: 'configuringWebhookNodeId', component: 'WebhookConfigPanel',
    extraProps: '\n                            showToast={showToast}\n                            generateId={generateId}\n                            API_BASE={API_BASE}' },
  { startLine: 7485, varName: 'configuringHttpNodeId', component: 'HttpConfigPanel',
    extraProps: '' },
];

// ============================================================================
// FIND PANEL END LINES (using brace counting from start)
// ============================================================================

const lines = source.split('\n');

function findPanelEnd(startIdx) {
  let depth = 0;
  let started = false;
  
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '{') { depth++; started = true; }
      if (ch === '}') { 
        depth--; 
        if (started && depth === 0) return i;
      }
    }
  }
  return -1;
}

// ============================================================================
// REPLACE INLINE PANELS (from last to first to preserve line numbers)
// ============================================================================

// Sort by startLine descending
panels.sort((a, b) => b.startLine - a.startLine);

let replaced = 0;
let linesRemoved = 0;

for (const panel of panels) {
  const startIdx = panel.startLine - 1; // 0-indexed
  const endIdx = findPanelEnd(startIdx);
  
  if (endIdx === -1) {
    console.log(`  ERROR: Could not find end for ${panel.component} (start: ${panel.startLine})`);
    continue;
  }
  
  const removedCount = endIdx - startIdx + 1;
  
  // Generate replacement component call
  const setterName = panel.varName.replace('configuring', 'setConfiguring');
  
  let componentCall;
  if (panel.isWebhookResponse) {
    // WebhookResponse uses onUpdateConfig instead of onSave
    componentCall = `                        {${panel.varName} && (
                            <${panel.component}
                                nodeId={${panel.varName}!}
                                nodes={nodes}
                                onUpdateConfig={handlePanelSave}
                                onClose={() => ${setterName}(null)}
                                openFeedbackPopup={openFeedbackPopup}
                            />
                        )}`;
  } else {
    componentCall = `                        {${panel.varName} && (
                            <${panel.component}
                                nodeId={${panel.varName}!}
                                node={nodes.find(n => n.id === ${panel.varName})}
                                onSave={handlePanelSave}
                                onClose={() => ${setterName}(null)}
                                openFeedbackPopup={openFeedbackPopup}${panel.extraProps}
                            />
                        )}`;
  }
  
  // Replace the lines
  lines.splice(startIdx, removedCount, componentCall);
  
  replaced++;
  linesRemoved += removedCount - componentCall.split('\n').length;
  console.log(`  Replaced: ${panel.component} (removed ${removedCount} lines, added ${componentCall.split('\n').length} lines)`);
}

// ============================================================================
// ADD IMPORT STATEMENT
// ============================================================================

// Find where to add the import (after existing imports)
const importInsertLine = lines.findIndex(l => l.includes("from './Workflows/types'"));
if (importInsertLine >= 0) {
  const panelImport = `import {
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
} from './Workflows/panels';`;
  
  lines.splice(importInsertLine + 1, 0, panelImport);
  console.log(`\n  Added import statement after line ${importInsertLine + 1}`);
}

// ============================================================================
// ADD handlePanelSave HELPER FUNCTION
// ============================================================================

// Find closeAllConfigs function and add handlePanelSave after it
const closeAllIdx = lines.findIndex(l => l.includes('const closeAllConfigs'));
if (closeAllIdx >= 0) {
  // Find the end of closeAllConfigs
  let depth = 0, endIdx = closeAllIdx;
  for (let i = closeAllIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (depth === 0 && i > closeAllIdx) break;
  }
  
  const helperFn = `
    // Generic save handler for extracted panel components
    const handlePanelSave = (nodeId: string, config: Record<string, any>, label?: string) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId
                ? { ...n, ...(label ? { label } : {}), config: { ...n.config, ...config } }
                : n
        ));
    };`;
  
  lines.splice(endIdx + 1, 0, helperFn);
  console.log(`  Added handlePanelSave function after closeAllConfigs`);
}

// ============================================================================
// WRITE MODIFIED FILE
// ============================================================================

const newSource = lines.join('\n');
const newLineCount = newSource.split('\n').length;

fs.writeFileSync(WORKFLOWS_PATH, newSource);

console.log(`\n=== SUMMARY ===`);
console.log(`Panels replaced: ${replaced}`);
console.log(`Original lines: ${originalLines}`);
console.log(`New lines: ${newLineCount}`);
console.log(`Lines removed: ${originalLines - newLineCount}`);
console.log(`Reduction: ${((originalLines - newLineCount) / originalLines * 100).toFixed(1)}%`);

