const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'components/Workflows/panels');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

console.log(`Checking ${files.length} panel files...\n`);

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const issues = [];
  
  // Check if file has a proper export
  if (!content.includes('export const')) {
    issues.push('Missing export const');
  }
  
  // Check for AlertCircle usage without import
  if (content.includes('AlertCircle') && !content.match(/import.*AlertCircle/)) {
    issues.push('Uses AlertCircle but does not import it');
  }
  
  // Check for API_BASE usage without import
  if (content.includes('API_BASE') && !content.match(/import.*API_BASE/)) {
    issues.push('Uses API_BASE but does not import it');
  }
  
  // Check for useAuth usage without import
  if (content.includes('useAuth') && !content.match(/import.*useAuth/)) {
    issues.push('Uses useAuth but does not import it');
  }
  
  // Check for token/organizationId without definition
  if (content.match(/\b(token|organizationId)\b/) && !content.includes('useAuth') && !content.match(/props\b.*\b(token|organizationId)/)) {
    const hasTokenProp = content.includes('token:') || content.includes('token,') || content.includes('token }');
    if (!hasTokenProp && content.match(/\btoken\b/)) {
      issues.push('Uses token without defining it');
    }
  }
  
  // Check for references to non-imported icons
  const iconRefs = content.match(/\b(Eye|Pi|AlertCircle|WarningOctagon)\b/g) || [];
  iconRefs.forEach(icon => {
    if (!content.match(new RegExp(`import.*${icon}`))) {
      issues.push(`Uses ${icon} icon without importing it`);
    }
  });
  
  // Check for unclosed JSX
  const openTags = (content.match(/<NodeConfigSidePanel/g) || []).length;
  const closeTags = (content.match(/<\/NodeConfigSidePanel>/g) || []).length + (content.match(/\/>/g) || []).length;
  if (openTags > 0 && closeTags === 0) {
    issues.push('NodeConfigSidePanel tag never closed');
  }
  
  // Check for syntax placeholder remnants
  if (content.includes('needs JSX') || content.includes('needs manual') || content.includes('raw extract')) {
    issues.push('Still has placeholder text');
  }
  
  if (issues.length > 0) {
    console.log(`❌ ${file}:`);
    issues.forEach(i => console.log(`   - ${i}`));
  }
});

console.log('\n--- Checking import resolution ---');
// Check that all imports resolve
files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const imports = content.match(/from ['"]([^'"]+)['"]/g) || [];
  imports.forEach(imp => {
    const modPath = imp.match(/from ['"]([^'"]+)['"]/)[1];
    if (modPath.startsWith('.')) {
      const resolvedBase = path.resolve(dir, modPath);
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      const exists = extensions.some(ext => fs.existsSync(resolvedBase + ext));
      if (!exists) {
        console.log(`❌ ${file}: Cannot resolve import "${modPath}"`);
      }
    }
  });
});

console.log('\nDone.');

