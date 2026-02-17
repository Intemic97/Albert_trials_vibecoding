import React from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Trash } from '@phosphor-icons/react';

interface BulkActionsBarProps {
    selectedCount: number;
    onMove: () => void;
    onDelete: () => void;
    onClear: () => void;
    loading?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onMove,
    onDelete,
    onClear,
    loading = false,
}) => {
    const { t } = useTranslation();
    if (selectedCount === 0) return null;
    return (
        <div className="flex items-center gap-3 px-6 py-2 bg-[var(--accent-primary)]/10 border-t border-[var(--accent-primary)]/20">
            <span className="text-sm font-medium text-[var(--text-primary)]">
                {t('knowledgeBase.entitiesSelected', { count: selectedCount })}
            </span>
            <button
                onClick={onMove}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] disabled:opacity-50"
            >
                <Folder size={14} weight="light" />
                {t('knowledgeBase.move')}
            </button>
            <button
                onClick={onDelete}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50"
            >
                <Trash size={14} weight="light" />
                {t('knowledgeBase.delete')}
            </button>
            <button
                onClick={onClear}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
                {t('knowledgeBase.clearSelection')}
            </button>
        </div>
    );
};
