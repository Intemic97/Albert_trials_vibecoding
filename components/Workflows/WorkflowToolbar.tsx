import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Play, 
  FloppyDisk, 
  Share, 
  Tag, 
  ClockCounterClockwise, 
  DotsThreeVertical,
  Check,
  X,
  SpinnerGap
} from '@phosphor-icons/react';

interface WorkflowToolbarProps {
  workflowName: string;
  isEditing: boolean;
  isSaving: boolean;
  isRunning: boolean;
  hasUnsavedChanges: boolean;
  tags?: string[];
  
  // Handlers
  onBack: () => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onRun: () => void;
  onExport: () => void;
  onOpenHistory?: () => void;
  onOpenTags?: () => void;
  onTogglePublicAccess?: () => void;
  
  // State
  isPublic?: boolean;
}

/**
 * Workflow editor toolbar
 */
export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  workflowName,
  isEditing,
  isSaving,
  isRunning,
  hasUnsavedChanges,
  tags = [],
  onBack,
  onNameChange,
  onSave,
  onRun,
  onExport,
  onOpenHistory,
  onOpenTags,
  onTogglePublicAccess,
  isPublic = false,
}) => {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowName);

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      onNameChange(tempName.trim());
    } else {
      setTempName(workflowName);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(workflowName);
      setEditingName(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border-b border-[var(--border-light)] px-6 py-2 flex items-center justify-between shadow-sm z-20 shrink-0">
      {/* Left side - Back button and name */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors text-sm active:scale-95"
        >
          <ArrowLeft size={14} weight="light" />
          <span className="font-medium">{t('workflows.backToList')}</span>
        </button>

        <div className="w-px h-5 bg-[var(--border-light)]" />

        {/* Workflow name */}
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              autoFocus
              className="px-2 py-1 text-lg font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-medium)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              style={{ fontFamily: "'Berkeley Mono', monospace" }}
            />
            <button
              onClick={handleNameSubmit}
              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <Check size={16} weight="light" />
            </button>
            <button
              onClick={() => {
                setTempName(workflowName);
                setEditingName(false);
              }}
              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <X size={16} weight="light" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-lg font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] px-2 py-1 rounded-md transition-colors truncate max-w-[300px]"
            style={{ fontFamily: "'Berkeley Mono', monospace" }}
            title={t('workflows.clickToRename')}
          >
            {workflowName}
            {hasUnsavedChanges && (
              <span className="ml-2 text-amber-500">•</span>
            )}
          </button>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md border border-[var(--border-light)]"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-[var(--text-tertiary)]">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Tags button */}
        {onOpenTags && (
          <button
            onClick={onOpenTags}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            title={t('workflows.manageTags')}
          >
            <Tag size={18} weight="light" />
          </button>
        )}

        {/* History button */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            title={t('workflows.executionHistory')}
          >
            <ClockCounterClockwise size={18} weight="light" />
          </button>
        )}

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          title={t('workflows.saveWorkflow')}
        >
          {isSaving ? (
            <SpinnerGap size={18} className="animate-spin" weight="light" />
          ) : (
            <FloppyDisk size={18} weight="light" />
          )}
        </button>

        <div className="w-px h-5 bg-[var(--border-light)]" />

        {/* Run button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 active:scale-95"
        >
          {isRunning ? (
            <>
              <SpinnerGap size={16} className="animate-spin" weight="light" />
              <span>{t('workflows.running')}</span>
            </>
          ) : (
            <>
              <Play size={16} weight="light" />
              <span>{t('workflows.runWorkflow')}</span>
            </>
          )}
        </button>

        {/* Export button */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
        >
          <Share size={16} weight="light" />
          <span>{t('common.export')}</span>
        </button>
      </div>
    </div>
  );
};

export default WorkflowToolbar;
