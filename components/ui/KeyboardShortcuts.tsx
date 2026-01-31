/**
 * Keyboard Shortcuts System
 * Global keyboard shortcuts for the application
 */

import React, { useEffect, useCallback, createContext, useContext, useState } from 'react';
import { X, Keyboard, Command } from '@phosphor-icons/react';

// ============================================================================
// TYPES
// ============================================================================

export interface Shortcut {
    key: string;
    modifiers?: ('ctrl' | 'cmd' | 'shift' | 'alt')[];
    description: string;
    action: () => void;
    category: string;
    global?: boolean;
}

interface KeyboardShortcutsContextType {
    shortcuts: Map<string, Shortcut>;
    registerShortcut: (id: string, shortcut: Shortcut) => void;
    unregisterShortcut: (id: string) => void;
    showHelp: boolean;
    setShowHelp: (show: boolean) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const getShortcutKey = (shortcut: Shortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.modifiers?.includes('ctrl') || shortcut.modifiers?.includes('cmd')) {
        parts.push(isMac ? 'cmd' : 'ctrl');
    }
    if (shortcut.modifiers?.includes('shift')) {
        parts.push('shift');
    }
    if (shortcut.modifiers?.includes('alt')) {
        parts.push('alt');
    }
    
    parts.push(shortcut.key.toLowerCase());
    
    return parts.join('+');
};

const formatShortcutDisplay = (shortcut: Shortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.modifiers?.includes('ctrl') || shortcut.modifiers?.includes('cmd')) {
        parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.modifiers?.includes('shift')) {
        parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.modifiers?.includes('alt')) {
        parts.push(isMac ? '⌥' : 'Alt');
    }
    
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join(isMac ? '' : '+');
};

// ============================================================================
// PROVIDER
// ============================================================================

export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [shortcuts, setShortcuts] = useState<Map<string, Shortcut>>(new Map());
    const [showHelp, setShowHelp] = useState(false);

    const registerShortcut = useCallback((id: string, shortcut: Shortcut) => {
        setShortcuts(prev => {
            const next = new Map(prev);
            next.set(id, shortcut);
            return next;
        });
    }, []);

    const unregisterShortcut = useCallback((id: string) => {
        setShortcuts(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    // Global keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input/textarea
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable;

            // Build the pressed key combo
            const parts: string[] = [];
            if (e.metaKey || e.ctrlKey) {
                parts.push(isMac ? 'cmd' : 'ctrl');
            }
            if (e.shiftKey) {
                parts.push('shift');
            }
            if (e.altKey) {
                parts.push('alt');
            }
            parts.push(e.key.toLowerCase());
            
            const pressedKey = parts.join('+');

            // Find matching shortcut
            for (const [, shortcut] of shortcuts) {
                const shortcutKey = getShortcutKey(shortcut);
                
                if (shortcutKey === pressedKey) {
                    // Only execute global shortcuts when in input, or any shortcut when not in input
                    if (!isInput || shortcut.global) {
                        e.preventDefault();
                        e.stopPropagation();
                        shortcut.action();
                        return;
                    }
                }
            }

            // Show help with ? or F1
            if (e.key === '?' && e.shiftKey && !isInput) {
                e.preventDefault();
                setShowHelp(true);
            }
            if (e.key === 'F1') {
                e.preventDefault();
                setShowHelp(true);
            }
            
            // Close help with Escape
            if (e.key === 'Escape' && showHelp) {
                setShowHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, showHelp]);

    return (
        <KeyboardShortcutsContext.Provider value={{
            shortcuts,
            registerShortcut,
            unregisterShortcut,
            showHelp,
            setShowHelp
        }}>
            {children}
            {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}
        </KeyboardShortcutsContext.Provider>
    );
};

// ============================================================================
// HOOK
// ============================================================================

export const useKeyboardShortcuts = () => {
    const context = useContext(KeyboardShortcutsContext);
    if (!context) {
        throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
    }
    return context;
};

/**
 * Hook to register a shortcut
 */
export const useShortcut = (
    id: string,
    shortcut: Omit<Shortcut, 'action'> & { action: () => void },
    deps: React.DependencyList = []
) => {
    const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

    useEffect(() => {
        registerShortcut(id, shortcut);
        return () => unregisterShortcut(id);
    }, [id, ...deps]);
};

// ============================================================================
// HELP MODAL
// ============================================================================

interface KeyboardShortcutsHelpProps {
    onClose: () => void;
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ onClose }) => {
    const { shortcuts } = useKeyboardShortcuts();

    // Group shortcuts by category
    const categories = new Map<string, Shortcut[]>();
    shortcuts.forEach(shortcut => {
        const existing = categories.get(shortcut.category) || [];
        existing.push(shortcut);
        categories.set(shortcut.category, existing);
    });

    return (
        <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#256A65]/10 flex items-center justify-center">
                            <Keyboard size={20} className="text-[#256A65]" weight="light" />
                        </div>
                        <div>
                            <h2 className="text-base font-medium text-[var(--text-primary)]">Keyboard Shortcuts</h2>
                            <p className="text-xs text-[var(--text-tertiary)]">Press ? to show this help</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={18} weight="light" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {categories.size === 0 ? (
                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                            No shortcuts registered
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Array.from(categories.entries()).map(([category, categoryShortcuts]) => (
                                <div key={category}>
                                    <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {categoryShortcuts.map((shortcut, idx) => (
                                            <div 
                                                key={idx}
                                                className="flex items-center justify-between py-2 px-3 bg-[var(--bg-tertiary)]/50 rounded-lg"
                                            >
                                                <span className="text-sm text-[var(--text-secondary)]">
                                                    {shortcut.description}
                                                </span>
                                                <kbd className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-xs font-mono text-[var(--text-primary)]">
                                                    {formatShortcutDisplay(shortcut)}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30">
                    <p className="text-xs text-[var(--text-tertiary)] text-center">
                        Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded text-[10px] font-mono mx-1">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SHORTCUT INDICATOR COMPONENT
// ============================================================================

interface ShortcutBadgeProps {
    shortcut: string;
    className?: string;
}

export const ShortcutBadge: React.FC<ShortcutBadgeProps> = ({ shortcut, className = '' }) => {
    const formatted = shortcut
        .replace('cmd', isMac ? '⌘' : 'Ctrl')
        .replace('ctrl', 'Ctrl')
        .replace('shift', isMac ? '⇧' : 'Shift')
        .replace('alt', isMac ? '⌥' : 'Alt')
        .replace('+', isMac ? '' : '+');

    return (
        <kbd className={`px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded text-[10px] font-mono text-[var(--text-tertiary)] ${className}`}>
            {formatted}
        </kbd>
    );
};

export default KeyboardShortcutsProvider;
