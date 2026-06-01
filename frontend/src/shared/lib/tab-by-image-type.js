/**
 * frontend/src/shared/lib/tab-by-image-type.js
 * ---------------------------------------------------------------------------
 * Maps a capture's ImageType to the dashboard tab that should open when a
 * public share link is resolved (App.js native deep-link handler).
 *
 * Replaces the ternary chain that previously omitted 'smartwatch' (defaulting
 * smartwatch shares to the nutrition tab, which never renders watch data).
 *
 * Pure module — no React, no side effects.
 * ---------------------------------------------------------------------------
 */

import {
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
  IMAGE_TYPE_SMARTWATCH,
  IMAGE_TYPE_UNKNOWN,
  IMAGE_TYPE_PENDING,
} from '../constants/imageTypes.js';

export const DEFAULT_TAB = 'nutrition';

/**
 * Static mapping. Frozen so accidental writes throw in strict mode.
 *
 * Note on 'unknown' / 'pending' / 'food': all route to the nutrition tab
 * because that is where the share landing page lives; for unknown/pending
 * the page simply shows an empty state. PR 4 may revisit this once the
 * legacy food-table coupling is removed.
 */
export const TAB_BY_IMAGE_TYPE = Object.freeze({
  [IMAGE_TYPE_FOOD]:       'nutrition',
  [IMAGE_TYPE_WEIGHT]:     'weight',
  [IMAGE_TYPE_EDUCATION]:  'education',
  [IMAGE_TYPE_SMARTWATCH]: 'education',
  [IMAGE_TYPE_UNKNOWN]:    DEFAULT_TAB,
  [IMAGE_TYPE_PENDING]:    DEFAULT_TAB,
});

/**
 * Resolve a tab for the given image type. Unknown / null / missing inputs
 * fall back to DEFAULT_TAB so callers can use the result directly.
 */
export function tabForImageType(imageType) {
  return TAB_BY_IMAGE_TYPE[imageType] || DEFAULT_TAB;
}
