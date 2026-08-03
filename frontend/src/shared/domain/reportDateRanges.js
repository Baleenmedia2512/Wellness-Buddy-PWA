/** Shared report date-range presets (Activity, Wellness Score, etc.). */

export const REPORT_DATE_RANGE_TODAY = Object.freeze({ value: 'today', label: 'Today' });
export const REPORT_DATE_RANGE_YESTERDAY = Object.freeze({ value: 'yesterday', label: 'Yesterday' });
export const REPORT_DATE_RANGE_LAST_7 = Object.freeze({ value: 'last7days', label: 'Last 7 Days' });
export const REPORT_DATE_RANGE_LAST_10 = Object.freeze({ value: 'last10days', label: 'Last 10 Days' });
export const REPORT_DATE_RANGE_LAST_30 = Object.freeze({ value: 'last30days', label: 'Last 30 Days' });
export const REPORT_DATE_RANGE_CUSTOM = Object.freeze({ value: 'custom', label: 'Custom Range' });

export const WELLNESS_SCORE_DATE_RANGES = Object.freeze([
  REPORT_DATE_RANGE_TODAY,
  REPORT_DATE_RANGE_YESTERDAY,
  REPORT_DATE_RANGE_LAST_10,
  REPORT_DATE_RANGE_CUSTOM,
]);

/** Home nutrition carousel — Last 10 Days instead of Last 7 Days. */
export const HOME_NUTRITION_DATE_RANGES = Object.freeze([
  REPORT_DATE_RANGE_TODAY,
  REPORT_DATE_RANGE_YESTERDAY,
  REPORT_DATE_RANGE_LAST_10,
  REPORT_DATE_RANGE_CUSTOM,
]);

export const ACTIVITY_REPORT_DATE_RANGES = Object.freeze([
  REPORT_DATE_RANGE_TODAY,
  REPORT_DATE_RANGE_YESTERDAY,
  Object.freeze({ value: 'custom', label: 'Custom' }),
]);

export function formatCustomRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return 'Select Dates';
  const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
