import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, BookOpen, Code, Zap, Database, Workflow, Sparkles, Plug, HelpCircle, FileText, ArrowRight, ArrowLeft } from 'lucide-react';

interface DocSection {
    id: string;
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    subsections?: Array<{ id: string; title: string }>;
}

const DOC_SECTIONS: DocSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Zap,
        subsections: [
            { id: 'overview', title: 'Overview' },
            { id: 'quick-start', title: 'Quick Start' },
            { id: 'first-workflow', title: 'Your First Workflow' }
        ]
    },
    {
        id: 'installation',
        title: 'Installation',
        icon: Code,
        subsections: [
            { id: 'requirements', title: 'Requirements' },
            { id: 'local-setup', title: 'Local Setup' },
            { id: 'environment', title: 'Environment Variables' }
        ]
    },
    {
        id: 'data-modeling',
        title: 'Data Modeling',
        icon: Database,
        subsections: [
            { id: 'entities', title: 'Entities' },
            { id: 'properties', title: 'Properties' },
            { id: 'relationships', title: 'Relationships' }
        ]
    },
    {
        id: 'workflows',
        title: 'Workflows',
        icon: Workflow,
        subsections: [
            { id: 'creating-workflows', title: 'Creating Workflows' },
            { id: 'nodes', title: 'Nodes & Components' },
            { id: 'execution', title: 'Execution & Testing' }
        ]
    },
    {
        id: 'copilots',
        title: 'Copilots',
        icon: Sparkles,
        subsections: [
            { id: 'creating-copilots', title: 'Creating Copilots' },
            { id: 'instructions', title: 'Custom Instructions' },
            { id: 'data-access', title: 'Data Access Control' }
        ]
    },
    {
        id: 'connections',
        title: 'Connections',
        icon: Plug,
        subsections: [
            { id: 'available-connections', title: 'Available Connections' },
            { id: 'configuring', title: 'Configuring Connections' },
            { id: 'testing', title: 'Testing Connections' }
        ]
    },
    {
        id: 'api',
        title: 'API Reference',
        icon: Code,
        subsections: [
            { id: 'authentication', title: 'Authentication' },
            { id: 'endpoints', title: 'Endpoints' },
            { id: 'examples', title: 'Examples' }
        ]
    },
    {
        id: 'faq',
        title: 'FAQ',
        icon: HelpCircle
    },
    {
        id: 'changelog',
        title: 'Changelog',
        icon: FileText
    }
];

export const Documentation: React.FC = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState<string>('getting-started');
    const [activeSubsection, setActiveSubsection] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash.slice(1);
        if (hash) {
            const [section, subsection] = hash.split('-');
            setActiveSection(section || 'getting-started');
            if (subsection) {
                setActiveSubsection(hash);
            }
        }
    }, []);

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.pushState(null, '', `#${sectionId}`);
            setActiveSection(sectionId.split('-')[0]);
            setActiveSubsection(sectionId);
        }
    };

    const getCurrentSectionIndex = () => {
        return DOC_SECTIONS.findIndex(s => s.id === activeSection);
    };

    const getPreviousSection = () => {
        const currentIndex = getCurrentSectionIndex();
        if (currentIndex > 0) {
            return DOC_SECTIONS[currentIndex - 1];
        }
        return null;
    };

    const getNextSection = () => {
        const currentIndex = getCurrentSectionIndex();
        if (currentIndex < DOC_SECTIONS.length - 1) {
            return DOC_SECTIONS[currentIndex + 1];
        }
        return null;
    };

    const previousSection = getPreviousSection();
    const nextSection = getNextSection();

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 text-slate-600 hover:text-slate-900"
                        title="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <BookOpen size={20} className="text-slate-600" />
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Documentation</h1>
                        </div>
                    </div>
                </div>
                <div className="text-xs text-slate-400">v1.0.0</div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="flex h-full">
                    {/* Sidebar Navigation */}
                    <aside className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto shrink-0">
                        <nav className="p-4">
                            <ul className="space-y-1">
                                {DOC_SECTIONS.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;
                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => scrollToSection(section.id)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                                }`}
                                            >
                                                <Icon size={16} className="flex-shrink-0" />
                                                <span className="text-left">{section.title}</span>
                                            </button>
                                            {isActive && section.subsections && (
                                                <ul className="mt-1 ml-7 space-y-0.5">
                                                    {section.subsections.map((sub) => {
                                                        const isSubActive = activeSubsection === `${section.id}-${sub.id}`;
                                                        return (
                                                            <li key={sub.id}>
                                                                <button
                                                                    onClick={() => scrollToSection(`${section.id}-${sub.id}`)}
                                                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                                                        isSubActive
                                                                            ? 'text-slate-900 font-medium'
                                                                            : 'text-slate-500 hover:text-slate-700'
                                                                    }`}
                                                                >
                                                                    {sub.title}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 overflow-y-auto">
                        <div className="max-w-4xl mx-auto px-8 py-12">
                            {/* Getting Started */}
                            <section id="getting-started" className="mb-16">
                                <div className="mb-8">
                                    <h1 className="text-3xl font-bold text-slate-900 mb-3">Getting Started</h1>
                                    <p className="text-lg text-slate-600 leading-relaxed">
                                        Welcome to Intemic Platform. This guide will help you get up and running quickly.
                                    </p>
                                </div>

                                <div id="getting-started-overview" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Overview</h2>
                                    <p className="text-slate-700 mb-4 leading-relaxed">
                                        Intemic Platform is a comprehensive data modeling and workflow automation platform. 
                                        It allows you to:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
                                        <li>Model your data with entities and relationships</li>
                                        <li>Build automated workflows with drag-and-drop</li>
                                        <li>Create AI copilots with custom instructions</li>
                                        <li>Connect to external data sources</li>
                                    </ul>
                                </div>

                                <div id="getting-started-quick-start" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Quick Start</h2>
                                    <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
                                        <pre className="text-sm text-slate-100">
                                            <code>{`# Install dependencies
npm install

# Start backend server
npm run server

# Start frontend (in another terminal)
npm run dev`}</code>
                                        </pre>
                                    </div>
                                    <p className="text-slate-700 mb-4">
                                        Once both servers are running, navigate to <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm">http://localhost:5175</code> in your browser.
                                    </p>
                                </div>

                                <div id="getting-started-first-workflow" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Your First Workflow</h2>
                                    <ol className="list-decimal pl-6 space-y-3 text-slate-700">
                                        <li>Navigate to <strong>Workflows</strong> in the sidebar</li>
                                        <li>Click <strong>Create Workflow</strong></li>
                                        <li>Drag a <strong>Manual Trigger</strong> node onto the canvas</li>
                                        <li>Add additional nodes from the Components panel</li>
                                        <li>Connect nodes by dragging from output to input connectors</li>
                                        <li>Click <strong>Run</strong> to test your workflow</li>
                                    </ol>
                                </div>
                            </section>

                            {/* Installation */}
                            <section id="installation" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Installation</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Set up Intemic Platform on your local machine or server.
                                </p>

                                <div id="installation-requirements" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Requirements</h2>
                                    <ul className="list-disc pl-6 space-y-2 text-slate-700">
                                        <li>Node.js 18+ and npm</li>
                                        <li>Python 3.8+ (for Prefect workflows)</li>
                                        <li>SQLite (included) or PostgreSQL/MySQL</li>
                                    </ul>
                                </div>

                                <div id="installation-local-setup" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Local Setup</h2>
                                    <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
                                        <pre className="text-sm text-slate-100">
                                            <code>{`# Clone the repository
git clone <repository-url>
cd intemic-platform

# Install dependencies
npm install

# Copy environment template
cp ENV_TEMPLATE.txt server/.env

# Edit server/.env with your configuration
# Then start the servers`}</code>
                                        </pre>
                                    </div>
                                </div>

                                <div id="installation-environment" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Environment Variables</h2>
                                    <p className="text-slate-700 mb-4">Key environment variables in <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm">server/.env</code>:</p>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                                        <pre className="text-sm text-slate-700">
                                            <code>{`PORT=3001
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key
DATABASE_URL=./data.db`}</code>
                                        </pre>
                                    </div>
                                </div>
                            </section>

                            {/* Data Modeling */}
                            <section id="data-modeling" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Data Modeling</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Define your data structure with entities, properties, and relationships.
                                </p>

                                <div id="data-modeling-entities" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Entities</h2>
                                    <p className="text-slate-700 mb-4">
                                        Entities represent your core data structures. Create entities in the <strong>Knowledge Base</strong> section.
                                    </p>
                                </div>

                                <div id="data-modeling-properties" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Properties</h2>
                                    <p className="text-slate-700 mb-4">
                                        Each entity can have multiple properties with different types: text, number, date, relation, etc.
                                    </p>
                                </div>

                                <div id="data-modeling-relationships" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Relationships</h2>
                                    <p className="text-slate-700 mb-4">
                                        Connect entities using relation properties to build a relational data model.
                                    </p>
                                </div>
                            </section>

                            {/* Workflows */}
                            <section id="workflows" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Workflows</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Build automated workflows with a visual, drag-and-drop interface.
                                </p>

                                <div id="workflows-creating-workflows" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Creating Workflows</h2>
                                    <p className="text-slate-700 mb-4">
                                        Workflows are composed of nodes connected together. Each node performs a specific action or transformation.
                                    </p>
                                </div>

                                <div id="workflows-nodes" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Nodes & Components</h2>
                                    <p className="text-slate-700 mb-4">Available node types:</p>
                                    <ul className="list-disc pl-6 space-y-2 text-slate-700">
                                        <li><strong>Triggers:</strong> Manual, Schedule, Webhook</li>
                                        <li><strong>Data:</strong> Fetch Data, Excel/CSV Input, PDF Input</li>
                                        <li><strong>Logic:</strong> Condition, Join, Split Columns</li>
                                        <li><strong>Actions:</strong> Save to Database, HTTP Request, Send Email</li>
                                    </ul>
                                </div>

                                <div id="workflows-execution" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Execution & Testing</h2>
                                    <p className="text-slate-700 mb-4">
                                        Test workflows using the <strong>Run</strong> button. View execution history and logs in the <strong>Executions</strong> section.
                                    </p>
                                </div>
                            </section>

                            {/* Copilots */}
                            <section id="copilots" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Copilots</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Create AI assistants with custom instructions and controlled data access.
                                </p>

                                <div id="copilots-creating-copilots" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Creating Copilots</h2>
                                    <p className="text-slate-700 mb-4">
                                        Click <strong>New Copilot</strong> in the Copilots section to create a new AI assistant.
                                    </p>
                                </div>

                                <div id="copilots-instructions" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Custom Instructions</h2>
                                    <p className="text-slate-700 mb-4">
                                        Define how your copilot should behave by providing custom instructions. This helps tailor the AI's responses to your specific use case.
                                    </p>
                                </div>

                                <div id="copilots-data-access" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Data Access Control</h2>
                                    <p className="text-slate-700 mb-4">
                                        Select which entities (datasets) each copilot can access. This ensures data security and prevents unauthorized access.
                                    </p>
                                </div>
                            </section>

                            {/* Connections */}
                            <section id="connections" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Connections</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Connect to external data sources and services.
                                </p>

                                <div id="connections-available-connections" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Available Connections</h2>
                                    <p className="text-slate-700 mb-4">Supported connections:</p>
                                    <ul className="list-disc pl-6 space-y-2 text-slate-700">
                                        <li>SAP</li>
                                        <li>Oracle</li>
                                        <li>PostgreSQL</li>
                                        <li>MongoDB</li>
                                        <li>Snowflake</li>
                                        <li>AWS S3</li>
                                        <li>Azure</li>
                                        <li>Slack</li>
                                    </ul>
                                </div>

                                <div id="connections-configuring" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Configuring Connections</h2>
                                    <p className="text-slate-700 mb-4">
                                        Navigate to <strong>Connections</strong> and click on a connection type to configure credentials.
                                    </p>
                                </div>

                                <div id="connections-testing" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Testing Connections</h2>
                                    <p className="text-slate-700 mb-4">
                                        After configuration, test your connection to ensure it's working correctly.
                                    </p>
                                </div>
                            </section>

                            {/* API Reference */}
                            <section id="api" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">API Reference</h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    RESTful API endpoints for programmatic access.
                                </p>

                                <div id="api-authentication" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Authentication</h2>
                                    <p className="text-slate-700 mb-4">
                                        All API requests require authentication via cookies or JWT tokens.
                                    </p>
                                </div>

                                <div id="api-endpoints" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Endpoints</h2>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                                        <div className="mb-3">
                                            <code className="text-xs font-mono bg-slate-900 text-green-400 px-2 py-1 rounded">GET</code>
                                            <span className="ml-3 text-sm text-slate-700">/api/workflows</span>
                                        </div>
                                        <div className="mb-3">
                                            <code className="text-xs font-mono bg-slate-900 text-blue-400 px-2 py-1 rounded">POST</code>
                                            <span className="ml-3 text-sm text-slate-700">/api/workflows</span>
                                        </div>
                                        <div className="mb-3">
                                            <code className="text-xs font-mono bg-slate-900 text-yellow-400 px-2 py-1 rounded">PUT</code>
                                            <span className="ml-3 text-sm text-slate-700">/api/workflows/:id</span>
                                        </div>
                                    </div>
                                </div>

                                <div id="api-examples" className="mb-12">
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-4 mt-8">Examples</h2>
                                    <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
                                        <pre className="text-sm text-slate-100">
                                            <code>{`// Fetch workflows
fetch('/api/workflows', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data));`}</code>
                                        </pre>
                                    </div>
                                </div>
                            </section>

                            {/* FAQ */}
                            <section id="faq" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">FAQ</h1>
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">How do I create my first workflow?</h3>
                                        <p className="text-slate-700">
                                            Navigate to Workflows, click "Create Workflow", and drag nodes from the Components panel onto the canvas.
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Can I use custom Python code in workflows?</h3>
                                        <p className="text-slate-700">
                                            Yes, use the Python node to execute custom Python scripts within your workflows.
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">How do copilots access data?</h3>
                                        <p className="text-slate-700">
                                            When creating a copilot, you can specify which entities it can access. The copilot will only see data from those selected entities.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Changelog */}
                            <section id="changelog" className="mb-16">
                                <h1 className="text-3xl font-bold text-slate-900 mb-3">Changelog</h1>
                                <div className="space-y-6">
                                    <div className="border-l-2 border-slate-200 pl-4">
                                        <h3 className="text-lg font-semibold text-slate-900 mb-1">v1.0.0 - January 2026</h3>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-700">
                                            <li>Initial release</li>
                                            <li>Data modeling with entities and relationships</li>
                                            <li>Visual workflow builder</li>
                                            <li>AI copilots with custom instructions</li>
                                            <li>External connections support</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Pagination */}
                            <div className="flex items-center justify-between pt-8 mt-16 border-t border-slate-200">
                                {previousSection ? (
                                    <button
                                        onClick={() => scrollToSection(previousSection.id)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                        <span>{previousSection.title}</span>
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                {nextSection && (
                                    <button
                                        onClick={() => scrollToSection(nextSection.id)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors ml-auto"
                                    >
                                        <span>{nextSection.title}</span>
                                        <ChevronRight size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
