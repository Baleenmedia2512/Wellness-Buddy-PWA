/** Normalize a search query: trim whitespace and lowercase. */
export function normalizeSearchQuery(query) {
  return (query || '').trim().toLowerCase();
}

/** Case-insensitive partial match against the member's display name only. */
export function rowMatchesSearch(row, query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;

  const userName = String(row?.userName || '').toLowerCase();
  return userName.includes(normalized);
}

/** Filter rows by the active search query (empty query returns all rows). */
export function filterRowsBySearch(rows, query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return rows;
  return rows.filter((row) => rowMatchesSearch(row, normalized));
}
