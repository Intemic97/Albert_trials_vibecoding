// This file patches App.tsx and Sidebar.tsx to add dashboard integration
const fs = require('fs');

// Patch App.tsx
let appContent = fs.readFileSync('App.tsx', 'utf-8');

// Add Dashboard import
appContent = appContent.replace(
    "import { Reporting } from './components/Reporting';",
    "import { Reporting } from './components/Reporting';\nimport { Dashboard } from './components/Dashboard';"
);

// Add dashboard routing
appContent = appContent.replace(
    "{currentView === 'reports' ? (\n                    <Reporting entities={entities} />\n                ) : (",
    "{currentView === 'dashboard' ? (\n                    <Dashboard entities={entities} />\n                ) : currentView === 'reports' ? (\n                    <Reporting entities={entities} />\n                ) : ("
);

fs.writeFileSync('App.tsx', appContent);
console.log('✅ App.tsx patched successfully');

// Patch Sidebar.tsx
let sidebarContent = fs.readFileSync('components/Sidebar.tsx', 'utf-8');

// Make Dashboards button active
sidebarContent = sidebarContent.replace(
    '<NavItem icon={LayoutDashboard} label="Dashboards" />',
    '<NavItem icon={LayoutDashboard} label="Dashboards" view="dashboard" active={activeView === \'dashboard\'} />'
);

fs.writeFileSync('components/Sidebar.tsx', sidebarContent);
console.log('✅ Sidebar.tsx patched successfully');

console.log('\n🎉 Dashboard integration complete!');
