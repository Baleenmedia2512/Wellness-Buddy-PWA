/**
 * WhatsApp caption extras for the marathon / Detox day sequence.
 *
 * Current-day activity copy is owned by the share composers. This module
 * appends "Tomorrow is Day N+1" on every in-marathon day except the last.
 * The last day (Day 10) still gets the current Day 10 line. Eve-of-Day-0
 * uses getMarathonCalendarState().showMarathonStartReminder.
 *
 * Add future special labels to MARATHON_WHATSAPP_ADVANCE_SPECIALS
 * (or DETOX_MARATHON_DAYS for more Detox Days).
 */
import {
  DETOX_MARATHON_DAYS,
  MARATHON_LAST_DAY_INDEX,
  getMarathonCalendarState,
} from './marathonCalendar.js';

export const MARATHON_START_WHATSAPP_LABEL = 'Marathon Starts';
export const DETOX_DAY_WHATSAPP_LABEL = 'Detox Day';

/**
 * Special days announced in WhatsApp one day early.
 * Detox entries stay in sync with DETOX_MARATHON_DAYS.
 * Day 1 has no extra label: "Tomorrow is Day 1".
 * @type {ReadonlyArray<{ day: number, label: string, kind: 'marathon-start'|'detox'|'day'|string }>}
 */
export const MARATHON_WHATSAPP_ADVANCE_SPECIALS = Object.freeze([
  { day: 0, label: MARATHON_START_WHATSAPP_LABEL, kind: 'marathon-start' },
  { day: 1, label: '', kind: 'day' },
  ...DETOX_MARATHON_DAYS.map((day) => ({
    day,
    label: DETOX_DAY_WHATSAPP_LABEL,
    kind: 'detox',
  })),
]);

/**
 * @param {number} day
 * @param {string} [label]
 * @returns {string}
 */
export function formatMarathonWhatsAppAdvanceNotice(day, label) {
  const cleanLabel = typeof label === 'string' ? label.trim() : '';
  return cleanLabel
    ? `Tomorrow is Day ${day} - ${cleanLabel}`
    : `Tomorrow is Day ${day}`;
}

/**
 * @param {number} day
 * @param {string|null} [label]
 * @returns {string}
 */
export function formatMarathonWhatsAppCurrentDayNotice(day, label = null) {
  const cleanLabel = typeof label === 'string' ? label.trim() : '';
  return cleanLabel ? `Day ${day} - ${cleanLabel}` : `Day ${day}`;
}

/**
 * Current-day marathon sequence copy for WhatsApp, or null when today is
 * outside the marathon.
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {string|null}
 */
export function getMarathonWhatsAppCurrentDayNotice(ymd) {
  const state = getMarathonCalendarState(ymd);
  if (!state.inMarathon || !Number.isInteger(state.marathonDay)) return null;

  const special = MARATHON_WHATSAPP_ADVANCE_SPECIALS.find(
    (item) => item.day === state.marathonDay,
  );
  return formatMarathonWhatsAppCurrentDayNotice(
    state.marathonDay,
    special?.label || null,
  );
}

/**
 * Next-day copy for WhatsApp, or null when there is no tomorrow in-sequence.
 * Reuses marathon calendar state; does not replace current-day captions.
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {string|null}
 */
export function getMarathonWhatsAppAdvanceNotice(ymd) {
  const state = getMarathonCalendarState(ymd);

  if (state.showMarathonStartReminder) {
    const start = MARATHON_WHATSAPP_ADVANCE_SPECIALS.find(
      (special) => special.kind === 'marathon-start',
    );
    return start
      ? formatMarathonWhatsAppAdvanceNotice(start.day, start.label)
      : null;
  }

  if (!state.inMarathon || !Number.isInteger(state.marathonDay)) return null;

  const tomorrow = state.marathonDay + 1;
  if (tomorrow > MARATHON_LAST_DAY_INDEX) return null;

  const special = MARATHON_WHATSAPP_ADVANCE_SPECIALS.find(
    (item) => item.kind !== 'marathon-start' && item.day === tomorrow,
  );
  return formatMarathonWhatsAppAdvanceNotice(tomorrow, special?.label || '');
}

/**
 * Append current marathon day and optional tomorrow notice (comma or newline).
 * Append the tomorrow notice when there is one; otherwise the current Day N
 * line (Day 10 / off-sequence). Will not duplicate an existing notice.
 *
 * @param {unknown} caption
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {string}
 */
export function appendMarathonWhatsAppNotice(caption, ymd) {
  const notice = getMarathonWhatsAppAdvanceNotice(ymd);
  const currentDay = notice ? null : getMarathonWhatsAppCurrentDayNotice(ymd);
  const base = String(caption || '').trim();
  const additions = [];

  if (currentDay && !base.includes(currentDay)) additions.push(currentDay);
  if (notice && !base.includes(notice)) additions.push(notice);

  if (additions.length === 0) return base;
  if (!base) return additions.join('\n');

  const separator = base.includes('\n') ? '\n' : ', ';
  return `${base}${separator}${additions.join(separator)}`;
}
