import React, { useState, useEffect } from 'react';
import { 
    Database, 
    CheckCircle, 
    XCircle, 
    Plus, 
    GearSix,
    SpinnerGap,
    MagnifyingGlass,
    X,
    Star,
    ArrowRight,
    Clock
} from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';

interface Connection {
    id: string;
    name: string;
    type: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    logoUrl?: string;
    description: string;
    category: 'database' | 'cloud' | 'erp' | 'crm' | 'productivity' | 'analytics' | 'communication' | 'ot';
    connected: boolean;
    lastSync?: string;
    popular?: boolean;
    comingSoon?: boolean;
    config?: {
        host?: string;
        database?: string;
        username?: string;
    };
}

const CONNECTIONS: Connection[] = [
    // CRM & Sales
    {
        id: 'salesforce',
        name: 'Salesforce',
        type: 'CRM',
        logoUrl: 'https://cdn.simpleicons.org/salesforce',
        description: 'Connect to Salesforce CRM for sales, leads, and customer data integration',
        category: 'crm',
        connected: false,
        popular: true
    },
    {
        id: 'dynamics365',
        name: 'Dynamics 365',
        type: 'ERP & CRM',
        logoUrl: 'https://cdn.simpleicons.org/dynamics365',
        description: 'Connect to Microsoft Dynamics 365 for business operations and CRM',
        category: 'erp',
        connected: false,
        popular: true
    },
    // ERP Systems
    {
        id: 'sap',
        name: 'SAP',
        type: 'ERP',
        logoUrl: 'https://cdn.simpleicons.org/sap',
        description: 'Connect to SAP S/4HANA and ECC for enterprise data integration',
        category: 'erp',
        connected: false,
        popular: true
    },
    {
        id: 'oracle-erp',
        name: 'Oracle ERP Cloud',
        type: 'ERP',
        logoUrl: 'https://cdn.simpleicons.org/oracle',
        description: 'Integrate with Oracle ERP Cloud for financial and operational data',
        category: 'erp',
        connected: false
    },
    {
        id: 'netsuite',
        name: 'NetSuite',
        type: 'ERP',
        logoUrl: 'https://cdn.simpleicons.org/oracle',
        description: 'Connect to Oracle NetSuite for unified business management',
        category: 'erp',
        connected: false
    },
    // OT Systems & Industrial
    {
        id: 'scada',
        name: 'SCADA',
        type: 'OT System',
        logoUrl: 'https://cdn.simpleicons.org/opcua',
        description: 'Connect to SCADA systems via OPC UA or Modbus for real-time process data',
        category: 'ot',
        connected: false,
        popular: true
    },
    {
        id: 'dcs',
        name: 'DCS',
        type: 'OT System',
        logoUrl: 'https://cdn.simpleicons.org/opcua',
        description: 'Connect to Distributed Control Systems for plant-wide control data',
        category: 'ot',
        connected: false
    },
    {
        id: 'mes',
        name: 'MES',
        type: 'Manufacturing System',
        logoUrl: 'https://cdn.simpleicons.org/microsoftazure',
        description: 'Connect to Manufacturing Execution Systems for production tracking',
        category: 'ot',
        connected: false,
        popular: true
    },
    {
        id: 'lims',
        name: 'LIMS',
        type: 'Laboratory System',
        logoUrl: 'https://cdn.simpleicons.org/microsoftazure',
        description: 'Connect to Laboratory Information Management Systems for lab data',
        category: 'ot',
        connected: false
    },
    {
        id: 'data-historian',
        name: 'Data Historian',
        type: 'Time-Series Database',
        logoUrl: 'https://cdn.simpleicons.org/influxdb',
        description: 'Connect to Data Historian systems (OSIsoft PI, Wonderware, etc.) for historical time-series data',
        category: 'ot',
        connected: false,
        popular: true
    },
    {
        id: 'opcua',
        name: 'OPC UA',
        type: 'Industrial Protocol',
        logoUrl: 'https://cdn.simpleicons.org/opcua',
        description: 'Connect via OPC UA protocol to PLCs, sensors, and industrial equipment',
        category: 'ot',
        connected: false
    },
    {
        id: 'modbus',
        name: 'Modbus',
        type: 'Industrial Protocol',
        logoUrl: 'https://cdn.simpleicons.org/opcua',
        description: 'Connect via Modbus TCP/RTU to industrial devices and PLCs',
        category: 'ot',
        connected: false
    },
    {
        id: 'mqtt',
        name: 'MQTT',
        type: 'IoT Protocol',
        logoUrl: 'https://cdn.simpleicons.org/eclipsemosquitto',
        description: 'Connect to MQTT brokers for IoT sensor data and device telemetry',
        category: 'ot',
        connected: false
    },
    {
        id: 'plc',
        name: 'PLC',
        type: 'Industrial Controller',
        logoUrl: 'https://cdn.simpleicons.org/opcua',
        description: 'Direct connection to Programmable Logic Controllers for real-time control data',
        category: 'ot',
        connected: false
    },
    // Databases
    {
        id: 'postgresql',
        name: 'PostgreSQL',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/postgresql',
        description: 'Connect to PostgreSQL for real-time data queries and analytics',
        category: 'database',
        connected: false
    },
    {
        id: 'mysql',
        name: 'MySQL',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/mysql',
        description: 'Connect to MySQL databases for data access and synchronization',
        category: 'database',
        connected: false
    },
    {
        id: 'mongodb',
        name: 'MongoDB',
        type: 'NoSQL Database',
        logoUrl: 'https://cdn.simpleicons.org/mongodb',
        description: 'Connect to MongoDB for document-based data access',
        category: 'database',
        connected: false
    },
    {
        id: 'sqlserver',
        name: 'SQL Server',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/microsoftsqlserver',
        description: 'Connect to Microsoft SQL Server for enterprise data',
        category: 'database',
        connected: false
    },
    // Analytics & BI
    {
        id: 'powerbi',
        name: 'Power BI',
        type: 'Business Intelligence',
        logoUrl: 'https://cdn.simpleicons.org/powerbi',
        description: 'Connect to Power BI for advanced analytics and reporting',
        category: 'analytics',
        connected: false,
        popular: true
    },
    {
        id: 'tableau',
        name: 'Tableau',
        type: 'Analytics',
        logoUrl: 'https://cdn.simpleicons.org/tableau',
        description: 'Integrate with Tableau for data visualization and dashboards',
        category: 'analytics',
        connected: false
    },
    {
        id: 'snowflake',
        name: 'Snowflake',
        type: 'Data Warehouse',
        logoUrl: 'https://cdn.simpleicons.org/snowflake',
        description: 'Connect to Snowflake data cloud for analytics and data sharing',
        category: 'cloud',
        connected: false
    },
    {
        id: 'bigquery',
        name: 'BigQuery',
        type: 'Data Warehouse',
        logoUrl: 'https://cdn.simpleicons.org/googlebigquery',
        description: 'Connect to Google BigQuery for serverless data analytics',
        category: 'cloud',
        connected: false
    },
    // Productivity & Collaboration
    {
        id: 'google-sheets',
        name: 'Google Sheets',
        type: 'Spreadsheet',
        logoUrl: 'https://cdn.simpleicons.org/googlesheets',
        description: 'Sync data with Google Sheets for easy collaboration',
        category: 'productivity',
        connected: false,
        popular: true
    },
    {
        id: 'excel',
        name: 'Microsoft Excel',
        type: 'Spreadsheet',
        logoUrl: 'https://cdn.simpleicons.org/microsoftexcel',
        description: 'Connect to Excel files and OneDrive for spreadsheet data',
        category: 'productivity',
        connected: false
    },
    {
        id: 'airtable',
        name: 'Airtable',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/airtable',
        description: 'Integrate with Airtable for flexible data management',
        category: 'productivity',
        connected: false
    },
    {
        id: 'notion',
        name: 'Notion',
        type: 'Workspace',
        logoUrl: 'https://cdn.simpleicons.org/notion',
        description: 'Connect to Notion databases and pages for content sync',
        category: 'productivity',
        connected: false
    },
    // Cloud Storage
    {
        id: 'aws-s3',
        name: 'AWS S3',
        type: 'Cloud Storage',
        logoUrl: 'https://cdn.simpleicons.org/amazons3',
        description: 'Connect to Amazon S3 for file storage and data lakes',
        category: 'cloud',
        connected: false
    },
    {
        id: 'azure-blob',
        name: 'Azure Blob',
        type: 'Cloud Storage',
        logoUrl: 'https://cdn.simpleicons.org/microsoftazure',
        description: 'Connect to Azure Blob Storage for cloud file management',
        category: 'cloud',
        connected: false
    },
    {
        id: 'google-drive',
        name: 'Google Drive',
        type: 'Cloud Storage',
        logoUrl: 'https://cdn.simpleicons.org/googledrive',
        description: 'Sync files and folders from Google Drive',
        category: 'cloud',
        connected: false
    },
    // Communication & Project Management
    {
        id: 'teams',
        name: 'Microsoft Teams',
        type: 'Communication',
        logoUrl: 'https://cdn.simpleicons.org/microsoftteams',
        description: 'Send notifications and updates to Microsoft Teams channels',
        category: 'communication',
        connected: false,
        popular: true
    },
    {
        id: 'slack',
        name: 'Slack',
        type: 'Communication',
        logoUrl: 'https://cdn.simpleicons.org/slack',
        description: 'Connect to Slack for notifications and workflow integration',
        category: 'communication',
        connected: false
    },
    {
        id: 'jira',
        name: 'Jira',
        type: 'Project Management',
        logoUrl: 'https://cdn.simpleicons.org/jira',
        description: 'Integrate with Jira for project tracking and issue management',
        category: 'productivity',
        connected: false
    },
    {
        id: 'asana',
        name: 'Asana',
        type: 'Project Management',
        logoUrl: 'https://cdn.simpleicons.org/asana',
        description: 'Connect to Asana for task and project synchronization',
        category: 'productivity',
        connected: false
    },
    // APIs & Custom
    {
        id: 'rest-api',
        name: 'REST API',
        type: 'Custom API',
        logoUrl: 'https://cdn.simpleicons.org/openapiinitiative',
        description: 'Connect to any REST API with custom configuration',
        category: 'cloud',
        connected: false
    },
    {
        id: 'graphql',
        name: 'GraphQL',
        type: 'Custom API',
        logoUrl: 'https://cdn.simpleicons.org/graphql',
        description: 'Connect to GraphQL endpoints for flexible data queries',
        category: 'cloud',
        connected: false
    },
    // Coming Soon
    {
        id: 'linkedin',
        name: 'LinkedIn',
        type: 'Social',
        logoUrl: 'https://cdn.simpleicons.org/linkedin',
        description: 'Import contacts and company data from LinkedIn Sales Navigator',
        category: 'crm',
        connected: false,
        comingSoon: true
    },
    {
        id: 'zendesk',
        name: 'Zendesk',
        type: 'Support',
        logoUrl: 'https://cdn.simpleicons.org/zendesk',
        description: 'Integrate with Zendesk for customer support data',
        category: 'crm',
        connected: false,
        comingSoon: true
    }
];

export const Connections: React.FC = () => {
    const [connections, setConnections] = useState<Connection[]>(CONNECTIONS);
    const [savedConnections, setSavedConnections] = useState<any[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            // Load saved connections from backend
            const res = await fetch(`${API_BASE}/data-connections`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setSavedConnections(data || []);
                
                // Update connections with server data (status, lastTestedAt, etc.)
                setConnections(prev => prev.map(conn => {
                    const serverConn = data.find((c: any) => c.type === conn.id || c.name.toLowerCase() === conn.name.toLowerCase());
                    if (serverConn) {
                        return { 
                            ...conn, 
                            connected: serverConn.status === 'active',
                            status: serverConn.status,
                            lastTestedAt: serverConn.lastTestedAt,
                            lastError: serverConn.lastError
                        };
                    }
                    return conn;
                }));
            }
        } catch (error) {
            console.error('Error loading connections:', error);
        }
    };

    const handleConnect = async (connection: Connection) => {
        setSelectedConnection(connection);
        setShowConfigModal(true);
    };

    const handleDisconnect = async (connectionId: string) => {
        if (!confirm('Are you sure you want to disconnect this connection?')) return;
        
        try {
            // Find saved connection by type or name
            const savedConn = savedConnections.find(c => c.type === connectionId || c.name.toLowerCase() === connectionId.toLowerCase());
            if (savedConn) {
                const res = await fetch(`${API_BASE}/data-connections/${savedConn.id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (res.ok) {
                    await loadConnections();
                }
            } else {
                // If not found, just update local state
                setConnections(prev => prev.map(conn => 
                    conn.id === connectionId ? { ...conn, connected: false } : conn
                ));
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    };

    const handleTestConnection = async (connectionId: string) => {
        const savedConn = savedConnections.find(c => c.type === connectionId || c.name.toLowerCase() === connectionId.toLowerCase());
        if (!savedConn) {
            alert('Please configure the connection first before testing.');
            return;
        }

        setTestingConnectionId(savedConn.id);
        try {
            const res = await fetch(`${API_BASE}/data-connections/${savedConn.id}/test`, {
                method: 'POST',
                credentials: 'include'
            });
            const result = await res.json();
            
            if (result.success) {
                alert(`Connection test successful: ${result.message}`);
            } else {
                alert(`Connection test failed: ${result.message}`);
            }
            
            // Reload connections to update status
            await loadConnections();
        } catch (error: any) {
            alert(`Error testing connection: ${error.message}`);
        } finally {
            setTestingConnectionId(null);
        }
    };

    const handleSaveConnection = async (config: any) => {
        if (!selectedConnection) return;
        
        setIsConnecting(true);
        try {
            // Check if connection already exists
            const existingConn = savedConnections.find(c => c.type === selectedConnection.id);
            const connectionId = existingConn?.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const payload = {
                id: connectionId,
                name: config.name || selectedConnection.name,
                type: selectedConnection.id,
                description: config.description || selectedConnection.description,
                config: config,
                status: 'inactive' // Will be set to active after successful test
            };

            const res = await fetch(`${API_BASE}/data-connections${existingConn ? `/${existingConn.id}` : ''}`, {
                method: existingConn ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                await loadConnections();
                setShowConfigModal(false);
                setSelectedConnection(null);
            } else {
                const error = await res.json();
                alert(`Error saving connection: ${error.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('Error connecting:', error);
            alert(`Error connecting: ${error.message}`);
        } finally {
            setIsConnecting(false);
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'database': return 'text-blue-500';
            case 'cloud': return 'text-purple-500';
            case 'erp': return 'text-emerald-500';
            case 'crm': return 'text-orange-500';
            case 'analytics': return 'text-cyan-500';
            case 'productivity': return 'text-pink-500';
            case 'communication': return 'text-amber-500';
            case 'ot': return 'text-indigo-500';
            default: return 'text-[var(--text-secondary)]';
        }
    };
    
    const getCategoryBg = (category: string) => {
        switch (category) {
            case 'database': return 'bg-blue-500/10 border-blue-500/20';
            case 'cloud': return 'bg-purple-500/10 border-purple-500/20';
            case 'erp': return 'bg-emerald-500/10 border-emerald-500/20';
            case 'crm': return 'bg-orange-500/10 border-orange-500/20';
            case 'analytics': return 'bg-cyan-500/10 border-cyan-500/20';
            case 'productivity': return 'bg-pink-500/10 border-pink-500/20';
            case 'communication': return 'bg-amber-500/10 border-amber-500/20';
            case 'ot': return 'bg-indigo-500/10 border-indigo-500/20';
            default: return 'bg-[var(--bg-tertiary)] border-[var(--border-light)]';
        }
    };

    const filteredConnections = connections.filter(conn => {
        const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             conn.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || conn.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const categories = [
        { id: 'all', label: 'All', count: connections.filter(c => !c.comingSoon).length },
        { id: 'crm', label: 'CRM & Sales', count: connections.filter(c => c.category === 'crm' && !c.comingSoon).length },
        { id: 'erp', label: 'ERP', count: connections.filter(c => c.category === 'erp').length },
        { id: 'ot', label: 'OT & Industrial', count: connections.filter(c => c.category === 'ot').length },
        { id: 'database', label: 'Databases', count: connections.filter(c => c.category === 'database').length },
        { id: 'analytics', label: 'Analytics', count: connections.filter(c => c.category === 'analytics').length },
        { id: 'productivity', label: 'Productivity', count: connections.filter(c => c.category === 'productivity').length },
        { id: 'cloud', label: 'Cloud', count: connections.filter(c => c.category === 'cloud').length },
        { id: 'communication', label: 'Communication', count: connections.filter(c => c.category === 'communication').length }
    ];

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <PageHeader title="Connections" subtitle="Integrate with your data sources and business tools" />

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* Filters */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Category Pills */}
                            <div className="flex flex-wrap items-center gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategoryFilter(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            categoryFilter === cat.id
                                                ? 'bg-[#419CAF] text-white shadow-sm'
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {cat.label}
                                        <span className={`ml-1.5 ${categoryFilter === cat.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>
                                            {cat.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="flex-1 min-w-[200px] lg:max-w-xs ml-auto">
                                <div className="relative">
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} weight="light" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search connections..."
                                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#419CAF] focus:border-[#419CAF] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connections Grid */}
                    {filteredConnections.length === 0 ? (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-12 text-center">
                            <Database size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">No connections found matching your filters.</p>
                            <button 
                                onClick={() => { setCategoryFilter('all'); setSearchQuery(''); }}
                                className="mt-3 text-sm text-[#419CAF] hover:underline"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredConnections.map((connection) => {
                            const Icon = connection.icon || Database;
                            const hasLogoError = logoErrors.has(connection.id);
                            
                            return (
                                <div
                                    key={connection.id}
                                    className={`bg-[var(--bg-card)] border rounded-xl p-5 transition-all duration-200 group ${
                                        connection.comingSoon 
                                            ? 'border-[var(--border-light)] opacity-70' 
                                            : 'border-[var(--border-light)] hover:border-[#419CAF]/50 hover:shadow-lg'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${getCategoryBg(connection.category)} border flex items-center justify-center min-w-[44px] min-h-[44px] group-hover:scale-105 transition-transform`}>
                                                {connection.logoUrl && !hasLogoError ? (
                                                    <img 
                                                        src={connection.logoUrl} 
                                                        alt={`${connection.name} logo`}
                                                        className="h-6 w-auto object-contain max-w-[36px]"
                                                        onError={() => {
                                                            setLogoErrors(prev => new Set(prev).add(connection.id));
                                                        }}
                                                    />
                                                ) : (
                                                    <Icon size={22} className={getCategoryColor(connection.category)} weight="light" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-medium text-[var(--text-primary)]">
                                                        {connection.name}
                                                    </h3>
                                                    {connection.popular && !connection.comingSoon && (
                                                        <Star size={12} className="text-amber-500" weight="fill" />
                                                    )}
                                                </div>
                                                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium mt-1 ${getCategoryBg(connection.category)} ${getCategoryColor(connection.category)}`}>
                                                    {connection.type}
                                                </span>
                                            </div>
                                        </div>
                                        {connection.comingSoon ? (
                                            <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-medium">
                                                Soon
                                            </span>
                                        ) : connection.connected || connection.status === 'active' ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10">
                                                <CheckCircle size={14} className="text-emerald-500" weight="fill" />
                                                <span className="text-[10px] font-medium text-emerald-500">Active</span>
                                            </div>
                                        ) : connection.status === 'inactive' ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10">
                                                <XCircle size={14} className="text-red-500" weight="fill" />
                                                <span className="text-[10px] font-medium text-red-500">Inactive</span>
                                            </div>
                                        ) : null}
                                    </div>

                                    <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 min-h-[32px]">
                                        {connection.description}
                                    </p>

                                    {(connection.connected || connection.status === 'active') && connection.lastTestedAt && (
                                        <p className="text-[10px] text-[var(--text-tertiary)] mb-3 flex items-center gap-1">
                                            <Clock size={10} weight="light" />
                                            Last tested: {new Date(connection.lastTestedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                    {connection.lastError && (
                                        <p className="text-[10px] text-red-500 mb-3 line-clamp-2">
                                            Error: {connection.lastError}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2">
                                        {connection.comingSoon ? (
                                            <button
                                                disabled
                                                className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] rounded-lg text-xs font-medium cursor-not-allowed"
                                            >
                                                Coming Soon
                                            </button>
                                        ) : connection.connected || connection.status === 'active' ? (
                                            <>
                                                <button
                                                    onClick={() => handleTestConnection(connection.id)}
                                                    disabled={testingConnectionId !== null}
                                                    className="px-3 py-2 border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {testingConnectionId ? (
                                                        <SpinnerGap size={14} className="animate-spin" weight="light" />
                                                    ) : (
                                                        <CheckCircle size={14} weight="light" />
                                                    )}
                                                    Test
                                                </button>
                                                <button
                                                    onClick={() => handleDisconnect(connection.id)}
                                                    className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConnection(connection);
                                                        setShowConfigModal(true);
                                                    }}
                                                    className="px-3 py-2 border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                >
                                                    <GearSix size={14} weight="light" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(connection)}
                                                className="flex-1 px-3 py-2 bg-[#419CAF] hover:bg-[#3a8a9d] text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md"
                                            >
                                                <Plus size={14} weight="light" />
                                                Connect
                                                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" weight="light" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    )}
                </div>
            </div>

            {/* Connection Configuration Modal */}
            {showConfigModal && selectedConnection && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowConfigModal(false)}>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl p-6 w-[500px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                    Connect to {selectedConnection.name}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    Configure your connection settings
                                </p>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
                            </button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target as HTMLFormElement);
                            const config: any = {};
                            formData.forEach((value, key) => {
                                config[key] = value;
                            });
                            handleSaveConnection(config);
                        }} className="space-y-4">
                            {/* SAP Configuration */}
                            {selectedConnection.id === 'sap' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Server URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="serverUrl"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="https://your-sap-server.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Client ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="clientId"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            System Number
                                        </label>
                                        <input
                                            type="text"
                                            name="systemNumber"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="00"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Oracle Configuration */}
                            {selectedConnection.id === 'oracle' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Host <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="host"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            name="port"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="1521"
                                            defaultValue="1521"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Service Name / SID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="serviceName"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                </>
                            )}

                            {/* PostgreSQL Configuration */}
                            {selectedConnection.id === 'postgresql' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Host <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="host"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            name="port"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="5432"
                                            defaultValue="5432"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Database <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="database"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="database_name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            SSL Mode
                                        </label>
                                        <select
                                            name="sslMode"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer"
                                            defaultValue="prefer"
                                        >
                                            <option value="disable">Disable</option>
                                            <option value="allow">Allow</option>
                                            <option value="prefer">Prefer</option>
                                            <option value="require">Require</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* MongoDB Configuration */}
                            {selectedConnection.id === 'mongodb' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Connection String <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="connectionString"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="mongodb://username:password@host:port/database"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Enter your MongoDB connection string. Example: mongodb://user:pass@localhost:27017/mydb
                                    </p>
                                </>
                            )}

                            {/* Snowflake Configuration */}
                            {selectedConnection.id === 'snowflake' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Account Identifier <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="account"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="xy12345"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Warehouse
                                        </label>
                                        <input
                                            type="text"
                                            name="warehouse"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Database
                                        </label>
                                        <input
                                            type="text"
                                            name="database"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Schema
                                        </label>
                                        <input
                                            type="text"
                                            name="schema"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                </>
                            )}

                            {/* AWS S3 Configuration */}
                            {selectedConnection.id === 'aws-s3' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Access Key ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="accessKeyId"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Secret Access Key <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="secretAccessKey"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Region <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="region"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="us-east-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Bucket Name
                                        </label>
                                        <input
                                            type="text"
                                            name="bucket"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Azure Configuration */}
                            {selectedConnection.id === 'azure' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Connection String <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            name="connectionString"
                                            required
                                            rows={3}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none"
                                            placeholder="DefaultEndpointsProtocol=https;AccountName=..."
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Enter your Azure Storage connection string from the Azure Portal.
                                    </p>
                                </>
                            )}

                            {/* Slack Configuration */}
                            {selectedConnection.id === 'slack' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Bot Token <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="botToken"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="xoxb-..."
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Create a Slack app at api.slack.com/apps and install it to your workspace. Copy the Bot User OAuth Token (starts with xoxb-) from OAuth & Permissions.
                                    </p>
                                </>
                            )}

                            {/* OPC UA Configuration */}
                            {selectedConnection.id === 'opcua' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Server URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="serverUrl"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="opc.tcp://server:4840"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Security Policy
                                        </label>
                                        <select
                                            name="securityPolicy"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                            defaultValue="None"
                                        >
                                            <option value="None">None</option>
                                            <option value="Basic128Rsa15">Basic128Rsa15</option>
                                            <option value="Basic256">Basic256</option>
                                            <option value="Basic256Sha256">Basic256Sha256</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password (Optional)
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        OPC UA is the modern standard for industrial communication. Connect to PLCs, sensors, and SCADA systems.
                                    </p>
                                </>
                            )}

                            {/* MQTT Configuration */}
                            {selectedConnection.id === 'mqtt' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Broker URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="brokerUrl"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="mqtt://broker.example.com:1883"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            name="port"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-light)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="1883"
                                            defaultValue="1883"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password (Optional)
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        MQTT is lightweight messaging protocol ideal for IoT sensors and devices.
                                    </p>
                                </>
                            )}

                            {/* Modbus Configuration */}
                            {selectedConnection.id === 'modbus' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Protocol <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="protocol"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                            defaultValue="TCP"
                                        >
                                            <option value="TCP">Modbus TCP</option>
                                            <option value="RTU">Modbus RTU</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Host / Serial Port <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="host"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="192.168.1.100 or COM1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Port / Baud Rate
                                        </label>
                                        <input
                                            type="text"
                                            name="port"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="502 (TCP) or 9600 (RTU)"
                                            defaultValue="502"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Unit ID / Slave ID
                                        </label>
                                        <input
                                            type="number"
                                            name="unitId"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="1"
                                            defaultValue="1"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Modbus is widely used for connecting to PLCs and industrial devices.
                                    </p>
                                </>
                            )}

                            {/* SCADA Configuration */}
                            {selectedConnection.id === 'scada' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Connection Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="connectionType"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                            defaultValue="opcua"
                                        >
                                            <option value="opcua">OPC UA</option>
                                            <option value="modbus">Modbus</option>
                                            <option value="api">REST API</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Server Endpoint <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="endpoint"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="opc.tcp://scada-server:4840 or http://scada-server/api"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password (Optional)
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        SCADA systems provide real-time monitoring and control of industrial processes.
                                    </p>
                                </>
                            )}

                            {/* MES Configuration */}
                            {selectedConnection.id === 'mes' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            API Endpoint <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="apiEndpoint"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="https://mes-server.com/api"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            API Key / Token <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="apiKey"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            MES System Type
                                        </label>
                                        <select
                                            name="mesType"
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="generic">Generic MES</option>
                                            <option value="siemens">Siemens SIMATIC IT</option>
                                            <option value="rockwell">Rockwell FactoryTalk</option>
                                            <option value="ge">GE Proficy</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        MES systems track production orders, work-in-process, and manufacturing operations.
                                    </p>
                                </>
                            )}

                            {/* Data Historian Configuration */}
                            {selectedConnection.id === 'data-historian' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Historian Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="historianType"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                                        >
                                            <option value="pi">OSIsoft PI System</option>
                                            <option value="wonderware">Wonderware Historian</option>
                                            <option value="influxdb">InfluxDB</option>
                                            <option value="timescaledb">TimescaleDB</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Server URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="serverUrl"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                            placeholder="https://pi-server.com or opc.tcp://historian:4840"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Data Historians store high-frequency time-series data from industrial processes.
                                    </p>
                                </>
                            )}

                            <div className="flex gap-2 justify-end pt-4 border-t border-[var(--border-light)]">
                                <button
                                    type="button"
                                    onClick={() => setShowConfigModal(false)}
                                    className="px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isConnecting}
                                    className="px-4 py-2 bg-[var(--bg-selected)] text-white rounded-lg text-sm font-medium hover:bg-[#555555] transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isConnecting && <SpinnerGap size={16} className="animate-spin" weight="light" />}
                                    Connect
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
