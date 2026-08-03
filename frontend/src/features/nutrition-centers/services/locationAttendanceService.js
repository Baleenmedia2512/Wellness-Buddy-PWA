/**
 * Location-based attendance tracking service
 * Handles GPS permissions and proximity detection for nutrition centers
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { debugLog } from '../../../shared/utils/logger.js';

class LocationAttendanceService {
  constructor() {
    this.PROXIMITY_RADIUS_METERS = 100; // 100 meters radius
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lon1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lon2 - Longitude of point 2
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Browser Geolocation API fallback (Capacitor Geolocation is native-only;
   * on web it throws code=UNIMPLEMENTED "Not implemented on web.").
   */
  getCurrentLocationViaBrowser(options) {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({
          error: 'LOCATION_UNAVAILABLE',
          errorDetail: 'Browser geolocation API not available in this environment',
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          debugLog('✅ GPS location obtained (browser):', {
            accuracy: position.coords.accuracy,
          });
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          const code = error?.code;
          const message = error?.message || String(error);
          let errorCode = 'LOCATION_UNAVAILABLE';
          let errorDetail = message;

          if (code === 1) {
            errorCode = 'PERMISSION_DENIED';
            errorDetail = `Browser permission denied (code=1): ${message}`;
          } else if (code === 3) {
            errorCode = 'GPS_TIMEOUT';
            errorDetail = `Browser GPS timed out after ${options.timeout}ms (code=3): ${message}`;
          } else if (code === 2) {
            errorCode = 'POSITION_UNAVAILABLE';
            errorDetail = `Browser position unavailable (code=2): ${message}`;
          } else {
            errorDetail = `Browser GPS error (code=${code ?? 'n/a'}): ${message}`;
          }

          console.warn('⚠️ GPS location error (browser):', { errorCode, errorDetail });
          resolve({ error: errorCode, errorDetail });
        },
        options,
      );
    });
  }

  /**
   * Request GPS location permission and get current position.
   * Native → Capacitor Geolocation; Web → navigator.geolocation.
   * @returns {Promise<{latitude?: number, longitude?: number, accuracy?: number, error?: string, errorDetail?: string}>}
   */
  async getCurrentLocation() {
    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // 15 seconds
      maximumAge: 0, // No caching
    };

    const useBrowser =
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() === 'web';

    if (useBrowser) {
      debugLog('📍 GPS via browser geolocation (web platform)');
      return this.getCurrentLocationViaBrowser(options);
    }

    try {
      // Ensure permission is granted before requesting position (Capacitor native API).
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
          debugLog('⚠️ GPS permission denied by user', {
            before: perm,
            after: requested,
          });
          return {
            error: 'PERMISSION_DENIED',
            errorDetail:
              `Location permission not granted (location=${requested.location}, coarse=${requested.coarseLocation})`,
          };
        }
      }

      const position = await Geolocation.getCurrentPosition(options);
      debugLog('✅ GPS location obtained (native):', {
        accuracy: position.coords.accuracy,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (error) {
      const code = error?.code;
      const message = error?.message || String(error);
      const unimplemented =
        code === 'UNIMPLEMENTED' ||
        String(code).includes('UNIMPLEMENTED') ||
        message.toLowerCase().includes('not implemented on web');

      // Capacitor web stub — fall back to browser API.
      if (unimplemented) {
        debugLog('📍 Capacitor Geolocation UNIMPLEMENTED — falling back to browser');
        return this.getCurrentLocationViaBrowser(options);
      }

      let errorCode = 'LOCATION_UNAVAILABLE';
      let errorDetail = message;

      // GeolocationPositionError: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
      if (
        code === 1 ||
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('denied')
      ) {
        errorCode = 'PERMISSION_DENIED';
        errorDetail = `Permission denied (code=${code ?? 'n/a'}): ${message}`;
      } else if (code === 3 || message.toLowerCase().includes('timeout')) {
        errorCode = 'GPS_TIMEOUT';
        errorDetail = `GPS timed out after ${options.timeout}ms (code=${code ?? 'n/a'}): ${message}`;
      } else if (code === 2) {
        errorCode = 'POSITION_UNAVAILABLE';
        errorDetail = `Position unavailable — GPS/network location off or weak signal (code=2): ${message}`;
      } else {
        errorDetail = `GPS error (code=${code ?? 'n/a'}): ${message}`;
      }

      console.warn('⚠️ GPS location error (native):', { errorCode, errorDetail });
      return { error: errorCode, errorDetail };
    }
  }

  /**
   * Find ALL nutrition centers within proximity radius
   * @param {number} userLat - User's latitude
   * @param {number} userLon - User's longitude
   * @param {Array} centers - Array of nutrition centers
   * @returns {Array<{center: Object, distance: number}>} - Array of nearby centers sorted by distance
   */
  findNearbyCenters(userLat, userLon, centers) {
    if (!centers || centers.length === 0) {
      return [];
    }

    const nearbyCenters = [];

    for (const center of centers) {
      const distance = this.calculateDistance(
        userLat,
        userLon,
        parseFloat(center.latitude),
        parseFloat(center.longitude)
      );

      if (distance <= this.PROXIMITY_RADIUS_METERS) {
        nearbyCenters.push({ center, distance });
      }
    }

    // Sort by distance (closest first)
    nearbyCenters.sort((a, b) => a.distance - b.distance);

    if (nearbyCenters.length > 0) {
      debugLog(`✅ Found ${nearbyCenters.length} center(s) within ${this.PROXIMITY_RADIUS_METERS}m:`);
      nearbyCenters.forEach((nc, idx) => {
        debugLog(`  ${idx + 1}. ${nc.center.center_name} (${Math.round(nc.distance)}m away)`);
      });
    } else {
      debugLog(`⚠️ No centers within ${this.PROXIMITY_RADIUS_METERS}m radius`);
    }

    return nearbyCenters;
  }

  /**
   * Fetch nutrition centers for proximity check
   * @param {string} apiBaseUrl - API base URL
   * @param {number} userId - User ID
   * @returns {Promise<Array>}
   */
  async fetchNutritionCenters(apiBaseUrl, userId) {
    try {
      // Use scope=all to fetch ALL clubs globally for GPS-based attendance detection
      // This allows users to check in at ANY club, not just their team's clubs
      const response = await fetch(
        `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=full&scope=all`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch centers');
      }

      return result.data || [];
    } catch (err) {
      console.error('❌ Error fetching nutrition centers:', err);
      return [];
    }
  }

  /**
   * Determine attendance from known coordinates (no GPS call).
   * Used by the background location cache and by determineAttendance().
   */
  async determineAttendanceFromCoords(apiBaseUrl, userId, { latitude, longitude, accuracy = null }) {
    if (latitude == null || longitude == null) {
      return {
        attendanceType: 'remote',
        latitude: null,
        longitude: null,
        nutritionCenterId: null,
        nearbyCenters: [],
        locationError: 'MISSING_COORDS',
        locationErrorDetail: 'determineAttendanceFromCoords called without coordinates',
        accuracy: null,
      };
    }

    try {
      const centers = await this.fetchNutritionCenters(apiBaseUrl, userId);
      debugLog(`📍 [attendance] Fetched ${centers.length} nutrition centers for proximity check`);

      if (centers.length === 0) {
        debugLog('⚠️ [attendance] No nutrition centers found - marking as remote');
        return {
          attendanceType: 'remote',
          latitude,
          longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
          accuracy,
        };
      }

      const centersWithCoords = centers.filter((c) => {
        const lat = parseFloat(c.latitude);
        const lon = parseFloat(c.longitude);
        const valid = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
        if (!valid) {
          console.warn(`⚠️ [attendance] Center "${c.center_name}" (id:${c.id}) has invalid coordinates`);
        }
        return valid;
      });

      if (centersWithCoords.length === 0) {
        debugLog('⚠️ [attendance] All centers have missing/invalid coordinates - marking as remote');
        return {
          attendanceType: 'remote',
          latitude,
          longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
          accuracy,
        };
      }

      const nearbyCenters = this.findNearbyCenters(latitude, longitude, centersWithCoords);

      if (nearbyCenters.length > 0) {
        return {
          attendanceType: 'club',
          latitude,
          longitude,
          nutritionCenterId: nearbyCenters.length === 1 ? nearbyCenters[0].center.id : null,
          nearbyCenters,
          centerName: nearbyCenters.length === 1 ? nearbyCenters[0].center.center_name : null,
          accuracy,
        };
      }

      return {
        attendanceType: 'remote',
        latitude,
        longitude,
        nutritionCenterId: null,
        nearbyCenters: [],
        accuracy,
      };
    } catch (err) {
      console.error('❌ Error determining attendance (centers/proximity stage):', err);
      return {
        attendanceType: 'remote',
        latitude,
        longitude,
        nutritionCenterId: null,
        nearbyCenters: [],
        locationError: 'CENTERS_LOOKUP_FAILED',
        locationErrorDetail: `GPS OK but nutrition-centers lookup failed: ${err?.message || err}`,
        accuracy,
      };
    }
  }

  /**
   * Determine attendance type and nutrition center(s) based on GPS location
   * @param {string} apiBaseUrl - API base URL
   * @param {number} userId - User ID
   */
  async determineAttendance(apiBaseUrl, userId) {
    let location = null;
    try {
      location = await this.getCurrentLocation();
    } catch (locErr) {
      console.warn('⚠️ [attendance] GPS capture threw unexpectedly:', locErr.message);
    }

    if (!location || location.error) {
      return {
        attendanceType: 'remote',
        latitude: null,
        longitude: null,
        nutritionCenterId: null,
        nearbyCenters: [],
        locationError: location?.error || 'UNKNOWN',
        locationErrorDetail:
          location?.errorDetail ||
          'GPS returned no coordinates (unknown failure)',
        accuracy: null,
      };
    }

    return this.determineAttendanceFromCoords(apiBaseUrl, userId, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy ?? null,
    });
  }
}

export const locationAttendanceService = new LocationAttendanceService();

/**
 * Lightweight helper: silently get GPS location ONLY when user is physically
 * inside a nutrition club (within 100 m).  Returns the club location payload
 * or null (remote, GPS denied, timeout).  Never throws — safe to call before
 * any photo save.
 *
 * @param {string} apiBaseUrl
 * @param {number|string} userId
 * @returns {Promise<{latitude: number, longitude: number, nutritionCenterId: number|null}|null>}
 */
export async function getClubLocationIfNearby(apiBaseUrl, userId) {
  try {
    const result = await locationAttendanceService.determineAttendance(apiBaseUrl, userId);
    if (result.attendanceType === 'club' && result.latitude && result.longitude) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        nutritionCenterId: result.nutritionCenterId || null,
        centerName: result.centerName || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
