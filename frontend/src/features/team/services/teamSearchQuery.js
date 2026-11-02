/**
 * Map the raw search-box value to a query.
 *
 * After a Nutrition ↔ Trend tab switch the input still *shows* the selected
 * member's name while `searchQuery` is empty. On mobile, select-all often
 * fails, so the next keystroke appends onto that name ("John Smithj") and
 * the dropdown says "No active users found" for a person Trend already found.
 * If the typed value only adds to / deletes from that displayed name, keep
 * the real query as the typed suffix (or the remaining prefix).
 */
export function resolveTypedSearchQuery({ currentQuery, displayName, nextValue }) {
  const next = String(nextValue ?? '');
  const current = String(currentQuery ?? '');
  const shown = String(displayName ?? '');
  if (current) return next;
  if (!shown) return next;
  if (next === shown) return '';
  if (shown.startsWith(next)) return next;
  if (next.startsWith(shown)) return next.slice(shown.length);
  return next;
}
