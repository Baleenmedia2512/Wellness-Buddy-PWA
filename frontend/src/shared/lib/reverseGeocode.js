/**
 * @file reverseGeocode.js — shared helper for Nominatim reverse-geocoding.
 *
 * Converts a GPS coordinate pair into a city + short area pair
 * (e.g. Chennai + Adyar — not a long multi-part address).
 *
 * Used by every photo-save flow (education, food, weight) so the logic lives
 * in exactly one place (claude.md §1.1 rule 2 — Reuse before rewrite).
 *
 * Pure I/O wrapper — no React, no Capacitor, no process.env.
 * Returns null fields gracefully on network failure so callers are never blocked.
 */

import { debugLog } from '../utils/logger.js';

const MAX_AREA_LEN = 28;

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function shortenAreaLabel(raw) {
  let text = String(raw || '').trim();
  if (!text) return null;
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
 * Fetch city and village names from a GPS coordinate using Nominatim.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ city: string|null, village: string|null }>}
 *   Always resolves — never rejects. Fields are null on failure.
 */
export async function fetchCityVillage(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return { city: null, village: null };
  }

  try {
    debugLog('📍 [reverseGeocode] Fetching address from GPS:', { latitude, longitude });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'WellnessBuddy/1.0',
          'Accept-Language': 'en',
        },
      },
    );

    if (!response.ok) {
      debugLog('⚠️ [reverseGeocode] Nominatim returned non-OK status:', response.status);
      return { city: null, village: null };
    }

    const geoData = await response.json();
    if (!geoData || !geoData.address) {
      return { city: null, village: null };
    }

    const addr = geoData.address;
    const cityRaw = addr.city || addr.town || addr.village || addr.county || null;
    const city = shortenAreaLabel(cityRaw) || (cityRaw ? String(cityRaw).trim() : null);
    const village = pickShortAreaName(addr);

    debugLog('✅ [reverseGeocode] Address extracted:', {
      city,
      village,
      fullAddress: geoData.display_name,
    });

    return { city, village };
  } catch (err) {
    debugLog('⚠️ [reverseGeocode] Failed to fetch address from GPS:', err.message);
    return { city: null, village: null };
  }
}
