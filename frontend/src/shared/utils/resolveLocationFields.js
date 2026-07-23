/**
 * shared/utils/resolveLocationFields.js
 * ---------------------------------------------------------------------------
 * Resolves GPS-based location + nutrition-center attendance data for any
 * feature that needs to attach location fields to a DB write (weight, food,
 * education).
 *
 * Prefers the background userLocationCache (instant). Falls back to a live
 * GPS fix only when the cache has no coordinates.
 *
 * Diagnostic fields (strip before DB write):
 *   locationStatus, locationErrorCode, locationErrorDetail, locationLatencyMs,
 *   geocodeOk, permissionDenied, gpsAccuracyM, fromCache, cacheAgeMs
 * ---------------------------------------------------------------------------
 */
import { locationAttendanceService } from '../../features/nutrition-centers';
import { fetchCityVillage } from '../lib/reverseGeocode';
import { getCachedLocationFields } from '../services/userLocationCache';
import { debugLog } from './logger';

/** Fields that must never be spread into food/weight/education DB payloads. */
export const LOCATION_DIAGNOSTIC_KEYS = [
  'permissionDenied',
  'locationStatus',
  'locationErrorCode',
  'locationErrorDetail',
  'locationLatencyMs',
  'geocodeOk',
  'gpsAccuracyM',
  'fromCache',
  'cacheAgeMs',
];

export function stripLocationDiagnostics(fields = {}) {
  const out = { ...fields };
  for (const key of LOCATION_DIAGNOSTIC_KEYS) {
    delete out[key];
  }
  return out;
}

export async function resolveLocationFields(apiBaseUrl, userId) {
  const startedAt = Date.now();

  const fail = (code, detail, extra = {}) => {
    const latencyMs = Date.now() - startedAt;
    debugLog('[resolveLocationFields] FAILED', { code, detail, latencyMs });
    return {
      attendanceType: 'remote',
      nutritionCenterId: null,
      centerName: null,
      city: null,
      village: null,
      permissionDenied: code === 'PERMISSION_DENIED',
      locationStatus: 'failed',
      locationErrorCode: code,
      locationErrorDetail: detail,
      locationLatencyMs: latencyMs,
      geocodeOk: false,
      gpsAccuracyM: null,
      fromCache: false,
      ...extra,
    };
  };

  try {
    if (!userId) {
      return fail('NO_USER_ID', 'Cannot resolve location — userId missing');
    }

    // Instant path: background watcher already has a fix.
    const cached = getCachedLocationFields();
    if (cached.latitude != null && cached.longitude != null) {
      debugLog('[resolveLocationFields] using cache', {
        locationStatus: cached.locationStatus,
        attendanceType: cached.attendanceType,
        cacheAgeMs: cached.cacheAgeMs,
        hasCity: !!cached.city,
      });
      return cached;
    }

    let attendance = await locationAttendanceService.determineAttendance(
      apiBaseUrl,
      userId,
    );
    debugLog('[resolveLocationFields] live GPS attendance', {
      attendanceType: attendance.attendanceType,
      hasCoords: !!(attendance.latitude && attendance.longitude),
      locationError: attendance.locationError || null,
      nearbyCount: attendance.nearbyCenters?.length || 0,
    });

    if (attendance.nearbyCenters && attendance.nearbyCenters.length > 1) {
      const closest = attendance.nearbyCenters[0];
      attendance = {
        ...attendance,
        nutritionCenterId: closest.center.id,
        centerName: closest.center.center_name,
        attendanceType: 'club',
      };
    }

    const permissionDenied = attendance.locationError === 'PERMISSION_DENIED';

    if (!attendance.latitude || !attendance.longitude) {
      const code = attendance.locationError || 'LOCATION_UNAVAILABLE';
      const detail =
        attendance.locationErrorDetail ||
        'No GPS coordinates returned from device';
      return fail(code, detail, { permissionDenied });
    }

    const { city, village } = await fetchCityVillage(
      attendance.latitude,
      attendance.longitude,
    );
    const geocodeOk = !!(city || village);

    const locationErrorCode =
      attendance.locationError ||
      (!geocodeOk ? 'GEOCODE_FAILED' : null);
    const locationErrorDetail =
      attendance.locationErrorDetail ||
      (!geocodeOk
        ? 'GPS OK but Nominatim reverse-geocode returned no city/village'
        : null);

    return {
      latitude: attendance.latitude,
      longitude: attendance.longitude,
      attendanceType: attendance.attendanceType,
      nutritionCenterId: attendance.nutritionCenterId || null,
      centerName: attendance.centerName || null,
      city,
      village,
      permissionDenied: false,
      locationStatus: geocodeOk ? 'success' : 'partial',
      locationErrorCode,
      locationErrorDetail,
      locationLatencyMs: Date.now() - startedAt,
      geocodeOk,
      gpsAccuracyM:
        typeof attendance.accuracy === 'number' ? attendance.accuracy : null,
      fromCache: false,
    };
  } catch (err) {
    return fail(
      'UNEXPECTED_ERROR',
      `resolveLocationFields threw: ${err?.message || err}`,
    );
  }
}
