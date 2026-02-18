/**
 * VersionHistoryPanel
 * Side panel showing workflow version history with publish/restore capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ClockCounterClockwise as History,
  ArrowCounterClockwise as Restore,
  Rocket as Publish,
  Eye,
  CheckCircle,
  User,
  Warning,
  SpinnerGap,
  Circle,
} from '@phosphor-icons/react';
import { API_BASE } from '../../../config';

interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  name: string;
  description: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  isProduction: number;
}

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowName: string;
  onRestore: (data: { nodes: any[]; connections: any[] }, version: number) => void;
  publishedVersionId: string | null;
  onPublishedVersionChange: (versionId: string | null) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  onRestore,
  publishedVersionId,
  onPublishedVersionChange,
}) => {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen && workflowId) {
      fetchVersions();
      setSelectedVersion(null);
      setPreviewData(null);
      setConfirmRestore(null);
    }
  }, [isOpen, workflowId, fetchVersions]);

  const handlePreview = async (version: WorkflowVersion) => {
    setSelectedVersion(version);
    setLoadingPreview(true);
    try {
      const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${version.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data.data);
      }
    } catch (error) {
      console.error('Failed to load version preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePublish = async (version: WorkflowVersion) => {
    setActionLoading(version.id);
    try {
      const res = await fetch(
        `${API_BASE}/workflows/${workflowId}/versions/${version.id}/publish`,
        { method: 'PUT', credentials: 'include' }
      );
      if (res.ok) {
        onPublishedVersionChange(version.id);
        await fetchVersions();
      }
    } catch (error) {
      console.error('Failed to publish version:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (version: WorkflowVersion) => {
    setActionLoading(version.id);
    try {
      const res = await fetch(
        `${API_BASE}/workflows/${workflowId}/versions/${version.id}/unpublish`,
        { method: 'PUT', credentials: 'include' }
      );
      if (res.ok) {
        onPublishedVersionChange(null);
        await fetchVersions();
      }
    } catch (error) {
      console.error('Failed to unpublish version:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (version: WorkflowVersion) => {
    setActionLoading(version.id);
    try {
      const res = await fetch(
        `${API_BASE}/workflows/${workflowId}/versions/${version.id}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      if (res.ok) {
        const result = await res.json();
        onRestore(result.data, version.version);
        setConfirmRestore(null);
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  const panel = (
    <div className="fixed inset-0 z-[9999] flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 transition-opacity" />

      {/* Panel */}
      <div
        className="relative w-[420px] h-full bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border-light)] flex flex-col"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30">
              <History size={20} className="text-teal-600" weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Version History</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <SpinnerGap size={24} className="text-teal-500 animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <History size={40} className="text-[var(--text-tertiary)] mb-3" weight="light" />
              <p className="text-sm text-[var(--text-secondary)] font-medium">No versions yet</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Versions are created when you publish.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {versions.map((version) => {
                const isProduction = version.isProduction === 1;
                const isSelected = selectedVersion?.id === version.id;
                const isConfirmingRestore = confirmRestore === version.id;

                return (
                  <div
                    key={version.id}
                    className={`px-5 py-3.5 transition-colors cursor-pointer hover:bg-[var(--bg-hover)] ${
                      isSelected ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                    }`}
                    onClick={() => handlePreview(version)}
                  >
                    {/* Top row: version label + badges */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          v{version.version}
                        </span>
                        {version.name && version.name !== `v${version.version}` && (
                          <span className="text-xs text-[var(--text-secondary)]">
                            {version.name}
                          </span>
                        )}
                        {isProduction && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-0.5">
                            <Circle size={6} weight="fill" /> Live
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)]">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <User size={12} className="text-[var(--text-tertiary)]" />
                      <span className="text-xs text-[var(--text-secondary)]">
                        {version.createdByName}
                      </span>
                    </div>

                    {/* Description if any */}
                    {version.description && (
                      <p className="text-xs text-[var(--text-tertiary)] mb-2 italic">
                        "{version.description}"
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-1">
                      {isConfirmingRestore ? (
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <Warning size={12} /> Restore this version?
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(version);
                            }}
                            disabled={actionLoading === version.id}
                            className="px-2 py-1 text-[11px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === version.id ? 'Restoring...' : 'Yes, restore'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRestore(null);
                            }}
                            className="px-2 py-1 text-[11px] font-medium rounded text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {isProduction ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnpublish(version);
                              }}
                              disabled={actionLoading === version.id}
                              className="px-2.5 py-1 text-[11px] font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublish(version);
                              }}
                              disabled={actionLoading === version.id}
                              className="px-2.5 py-1 text-[11px] font-medium rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <Publish size={11} weight="bold" /> Publish
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRestore(version.id);
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium rounded border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1"
                          >
                            <Restore size={11} /> Restore
                          </button>
                        </>
                      )}
                    </div>

                    {/* Preview info when selected */}
                    {isSelected && previewData && !loadingPreview && (
                      <div className="mt-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-light)]">
                        <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                          <Eye size={12} /> Snapshot preview
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2 bg-[var(--bg-card)] rounded">
                            <p className="text-lg font-semibold text-[var(--text-primary)]">
                              {previewData.nodes?.length || 0}
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">Nodes</p>
                          </div>
                          <div className="text-center p-2 bg-[var(--bg-card)] rounded">
                            <p className="text-lg font-semibold text-[var(--text-primary)]">
                              {previewData.connections?.length || 0}
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">Connections</p>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                          <p className="font-medium mb-1">Nodes:</p>
                          <div className="flex flex-wrap gap-1">
                            {(previewData.nodes || []).slice(0, 8).map((n: any, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-light)] text-[10px]"
                              >
                                {n.label || n.type}
                              </span>
                            ))}
                            {(previewData.nodes || []).length > 8 && (
                              <span className="text-[10px] text-[var(--text-tertiary)]">
                                +{previewData.nodes.length - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
                          {formatFullDate(version.createdAt)}
                        </p>
                      </div>
                    )}
                    {isSelected && loadingPreview && (
                      <div className="mt-3 flex items-center justify-center py-4">
                        <SpinnerGap size={16} className="text-teal-500 animate-spin" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Versions are created when you <strong>Publish</strong>. The <strong>Live</strong> version is used for scheduled & webhook triggers.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
};

export default VersionHistoryPanel;
