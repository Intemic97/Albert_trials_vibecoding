import React from 'react';
import { House, CaretRight } from '@phosphor-icons/react';

export interface BreadcrumbItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    onNavigate: (id: string | null) => void;
    className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate, className = '' }) => {
    return (
        <nav className={`flex items-center gap-1 text-sm ${className}`} aria-label="Breadcrumb">
            {/* Home */}
            <button
                onClick={() => onNavigate(null)}
                className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors
                    ${items.length === 0
                        ? 'text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }
                `}
            >
                <House size={14} weight="light" />
                <span>Home</span>
            </button>

            {/* Path items */}
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                
                return (
                    <React.Fragment key={item.id}>
                        <CaretRight size={12} className="text-[var(--text-tertiary)]" />
                        <button
                            onClick={() => !isLast && onNavigate(item.id)}
                            className={`
                                flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors max-w-[200px]
                                ${isLast
                                    ? 'text-[var(--text-primary)] font-medium cursor-default'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                }
                            `}
                            disabled={isLast}
                        >
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                        </button>
                    </React.Fragment>
                );
            })}
        </nav>
    );
};
