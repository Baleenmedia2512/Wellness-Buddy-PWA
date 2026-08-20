/**
 * bcmContactName.rules.js — pure contact display-name rules for BCM.
 * Format: "{name} {venueShort}{yymmdd}"
 * Example: praveen + "St.louis church" + 2026-08-20 → "praveen slc260820"
 */

/**
 * @param {string|null|undefined} isoDate - YYYY-MM-DD, DD/MM/YYYY, or Date-parseable
 * @returns {string} yymmdd (e.g. 260820)
 */
export function formatBcmContactDate(isoDate) {
  const raw = String(isoDate || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1].slice(2)}${iso[2]}${iso[3]}`;

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yy = dmy[3].slice(2);
    return `${yy}${mm}${dd}`;
  }

  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Short venue for contact names: initials of each word/segment.
 * "St.louis church" → "slc"; single token "adyar" stays "adyar".
 * @param {string|null|undefined} venue
 * @returns {string}
 */
export function abbreviateVenue(venue) {
  const raw = String(venue || '').trim();
  if (!raw) return '';

  const tokens = raw
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].toLowerCase();

  return tokens
    .map((t) => t.charAt(0).toLowerCase())
    .join('');
}

/**
 * @param {{ name?: string|null, venue?: string|null, recordedDate?: string|null }} input
 * @returns {string} e.g. "praveen slc260820"
 */
export function buildBcmContactDisplayName({ name, venue, recordedDate } = {}) {
  const person = String(name || '').trim();
  const venuePart = abbreviateVenue(venue);
  const datePart = formatBcmContactDate(recordedDate);
  const suffix = `${venuePart}${datePart}`;
  return [person, suffix].filter(Boolean).join(' ');
}
