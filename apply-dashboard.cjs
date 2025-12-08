// Complete patch that adds both import AND routing
const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf-8');

// 1. Add import for Dashboard
if (!content.includes("import { Dashboard }")) {
    content = content.replace(
        "import { Reporting } from './components/Reporting';",
        "import { Reporting } from './components/Reporting';\nimport { Dashboard } from './components/Dashboard';"
    );
    console.log('✅ Added Dashboard import');
} else {
    console.log('⚠️  Dashboard already imported');
}

// 2. Add routing
const hasRouting = content.includes("currentView === 'dashboard'");
if (!hasRouting) {
    content = content.replace(
        /currentView === 'reports' \? \(/,
        "currentView === 'dashboard' ? (\n                    <Dashboard entities={entities} />\n                ) : currentView === 'reports' ? ("
    );
    console.log('✅ Added dashboard routing');
} else {
    console.log('⚠️  Dashboard routing already exists');
}

fs.writeFileSync('App.tsx', content, 'utf-8');
console.log('\n🎉 Done! Dashboard should now work.');
