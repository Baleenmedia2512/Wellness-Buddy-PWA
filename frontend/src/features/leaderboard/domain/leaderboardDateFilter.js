/**
 * Home Top 10 tiles — IST date filter presets + custom range (max 30 days).
 * Shared by Wellness Score and Weight Loss.
 */
import {
  DEFAULT_BUSINESS_TIMEZONE,
  addCalendarDaysYmd,
  formatCalendarPickerDate,
  formatPickerDayButtonLabel,
  todayBusinessDate,
  ymdToPickerDate,
} from '../../../shared/utils/datetimeUtils.js';
import { formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges.js';

/** Preset length for "Last 10 Days". */
export const LB_LAST_10_DAYS = 10;

/** Inclusive custom-range / API window cap. */
export const LB_MAX_WINDOW_DAYS = 30;

export const LB_DATE_PRESETS = Object.freeze({
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_10: 'last10days',
  CUSTOM: 'custom',
});

export const LB_DATE_FILTER_OPTIONS = Object.freeze([
  { value: LB_DATE_PRESETS.TODAY, label: 'Today' },
  { value: LB_DATE_PRESETS.YESTERDAY, label: 'Yesterday' },
  { value: LB_DATE_PRESETS.LAST_10, label: 'Last 10 Days' },
  { value: LB_DATE_PRESETS.CUSTOM, label: 'Custom' },
]);

/**
 * Inclusive calendar-day count between two YYYY-MM-DD keys (IST business dates).
 * @param {string} startYmd
 * @param {string} endYmd
 * @returns {number} 0 when invalid
 */
export function inclusiveYmdSpanDays(startYmd, endYmd) {
  if (
    typeof startYmd !== 'string'
    || typeof endYmd !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)
    || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)
  ) {
    return 0;
  }
  const start = Date.parse(`${startYmd}T12:00:00Z`);
  const end = Date.parse(`${endYmd}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

/**
 * @param {string} preset
 * @param {Date|null} [customStart]
 * @param {Date|null} [customEnd]
 * @param {Date} [now]
 * @param {string} [timezoneIana]
 * @param {{ todaySubtitle?: string, todayButtonLabel?: string }} [labels]
 * @returns {{
 *   ok: true,
 *   preset: string,
 *   days: number,
 *   dateYmd: string|null,
 *   startYmd: string|null,
 *   endYmd: string|null,
 *   buttonLabel: string,
 *   subtitle: string,
 * } | { ok: false, error: 'range_too_long'|'invalid_range' }}
 */
export function resolveLbDateFilter(
  preset,
  customStart = null,
  customEnd = null,
  now = new Date(),
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  labels = {},
) {
  const todayYmd = todayBusinessDate(timezoneIana, now);
  const todaySubtitle = labels.todaySubtitle || "Today's ranking";
  const todayButtonLabel = labels.todayButtonLabel || 'Today';

  if (preset === LB_DATE_PRESETS.TODAY) {
    return {
      ok: true,
      preset,
      days: 1,
      dateYmd: null,
      startYmd: todayYmd,
      endYmd: todayYmd,
      buttonLabel: todayButtonLabel,
      subtitle: todaySubtitle,
    };
  }

  if (preset === LB_DATE_PRESETS.YESTERDAY) {
    const yesterdayYmd = addCalendarDaysYmd(todayYmd, -1);
    return {
      ok: true,
      preset,
      days: 1,
      dateYmd: yesterdayYmd,
      startYmd: yesterdayYmd,
      endYmd: yesterdayYmd,
      buttonLabel: 'Yesterday',
      subtitle: 'Yesterday',
    };
  }

  if (preset === LB_DATE_PRESETS.LAST_10) {
    return {
      ok: true,
      preset,
      days: LB_LAST_10_DAYS,
      dateYmd: null,
      startYmd: addCalendarDaysYmd(todayYmd, -(LB_LAST_10_DAYS - 1)),
      endYmd: todayYmd,
      buttonLabel: 'Last 10 Days',
      subtitle: 'Last 10 days',
    };
  }

  if (preset === LB_DATE_PRESETS.CUSTOM) {
    const startYmd = formatCalendarPickerDate(customStart);
    const endYmd = formatCalendarPickerDate(customEnd || customStart);
    if (!startYmd || !endYmd) {
      return { ok: false, error: 'invalid_range' };
    }
    const orderedStart = startYmd <= endYmd ? startYmd : endYmd;
    const orderedEnd = startYmd <= endYmd ? endYmd : startYmd;
    const span = inclusiveYmdSpanDays(orderedStart, orderedEnd);
    if (span < 1) return { ok: false, error: 'invalid_range' };
    // 11–12+ day spans must not show (cap matches backend window).
    if (span > LB_MAX_WINDOW_DAYS) {
      return { ok: false, error: 'range_too_long' };
    }

    const startDate = ymdToPickerDate(orderedStart);
    const endDate = ymdToPickerDate(orderedEnd);
    const buttonLabel = span === 1
      ? formatPickerDayButtonLabel(startDate, timezoneIana, now)
      : formatCustomRangeLabel(startDate, endDate);

    return {
      ok: true,
      preset,
      days: span,
      dateYmd: orderedEnd,
      startYmd: orderedStart,
      endYmd: orderedEnd,
      buttonLabel,
      subtitle: buttonLabel,
    };
  }

  return { ok: false, error: 'invalid_range' };
}
