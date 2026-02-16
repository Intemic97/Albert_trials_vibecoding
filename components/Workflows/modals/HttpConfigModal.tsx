/**
 * HTTP Request Node Configuration Modal
 * Allows configuring HTTP request parameters
 */

import React from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';

interface HttpConfigModalProps {
  isOpen: boolean;
  httpUrl: string;
  onHttpUrlChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const HttpConfigModal: React.FC<HttpConfigModalProps> = ({
  isOpen,
  httpUrl,
  onHttpUrlChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure HTTP Request"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!httpUrl || !isValidUrl(httpUrl)}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Request URL
          </label>
          <input
            type="url"
            value={httpUrl}
            onChange={(e) => onHttpUrlChange(e.target.value)}
            placeholder="https://api.example.com/data"
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          {httpUrl && !isValidUrl(httpUrl) && (
            <p className="text-xs text-red-400 mt-1.5">
              Please enter a valid URL
            </p>
          )}
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will make a GET request to the specified URL
            and return the JSON response as output data.
          </p>
        </div>

        {/* URL Preview */}
        {httpUrl && isValidUrl(httpUrl) && (
          <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-light)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Preview</p>
            <code className="text-sm text-[var(--accent-primary)] break-all font-mono">
              GET {httpUrl}
            </code>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
