import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-light)]',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  info: 'bg-[#84C4D1]/20 text-[var(--accent-primary)] border-[#84C4D1]/40 dark:bg-[#84C4D1]/10 dark:text-[#84C4D1] dark:border-[#84C4D1]/30',
  primary: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 dark:bg-[var(--accent-primary)]/20 dark:text-[#84C4D1] dark:border-[var(--accent-primary)]/40',
  secondary: 'bg-[#84C4D1]/15 text-[var(--accent-primary-hover)] border-[#84C4D1]/30 dark:bg-[#84C4D1]/10 dark:text-[#84C4D1] dark:border-[#84C4D1]/20',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-1 text-xs',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  icon,
  children,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded-md border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

// Status Badge for common status indicators
export type StatusType = 'pending' | 'running' | 'completed' | 'failed' | 'waiting';

interface StatusBadgeProps {
  status: StatusType;
  size?: BadgeSize;
  showIcon?: boolean;
}

const statusConfig: Record<StatusType, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'default', label: 'Pending' },
  running: { variant: 'warning', label: 'Running' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  waiting: { variant: 'info', label: 'Waiting' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = false,
}) => {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} size={size}>
      {showIcon && status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {showIcon && status === 'completed' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      )}
      {showIcon && status === 'failed' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
      {config.label}
    </Badge>
  );
};

// Tag component for user-defined tags
interface TagProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({
  children,
  onRemove,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 
        bg-[var(--bg-tertiary)] text-[var(--text-primary)] 
        border border-[var(--border-light)] rounded-md text-xs font-medium
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:text-red-500 transition-colors"
          aria-label="Remove tag"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Badge;
