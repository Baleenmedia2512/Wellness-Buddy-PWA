/**
 * Client helpers for food suggestions ranking / filter.
 */

/** Regular Add Food must not surface Herbalife catalog items (Target Nutrition uses catalog mode). */
export function isHerbalifeProductSuggestionName(name) {
  const normalized = String(name || '').trim().replace(/^\*+\s*/, '');
  return /^herbalife\b/i.test(normalized);
}

export function filterRegularFoodSearchItems(items = []) {
  return (items || []).filter((item) => !isHerbalifeProductSuggestionName(item?.name));
}

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

const DRY_SALAD_SLOT_LABELS = Object.freeze({
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
});

/**
 * @param {string|null|undefined} slot
 * @returns {string}
 */
export function drySaladUsualComboTitle(slot) {
  const label = DRY_SALAD_SLOT_LABELS[slot];
  return label ? `Your usual ${label} combo` : 'Your usual combo';
}

/**
 * @param {string|null|undefined} slot
 * @returns {string}
 */
export function drySaladOftenTitle(slot) {
  const label = DRY_SALAD_SLOT_LABELS[slot];
  return label ? `Often at this ${label}` : 'Often at this time';
}

/**
 * Slot from the device clock (same bands as the backend).
 * morning 05–11 · afternoon 12–15 · evening 16–19 · night 20–04
 * @param {Date} [now]
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function drySaladSlotFromDeviceNow(now = new Date()) {
  const hour = now instanceof Date ? now.getHours() : Number.NaN;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return 'morning';
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 20) return 'evening';
  return 'night';
}
