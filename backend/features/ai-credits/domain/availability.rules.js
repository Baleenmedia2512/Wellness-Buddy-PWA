/**
 * ai-credits availability windows — pure rules (no I/O).
 * Admin configures breakfast / lunch / dinner: enabled + custom start/end (IST).
 */
export const MEAL_SLOT_KEYS = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const DEFAULT_AVAILABILITY_WINDOWS = Object.freeze({
  breakfast: Object.freeze({ enabled: true, start: '05:30:00', end: '08:30:00' }),
  lunch: Object.freeze({ enabled: true, start: '12:00:00', end: '16:00:00' }),
  dinner: Object.freeze({ enabled: true, start: '17:30:00', end: '20:30:00' }),
});

/**
 * @param {string|null|undefined} hhmmss
 * @returns {number|null}
 */
export function timeStringToMinutes(hhmmss) {
  if (!hhmmss || typeof hhmmss !== 'string') return null;
  const parts = hhmmss.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m] = parts;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Normalize "HH:MM" or "HH:MM:SS" → "HH:MM:SS"
 * @param {string|null|undefined} value
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeTimeString(value, fallback = '00:00:00') {
  const minutes = timeStringToMinutes(value);
  if (minutes == null) {
    const fb = timeStringToMinutes(fallback);
    const safe = fb == null ? 0 : fb;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {number}
 */
export function getMinutesNowInTimezone(now = new Date(), timeZone = 'Asia/Kolkata') {
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
 * @param {number} nowMinutes
 * @param {{ start?: string, end?: string }|null|undefined} window
 * @returns {boolean}
 */
export function isWithinWindowMinutes(nowMinutes, window) {
  if (!window?.start || !window?.end) return false;
  const startMin = timeStringToMinutes(window.start);
  const endMin = timeStringToMinutes(window.end);
  if (startMin == null || endMin == null) return false;
  if (startMin > endMin) return false;
  return nowMinutes >= startMin && nowMinutes <= endMin;
}

/**
 * Normalize raw admin payload / DB JSON → full availability windows.
 * @param {object|null|undefined} raw
 * @returns {{
 *   breakfast: { enabled: boolean, start: string, end: string },
 *   lunch: { enabled: boolean, start: string, end: string },
 *   dinner: { enabled: boolean, start: string, end: string },
 * }}
 */
export function normalizeAvailabilityWindows(raw = null) {
  const out = {};
  for (const key of MEAL_SLOT_KEYS) {
    const def = DEFAULT_AVAILABILITY_WINDOWS[key];
    const src = raw && typeof raw === 'object' ? raw[key] : null;
    let start = normalizeTimeString(src?.start, def.start);
    let end = normalizeTimeString(src?.end, def.end);
    const startMin = timeStringToMinutes(start);
    const endMin = timeStringToMinutes(end);
    if (startMin != null && endMin != null && startMin > endMin) {
      // Invalid range — keep defaults for this slot.
      start = def.start;
      end = def.end;
    }
    out[key] = {
      enabled: src?.enabled === undefined ? def.enabled : Boolean(src.enabled),
      start,
      end,
    };
  }
  return out;
}

/**
 * @param {number} nowMinutes
 * @param {ReturnType<typeof normalizeAvailabilityWindows>} windows
 * @returns {'breakfast'|'lunch'|'dinner'|null}
 */
export function activeEnabledMealSlot(nowMinutes, windows) {
  for (const key of MEAL_SLOT_KEYS) {
    const slot = windows?.[key];
    if (!slot?.enabled) continue;
    if (isWithinWindowMinutes(nowMinutes, slot)) return key;
  }
  return null;
}

/**
 * Evaluate whether AI may run now under admin availability windows.
 * @param {{
 *   now?: Date,
 *   timezoneIana?: string,
 *   availabilityWindows?: object|null,
 * }} [opts]
 */
export function evaluateAiAvailability({
  now = new Date(),
  timezoneIana = 'Asia/Kolkata',
  availabilityWindows = null,
} = {}) {
  const windows = normalizeAvailabilityWindows(availabilityWindows);
  const nowMinutes = getMinutesNowInTimezone(now, timezoneIana || 'Asia/Kolkata');
  const active = activeEnabledMealSlot(nowMinutes, windows);
  const anyEnabled = MEAL_SLOT_KEYS.some((k) => windows[k].enabled);
  return {
    availableInWindow: Boolean(active),
    activeMealWindow: active,
    availabilityWindows: windows,
    anySlotEnabled: anyEnabled,
  };
}

/**
 * @param {object|null|undefined} rawWindows
 * @returns {boolean}
 */
export function hasAnyAvailabilitySlotEnabled(rawWindows) {
  const windows = normalizeAvailabilityWindows(rawWindows);
  return MEAL_SLOT_KEYS.some((k) => windows[k].enabled);
}
