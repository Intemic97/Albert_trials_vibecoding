import { useState, useCallback, useMemo } from 'react';

const DEFAULT_ROW_HEIGHT_PX = 40;
const DEFAULT_THRESHOLD = 80;
const OVERSCAN_ABOVE = 3;
const OVERSCAN_BELOW = 6;

export interface UseTableVirtualizationOptions {
    rowHeightPx?: number;
    threshold?: number;
}

/**
 * Hook for virtualizing a table body: only render visible rows + overscan.
 * Returns slice indices and scroll handler; parent uses slice(start, end) for visible rows.
 */
export function useTableVirtualization(
    totalCount: number,
    options: UseTableVirtualizationOptions = {}
) {
    const { rowHeightPx = DEFAULT_ROW_HEIGHT_PX, threshold = DEFAULT_THRESHOLD } = options;
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(500);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        setScrollTop(el.scrollTop);
        setContainerHeight(el.clientHeight);
    }, []);

    const { useVirtual, startIndex, endIndex } = useMemo(() => {
        const useVirtual = totalCount > threshold;
        if (!useVirtual) {
            return { useVirtual: false, startIndex: 0, endIndex: totalCount };
        }
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeightPx) - OVERSCAN_ABOVE);
        const visibleCount = Math.ceil(containerHeight / rowHeightPx) + OVERSCAN_BELOW;
        const endIndex = Math.min(totalCount, startIndex + visibleCount);
        return { useVirtual, startIndex, endIndex };
    }, [totalCount, threshold, scrollTop, containerHeight, rowHeightPx]);

    return {
        useVirtual,
        startIndex,
        endIndex,
        rowHeightPx,
        handleScroll,
    };
}
