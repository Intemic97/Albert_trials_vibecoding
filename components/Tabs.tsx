import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabItem {
    id: string;
    label: string;
    icon?: LucideIcon;
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
        <div className={`border-b border-slate-200 ${className}`}>
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
                                    ? 'text-slate-900'
                                    : 'text-slate-500 hover:text-slate-700'
                                }
                            `}
                        >
                            {Icon && <Icon size={16} className={isActive ? 'text-slate-900' : 'text-slate-500'} />}
                            <span>{item.label}</span>
                            {item.badge !== undefined && (
                                <span className={`
                                    ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                                    ${isActive
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                    }
                                `}>
                                    {item.badge}
                                </span>
                            )}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-t" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
