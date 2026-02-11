/**
 * TagsModal - Modal para gestionar tags de un workflow
 */

import React, { useState, useEffect } from 'react';
import { X, Tag } from '@phosphor-icons/react';

interface TagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTags: string[];
  onSave: (tags: string[]) => Promise<void>;
  disabled?: boolean;
}

export const TagsModal: React.FC<TagsModalProps> = ({
  isOpen,
  onClose,
  initialTags,
  onSave,
  disabled = false,
}) => {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTags(initialTags);
      setNewTagInput('');
    }
  }, [isOpen, initialTags]);

  if (!isOpen) return null;

  const handleRemoveTag = (idx: number) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setNewTagInput('');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(tags);
      setNewTagInput('');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNewTagInput('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[var(--border-light)]">
          <h3 className="text-lg font-normal text-[var(--text-primary)] flex items-center gap-2">
            <Tag size={20} className="text-[var(--text-secondary)]" weight="light" />
            Manage Tags
          </h3>
        </div>
        <div className="px-6 py-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Current Tags</label>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)]"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(idx)}
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

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Add Tag</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => {
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
                disabled={!newTagInput.trim() || tags.includes(newTagInput.trim())}
                className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={disabled || isSaving}
            className="px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
