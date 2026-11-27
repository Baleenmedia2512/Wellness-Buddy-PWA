/**
 * Client check for centres missing required listing fields.
 * Keep field keys aligned with
 * backend/features/nutrition-centers/domain/centreCompleteness.rules.js.
 */
import { CENTRE_PHOTO_SLOTS, centreCodeBody, centreCodeError } from './centreProfile.rules.js';
import { centreListingError } from './centreListing.rules.js';

/**
 * @param {{
 *   centerCode?: unknown,
 *   center_code?: unknown,
 *   openingHours?: unknown,
 *   facilities?: unknown,
 *   photoCategories?: Iterable<string>|null,
 *   profileComplete?: boolean,
 * }} center
 * @returns {Array<{ key: string, label: string }>}
 */
export function missingCentreProfileFields(center = {}) {
  if (center.profileComplete === true) return [];

  const missing = [];
  const code = center.centerCode ?? center.center_code;
  if (centreCodeError(centreCodeBody(code))) {
    missing.push({ key: 'centerCode', label: 'Centre code' });
  }

  const listingError = centreListingError(center.openingHours, center.facilities);
  if (listingError) {
    if (/facility/i.test(listingError) && !/opening hours|open|day/i.test(listingError)) {
      missing.push({ key: 'facilities', label: 'Facilities available' });
    } else if (/facility/i.test(listingError)) {
      missing.push({ key: 'openingHours', label: 'Opening hours' });
      missing.push({ key: 'facilities', label: 'Facilities available' });
    } else {
      missing.push({ key: 'openingHours', label: 'Opening hours' });
    }
  }

  if (center.photoCategories != null) {
    const categories = new Set(
      Array.from(center.photoCategories)
        .map((key) => String(key || '').trim())
        .filter(Boolean),
    );
    for (const slot of CENTRE_PHOTO_SLOTS) {
      if (!categories.has(slot.key)) {
        missing.push({ key: `photos.${slot.key}`, label: slot.label });
      }
    }
  } else if (center.profileComplete === false) {
    missing.push({ key: 'profile', label: 'Required centre details' });
  }

  return missing;
}

/**
 * @param {Parameters<typeof missingCentreProfileFields>[0]} center
 * @returns {boolean}
 */
export function isCentreProfileComplete(center) {
  if (center?.profileComplete === true) return true;
  if (center?.profileComplete === false) return false;
  return missingCentreProfileFields(center).length === 0;
}

/**
 * First owned centre that still needs required fields.
 * @param {unknown[]} centers
 * @param {unknown} ownerUserId
 */
export function firstIncompleteOwnedCentre(centers, ownerUserId) {
  const owner = Number(ownerUserId);
  if (!Number.isFinite(owner) || owner <= 0) return null;
  const list = Array.isArray(centers) ? centers : [];
  return list.find((center) => (
    Number(center?.owner_user_id) === owner
    && isCentreProfileComplete(center) === false
  )) || null;
}
