import React from 'react';
import { Icon } from '@phosphor-icons/react';

export interface TabItem {
    id: string;
    label: string;
    icon?: Icon;
    badge?: number | string;
}

interface TabsProps {
    items: TabItem[];
    activeTab: string;
    onChange: (tabId: string) => void;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeTab, onChange, className = '' }) => {
    return (
        <div className={`border-b border-[var(--border-light)] ${className}`}>
            <div className="flex items-center gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => onChange(item.id)}
                            className={`
                                relative px-4 py-2.5 text-sm font-medium transition-all duration-200
                                flex items-center gap-2
                                ${isActive
                                    ? 'text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }
                            `}
                        >
                            {Icon && <Icon size={16} weight="light" className={isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} />}
                            <span>{item.label}</span>
                            {item.badge !== undefined && (
                                <span className={`
                                    ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                                    ${isActive
                                        ? 'bg-[var(--bg-selected)] text-white'
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                    }
                                `}>
                                    {item.badge}
                                </span>
                            )}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--bg-selected)] rounded-t" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
