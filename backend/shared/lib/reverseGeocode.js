/**
 * Nominatim reverse-geocode (city + short area) for server-side use.
 * Mirrors frontend/src/shared/lib/reverseGeocode.js — never throws.
 *
 * Area must stay short for portfolio (Adyar, Vadapalani) — never a long address.
 */

const MAX_AREA_LEN = 28;

/**
 * Collapse a Nominatim place label to a short area name.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function shortenAreaLabel(raw) {
  let text = String(raw || '').trim();
  if (!text) return null;
  // First segment only — drop "Adyar, Chennai, …" style tails.
  text = text.split(/[,/|]/)[0].trim();
  text = text
    .replace(/\bWard\s*\d+\b/gi, '')
    .replace(/\bZone\s*\d+\b/gi, '')
    .replace(/\bBlock\s*[A-Z0-9]+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length > MAX_AREA_LEN) {
    const words = text.split(/\s+/).filter(Boolean);
    const two = words.slice(0, 2).join(' ');
    if (two && two.length <= MAX_AREA_LEN) text = two;
    else if (words[0] && words[0].length <= MAX_AREA_LEN) text = words[0];
    else return null;
  }
  return text || null;
}

/**
 * Prefer a single local area label (suburb / neighbourhood), not a joined list.
 * @param {Record<string, unknown>|null|undefined} addr
 * @returns {string|null}
 */
export function pickShortAreaName(addr) {
  if (!addr || typeof addr !== 'object') return null;
  const candidates = [
    addr.suburb,
    addr.neighbourhood,
    addr.city_district,
    addr.quarter,
    addr.residential,
    addr.hamlet,
  ];
  for (const raw of candidates) {
    const short = shortenAreaLabel(raw);
    if (short) return short;
  }
  return null;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ city: string|null, village: string|null }>}
 */
export async function fetchCityVillage(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { city: null, village: null };
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'WellnessBuddy/1.0',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      },
    );
    if (!response.ok) return { city: null, village: null };

    const geoData = await response.json();
    const addr = geoData?.address;
    if (!addr || typeof addr !== 'object') return { city: null, village: null };

    const cityRaw = addr.city || addr.town || addr.village || addr.county || null;
    const city = shortenAreaLabel(cityRaw) || (cityRaw ? String(cityRaw).trim() : null);
    const village = pickShortAreaName(addr);

    return { city, village };
  } catch {
    return { city: null, village: null };
  }
}
