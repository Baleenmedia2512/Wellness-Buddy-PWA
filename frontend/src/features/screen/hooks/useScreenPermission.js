/**
 * useScreenPermission.js — slice-internal hook.
 * Owns Android Usage-Access permission state, system-prompt request, and
 * re-checking on app `resume`. UI consumes the simple view-model.
 */
import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  getScreenTimePermissionStatus, requestScreenTimePermission,
} from '../services/screenTimeService';

export function useScreenPermission({ onGranted } = {}) {
  const isNative = Capacitor.isNativePlatform();
  const [granted, setGranted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [issue, setIssue] = useState(null);

  // Initial check on mount.
  useEffect(() => {
    if (!isNative) { setChecked(true); return; }
    let cancelled = false;
    (async () => {
      const status = await getScreenTimePermissionStatus();
      if (cancelled) return;
      setGranted(status.granted);
      setIssue(status.granted ? null : (status.message || null));
      setChecked(true);
      if (status.granted) onGranted?.();
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [isNative]);

  // Re-check on resume (user may have toggled the setting).
  useEffect(() => {
    if (!isNative) return undefined;
    const onResume = async () => {
      const status = await getScreenTimePermissionStatus();
      if (status.granted && !granted) {
        setGranted(true); setIssue(null); onGranted?.();
      } else if (!status.granted) {
        setIssue(status.message || null);
      }
    };
    document.addEventListener('resume', onResume);
    return () => document.removeEventListener('resume', onResume);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [isNative, granted]);

  const request = useCallback(async () => {
    const result = await requestScreenTimePermission();
    if (result?.message) setIssue(result.message);
    setTimeout(async () => {
      const status = await getScreenTimePermissionStatus();
      setGranted(status.granted);
      setIssue(status.granted ? null : (status.message || null));
      if (status.granted) onGranted?.();
    }, 1200);
  }, [onGranted]);

  return { isNative, granted, checked, issue, request };
}
