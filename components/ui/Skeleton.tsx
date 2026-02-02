import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

const roundedStyles = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Base skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'md',
}) => {
  return (
    <div
      className={`
        animate-pulse bg-[var(--bg-tertiary)]
        ${roundedStyles[rounded]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};

/**
 * Skeleton for text lines
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
};

/**
 * Skeleton for cards (matches Card component layout)
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`
        bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5
        min-h-[200px] flex flex-col
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Skeleton width={40} height={40} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={18} width="60%" rounded="sm" />
          <Skeleton height={12} width="40%" rounded="sm" />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1">
        <SkeletonText lines={2} />
      </div>
      
      {/* Footer */}
      <div className="mt-5 space-y-2">
        <Skeleton height={12} width="50%" rounded="sm" />
        <Skeleton height={12} width="35%" rounded="sm" />
      </div>
    </div>
  );
};

/**
 * Skeleton for workflow cards
 */
export const SkeletonWorkflowCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`
        bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5
        min-h-[200px] flex flex-col justify-between
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {/* Header with icon */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <Skeleton width={42} height={42} rounded="lg" />
          <div className="flex-1 space-y-2">
            <Skeleton height={16} width="70%" rounded="sm" />
            <div className="flex gap-2">
              <Skeleton height={20} width={50} rounded="md" />
              <Skeleton height={20} width={40} rounded="md" />
            </div>
          </div>
        </div>
        
        {/* Meta info */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton width={12} height={12} rounded="full" />
            <Skeleton height={12} width="40%" rounded="sm" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton width={12} height={12} rounded="full" />
            <Skeleton height={12} width="50%" rounded="sm" />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-5 flex items-center gap-2">
        <Skeleton width={14} height={14} rounded="sm" />
        <Skeleton height={12} width="30%" rounded="sm" />
      </div>
    </div>
  );
};

/**
 * Skeleton for table rows
 */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 4,
  className = '',
}) => {
  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
        <div className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} height={14} width={`${100 / cols - 5}%`} rounded="sm" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-6 py-4 border-b border-[var(--border-light)] last:border-b-0"
        >
          <div className="flex items-center gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                height={14}
                width={colIndex === 0 ? '30%' : `${100 / cols - 5}%`}
                rounded="sm"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for list items
 */
export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({
  items = 5,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg"
        >
          <Skeleton width={36} height={36} rounded="lg" />
          <div className="flex-1 space-y-2">
            <Skeleton height={14} width="60%" rounded="sm" />
            <Skeleton height={12} width="40%" rounded="sm" />
          </div>
          <Skeleton width={60} height={24} rounded="md" />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for sidebar navigation
 */
export const SkeletonSidebar: React.FC<{ items?: number }> = ({ items = 8 }) => {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton width={16} height={16} rounded="sm" />
          <Skeleton height={14} width={`${60 + Math.random() * 30}%`} rounded="sm" />
        </div>
      ))}
    </div>
  );
};

/**
 * Full page loading skeleton
 */
export const SkeletonPage: React.FC<{ title?: boolean }> = ({ title = true }) => {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      {title && (
        <div className="h-20 border-b border-[var(--border-light)] px-8 flex items-center">
          <div className="space-y-2">
            <Skeleton height={24} width={200} rounded="sm" />
            <Skeleton height={12} width={300} rounded="sm" />
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
