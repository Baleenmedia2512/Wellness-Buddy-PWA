/**
 * WhatsApp caption extras for the marathon / Detox day sequence.
 *
 * Current-day activity copy is owned by the share composers. This module
 * only appends the next special day, one calendar day in advance.
 *
 * Add future in-marathon specials to MARATHON_WHATSAPP_ADVANCE_SPECIALS
 * (or DETOX_MARATHON_DAYS for more Detox Days). Eve-of-Day-0 still uses
 * getMarathonCalendarState().showMarathonStartReminder.
 */
import {
  DETOX_MARATHON_DAYS,
  getMarathonCalendarState,
} from './marathonCalendar.js';

export const MARATHON_START_WHATSAPP_LABEL = 'Marathon Starts';
export const DETOX_DAY_WHATSAPP_LABEL = 'Detox Day';

/**
 * Special days announced in WhatsApp one day early.
 * Detox entries stay in sync with DETOX_MARATHON_DAYS.
 * @type {ReadonlyArray<{ day: number, label: string, kind: 'marathon-start'|'detox'|string }>}
 */
export const MARATHON_WHATSAPP_ADVANCE_SPECIALS = Object.freeze([
  { day: 0, label: MARATHON_START_WHATSAPP_LABEL, kind: 'marathon-start' },
  ...DETOX_MARATHON_DAYS.map((day) => ({
    day,
    label: DETOX_DAY_WHATSAPP_LABEL,
    kind: 'detox',
  })),
]);

/**
 * @param {number} day
 * @param {string} label
 * @returns {string}
 */
export function formatMarathonWhatsAppAdvanceNotice(day, label) {
  return `Tomorrow is Day ${day} - ${label}`;
}

/**
 * Next-day special copy for WhatsApp, or null when today is not an eve.
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

  const special = MARATHON_WHATSAPP_ADVANCE_SPECIALS.find(
    (item) => item.kind !== 'marathon-start' && item.day === state.marathonDay + 1,
  );
  if (!special) return null;
  return formatMarathonWhatsAppAdvanceNotice(special.day, special.label);
}

/**
 * Append the advance notice to an existing caption (comma or newline).
 * No-ops when there is no notice, and will not duplicate an existing notice.
 *
 * @param {unknown} caption
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {string}
 */
export function appendMarathonWhatsAppNotice(caption, ymd) {
  const notice = getMarathonWhatsAppAdvanceNotice(ymd);
  const base = String(caption || '').trim();
  if (!notice) return base;
  if (!base) return notice;
  if (base.includes(notice)) return base;
  const separator = base.includes('\n') ? '\n' : ', ';
  return `${base}${separator}${notice}`;
}
