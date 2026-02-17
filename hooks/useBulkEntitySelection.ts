import { useState, useCallback } from 'react';

/**
 * Hook for bulk selection of entity IDs (e.g. in Knowledge Base).
 * Tracks selected IDs, toggle single, select/deselect all in view, clear.
 */
export function useBulkEntitySelection() {
    const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());

    const toggleEntitySelection = useCallback((entityId: string) => {
        setSelectedEntityIds((prev) => {
            const next = new Set(prev);
            if (next.has(entityId)) next.delete(entityId);
            else next.add(entityId);
            return next;
        });
    }, []);

    const selectAllInView = useCallback((entityIds: string[]) => {
        setSelectedEntityIds((prev) => {
            const allSelected = entityIds.length > 0 && entityIds.every((id) => prev.has(id));
            return allSelected ? new Set() : new Set(entityIds);
        });
    }, []);

    const clearSelection = useCallback(() => setSelectedEntityIds(new Set()), []);

    const isSelected = useCallback(
        (id: string) => selectedEntityIds.has(id),
        [selectedEntityIds]
    );

    const allInViewSelected = useCallback(
        (entityIds: string[]) =>
            entityIds.length > 0 && entityIds.every((id) => selectedEntityIds.has(id)),
        [selectedEntityIds]
    );

    return {
        selectedEntityIds,
        setSelectedEntityIds,
        toggleEntitySelection,
        selectAllInView,
        clearSelection,
        isSelected,
        allInViewSelected,
    };
}
