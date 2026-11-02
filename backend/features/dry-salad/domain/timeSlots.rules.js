/**
 * Dry-salad intake slots: morning / afternoon / evening / night.
 * Pure domain — inject time-of-day (HH:mm:ss). No Date.now().
 */

export const DRY_SALAD_SLOTS = Object.freeze(['morning', 'afternoon', 'evening', 'night']);

export const DRY_SALAD_SLOT_LABELS = Object.freeze({
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
});

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeDrySaladSlot(value) {
  const slot = String(value || '').trim().toLowerCase();
  return DRY_SALAD_SLOTS.includes(slot) ? slot : null;
}

/**
 * Map wall-clock time-of-day to a dry-salad slot.
 * morning 05:00–11:59 · afternoon 12:00–15:59 · evening 16:00–19:59 · night 20:00–04:59
 *
 * Current slot uses the owner's profile zone (device timezone after lookup).
 * Past meals use the IST hour they were logged — do not re-slot history
 * when the device timezone changes.
 *
 * @param {string} timeOfDay `HH:mm:ss` or `HH:mm`
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
/**
 * @param {number} hour 0–23
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function slotFromHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) return 'morning';
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'afternoon';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

export function slotFromTimeOfDay(timeOfDay) {
  const hour = parseInt(String(timeOfDay || '').slice(0, 2), 10);
  return slotFromHour(hour);
}
