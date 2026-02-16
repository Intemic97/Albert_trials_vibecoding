import React, { useState, useEffect } from 'react';
import { 
    X, 
    ClockCounterClockwise, 
    ArrowCounterClockwise, 
    GitBranch, 
    User, 
    Calendar,
    Eye,
    ArrowsLeftRight,
    Check,
    SpinnerGap,
    CaretRight,
    CaretDown
} from '@phosphor-icons/react';
import { API_BASE } from '../config';

// ============================================================================
// TYPES
// ============================================================================

export interface Version {
    id: string;
    versionNumber: number;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    changeDescription?: string;
    data: any;
    isCurrentVersion?: boolean;
}

interface VersionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    resourceType: 'workflow' | 'entity';
    resourceId: string;
    resourceName: string;
    currentData?: any;
    onRestore?: (version: Version) => void;
}

// ============================================================================
// MOCK DATA (Replace with actual API calls)
// ============================================================================

const generateMockVersions = (resourceId: string, currentData: any): Version[] => {
    const now = new Date();
    return [
        {
            id: `${resourceId}-v5`,
            versionNumber: 5,
            createdAt: now.toISOString(),
            createdBy: 'user-1',
            createdByName: 'You',
            changeDescription: 'Current version',
            data: currentData,
            isCurrentVersion: true
        },
        {
            id: `${resourceId}-v4`,
            versionNumber: 4,
            createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
            createdBy: 'user-1',
            createdByName: 'You',
            changeDescription: 'Added new condition node',
            data: { ...currentData, modified: true }
        },
        {
            id: `${resourceId}-v3`,
            versionNumber: 3,
            createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'user-2',
            createdByName: 'Maria Garcia',
            changeDescription: 'Updated API endpoint configuration',
            data: { ...currentData, modified: true }
        },
        {
            id: `${resourceId}-v2`,
            versionNumber: 2,
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'user-1',
            createdByName: 'You',
            changeDescription: 'Initial workflow setup',
            data: { ...currentData, modified: true }
        },
        {
            id: `${resourceId}-v1`,
            versionNumber: 1,
            createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'user-1',
            createdByName: 'You',
            changeDescription: 'Created',
            data: { nodes: [], connections: [] }
        }
    ];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getChangesSummary = (version: Version, previousVersion?: Version): string[] => {
    if (!previousVersion) return ['Initial version'];
    
    const changes: string[] = [];
    
    // For workflows, compare nodes and connections
    if (version.data?.nodes && previousVersion.data?.nodes) {
        const addedNodes = (version.data.nodes?.length || 0) - (previousVersion.data.nodes?.length || 0);
        if (addedNodes > 0) changes.push(`+${addedNodes} node${addedNodes > 1 ? 's' : ''}`);
        if (addedNodes < 0) changes.push(`${addedNodes} node${Math.abs(addedNodes) > 1 ? 's' : ''}`);
        
        const addedConns = (version.data.connections?.length || 0) - (previousVersion.data.connections?.length || 0);
        if (addedConns !== 0) {
            changes.push(`${addedConns > 0 ? '+' : ''}${addedConns} connection${Math.abs(addedConns) > 1 ? 's' : ''}`);
        }
    }
    
    return changes.length > 0 ? changes : ['Configuration updated'];
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface VersionItemProps {
    version: Version;
    previousVersion?: Version;
    isSelected: boolean;
    isCompareSource: boolean;
    isCompareTarget: boolean;
    onSelect: () => void;
    onRestore: () => void;
    onCompare: () => void;
}

const VersionItem: React.FC<VersionItemProps> = ({
    version,
    previousVersion,
    isSelected,
    isCompareSource,
    isCompareTarget,
    onSelect,
    onRestore,
    onCompare
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const changes = getChangesSummary(version, previousVersion);

    return (
        <div 
            className={`relative border rounded-lg transition-all duration-200 ${
                isSelected 
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' 
                    : isCompareSource || isCompareTarget
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-[var(--border-light)] hover:border-[var(--border-medium)] bg-[var(--bg-card)]'
            }`}
        >
            {/* Version indicator line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-light)]" />
            <div className={`absolute left-3 top-6 w-2.5 h-2.5 rounded-full border-2 ${
                version.isCurrentVersion 
                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' 
                    : 'bg-[var(--bg-card)] border-[var(--border-medium)]'
            }`} />

            <div className="pl-8 pr-3 py-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                                v{version.versionNumber}
                            </span>
                            {version.isCurrentVersion && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">
                                    Current
                                </span>
                            )}
                            {(isCompareSource || isCompareTarget) && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 rounded">
                                    {isCompareSource ? 'From' : 'To'}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                            {version.changeDescription || 'No description'}
                        </p>
                    </div>
                    
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    </button>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                        <User size={12} weight="light" />
                        {version.createdByName}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} weight="light" />
                        {formatRelativeTime(version.createdAt)}
                    </span>
                </div>

                {/* Changes badges */}
                {changes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {changes.map((change, idx) => (
                            <span 
                                key={idx}
                                className={`px-1.5 py-0.5 text-[10px] rounded ${
                                    change.startsWith('+') 
                                        ? 'bg-green-500/10 text-green-600' 
                                        : change.startsWith('-')
                                            ? 'bg-red-500/10 text-red-600'
                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                }`}
                            >
                                {change}
                            </span>
                        ))}
                    </div>
                )}

                {/* Expanded actions */}
                {isExpanded && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
                        <button
                            onClick={onSelect}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                        >
                            <Eye size={14} weight="light" />
                            Preview
                        </button>
                        <button
                            onClick={onCompare}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                        >
                            <ArrowsLeftRight size={14} weight="light" />
                            Compare
                        </button>
                        {!version.isCurrentVersion && (
                            <button
                                onClick={onRestore}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-md transition-colors ml-auto"
                            >
                                <ArrowCounterClockwise size={14} weight="light" />
                                Restore
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Compare View Component
interface CompareViewProps {
    sourceVersion: Version;
    targetVersion: Version;
    onClose: () => void;
}

const CompareView: React.FC<CompareViewProps> = ({ sourceVersion, targetVersion, onClose }) => {
    return (
        <div className="absolute inset-0 bg-[var(--bg-card)] z-10 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
                <div className="flex items-center gap-2">
                    <ArrowsLeftRight size={16} className="text-[var(--accent-primary)]" weight="light" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        Comparing v{sourceVersion.versionNumber} → v{targetVersion.versionNumber}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md"
                >
                    <X size={16} weight="light" />
                </button>
            </div>

            {/* Compare content */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 gap-4">
                    {/* Source */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-600 rounded">
                                v{sourceVersion.versionNumber} (Before)
                            </span>
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {formatRelativeTime(sourceVersion.createdAt)}
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                            <pre className="text-xs text-[var(--text-secondary)] overflow-auto max-h-96">
                                {JSON.stringify(sourceVersion.data, null, 2)}
                            </pre>
                        </div>
                    </div>

                    {/* Target */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 rounded">
                                v{targetVersion.versionNumber} (After)
                            </span>
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {formatRelativeTime(targetVersion.createdAt)}
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                            <pre className="text-xs text-[var(--text-secondary)] overflow-auto max-h-96">
                                {JSON.stringify(targetVersion.data, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
                    <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2">Changes Summary</h4>
                    <div className="space-y-1">
                        {getChangesSummary(targetVersion, sourceVersion).map((change, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    change.startsWith('+') ? 'bg-green-500' : change.startsWith('-') ? 'bg-red-500' : 'bg-amber-500'
                                }`} />
                                {change}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VersionHistory: React.FC<VersionHistoryProps> = ({
    isOpen,
    onClose,
    resourceType,
    resourceId,
    resourceName,
    currentData,
    onRestore
}) => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [compareSource, setCompareSource] = useState<Version | null>(null);
    const [compareTarget, setCompareTarget] = useState<Version | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [showCompare, setShowCompare] = useState(false);

    useEffect(() => {
        if (isOpen && resourceId) {
            fetchVersions();
        }
    }, [isOpen, resourceId]);

    const fetchVersions = async () => {
        setIsLoading(true);
        try {
            // In a real implementation, this would be an API call:
            // const res = await fetch(`${API_BASE}/${resourceType}s/${resourceId}/versions`);
            // const data = await res.json();
            // setVersions(data);
            
            // For now, use mock data
            await new Promise(resolve => setTimeout(resolve, 500));
            setVersions(generateMockVersions(resourceId, currentData));
        } catch (error) {
            console.error('Failed to fetch versions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (version: Version) => {
        if (!onRestore) return;
        
        setIsRestoring(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            onRestore(version);
            onClose();
        } catch (error) {
            console.error('Failed to restore version:', error);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleCompare = (version: Version) => {
        if (!compareSource) {
            setCompareSource(version);
        } else if (compareSource.id === version.id) {
            setCompareSource(null);
        } else {
            setCompareTarget(version);
            setShowCompare(true);
        }
    };

    const closeCompare = () => {
        setShowCompare(false);
        setCompareSource(null);
        setCompareTarget(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Panel */}
            <div className="relative w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-light)] shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                            <ClockCounterClockwise size={18} className="text-[var(--accent-primary)]" weight="light" />
                        </div>
                        <div>
                            <h2 className="text-sm font-medium text-[var(--text-primary)]">Version History</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{resourceName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={18} weight="light" />
                    </button>
                </div>

                {/* Compare mode banner */}
                {compareSource && !showCompare && (
                    <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ArrowsLeftRight size={14} className="text-amber-600" />
                            <span className="text-xs text-amber-700">
                                Select another version to compare with v{compareSource.versionNumber}
                            </span>
                        </div>
                        <button
                            onClick={() => setCompareSource(null)}
                            className="text-xs text-amber-600 hover:text-amber-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 relative">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="text-center py-12">
                            <GitBranch size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">No version history available</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {versions.map((version, idx) => (
                                <VersionItem
                                    key={version.id}
                                    version={version}
                                    previousVersion={versions[idx + 1]}
                                    isSelected={selectedVersion?.id === version.id}
                                    isCompareSource={compareSource?.id === version.id}
                                    isCompareTarget={compareTarget?.id === version.id}
                                    onSelect={() => setSelectedVersion(version)}
                                    onRestore={() => handleRestore(version)}
                                    onCompare={() => handleCompare(version)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Compare overlay */}
                    {showCompare && compareSource && compareTarget && (
                        <CompareView
                            sourceVersion={compareSource}
                            targetVersion={compareTarget}
                            onClose={closeCompare}
                        />
                    )}
                </div>

                {/* Footer */}
                {isRestoring && (
                    <div className="px-5 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                        <div className="flex items-center gap-3">
                            <SpinnerGap size={16} className="animate-spin text-[var(--accent-primary)]" weight="light" />
                            <span className="text-sm text-[var(--text-secondary)]">Restoring version...</span>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// HOOK FOR EASY USAGE
// ============================================================================

export const useVersionHistory = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<{
        resourceType: 'workflow' | 'entity';
        resourceId: string;
        resourceName: string;
        currentData?: any;
    } | null>(null);

    const open = (params: typeof config) => {
        setConfig(params);
        setIsOpen(true);
    };

    const close = () => {
        setIsOpen(false);
        setConfig(null);
    };

    return { isOpen, config, open, close };
};
