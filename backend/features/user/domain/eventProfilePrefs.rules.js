/**
 * Event registration preferences stored once on the profile.
 * Community Position codes for legacy profile save come from the role catalog
 * seed (apps below 3.5.6). New roles are not added to this list.
 */
import { ACCEPTED_COMMUNITY_POSITION_CODES } from './communityPosition.rules.js';

export const EVENT_TRANSLATION_OPTIONS = Object.freeze([
  'TAMIL',
  'ENGLISH',
  'MALAYALAM',
  'HINDI',
  'TELUGU',
  'KANNADA',
]);

export const EVENT_LEVEL_OPTIONS = ACCEPTED_COMMUNITY_POSITION_CODES;

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

/**
 * @param {unknown} value
 * @param {readonly string[]} options
 * @returns {string|null} null clears; undefined means omit
 */
export function normalizeEventPrefOption(value, options) {
  if (value === undefined) return undefined;
  if (value == null || String(value).trim() === '') return null;
  const next = cleanUpper(value);
  if (!options.includes(next)) return null;
  return next;
}

/**
 * @param {{ eventTranslation?: unknown, eventYourCity?: unknown, eventLevel?: unknown }} input
 */
export function normalizeEventProfilePrefs(input = {}) {
  return {
    eventTranslation: normalizeEventPrefOption(input.eventTranslation, EVENT_TRANSLATION_OPTIONS),
    eventYourCity: normalizeEventPrefOption(input.eventYourCity, EVENT_YOUR_CITY_OPTIONS),
    eventLevel: normalizeEventPrefOption(input.eventLevel, EVENT_LEVEL_OPTIONS),
  };
}
