/**
 * dateRangeUtils.js — pure date helpers (no React).
 */
export const formatLocalDate = (date) => {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getDateRangeLabel = (timeRange, startDate, endDate) => {
  if (timeRange === 'custom' && startDate && endDate) {
    const opt = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', opt)} - ${endDate.toLocaleDateString('en-US', opt)}`;
  }
  return 'Custom Range';
};

export const TIME_RANGE_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  all: 'All',
};

export const TIME_RANGE_OPTIONS = ['today', 'yesterday', 'week', 'month', 'all'];
