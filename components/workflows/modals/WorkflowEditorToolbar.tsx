/**
 * WorkflowEditorToolbar
 * Extracted from Workflows.tsx - Canvas top bar with back, name, tags, save, history, run, export
 */

import React from 'react';
import { ArrowLeft, Tag, CheckCircle, FloppyDisk as Save, ClockCounterClockwise as History, Play, Share as Share2 } from '@phosphor-icons/react';

interface WorkflowEditorToolbarProps {
  workflowName: string;
  setWorkflowName: (name: string) => void;
  currentWorkflowId: string | null;
  autoSaveStatus: string | null;
  isSaving: boolean;
  isRunning: boolean;
  nodesCount: number;
  backToList: () => void;
  saveWorkflow: () => void;
  openExecutionHistory: () => void;
  runWorkflow: () => void;
  openWorkflowRunner: () => void;
  setShowTagsModal: (show: boolean) => void;
}

export const WorkflowEditorToolbar: React.FC<WorkflowEditorToolbarProps> = ({
  workflowName, setWorkflowName, currentWorkflowId, autoSaveStatus,
  isSaving, isRunning, nodesCount, backToList, saveWorkflow,
  openExecutionHistory, runWorkflow, openWorkflowRunner, setShowTagsModal
}) => {
  return (
    <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6 py-2 flex items-center justify-between shadow-sm z-20 shrink-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={backToList}
          className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-sm font-medium text-[var(--text-secondary)] flex-shrink-0"
        >
          <ArrowLeft size={18} weight="light" />
          Back
        </button>
        <div className="h-6 w-px bg-[var(--border-medium)] flex-shrink-0"></div>
        <input
          type="text"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="text-lg font-normal text-[var(--text-primary)] bg-transparent border-none focus:outline-none flex-1 min-w-0"
          placeholder="Workflow Name"
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setShowTagsModal(true)}
          disabled={!currentWorkflowId}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          title="Manage Tags"
        >
          <Tag size={18} className="text-[var(--text-secondary)]" weight="light" />
        </button>
        {/* Auto-save indicator */}
        {autoSaveStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
            {autoSaveStatus === 'saving' ? (
              <>
                <span className="animate-spin">⟳</span>
                <span className="text-[var(--text-secondary)]">Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} className="text-emerald-600" weight="light" />
                <span className="text-emerald-600">Saved</span>
              </>
            )}
          </div>
        )}
        <button
          onClick={saveWorkflow}
          disabled={isSaving}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          title="Save (Ctrl+S)"
        >
          {isSaving ? <span className="animate-spin">⟳</span> : <Save size={18} className="text-[var(--text-secondary)]" weight="light" />}
        </button>
        <button
          onClick={openExecutionHistory}
          disabled={!currentWorkflowId}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          title="History"
        >
          <History size={18} className="text-[var(--text-secondary)]" weight="light" />
        </button>
        <button
          onClick={runWorkflow}
          disabled={isRunning || nodesCount === 0}
          className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
        >
          <Play size={16} weight="light" />
          {isRunning ? 'Running...' : 'Run'}
        </button>
        <button
          onClick={openWorkflowRunner}
          disabled={nodesCount === 0}
          className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
        >
          <Share2 size={16} weight="light" />
          Export
        </button>
      </div>
    </div>
  );
};

