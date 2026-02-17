import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, House, Folder, SpinnerGap } from '@phosphor-icons/react';

interface FolderOption {
    id: string;
    name: string;
    color?: string;
}

interface MoveEntitiesModalProps {
    folders: FolderOption[];
    selectedCount: number;
    onMove: (targetFolderId: string | null) => void;
    onClose: () => void;
    loading?: boolean;
}

export const MoveEntitiesModal: React.FC<MoveEntitiesModalProps> = ({
    folders,
    selectedCount,
    onMove,
    onClose,
    loading = false,
}) => {
    const { t } = useTranslation();
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => !loading && onClose()}
        >
            <div
                className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-medium text-[var(--text-primary)]">
                        {t('knowledgeBase.moveEntities')}
                    </h2>
                    <button
                        onClick={() => !loading && onClose()}
                        className="p-1 hover:bg-[var(--bg-hover)] rounded-lg"
                    >
                        <X size={18} weight="light" className="text-[var(--text-secondary)]" />
                    </button>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                    {t('knowledgeBase.moveEntitiesSelected', { count: selectedCount })}
                </p>
                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => onMove(null)}
                        disabled={loading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                    >
                        <House size={18} weight="light" className="text-[var(--text-tertiary)]" />
                        {t('knowledgeBase.rootFolder')}
                    </button>
                    {folders.map((folder) => (
                        <button
                            key={folder.id}
                            type="button"
                            onClick={() => onMove(folder.id)}
                            disabled={loading}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                        >
                            <Folder
                                size={18}
                                weight="light"
                                style={{ color: folder.color || '#6b7280' }}
                            />
                            <span className="truncate">{folder.name}</span>
                        </button>
                    ))}
                </div>
                {loading && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                        <SpinnerGap size={14} weight="light" className="animate-spin" />
                        {t('knowledgeBase.moving')}
                    </div>
                )}
            </div>
        </div>
    );
};
