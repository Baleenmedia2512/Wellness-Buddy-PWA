/**
 * shared/utils/resolveLocationFields.js
 * ---------------------------------------------------------------------------
 * Resolves GPS-based location + nutrition-center attendance data for any
 * feature that needs to attach location fields to a DB write (weight, food,
 * education).
 *
 * Returns a plain object — never throws. GPS failures fall back gracefully
 * to { attendanceType: 'remote' } so callers can always spread the result
 * into a save payload without branching.
 *
 * Diagnostic fields (strip before DB write):
 *   locationStatus, locationErrorCode, locationErrorDetail, locationLatencyMs,
 *   geocodeOk, permissionDenied, gpsAccuracyM
 *
 * NOTE: Strip diagnostics before spreading into a DB payload:
 *   const { permissionDenied, locationStatus, locationErrorCode,
 *           locationErrorDetail, locationLatencyMs, geocodeOk, gpsAccuracyM,
 *           ...payloadFields } = await resolveLocationFields(…);
 * ---------------------------------------------------------------------------
 */
import { locationAttendanceService } from '../../features/nutrition-centers';
import { fetchCityVillage } from '../lib/reverseGeocode';
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
      ...extra,
    };
  };

  try {
    if (!userId) {
      return fail('NO_USER_ID', 'Cannot resolve location — userId missing');
    }

    let attendance = await locationAttendanceService.determineAttendance(
      apiBaseUrl,
      userId,
    );
    debugLog('[resolveLocationFields] Attendance determined:', {
      attendanceType: attendance.attendanceType,
      hasCoords: !!(attendance.latitude && attendance.longitude),
      locationError: attendance.locationError || null,
      nearbyCount: attendance.nearbyCenters?.length || 0,
    });

    // When multiple clubs are nearby, auto-select the closest one.
    if (attendance.nearbyCenters && attendance.nearbyCenters.length > 1) {
      const closest = attendance.nearbyCenters[0];
      debugLog(
        '[resolveLocationFields] Multiple clubs — auto-selecting:',
        closest.center.center_name,
        `(${Math.round(closest.distance)}m)`,
      );
      attendance = {
        ...attendance,
        nutritionCenterId: closest.center.id,
        centerName: closest.center.center_name,
        attendanceType: 'club',
      };
    }

    const latencyMs = Date.now() - startedAt;
    const permissionDenied = attendance.locationError === 'PERMISSION_DENIED';

    // No GPS fix — return remote attendance without attempting geocoding.
    if (!attendance.latitude || !attendance.longitude) {
      const code = attendance.locationError || 'LOCATION_UNAVAILABLE';
      const detail =
        attendance.locationErrorDetail ||
        'No GPS coordinates returned from device';
      return fail(code, detail, { permissionDenied });
    }

    // Reverse-geocode coordinates into city + village.
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

    const result = {
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
    };

    debugLog('[resolveLocationFields] OK', {
      locationStatus: result.locationStatus,
      attendanceType: result.attendanceType,
      hasCity: !!city,
      hasVillage: !!village,
      geocodeOk,
      locationErrorCode,
      locationLatencyMs: result.locationLatencyMs,
      priorLatencyMs: latencyMs,
    });

    return result;
  } catch (err) {
    return fail(
      'UNEXPECTED_ERROR',
      `resolveLocationFields threw: ${err?.message || err}`,
    );
  }
}
