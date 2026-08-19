/**
 * bcmContactName.rules.js — pure contact display-name rules for BCM.
 * Format: "{name} {venueShort} {yy/mm/dd}"
 * Venue is shortened to initials (e.g. "St.louis church" → "slc").
 */

/**
 * @param {string|null|undefined} isoDate - YYYY-MM-DD or Date-parseable
 * @returns {string} yy/mm/dd
 */
export function formatBcmContactDate(isoDate) {
  const raw = String(isoDate || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1].slice(2)}/${m[2]}/${m[3]}`;

  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  }
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
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
 * @returns {string}
 */
export function buildBcmContactDisplayName({ name, venue, recordedDate } = {}) {
  const parts = [
    String(name || '').trim(),
    abbreviateVenue(venue),
    formatBcmContactDate(recordedDate),
  ].filter(Boolean);
  return parts.join(' ');
}
