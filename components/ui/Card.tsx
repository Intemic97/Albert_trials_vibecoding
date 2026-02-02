import React from 'react';

export type CardVariant = 'default' | 'clickable' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hover?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg',
  clickable: 'bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg cursor-pointer hover:shadow-md hover:border-[var(--border-medium)] hover:scale-[1.01] active:scale-[0.99]',
  elevated: 'bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-md',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  hover = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${hover && variant !== 'clickable' ? 'hover:shadow-sm hover:border-[var(--border-medium)]' : ''}
        transition-all duration-200 ease-out
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </div>
  );
};

// Card Header subcomponent
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 
            className="text-base font-normal text-[var(--text-primary)] truncate"
            style={{ fontFamily: "'Berkeley Mono', monospace" }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-2">{action}</div>}
    </div>
  );
};

// Card Footer subcomponent
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`mt-5 pt-4 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
