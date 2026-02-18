/**
 * PublishWorkflowModal
 * Modal for publishing a new version of a workflow, OpenAI-style.
 * Shows: Draft → New version flow, version name input, deploy-to-production checkbox.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowDown,
  Rocket,
  CheckCircle,
  SpinnerGap,
  Info,
} from '@phosphor-icons/react';

interface PublishWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowName: string;
  currentVersion: number | null; // Latest version number, null if no versions yet
  onPublish: (versionName: string, deployToProduction: boolean) => Promise<void>;
}

export const PublishWorkflowModal: React.FC<PublishWorkflowModalProps> = ({
  isOpen,
  onClose,
  workflowName,
  currentVersion,
  onPublish,
}) => {
  const nextVersion = (currentVersion || 0) + 1;
  const [versionName, setVersionName] = useState(`v${nextVersion}`);
  const [deployToProduction, setDeployToProduction] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const next = (currentVersion || 0) + 1;
      setVersionName(`v${next}`);
      setDeployToProduction(true);
      setIsPublishing(false);
    }
  }, [isOpen, currentVersion]);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish(versionName, deployToProduction);
      onClose();
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 transition-opacity" />

      {/* Modal */}
      <div
        className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-[440px] max-w-[90vw] overflow-hidden"
        style={{ animation: 'fadeInScale 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors z-10"
        >
          <X size={18} className="text-[var(--text-tertiary)]" />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* Title */}
          <h2 className="text-lg font-semibold text-[var(--text-primary)] text-center mb-1">
            Publish changes?
          </h2>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
            Create a new version of the workflow with your latest changes.
          </p>

          {/* Flow visualization: Draft → New version */}
          <div className="flex flex-col items-center gap-3 mb-8">
            {/* Draft box */}
            <div className="w-full py-3 px-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Draft</span>
            </div>

            {/* Arrow */}
            <ArrowDown size={20} className="text-[var(--text-tertiary)]" weight="bold" />

            {/* New version box with editable name */}
            <div className="w-full py-3 px-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="text-sm font-medium text-[var(--text-primary)] bg-transparent border-none text-center focus:outline-none w-full"
                placeholder="Version name"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar with checkbox + publish button */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className="relative">
              <input
                type="checkbox"
                checked={deployToProduction}
                onChange={(e) => setDeployToProduction(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  deployToProduction
                    ? 'bg-[var(--text-primary)] border-[var(--text-primary)]'
                    : 'border-[var(--border-medium)] bg-transparent group-hover:border-[var(--text-secondary)]'
                }`}
              >
                {deployToProduction && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-[var(--text-primary)] font-medium">Deploy to production</span>
            <div className="relative group/tooltip">
              <Info size={14} className="text-[var(--text-tertiary)] cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity shadow-lg">
                When deployed, scheduled and webhook triggers use this version
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1"></div>
              </div>
            </div>
          </label>

          <button
            onClick={handlePublish}
            disabled={isPublishing || !versionName.trim()}
            className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-card)] rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <SpinnerGap size={16} className="animate-spin" />
                Publishing...
              </>
            ) : (
              'Publish'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PublishWorkflowModal;

