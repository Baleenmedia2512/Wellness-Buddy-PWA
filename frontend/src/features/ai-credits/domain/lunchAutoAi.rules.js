/**
 * lunchAutoAi.rules.js
 * Pure policy: during an admin-enabled meal window + AI credits remaining
 * + eligible leaf downline → auto-run AI. Outside windows, ineligible, or
 * out of credits → manual only.
 *
 * Prefer status.availabilityWindows from GET /api/ai-credits/status.
 * Also honour backend access facts (eligibleForAiFoodAnalysis / window flags).
 */
import { APP_TIMEZONE } from '../../../shared/constants/timeWindows.js';
import { getAiCreditUiState } from './creditUiState.js';

export const DEFAULT_BREAKFAST_WINDOW = Object.freeze({
  enabled: true,
  start: '05:30:00',
  end: '08:30:00',
});
export const DEFAULT_LUNCH_WINDOW = Object.freeze({
  enabled: true,
  start: '12:00:00',
  end: '16:00:00',
});
export const DEFAULT_DINNER_WINDOW = Object.freeze({
  enabled: true,
  start: '17:30:00',
  end: '20:30:00',
});

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

/**
 * @param {string|null|undefined} hhmmss
 * @returns {number|null}
 */
export function timeStringToMinutes(hhmmss) {
  if (!hhmmss || typeof hhmmss !== 'string') return null;
  const parts = hhmmss.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m] = parts;
  return h * 60 + m;
}

/**
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
 * True when now falls in any enabled meal slot (admin availability windows).
 * @param {Date} now
 * @param {object|null|undefined} availabilityWindows
 * @param {string} [timeZone]
 */
export function isWithinEnabledAiWindow(now, availabilityWindows, timeZone = APP_TIMEZONE) {
  const defaults = {
    breakfast: DEFAULT_BREAKFAST_WINDOW,
    lunch: DEFAULT_LUNCH_WINDOW,
    dinner: DEFAULT_DINNER_WINDOW,
  };
  for (const key of MEAL_KEYS) {
    const slot = availabilityWindows?.[key] || defaults[key];
    const enabled = slot?.enabled !== false;
    if (!enabled) continue;
    if (isWithinActivityWindow(now, slot, timeZone)) return true;
  }
  return false;
}

/**
 * True when now is inside lunch or dinner (configured or defaults).
 * Legacy helper — prefer isWithinEnabledAiWindow when admin windows exist.
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
 * Decide post-capture / Food-tap auto-AI behaviour.
 *
 * @param {{
 *   now?: Date,
 *   availabilityWindows?: object|null,
 *   lunchWindow?: { start?: string, end?: string }|null,
 *   dinnerWindow?: { start?: string, end?: string }|null,
 *   creditStatus?: object|null,
 *   creditsFlagEnabled?: boolean,
 *   timezoneIana?: string,
 * }} opts
 * @returns {{ shouldAutoAi: boolean, hideAiButton: boolean, reason: string }}
 */
export function decideMealWindowAutoAi({
  now = new Date(),
  availabilityWindows = null,
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

  // Prefer server status windows; fall back to arg / lunch+dinner legacy.
  const windows = creditStatus?.availabilityWindows
    || availabilityWindows
    || (lunchWindow || dinnerWindow
      ? {
          lunch: lunchWindow
            ? { enabled: true, ...lunchWindow }
            : DEFAULT_LUNCH_WINDOW,
          dinner: dinnerWindow
            ? { enabled: true, ...dinnerWindow }
            : DEFAULT_DINNER_WINDOW,
        }
      : null);

  if (creditStatus && creditStatus.availableInWindow === false) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
  }

  if (windows) {
    if (!isWithinEnabledAiWindow(now, windows, timezoneIana)) {
      return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
    }
  } else if (!isWithinLunchOrDinnerWindow(now, lunchWindow, dinnerWindow, timezoneIana)) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
  }

  const ui = getAiCreditUiState(creditStatus);
  if (ui.phase === 'disabled') {
    return { shouldAutoAi: false, hideAiButton, reason: 'ai-disabled' };
  }
  if (ui.phase === 'outside_window') {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
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

/** @deprecated Use decideMealWindowAutoAi */
export function decideLunchAutoAi(opts) {
  return decideMealWindowAutoAi(opts);
}
