/**
 * userLocationCache — background GPS cache for instant capture-time location.
 *
 * Strategy:
 *   - Start watching after login + location permission.
 *   - Keep latest coords in memory; refresh club/city when the user moves.
 *   - At photo time, read the cache synchronously (no GPS wait / no spinner).
 *
 * Never logs raw lat/lng (PII). Diagnostics use hasCoords / error codes only.
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { locationAttendanceService } from '../../features/nutrition-centers/services/locationAttendanceService';
import { fetchCityVillage } from '../lib/reverseGeocode';
import { debugLog } from '../utils/logger';

const MOVE_THRESHOLD_M = 40;
const ENRICH_DEBOUNCE_MS = 1200;
const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 5000,
};

/** @type {null | {
 *   latitude: number|null,
 *   longitude: number|null,
 *   accuracy: number|null,
 *   updatedAt: number|null,
 *   city: string|null,
 *   village: string|null,
 *   attendanceType: 'club'|'remote'|null,
 *   nutritionCenterId: number|null,
 *   centerName: string|null,
 *   geocodeOk: boolean,
 *   locationStatus: 'success'|'partial'|'failed'|null,
 *   locationErrorCode: string|null,
 *   locationErrorDetail: string|null,
 *   permissionDenied: boolean,
 * }} */
let cache = emptyCache();

let apiBaseUrl = null;
let userId = null;
let watchId = null;
let nativeWatchHandle = null;
let enrichTimer = null;
let enrichInFlight = false;
let started = false;
let lastEnrichedLat = null;
let lastEnrichedLng = null;

function emptyCache() {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    updatedAt: null,
    city: null,
    village: null,
    attendanceType: null,
    nutritionCenterId: null,
    centerName: null,
    geocodeOk: false,
    locationStatus: null,
    locationErrorCode: null,
    locationErrorDetail: null,
    permissionDenied: false,
  };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function needsEnrichment(lat, lng) {
  if (lastEnrichedLat == null || lastEnrichedLng == null) return true;
  return haversineMeters(lastEnrichedLat, lastEnrichedLng, lat, lng) >= MOVE_THRESHOLD_M;
}

/**
 * Synchronous snapshot for photo capture — never waits on GPS.
 */
export function getCachedLocationFields() {
  if (cache.latitude == null || cache.longitude == null) {
    return {
      attendanceType: 'remote',
      nutritionCenterId: null,
      centerName: null,
      city: null,
      village: null,
      permissionDenied: !!cache.permissionDenied,
      locationStatus: 'failed',
      locationErrorCode: cache.locationErrorCode || 'NO_CACHED_LOCATION',
      locationErrorDetail:
        cache.locationErrorDetail ||
        'No cached GPS fix yet — background watcher has not produced coordinates',
      locationLatencyMs: 0,
      geocodeOk: false,
      gpsAccuracyM: null,
      fromCache: true,
      cacheAgeMs: null,
    };
  }

  const cacheAgeMs = cache.updatedAt ? Date.now() - cache.updatedAt : null;
  const hasCity = !!(cache.city || cache.village);

  return {
    latitude: cache.latitude,
    longitude: cache.longitude,
    attendanceType: cache.attendanceType || 'remote',
    nutritionCenterId: cache.nutritionCenterId,
    centerName: cache.centerName,
    city: cache.city,
    village: cache.village,
    permissionDenied: false,
    locationStatus: cache.locationStatus || (hasCity ? 'success' : 'partial'),
    locationErrorCode: cache.locationErrorCode,
    locationErrorDetail: cache.locationErrorDetail,
    locationLatencyMs: 0,
    geocodeOk: !!cache.geocodeOk,
    gpsAccuracyM: cache.accuracy,
    fromCache: true,
    cacheAgeMs,
  };
}

export function isUserLocationCacheStarted() {
  return started;
}

async function enrichFromCoords(lat, lng, accuracy) {
  if (!apiBaseUrl || !userId) return;
  if (enrichInFlight) return;
  enrichInFlight = true;
  try {
    let attendance = await locationAttendanceService.determineAttendanceFromCoords(
      apiBaseUrl,
      userId,
      { latitude: lat, longitude: lng, accuracy },
    );

    if (attendance.nearbyCenters && attendance.nearbyCenters.length > 1) {
      const closest = attendance.nearbyCenters[0];
      attendance = {
        ...attendance,
        nutritionCenterId: closest.center.id,
        centerName: closest.center.center_name,
        attendanceType: 'club',
      };
    }

    const { city, village } = await fetchCityVillage(lat, lng);
    const geocodeOk = !!(city || village);

    cache = {
      ...cache,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy ?? cache.accuracy,
      updatedAt: Date.now(),
      city,
      village,
      attendanceType: attendance.attendanceType || 'remote',
      nutritionCenterId: attendance.nutritionCenterId || null,
      centerName: attendance.centerName || null,
      geocodeOk,
      locationStatus: geocodeOk ? 'success' : 'partial',
      locationErrorCode: attendance.locationError || (geocodeOk ? null : 'GEOCODE_FAILED'),
      locationErrorDetail:
        attendance.locationErrorDetail ||
        (geocodeOk ? null : 'GPS cached OK but reverse-geocode returned no city/village'),
      permissionDenied: false,
    };
    lastEnrichedLat = lat;
    lastEnrichedLng = lng;

    debugLog('[userLocationCache] enriched', {
      locationStatus: cache.locationStatus,
      attendanceType: cache.attendanceType,
      hasCity: !!city,
      hasClubId: cache.nutritionCenterId != null,
      locationErrorCode: cache.locationErrorCode,
    });
  } catch (err) {
    cache = {
      ...cache,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy ?? cache.accuracy,
      updatedAt: Date.now(),
      locationStatus: 'partial',
      locationErrorCode: 'ENRICH_FAILED',
      locationErrorDetail: `Coords cached but club/city enrich failed: ${err?.message || err}`,
      permissionDenied: false,
    };
    console.warn('[userLocationCache] enrich failed', {
      errorCode: 'ENRICH_FAILED',
      errorDetail: err?.message || String(err),
    });
  } finally {
    enrichInFlight = false;
  }
}

function scheduleEnrich(lat, lng, accuracy) {
  if (!needsEnrichment(lat, lng) && cache.attendanceType) {
    // Still refresh timestamp/coords without re-hitting APIs.
    cache = {
      ...cache,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy ?? cache.accuracy,
      updatedAt: Date.now(),
    };
    return;
  }
  if (enrichTimer) clearTimeout(enrichTimer);
  enrichTimer = setTimeout(() => {
    enrichTimer = null;
    void enrichFromCoords(lat, lng, accuracy);
  }, ENRICH_DEBOUNCE_MS);
}

function onPosition(lat, lng, accuracy) {
  cache = {
    ...cache,
    latitude: lat,
    longitude: lng,
    accuracy: accuracy ?? null,
    updatedAt: Date.now(),
    locationStatus: cache.locationStatus || 'partial',
    locationErrorCode: null,
    locationErrorDetail: null,
    permissionDenied: false,
  };
  scheduleEnrich(lat, lng, accuracy);
}

function onPositionError(errorCode, errorDetail, permissionDenied = false) {
  // Keep last good coords if we have them; only mark failure when empty.
  if (cache.latitude != null && cache.longitude != null) {
    console.warn('[userLocationCache] watch error (keeping last fix)', {
      errorCode,
      errorDetail,
    });
    return;
  }
  cache = {
    ...cache,
    locationStatus: 'failed',
    locationErrorCode: errorCode,
    locationErrorDetail: errorDetail,
    permissionDenied,
  };
  console.warn('[userLocationCache] no fix yet', { errorCode, errorDetail });
}

function startBrowserWatch() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onPositionError(
      'LOCATION_UNAVAILABLE',
      'Browser geolocation API not available',
    );
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    },
    (err) => {
      const code = err?.code;
      if (code === 1) {
        onPositionError('PERMISSION_DENIED', `Browser permission denied: ${err.message}`, true);
      } else if (code === 3) {
        onPositionError('GPS_TIMEOUT', `Browser GPS watch timeout: ${err.message}`);
      } else if (code === 2) {
        onPositionError('POSITION_UNAVAILABLE', `Browser position unavailable: ${err.message}`);
      } else {
        onPositionError('LOCATION_UNAVAILABLE', `Browser GPS watch error: ${err?.message || err}`);
      }
    },
    WATCH_OPTIONS,
  );
}

async function startNativeWatch() {
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
        onPositionError(
          'PERMISSION_DENIED',
          `Native location permission not granted (location=${requested.location})`,
          true,
        );
        return;
      }
    }

    nativeWatchHandle = await Geolocation.watchPosition(WATCH_OPTIONS, (pos, err) => {
      if (err) {
        const message = err?.message || String(err);
        const code = err?.code;
        if (
          code === 'UNIMPLEMENTED' ||
          message.toLowerCase().includes('not implemented on web')
        ) {
          startBrowserWatch();
          return;
        }
        if (code === 1 || /permission|denied/i.test(message)) {
          onPositionError('PERMISSION_DENIED', message, true);
        } else if (code === 3 || /timeout/i.test(message)) {
          onPositionError('GPS_TIMEOUT', message);
        } else {
          onPositionError('LOCATION_UNAVAILABLE', message);
        }
        return;
      }
      if (pos?.coords) {
        onPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      }
    });
  } catch (err) {
    const message = err?.message || String(err);
    if (
      err?.code === 'UNIMPLEMENTED' ||
      message.toLowerCase().includes('not implemented on web')
    ) {
      startBrowserWatch();
      return;
    }
    onPositionError('LOCATION_UNAVAILABLE', `Native watch failed: ${message}`);
  }
}

/**
 * Start background location watching. Safe to call repeatedly — no-ops if
 * already started for the same user.
 */
export async function startUserLocationCache({ apiBaseUrl: base, userId: uid }) {
  if (!base || !uid) return;
  if (started && apiBaseUrl === base && String(userId) === String(uid)) return;

  stopUserLocationCache();
  apiBaseUrl = base;
  userId = uid;
  started = true;

  debugLog('[userLocationCache] starting', { userId: String(uid) });

  // One-shot warm-up so the first photo soon after login often has a fix.
  void locationAttendanceService.getCurrentLocation().then((loc) => {
    if (loc && !loc.error && loc.latitude != null) {
      onPosition(loc.latitude, loc.longitude, loc.accuracy);
    } else if (loc?.error) {
      onPositionError(
        loc.error,
        loc.errorDetail || loc.error,
        loc.error === 'PERMISSION_DENIED',
      );
    }
  });

  const useBrowser =
    !Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'web';
  if (useBrowser) {
    startBrowserWatch();
  } else {
    await startNativeWatch();
  }
}

export function stopUserLocationCache() {
  if (enrichTimer) {
    clearTimeout(enrichTimer);
    enrichTimer = null;
  }
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  if (nativeWatchHandle != null) {
    Geolocation.clearWatch({ id: nativeWatchHandle }).catch(() => {});
  }
  nativeWatchHandle = null;
  started = false;
  // Keep last cache across brief restarts; clear only identity binding.
  apiBaseUrl = null;
  userId = null;
}

/** Force a one-shot refresh (e.g. on app resume). Non-blocking. */
export function refreshUserLocationCache() {
  if (!started) return;
  void locationAttendanceService.getCurrentLocation().then((loc) => {
    if (loc && !loc.error && loc.latitude != null) {
      onPosition(loc.latitude, loc.longitude, loc.accuracy);
    }
  });
}
