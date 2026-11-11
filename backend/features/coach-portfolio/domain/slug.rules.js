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
 * Make a city/area/name slug unique for this coach (append -userId, then -2, -3…).
 * @param {string} publicSlug
 * @param {number|string} userId
 * @param {number} [attempt] 0 = -userId, 1 = -userId-2, …
 * @returns {string}
 */
export function suffixPublicSlugForUser(publicSlug, userId, attempt = 0) {
  const parsed = String(publicSlug || '').split('/').filter(Boolean);
  const city = parsed[0] || 'india';
  const area = parsed[1] || 'center';
  const baseLeaf = (parsed[2] || 'coach').replace(new RegExp(`-${userId}(?:-\\d+)?$`), '');
  const n = Number(attempt) || 0;
  const leaf = n <= 0
    ? `${baseLeaf || 'coach'}-${userId}`.slice(0, 48)
    : `${baseLeaf || 'coach'}-${userId}-${n + 1}`.slice(0, 48);
  return `${city}/${area}/${leaf}`.slice(0, 160);
}

/** True when MySQL / Prisma reports unique PublicSlug collision (1062 / P2002). */
export function isDuplicatePublicSlugError(error) {
  const msg = error?.message || String(error || '');
  const code = error?.code != null ? String(error.code) : '';
  return code === 'P2002'
    || /1062/.test(msg)
    || /Duplicate entry/i.test(msg)
    || /uq_coach_portfolio_slug/i.test(msg);
}

/**
 * @deprecated Prefer buildCoachPortfolioPath — kept for older call sites.
 * Returns the stored public slug (city/area/name).
 */
export function buildCoachPortfolioSlug(input) {
  return buildCoachPortfolioPath(input).publicSlug;
}
