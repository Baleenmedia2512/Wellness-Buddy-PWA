/**
 * Public coach website paths:
 *   wellnessvalley.in/coach/<city>/<area>/<website-display-name>
 * Example:
 *   /coach/chennai/adyar/priya-wellness
 *
 * Legacy (still valid for already-published rows):
 *   /coach/<city>/<name-area>
 */

export function slugifyPart(raw) {
  return String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Single URL segment: name, city, or area. */
export function isValidCoachSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''))
    && String(slug).length >= 1
    && String(slug).length <= 160;
}

/**
 * Stored PublicSlug value:
 *   new: "city/area/display-name"
 *   legacy: "city/name-area"
 *
 * @param {string} publicSlug
 * @returns {{
 *   citySlug: string,
 *   areaSlug: string|null,
 *   nameSlug: string,
 *   pageSlug: string,
 *   format: 'v1'|'v2',
 * }|null}
 */
export function parseCoachPublicSlug(publicSlug) {
  const raw = String(publicSlug || '').trim().toLowerCase();
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 3) {
    const [citySlug, areaSlug, nameSlug] = parts;
    if (!isValidCoachSlug(citySlug) || !isValidCoachSlug(areaSlug) || !isValidCoachSlug(nameSlug)) {
      return null;
    }
    return {
      citySlug,
      areaSlug,
      nameSlug,
      pageSlug: nameSlug,
      format: 'v2',
    };
  }
  if (parts.length === 2) {
    const [citySlug, pageSlug] = parts;
    if (!isValidCoachSlug(citySlug) || !isValidCoachSlug(pageSlug)) return null;
    return {
      citySlug,
      areaSlug: null,
      nameSlug: pageSlug,
      pageSlug,
      format: 'v1',
    };
  }
  return null;
}

export function isValidCoachPublicSlug(publicSlug) {
  return parseCoachPublicSlug(publicSlug) != null;
}

/**
 * @param {{
 *   websiteDisplayName?: string,
 *   fullName?: string,
 *   city?: string,
 *   locality?: string,
 *   userId?: number|string,
 * }} input
 * @returns {{
 *   citySlug: string,
 *   areaSlug: string,
 *   nameSlug: string,
 *   pageSlug: string,
 *   publicSlug: string,
 *   publicPath: string,
 * }}
 */
export function buildCoachPortfolioPath({
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
  const publicSlug = `${citySlug}/${areaSlug}/${nameSlug}`.slice(0, 160);
  return {
    citySlug,
    areaSlug,
    nameSlug,
    pageSlug: nameSlug,
    publicSlug,
    publicPath: `/coach/${publicSlug}`,
  };
}

/**
 * @deprecated Prefer buildCoachPortfolioPath — kept for older call sites.
 * Returns the stored public slug (city/area/name).
 */
export function buildCoachPortfolioSlug(input) {
  return buildCoachPortfolioPath(input).publicSlug;
}
