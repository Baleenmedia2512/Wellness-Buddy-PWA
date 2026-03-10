/**
 * Location-based attendance tracking service
 * Handles GPS permissions and proximity detection for nutrition centers
 */

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
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('⚠️ Geolocation not supported by this browser');
        resolve(null);
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0, // No caching
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ GPS location obtained:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn('⚠️ GPS location error:', error.message);
          console.warn('  Code:', error.code);
          console.warn('  Permission denied or not available');
          resolve(null); // Return null instead of throwing error
        },
        options
      );
    });
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
      console.log(`✅ Found ${nearbyCenters.length} center(s) within ${this.PROXIMITY_RADIUS_METERS}m:`);
      nearbyCenters.forEach((nc, idx) => {
        console.log(`  ${idx + 1}. ${nc.center.center_name} (${Math.round(nc.distance)}m away)`);
      });
    } else {
      console.log(`⚠️ No centers within ${this.PROXIMITY_RADIUS_METERS}m radius`);
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
        `${apiBaseUrl}/api/get-nutrition-centers?userId=${userId}&teamFilter=full&scope=all`,
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

      if (!location) {
        // GPS denied or unavailable -> remote by default
        return {
          attendanceType: 'remote',
          latitude: null,
          longitude: null,
          nutritionCenterId: null,
          nearbyCenters: [],
        };
      }

      // Fetch nutrition centers
      const centers = await this.fetchNutritionCenters(apiBaseUrl, userId);

      if (centers.length === 0) {
        // No centers registered -> remote with GPS coords
        return {
          attendanceType: 'remote',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: null,
          nearbyCenters: [],
        };
      }

      // Check proximity to centers - get ALL nearby centers
      const nearbyCenters = this.findNearbyCenters(
        location.latitude,
        location.longitude,
        centers
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
