import React, { useState, useEffect } from 'react';
import { 
    Table, Database, SpinnerGap, ArrowsClockwise, CaretDown, CaretRight,
    Eye, EyeSlash, Rows, Columns, X, Check, WarningCircle, Info
} from '@phosphor-icons/react';
import { API_BASE } from '../../config';

// ============================================================================
// TYPES
// ============================================================================

interface DataPreviewPanelProps {
    /** Node ID to fetch data for */
    nodeId: string;
    /** Node type */
    nodeType: string;
    /** Node configuration */
    nodeConfig: any;
    /** Whether to show the panel */
    isVisible: boolean;
    /** Maximum rows to display */
    maxRows?: number;
    /** Callback when data is loaded */
    onDataLoaded?: (data: any[], columns: string[]) => void;
}

interface PreviewData {
    columns: string[];
    rows: any[];
    totalCount: number;
    truncated: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DataPreviewPanel: React.FC<DataPreviewPanelProps> = ({
    nodeId,
    nodeType,
    nodeConfig,
    isVisible,
    maxRows = 10,
    onDataLoaded
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

    // Fetch preview data when config changes
    useEffect(() => {
        if (isVisible && nodeConfig) {
            fetchPreviewData();
        }
    }, [isVisible, nodeConfig?.entityId, nodeConfig?.columns]);

    const fetchPreviewData = async () => {
        // Determine what entity to fetch based on node type
        let entityId = nodeConfig?.entityId;
        
        if (!entityId) {
            setPreviewData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/entities/${entityId}/records`, {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Failed to fetch data');
            }

            const records = await res.json();
            
            if (!Array.isArray(records) || records.length === 0) {
                setPreviewData({
                    columns: [],
                    rows: [],
                    totalCount: 0,
                    truncated: false
                });
                return;
            }

            // Get entity schema for column names
            const entityRes = await fetch(`${API_BASE}/entities/${entityId}`, {
                credentials: 'include'
            });
            
            let columns: string[] = [];
            let columnIdToName: Record<string, string> = {};
            
            if (entityRes.ok) {
                const entity = await entityRes.json();
                columns = entity.properties?.map((p: any) => p.name) || [];
                entity.properties?.forEach((p: any) => {
                    columnIdToName[p.id] = p.name;
                });
            } else {
                // Fallback: use keys from first record
                const firstRecord = records[0];
                columns = Object.keys(firstRecord.values || {});
            }

            // Transform records to row format
            const rows = records.slice(0, maxRows).map((record: any) => {
                const row: Record<string, any> = { _id: record.id };
                Object.entries(record.values || {}).forEach(([key, value]) => {
                    const colName = columnIdToName[key] || key;
                    row[colName] = value;
                });
                return row;
            });

            const preview: PreviewData = {
                columns,
                rows,
                totalCount: records.length,
                truncated: records.length > maxRows
            };

            setPreviewData(preview);
            setSelectedColumns(new Set(columns));
            
            if (onDataLoaded) {
                onDataLoaded(rows, columns);
            }
        } catch (err) {
            console.error('Error fetching preview data:', err);
            setError('Unable to load preview data');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleColumn = (column: string) => {
        const newSelected = new Set(selectedColumns);
        if (newSelected.has(column)) {
            newSelected.delete(column);
        } else {
            newSelected.add(column);
        }
        setSelectedColumns(newSelected);
    };

    if (!isVisible) return null;

    const visibleColumns = previewData?.columns.filter(c => selectedColumns.has(c)) || [];

    return (
        <div className="border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-[var(--bg-tertiary)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
                    <Eye size={14} className="text-[var(--accent-primary)]" weight="light" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">Data Preview</span>
                    {previewData && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                            ({previewData.totalCount} records)
                        </span>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        fetchPreviewData();
                    }}
                    disabled={isLoading}
                    className="p-1 hover:bg-[var(--bg-card)] rounded transition-colors"
                    title="Refresh preview"
                >
                    <ArrowsClockwise 
                        size={12} 
                        className={`text-[var(--text-tertiary)] ${isLoading ? 'animate-spin' : ''}`} 
                        weight="light" 
                    />
                </button>
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="px-4 pb-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <SpinnerGap size={20} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-amber-600">
                            <WarningCircle size={14} weight="light" />
                            {error}
                        </div>
                    ) : !previewData || previewData.rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Database size={24} className="text-[var(--text-tertiary)] mb-2" weight="light" />
                            <p className="text-xs text-[var(--text-secondary)]">No data available</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Configure the node to see data preview</p>
                        </div>
                    ) : (
                        <>
                            {/* Column Selector */}
                            {previewData.columns.length > 3 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Columns size={12} className="text-[var(--text-tertiary)]" weight="light" />
                                        <span className="text-xs text-[var(--text-secondary)]">Columns</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {previewData.columns.map(col => (
                                            <button
                                                key={col}
                                                onClick={() => toggleColumn(col)}
                                                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                                    selectedColumns.has(col)
                                                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                                                        : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-light)]'
                                                }`}
                                            >
                                                {col}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Data Table */}
                            <div className="overflow-x-auto rounded-lg border border-[var(--border-light)]">
                                <table className="w-full text-xs">
                                    <thead className="bg-[var(--bg-tertiary)]">
                                        <tr>
                                            {visibleColumns.map(col => (
                                                <th 
                                                    key={col}
                                                    className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap"
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-light)]">
                                        {previewData.rows.map((row, idx) => (
                                            <tr key={row._id || idx} className="hover:bg-[var(--bg-tertiary)]/50">
                                                {visibleColumns.map(col => (
                                                    <td 
                                                        key={col}
                                                        className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap max-w-[150px] truncate"
                                                        title={String(row[col] ?? '')}
                                                    >
                                                        {row[col] !== null && row[col] !== undefined 
                                                            ? typeof row[col] === 'object'
                                                                ? JSON.stringify(row[col]).slice(0, 30)
                                                                : String(row[col]).slice(0, 50)
                                                            : <span className="text-[var(--text-tertiary)]">—</span>
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer info */}
                            {previewData.truncated && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-tertiary)]">
                                    <Info size={12} weight="light" />
                                    Showing {previewData.rows.length} of {previewData.totalCount} records
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// INLINE PREVIEW (for node cards)
// ============================================================================

interface InlineDataPreviewProps {
    entityId?: string;
    maxItems?: number;
}

export const InlineDataPreview: React.FC<InlineDataPreviewProps> = ({ 
    entityId, 
    maxItems = 3 
}) => {
    const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);

    useEffect(() => {
        if (entityId) {
            fetchPreview();
        }
    }, [entityId]);

    const fetchPreview = async () => {
        try {
            const res = await fetch(`${API_BASE}/entities/${entityId}/records`, {
                credentials: 'include'
            });
            if (res.ok) {
                const records = await res.json();
                if (Array.isArray(records)) {
                    // Get first text value from each record as sample
                    const samples = records.slice(0, maxItems).map((r: any) => {
                        const values = Object.values(r.values || {});
                        const textVal = values.find(v => typeof v === 'string') as string;
                        return textVal?.slice(0, 20) || 'Record';
                    });
                    setPreview({ count: records.length, sample: samples });
                }
            }
        } catch (error) {
            console.error('Error fetching inline preview:', error);
        }
    };

    if (!preview) return null;

    return (
        <div className="mt-1 space-y-0.5">
            {preview.sample.map((item, idx) => (
                <div key={idx} className="text-[10px] text-[var(--text-tertiary)] truncate">
                    • {item}
                </div>
            ))}
            {preview.count > maxItems && (
                <div className="text-[10px] text-[var(--text-tertiary)]">
                    +{preview.count - maxItems} more
                </div>
            )}
        </div>
    );
};

export default DataPreviewPanel;
