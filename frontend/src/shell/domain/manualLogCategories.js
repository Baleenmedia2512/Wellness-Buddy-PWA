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
  HEALTHY_SNACKS: 'healthy-snacks',
  SMARTWATCH: 'smartwatch',
});

/** Sub-options under Snacks & Soups — each opens the food search flow. */
export const HEALTHY_SNACKS_SUBTYPE = Object.freeze({
  SOUPS: 'soups',
  SALADS: 'salads',
  SPROUTS: 'sprouts',
});

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
 * @returns {{ kind: 'form', formId: string } | { kind: 'healthy-snacks-picker' } | null}
 */
export function resolveManualLogCategoryClick(categoryId) {
  if (!isManualLogCategory(categoryId)) return null;
  if (categoryId === MANUAL_LOG_CATEGORY.HEALTHY_SNACKS) {
    return { kind: 'healthy-snacks-picker' };
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
