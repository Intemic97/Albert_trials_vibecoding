/**
 * Workflows List View
 * Grid view of saved workflows with search, filtering, and pagination
 */

import React from 'react';
import { 
    MagnifyingGlass, 
    Tag, 
    X,
    BookOpen,
    FlowArrow,
    Trash,
    User,
    Calendar,
    Clock,
    CaretRight
} from '@phosphor-icons/react';
import { PageHeader } from '../../PageHeader';
import { Pagination } from '../../Pagination';
import { ExecutionStatusIndicator, ExecutionProgressBar } from '../ExecutionStatusIndicator';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowListItem {
    id: string;
    name: string;
    tags?: string[];
    createdAt?: string;
    createdByName?: string;
    updatedAt?: string;
    lastEditedByName?: string;
}

interface WorkflowsListViewProps {
    workflows: WorkflowListItem[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedTagFilter: string | null;
    onTagFilterChange: (tag: string | null) => void;
    allTags: string[];
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onOpenWorkflow: (id: string) => void;
    onDeleteWorkflow: (id: string) => void;
    onCreateNew: () => void;
    onOpenTemplates: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkflowsListView: React.FC<WorkflowsListViewProps> = ({
    workflows,
    searchQuery,
    onSearchChange,
    selectedTagFilter,
    onTagFilterChange,
    allTags,
    currentPage,
    itemsPerPage,
    onPageChange,
    onOpenWorkflow,
    onDeleteWorkflow,
    onCreateNew,
    onOpenTemplates
}) => {
    // Filter workflows
    const filteredWorkflows = workflows.filter(wf => {
        const matchesSearch = wf.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !selectedTagFilter || (wf.tags && Array.isArray(wf.tags) && wf.tags.includes(selectedTagFilter));
        return matchesSearch && matchesTag;
    });

    // Pagination
    const totalPages = Math.ceil(filteredWorkflows.length / itemsPerPage);
    const paginatedWorkflows = filteredWorkflows.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <>
            {/* Top Header */}
            <PageHeader title="Workflows" subtitle="Manage and execute your automation workflows" />

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                            <input
                                type="text"
                                placeholder="Search workflows..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] w-60 placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        {/* Tag Filter */}
                        {allTags.length > 0 && (
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                                <select
                                    value={selectedTagFilter || ''}
                                    onChange={(e) => onTagFilterChange(e.target.value || null)}
                                    className="pl-8 pr-8 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] appearance-none cursor-pointer"
                                >
                                    <option value="">All Tags</option>
                                    {allTags.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                                {selectedTagFilter && (
                                    <button
                                        onClick={() => onTagFilterChange(null)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                    >
                                        <X size={12} weight="light" />
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-sm text-[var(--text-secondary)]">
                            {filteredWorkflows.length} {filteredWorkflows.length === 1 ? 'workflow' : 'workflows'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onOpenTemplates}
                            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            <BookOpen size={14} className="mr-2" weight="light" />
                            Open Templates
                        </button>
                        <button
                            onClick={onCreateNew}
                            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                        >
                            <FlowArrow size={14} className="mr-2" weight="light" />
                            Create Workflow
                        </button>
                    </div>
                </div>

                {/* Workflows Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                    {paginatedWorkflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            onClick={() => onOpenWorkflow(workflow.id)}
                            className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] transition-all duration-300 ease-out hover:shadow-md hover:border-[var(--border-medium)] hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="p-2.5 bg-[var(--bg-tertiary)] rounded-lg flex-shrink-0 group-hover:bg-[var(--bg-hover)] transition-colors">
                                            <FlowArrow size={18} className="text-[var(--text-secondary)]" weight="light" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-normal text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                                                {workflow.name}
                                            </h3>
                                            {/* Tags */}
                                            {workflow.tags && workflow.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {workflow.tags.map((tag: string, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)]"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteWorkflow(workflow.id);
                                        }}
                                        className="text-[var(--text-tertiary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <Trash size={16} weight="light" />
                                    </button>
                                </div>

                                <div className="space-y-2 mt-5">
                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <User size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                        <span className="text-[var(--text-secondary)]">{workflow.createdByName || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <Calendar size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                        <span className="text-[var(--text-secondary)]">
                                            {workflow.createdAt 
                                                ? new Date(workflow.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
                                                : 'Unknown'}
                                        </span>
                                    </div>
                                    {workflow.updatedAt && (
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                            <Clock size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                                            <span className="text-[var(--text-secondary)]">
                                                Edited {new Date(workflow.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                {workflow.lastEditedByName && (
                                                    <span className="text-[var(--text-tertiary)]"> by {workflow.lastEditedByName}</span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Execution Progress Bar */}
                            <ExecutionProgressBar workflowId={workflow.id} />

                            <div className="flex items-center justify-between mt-5">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                    <CaretRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" weight="light" />
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[var(--text-secondary)]">Open workflow</span>
                                </div>
                                {/* Execution Status Indicator */}
                                <ExecutionStatusIndicator workflowId={workflow.id} size="sm" showLabel />
                            </div>
                        </div>
                    ))}

                    {/* Create New Card */}
                    <div
                        data-tutorial="create-workflow"
                        onClick={onCreateNew}
                        className="border border-dashed border-[var(--border-medium)] rounded-lg flex flex-col items-center justify-center min-h-[200px] text-[var(--text-tertiary)] cursor-pointer group hover:border-[#256A65] hover:text-[#256A65] transition-colors"
                    >
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-full mb-3 group-hover:bg-[#256A65]/10 transition-colors">
                            <FlowArrow size={24} weight="light" />
                        </div>
                        <span className="font-medium">Create new workflow</span>
                    </div>

                    {filteredWorkflows.length === 0 && searchQuery !== '' && (
                        <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
                            No workflows found matching "{searchQuery}"
                        </div>
                    )}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-6">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                            itemsPerPage={itemsPerPage}
                            totalItems={filteredWorkflows.length}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default WorkflowsListView;
