/**
 * lunchAutoAi.rules.js
 * Pure policy: during lunch window + AI credits remaining → auto-run AI
 * (no Auto Detect button). Outside lunch or out of credits → manual only.
 */
import { APP_TIMEZONE } from '../../../shared/constants/timeWindows.js';
import { getAiCreditUiState } from './creditUiState.js';

/** Default lunch window when API windows are missing (IST). */
export const DEFAULT_LUNCH_WINDOW = Object.freeze({
  start: '12:00:00',
  end: '16:00:00',
});

/**
 * @param {string|null|undefined} hhmmss - "HH:MM:SS" or "HH:MM"
 * @returns {number|null} minutes since midnight
 */
export function timeStringToMinutes(hhmmss) {
  if (!hhmmss || typeof hhmmss !== 'string') return null;
  const parts = hhmmss.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m] = parts;
  return h * 60 + m;
}

/**
 * Current clock minutes in a business timezone (default IST).
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {number}
 */
export function getMinutesNowInTimezone(now = new Date(), timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now instanceof Date ? now : new Date(now));

  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

/**
 * Inclusive start/end window check (same convention as App openBestManualModal).
 * @param {Date} now
 * @param {{ start?: string, end?: string }|null|undefined} window
 * @param {string} [timeZone]
 * @returns {boolean}
 */
export function isWithinActivityWindow(now, window, timeZone = APP_TIMEZONE) {
  if (!window?.start || !window?.end) return false;
  const startMin = timeStringToMinutes(window.start);
  const endMin = timeStringToMinutes(window.end);
  if (startMin == null || endMin == null) return false;
  const nowMin = getMinutesNowInTimezone(now, timeZone);
  return nowMin >= startMin && nowMin <= endMin;
}

/**
 * Decide post-capture behaviour for lunch auto-AI.
 *
 * @param {{
 *   now?: Date,
 *   lunchWindow?: { start?: string, end?: string }|null,
 *   creditStatus?: object|null,
 *   creditsFlagEnabled?: boolean,
 *   timezoneIana?: string,
 * }} opts
 * @returns {{ shouldAutoAi: boolean, hideAiButton: boolean, reason: string }}
 */
export function decideLunchAutoAi({
  now = new Date(),
  lunchWindow = null,
  creditStatus = null,
  creditsFlagEnabled = false,
  timezoneIana = APP_TIMEZONE,
} = {}) {
  // Product: never show Auto Detect — lunch auto or manual only.
  const hideAiButton = true;

  if (!creditsFlagEnabled) {
    return { shouldAutoAi: false, hideAiButton, reason: 'credits-flag-off' };
  }

  const window = lunchWindow?.start && lunchWindow?.end
    ? lunchWindow
    : DEFAULT_LUNCH_WINDOW;

  if (!isWithinActivityWindow(now, window, timezoneIana)) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-lunch' };
  }

  const ui = getAiCreditUiState(creditStatus);
  if (ui.phase === 'disabled') {
    return { shouldAutoAi: false, hideAiButton, reason: 'ai-disabled' };
  }
  if (ui.phase === 'exhausted') {
    return { shouldAutoAi: false, hideAiButton, reason: 'exhausted' };
  }
  if (ui.phase === 'busy') {
    return { shouldAutoAi: false, hideAiButton, reason: 'busy' };
  }
  if (ui.phase !== 'available' || ui.remaining <= 0) {
    return { shouldAutoAi: false, hideAiButton, reason: 'no-credits' };
  }

  return { shouldAutoAi: true, hideAiButton, reason: 'lunch-auto' };
}
