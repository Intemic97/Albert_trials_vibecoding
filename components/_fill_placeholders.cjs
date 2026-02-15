/**
 * Fill PLACEHOLDER panels with actual JSX from raw extracts
 * 
 * Usage: node components/_fill_placeholders.cjs
 */

const fs = require('fs');
const path = require('path');

const PANELS_DIR = path.join(__dirname, 'Workflows', 'panels');
const RAW_DIR = path.join(PANELS_DIR, '_raw');

// Panel definitions: component file -> raw extract file + transformation rules
const placeholderPanels = [
  {
    file: 'EmailConfigPanel.tsx',
    raw: 'EmailConfigPanel.raw.tsx',
    varName: 'configuringEmailNodeId',
    setterName: 'setConfiguringEmailNodeId',
    saveFn: 'saveEmailConfig',
    isIIFE: true,
    // For IIFE: extract only the JSX part (after `return (`)
    // The computation is already in the component body
  },
  {
    file: 'SMSConfigPanel.tsx',
    raw: 'SMSConfigPanel.raw.tsx',
    varName: 'configuringSMSNodeId',
    setterName: 'setConfiguringSMSNodeId',
    saveFn: 'saveSMSConfig',
    isIIFE: true,
  },
  {
    file: 'WhatsAppConfigPanel.tsx',
    raw: 'WhatsAppConfigPanel.raw.tsx',
    varName: 'configuringWhatsAppNodeId',
    setterName: 'setConfiguringWhatsAppNodeId',
    saveFn: 'saveWhatsAppConfig',
    isIIFE: true,
  },
  {
    file: 'ConditionConfigPanel.tsx',
    raw: 'ConditionConfigPanel.raw.tsx',
    varName: 'configuringConditionNodeId',
    setterName: 'setConfiguringConditionNodeId',
    saveFn: 'saveConditionConfig',
    isIIFE: true,
  },
  {
    file: 'JoinConfigPanel.tsx',
    raw: 'JoinConfigPanel.raw.tsx',
    varName: 'configuringJoinNodeId',
    setterName: 'setConfiguringJoinNodeId',
    saveFn: 'saveJoinConfig',
    isIIFE: true,
  },
  {
    file: 'SplitColumnsConfigPanel.tsx',
    raw: 'SplitColumnsConfigPanel.raw.tsx',
    varName: 'configuringSplitColumnsNodeId',
    setterName: 'setConfiguringSplitColumnsNodeId',
    saveFn: 'saveSplitColumnsConfig',
    isIIFE: true,
  },
  {
    file: 'RenameColumnsConfigPanel.tsx',
    raw: 'RenameColumnsConfigPanel.raw.tsx',
    varName: 'configuringRenameColumnsNodeId',
    setterName: 'setConfiguringRenameColumnsNodeId',
    saveFn: 'saveRenameColumnsConfig',
    isIIFE: true,
  },
  {
    file: 'VisualizationConfigPanel.tsx',
    raw: 'VisualizationConfigPanel.raw.tsx',
    varName: 'configuringVisualizationNodeId',
    setterName: 'setConfiguringVisualizationNodeId',
    saveFn: 'saveVisualizationConfig',
    isIIFE: true,
  },
  {
    file: 'ClimatiqConfigPanel.tsx',
    raw: 'ClimatiqConfigPanel.raw.tsx',
    varName: 'configuringClimatiqNodeId',
    setterName: 'setConfiguringClimatiqNodeId',
    saveFn: 'saveClimatiqConfig',
    isIIFE: false,
  },
  {
    file: 'HumanApprovalConfigPanel.tsx',
    raw: 'HumanApprovalConfigPanel.raw.tsx',
    varName: 'configuringHumanApprovalNodeId',
    setterName: 'setConfiguringHumanApprovalNodeId',
    saveFn: 'saveHumanApprovalConfig',
    isIIFE: false,
  },
  {
    file: 'ExcelConfigPanel.tsx',
    raw: 'ExcelConfigPanel.raw.tsx',
    varName: 'configuringExcelNodeId',
    setterName: 'setConfiguringExcelNodeId',
    saveFn: 'saveExcelConfig',
    isIIFE: false,
  },
  {
    file: 'PdfConfigPanel.tsx',
    raw: 'PdfConfigPanel.raw.tsx',
    varName: 'configuringPdfNodeId',
    setterName: 'setConfiguringPdfNodeId',
    saveFn: 'savePdfConfig',
    isIIFE: false,
  },
  {
    file: 'SaveRecordsConfigPanel.tsx',
    raw: 'SaveRecordsConfigPanel.raw.tsx',
    varName: 'configuringSaveNodeId',
    setterName: 'setConfiguringSaveNodeId',
    saveFn: 'saveSaveRecordsConfig',
    isIIFE: false,
  },
  {
    file: 'LLMConfigPanel.tsx',
    raw: 'LLMConfigPanel.raw.tsx',
    varName: 'configuringLLMNodeId',
    setterName: 'setConfiguringLLMNodeId',
    saveFn: 'saveLLMConfig',
    isIIFE: false,
  },
  {
    file: 'PythonConfigPanel.tsx',
    raw: 'PythonConfigPanel.raw.tsx',
    varName: 'configuringPythonNodeId',
    setterName: 'setConfiguringPythonNodeId',
    saveFn: 'savePythonConfig',
    isIIFE: false,
  },
];

function transformJSX(jsx, panel) {
  let result = jsx;
  
  // Replace configuringXNodeId with nodeId (but not the setter)
  result = result.replace(new RegExp(`(?<!set)${panel.varName}`, 'g'), 'nodeId');
  
  // Replace setConfiguringXNodeId(null) with onClose()
  result = result.replace(new RegExp(`${panel.setterName}\\(null\\)`, 'g'), 'onClose()');
  
  // Replace saveXConfig with handleSave
  if (panel.saveFn) {
    result = result.replace(new RegExp(panel.saveFn, 'g'), 'handleSave');
  }
  
  // Replace closeXConfig patterns with onClose
  result = result.replace(/close\w+Config\b/g, 'onClose');
  
  // Replace showToast references  
  // (these should work if showToast is passed or available)
  
  return result;
}

function extractIIFEJSX(rawContent) {
  // For IIFE panels, find the `return (` and extract JSX after it
  const lines = rawContent.split('\n');
  
  // Find the `return (` line
  let returnLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('return (')) {
      returnLineIdx = i;
      break;
    }
  }
  
  if (returnLineIdx === -1) {
    // No `return (` found, the whole content might be JSX
    return rawContent;
  }
  
  // Extract from the line AFTER `return (` to the end
  // The last few lines will be `);` which we need to remove
  let jsxLines = lines.slice(returnLineIdx + 1);
  
  // Remove trailing `);` pattern
  while (jsxLines.length > 0 && (jsxLines[jsxLines.length - 1].trim() === ');' || jsxLines[jsxLines.length - 1].trim() === '')) {
    jsxLines.pop();
  }
  
  return jsxLines.join('\n');
}

// Process each placeholder panel
let filled = 0;
for (const panel of placeholderPanels) {
  const componentPath = path.join(PANELS_DIR, panel.file);
  const rawPath = path.join(RAW_DIR, panel.raw);
  
  if (!fs.existsSync(componentPath) || !fs.existsSync(rawPath)) {
    console.log(`  SKIP: ${panel.file} (file not found)`);
    continue;
  }
  
  // Read raw extract
  let rawContent = fs.readFileSync(rawPath, 'utf-8');
  // Remove comment lines at top
  const rawLines = rawContent.split('\n');
  const codeStart = rawLines.findIndex(l => !l.startsWith('//') && l.trim().length > 0);
  rawContent = rawLines.slice(codeStart >= 0 ? codeStart : 0).join('\n');
  
  // For IIFE panels, extract only the JSX part
  let jsx;
  if (panel.isIIFE) {
    jsx = extractIIFEJSX(rawContent);
  } else {
    jsx = rawContent;
  }
  
  // Transform variable references
  jsx = transformJSX(jsx, panel);
  
  // Normalize indentation (4 spaces base)
  const jsxLines = jsx.split('\n');
  const firstContent = jsxLines.find(l => l.trim().length > 0);
  const baseIndent = firstContent ? firstContent.match(/^(\s*)/)[1].length : 0;
  const normalized = jsxLines.map(line => {
    if (line.trim().length === 0) return '';
    const curr = line.match(/^(\s*)/)[1].length;
    const newIndent = Math.max(0, curr - baseIndent + 4);
    return ' '.repeat(newIndent) + line.trim();
  }).join('\n');
  
  // Read component file and replace placeholder
  let component = fs.readFileSync(componentPath, 'utf-8');
  
  if (component.includes('return null; // PLACEHOLDER')) {
    component = component.replace(
      'return null; // PLACEHOLDER',
      `return (\n${normalized}\n  );`
    );
    
    // Also handle "return null; // PLACEHOLDER - needs JSX from raw extract"
  } else if (component.includes('return null; // PLACEHOLDER - needs JSX from raw extract')) {
    component = component.replace(
      'return null; // PLACEHOLDER - needs JSX from raw extract',
      `return (\n${normalized}\n  );`
    );
  } else if (component.includes('return null; // PLACEHOLDER - needs manual JSX from raw extract')) {
    component = component.replace(
      'return null; // PLACEHOLDER - needs manual JSX from raw extract',
      `return (\n${normalized}\n  );`
    );
  } else {
    console.log(`  SKIP: ${panel.file} (no placeholder found)`);
    continue;
  }
  
  fs.writeFileSync(componentPath, component);
  filled++;
  console.log(`  Filled: ${panel.file} (${component.split('\n').length} lines)`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Filled: ${filled} / ${placeholderPanels.length} placeholder panels`);

