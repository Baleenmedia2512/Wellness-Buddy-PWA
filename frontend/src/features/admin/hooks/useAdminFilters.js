/**
 * useAdminFilters.js — time range + search + sort state.
 *
 * Single hook owning every filter the dashboard needs so the orchestrator
 * doesn't sprout 7 useStates.
 */
import { useState, useCallback } from 'react';

export default function useAdminFilters() {
  const [timeRange, setTimeRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('totalCost');
  const [sortDirection, setSortDirection] = useState('desc');

  const selectTimeRange = useCallback((range) => {
    setTimeRange(range);
    setCustomStartDate(null);
    setCustomEndDate(null);
    setShowDatePicker(false);
  }, []);

  const selectCustomRange = useCallback((start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setTimeRange('custom');
    setShowDatePicker(false);
  }, []);

  const handleSort = useCallback((field) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  return {
    timeRange, customStartDate, customEndDate, showDatePicker,
    searchQuery, sortField, sortDirection,
    setSearchQuery, setShowDatePicker,
    selectTimeRange, selectCustomRange, handleSort,
  };
}
