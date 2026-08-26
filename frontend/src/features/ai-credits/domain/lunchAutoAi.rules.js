/**
 * lunchAutoAi.rules.js
 * Pure policy: during lunch or dinner window + AI credits remaining + eligible
 * leaf downline → auto-run AI (no Auto Detect button). Otherwise → manual only.
 */
import { APP_TIMEZONE } from '../../../shared/constants/timeWindows.js';
import { getAiCreditUiState } from './creditUiState.js';

/** Default lunch window when API windows are missing (IST). */
export const DEFAULT_LUNCH_WINDOW = Object.freeze({
  start: '12:00:00',
  end: '16:00:00',
});

/** Default dinner window when API windows are missing (IST). */
export const DEFAULT_DINNER_WINDOW = Object.freeze({
  start: '17:30:00',
  end: '20:30:00',
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
 * True when now is inside lunch or dinner (configured or defaults).
 * @param {Date} now
 * @param {{ start?: string, end?: string }|null|undefined} lunchWindow
 * @param {{ start?: string, end?: string }|null|undefined} dinnerWindow
 * @param {string} [timeZone]
 * @returns {boolean}
 */
export function isWithinLunchOrDinnerWindow(
  now,
  lunchWindow = null,
  dinnerWindow = null,
  timeZone = APP_TIMEZONE,
) {
  const lunch = lunchWindow?.start && lunchWindow?.end
    ? lunchWindow
    : DEFAULT_LUNCH_WINDOW;
  const dinner = dinnerWindow?.start && dinnerWindow?.end
    ? dinnerWindow
    : DEFAULT_DINNER_WINDOW;
  return (
    isWithinActivityWindow(now, lunch, timeZone)
    || isWithinActivityWindow(now, dinner, timeZone)
  );
}

/**
 * Decide post-capture behaviour for meal-window auto-AI.
 *
 * @param {{
 *   now?: Date,
 *   lunchWindow?: { start?: string, end?: string }|null,
 *   dinnerWindow?: { start?: string, end?: string }|null,
 *   creditStatus?: object|null,
 *   creditsFlagEnabled?: boolean,
 *   timezoneIana?: string,
 * }} opts
 * @returns {{ shouldAutoAi: boolean, hideAiButton: boolean, reason: string }}
 */
export function decideLunchAutoAi({
  now = new Date(),
  lunchWindow = null,
  dinnerWindow = null,
  creditStatus = null,
  creditsFlagEnabled = false,
  timezoneIana = APP_TIMEZONE,
} = {}) {
  // Product: never show Auto Detect — meal-window auto or manual only.
  const hideAiButton = true;

  if (!creditsFlagEnabled) {
    return { shouldAutoAi: false, hideAiButton, reason: 'credits-flag-off' };
  }

  // Backend access facts (leaf downline + window). When present, honour them.
  if (creditStatus && creditStatus.eligibleForAiFoodAnalysis === false) {
    return { shouldAutoAi: false, hideAiButton, reason: 'not-eligible-downline' };
  }
  if (creditStatus && creditStatus.aiFoodAnalysisWindowOpen === false) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
  }
  if (creditStatus && creditStatus.aiFoodAnalysisAllowed === false) {
    return {
      shouldAutoAi: false,
      hideAiButton,
      reason: creditStatus.aiFoodAnalysisDenyReason || 'access-denied',
    };
  }

  if (!isWithinLunchOrDinnerWindow(now, lunchWindow, dinnerWindow, timezoneIana)) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
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

  return { shouldAutoAi: true, hideAiButton, reason: 'meal-auto' };
}
