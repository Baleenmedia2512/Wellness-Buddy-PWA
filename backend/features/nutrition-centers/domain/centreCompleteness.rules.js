/**
 * Whether an existing nutrition centre still needs the required listing
 * fields introduced for app >= 3.5.7 (code, hours, facilities, photos).
 * Used to force owners to fill gaps once; after save the check passes.
 */
import {
  CENTRE_PHOTO_SLOTS,
  normalizeCentreCode,
} from './centreProfile.rules.js';
import {
  CENTRE_FACILITIES,
  normalizeCatalogIds,
  normalizeOpeningHours,
} from './centreListing.rules.js';

/**
 * @param {{
 *   centerCode?: unknown,
 *   openingHours?: unknown,
 *   facilities?: unknown,
 *   photoCategories?: Iterable<string>|null,
 * }} input
 * @returns {Array<{ key: string, label: string }>}
 */
export function missingCentreProfileFields(input = {}) {
  const missing = [];
  if (!normalizeCentreCode(input.centerCode)) {
    missing.push({ key: 'centerCode', label: 'Centre code' });
  }

  const hours = normalizeOpeningHours(input.openingHours);
  if (hours.error) {
    missing.push({ key: 'openingHours', label: 'Opening hours' });
  }

  const facilities = normalizeCatalogIds(input.facilities, CENTRE_FACILITIES, 'facility');
  if (facilities.error) {
    missing.push({ key: 'facilities', label: 'Facilities available' });
  }

  const categories = new Set(
    Array.from(input.photoCategories || [])
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  );
  for (const slot of CENTRE_PHOTO_SLOTS) {
    if (!categories.has(slot.key)) {
      missing.push({ key: `photos.${slot.key}`, label: slot.label });
    }
  }
  return missing;
}

/**
 * @param {Parameters<typeof missingCentreProfileFields>[0]} input
 * @returns {boolean}
 */
export function isCentreProfileComplete(input) {
  return missingCentreProfileFields(input).length === 0;
}
