/**
 * @file useCameraPermission — placeholder hook that exposes camera
 * permission state and a `request()` action.
 *
 * Falls back to the browser Permissions API where available. The
 * Capacitor Camera plugin (when running natively) should be wired
 * in once the camera service is consolidated; this stub keeps the
 * call-site signature stable in the meantime.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * @typedef {'unknown'|'granted'|'denied'|'prompt'|'unsupported'} CameraPermissionState
 */

/**
 * @returns {{ state: CameraPermissionState, request: () => Promise<CameraPermissionState> }}
 */
export function useCameraPermission() {
  const [state, setState] = useState(/** @type {CameraPermissionState} */ ('unknown'));

  useEffect(() => {
    let cancelled = false;
    queryPermission().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => { cancelled = true; };
  }, []);

  const request = useCallback(async () => {
    const next = await requestPermission();
    setState(next);
    return next;
  }, []);

  return { state, request };
}

/** @returns {Promise<CameraPermissionState>} */
async function queryPermission() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported';
  }
  try {
    const result = await navigator.permissions.query({ name: /** @type {PermissionName} */ ('camera') });
    return /** @type {CameraPermissionState} */ (result.state);
  } catch {
    return 'unsupported';
  }
}

/** @returns {Promise<CameraPermissionState>} */
async function requestPermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err) {
    if (err && /** @type {any} */ (err).name === 'NotAllowedError') return 'denied';
    return 'denied';
  }
}
