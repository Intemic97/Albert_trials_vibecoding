/**
 * Panel Extraction Script
 * 
 * Reads Workflows.tsx, extracts each config panel JSX block,
 * and generates individual component files in Workflows/panels/
 * 
 * Usage: node components/_extract_panels.js
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_PATH = path.join(__dirname, 'Workflows.tsx');
const PANELS_DIR = path.join(__dirname, 'Workflows', 'panels');

// Read the source file
const source = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
const lines = source.split('\n');

// ============================================================================
// PANEL DEFINITIONS
// Each panel has: start line (1-indexed), varName, component name, etc.
// ============================================================================

const panels = [
  { startLine: 7485, varName: 'configuringHttpNodeId', component: 'HttpConfigPanel', isIIFE: false },
  { startLine: 7540, varName: 'configuringWebhookNodeId', component: 'WebhookConfigPanel', isIIFE: false },
  { startLine: 7624, varName: 'configuringWebhookResponseNodeId', component: 'WebhookResponseConfigPanel', isIIFE: true },
  { startLine: 7825, varName: 'configuringMySQLNodeId', component: 'MySQLConfigPanel', isIIFE: false },
  { startLine: 7939, varName: 'configuringSAPNodeId', component: 'SAPConfigPanel', isIIFE: false },
  { startLine: 8096, varName: 'configuringOsiPiNodeId', component: 'OsiPiConfigPanel', isIIFE: false },
  { startLine: 8254, varName: 'configuringFranmitNodeId', component: 'FranmitConfigPanel', isIIFE: false },
  { startLine: 8366, varName: 'configuringConveyorNodeId', component: 'ConveyorConfigPanel', isIIFE: false },
  { startLine: 8579, varName: 'configuringLIMSNodeId', component: 'LIMSConfigPanel', isIIFE: false },
  { startLine: 8668, varName: 'configuringStatisticalNodeId', component: 'StatisticalConfigPanel', isIIFE: false },
  { startLine: 8740, varName: 'configuringAlertAgentNodeId', component: 'AlertAgentConfigPanel', isIIFE: false },
  { startLine: 8830, varName: 'configuringPdfReportNodeId', component: 'PdfReportConfigPanel', isIIFE: false },
  { startLine: 8901, varName: 'configuringEmailNodeId', component: 'EmailConfigPanel', isIIFE: true },
  { startLine: 9086, varName: 'configuringSMSNodeId', component: 'SMSConfigPanel', isIIFE: true },
  { startLine: 9241, varName: 'configuringWhatsAppNodeId', component: 'WhatsAppConfigPanel', isIIFE: true },
  { startLine: 9396, varName: 'configuringRenameColumnsNodeId', component: 'RenameColumnsConfigPanel', isIIFE: true },
  { startLine: 9573, varName: 'configuringVisualizationNodeId', component: 'VisualizationConfigPanel', isIIFE: true },
  { startLine: 9742, varName: 'configuringEsiosNodeId', component: 'EsiosConfigPanel', isIIFE: false },
  { startLine: 9812, varName: 'configuringClimatiqNodeId', component: 'ClimatiqConfigPanel', isIIFE: false },
  { startLine: 9942, varName: 'configuringHumanApprovalNodeId', component: 'HumanApprovalConfigPanel', isIIFE: false },
  { startLine: 10400, varName: 'configuringConditionNodeId', component: 'ConditionConfigPanel', isIIFE: true },
  { startLine: 10739, varName: 'configuringAddFieldNodeId', component: 'AddFieldConfigPanel', isIIFE: false },
  { startLine: 10793, varName: 'configuringJoinNodeId', component: 'JoinConfigPanel', isIIFE: true },
  { startLine: 10974, varName: 'configuringSplitColumnsNodeId', component: 'SplitColumnsConfigPanel', isIIFE: true },
  { startLine: 11193, varName: 'configuringExcelNodeId', component: 'ExcelConfigPanel', isIIFE: false },
  { startLine: 11306, varName: 'configuringPdfNodeId', component: 'PdfConfigPanel', isIIFE: false },
  { startLine: 11405, varName: 'configuringSaveNodeId', component: 'SaveRecordsConfigPanel', isIIFE: false },
  { startLine: 11548, varName: 'configuringLLMNodeId', component: 'LLMConfigPanel', isIIFE: false },
  { startLine: 11684, varName: 'configuringPythonNodeId', component: 'PythonConfigPanel', isIIFE: false },
  { startLine: 11808, varName: 'configuringManualInputNodeId', component: 'ManualInputConfigPanel', isIIFE: false },
  { startLine: 13044, varName: 'configuringScheduleNodeId', component: 'ScheduleConfigPanel', isIIFE: false },
];

// ============================================================================
// FIND PANEL END LINES
// Uses brace counting from the start line to find matching close
// ============================================================================

function findPanelEnd(startIdx) {
  // startIdx is 0-indexed
  let depth = 0;
  let started = false;
  
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    // Count { and } but skip those inside strings/template literals
    // Simple approach: just count braces
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
// EXTRACT PANELS
// ============================================================================

console.log('=== Panel Extraction Analysis ===\n');

const extracted = [];

for (const panel of panels) {
  const startIdx = panel.startLine - 1; // Convert to 0-indexed
  const endIdx = findPanelEnd(startIdx);
  
  if (endIdx === -1) {
    console.log(`ERROR: Could not find end for ${panel.component} (start: ${panel.startLine})`);
    continue;
  }
  
  const lineCount = endIdx - startIdx + 1;
  const jsxBlock = lines.slice(startIdx, endIdx + 1);
  
  extracted.push({
    ...panel,
    endLine: endIdx + 1, // 1-indexed
    lineCount,
    jsxBlock,
  });
  
  console.log(`${panel.component}: lines ${panel.startLine}-${endIdx + 1} (${lineCount} lines) ${panel.isIIFE ? '[IIFE]' : ''}`);
}

console.log(`\nTotal panels: ${extracted.length}`);
console.log(`Total lines of JSX: ${extracted.reduce((sum, p) => sum + p.lineCount, 0)}`);

// ============================================================================
// GENERATE COMPONENT FILES
// ============================================================================

// Collect all unique identifiers referenced in each panel's JSX
function findReferencedVars(jsxBlock, varName) {
  const text = jsxBlock.join('\n');
  const refs = new Set();
  
  // Find all setState/state references
  const statePattern = /\b(set\w+|show\w+|[a-z]\w+(?:Id|Host|Port|User|Pass|Url|Token|Body|Subject|Name|Field|Value|Query|Path|Params|Filter|Table|Fields|Rows|Database|Mode|Type|Code|Interval|Key|Client|Secret|Number|From|Message|Label|Data|Options|Columns|Config|Template|Content|Format|Style|Color|Size|Width|Height|Direction|Source|Target|Output|Input|Schedule|Cron|Zone|Title))\b/g;
  
  return refs;
}

// For each panel, generate the component file content
function generateComponent(panel) {
  const { component, jsxBlock, varName, isIIFE, startLine, endLine } = panel;
  
  // Find the inner JSX (inside the conditional wrapper)
  let innerLines;
  
  if (isIIFE) {
    // Pattern: {configuringXNodeId && (() => { ... })()}
    // Skip first line: {configuringXNodeId && (() => {
    // Skip last line: })()}
    innerLines = jsxBlock.slice(1, -1);
  } else {
    // Pattern: {configuringXNodeId && (
    //   <NodeConfigSidePanel ...> ... </NodeConfigSidePanel>
    // )}
    // Skip first line: {configuringXNodeId && (
    // Skip last line: )}
    innerLines = jsxBlock.slice(1, -1);
  }
  
  // Find the base indentation to normalize
  const firstContentLine = innerLines.find(l => l.trim().length > 0);
  const baseIndent = firstContentLine ? firstContentLine.match(/^(\s*)/)[1].length : 0;
  
  // Remove base indentation
  const normalizedLines = innerLines.map(line => {
    if (line.trim().length === 0) return '';
    const currentIndent = line.match(/^(\s*)/)[1].length;
    const newIndent = Math.max(0, currentIndent - baseIndent + 4); // 4 spaces base
    return ' '.repeat(newIndent) + line.trim();
  });
  
  const jsxContent = normalizedLines.join('\n');
  
  // Collect all identifiers used from parent scope
  const fullText = jsxBlock.join('\n');
  
  // Find all Phosphor icon imports needed
  const iconPattern = /<(\w+)\s+size=/g;
  const phosphorIcons = new Set();
  let iconMatch;
  while ((iconMatch = iconPattern.exec(fullText)) !== null) {
    const name = iconMatch[1];
    if (name[0] === name[0].toUpperCase() && !['NodeConfigSidePanel', 'React'].includes(name)) {
      phosphorIcons.add(name);
    }
  }
  
  // Also find icon= props
  const iconPropPattern = /icon=\{(\w+)\}/g;
  while ((iconMatch = iconPropPattern.exec(fullText)) !== null) {
    phosphorIcons.add(iconMatch[1]);
  }
  
  // Find React.createElement calls for icons
  const createElPattern = /React\.createElement\((\w+),/g;
  while ((iconMatch = createElPattern.exec(fullText)) !== null) {
    phosphorIcons.add(iconMatch[1]);
  }
  
  // Common icon additions
  const commonIcons = ['MessageSquare']; // for feedback popup
  if (fullText.includes('MessageSquare')) phosphorIcons.add('MessageSquare');
  if (fullText.includes('Copy')) phosphorIcons.add('Copy');
  if (fullText.includes('Plus')) phosphorIcons.add('Plus');
  if (fullText.includes('Trash')) phosphorIcons.add('Trash');
  if (fullText.includes('X ') || fullText.includes('<X ')) phosphorIcons.add('X');
  if (fullText.includes('CaretDown')) phosphorIcons.add('CaretDown');
  if (fullText.includes('CaretUp')) phosphorIcons.add('CaretUp');
  if (fullText.includes('Eye')) phosphorIcons.add('Eye');
  if (fullText.includes('EyeSlash')) phosphorIcons.add('EyeSlash');
  if (fullText.includes('Check')) phosphorIcons.add('Check');
  if (fullText.includes('Info')) phosphorIcons.add('Info');
  if (fullText.includes('Warning')) phosphorIcons.add('Warning');
  if (fullText.includes('ArrowRight')) phosphorIcons.add('ArrowRight');
  if (fullText.includes('PencilSimple')) phosphorIcons.add('PencilSimple');
  if (fullText.includes('Sparkle')) phosphorIcons.add('Sparkle');
  if (fullText.includes('Lightning')) phosphorIcons.add('Lightning');
  if (fullText.includes('Play')) phosphorIcons.add('Play');
  if (fullText.includes('Robot')) phosphorIcons.add('Robot');
  if (fullText.includes('ClipboardText')) phosphorIcons.add('ClipboardText');
  if (fullText.includes('Download')) phosphorIcons.add('Download');
  if (fullText.includes('Upload')) phosphorIcons.add('Upload');
  if (fullText.includes('FileText')) phosphorIcons.add('FileText');
  if (fullText.includes('Table')) phosphorIcons.add('Table');
  if (fullText.includes('Database')) phosphorIcons.add('Database');
  if (fullText.includes('Gear')) phosphorIcons.add('Gear');
  if (fullText.includes('Globe')) phosphorIcons.add('Globe');
  if (fullText.includes('EnvelopeSimple')) phosphorIcons.add('EnvelopeSimple');
  if (fullText.includes('ChatCircleText')) phosphorIcons.add('ChatCircleText');
  if (fullText.includes('ChartLine')) phosphorIcons.add('ChartLine');
  if (fullText.includes('ChartBar')) phosphorIcons.add('ChartBar');
  if (fullText.includes('FunnelSimple')) phosphorIcons.add('FunnelSimple');
  if (fullText.includes('GitBranch')) phosphorIcons.add('GitBranch');
  if (fullText.includes('Code')) phosphorIcons.add('Code');
  if (fullText.includes('TreeStructure')) phosphorIcons.add('TreeStructure');
  if (fullText.includes('Timer')) phosphorIcons.add('Timer');
  if (fullText.includes('Calendar')) phosphorIcons.add('Calendar');
  if (fullText.includes('User ') || fullText.includes('<User ')) phosphorIcons.add('User');
  if (fullText.includes('Users')) phosphorIcons.add('Users');
  if (fullText.includes('ShieldCheck')) phosphorIcons.add('ShieldCheck');
  if (fullText.includes('FloppyDisk')) phosphorIcons.add('FloppyDisk');
  if (fullText.includes('Wrench')) phosphorIcons.add('Wrench');
  if (fullText.includes('CloudArrowUp')) phosphorIcons.add('CloudArrowUp');
  if (fullText.includes('MagnifyingGlass')) phosphorIcons.add('MagnifyingGlass');
  if (fullText.includes('Phone')) phosphorIcons.add('Phone');
  if (fullText.includes('WhatsappLogo')) phosphorIcons.add('WhatsappLogo');
  if (fullText.includes('Funnel')) phosphorIcons.add('Funnel');
  if (fullText.includes('Columns')) phosphorIcons.add('Columns');
  if (fullText.includes('SplitVertical')) phosphorIcons.add('SplitVertical');
  if (fullText.includes('ArrowsLeftRight')) phosphorIcons.add('ArrowsLeftRight');
  if (fullText.includes('Palette')) phosphorIcons.add('Palette');
  if (fullText.includes('Leaf')) phosphorIcons.add('Leaf');
  if (fullText.includes('Plugs')) phosphorIcons.add('Plugs');
  if (fullText.includes('Factory')) phosphorIcons.add('Factory');
  if (fullText.includes('Activity')) phosphorIcons.add('Activity');
  if (fullText.includes('Bell')) phosphorIcons.add('Bell');
  if (fullText.includes('FilePdf')) phosphorIcons.add('FilePdf');
  if (fullText.includes('HandPalm')) phosphorIcons.add('HandPalm');
  if (fullText.includes('Swap')) phosphorIcons.add('Swap');

  // Remove false positives (React components that aren't icons)
  phosphorIcons.delete('NodeConfigSidePanel');
  phosphorIcons.delete('React');
  phosphorIcons.delete('SidePanelContent');
  phosphorIcons.delete('Math');
  phosphorIcons.delete('Array');
  phosphorIcons.delete('Object');
  phosphorIcons.delete('JSON');
  phosphorIcons.delete('Promise');
  phosphorIcons.delete('Set');
  phosphorIcons.delete('Map');
  phosphorIcons.delete('Date');
  phosphorIcons.delete('Error');
  phosphorIcons.delete('String');
  phosphorIcons.delete('Number');
  phosphorIcons.delete('Boolean');

  return {
    component,
    fileName: `${component}.tsx`,
    jsxContent,
    phosphorIcons: Array.from(phosphorIcons),
    isIIFE,
    lineCount: panel.lineCount,
  };
}

// ============================================================================
// WRITE RAW EXTRACTED JSX FOR MANUAL COMPONENT CREATION
// ============================================================================

console.log('\n=== Generating Raw Extracts ===\n');

const outputDir = path.join(PANELS_DIR, '_raw');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (const panel of extracted) {
  const gen = generateComponent(panel);
  const outputPath = path.join(outputDir, `${panel.component}.raw.tsx`);
  
  // Write the raw JSX content
  const content = `// ${panel.component} - Raw extracted JSX
// Source: Workflows.tsx lines ${panel.startLine}-${panel.endLine} (${panel.lineCount} lines)
// Type: ${panel.isIIFE ? 'IIFE' : 'Regular'}
// Phosphor icons needed: ${gen.phosphorIcons.join(', ')}
// 
// TODO: Wrap in component with proper props interface

${gen.jsxContent}
`;
  
  fs.writeFileSync(outputPath, content);
  console.log(`  Written: ${panel.component}.raw.tsx (${panel.lineCount} lines)`);
}

// ============================================================================
// GENERATE REPLACEMENT MAP
// ============================================================================

console.log('\n=== Replacement Map for Workflows.tsx ===\n');
console.log('Replace each panel block with a single component call.\n');

for (const panel of extracted) {
  console.log(`Lines ${panel.startLine}-${panel.endLine}: Replace with <${panel.component} .../>`);
}

// ============================================================================
// GENERATE INDEX FILE
// ============================================================================

const indexContent = `/**
 * Config Panel Components
 * Auto-generated from Workflows.tsx panel extraction
 */

${extracted.map(p => `export { ${p.component} } from './${p.component}';`).join('\n')}
`;

fs.writeFileSync(path.join(PANELS_DIR, 'index.ts'), indexContent);
console.log('\n  Written: panels/index.ts');

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== SUMMARY ===');
console.log(`Total panels extracted: ${extracted.length}`);
console.log(`Total JSX lines: ${extracted.reduce((sum, p) => sum + p.lineCount, 0)}`);
console.log(`Files generated: ${extracted.length} raw extracts + 1 index.ts`);
console.log('\nNext steps:');
console.log('1. Create proper component wrappers for each raw extract');
console.log('2. Replace inline JSX in Workflows.tsx with component calls');
console.log('3. Remove unused state variables and functions from Workflows.tsx');

