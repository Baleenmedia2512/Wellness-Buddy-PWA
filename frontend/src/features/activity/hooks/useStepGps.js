/**
 * useStepGps.js — Geolocation watch + SharedPrefs poll + native route
 * backfill for the outdoor distance card.
 *
 * The GPS pipeline isn't in the user's hook list but it IS Capacitor
 * integration that the request explicitly says to separate from the UI.
 * Lives next to the other plugin-touching hooks for that reason.
 *
 * Behaviour preserved: on mount we sum the native `route_points` so the
 * distance card is correct regardless of background walking, then run a
 * watchPosition + 5-second poll loop and route every fix through
 * `processGpsPosition`.
 */
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { processGpsPosition } from '../services/stepCounterGpsProcessor';
import { readLastGpsPos, readPersistedDistance } from '../services/stepCounterStorage';
import {
  toDateKey, distanceInMeters,
} from '../services/stepCounterCalculations';
import { GPS_MAX_JUMP_METERS } from '../services/stepCounterConstants';

const seedFromNativeRoute = async (refs, setOutdoorDistance) => {
  try {
    const today = toDateKey();
    const { points: rawJson, date } = await StepCounterPlugin.getBackgroundRoutePoints();
    if (date !== today || !rawJson) return;
    const pts = JSON.parse(rawJson);
    if (!Array.isArray(pts) || pts.length < 2) return;
    let nativeTotal = 0;
    for (let i = 1; i < pts.length; i++) {
      const gap = distanceInMeters(pts[i - 1], pts[i]);
      if (gap < GPS_MAX_JUMP_METERS) nativeTotal += gap;
    }
    if (nativeTotal > refs.outdoorDistanceRef.current) {
      refs.outdoorDistanceRef.current = nativeTotal;
      setOutdoorDistance(nativeTotal);
    }
    const lastPt = pts[pts.length - 1];
    if (lastPt && !refs.lastAcceptedGpsPtRef.current) {
      refs.lastAcceptedGpsPtRef.current = { lat: lastPt.lat, lng: lastPt.lng, timestamp: lastPt.timestamp || Date.now() };
    }
  } catch { /* native unavailable */ }
};

export function useStepGps({ refs, setSuspiciousActivity }) {
  const [lastGpsPos, setLastGpsPos]         = useState(null);
  const [outdoorDistance, setOutdoorDistance] = useState(() => readPersistedDistance(toDateKey()));
  const [outdoorSteps, setOutdoorSteps]     = useState(0);

  // Restore last-known GPS pos (today only) once on mount
  useEffect(() => {
    refs.routeDateRef.current = toDateKey();
    const restored = readLastGpsPos();
    if (restored) setLastGpsPos(restored);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let watchId = null;
    seedFromNativeRoute(refs, setOutdoorDistance);

    const dispatch = (lat, lng, acc, ts, speed = null) => processGpsPosition({
      refs, lat, lng, accuracy: acc, timestamp: ts, speed,
      setOutdoorSteps, setOutdoorDistance, setLastGpsPos, setSuspiciousActivity,
    });

    Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
      (position, err) => {
        if (err || !position) return;
        try {
          const speed = typeof position.coords.speed === 'number' ? position.coords.speed : null;
          dispatch(position.coords.latitude, position.coords.longitude, position.coords.accuracy, position.timestamp || Date.now(), speed);
        } catch { /* silent */ }
      }
    ).then((id) => { watchId = id; }).catch(() => {});

    const poll = async () => {
      try {
        const loc = await StepCounterPlugin.getLastGpsLocation();
        if (!loc.hasLocation || loc.timestamp <= refs.gpsLastTsRef.current) return;
        refs.gpsLastTsRef.current = Number(loc.timestamp) || Date.now();
        dispatch(Number(loc.lat), Number(loc.lng), Number(loc.accuracy), refs.gpsLastTsRef.current);
      } catch { /* silent */ }
    };
    poll();
    refs.gpsIntervalRef.current = setInterval(poll, 5000);

    return () => {
      if (watchId !== null) Geolocation.clearWatch({ id: watchId }).catch(() => {});
      if (refs.gpsIntervalRef.current) clearInterval(refs.gpsIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  return { lastGpsPos, outdoorDistance, outdoorSteps };
}
