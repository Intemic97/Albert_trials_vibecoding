import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <header className="h-20 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-8 pt-2 z-10 shrink-0 transition-colors duration-200">
      <div>
        <h1 
          className="text-lg font-normal text-[var(--text-primary)]"
          style={{ fontFamily: "'Berkeley Mono', monospace" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
};
