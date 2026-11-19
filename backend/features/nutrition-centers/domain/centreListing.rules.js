/**
 * Opening hours and facilities on a nutrition centre.
 * Features are no longer collected. A request that still sends them is stored.
 * Same version rule as the centre code: below 3.5.7 and missing versions
 * may omit these fields. When they are sent, they are checked.
 */
import { requiresCentreProfile } from './centreProfile.rules.js';

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

export const CENTRE_FEATURES = Object.freeze([
  { id: 'weight_check', label: 'Weight check' },
  { id: 'nutrition_education', label: 'Nutrition education' },
  { id: 'counselling', label: 'Counselling' },
  { id: 'body_composition', label: 'Body composition' },
  { id: 'wellness_activity', label: 'Wellness activity' },
]);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(value) {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function cloneSlots(slots) {
  return slots.map((slot) => ({ open: slot.open, close: slot.close }));
}

/** Mon–Sat 5:30 am–1:00 pm and 5:00–9:30 pm. Sunday closed. */
export function defaultOpeningHours() {
  const openSlots = [
    { open: '05:30', close: '13:00' },
    { open: '17:00', close: '21:30' },
  ];
  const hours = {};
  for (const day of CENTRE_WEEKDAYS) {
    hours[day] = day === 'sunday'
      ? { closed: true, slots: [] }
      : { closed: false, slots: cloneSlots(openSlots) };
  }
  return hours;
}

/**
 * @param {unknown} raw
 * @returns {{ value?: object, error?: string }}
 */
export function normalizeOpeningHours(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Opening hours are required' };
  }
  const hours = {};
  let openDays = 0;
  for (const day of CENTRE_WEEKDAYS) {
    const entry = raw[day];
    const label = CENTRE_WEEKDAY_LABELS[day];
    if (!entry || typeof entry !== 'object') {
      return { error: `Add opening hours for ${label}` };
    }
    if (entry.closed === true) {
      hours[day] = { closed: true, slots: [] };
      continue;
    }
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    if (slots.length < 1 || slots.length > 2) {
      return { error: `${label} needs one or two open-to-close times` };
    }
    const normalized = [];
    for (const slot of slots) {
      const open = String(slot?.open || '').trim();
      const close = String(slot?.close || '').trim();
      const openMin = minutes(open);
      const closeMin = minutes(close);
      if (openMin == null || closeMin == null || openMin >= closeMin) {
        return { error: `${label} close time must be after open time` };
      }
      normalized.push({ open, close });
    }
    if (normalized.length === 2 && minutes(normalized[1].open) < minutes(normalized[0].close)) {
      return { error: `${label} second time slot must start after the first one ends` };
    }
    hours[day] = { closed: false, slots: normalized };
    openDays += 1;
  }
  if (openDays < 1) return { error: 'At least one day must be open' };
  return { value: hours };
}

/**
 * @param {unknown} raw
 * @param {ReadonlyArray<{ id: string, label: string }>} catalog
 * @param {string} noun
 * @returns {{ value?: string[], error?: string }}
 */
export function normalizeCatalogIds(raw, catalog, noun) {
  if (!Array.isArray(raw)) return { error: `Select at least one ${noun}` };
  const allowed = new Set(catalog.map((item) => item.id));
  const picked = [];
  for (const id of raw) {
    const key = String(id || '').trim();
    if (!allowed.has(key)) return { error: `Unknown ${noun}: ${key}` };
    if (!picked.includes(key)) picked.push(key);
  }
  if (picked.length < 1) return { error: `Select at least one ${noun}` };
  return { value: picked };
}

export function parseStoredOpeningHours(raw) {
  if (raw == null || raw === '') return null;
  const parsed = typeof raw === 'string' ? safeJson(raw) : raw;
  const normalized = normalizeOpeningHours(parsed);
  return normalized.value || null;
}

export function parseStoredCatalogIds(raw, catalog) {
  if (raw == null || raw === '') return [];
  const parsed = typeof raw === 'string' ? safeJson(raw) : raw;
  const normalized = normalizeCatalogIds(parsed, catalog, 'item');
  return normalized.value || [];
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {{ openingHours?: unknown, facilities?: unknown, features?: unknown, appVersion?: unknown, mode: 'register' | 'update' }} input
 */
export function prepareCentreListing(input) {
  const enforce = requiresCentreProfile(input?.appVersion);
  const omitted = input?.openingHours == null && input?.facilities == null;
  const empty = input?.mode === 'register' ? null : undefined;
  if (omitted) {
    if (enforce) return { error: 'Opening hours are required' };
    return { openingHours: empty, facilities: empty, features: empty };
  }
  const hours = normalizeOpeningHours(input.openingHours);
  if (hours.error) return { error: hours.error };
  const facilities = normalizeCatalogIds(input.facilities, CENTRE_FACILITIES, 'facility');
  if (facilities.error) return { error: facilities.error };
  let features = empty;
  if (input?.features != null) {
    const normalized = normalizeCatalogIds(input.features, CENTRE_FEATURES, 'feature');
    if (normalized.error) return { error: normalized.error };
    features = normalized.value;
  }
  return {
    openingHours: hours.value,
    facilities: facilities.value,
    features,
  };
}
