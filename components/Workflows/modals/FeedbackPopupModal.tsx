/**
 * FeedbackPopupModal
 * Extracted from Workflows.tsx - Node Feedback Popup (~65 lines)
 */

import React from 'react';
import { ChatCircle as MessageSquare, X } from '@phosphor-icons/react';

interface FeedbackPopupModalProps {
  feedbackPopupNodeId: string | null;
  feedbackPopupNodeLabel: string;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  isSubmittingFeedback: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const FeedbackPopupModal: React.FC<FeedbackPopupModalProps> = ({
  feedbackPopupNodeId, feedbackPopupNodeLabel, feedbackText, setFeedbackText,
  isSubmittingFeedback, onSubmit, onClose
}) => {
  if (!feedbackPopupNodeId) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 bg-black/40 backdrop-blur-sm pointer-events-none" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
              <MessageSquare size={18} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                Share Your Feedback
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Node: {feedbackPopupNodeLabel}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              What would you like this node to do?
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Describe the functionality you'd like to see, any improvements, or share your ideas..."
              rows={4}
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] resize-none placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-medium)] transition-colors"
              autoFocus
            />
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              Your feedback helps us improve the platform. Thank you!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!feedbackText.trim() || isSubmittingFeedback}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmittingFeedback ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              'Submit Feedback'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};




