/**
 * GraphSearch - Enhanced search with visual highlight
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlass, X, CaretDown, CaretUp } from '@phosphor-icons/react';

interface SearchResult {
    id: string;
    name: string;
    type: 'entity' | 'property';
    parentName?: string;
}

interface GraphSearchProps {
    onSearch: (query: string) => SearchResult[];
    onResultSelect: (id: string) => void;
    onHighlight: (ids: string[]) => void;
}

export const GraphSearch: React.FC<GraphSearchProps> = ({
    onSearch,
    onResultSelect,
    onHighlight,
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                const searchResults = onSearch(query);
                setResults(searchResults);
                setIsOpen(searchResults.length > 0);
                setSelectedIndex(0);
                // Highlight all matching nodes
                onHighlight(searchResults.map(r => r.id));
            } else {
                setResults([]);
                setIsOpen(false);
                onHighlight([]);
            }
        }, 200);
        
        return () => clearTimeout(timer);
    }, [query, onSearch, onHighlight]);
    
    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    onResultSelect(results[selectedIndex].id);
                    setIsOpen(false);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setQuery('');
                break;
        }
    }, [isOpen, results, selectedIndex, onResultSelect]);
    
    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        onHighlight([]);
        inputRef.current?.focus();
    };
    
    return (
        <div ref={containerRef} className="relative w-72">
            {/* Search Input */}
            <div className="relative">
                <MagnifyingGlass
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder="Buscar entidades..."
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            
            {/* Results Dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-2 border-b border-[var(--border-light)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {results.length} resultado{results.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                            <CaretUp size={12} />
                            <CaretDown size={12} />
                            <span>navegar</span>
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {results.map((result, index) => (
                            <button
                                key={result.id}
                                onClick={() => {
                                    onResultSelect(result.id);
                                    setIsOpen(false);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-[var(--accent-primary)]/10'
                                        : 'hover:bg-[var(--bg-hover)]'
                                }`}
                            >
                                <div
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        result.type === 'entity'
                                            ? 'bg-[var(--accent-primary)]'
                                            : 'bg-[var(--accent-success)]'
                                    }`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                                        {result.name}
                                    </div>
                                    {result.parentName && (
                                        <div className="text-xs text-[var(--text-tertiary)] truncate">
                                            en {result.parentName}
                                        </div>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    result.type === 'entity'
                                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                        : 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                                }`}>
                                    {result.type === 'entity' ? 'Entidad' : 'Propiedad'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GraphSearch;
