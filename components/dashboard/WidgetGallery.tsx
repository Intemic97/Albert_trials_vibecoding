import React, { useState } from 'react';
import { 
    ChartBar, ChartLine, ChartPie, Table, Gauge, TrendUp, TrendDown,
    NumberCircleOne, Calculator, Calendar, Clock, X, MagnifyingGlass,
    Database, Sparkle, Lightning, ArrowRight
} from '@phosphor-icons/react';

// Widget Types
export type WidgetType = 
    | 'bar_chart' 
    | 'line_chart' 
    | 'area_chart'
    | 'pie_chart' 
    | 'kpi' 
    | 'gauge' 
    | 'table'
    | 'stat'
    | 'trend'
    | 'ai_generated';

export interface WidgetTemplate {
    id: WidgetType;
    name: string;
    description: string;
    icon: React.ReactNode;
    category: 'charts' | 'stats' | 'tables' | 'ai';
    defaultWidth: number;
    defaultHeight: number;
    requiresData: boolean;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
    {
        id: 'ai_generated',
        name: 'AI Generated',
        description: 'Describe what you want and AI will create it',
        icon: <Sparkle size={24} weight="light" />,
        category: 'ai',
        defaultWidth: 6,
        defaultHeight: 4,
        requiresData: false
    },
    {
        id: 'kpi',
        name: 'KPI Card',
        description: 'Single metric with comparison',
        icon: <NumberCircleOne size={24} weight="light" />,
        category: 'stats',
        defaultWidth: 3,
        defaultHeight: 2,
        requiresData: true
    },
    {
        id: 'stat',
        name: 'Stat',
        description: 'Simple number display',
        icon: <Calculator size={24} weight="light" />,
        category: 'stats',
        defaultWidth: 2,
        defaultHeight: 2,
        requiresData: true
    },
    {
        id: 'trend',
        name: 'Trend',
        description: 'Value with sparkline trend',
        icon: <TrendUp size={24} weight="light" />,
        category: 'stats',
        defaultWidth: 4,
        defaultHeight: 2,
        requiresData: true
    },
    {
        id: 'gauge',
        name: 'Gauge',
        description: 'Progress towards a goal',
        icon: <Gauge size={24} weight="light" />,
        category: 'stats',
        defaultWidth: 3,
        defaultHeight: 3,
        requiresData: true
    },
    {
        id: 'bar_chart',
        name: 'Bar Chart',
        description: 'Compare categories',
        icon: <ChartBar size={24} weight="light" />,
        category: 'charts',
        defaultWidth: 6,
        defaultHeight: 4,
        requiresData: true
    },
    {
        id: 'line_chart',
        name: 'Line Chart',
        description: 'Show trends over time',
        icon: <ChartLine size={24} weight="light" />,
        category: 'charts',
        defaultWidth: 6,
        defaultHeight: 4,
        requiresData: true
    },
    {
        id: 'area_chart',
        name: 'Area Chart',
        description: 'Cumulative trends',
        icon: <ChartLine size={24} weight="light" />,
        category: 'charts',
        defaultWidth: 6,
        defaultHeight: 4,
        requiresData: true
    },
    {
        id: 'pie_chart',
        name: 'Pie Chart',
        description: 'Show proportions',
        icon: <ChartPie size={24} weight="light" />,
        category: 'charts',
        defaultWidth: 4,
        defaultHeight: 4,
        requiresData: true
    },
    {
        id: 'table',
        name: 'Table',
        description: 'Display tabular data',
        icon: <Table size={24} weight="light" />,
        category: 'tables',
        defaultWidth: 6,
        defaultHeight: 5,
        requiresData: true
    }
];

interface WidgetGalleryProps {
    onSelect: (template: WidgetTemplate) => void;
    onClose: () => void;
}

export const WidgetGallery: React.FC<WidgetGalleryProps> = ({ onSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = [
        { id: 'all', name: 'All', icon: <Lightning size={14} weight="light" /> },
        { id: 'ai', name: 'AI', icon: <Sparkle size={14} weight="light" /> },
        { id: 'stats', name: 'Stats', icon: <NumberCircleOne size={14} weight="light" /> },
        { id: 'charts', name: 'Charts', icon: <ChartBar size={14} weight="light" /> },
        { id: 'tables', name: 'Tables', icon: <Table size={14} weight="light" /> },
    ];

    const filteredTemplates = WIDGET_TEMPLATES.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             template.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            <div 
                className="relative w-full max-w-3xl bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-medium text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Add Widget
                        </h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Choose a widget type to add to your dashboard</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                        <X size={18} className="text-[var(--text-tertiary)]" weight="light" />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="px-6 py-3 border-b border-[var(--border-light)] space-y-3 shrink-0">
                    <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search widgets..."
                            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#256A65] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    selectedCategory === cat.id
                                        ? 'bg-[#256A65] text-white'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                {cat.icon}
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Widget Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredTemplates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => onSelect(template)}
                                className={`group relative p-4 rounded-xl border transition-all text-left hover:shadow-md ${
                                    template.category === 'ai'
                                        ? 'bg-gradient-to-br from-[#256A65]/10 to-[#84C4D1]/10 border-[#256A65]/30 hover:border-[#256A65]'
                                        : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[#256A65]/50'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
                                    template.category === 'ai'
                                        ? 'bg-[#256A65] text-white'
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] group-hover:bg-[#256A65]/10 group-hover:text-[#256A65]'
                                } transition-colors`}>
                                    {template.icon}
                                </div>
                                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">{template.name}</h3>
                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{template.description}</p>
                                
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight size={16} className="text-[#256A65]" weight="light" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {filteredTemplates.length === 0 && (
                        <div className="text-center py-12">
                            <MagnifyingGlass size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">No widgets found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WidgetGallery;
