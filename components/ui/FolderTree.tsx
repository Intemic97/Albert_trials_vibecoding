import React, { useState } from 'react';
import { Folder, FolderOpen, CaretRight, CaretDown, House, Plus } from '@phosphor-icons/react';

export interface FolderNode {
    id: string;
    name: string;
    color?: string;
    parentId?: string | null;
    children?: FolderNode[];
    documentCount?: number;
    entityCount?: number;
}

interface FolderTreeProps {
    folders: FolderNode[];
    currentFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder?: (parentId: string | null) => void;
    className?: string;
}

interface FolderTreeItemProps {
    folder: FolderNode;
    level: number;
    currentFolderId: string | null;
    expandedFolders: Set<string>;
    onToggleExpand: (folderId: string) => void;
    onSelectFolder: (folderId: string) => void;
    onCreateFolder?: (parentId: string) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
    folder,
    level,
    currentFolderId,
    expandedFolders,
    onToggleExpand,
    onSelectFolder,
    onCreateFolder,
}) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = currentFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div>
            <div
                className={`
                    group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-all
                    ${isSelected
                        ? 'bg-[var(--bg-selected)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }
                `}
                style={{ paddingLeft: `${8 + level * 16}px` }}
                onClick={() => onSelectFolder(folder.id)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Expand/collapse toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(folder.id);
                    }}
                    className={`p-0.5 rounded transition-colors ${hasChildren ? 'visible' : 'invisible'}`}
                >
                    {isExpanded ? (
                        <CaretDown size={12} weight="bold" />
                    ) : (
                        <CaretRight size={12} weight="bold" />
                    )}
                </button>

                {/* Folder icon */}
                {isExpanded ? (
                    <FolderOpen
                        size={16}
                        weight="light"
                        style={{ color: isSelected ? 'white' : (folder.color || 'var(--text-secondary)') }}
                    />
                ) : (
                    <Folder
                        size={16}
                        weight="light"
                        style={{ color: isSelected ? 'white' : (folder.color || 'var(--text-secondary)') }}
                    />
                )}

                {/* Folder name */}
                <span className="flex-1 truncate text-xs font-medium">{folder.name}</span>

                {/* Item count badge */}
                {(folder.documentCount || folder.entityCount) && !isHovered ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20' : 'bg-[var(--bg-tertiary)]'}`}>
                        {(folder.documentCount || 0) + (folder.entityCount || 0)}
                    </span>
                ) : null}

                {/* Add subfolder button (on hover) */}
                {isHovered && onCreateFolder && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateFolder(folder.id);
                        }}
                        className={`p-0.5 rounded transition-colors ${isSelected ? 'hover:bg-white/20' : 'hover:bg-[var(--bg-tertiary)]'}`}
                        title="Create subfolder"
                    >
                        <Plus size={12} weight="bold" />
                    </button>
                )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <div>
                    {folder.children!.map((child) => (
                        <FolderTreeItem
                            key={child.id}
                            folder={child}
                            level={level + 1}
                            currentFolderId={currentFolderId}
                            expandedFolders={expandedFolders}
                            onToggleExpand={onToggleExpand}
                            onSelectFolder={onSelectFolder}
                            onCreateFolder={onCreateFolder}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
    folders,
    currentFolderId,
    onSelectFolder,
    onCreateFolder,
    className = '',
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleExpand = (folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    // Build tree structure from flat list
    const buildTree = (folders: FolderNode[]): FolderNode[] => {
        const folderMap = new Map<string, FolderNode>();
        const roots: FolderNode[] = [];

        // First pass: create a map of all folders
        folders.forEach((folder) => {
            folderMap.set(folder.id, { ...folder, children: [] });
        });

        // Second pass: build the tree
        folders.forEach((folder) => {
            const node = folderMap.get(folder.id)!;
            if (folder.parentId && folderMap.has(folder.parentId)) {
                const parent = folderMap.get(folder.parentId)!;
                parent.children = parent.children || [];
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    const treeData = buildTree(folders);

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Home / All items */}
            <div
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all mb-1
                    ${currentFolderId === null
                        ? 'bg-[var(--bg-selected)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }
                `}
                onClick={() => onSelectFolder(null)}
            >
                <House size={16} weight="light" />
                <span className="text-xs font-medium">All Items</span>
            </div>

            {/* Divider */}
            <div className="h-px bg-[var(--border-light)] my-2" />

            {/* Folder tree */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {treeData.length > 0 ? (
                    treeData.map((folder) => (
                        <FolderTreeItem
                            key={folder.id}
                            folder={folder}
                            level={0}
                            currentFolderId={currentFolderId}
                            expandedFolders={expandedFolders}
                            onToggleExpand={toggleExpand}
                            onSelectFolder={onSelectFolder}
                            onCreateFolder={onCreateFolder}
                        />
                    ))
                ) : (
                    <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">
                        No folders yet
                    </div>
                )}
            </div>

            {/* Create folder button */}
            {onCreateFolder && (
                <button
                    onClick={() => onCreateFolder(null)}
                    className="flex items-center gap-2 px-3 py-2 mt-2 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors border border-dashed border-[var(--border-light)]"
                >
                    <Plus size={14} weight="light" />
                    <span>New Folder</span>
                </button>
            )}
        </div>
    );
};
