/**
 * Location-based attendance tracking service
 * Handles GPS permissions and proximity detection for nutrition centers
 */

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
   * Request GPS location permission and get current position
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async getCurrentLocation() {
    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 0, // No caching
    };

    try {
      const position = await Geolocation.getCurrentPosition(options);
      debugLog('✅ GPS location obtained:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (error) {
      console.warn('⚠️ GPS location error:', error.message, error.code);
      // Detect permission denied specifically
      const isPermissionDenied = 
        error.code === 1 || // GeolocationPositionError.PERMISSION_DENIED
        error.message?.toLowerCase().includes('permission') ||
        error.message?.toLowerCase().includes('denied');
      console.warn('  Error type:', isPermissionDenied ? 'PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE');
      return { error: isPermissionDenied ? 'PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE' };
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
   * Determine attendance type and nutrition center(s) based on GPS location
   * @param {string} apiBaseUrl - API base URL
   * @param {number} userId - User ID
   * @returns {Promise<{attendanceType: string, latitude: number|null, longitude: number|null, nutritionCenterId: number|null, nearbyCenters: Array}>}
   */
  async determineAttendance(apiBaseUrl, userId) {
    try {
      // Get current location
      const location = await this.getCurrentLocation();

      if (!location || location.error) {
        // GPS denied or unavailable -> return error info
        return {
          attendanceType: 'remote',
          latitude: null,
          longitude: null,
          nutritionCenterId: null,
          nearbyCenters: [],
          locationError: location?.error || 'UNKNOWN',
        };
      }

      // Fetch nutrition centers
      const centers = await this.fetchNutritionCenters(apiBaseUrl, userId);
      debugLog(`📍 [attendance] Fetched ${centers.length} nutrition centers for proximity check`);

      if (centers.length === 0) {
        // No centers registered -> remote with GPS coords
        debugLog('⚠️ [attendance] No nutrition centers found - marking as remote');
        return {
          attendanceType: 'remote',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
        };
      }

      // Filter out centers with missing/invalid coordinates
      const centersWithCoords = centers.filter(c => {
        const lat = parseFloat(c.latitude);
        const lon = parseFloat(c.longitude);
        const valid = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
        if (!valid) {
          console.warn(`⚠️ [attendance] Center "${c.center_name}" (id:${c.id}) has invalid coordinates: lat=${c.latitude}, lon=${c.longitude}`);
        }
        return valid;
      });

      if (centersWithCoords.length === 0) {
        debugLog('⚠️ [attendance] All centers have missing/invalid coordinates - marking as remote');
        return {
          attendanceType: 'remote',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
        };
      }

      debugLog(`📍 [attendance] Checking proximity to ${centersWithCoords.length} centers with valid coordinates`);

      // Check proximity to centers - get ALL nearby centers
      const nearbyCenters = this.findNearbyCenters(
        location.latitude,
        location.longitude,
        centersWithCoords
      );

      if (nearbyCenters.length > 0) {
        // Within 100m of center(s) -> club
        // If multiple centers, return them all for user to choose
        // If only one, auto-select it
        return {
          attendanceType: 'club',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: nearbyCenters.length === 1 ? nearbyCenters[0].center.id : null,
          nearbyCenters: nearbyCenters, // Return all nearby centers
          centerName: nearbyCenters.length === 1 ? nearbyCenters[0].center.center_name : null,
        };
      } else {
        // Not near any center -> remote with GPS coords
        return {
          attendanceType: 'remote',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
        };
      }
    } catch (err) {
      console.error('❌ Error determining attendance:', err);
      // Fallback to remote without GPS
      return {
        attendanceType: 'remote',
        latitude: null,
        longitude: null,
        nutritionCenterId: null,
        nearbyCenters: [],
      };
    }
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
