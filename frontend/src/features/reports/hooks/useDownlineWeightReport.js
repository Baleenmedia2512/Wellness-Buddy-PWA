/**
 * useDownlineWeightReport.js — State and data fetching for the
 * Downline Weight Status report.
 *
 * Exposes:
 *   rows       — full sorted array from the API
 *   filter     — active status filter ('all'|'off_track'|'on_track'|'no_data')
 *   setFilter  — change active filter
 *   filtered   — rows after applying `filter`
 *   counts     — { above_ideal, below_ideal, on_track, no_data }
 *   loading    — true while the first fetch is in flight
 *   error      — string error message or null
 *   refresh    — function to re-fetch data
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchDownlineWeightStatus } from '../services/reportsApi.js';

const NO_DATA_STATUSES = new Set(['no_weight', 'no_height']);
const OFF_TRACK_STATUSES = new Set(['above_ideal', 'below_ideal']);

export function useDownlineWeightReport({ coachId }) {
  const [rows, setRows]       = useState([]);
  const [filter, setFilter]   = useState('off_track'); // default: show problem members
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDownlineWeightStatus(coachId);
      setRows(data);
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Derived counts
  const counts = rows.reduce(
    (acc, r) => {
      if (r.status === 'above_ideal') acc.above_ideal += 1;
      else if (r.status === 'below_ideal') acc.below_ideal += 1;
      else if (r.status === 'on_track') acc.on_track += 1;
      else acc.no_data += 1;
      return acc;
    },
    { above_ideal: 0, below_ideal: 0, on_track: 0, no_data: 0 },
  );

  // Filtered view
  const filtered = rows.filter((r) => {
    if (filter === 'all')       return true;
    if (filter === 'off_track') return OFF_TRACK_STATUSES.has(r.status);
    if (filter === 'on_track')  return r.status === 'on_track';
    if (filter === 'no_data')   return NO_DATA_STATUSES.has(r.status);
    return true;
  });

  return { rows, filter, setFilter, filtered, counts, loading, error, refresh: fetch };
}
