/**
 * TagsManageModal
 * Extracted from Workflows.tsx - Tags Modal (~120 lines)
 */

import React from 'react';
import { Tag, X } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';

interface TagsManageModalProps {
  show: boolean;
  onClose: () => void;
  workflowTags: string[];
  setWorkflowTags: (tags: string[]) => void;
  newTagInput: string;
  setNewTagInput: (input: string) => void;
  currentWorkflowId: string | null;
  workflowName: string;
  nodes: any[];
  connections: any[];
  userName: string;
  fetchWorkflows: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export const TagsManageModal: React.FC<TagsManageModalProps> = ({
  show, onClose, workflowTags, setWorkflowTags, newTagInput, setNewTagInput,
  currentWorkflowId, workflowName, nodes, connections, userName,
  fetchWorkflows, showToast
}) => {
  if (!show) return null;

  const handleAddTag = () => {
    if (newTagInput.trim() && !workflowTags.includes(newTagInput.trim())) {
      setWorkflowTags([...workflowTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const handleSave = async () => {
    if (currentWorkflowId) {
      try {
        const res = await fetch(`${API_BASE}/workflows/${currentWorkflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName,
            data: { nodes, connections },
            tags: workflowTags,
            lastEditedByName: userName
          }),
          credentials: 'include'
        });
        if (res.ok) {
          await fetchWorkflows();
          showToast('Tags updated successfully!', 'success');
        }
      } catch (error) {
        console.error('Error saving tags:', error);
      }
    }
    onClose();
    setNewTagInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--border-light)]">
          <h3 className="text-lg font-normal text-[var(--text-primary)] flex items-center gap-2">
            <Tag size={20} className="text-[var(--text-secondary)]" weight="light" />
            Manage Tags
          </h3>
        </div>
        <div className="px-6 py-4">
          {/* Current Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Current Tags</label>
            {workflowTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workflowTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)]"
                  >
                    {tag}
                    <button
                      onClick={() => setWorkflowTags(workflowTags.filter((_, i) => i !== idx))}
                      className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X size={14} weight="light" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No tags added yet</p>
            )}
          </div>

          {/* Add New Tag */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Add Tag</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagInput.trim()) {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Enter tag name..."
                className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-2">
          <button
            onClick={() => { onClose(); setNewTagInput(''); }}
            className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};




