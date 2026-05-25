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

/**
 * Returns the actual { from: Date, to: Date } bounds for a given time range.
 * Both dates are midnight-normalised. Returns null fields for 'all'.
 */
export const getDateRangeBounds = (timeRange, customStartDate, customEndDate) => {
  if (timeRange === 'custom' && customStartDate && customEndDate) {
    return { from: customStartDate, to: customEndDate };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (timeRange === 'today') {
    return { from: today, to: today };
  }
  if (timeRange === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: y, to: y };
  }
  if (timeRange === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from, to: today };
  }
  if (timeRange === 'month') {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from, to: today };
  }
  return { from: null, to: null };
};
