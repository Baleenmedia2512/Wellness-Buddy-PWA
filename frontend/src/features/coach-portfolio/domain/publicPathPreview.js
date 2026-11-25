/**
 * Preview /coach/<city>/<area>/<name> from the form the user is editing.
 * Matches backend slug.rules.js shape for display only.
 */

function slugifyPart(raw) {
  return String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * @param {{
 *   websiteDisplayName?: string,
 *   fullName?: string,
 *   city?: string,
 *   locality?: string,
 *   userId?: number|string,
 * }} input
 * @returns {string} e.g. /coach/madurai/avaniyapuram/avinash
 */
export function buildPublicPathPreview({
  websiteDisplayName,
  fullName,
  city,
  locality,
  userId,
} = {}) {
  const citySlug = slugifyPart(city) || 'india';
  const areaSlug = slugifyPart(locality) || 'center';
  let nameSlug = slugifyPart(websiteDisplayName) || slugifyPart(fullName) || 'coach';
  if (nameSlug.length < 2 && userId != null) {
    nameSlug = `${nameSlug}-${userId}`.slice(0, 48);
  }
  return `/coach/${citySlug}/${areaSlug}/${nameSlug}`.slice(0, 170);
}
