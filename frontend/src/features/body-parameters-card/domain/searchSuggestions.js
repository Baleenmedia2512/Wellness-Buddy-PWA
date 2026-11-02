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
 * Prefix matches (name/phone starting with the typed letters) are listed first.
 * Case-insensitive. Dedupes by display term.
 *
 * @param {Array<{ id?: string|number, name?: string|null, phoneNumber?: string|null }>} cards
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{ id: string|number|null, term: string, name: string, phoneNumber: string }>}
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
    const nameRank = matchRank(name.toLowerCase(), q);
    const phoneRank = matchRank(phone.toLowerCase(), q);

    if (nameRank == null && phoneRank == null) continue;

    // Prefer name when it matches; otherwise use phone as the suggestion term.
    const useName = nameRank != null && (phoneRank == null || nameRank <= phoneRank);
    const term = useName ? name : phone;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rank = useName ? nameRank : phoneRank;
    scored.push({
      id: card?.id ?? null,
      term,
      name,
      phoneNumber: phone,
      rank,
    });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
  });

  return scored.slice(0, Math.max(0, limit)).map(({ id, term, name, phoneNumber }) => ({
    id,
    term,
    name,
    phoneNumber,
  }));
}
