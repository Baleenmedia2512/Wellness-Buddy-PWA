/**
 * lunchAutoAi.rules.js
 * Pure policy: during an admin-enabled meal window + AI credits remaining
 * → auto-run AI. Outside windows or out of credits → manual only.
 *
 * Prefer status.availabilityWindows from GET /api/ai-credits/status.
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
 * True when now falls in any enabled meal slot.
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
 * Decide post-capture auto-AI behaviour.
 *
 * @param {{
 *   now?: Date,
 *   availabilityWindows?: object|null,
 *   lunchWindow?: { start?: string, end?: string }|null,
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
  creditStatus = null,
  creditsFlagEnabled = false,
  timezoneIana = APP_TIMEZONE,
} = {}) {
  const hideAiButton = true;

  if (!creditsFlagEnabled) {
    return { shouldAutoAi: false, hideAiButton, reason: 'credits-flag-off' };
  }

  // Prefer server status windows; fall back to arg / lunch-only legacy.
  const windows = creditStatus?.availabilityWindows
    || availabilityWindows
    || (lunchWindow ? { lunch: { enabled: true, ...lunchWindow } } : null);

  if (creditStatus && creditStatus.availableInWindow === false) {
    return { shouldAutoAi: false, hideAiButton, reason: 'outside-meal-window' };
  }

  if (!isWithinEnabledAiWindow(now, windows, timezoneIana)) {
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
