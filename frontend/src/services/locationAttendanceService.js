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
   * Find the nearest nutrition center within proximity radius
   * @param {number} userLat - User's latitude
   * @param {number} userLon - User's longitude
   * @param {Array} centers - Array of nutrition centers
   * @returns {{center: Object, distance: number} | null}
   */
  findNearestCenter(userLat, userLon, centers) {
    if (!centers || centers.length === 0) {
      return null;
    }

    let nearestCenter = null;
    let minDistance = Infinity;

    for (const center of centers) {
      const distance = this.calculateDistance(
        userLat,
        userLon,
        parseFloat(center.latitude),
        parseFloat(center.longitude)
      );

      if (distance <= this.PROXIMITY_RADIUS_METERS && distance < minDistance) {
        nearestCenter = center;
        minDistance = distance;
      }
    }

    if (nearestCenter) {
      console.log(`✅ Found nearby center: ${nearestCenter.center_name} (${Math.round(minDistance)}m away)`);
      return { center: nearestCenter, distance: minDistance };
    }

    console.log(`⚠️ No centers within ${this.PROXIMITY_RADIUS_METERS}m radius`);
    return null;
  }

  /**
   * Fetch nutrition centers for proximity check
   * @param {string} apiBaseUrl - API base URL
   * @param {number} userId - User ID
   * @returns {Promise<Array>}
   */
  async fetchNutritionCenters(apiBaseUrl, userId) {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/get-nutrition-centers?userId=${userId}&teamFilter=full`,
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
   * Determine attendance type and nutrition center based on GPS location
   * @param {string} apiBaseUrl - API base URL
   * @param {number} userId - User ID
   * @returns {Promise<{attendanceType: string, latitude: number|null, longitude: number|null, nutritionCenterId: number|null}>}
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
        };
      }

      // Check proximity to centers
      const nearest = this.findNearestCenter(
        location.latitude,
        location.longitude,
        centers
      );

      if (nearest) {
        // Within 100m of a center -> club
        return {
          attendanceType: 'club',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: nearest.center.id,
        };
      } else {
        // Not near any center -> remote with GPS coords
        return {
          attendanceType: 'remote',
          latitude: location.latitude,
          longitude: location.longitude,
          nutritionCenterId: null,
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
      };
    }
  }
}

export const locationAttendanceService = new LocationAttendanceService();
