/**
 * @file reverseGeocode.js — shared helper for Nominatim reverse-geocoding.
 *
 * Converts a GPS coordinate pair into a human-readable city + village pair.
 * Used by every photo-save flow (education, food, weight) so the logic lives
 * in exactly one place (claude.md §1.1 rule 2 — Reuse before rewrite).
 *
 * Pure I/O wrapper — no React, no Capacitor, no process.env.
 * Returns null fields gracefully on network failure so callers are never blocked.
 */

import { debugLog } from '../utils/logger.js';

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

    // Primary city: city → town → village → county (in order of specificity)
    const city = addr.city || addr.town || addr.village || addr.county || null;

    // Village = finer-grained neighbourhood details
    const villageParts = [];
    if (addr.neighbourhood) villageParts.push(addr.neighbourhood);
    if (addr.suburb && addr.suburb !== addr.neighbourhood) villageParts.push(addr.suburb);
    if (addr.hamlet) villageParts.push(addr.hamlet);
    const village = villageParts.length > 0 ? villageParts.join(', ') : null;

    debugLog('✅ [reverseGeocode] Address extracted:', {
      city,
      village,
      fullAddress: geoData.display_name,
    });

    return { city, village };
  } catch (err) {
    // Network errors, JSON parse errors — never block the save
    debugLog('⚠️ [reverseGeocode] Failed to fetch address from GPS:', err.message);
    return { city: null, village: null };
  }
}
