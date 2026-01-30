import React, { useState, useEffect } from 'react';
import { 
    Database, 
    CheckCircle, 
    XCircle, 
    Plus, 
    GearSix,
    SpinnerGap,
    MagnifyingGlass,
    X
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
    category: 'database' | 'cloud' | 'erp' | 'communication';
    connected: boolean;
    lastSync?: string;
    config?: {
        host?: string;
        database?: string;
        username?: string;
    };
}

const CONNECTIONS: Connection[] = [
    {
        id: 'sap',
        name: 'SAP',
        type: 'ERP',
        logoUrl: 'https://cdn.simpleicons.org/sap',
        description: 'Connect to SAP systems for enterprise data integration',
        category: 'erp',
        connected: false
    },
    {
        id: 'oracle',
        name: 'Oracle',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/oracle',
        description: 'Connect to Oracle Database for data access and synchronization',
        category: 'database',
        connected: false
    },
    {
        id: 'postgresql',
        name: 'PostgreSQL',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/postgresql',
        description: 'Connect to PostgreSQL database for real-time data queries',
        category: 'database',
        connected: false
    },
    {
        id: 'mongodb',
        name: 'MongoDB',
        type: 'Database',
        logoUrl: 'https://cdn.simpleicons.org/mongodb',
        description: 'Connect to MongoDB for document-based data access',
        category: 'database',
        connected: false
    },
    {
        id: 'snowflake',
        name: 'Snowflake',
        type: 'Data Warehouse',
        logoUrl: 'https://cdn.simpleicons.org/snowflake',
        description: 'Connect to Snowflake data warehouse for analytics',
        category: 'cloud',
        connected: false
    },
    {
        id: 'aws-s3',
        name: 'AWS S3',
        type: 'Cloud Storage',
        logoUrl: 'https://cdn.simpleicons.org/amazonaws',
        description: 'Connect to Amazon S3 for file storage and data access',
        category: 'cloud',
        connected: false
    },
    {
        id: 'azure',
        name: 'Azure',
        type: 'Cloud Platform',
        logoUrl: 'https://cdn.simpleicons.org/microsoftazure',
        description: 'Connect to Microsoft Azure services and data sources',
        category: 'cloud',
        connected: false
    },
    {
        id: 'slack',
        name: 'Slack',
        type: 'Communication',
        logoUrl: 'https://cdn.simpleicons.org/slack',
        description: 'Connect to Slack for notifications and workflow integration',
        category: 'communication',
        connected: false
    }
];

export const Connections: React.FC = () => {
    const [connections, setConnections] = useState<Connection[]>(CONNECTIONS);
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const res = await fetch(`${API_BASE}/connections`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                // Update connections with server data
                setConnections(prev => prev.map(conn => {
                    const serverConn = data.connections?.find((c: any) => c.id === conn.id);
                    return serverConn ? { ...conn, ...serverConn } : conn;
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
            const res = await fetch(`${API_BASE}/connections/${connectionId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setConnections(prev => prev.map(conn => 
                    conn.id === connectionId ? { ...conn, connected: false } : conn
                ));
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    };

    const handleSaveConnection = async (config: any) => {
        if (!selectedConnection) return;
        
        setIsConnecting(true);
        try {
            const res = await fetch(`${API_BASE}/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    connectionId: selectedConnection.id,
                    ...config
                })
            });
            if (res.ok) {
                setConnections(prev => prev.map(conn => 
                    conn.id === selectedConnection.id 
                        ? { ...conn, connected: true, config } 
                        : conn
                ));
                setShowConfigModal(false);
                setSelectedConnection(null);
            }
        } catch (error) {
            console.error('Error connecting:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'database': return 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-blue-500';
            case 'cloud': return 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-purple-500';
            case 'erp': return 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-emerald-500';
            case 'communication': return 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-amber-500';
            default: return 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-[var(--text-secondary)]';
        }
    };

    const filteredConnections = connections.filter(conn => {
        const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             conn.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || conn.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const categories = [
        { id: 'all', label: 'All' },
        { id: 'database', label: 'Databases' },
        { id: 'cloud', label: 'Cloud' },
        { id: 'erp', label: 'ERP' },
        { id: 'communication', label: 'Communication' }
    ];

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <PageHeader title="Connections" subtitle="Manage your data source integrations" />

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Filters */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Category Filter */}
                            <div className="flex items-center gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategoryFilter(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            categoryFilter === cat.id
                                                ? 'bg-[var(--bg-selected)] text-white'
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} weight="light" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search connections..."
                                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connections Grid */}
                    {filteredConnections.length === 0 ? (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-12 text-center">
                            <p className="text-sm text-[var(--text-secondary)]">No connections found matching your filters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredConnections.map((connection) => {
                            const Icon = connection.icon || Database;
                            const hasLogoError = logoErrors.has(connection.id);
                            
                            return (
                                <div
                                    key={connection.id}
                                    className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-lg ${getCategoryColor(connection.category)} flex items-center justify-center min-w-[40px] min-h-[40px] bg-[var(--bg-card)]`}>
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
                                                    <Icon size={20} weight="light" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                                    {connection.name}
                                                </h3>
                                                <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-medium mt-1 ${getCategoryColor(connection.category)}`}>
                                                    {connection.type}
                                                </span>
                                            </div>
                                        </div>
                                        {connection.connected ? (
                                            <div className="flex items-center gap-1 text-emerald-500">
                                                <CheckCircle size={16} weight="fill" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                                                <XCircle size={16} weight="light" />
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2">
                                        {connection.description}
                                    </p>

                                    {connection.connected && connection.lastSync && (
                                        <p className="text-xs text-[var(--text-tertiary)] mb-4">
                                            Last sync: {new Date(connection.lastSync).toLocaleDateString()}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2">
                                        {connection.connected ? (
                                            <>
                                                <button
                                                    onClick={() => handleDisconnect(connection.id)}
                                                    className="flex-1 px-2.5 py-1.5 border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConnection(connection);
                                                        setShowConfigModal(true);
                                                    }}
                                                    className="px-2 py-1.5 border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                >
                                                    <GearSix size={14} weight="light" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(connection)}
                                                className="flex-1 px-2.5 py-1.5 bg-[var(--bg-selected)] text-white rounded-lg text-xs font-medium hover:bg-[#555555] transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Plus size={12} weight="light" />
                                                Connect
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
