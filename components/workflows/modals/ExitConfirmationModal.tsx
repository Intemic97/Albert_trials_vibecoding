/**
 * ExitConfirmationModal
 * Extracted from Workflows.tsx - Exit Confirmation Modal (~50 lines)
 */

import React from 'react';
import { WarningCircle as AlertCircle, FloppyDisk as Save } from '@phosphor-icons/react';

interface ExitConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onExitWithoutSaving: () => void;
  onExitWithSaving: () => void;
  isSaving: boolean;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  show, onClose, onExitWithoutSaving, onExitWithSaving, isSaving
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
              <AlertCircle size={20} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Unsaved Changes</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Do you want to save your workflow before leaving?</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onExitWithoutSaving}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Don't Save
          </button>
          <button
            onClick={onExitWithSaving}
            disabled={isSaving}
            className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save & Exit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

