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

export const EVENT_LEVEL_OPTIONS = Object.freeze([
  'PC',
  'ASSOCIATE',
  'SV',
  'WT',
  'AWT',
  'GET TEAM',
  '2500 GET TEAM',
  'MILL TEAM',
  'PT',
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
    eventLevel: normalizeEventPrefOption(
      data.eventLevel ?? data.EventLevel,
      EVENT_LEVEL_OPTIONS,
    ),
  };
}
