/**
 * shared/utils/resolveLocationFields.js
 * ---------------------------------------------------------------------------
 * Resolves GPS-based location + nutrition-center attendance data for any
 * feature that needs to attach location fields to a DB write (weight, food,
 * education). Previously duplicated inline across performWeightSave,
 * saveEducationLog, and performNutritionSave in App.js.
 *
 * Extraction: Refactor phase 1 (2026-07-16)
 * Behavior: byte-identical to the three inlined GPS blocks it replaces.
 *
 * Returns a plain object — never throws. GPS failures fall back gracefully
 * to { attendanceType: 'remote' } so callers can always spread the result
 * into a save payload without branching.
 *
 * When multiple clubs are detected, the closest one (first in the
 * nearbyCenters array, already distance-sorted by determineAttendance) is
 * auto-selected. Callers that display a club-selection modal can override
 * the returned nutritionCenterId / centerName with the user's explicit pick.
 *
 * @param {string} apiBaseUrl
 * @param {string|number} userId
 * @returns {Promise<LocationFields>}
 *
 * LocationFields shape:
 * {
 *   latitude?:          number         — present only when GPS fix acquired
 *   longitude?:         number         — present only when GPS fix acquired
 *   attendanceType:     'club'|'remote'
 *   nutritionCenterId:  number | null
 *   centerName:         string | null
 *   city:               string | null
 *   village:            string | null
 *   permissionDenied:   boolean        — true when location permission was denied
 * }
 *
 * NOTE: Strip `permissionDenied` before spreading into a DB payload:
 *   const { permissionDenied, ...payloadFields } = await resolveLocationFields(…);
 * ---------------------------------------------------------------------------
 */
import { locationAttendanceService } from '../../features/nutrition-centers';
import { fetchCityVillage } from '../lib/reverseGeocode';
import { debugLog } from './logger';

export async function resolveLocationFields(apiBaseUrl, userId) {
  let attendance;

  try {
    attendance = await locationAttendanceService.determineAttendance(
      apiBaseUrl,
      userId,
    );
    debugLog('[resolveLocationFields] Attendance determined:', attendance);

    // When multiple clubs are nearby, auto-select the closest one.
    // The array is already sorted ascending by distance by determineAttendance.
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
        centerName:        closest.center.center_name,
        attendanceType:    'club',
      };
    }

    const permissionDenied = attendance.locationError === 'PERMISSION_DENIED';

    // No GPS fix — return remote attendance without attempting geocoding.
    if (!attendance.latitude || !attendance.longitude) {
      return {
        attendanceType:    attendance.attendanceType || 'remote',
        nutritionCenterId: attendance.nutritionCenterId || null,
        centerName:        attendance.centerName || null,
        city:              null,
        village:           null,
        permissionDenied,
      };
    }

    // Reverse-geocode coordinates into city + village.
    // fetchCityVillage never throws — returns null fields on any failure.
    const { city, village } = await fetchCityVillage(
      attendance.latitude,
      attendance.longitude,
    );

    return {
      latitude:          attendance.latitude,
      longitude:         attendance.longitude,
      attendanceType:    attendance.attendanceType,
      nutritionCenterId: attendance.nutritionCenterId || null,
      centerName:        attendance.centerName || null,
      city,
      village,
      permissionDenied,
    };
  } catch (err) {
    debugLog(
      '[resolveLocationFields] GPS failed, falling back to remote:',
      err?.message,
    );
    return {
      attendanceType:    'remote',
      nutritionCenterId: null,
      centerName:        null,
      city:              null,
      village:           null,
      permissionDenied:  false,
    };
  }
}
