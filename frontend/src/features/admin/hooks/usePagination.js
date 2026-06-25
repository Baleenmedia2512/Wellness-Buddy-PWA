/**
 * usePagination.js — generic 1-based pagination over a list.
 *
 * Auto-resets to page 1 whenever the input list reference changes
 * (useful after filter / sort).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';

export default function usePagination(items, initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);

  useEffect(() => { setCurrentPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  );

  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setCurrentPage((p) => Math.min(totalPages, p + 1)), [totalPages]);
  const goPage = useCallback((p) => setCurrentPage(p), []);
  const changePageSize = useCallback((size) => { setItemsPerPage(size); setCurrentPage(1); }, []);

  return {
    currentPage, itemsPerPage, totalPages, startIndex, endIndex,
    paginatedItems, goPrev, goNext, goPage, changePageSize,
  };
}
