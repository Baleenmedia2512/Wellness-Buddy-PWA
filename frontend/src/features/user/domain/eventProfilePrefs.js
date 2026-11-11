/**
 * Event registration prefs on Profile — update once, reuse on every register.
 */

export const EVENT_TRANSLATION_OPTIONS = Object.freeze([
  'TAMIL',
  'ENGLISH',
  'MALAYALAM',
  'HINDI',
  'TELUGU',
  'KANNADA',
]);

export const EVENT_YOUR_CITY_OPTIONS = Object.freeze([
  'OTHER COUNTRY',
  'OTHER CITY',
  'CHENNAI',
  'COIMBATORE',
  'ERODE',
  'HOSUR',
  'KERALA',
  'KUMBAKONAM',
  'MADURAI',
  'NELLAI',
  'PERAMBALUR',
  'PATTUKOTTAI',
  'PONDY',
  'RAJAPALAYAM',
  'SALEM',
  'TRICHY',
  'VELLORE',
  'VILLUPURAM',
  'MUMBAI',
  'BANGALORE',
]);

function cleanUpper(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeEventPrefOption(value, options) {
  if (value == null || String(value).trim() === '') return '';
  const next = cleanUpper(value);
  return options.includes(next) ? next : '';
}

export function pickEventProfilePrefs(data = {}) {
  return {
    eventTranslation: normalizeEventPrefOption(
      data.eventTranslation ?? data.EventTranslation,
      EVENT_TRANSLATION_OPTIONS,
    ),
    eventYourCity: normalizeEventPrefOption(
      data.eventYourCity ?? data.EventYourCity,
      EVENT_YOUR_CITY_OPTIONS,
    ),
    eventLevel: normalizeStoredCommunityPosition(data.eventLevel ?? data.EventLevel),
  };
}

/** Confirmed profile role. Any catalog code is kept — the list is not hard-coded. */
export function normalizeStoredCommunityPosition(value) {
  if (value == null || String(value).trim() === '') return '';
  return String(value).trim().replace(/\s+/g, ' ').toUpperCase();
}
