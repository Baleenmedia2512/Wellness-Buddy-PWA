/**
 * useAdminReports.js — derives reporting view-models from raw tokenData.
 *
 * Centralises filter→sort→summary derivations so the tabs stay
 * presentational. Returns the filtered+sorted user list, summary block
 * and a human-readable date-range label.
 */
import { useMemo } from 'react';
import { getDateRangeLabel } from '../services/dateRangeUtils';

export default function useAdminReports({ tokenData, searchQuery, sortField, sortDirection, timeRange, customStartDate, customEndDate }) {
  const summary = tokenData?.summary || {};
  const userSpending = tokenData?.userSpending || [];

  const filteredAndSortedUsers = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    const filtered = q
      ? userSpending.filter((u) =>
          u.userName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      : userSpending;

    const sorted = [...filtered].sort((a, b) => {
      let av = a[sortField];
      let bv = b[sortField];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (sortDirection === 'asc') return av > bv ? 1 : -1;
      return av < bv ? 1 : -1;
    });
    return sorted;
  }, [userSpending, searchQuery, sortField, sortDirection]);

  const dateRangeLabel = useMemo(
    () => getDateRangeLabel(timeRange, customStartDate, customEndDate),
    [timeRange, customStartDate, customEndDate],
  );

  return { summary, userSpending, filteredAndSortedUsers, dateRangeLabel };
}
