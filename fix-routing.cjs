// Patch script - version 2
const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf-8');

// More flexible pattern matching
const pattern = /currentView === 'reports' \? \(\s+<Reporting entities=\{entities\} \/>\s+\) : \(/;

if (pattern.test(content)) {
    content = content.replace(
        pattern,
        `currentView === 'dashboard' ? (
                    <Dashboard entities={entities} />
                ) : currentView === 'reports' ? (
                    <Reporting entities={entities} />
                ) : (`
    );
    fs.writeFileSync('App.tsx', content, 'utf-8');
    console.log('✅ Dashboard routing added successfully!');
} else {
    console.log('❌ Pattern not found. Checking current content...');
    // Show what we're looking for
    const lines = content.split('\n');
    const reportingIndex = lines.findIndex(l => l.includes("currentView === 'reports'"));
    if (reportingIndex >= 0) {
        console.log('Found at line:', reportingIndex + 1);
        console.log(lines.slice(reportingIndex - 2, reportingIndex + 4).join('\n'));
    }
}
