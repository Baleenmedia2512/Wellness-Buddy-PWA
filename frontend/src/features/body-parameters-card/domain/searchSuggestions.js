/**
 * searchSuggestions.js — Prefix-first autocomplete for Body Composition Metrics search.
 * Pure helpers only; no I/O.
 */

const DEFAULT_LIMIT = 8;

/**
 * Normalize a search query: trim + lowercase.
 * @param {string} query
 * @returns {string}
 */
export function normalizeBpcSearchQuery(query) {
  return String(query || '').trim().toLowerCase();
}

/**
 * Match rank for a field value against query.
 * Lower is better: 0 = starts with, then indexOf+1 for substring, null = no match.
 * @param {string} valueLower
 * @param {string} queryLower
 * @returns {number|null}
 */
function matchRank(valueLower, queryLower) {
  if (!valueLower || !queryLower) return null;
  if (valueLower.startsWith(queryLower)) return 0;
  const idx = valueLower.indexOf(queryLower);
  if (idx < 0) return null;
  return idx + 1;
}

/**
 * Build autocomplete suggestions from body-parameter cards.
 * Prefix matches (name/phone/venue starting with the typed letters) are listed first.
 * Case-insensitive. Dedupes by display term.
 *
 * @param {Array<{ id?: string|number, name?: string|null, phoneNumber?: string|null, locationName?: string|null }>} cards
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{ id: string|number|null, term: string, name: string, phoneNumber: string, locationName?: string }>}
 */
export function buildBpcSearchSuggestions(cards, query, limit = DEFAULT_LIMIT) {
  const q = normalizeBpcSearchQuery(query);
  if (!q) return [];

  const list = Array.isArray(cards) ? cards : [];
  const scored = [];
  const seen = new Set();

  for (const card of list) {
    const name = String(card?.name || '').trim();
    const phone = String(card?.phoneNumber || '').trim();
    const venue = String(card?.locationName || '').trim();
    const nameRank = matchRank(name.toLowerCase(), q);
    const phoneRank = matchRank(phone.toLowerCase(), q);
    const venueRank = matchRank(venue.toLowerCase(), q);

    if (nameRank == null && phoneRank == null && venueRank == null) continue;

    // Determine the best matching field:
    // If name matches with equal or better rank than phone and venue, prefer name.
    // Else if phone matches with equal or better rank than venue, prefer phone.
    // Otherwise use venue.
    let term = name;
    let rank = nameRank ?? 999;
    let fieldPriority = 1;

    if (nameRank != null && (phoneRank == null || nameRank <= phoneRank) && (venueRank == null || nameRank <= venueRank)) {
      term = name;
      rank = nameRank;
      fieldPriority = 1;
    } else if (phoneRank != null && (venueRank == null || phoneRank <= venueRank)) {
      term = phone;
      rank = phoneRank;
      fieldPriority = 2;
    } else if (venueRank != null) {
      term = venue;
      rank = venueRank;
      fieldPriority = 3;
    }

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    scored.push({
      id: card?.id ?? null,
      term,
      name,
      phoneNumber: phone,
      locationName: venue,
      rank,
      fieldPriority,
    });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.fieldPriority !== b.fieldPriority) return a.fieldPriority - b.fieldPriority;
    return a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
  });

  return scored.slice(0, Math.max(0, limit)).map(({ id, term, name, phoneNumber, locationName }) => ({
    id,
    term,
    name,
    phoneNumber,
    locationName,
  }));
}
