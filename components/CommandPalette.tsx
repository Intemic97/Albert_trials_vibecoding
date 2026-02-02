import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MagnifyingGlass, X, Database, Layout, GitBranch, FileText, 
    GearSix, Plus, Sparkle, ArrowRight, Command, CaretRight,
    Robot, ChartBar, Table, Lightning, Clock, User, House
} from '@phosphor-icons/react';
import { Entity } from '../types';
import { API_BASE } from '../config';

// ============================================================================
// TYPES
// ============================================================================

type CommandCategory = 'navigation' | 'actions' | 'entities' | 'dashboards' | 'workflows' | 'recent';

interface CommandItem {
    id: string;
    title: string;
    subtitle?: string;
    category: CommandCategory;
    icon: React.ReactNode;
    action: () => void;
    keywords?: string[];
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    entities: Entity[];
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_CONFIG: Record<CommandCategory, { label: string; icon: React.ReactNode }> = {
    navigation: { label: 'Navigation', icon: <House size={12} weight="light" /> },
    actions: { label: 'Actions', icon: <Lightning size={12} weight="light" /> },
    entities: { label: 'Entities', icon: <Database size={12} weight="light" /> },
    dashboards: { label: 'Dashboards', icon: <Layout size={12} weight="light" /> },
    workflows: { label: 'Workflows', icon: <GitBranch size={12} weight="light" /> },
    recent: { label: 'Recent', icon: <Clock size={12} weight="light" /> },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, entities }) => {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dashboards, setDashboards] = useState<any[]>([]);
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [recentItems, setRecentItems] = useState<string[]>([]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
            fetchDashboards();
            fetchWorkflows();
            loadRecentItems();
        }
    }, [isOpen]);

    // Fetch dashboards
    const fetchDashboards = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboards`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDashboards(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching dashboards:', error);
        }
    };

    // Fetch workflows
    const fetchWorkflows = async () => {
        try {
            const res = await fetch(`${API_BASE}/workflows`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setWorkflows(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
        }
    };

    // Load recent items from localStorage
    const loadRecentItems = () => {
        const stored = localStorage.getItem('command_palette_recent');
        if (stored) {
            setRecentItems(JSON.parse(stored));
        }
    };

    // Save to recent
    const saveToRecent = (id: string) => {
        const updated = [id, ...recentItems.filter(i => i !== id)].slice(0, 5);
        localStorage.setItem('command_palette_recent', JSON.stringify(updated));
        setRecentItems(updated);
    };

    // Navigate helper
    const navigateTo = useCallback((path: string, itemId?: string) => {
        if (itemId) saveToRecent(itemId);
        navigate(path);
        onClose();
    }, [navigate, onClose]);

    // Build command items
    const commands = useMemo<CommandItem[]>(() => {
        const items: CommandItem[] = [];

        // Navigation commands
        items.push(
            {
                id: 'nav-home',
                title: 'Go to Overview',
                category: 'navigation',
                icon: <House size={18} weight="light" />,
                action: () => navigateTo('/overview'),
                keywords: ['home', 'start', 'main']
            },
            {
                id: 'nav-copilot',
                title: 'Go to Copilot',
                subtitle: 'AI-powered assistant',
                category: 'navigation',
                icon: <Robot size={18} weight="light" />,
                action: () => navigateTo('/copilot'),
                keywords: ['ai', 'chat', 'assistant']
            },
            {
                id: 'nav-entities',
                title: 'Go to Knowledge Base',
                subtitle: 'Manage your data entities',
                category: 'navigation',
                icon: <Database size={18} weight="light" />,
                action: () => navigateTo('/entities'),
                keywords: ['data', 'tables', 'records']
            },
            {
                id: 'nav-dashboards',
                title: 'Go to Dashboards',
                category: 'navigation',
                icon: <Layout size={18} weight="light" />,
                action: () => navigateTo('/dashboard'),
                keywords: ['charts', 'visualizations', 'widgets']
            },
            {
                id: 'nav-workflows',
                title: 'Go to Workflows',
                category: 'navigation',
                icon: <GitBranch size={18} weight="light" />,
                action: () => navigateTo('/workflows'),
                keywords: ['automation', 'flows', 'pipelines']
            },
            {
                id: 'nav-lab',
                title: 'Go to Lab',
                category: 'navigation',
                icon: <ChartBar size={18} weight="light" />,
                action: () => navigateTo('/lab'),
                keywords: ['what-if', 'scenarios', 'analysis', 'experiments']
            },
            {
                id: 'nav-reports',
                title: 'Go to Reports',
                category: 'navigation',
                icon: <FileText size={18} weight="light" />,
                action: () => navigateTo('/reports'),
                keywords: ['documents', 'export', 'pdf']
            },
            {
                id: 'nav-settings',
                title: 'Go to Settings',
                category: 'navigation',
                icon: <GearSix size={18} weight="light" />,
                action: () => navigateTo('/settings'),
                keywords: ['preferences', 'config', 'account']
            }
        );

        // Action commands
        items.push(
            {
                id: 'action-new-entity',
                title: 'Create new Entity',
                subtitle: 'Add a new data table',
                category: 'actions',
                icon: <Plus size={18} weight="light" />,
                action: () => navigateTo('/entities'),
                keywords: ['add', 'new', 'table', 'data']
            },
            {
                id: 'action-new-dashboard',
                title: 'Create new Dashboard',
                subtitle: 'Build visualizations',
                category: 'actions',
                icon: <Plus size={18} weight="light" />,
                action: () => navigateTo('/dashboard'),
                keywords: ['add', 'new', 'chart', 'widget']
            },
            {
                id: 'action-new-workflow',
                title: 'Create new Workflow',
                subtitle: 'Automate processes',
                category: 'actions',
                icon: <Plus size={18} weight="light" />,
                action: () => navigateTo('/workflows'),
                keywords: ['add', 'new', 'automation']
            },
            {
                id: 'action-ask-ai',
                title: 'Ask AI Copilot',
                subtitle: 'Get help from AI assistant',
                category: 'actions',
                icon: <Sparkle size={18} weight="light" />,
                action: () => navigateTo('/copilot'),
                keywords: ['ai', 'help', 'question', 'chat']
            }
        );

        // Entity items
        entities.forEach(entity => {
            items.push({
                id: `entity-${entity.id}`,
                title: entity.name,
                subtitle: `${entity.properties.length} properties`,
                category: 'entities',
                icon: <Table size={18} weight="light" />,
                action: () => navigateTo(`/entities/${entity.id}`, entity.id),
                keywords: [entity.name.toLowerCase(), 'entity', 'data']
            });
        });

        // Dashboard items
        dashboards.forEach(dashboard => {
            items.push({
                id: `dashboard-${dashboard.id}`,
                title: dashboard.name,
                subtitle: dashboard.description || 'Dashboard',
                category: 'dashboards',
                icon: <Layout size={18} weight="light" />,
                action: () => navigateTo(`/dashboard/${dashboard.id}`, dashboard.id),
                keywords: [dashboard.name.toLowerCase(), 'dashboard', 'chart']
            });
        });

        // Workflow items
        workflows.forEach(workflow => {
            items.push({
                id: `workflow-${workflow.id}`,
                title: workflow.name,
                subtitle: workflow.description || 'Workflow',
                category: 'workflows',
                icon: <GitBranch size={18} weight="light" />,
                action: () => navigateTo(`/workflows/${workflow.id}`, workflow.id),
                keywords: [workflow.name.toLowerCase(), 'workflow', 'automation']
            });
        });

        return items;
    }, [entities, dashboards, workflows, navigateTo]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) {
            // Show recent items first, then actions, then navigation
            const recentCommands = commands.filter(c => recentItems.includes(c.id));
            const actionCommands = commands.filter(c => c.category === 'actions');
            const navCommands = commands.filter(c => c.category === 'navigation').slice(0, 5);
            return [...recentCommands, ...actionCommands, ...navCommands];
        }

        const lowerQuery = query.toLowerCase();
        return commands.filter(cmd => {
            const matchTitle = cmd.title.toLowerCase().includes(lowerQuery);
            const matchSubtitle = cmd.subtitle?.toLowerCase().includes(lowerQuery);
            const matchKeywords = cmd.keywords?.some(k => k.includes(lowerQuery));
            return matchTitle || matchSubtitle || matchKeywords;
        }).slice(0, 15);
    }, [query, commands, recentItems]);

    // Group filtered commands by category
    const groupedCommands = useMemo(() => {
        const groups: Record<CommandCategory, CommandItem[]> = {
            recent: [],
            actions: [],
            navigation: [],
            entities: [],
            dashboards: [],
            workflows: []
        };

        filteredCommands.forEach(cmd => {
            // Check if it's a recent item
            if (recentItems.includes(cmd.id) && !query.trim()) {
                groups.recent.push(cmd);
            } else {
                groups[cmd.category].push(cmd);
            }
        });

        return groups;
    }, [filteredCommands, recentItems, query]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        filteredCommands[selectedIndex].action();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    let itemIndex = -1;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            
            {/* Palette */}
            <div 
                className="relative w-full max-w-xl bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)]">
                    <MagnifyingGlass size={18} className="text-[var(--text-tertiary)] shrink-0" weight="light" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search commands, entities, dashboards..."
                        className="flex-1 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder:text-[var(--text-tertiary)]"
                    />
                    <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[10px] rounded border border-[var(--border-light)]">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
                    {filteredCommands.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <MagnifyingGlass size={32} className="mx-auto text-[var(--text-tertiary)] mb-2" weight="light" />
                            <p className="text-sm text-[var(--text-secondary)]">No results found</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        Object.entries(groupedCommands).map(([category, items]) => {
                            if (items.length === 0) return null;
                            const config = CATEGORY_CONFIG[category as CommandCategory];
                            
                            return (
                                <div key={category}>
                                    <div className="px-4 py-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--bg-tertiary)]/50 sticky top-0">
                                        {config.icon}
                                        {config.label}
                                    </div>
                                    {items.map(item => {
                                        itemIndex++;
                                        const currentIndex = itemIndex;
                                        const isSelected = currentIndex === selectedIndex;
                                        
                                        return (
                                            <button
                                                key={item.id}
                                                data-index={currentIndex}
                                                onClick={() => item.action()}
                                                onMouseEnter={() => setSelectedIndex(currentIndex)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                    isSelected
                                                        ? 'bg-[#256A65]/10 text-[#256A65]'
                                                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                                }`}
                                            >
                                                <div className={`shrink-0 ${isSelected ? 'text-[#256A65]' : 'text-[var(--text-tertiary)]'}`}>
                                                    {item.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{item.title}</div>
                                                    {item.subtitle && (
                                                        <div className="text-xs text-[var(--text-tertiary)] truncate">{item.subtitle}</div>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <div className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                                                        <span>Enter</span>
                                                        <ArrowRight size={12} weight="light" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">↑</kbd>
                            <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">↓</kbd>
                            <span>navigate</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">↵</kbd>
                            <span>select</span>
                        </span>
                    </div>
                    <span>{filteredCommands.length} results</span>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// GLOBAL KEYBOARD SHORTCUT HOOK
// ============================================================================

export const useCommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev)
    };
};

export default CommandPalette;
