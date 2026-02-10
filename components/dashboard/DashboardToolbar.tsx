import React, { useState } from 'react';
import { 
    Calendar, Clock, CaretDown, ArrowsClockwise, Funnel, X, 
    Play, Pause, GearSix, Share, Trash, ArrowLeft, Plus, FloppyDisk,
    FilePdf, SpinnerGap
} from '@phosphor-icons/react';

// ============================================================================
// TIME RANGE PICKER
// ============================================================================

export type TimeRange = 
    | 'last_hour'
    | 'last_24h'
    | 'last_7d'
    | 'last_30d'
    | 'last_90d'
    | 'last_year'
    | 'custom';

interface TimeRangeOption {
    id: TimeRange;
    label: string;
    shortLabel: string;
}

const TIME_RANGES: TimeRangeOption[] = [
    { id: 'last_hour', label: 'Last hour', shortLabel: '1h' },
    { id: 'last_24h', label: 'Last 24 hours', shortLabel: '24h' },
    { id: 'last_7d', label: 'Last 7 days', shortLabel: '7d' },
    { id: 'last_30d', label: 'Last 30 days', shortLabel: '30d' },
    { id: 'last_90d', label: 'Last 90 days', shortLabel: '90d' },
    { id: 'last_year', label: 'Last year', shortLabel: '1y' },
];

interface TimeRangePickerProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedRange = TIME_RANGES.find(r => r.id === value) || TIME_RANGES[2];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm hover:border-[var(--border-medium)] transition-colors"
            >
                <Clock size={14} className="text-[var(--text-tertiary)]" weight="light" />
                <span className="text-[var(--text-primary)]">{selectedRange.label}</span>
                <CaretDown size={12} className="text-[var(--text-tertiary)]" weight="light" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 right-0 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
                        {TIME_RANGES.map(range => (
                            <button
                                key={range.id}
                                onClick={() => {
                                    onChange(range.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                    value === range.id
                                        ? 'bg-[#256A65]/10 text-[#256A65]'
                                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================================================
// AUTO REFRESH
// ============================================================================

interface AutoRefreshProps {
    interval: number; // in seconds, 0 = disabled
    onChange: (interval: number) => void;
    onRefresh: () => void;
    isRefreshing?: boolean;
}

const REFRESH_INTERVALS = [
    { value: 0, label: 'Off' },
    { value: 10, label: '10s' },
    { value: 30, label: '30s' },
    { value: 60, label: '1m' },
    { value: 300, label: '5m' },
    { value: 900, label: '15m' },
];

export const AutoRefresh: React.FC<AutoRefreshProps> = ({ interval, onChange, onRefresh, isRefreshing }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedInterval = REFRESH_INTERVALS.find(i => i.value === interval) || REFRESH_INTERVALS[0];

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className={`p-1.5 rounded-lg transition-colors ${
                    isRefreshing 
                        ? 'text-[#256A65] bg-[#256A65]/10' 
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                title="Refresh now"
            >
                <ArrowsClockwise size={16} weight="light" className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                        interval > 0
                            ? 'bg-[#256A65]/10 text-[#256A65]'
                            : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                >
                    {interval > 0 ? <Play size={10} weight="fill" /> : <Pause size={10} weight="fill" />}
                    {selectedInterval.label}
                    <CaretDown size={10} weight="light" />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-full mt-1 right-0 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg z-50 py-1 min-w-[100px]">
                            {REFRESH_INTERVALS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                                        interval === opt.value
                                            ? 'bg-[#256A65]/10 text-[#256A65]'
                                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// GLOBAL FILTERS
// ============================================================================

interface FilterConfig {
    id: string;
    column: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
    value: string;
}

interface GlobalFiltersProps {
    filters: FilterConfig[];
    onFiltersChange: (filters: FilterConfig[]) => void;
    availableColumns: string[];
}

export const GlobalFilters: React.FC<GlobalFiltersProps> = ({ filters, onFiltersChange, availableColumns }) => {
    const [isOpen, setIsOpen] = useState(false);

    const addFilter = () => {
        const newFilter: FilterConfig = {
            id: Date.now().toString(),
            column: availableColumns[0] || '',
            operator: 'equals',
            value: ''
        };
        onFiltersChange([...filters, newFilter]);
    };

    const updateFilter = (id: string, updates: Partial<FilterConfig>) => {
        onFiltersChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeFilter = (id: string) => {
        onFiltersChange(filters.filter(f => f.id !== id));
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filters.length > 0
                        ? 'bg-[#256A65]/10 text-[#256A65] border border-[#256A65]/30'
                        : 'bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)] hover:border-[var(--border-medium)]'
                }`}
            >
                <Funnel size={14} weight="light" />
                Filters
                {filters.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#256A65] text-white text-xs rounded-full">
                        {filters.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg z-50 p-4 min-w-[320px]">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">Global Filters</h4>
                            <button
                                onClick={addFilter}
                                className="text-xs text-[#256A65] hover:underline"
                            >
                                + Add filter
                            </button>
                        </div>

                        {filters.length === 0 ? (
                            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
                                No filters applied
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {filters.map(filter => (
                                    <div key={filter.id} className="flex items-center gap-2">
                                        <select
                                            value={filter.column}
                                            onChange={e => updateFilter(filter.id, { column: e.target.value })}
                                            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-light)] rounded"
                                        >
                                            {availableColumns.map(col => (
                                                <option key={col} value={col}>{col}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={filter.operator}
                                            onChange={e => updateFilter(filter.id, { operator: e.target.value as any })}
                                            className="px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-light)] rounded"
                                        >
                                            <option value="equals">=</option>
                                            <option value="contains">contains</option>
                                            <option value="gt">&gt;</option>
                                            <option value="lt">&lt;</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={filter.value}
                                            onChange={e => updateFilter(filter.id, { value: e.target.value })}
                                            placeholder="Value"
                                            className="w-20 px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-light)] rounded"
                                        />
                                        <button
                                            onClick={() => removeFilter(filter.id)}
                                            className="p-1 text-[var(--text-tertiary)] hover:text-red-500"
                                        >
                                            <X size={12} weight="light" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {filters.length > 0 && (
                            <button
                                onClick={() => onFiltersChange([])}
                                className="w-full mt-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================================================
// FULL DASHBOARD TOOLBAR
// ============================================================================

interface DashboardToolbarProps {
    dashboardName: string;
    onBack: () => void;
    onShare: () => void;
    onDelete: () => void;
    onAddWidget: () => void;
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    refreshInterval: number;
    onRefreshIntervalChange: (interval: number) => void;
    onRefresh: () => void;
    isRefreshing?: boolean;
    isEditMode: boolean;
    onToggleEditMode: () => void;
    onSave: () => void;
    isSaving?: boolean;
    onExportPdf?: () => void;
    isExportingPdf?: boolean;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
    dashboardName,
    onBack,
    onShare,
    onDelete,
    onAddWidget,
    timeRange,
    onTimeRangeChange,
    refreshInterval,
    onRefreshIntervalChange,
    onRefresh,
    isRefreshing,
    isEditMode,
    onToggleEditMode,
    onSave,
    isSaving,
    onExportPdf,
    isExportingPdf
}) => {
    return (
        <header className="h-14 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-6 shrink-0">
            {/* Left side */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors text-sm"
                >
                    <ArrowLeft size={14} weight="light" />
                    <span className="font-medium">Dashboards</span>
                </button>
                
                <div className="h-4 w-px bg-[var(--border-light)]" />
                
                <h1 className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                    {dashboardName}
                </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {/* Time Range */}
                <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />

                {/* Auto Refresh */}
                <AutoRefresh
                    interval={refreshInterval}
                    onChange={onRefreshIntervalChange}
                    onRefresh={onRefresh}
                    isRefreshing={isRefreshing}
                />

                <div className="h-4 w-px bg-[var(--border-light)]" />

                {/* Add Widget - always available */}
                <button
                    onClick={onAddWidget}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#256A65] hover:bg-[#1e5a55] text-white rounded-lg text-xs font-medium transition-colors"
                >
                    <Plus size={14} weight="light" />
                    Add Widget
                </button>
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <FloppyDisk size={14} weight="light" />
                    {isSaving ? 'Saving...' : 'Save'}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    {onExportPdf && (
                        <button
                            onClick={onExportPdf}
                            disabled={isExportingPdf}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                            title="Export as PDF"
                        >
                            {isExportingPdf
                                ? <SpinnerGap size={16} weight="light" className="animate-spin" />
                                : <FilePdf size={16} weight="light" />
                            }
                        </button>
                    )}
                    <button
                        onClick={onShare}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        title="Share"
                    >
                        <Share size={16} weight="light" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash size={16} weight="light" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default DashboardToolbar;
