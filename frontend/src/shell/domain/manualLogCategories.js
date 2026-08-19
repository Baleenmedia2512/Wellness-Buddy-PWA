/**
 * Manual Log ("Log as") category ids + Snacks & Soups subtypes.
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
 * searchHint pre-fills the query with "salad" so relevant items surface first.
 */
export const DRY_SALAD_META = Object.freeze({
  id: MANUAL_LOG_CATEGORY.DRY_SALAD,
  label: 'Dry Salad',
  emoji: '🥗',
  searchHint: '',
  headerTitle: 'Dry Salad',
  headerSubtitle: 'Search for a salad item below',
});

/** @deprecated Snacks & Soups tile was replaced by the Dry Salad tile. Kept for any imports that may reference it. */
export const HEALTHY_SNACKS_SUBTYPE = Object.freeze({
  SOUPS: 'soups',
  SALADS: 'salads',
  SPROUTS: 'sprouts',
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

export const HEALTHY_SNACKS_SUBOPTIONS = Object.freeze([
  {
    id: HEALTHY_SNACKS_SUBTYPE.SOUPS,
    label: 'Soups',
    emoji: '🥣',
    searchHint: 'soup',
    headerTitle: 'Soups',
  },
  {
    id: HEALTHY_SNACKS_SUBTYPE.SALADS,
    label: 'Salads',
    emoji: '🥗',
    searchHint: 'salad',
    headerTitle: 'Salads',
  },
  {
    id: HEALTHY_SNACKS_SUBTYPE.SPROUTS,
    label: 'Sprouts',
    emoji: '🌱',
    searchHint: 'sprouts',
    headerTitle: 'Sprouts',
  },
]);

const SUBTYPE_BY_ID = Object.freeze(
  Object.fromEntries(HEALTHY_SNACKS_SUBOPTIONS.map((o) => [o.id, o])),
);

/** @param {string} id */
export function isManualLogCategory(id) {
  return Object.values(MANUAL_LOG_CATEGORY).includes(id);
}

/** @param {string} id */
export function isHealthySnacksSubtype(id) {
  return Object.prototype.hasOwnProperty.call(SUBTYPE_BY_ID, id);
}

/** @param {string} id */
export function getHealthySnacksSuboption(id) {
  return SUBTYPE_BY_ID[id] || null;
}

/**
 * After tapping a Log-as tile: either open a form directly, or the snacks picker.
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

/**
 * Picking Soups / Salads / Sprouts continues into the shared food search modal.
 * @param {string} subtypeId
 * @returns {{ formId: 'food', subtype: object } | null}
 */
export function resolveHealthySnacksSubtypeClick(subtypeId) {
  const subtype = getHealthySnacksSuboption(subtypeId);
  if (!subtype) return null;
  return {
    formId: MANUAL_LOG_CATEGORY.FOOD,
    subtype,
  };
}
