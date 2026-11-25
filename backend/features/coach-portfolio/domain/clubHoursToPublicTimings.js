/**
 * Map club opening_hours_json → public portfolio Contact timings.
 */
import {
  CENTRE_WEEKDAYS,
  CENTRE_WEEKDAY_LABELS,
} from '../../nutrition-centers/domain/centreListing.rules.js';

/**
 * @param {unknown} openingHours
 * @returns {{
 *   workingDays: string[],
 *   openingTime: string,
 *   closingTime: string,
 * }}
 */
export function clubHoursToPublicTimings(openingHours) {
  const workingDays = [];
  let openingTime = '';
  let closingTime = '';

  if (!openingHours || typeof openingHours !== 'object' || Array.isArray(openingHours)) {
    return { workingDays, openingTime, closingTime };
  }

  for (const day of CENTRE_WEEKDAYS) {
    const entry = openingHours[day];
    if (!entry || entry.closed) continue;
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    const first = slots.find((slot) => String(slot?.open || '').trim() && String(slot?.close || '').trim());
    if (!first) continue;
    workingDays.push(CENTRE_WEEKDAY_LABELS[day] || day);
    if (!openingTime) {
      openingTime = String(first.open).trim();
      closingTime = String(first.close).trim();
    }
  }

  return { workingDays, openingTime, closingTime };
}
