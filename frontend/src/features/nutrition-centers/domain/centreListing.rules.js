/**
 * Client copy of centre hours and facilities.
 * Keep catalogs aligned with backend/features/nutrition-centers/domain/centreListing.rules.js.
 */

export const CENTRE_WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const CENTRE_WEEKDAY_LABELS = Object.freeze({
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
});

export const CENTRE_FACILITIES = Object.freeze([
  { id: 'parking', label: 'Parking' },
  { id: 'ac', label: 'AC' },
  { id: 'drinking_water', label: 'Drinking water' },
  { id: 'washroom', label: 'Washroom' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'seating', label: 'Seating' },
]);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(value) {
  const match = TIME_RE.exec(String(value || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function defaultOpeningHours() {
  const openSlots = [
    { open: '05:30', close: '13:00' },
    { open: '17:00', close: '21:30' },
  ];
  const hours = {};
  for (const day of CENTRE_WEEKDAYS) {
    hours[day] = day === 'sunday'
      ? { closed: true, slots: [] }
      : { closed: false, slots: openSlots.map((slot) => ({ ...slot })) };
  }
  return hours;
}

export function centreListingError(hours, facilities) {
  if (!hours || typeof hours !== 'object') return 'Opening hours are required';
  let openDays = 0;
  for (const day of CENTRE_WEEKDAYS) {
    const entry = hours[day];
    const label = CENTRE_WEEKDAY_LABELS[day];
    if (!entry) return `Add opening hours for ${label}`;
    if (entry.closed) continue;
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    if (slots.length < 1 || slots.length > 2) return `${label} needs one or two open-to-close times`;
    const ranges = [];
    for (const slot of slots) {
      const openMin = minutes(slot.open);
      const closeMin = minutes(slot.close);
      if (openMin == null || closeMin == null || openMin >= closeMin) {
        return `${label} close time must be after open time`;
      }
      ranges.push({ openMin, closeMin });
    }
    if (ranges.length === 2 && ranges[1].openMin < ranges[0].closeMin) {
      return `${label} second time slot must start after the first one ends`;
    }
    openDays += 1;
  }
  if (openDays < 1) return 'At least one day must be open';
  if (!Array.isArray(facilities) || facilities.length < 1) return 'Select at least one facility';
  return null;
}

export function seatingCountError(value) {
  if (value == null || String(value).trim() === '') return null;
  if (!/^\d+$/.test(String(value).trim())) return 'No. of seating must be a whole number';
  if (Number(value) > 999) return 'No. of seating cannot be more than 999';
  return null;
}

/** Today first, then the rest of the week. Uses IST. */
export function centreDaysFromToday(now = new Date()) {
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const jsDay = ist.getUTCDay();
  const byJs = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = byJs[jsDay];
  const start = CENTRE_WEEKDAYS.indexOf(today);
  if (start < 0) return [...CENTRE_WEEKDAYS];
  return [...CENTRE_WEEKDAYS.slice(start), ...CENTRE_WEEKDAYS.slice(0, start)];
}
