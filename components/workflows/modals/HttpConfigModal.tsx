/**
 * HTTP Request Node Configuration Modal
 * Allows configuring HTTP request parameters
 */

import React from 'react';
import { Globe } from '@phosphor-icons/react';
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
      icon={Globe}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!httpUrl || !isValidUrl(httpUrl)}
            className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
            Request URL
          </label>
          <input
            type="url"
            value={httpUrl}
            onChange={(e) => onHttpUrlChange(e.target.value)}
            placeholder="https://api.example.com/data"
            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
          />
          {httpUrl && !isValidUrl(httpUrl) && (
            <p className="text-xs text-red-500 mt-1.5">
              Please enter a valid URL
            </p>
          )}
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="font-medium">Note:</span> This node will make a GET request to the specified URL
            and return the JSON response as output data.
          </p>
        </div>

        {/* URL Preview */}
        {httpUrl && isValidUrl(httpUrl) && (
          <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)]">
            <p className="text-xs text-[var(--text-tertiary)] mb-1">Preview</p>
            <code className="text-xs text-[var(--text-primary)] break-all">
              GET {httpUrl}
            </code>
          </div>
        )}
      </div>
    </NodeConfigSidePanel>
  );
};
