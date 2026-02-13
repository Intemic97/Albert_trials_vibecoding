import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    CaretRight, 
    CaretLeft, 
    BookOpen, 
    Code, 
    Lightning, 
    Database, 
    FlowArrow, 
    Sparkle, 
    Plug, 
    Question, 
    FileText, 
    ArrowLeft,
    ChartBar,
    Gear,
    Info,
    Lightbulb,
    ChartLine,
    Shield,
    Lock,
    Key,
    UserCircle,
    ShieldCheck
} from '@phosphor-icons/react';

// ============================================================================
// TYPES
// ============================================================================

interface DocSection {
    id: string;
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string; weight?: string }>;
    subsections?: Array<{ id: string; title: string }>;
}

// ============================================================================
// DOCUMENTATION STRUCTURE
// ============================================================================

const DOC_SECTIONS: DocSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Lightning,
        subsections: [
            { id: 'what-is-intemic', title: 'What is Intemic?' },
            { id: 'first-workflow', title: 'Your First Workflow' }
        ]
    },
    {
        id: 'knowledge-base',
        title: 'Knowledge Base',
        icon: Database,
        subsections: [
            { id: 'concepts', title: 'Core Concepts' },
            { id: 'property-types', title: 'Property Types' },
            { id: 'relationships', title: 'Relationships' },
            { id: 'import-data', title: 'Import Data' },
            { id: 'use-cases', title: 'Use Cases' }
        ]
    },
    {
        id: 'workflows',
        title: 'Workflows',
        icon: FlowArrow,
        subsections: [
            { id: 'canvas-basics', title: 'Canvas Basics' },
            { id: 'node-types', title: 'Node Types' },
            { id: 'connections', title: 'Connecting Nodes' },
            { id: 'execution', title: 'Execution & Testing' },
            { id: 'templates', title: 'Templates' }
        ]
    },
    {
        id: 'inteligencia',
        title: 'Inteligencia',
        icon: Sparkle,
        subsections: [
            { id: 'agents', title: 'Agents' },
            { id: 'chat', title: 'Chat' },
            { id: 'data-access', title: 'Data Access Control' },
            { id: 'mentions', title: 'Using Mentions' },
            { id: 'reports', title: 'AI Reports' }
        ]
    },
    {
        id: 'dashboards',
        title: 'Dashboards',
        icon: ChartBar,
        subsections: [
            { id: 'widgets', title: 'Widget Types' },
            { id: 'data-sources', title: 'Data Sources' },
            { id: 'filters', title: 'Filters & Refresh' },
            { id: 'sharing', title: 'Sharing Dashboards' }
        ]
    },
    {
        id: 'connections',
        title: 'Connections',
        icon: Plug,
        subsections: [
            { id: 'available', title: 'Available Connectors' },
            { id: 'configure', title: 'Configuration' },
            { id: 'testing', title: 'Testing Connections' }
        ]
    },
    {
        id: 'lab',
        title: 'Lab',
        icon: ChartLine,
        subsections: [
            { id: 'create-experiment', title: 'Creating Experiments' },
            { id: 'variables', title: 'Variables & Parameters' },
            { id: 'analysis', title: 'Analysis & Results' },
            { id: 'compare', title: 'Comparing Scenarios' }
        ]
    },
    {
        id: 'settings',
        title: 'Settings & Admin',
        icon: Gear,
        subsections: [
            { id: 'users', title: 'User Management' },
            { id: 'organizations', title: 'Organizations' },
            { id: 'notifications', title: 'Notifications' }
        ]
    },
    {
        id: 'security',
        title: 'Security',
        icon: Shield,
        subsections: [
            { id: 'overview', title: 'Overview' },
            { id: 'authentication', title: 'Authentication & SSO' },
            { id: 'authorization', title: 'Roles & Permissions' },
            { id: 'data-protection', title: 'Data Protection' },
            { id: 'compliance', title: 'Privacy & Compliance' }
        ]
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: Question,
        subsections: [
            { id: 'common-errors', title: 'Common Errors' },
            { id: 'faq', title: 'FAQ' }
        ]
    },
    {
        id: 'changelog',
        title: 'Changelog',
        icon: FileText
    }
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex gap-3 p-4 bg-[#256A65]/10 border border-[#256A65]/20 rounded-lg my-4">
        <Lightbulb size={20} className="text-[#256A65] flex-shrink-0 mt-0.5" weight="fill" />
        <div className="text-sm text-[var(--text-primary)]">{children}</div>
    </div>
);

const WarningBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg my-4">
        <Info size={20} className="text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
        <div className="text-sm text-[var(--text-primary)]">{children}</div>
    </div>
);

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden my-4">
        <div className="flex items-center justify-between px-4 py-2 bg-[#16162a] border-b border-white/5">
            <span className="text-xs text-slate-400 font-mono">{language}</span>
        </div>
        <pre className="p-4 overflow-x-auto">
            <code className="text-sm text-slate-100 font-mono whitespace-pre">{code}</code>
        </pre>
    </div>
);

const Table: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
    <div className="overflow-x-auto my-4">
        <table className="w-full border border-[var(--border-light)] rounded-lg overflow-hidden">
            <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                    {headers.map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-light)]">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
                {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-tertiary)]/50">
                        {row.map((cell, j) => (
                            <td key={j} className="px-4 py-3 text-sm text-[var(--text-primary)]">
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Documentation: React.FC = () => {
    const navigate = useNavigate();
    const mainContentRef = useRef<HTMLElement>(null);
    const [activeSection, setActiveSection] = useState<string>('getting-started');
    const [activeSubsection, setActiveSubsection] = useState<string | null>(null);
    const [pendingSubsection, setPendingSubsection] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash.slice(1);
        if (hash) {
            const section = DOC_SECTIONS.find(s => hash.startsWith(s.id));
            if (section) {
                setActiveSection(section.id);
                if (hash !== section.id) {
                    setActiveSubsection(hash);
                    setPendingSubsection(hash);
                }
            }
        }
    }, []);

    // After section renders, scroll to pending subsection if any
    useEffect(() => {
        if (pendingSubsection) {
            requestAnimationFrame(() => {
                const el = document.getElementById(pendingSubsection);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setPendingSubsection(null);
            });
        }
    }, [pendingSubsection, activeSection]);

    const navigateToSection = useCallback((sectionId: string) => {
        // Find parent section
        const parentSection = DOC_SECTIONS.find(s => sectionId === s.id || sectionId.startsWith(s.id + '-'));
        if (!parentSection) return;

        const isSubsection = sectionId !== parentSection.id;
        const isNewSection = parentSection.id !== activeSection;

        window.history.pushState(null, '', `#${sectionId}`);
        setActiveSubsection(isSubsection ? sectionId : null);

        if (isNewSection) {
            setActiveSection(parentSection.id);
            // Scroll to top of main content
            if (mainContentRef.current) {
                mainContentRef.current.scrollTop = 0;
            }
            // If navigating to a subsection in a new section, defer scroll
            if (isSubsection) {
                setPendingSubsection(sectionId);
            }
        } else if (isSubsection) {
            // Same section, just scroll to subsection
            const el = document.getElementById(sectionId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            // Same section header clicked, scroll to top
            if (mainContentRef.current) {
                mainContentRef.current.scrollTop = 0;
            }
        }
    }, [activeSection]);

    const getCurrentSectionIndex = () => DOC_SECTIONS.findIndex(s => s.id === activeSection);

    const goToSection = useCallback((section: DocSection) => {
        setActiveSection(section.id);
        setActiveSubsection(null);
        window.history.pushState(null, '', `#${section.id}`);
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = 0;
        }
    }, []);

    const previousSection = getCurrentSectionIndex() > 0 ? DOC_SECTIONS[getCurrentSectionIndex() - 1] : null;
    const nextSection = getCurrentSectionIndex() < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[getCurrentSectionIndex() + 1] : null;
    const currentSectionData = DOC_SECTIONS[getCurrentSectionIndex()];

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-8 z-10 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overview')}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <ArrowLeft size={18} weight="light" />
                    </button>
                    <div className="flex items-center gap-3">
                        <BookOpen size={20} className="text-[#256A65]" weight="light" />
                        <h1 className="text-lg font-normal text-[var(--text-primary)]">Documentation</h1>
                    </div>
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">v1.0.0</div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="flex h-full">
                    {/* Sidebar Navigation */}
                    <aside className="w-64 bg-[var(--bg-primary)] border-r border-[var(--border-light)] overflow-y-auto shrink-0">
                        <nav className="p-4">
                            <ul className="space-y-1">
                                {DOC_SECTIONS.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;
                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => navigateToSection(section.id)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border-light)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50'
                                                }`}
                                            >
                                                <Icon size={16} className="flex-shrink-0" weight="light" />
                                                <span className="text-left">{section.title}</span>
                                            </button>
                                            {isActive && section.subsections && (
                                                <ul className="mt-1 ml-7 space-y-0.5">
                                                    {section.subsections.map((sub) => {
                                                        const subId = `${section.id}-${sub.id}`;
                                                        const isSubActive = activeSubsection === subId;
                                                        return (
                                                            <li key={sub.id}>
                                                                <button
                                                                    onClick={() => navigateToSection(subId)}
                                                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                                                        isSubActive
                                                                            ? 'text-[#256A65] font-medium'
                                                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                    <main ref={mainContentRef} className="flex-1 overflow-y-auto">
                        <div className="max-w-4xl mx-auto px-8 py-12">

                            {/* ================================================================== */}
                            {/* GETTING STARTED */}
                            {/* ================================================================== */}
                            {activeSection === 'getting-started' && <section id="getting-started" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Getting Started</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Everything you need to start building with Intemic Platform.
                                    </p>
                                </div>

                                {/* What is Intemic */}
                                <div id="getting-started-what-is-intemic" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">What is Intemic?</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        <strong>Intemic Platform</strong> is an enterprise-grade data modeling and workflow automation platform. 
                                        It enables teams to organize their data, automate processes, and leverage AI—all without writing code.
                                    </p>
                                    
                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Key Problems Solved</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)] mb-6">
                                        <li><strong>Data Silos</strong> — Centralize data from multiple sources into a unified knowledge base</li>
                                        <li><strong>Manual Processes</strong> — Automate repetitive tasks with visual workflows</li>
                                        <li><strong>Limited Insights</strong> — Create dashboards and AI agents to unlock data value</li>
                                        <li><strong>Integration Complexity</strong> — Connect to SAP, Oracle, databases, and cloud services easily</li>
                                    </ul>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Platform Structure</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic is organized into three main areas:
                                    </p>
                                    
                                    <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mt-4 mb-2">Build</h4>
                                    <Table 
                                        headers={['Module', 'Description']}
                                        rows={[
                                            ['Workflows', 'Visual editor for creating automated data pipelines'],
                                            ['Knowledge Base', 'Model your data with entities, properties, and relationships'],
                                            ['Connections', 'Connect to databases, APIs, cloud services, and industrial systems']
                                        ]}
                                    />
                                    
                                    <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mt-6 mb-2">Analyze</h4>
                                    <Table 
                                        headers={['Module', 'Description']}
                                        rows={[
                                            ['Dashboards', 'Create interactive visualizations with charts and KPIs'],
                                            ['Lab', 'Run simulations and scenario analysis using workflows'],
                                            ['Inteligencia', 'AI agents that understand your data and answer questions']
                                        ]}
                                    />
                                    
                                    <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mt-6 mb-2">Reports</h4>
                                    <Table 
                                        headers={['Module', 'Description']}
                                        rows={[
                                            ['Templates', 'Create reusable document templates'],
                                            ['Documents', 'Generate professional reports from your data']
                                        ]}
                                    />
                                </div>

                                {/* First Workflow */}
                                <div id="getting-started-first-workflow" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Your First Workflow</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Create a simple workflow in 3 steps:</p>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-[#256A65] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium">1</div>
                                            <div>
                                                <h4 className="font-medium text-[var(--text-primary)] mb-1">Create a new workflow</h4>
                                                <p className="text-sm text-[var(--text-secondary)]">Navigate to <strong>Workflows</strong> in the sidebar and click <strong>Create Workflow</strong>. Give it a name like "My First Workflow".</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-[#256A65] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium">2</div>
                                            <div>
                                                <h4 className="font-medium text-[var(--text-primary)] mb-1">Add nodes</h4>
                                                <p className="text-sm text-[var(--text-secondary)]">From the left panel, drag a <strong>Manual Trigger</strong> onto the canvas. Then add a <strong>Fetch Data</strong> node and connect them by dragging from the output port to the input port.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-[#256A65] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium">3</div>
                                            <div>
                                                <h4 className="font-medium text-[var(--text-primary)] mb-1">Run the workflow</h4>
                                                <p className="text-sm text-[var(--text-secondary)]">Click the <strong>Run</strong> button in the toolbar. Watch the execution progress through each node. Check the output in the right panel.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Tip>
                                        Use <strong>Templates</strong> to get started faster! Intemic includes pre-built workflows for common use cases like data imports, scheduled reports, and API integrations.
                                    </Tip>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* KNOWLEDGE BASE */}
                            {/* ================================================================== */}
                            {activeSection === 'knowledge-base' && <section id="knowledge-base" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Knowledge Base</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Define your data structure with entities, properties, and relationships.
                                    </p>
                                </div>

                                {/* Core Concepts */}
                                <div id="knowledge-base-concepts" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Core Concepts</h2>
                                    
                                    <div className="space-y-6 mb-6">
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                                <Database size={18} className="text-[#256A65]" weight="light" />
                                                Entities
                                            </h4>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                Entities are the core data structures in your knowledge base. Think of them as "tables" in a database or "sheets" in a spreadsheet. Examples: Customers, Products, Orders, Employees.
                                            </p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                                <Code size={18} className="text-[#256A65]" weight="light" />
                                                Properties
                                            </h4>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                Properties define the attributes of an entity. Each property has a name and a type. Examples: "Name" (text), "Price" (number), "Created Date" (date).
                                            </p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                                <FileText size={18} className="text-[#256A65]" weight="light" />
                                                Records
                                            </h4>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                Records are individual data entries within an entity. Each record contains values for the entity's properties. Example: A single customer with their name, email, and phone.
                                            </p>
                                        </div>
                                    </div>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Creating an Entity</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li>Navigate to <strong>Knowledge Base</strong> in the sidebar</li>
                                        <li>Click <strong>New Entity</strong></li>
                                        <li>Enter a name and optional description</li>
                                        <li>Add properties by clicking <strong>Add Property</strong></li>
                                        <li>Click <strong>Create</strong> to save</li>
                                    </ol>
                                </div>

                                {/* Property Types */}
                                <div id="knowledge-base-property-types" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Property Types</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Intemic supports the following property types:</p>

                                    <Table 
                                        headers={['Type', 'Description', 'Example']}
                                        rows={[
                                            ['Text', 'Free-form text input', 'Name, Description, Notes'],
                                            ['Number', 'Numeric values (integers or decimals)', 'Price, Quantity, Score'],
                                            ['Date', 'Date and time values', 'Created At, Due Date'],
                                            ['URL', 'Web links with validation', 'Website, Documentation Link'],
                                            ['File', 'File attachments', 'Contract PDF, Product Image'],
                                            ['Relation', 'Links to other entities', 'Customer → Orders'],
                                            ['Select', 'Single choice from predefined options', 'Status, Category'],
                                            ['Multi-select', 'Multiple choices from options', 'Tags, Skills']
                                        ]}
                                    />
                                </div>

                                {/* Relationships */}
                                <div id="knowledge-base-relationships" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Relationships</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Connect entities together using <strong>Relation</strong> properties. This creates navigable links between your data.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Creating a Relationship</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Open the entity you want to add a relation to</li>
                                        <li>Click <strong>Add Property</strong></li>
                                        <li>Select <strong>Relation</strong> as the property type</li>
                                        <li>Choose the target entity from the dropdown</li>
                                        <li>Save the property</li>
                                    </ol>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Example: Customer Orders</h3>
                                    <CodeBlock 
                                        language="plaintext"
                                        code={`Customer (Entity)
├── Name (Text)
├── Email (Text)
└── Orders (Relation → Order)

Order (Entity)
├── Order Number (Text)
├── Total (Number)
├── Date (Date)
└── Customer (Relation → Customer)`}
                                    />

                                    <Tip>
                                        Relations are bidirectional. When you link Order → Customer, the Customer entity automatically shows its related Orders.
                                    </Tip>
                                </div>

                                {/* Import Data */}
                                <div id="knowledge-base-import-data" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Import Data</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Import existing data from CSV or Excel files.</p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Importing from CSV</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Open the entity you want to import into</li>
                                        <li>Click <strong>Import</strong> in the toolbar</li>
                                        <li>Select your CSV file</li>
                                        <li>Map columns to entity properties</li>
                                        <li>Review the preview and click <strong>Import</strong></li>
                                    </ol>

                                    <WarningBox>
                                        Ensure your CSV headers match the property names, or manually map them during import. Date formats should be ISO 8601 (YYYY-MM-DD).
                                    </WarningBox>
                                </div>

                                {/* Use Cases */}
                                <div id="knowledge-base-use-cases" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Use Cases</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Product Catalog</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Products → Categories → Suppliers</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Track products, prices, inventory levels, and supplier relationships.</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">CRM</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Customers → Contacts → Deals</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Manage customer relationships, sales pipeline, and communication history.</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Asset Management</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Equipment → Locations → Maintenance</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Track physical assets, their locations, and maintenance schedules.</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Project Management</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Projects → Tasks → Team Members</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">Organize projects, assign tasks, and track progress.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* WORKFLOWS */}
                            {/* ================================================================== */}
                            {activeSection === 'workflows' && <section id="workflows" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Workflows</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Automate processes with a visual, drag-and-drop workflow builder.
                                    </p>
                                </div>

                                {/* Canvas Basics */}
                                <div id="workflows-canvas-basics" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Canvas Basics</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        The workflow canvas is where you design your automation. It's a visual editor where you place and connect nodes.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Canvas Controls</h3>
                                    <Table 
                                        headers={['Action', 'Mouse', 'Keyboard']}
                                        rows={[
                                            ['Pan canvas', 'Click + drag on empty space', 'Arrow keys'],
                                            ['Zoom in/out', 'Scroll wheel', 'Ctrl/Cmd + / -'],
                                            ['Select node', 'Click on node', '-'],
                                            ['Multi-select', 'Ctrl/Cmd + click', '-'],
                                            ['Delete node', 'Select + Delete key', 'Backspace'],
                                            ['Undo', '-', 'Ctrl/Cmd + Z'],
                                            ['Redo', '-', 'Ctrl/Cmd + Shift + Z']
                                        ]}
                                    />
                                </div>

                                {/* Node Types */}
                                <div id="workflows-node-types" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Node Types</h2>
                                    
                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Triggers</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Triggers start workflow execution. Every workflow needs at least one trigger.</p>
                                    <Table 
                                        headers={['Node', 'Description']}
                                        rows={[
                                            ['Manual Trigger', 'Start workflow manually with a button click'],
                                            ['Schedule', 'Run on a schedule (cron expression or interval)'],
                                            ['Webhook', 'Trigger via HTTP POST request to a unique URL']
                                        ]}
                                    />

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Data Nodes</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Data nodes read, transform, and write data.</p>
                                    <Table 
                                        headers={['Node', 'Description']}
                                        rows={[
                                            ['Fetch Data', 'Read records from a Knowledge Base entity'],
                                            ['Excel/CSV Input', 'Load data from uploaded spreadsheet files'],
                                            ['PDF Input', 'Extract text and tables from PDF documents'],
                                            ['Save to Database', 'Write data to a Knowledge Base entity'],
                                            ['Transform', 'Map, filter, and transform data fields']
                                        ]}
                                    />

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Logic Nodes</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Control the flow of your workflow.</p>
                                    <Table 
                                        headers={['Node', 'Description']}
                                        rows={[
                                            ['Condition', 'Branch based on if/else conditions'],
                                            ['Join', 'Merge data from multiple branches'],
                                            ['Split', 'Divide data into separate streams'],
                                            ['Loop', 'Iterate over array items one by one']
                                        ]}
                                    />

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Action Nodes</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Perform actions and integrations.</p>
                                    <Table 
                                        headers={['Node', 'Description']}
                                        rows={[
                                            ['HTTP Request', 'Make API calls to external services'],
                                            ['Send Email', 'Send emails via SMTP or configured provider'],
                                            ['LLM (AI)', 'Generate text using OpenAI or other LLM providers'],
                                            ['Slack', 'Post messages to Slack channels'],
                                            ['Python', 'Execute custom Python code'],
                                            ['JavaScript', 'Execute custom JavaScript code']
                                        ]}
                                    />
                                </div>

                                {/* Connecting Nodes */}
                                <div id="workflows-connections" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Connecting Nodes</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Nodes communicate through connections. Data flows from output ports (right side) to input ports (left side).
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Creating Connections</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Hover over the output port (small circle on the right)</li>
                                        <li>Click and drag to the input port of another node</li>
                                        <li>Release to create the connection</li>
                                    </ol>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Data References</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Access data from previous nodes using expressions:</p>
                                    <CodeBlock 
                                        language="javascript"
                                        code={`// Reference output from a previous node
{{ $node["Fetch Data"].data }}

// Access specific field
{{ $node["Fetch Data"].data[0].name }}

// Use in conditions
{{ $node["HTTP Request"].statusCode === 200 }}`}
                                    />
                                </div>

                                {/* Execution & Testing */}
                                <div id="workflows-execution" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Execution & Testing</h2>
                                    
                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Running a Workflow</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li><strong>Run</strong> — Execute the entire workflow from the trigger</li>
                                        <li><strong>Run from here</strong> — Start from a specific node (right-click menu)</li>
                                        <li><strong>Test node</strong> — Execute a single node with sample data</li>
                                    </ul>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Execution Status</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Each node shows its status during execution:</p>
                                    <div className="flex gap-4 flex-wrap mb-4">
                                        <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-gray-400"></span> Pending</span>
                                        <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></span> Running</span>
                                        <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-green-400"></span> Success</span>
                                        <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-400"></span> Error</span>
                                    </div>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Debugging</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li>Click on any executed node to see its input/output data</li>
                                        <li>Check the <strong>Logs</strong> tab for detailed execution logs</li>
                                        <li>Use <strong>Executions</strong> to see history of all runs</li>
                                    </ul>
                                </div>

                                {/* Templates */}
                                <div id="workflows-templates" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Templates</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Start with pre-built templates for common use cases:</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-1">Data Import Pipeline</h4>
                                            <p className="text-xs text-[var(--text-tertiary)]">CSV upload → validation → save to Knowledge Base</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-1">Scheduled Report</h4>
                                            <p className="text-xs text-[var(--text-tertiary)]">Daily fetch → AI summary → email delivery</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-1">API Integration</h4>
                                            <p className="text-xs text-[var(--text-tertiary)]">Webhook trigger → HTTP request → save response</p>
                                        </div>
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-1">Alert Pipeline</h4>
                                            <p className="text-xs text-[var(--text-tertiary)]">Monitor data → condition check → Slack notification</p>
                                        </div>
                                    </div>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* INTELIGENCIA */}
                            {/* ================================================================== */}
                            {activeSection === 'inteligencia' && <section id="inteligencia" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Inteligencia</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        AI-powered agents that understand your data, answer questions, and generate insights.
                                    </p>
                                </div>

                                {/* Agents */}
                                <div id="inteligencia-agents" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Agents</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Agents are AI assistants with specific instructions, data access, and capabilities. Every workspace comes with a default agent (<strong>Asistente General</strong>) that you can start chatting with immediately.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Creating a new agent</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Go to <strong>Inteligencia</strong> in the sidebar</li>
                                        <li>Click <strong>Agents</strong> in the top navigation</li>
                                        <li>Click <strong>New Agent</strong></li>
                                        <li>Give it a name, description, and custom instructions</li>
                                        <li>Configure which entities the agent can access</li>
                                        <li>Enable or disable memory (whether the agent remembers previous conversations)</li>
                                    </ol>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Agent configuration</h3>
                                    <Table
                                        headers={['Setting', 'Description']}
                                        rows={[
                                            ['Name & Description', 'Identifies the agent in the selector and agents page'],
                                            ['Instructions', 'Custom prompt that defines the agent\'s behavior and expertise'],
                                            ['Data Access', 'Which Knowledge Base entities the agent can query'],
                                            ['Workflow Access', 'Which workflows the agent can trigger'],
                                            ['Memory', 'Whether the agent retains context across different chats'],
                                        ]}
                                    />

                                    <Tip>
                                        Write clear, specific instructions. For example: "You are a production analyst at a food company. Focus on quality metrics and batch traceability. Always reference specific lot numbers."
                                    </Tip>
                                </div>

                                {/* Chat */}
                                <div id="inteligencia-chat" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Chat</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        The chat is where you interact with agents. Select an agent from the dropdown at the top and start a conversation.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">How to start</h3>
                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Select an agent from the dropdown at the top of the chat</li>
                                        <li>Click <strong>New Chat</strong> or start typing</li>
                                        <li>Ask questions about your data, request analysis, or generate reports</li>
                                    </ol>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Chat options</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        When you have an active chat, you can toggle <strong>Memory</strong> on or off. When memory is enabled, the agent will use context from previous messages in the conversation to give more relevant answers.
                                    </p>
                                </div>

                                {/* Data Access Control */}
                                <div id="inteligencia-data-access" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Data Access Control</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Each agent can be configured to access specific entities from your Knowledge Base. This ensures data security and separation.
                                    </p>

                                    <Table 
                                        headers={['Mode', 'Description']}
                                        rows={[
                                            ['All entities', 'Agent can query all entities in your Knowledge Base'],
                                            ['Selected entities', 'Agent can only access the entities you choose'],
                                            ['None', 'Agent has no data access (general-purpose assistant)']
                                        ]}
                                    />

                                    <WarningBox>
                                        Data access is enforced on the server. An agent cannot access entities it hasn't been granted permission to, even if referenced in a conversation.
                                    </WarningBox>
                                </div>

                                {/* Using Mentions */}
                                <div id="inteligencia-mentions" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Using Mentions</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Use the <code className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-sm">@</code> symbol in the chat to reference specific entities. This automatically provides the agent with relevant data context.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Examples</h3>
                                    <CodeBlock 
                                        language="plaintext"
                                        code={`"Show me all @Customers from Barcelona"

"Compare @Products sales with @Orders this month"

"Analyze trends for @Customers with high-value @Orders"`}
                                    />

                                    <Tip>
                                        Type <code className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-sm">@</code> in the chat input to see a dropdown of all entities your agent can access.
                                    </Tip>
                                </div>

                                {/* AI Reports */}
                                <div id="inteligencia-reports" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">AI Reports</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Ask your agent to generate reports from your data using natural language.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Report types</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li><strong>Summaries</strong> — High-level overview of entity data</li>
                                        <li><strong>Trend Analysis</strong> — Changes over time with visualizations</li>
                                        <li><strong>Comparisons</strong> — Side-by-side analysis across entities</li>
                                        <li><strong>Anomaly Detection</strong> — Identify outliers and unusual patterns</li>
                                    </ul>

                                    <p className="text-[var(--text-primary)]">Reports can be exported as PDF, Markdown, or copied to clipboard.</p>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* DASHBOARDS */}
                            {/* ================================================================== */}
                            {activeSection === 'dashboards' && <section id="dashboards" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Dashboards</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Build real-time visualizations with drag-and-drop widgets.
                                    </p>
                                </div>

                                {/* Widget Types */}
                                <div id="dashboards-widgets" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Widget Types</h2>
                                    
                                    <Table 
                                        headers={['Widget', 'Description', 'Best For']}
                                        rows={[
                                            ['KPI', 'Large number with label and trend indicator', 'Key metrics (revenue, users)'],
                                            ['Stat', 'Simple number with optional comparison', 'Quick status checks'],
                                            ['Gauge', 'Circular progress indicator', 'Percentage-based metrics'],
                                            ['Bar Chart', 'Vertical or horizontal bars', 'Category comparisons'],
                                            ['Line Chart', 'Connected data points over time', 'Trends and time series'],
                                            ['Area Chart', 'Filled line chart', 'Volume and cumulative data'],
                                            ['Pie Chart', 'Circular segments', 'Part-to-whole relationships'],
                                            ['Table', 'Tabular data display', 'Detailed data views'],
                                            ['AI Widget', 'Natural language insights', 'Dynamic summaries']
                                        ]}
                                    />
                                </div>

                                {/* Data Sources */}
                                <div id="dashboards-data-sources" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Data Sources</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Widgets pull data from Knowledge Base entities. Configure the data source when adding a widget.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Configuration Options</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li><strong>Entity</strong> — Select the data source entity</li>
                                        <li><strong>X-Axis</strong> — Property to use for categories/time</li>
                                        <li><strong>Y-Axis</strong> — Property to measure (numeric)</li>
                                        <li><strong>Aggregation</strong> — Sum, Average, Count, Min, Max</li>
                                        <li><strong>Limit</strong> — Maximum number of data points</li>
                                    </ul>
                                </div>

                                {/* Filters & Refresh */}
                                <div id="dashboards-filters" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Filters & Refresh</h2>
                                    
                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Time Range</h3>
                                    <p className="text-[var(--text-primary)] mb-3">Filter data by time period using the toolbar picker:</p>
                                    <ul className="list-disc pl-6 space-y-1 text-[var(--text-primary)] mb-4">
                                        <li>Last 15 minutes / 1 hour / 6 hours / 24 hours</li>
                                        <li>Last 7 days / 30 days / 90 days</li>
                                        <li>Custom date range</li>
                                    </ul>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Auto-Refresh</h3>
                                    <p className="text-[var(--text-primary)]">Enable automatic data refresh at configurable intervals (30s, 1m, 5m, 15m).</p>
                                </div>

                                {/* Sharing */}
                                <div id="dashboards-sharing" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Sharing Dashboards</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Share dashboards with team members or generate public links.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Sharing Options</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li><strong>Team share</strong> — Visible to all organization members</li>
                                        <li><strong>Public link</strong> — Anyone with the link can view (read-only)</li>
                                        <li><strong>Embed</strong> — Embed in external websites via iframe</li>
                                    </ul>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* CONNECTIONS */}
                            {/* ================================================================== */}
                            {activeSection === 'connections' && <section id="connections" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Connections</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Integrate with external databases and services.
                                    </p>
                                </div>

                                {/* Available Connectors */}
                                <div id="connections-available" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Available Connectors</h2>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                        {['SAP', 'Oracle', 'PostgreSQL', 'MySQL', 'MongoDB', 'Snowflake', 'AWS S3', 'Azure Blob', 'Google Cloud', 'Slack', 'Salesforce', 'REST API'].map(conn => (
                                            <div key={conn} className="p-3 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-center">
                                                <span className="text-sm text-[var(--text-primary)]">{conn}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Configuration */}
                                <div id="connections-configure" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Configuration</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Each connector requires specific credentials:</p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">PostgreSQL Example</h3>
                                    <CodeBlock 
                                        language="json"
                                        code={`{
  "host": "your-server.postgres.database.azure.com",
  "port": 5432,
  "database": "production",
  "username": "admin",
  "password": "••••••••",
  "ssl": true
}`}
                                    />

                                    <WarningBox>
                                        Credentials are encrypted at rest. Never share connection strings in plain text.
                                    </WarningBox>
                                </div>

                                {/* Testing */}
                                <div id="connections-testing" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Testing Connections</h2>
                                    <p className="text-[var(--text-primary)] mb-4">
                                        After configuration, click <strong>Test Connection</strong> to verify connectivity before saving.
                                    </p>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* LAB */}
                            {/* ================================================================== */}
                            {activeSection === 'lab' && <section id="lab" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Lab</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Run experiments and scenario analysis powered by workflows.
                                    </p>
                                </div>

                                {/* Creating Experiments */}
                                <div id="lab-create-experiment" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Creating Experiments</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Lab experiments let you model "what-if" scenarios using workflows as the calculation engine.
                                    </p>

                                    <ol className="list-decimal pl-6 space-y-2 text-[var(--text-primary)] mb-4">
                                        <li>Navigate to <strong>Lab</strong> in the sidebar</li>
                                        <li>Click <strong>New Experiment</strong></li>
                                        <li>Select a workflow to power the experiment</li>
                                        <li>Define variables (what you want to change)</li>
                                        <li>Create scenarios with different variable values</li>
                                        <li>Run the simulation and compare results</li>
                                    </ol>
                                </div>

                                {/* Variables & Parameters */}
                                <div id="lab-variables" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Variables & Parameters</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Parameters are extracted from workflow inputs and can be adjusted interactively.</p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Modifier Types</h3>
                                    <Table 
                                        headers={['Type', 'Description', 'Example']}
                                        rows={[
                                            ['Percentage', 'Increase/decrease by percentage', '+10% revenue'],
                                            ['Absolute', 'Add/subtract fixed amount', '+1000 units'],
                                            ['Set Value', 'Override to specific value', 'Set price to 99']
                                        ]}
                                    />
                                </div>

                                {/* Analysis & Results */}
                                <div id="lab-analysis" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Analysis & Results</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Understand how changes in one variable affect outcomes by running sensitivity analysis.
                                    </p>

                                    <p className="text-[var(--text-primary)]">
                                        Configure a range of values (e.g., -20% to +20%) and Intemic will calculate the impact at each step, 
                                        generating a sensitivity curve.
                                    </p>
                                </div>

                                {/* Comparing Scenarios */}
                                <div id="lab-compare" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Comparing Scenarios</h2>
                                    <p className="text-[var(--text-primary)] mb-4">
                                        Create multiple scenarios within a simulation and compare them side-by-side:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li><strong>Baseline</strong> — Original data without modifications</li>
                                        <li><strong>Optimistic</strong> — Best-case scenario assumptions</li>
                                        <li><strong>Conservative</strong> — Worst-case scenario assumptions</li>
                                    </ul>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* SETTINGS & ADMIN */}
                            {/* ================================================================== */}
                            {activeSection === 'settings' && <section id="settings" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Settings & Admin</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Manage users, organizations, and system settings.
                                    </p>
                                </div>

                                {/* User Management */}
                                <div id="settings-users" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">User Management</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Invite and manage team members in Settings → Users.</p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Roles</h3>
                                    <Table 
                                        headers={['Role', 'Permissions']}
                                        rows={[
                                            ['Admin', 'Full access to all features and settings'],
                                            ['Editor', 'Create and edit entities, workflows, dashboards'],
                                            ['Viewer', 'Read-only access to data and dashboards']
                                        ]}
                                    />
                                </div>

                                {/* Organizations */}
                                <div id="settings-organizations" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Organizations</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Organizations are isolated workspaces. Each organization has its own entities, workflows, and users.
                                    </p>

                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li>Create multiple organizations for different teams or projects</li>
                                        <li>Switch between organizations from the sidebar menu</li>
                                        <li>Data is completely isolated between organizations</li>
                                    </ul>
                                </div>

                                {/* Notifications */}
                                <div id="settings-notifications" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Notifications</h2>
                                    <p className="text-[var(--text-primary)] mb-4">Configure alerts and notification preferences.</p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Alert Types</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li><strong>Workflow alerts</strong> — Notify on execution success/failure</li>
                                        <li><strong>Data alerts</strong> — Notify when data meets conditions</li>
                                        <li><strong>System alerts</strong> — Storage, performance, errors</li>
                                    </ul>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mt-6 mb-3">Delivery Channels</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)]">
                                        <li>In-app notifications</li>
                                        <li>Email</li>
                                        <li>Slack (requires connection)</li>
                                    </ul>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* SECURITY */}
                            {/* ================================================================== */}
                            {activeSection === 'security' && <section id="security" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Security</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        How Intemic protects your data, controls access, and meets compliance requirements.
                                    </p>
                                </div>

                                {/* Overview */}
                                <div id="security-overview" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Overview</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic Platform is built with enterprise security in mind. Your data is protected at every level — from how you log in, to what you can access, to how sensitive information is stored.
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 my-6">
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Lock size={16} weight="light" className="text-[var(--accent-primary)]" />
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Secure Login</h4>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)]">Strong passwords, Single Sign-On (SSO) with your company identity provider, and secure session management.</p>
                                        </div>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <UserCircle size={16} weight="light" className="text-[var(--accent-primary)]" />
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Access Control</h4>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)]">Role-based permissions ensure each team member only sees and edits what they need.</p>
                                        </div>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Key size={16} weight="light" className="text-[var(--accent-primary)]" />
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Data Encryption</h4>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)]">Sensitive data is encrypted at rest using AES-256 encryption. All connections use HTTPS.</p>
                                        </div>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShieldCheck size={16} weight="light" className="text-[var(--accent-primary)]" />
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Compliance</h4>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)]">GDPR-ready with data export, deletion requests, and consent management built in.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Authentication & SSO */}
                                <div id="security-authentication" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Authentication & SSO</h2>
                                    
                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Password Requirements</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        When creating an account or changing your password, you must meet these requirements:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)] mb-6">
                                        <li>At least 8 characters long</li>
                                        <li>Include uppercase and lowercase letters</li>
                                        <li>Include at least one number</li>
                                        <li>Include at least one special character (!@#$...)</li>
                                    </ul>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 mt-6">Single Sign-On (SSO)</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        If your organization uses an identity provider (like Okta, Azure AD, or Google Workspace), your admin can enable SSO. Once configured, you can log in with your company credentials — no separate Intemic password needed.
                                    </p>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic supports both <strong>SAML 2.0</strong> and <strong>OpenID Connect</strong> protocols, compatible with most enterprise identity providers.
                                    </p>

                                    <Tip>
                                        If your organization has SSO enabled, you'll see a <strong>"Sign in with SSO"</strong> button on the login page. Your account is automatically created on first login.
                                    </Tip>
                                </div>

                                {/* Roles & Permissions */}
                                <div id="security-authorization" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Roles & Permissions</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Every user in a workspace has a role that determines what they can see and do. Your admin assigns roles from <strong>Settings &gt; Team</strong>.
                                    </p>

                                    <Table
                                        headers={['Role', 'What you can do']}
                                        rows={[
                                            ['Admin', 'Everything — manage users, settings, billing, and all content'],
                                            ['Editor', 'Create and edit entities, workflows, dashboards, and agents'],
                                            ['Viewer', 'View all content but cannot make changes'],
                                            ['Auditor', 'View content plus access to activity logs and security reports'],
                                        ]}
                                    />

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 mt-6">What each role can access</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Permissions are applied per area of the platform:
                                    </p>
                                    <Table
                                        headers={['Area', 'Admin', 'Editor', 'Viewer', 'Auditor']}
                                        rows={[
                                            ['Knowledge Base', 'Full', 'Create / Edit', 'View', 'View'],
                                            ['Workflows', 'Full', 'Create / Edit / Run', 'View', 'View'],
                                            ['Dashboards', 'Full', 'Create / Edit', 'View', 'View'],
                                            ['Inteligencia', 'Full', 'Create / Edit / Chat', 'Chat only', 'Chat only'],
                                            ['Connections', 'Full', 'Configure', 'View', 'View'],
                                            ['Settings & Team', 'Full', 'No access', 'No access', 'No access'],
                                            ['Activity Log', 'Full', 'No access', 'No access', 'Full'],
                                        ]}
                                    />
                                </div>

                                {/* Data Protection */}
                                <div id="security-data-protection" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Data Protection</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic takes multiple measures to keep your data safe:
                                    </p>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Lock size={13} weight="light" className="text-[var(--accent-primary)]" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Encryption at rest</h4>
                                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Sensitive fields like credentials and personal data are encrypted using AES-256 before being stored.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Shield size={13} weight="light" className="text-[var(--accent-primary)]" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Encryption in transit</h4>
                                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">All data transmitted between your browser and the server is encrypted via HTTPS/TLS.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <ShieldCheck size={13} weight="light" className="text-[var(--accent-primary)]" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Audit trail</h4>
                                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Every action in the platform is logged. Admins and auditors can review the full activity history in Settings &gt; Activity Log.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Key size={13} weight="light" className="text-[var(--accent-primary)]" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">Secure sessions</h4>
                                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Sessions are stored in HTTP-only cookies that cannot be accessed by scripts, protecting against XSS attacks.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Privacy & Compliance */}
                                <div id="security-compliance" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Privacy & Compliance</h2>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic is built to meet European data protection requirements. As a user, you have full control over your personal data.
                                    </p>

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Your Rights</h3>
                                    <Table
                                        headers={['Right', 'What it means', 'How to use it']}
                                        rows={[
                                            ['Data deletion', 'Request removal of all your personal data', 'Settings > Privacy > Request Data Deletion'],
                                            ['Data export', 'Download a copy of all your data', 'Settings > Privacy > Export My Data'],
                                            ['Consent management', 'Control how your data is processed', 'Settings > Privacy > Manage Consent'],
                                        ]}
                                    />

                                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 mt-6">Compliance Standards</h3>
                                    <p className="text-[var(--text-primary)] mb-4 leading-relaxed">
                                        Intemic is working towards the following certifications to meet enterprise requirements:
                                    </p>
                                    <Table
                                        headers={['Standard', 'Status']}
                                        rows={[
                                            ['GDPR / LOPD (EU data protection)', 'Compliant'],
                                            ['SOC 2 Type II (security controls)', 'In progress'],
                                            ['ISO 27001 (information security)', 'Planned'],
                                        ]}
                                    />

                                    <Tip>
                                        If you need a Data Processing Agreement (DPA) or have specific compliance questions, contact your account manager or reach out to our security team.
                                    </Tip>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* TROUBLESHOOTING */}
                            {/* ================================================================== */}
                            {activeSection === 'troubleshooting' && <section id="troubleshooting" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Troubleshooting</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Common issues and their solutions.
                                    </p>
                                </div>

                                {/* Common Errors */}
                                <div id="troubleshooting-common-errors" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">Common Errors</h2>

                                    <div className="space-y-6">
                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Page not loading or showing errors</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">The page shows an error message or blank screen.</p>
                                            <p className="text-sm text-[var(--text-primary)]"><strong>Solution:</strong> Try refreshing the page (Ctrl+R / Cmd+R). If the issue persists, clear your browser cache or try a different browser.</p>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">AI Agent not responding</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">The agent seems stuck or returns an error.</p>
                                            <p className="text-sm text-[var(--text-primary)]"><strong>Solution:</strong> Wait a few seconds and try again. If the issue continues, the AI service may be temporarily unavailable — check back shortly.</p>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Workflow execution timeout</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Workflow stuck or taking too long to complete.</p>
                                            <p className="text-sm text-[var(--text-primary)]"><strong>Solution:</strong> Check for infinite loops in conditions. If using external connections, verify that the target system is reachable.</p>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Cannot access a feature</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">A button or section is greyed out or shows "No access".</p>
                                            <p className="text-sm text-[var(--text-primary)]"><strong>Solution:</strong> Your role may not have permission for that feature. Contact your workspace admin to request access. See <strong>Security &gt; Roles & Permissions</strong> for details.</p>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg">
                                            <h4 className="font-medium text-[var(--text-primary)] mb-2">Data not showing in dashboard</h4>
                                            <p className="text-sm text-[var(--text-secondary)] mb-2">Dashboard widgets show empty or "No data" messages.</p>
                                            <p className="text-sm text-[var(--text-primary)]"><strong>Solution:</strong> Check that the data source entity has records. Verify the widget's data mapping in the configuration panel.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* FAQ */}
                                <div id="troubleshooting-faq" className="mb-12">
                                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4 uppercase tracking-wide">FAQ</h2>

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">How do I reset my password?</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">Click "Forgot Password" on the login page. You'll receive an email with a reset link.</p>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">Can I use Intemic offline?</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">Yes, the platform works offline after initial load. However, AI features and external connections require internet.</p>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">How do I export my data?</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">Use the Export function in each entity's toolbar. You can also download all your personal data from Settings &gt; Privacy.</p>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">Is there a limit to the number of entities?</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">No hard limit. Performance depends on total records and server resources.</p>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">Can multiple users edit the same workflow?</h3>
                                            <p className="text-sm text-[var(--text-secondary)]">Yes, Intemic supports real-time collaboration. You'll see other users' cursors and changes live.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>}

                            {/* ================================================================== */}
                            {/* CHANGELOG */}
                            {/* ================================================================== */}
                            {activeSection === 'changelog' && <section id="changelog" className="mb-8">
                                <div className="mb-8">
                                    <h1 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Changelog</h1>
                                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                                        Release history and version updates.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <div className="border-l-2 border-[#256A65] pl-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-sm font-medium text-[var(--text-primary)]">v1.0.0</h3>
                                            <span className="px-2 py-0.5 bg-[#256A65]/20 text-[#256A65] text-xs rounded">Latest</span>
                                        </div>
                                        <p className="text-sm text-[var(--text-tertiary)] mb-3">January 2026</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                            <li>Initial public release</li>
                                            <li>Knowledge Base with entities, properties, and relationships</li>
                                            <li>Visual workflow builder with 20+ node types</li>
                                            <li>AI agents with custom instructions</li>
                                            <li>Grafana-style dashboard builder</li>
                                            <li>External connections (SAP, Oracle, PostgreSQL, etc.)</li>
                                            <li>Simulation and scenario analysis</li>
                                            <li>Real-time collaboration features</li>
                                            <li>Global search with Cmd+K</li>
                                            <li>Notification center and alerts</li>
                                        </ul>
                                    </div>

                                    <div className="border-l-2 border-[var(--border-light)] pl-4">
                                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">v0.9.0 Beta</h3>
                                        <p className="text-sm text-[var(--text-tertiary)] mb-3">December 2025</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                            <li>Beta release for early adopters</li>
                                            <li>Core entity modeling features</li>
                                            <li>Basic workflow automation</li>
                                            <li>AI report generation</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>}

                            {/* Section Pagination */}
                            <div className="flex items-center justify-between pt-6 mt-8 border-t border-[var(--border-light)]">
                                {previousSection ? (
                                    <button
                                        onClick={() => goToSection(previousSection)}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors group"
                                    >
                                        <CaretLeft size={14} weight="light" className="group-hover:-translate-x-0.5 transition-transform" />
                                        <div className="text-left">
                                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block">Previous</span>
                                            <span className="font-medium">{previousSection.title}</span>
                                        </div>
                                    </button>
                                ) : (
                                    <div />
                                )}

                                {/* Page indicator */}
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                    {getCurrentSectionIndex() + 1} / {DOC_SECTIONS.length}
                                </span>

                                {nextSection ? (
                                    <button
                                        onClick={() => goToSection(nextSection)}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors group"
                                    >
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block">Next</span>
                                            <span className="font-medium">{nextSection.title}</span>
                                        </div>
                                        <CaretRight size={14} weight="light" className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                ) : (
                                    <div />
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
