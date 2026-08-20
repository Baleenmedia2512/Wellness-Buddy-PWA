/**
 * Manual Log ("Log as") category ids.
 * Pure constants — no I/O. Used by ManualEntryPage and tests.
 */

export const MANUAL_LOG_CATEGORY = Object.freeze({
  WEIGHT: 'weight',
  AFRESH: 'afresh',
  EDUCATION: 'education',
  SHAKE: 'shake',
  WATER: 'water',
  FOOD: 'food',
  DRY_SALAD: 'dry-salad',
  SMARTWATCH: 'smartwatch',
  GOOD_HABIT: 'good-habit',
});

/**
 * Dry Salad category metadata — opens the food search flow directly.
 * searchHint pre-fills the query with "herbalife" so relevant items surface first.
 */
export const DRY_SALAD_META = Object.freeze({
  id: MANUAL_LOG_CATEGORY.DRY_SALAD,
  label: 'Dry Salad',
  emoji: '🥗',
  searchHint: 'herbalife',
  headerTitle: 'Dry Salad',
  headerSubtitle: 'Search for a salad item below',
});

export const GOOD_HABIT_SUBTYPE = Object.freeze({
  IMAGE_NOTES: 'image_notes',
});

export const GOOD_HABIT_SUBOPTIONS = Object.freeze([
  {
    id: GOOD_HABIT_SUBTYPE.IMAGE_NOTES,
    label: 'Good Habit Photo',
    hint: 'Upload a photo of your good habit',
  },
]);

/** @param {string} id */
export function isManualLogCategory(id) {
  return Object.values(MANUAL_LOG_CATEGORY).includes(id);
}

/**
 * After tapping a Log-as tile: either open a form directly, or a picker.
 * @param {string} categoryId
 * @returns {{ kind: 'form', formId: string } | { kind: 'dry-salad' } | { kind: 'good-habit-picker' } | null}
 */
export function resolveManualLogCategoryClick(categoryId) {
  if (!isManualLogCategory(categoryId)) return null;
  if (categoryId === MANUAL_LOG_CATEGORY.DRY_SALAD) {
    return { kind: 'dry-salad' };
  }
  if (categoryId === MANUAL_LOG_CATEGORY.GOOD_HABIT) {
    return { kind: 'good-habit-picker' };
  }
  return { kind: 'form', formId: categoryId };
}
