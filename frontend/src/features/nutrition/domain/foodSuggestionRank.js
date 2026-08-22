/**
 * Client helpers for food suggestions ranking / filter.
 */

export function filterSuggestionsAgainstSelected(suggestions = [], selectedItems = []) {
  const selected = new Set(
    selectedItems.map((s) => String(s?.name || '').trim().toLowerCase()).filter(Boolean),
  );
  return (suggestions || []).filter((item) => {
    const key = String(item?.name || '').trim().toLowerCase();
    return key && !selected.has(key);
  });
}

export function suggestionSectionTitle(hasSelection) {
  return hasSelection ? 'Often added with' : 'Latest';
}
