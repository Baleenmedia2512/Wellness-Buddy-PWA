/**
 * useStepPermissions.js — userId resolution + sensor permission + GPS permission.
 *
 * Three independent identity/access concerns rolled into one hook because
 * they all gate the same downstream behaviour: nothing in the step counter
 * can run until we know who the user is and what permissions are granted.
 */
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  readStoredUserId, writeStoredUserId, readStoredEmail,
} from '../services/stepCounterStorage';

export function useStepPermissions({ userId, refs }) {
  const [resolvedUserId, setResolvedUserId] = useState(() => userId || readStoredUserId());
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [gpsPermission, setGpsPermission] = useState('unknown');

  // Mirror to ref every render so callbacks see the latest value
  refs.resolvedUserIdRef.current = resolvedUserId;

  // ── Multi-source userId resolver: prop → localStorage → API ──────────────
  useEffect(() => {
    if (resolvedUserId) return;
    let cancelled = false;

    const tryResolve = async () => {
      if (userId) { if (!cancelled) setResolvedUserId(userId); return true; }
      const stored = readStoredUserId();
      if (stored) { if (!cancelled) setResolvedUserId(stored); return true; }
      const email = readStoredEmail();
      if (email) {
        try {
          const userId = await getUserId({ email });
          if (userId) {
            writeStoredUserId(userId);
            if (!cancelled) setResolvedUserId(userId);
            return true;
          }
        } catch (e) { console.warn('[StepCounter] userId API fallback failed:', e.message); }
      }
      return false;
    };

    tryResolve().then((resolved) => {
      if (resolved || cancelled) return;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        tryResolve().then((ok) => { if (ok || attempts >= 30) clearInterval(interval); });
      }, 1000);
      refs.resolveIntervalRef.current = interval;
    });

    return () => {
      cancelled = true;
      if (refs.resolveIntervalRef.current) {
        clearInterval(refs.resolveIntervalRef.current);
        refs.resolveIntervalRef.current = null;
      }
    };
  }, [userId, resolvedUserId, refs.resolveIntervalRef]);

  // ── GPS permission probe (native only) ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!Capacitor.isNativePlatform()) { setGpsPermission('granted'); return; }
    Geolocation.checkPermissions()
      .then((perm) => {
        if (cancelled) return;
        const granted = perm?.location === 'granted' || perm?.coarseLocation === 'granted';
        setGpsPermission(granted ? 'granted' : 'denied');
      })
      .catch(() => { if (!cancelled) setGpsPermission('denied'); });
    return () => { cancelled = true; };
  }, []);

  /** Ask Android for the activity recognition permission and remember the verdict. */
  const requestSensorPermission = useCallback(async (initStepTracking) => {
    try {
      const permission = await StepCounterPlugin.requestPermission();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);
      if (granted && typeof initStepTracking === 'function') await initStepTracking();
    } catch (err) {
      console.error('[StepCounter] Permission request failed:', err);
    }
  }, []);

  return {
    resolvedUserId, sensorAvailable, setSensorAvailable,
    permissionGranted, setPermissionGranted,
    gpsPermission, requestSensorPermission,
  };
}
