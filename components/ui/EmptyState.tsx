import React from 'react';
import { FileText, Database, FlowArrow, FolderOpen, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';

export type EmptyStateType = 'default' | 'search' | 'error' | 'workflows' | 'entities' | 'documents';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const defaultIcons: Record<EmptyStateType, React.ReactNode> = {
  default: <FolderOpen size={48} weight="light" />,
  search: <MagnifyingGlass size={48} weight="light" />,
  error: <WarningCircle size={48} weight="light" />,
  workflows: <FlowArrow size={48} weight="light" />,
  entities: <Database size={48} weight="light" />,
  documents: <FileText size={48} weight="light" />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  const displayIcon = icon || defaultIcons[type];
  
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {/* Icon container with subtle background */}
      <div className="w-24 h-24 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-6 text-[var(--text-tertiary)]">
        {displayIcon}
      </div>
      
      {/* Title */}
      <h3 
        className="text-lg font-medium text-[var(--text-primary)] mb-2 text-center"
        style={{ fontFamily: "'Berkeley Mono', monospace" }}
      >
        {title}
      </h3>
      
      {/* Description */}
      {description && (
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
          {description}
        </p>
      )}
      
      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// Inline empty state for smaller areas
interface InlineEmptyStateProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const InlineEmptyState: React.FC<InlineEmptyStateProps> = ({
  message,
  action,
}) => {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-[var(--text-secondary)] mb-3">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-[var(--text-primary)] hover:text-[var(--accent-primary)] font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
