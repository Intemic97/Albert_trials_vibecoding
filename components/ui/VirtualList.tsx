/**
 * Virtual List Component
 * Renders only visible items for performance with large lists
 */

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    overscan?: number;
    className?: string;
    containerHeight?: number | string;
    getItemKey?: (item: T, index: number) => string | number;
    onEndReached?: () => void;
    endReachedThreshold?: number;
    emptyMessage?: string;
}

interface VirtualListState {
    scrollTop: number;
    containerHeight: number;
}

// ============================================================================
// VIRTUAL LIST COMPONENT
// ============================================================================

function VirtualListInner<T>({
    items,
    itemHeight,
    renderItem,
    overscan = 5,
    className = '',
    containerHeight = '100%',
    getItemKey,
    onEndReached,
    endReachedThreshold = 200,
    emptyMessage = 'No items'
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<VirtualListState>({
        scrollTop: 0,
        containerHeight: 0
    });

    // Calculate visible range
    const { startIndex, endIndex, visibleItems } = useMemo(() => {
        const { scrollTop, containerHeight } = state;
        
        if (containerHeight === 0 || items.length === 0) {
            return { startIndex: 0, endIndex: 0, visibleItems: [] };
        }

        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const end = Math.min(items.length, start + visibleCount + overscan * 2);

        return {
            startIndex: start,
            endIndex: end,
            visibleItems: items.slice(start, end)
        };
    }, [items, itemHeight, state.scrollTop, state.containerHeight, overscan]);

    // Total height of all items
    const totalHeight = items.length * itemHeight;

    // Offset for visible items
    const offsetY = startIndex * itemHeight;

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        
        setState(prev => ({
            ...prev,
            scrollTop
        }));

        // Check if near end
        if (onEndReached && scrollHeight - scrollTop - clientHeight < endReachedThreshold) {
            onEndReached();
        }
    }, [onEndReached, endReachedThreshold]);

    // Update container height on mount and resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateHeight = () => {
            setState(prev => ({
                ...prev,
                containerHeight: container.clientHeight
            }));
        };

        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Empty state
    if (items.length === 0) {
        return (
            <div 
                className={`flex items-center justify-center text-[var(--text-tertiary)] text-sm ${className}`}
                style={{ height: containerHeight }}
            >
                {emptyMessage}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            {/* Total height container */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Visible items container */}
                <div
                    style={{
                        position: 'absolute',
                        top: offsetY,
                        left: 0,
                        right: 0
                    }}
                >
                    {visibleItems.map((item, index) => {
                        const actualIndex = startIndex + index;
                        const key = getItemKey 
                            ? getItemKey(item, actualIndex) 
                            : actualIndex;

                        return (
                            <div
                                key={key}
                                style={{ height: itemHeight }}
                            >
                                {renderItem(item, actualIndex)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Memoize the component
export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;

// ============================================================================
// VIRTUAL GRID COMPONENT
// ============================================================================

export interface VirtualGridProps<T> {
    items: T[];
    itemWidth: number;
    itemHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    gap?: number;
    overscan?: number;
    className?: string;
    containerHeight?: number | string;
    getItemKey?: (item: T, index: number) => string | number;
}

function VirtualGridInner<T>({
    items,
    itemWidth,
    itemHeight,
    renderItem,
    gap = 16,
    overscan = 2,
    className = '',
    containerHeight = '100%',
    getItemKey
}: VirtualGridProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState({
        scrollTop: 0,
        containerWidth: 0,
        containerHeight: 0
    });

    // Calculate columns based on container width
    const columns = useMemo(() => {
        if (state.containerWidth === 0) return 1;
        return Math.max(1, Math.floor((state.containerWidth + gap) / (itemWidth + gap)));
    }, [state.containerWidth, itemWidth, gap]);

    // Calculate rows
    const totalRows = Math.ceil(items.length / columns);
    const rowHeight = itemHeight + gap;
    const totalHeight = totalRows * rowHeight;

    // Calculate visible range
    const { startRow, endRow, visibleItems } = useMemo(() => {
        const { scrollTop, containerHeight } = state;
        
        if (containerHeight === 0 || items.length === 0) {
            return { startRow: 0, endRow: 0, visibleItems: [] };
        }

        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const visibleRows = Math.ceil(containerHeight / rowHeight);
        const end = Math.min(totalRows, start + visibleRows + overscan * 2);

        const startIndex = start * columns;
        const endIndex = Math.min(items.length, end * columns);

        return {
            startRow: start,
            endRow: end,
            visibleItems: items.slice(startIndex, endIndex)
        };
    }, [items, rowHeight, state.scrollTop, state.containerHeight, columns, totalRows, overscan]);

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setState(prev => ({
            ...prev,
            scrollTop: e.currentTarget.scrollTop
        }));
    }, []);

    // Update dimensions on mount and resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = () => {
            setState(prev => ({
                ...prev,
                containerWidth: container.clientWidth,
                containerHeight: container.clientHeight
            }));
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const offsetY = startRow * rowHeight;

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div
                    style={{
                        position: 'absolute',
                        top: offsetY,
                        left: 0,
                        right: 0,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, ${itemWidth}px)`,
                        gap: `${gap}px`,
                        justifyContent: 'start'
                    }}
                >
                    {visibleItems.map((item, index) => {
                        const actualIndex = startRow * columns + index;
                        const key = getItemKey 
                            ? getItemKey(item, actualIndex) 
                            : actualIndex;

                        return (
                            <div
                                key={key}
                                style={{ width: itemWidth, height: itemHeight }}
                            >
                                {renderItem(item, actualIndex)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export const VirtualGrid = memo(VirtualGridInner) as typeof VirtualGridInner;

export default VirtualList;
