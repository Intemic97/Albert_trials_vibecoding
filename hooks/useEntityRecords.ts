/**
 * useEntityRecords Hook
 * 
 * Manages record state for an entity: fetching, CRUD, search, sort, pagination.
 * Designed to replace the inline record logic in App.tsx (~500 lines).
 * 
 * Usage:
 *   const records = useEntityRecords(activeEntityId, entity);
 *   records.search('temperature');
 *   records.sort('name', 'asc');
 *   records.setPage(2);
 *   records.addRecord(values);
 *   records.deleteRecord(recordId);
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { API_BASE } from '../config';

interface UseEntityRecordsOptions {
  pageSize?: number;
}

export function useEntityRecords(entityId: string | null, options: UseEntityRecordsOptions = {}) {
  const { pageSize = 25 } = options;

  // Core state
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Record<string, { op: string; value: string }>>({});

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ recordId: string; propId: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fetch records
  const fetchRecords = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/entities/${entityId}/records`, { credentials: 'include' });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityId]);

  // Auto-fetch on entity change
  useEffect(() => {
    if (entityId) {
      fetchRecords();
      // Reset table state
      setSearchQuery('');
      setSortKey(null);
      setPage(0);
      setFilters({});
      setEditingCell(null);
    }
  }, [entityId, fetchRecords]);

  // Filtered + sorted + paginated records
  const processedRecords = useMemo(() => {
    let result = [...records];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        Object.values(r.values || {}).some(v =>
          v && String(v).toLowerCase().includes(q)
        )
      );
    }

    // Advanced filters
    for (const [propId, filter] of Object.entries(filters)) {
      result = result.filter(r => {
        const v = r.values?.[propId];
        if (v === undefined || v === null) return false;
        const strV = String(v).toLowerCase();
        const numV = Number(v);
        const numF = Number(filter.value);
        switch (filter.op) {
          case 'contains': return strV.includes(filter.value.toLowerCase());
          case '=': return strV === filter.value.toLowerCase() || (!isNaN(numV) && !isNaN(numF) && numV === numF);
          case '!=': return strV !== filter.value.toLowerCase();
          case '>': return !isNaN(numV) && !isNaN(numF) && numV > numF;
          case '<': return !isNaN(numV) && !isNaN(numF) && numV < numF;
          case '>=': return !isNaN(numV) && !isNaN(numF) && numV >= numF;
          case '<=': return !isNaN(numV) && !isNaN(numF) && numV <= numF;
          default: return true;
        }
      });
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const va = a.values?.[sortKey] ?? '';
        const vb = b.values?.[sortKey] ?? '';
        const numA = Number(va);
        const numB = Number(vb);
        const cmp = (!isNaN(numA) && !isNaN(numB)) ? numA - numB : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [records, searchQuery, filters, sortKey, sortDir]);

  // Paginated slice
  const paginatedRecords = useMemo(() => {
    return processedRecords.slice(page * pageSize, (page + 1) * pageSize);
  }, [processedRecords, page, pageSize]);

  const totalPages = Math.ceil(processedRecords.length / pageSize);

  // CRUD operations
  const addRecord = useCallback(async (values: Record<string, any>) => {
    if (!entityId) return;
    try {
      const res = await fetch(`${API_BASE}/entities/${entityId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      if (res.ok) {
        await fetchRecords();
      }
    } catch (err) {
      console.error('Error adding record:', err);
    }
  }, [entityId, fetchRecords]);

  const updateRecord = useCallback(async (recordId: string, values: Record<string, any>) => {
    try {
      await fetch(`${API_BASE}/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
        credentials: 'include',
      });
      // Optimistic update
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, values: { ...r.values, ...values } } : r
      ));
    } catch (err) {
      console.error('Error updating record:', err);
    }
  }, []);

  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      await fetch(`${API_BASE}/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  }, []);

  const updateTags = useCallback(async (recordId: string, tags: string[]) => {
    try {
      await fetch(`${API_BASE}/records/${recordId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
        credentials: 'include',
      });
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, tags: JSON.stringify(tags) } : r
      ));
    } catch (err) {
      console.error('Error updating tags:', err);
    }
  }, []);

  return {
    // Data
    records,
    processedRecords,
    paginatedRecords,
    isLoading,
    error,
    totalPages,
    totalFiltered: processedRecords.length,

    // Table state
    searchQuery,
    setSearchQuery: (q: string) => { setSearchQuery(q); setPage(0); },
    sortKey,
    sortDir,
    toggleSort: (propId: string) => {
      if (sortKey === propId) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(propId);
        setSortDir('asc');
      }
    },
    page,
    setPage,
    filters,
    addFilter: (propId: string, op: string, value: string) => {
      setFilters(prev => ({ ...prev, [propId]: { op, value } }));
      setPage(0);
    },
    removeFilter: (propId: string) => {
      setFilters(prev => { const next = { ...prev }; delete next[propId]; return next; });
    },
    clearFilters: () => setFilters({}),

    // Inline editing
    editingCell,
    editValue,
    startEdit: (recordId: string, propId: string, currentValue: string) => {
      setEditingCell({ recordId, propId });
      setEditValue(currentValue);
    },
    setEditValue,
    commitEdit: async () => {
      if (!editingCell) return;
      await updateRecord(editingCell.recordId, { [editingCell.propId]: editValue });
      setEditingCell(null);
    },
    cancelEdit: () => setEditingCell(null),

    // CRUD
    addRecord,
    updateRecord,
    deleteRecord,
    updateTags,
    refresh: fetchRecords,
  };
}
