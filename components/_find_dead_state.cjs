const fs = require('fs');
const content = fs.readFileSync('components/Workflows.tsx', 'utf8');
const lines = content.split('\n');

// Find all useState declarations within the component (lines ~100-540)
const stateVars = [];
lines.forEach((line, i) => {
  if (i < 90 || i > 600) return;
  const m = line.match(/const \[(\w+), (set\w+)\] = useState/);
  if (m) stateVars.push({ name: m[1], setter: m[2], line: i + 1, lineIdx: i });
});

console.log('Total useState declarations:', stateVars.length);

// For each, check if used outside its declaration line
const deadVars = [];
stateVars.forEach(({ name, setter, line, lineIdx }) => {
  let nameUsed = false;
  let setterUsed = false;
  
  const nameRegex = new RegExp('\\b' + name + '\\b');
  const setterRegex = new RegExp('\\b' + setter + '\\b');
  
  for (let idx = 0; idx < lines.length; idx++) {
    if (idx === lineIdx) continue;
    if (!nameUsed && nameRegex.test(lines[idx])) nameUsed = true;
    if (!setterUsed && setterRegex.test(lines[idx])) setterUsed = true;
    if (nameUsed && setterUsed) break;
  }
  
  if (!nameUsed && !setterUsed) {
    deadVars.push({ name, setter, line });
  }
});

console.log('\nDead state variables (not used anywhere outside declaration):', deadVars.length);
deadVars.forEach(v => console.log('  L' + v.line + ': [' + v.name + ', ' + v.setter + ']'));

