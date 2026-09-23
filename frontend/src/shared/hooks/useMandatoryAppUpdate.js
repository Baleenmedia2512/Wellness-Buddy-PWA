import { useCallback, useEffect, useRef, useState } from 'react';
import {
  shouldRunMandatoryUpdate,
  startMandatoryUpdateFlow,
  nextPhaseFromNativeEvent,
  shouldAutoStartPlayOnForeground,
  getMandatoryUpdatePlatform,
} from '../services/mandatoryAppUpdate.js';

/**
 * Drives platform-specific mandatory update flows when the server policy blocks the app.
 *
 * Android: triggers Google Play IMMEDIATE update once when blocked; after cancel/fail
 * waits for an explicit "Update Now" tap (avoids Play update loops).
 * iOS: blocking screen only — user opens App Store via AppVersionHardBlock.
 *
 * @param {{ blocked: boolean, status: string, refresh: () => Promise<void> }} versionPolicy
 */
export function useMandatoryAppUpdate(versionPolicy) {
  const [phase, setPhase] = useState('idle');
  const [playUnavailable, setPlayUnavailable] = useState(false);
  const listenersAttached = useRef(false);
  const activeRef = useRef(false);
  const autoStartedForBlockRef = useRef(false);
  const phaseRef = useRef(phase);

  const platform = getMandatoryUpdatePlatform();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const triggerAndroidMandatoryUpdate = useCallback(async () => {
    if (platform !== 'android') return;
    setPhase('starting');
    setPlayUnavailable(false);
    try {
      const { startMandatoryUpdate, addUpdateListener } = await import(
        '../plugins/inAppUpdatePlugin.js'
      );

      if (!listenersAttached.current) {
        const events = [
          'updateAvailable',
          'updateNotAvailable',
          'updateInstalled',
          'updateFailed',
          'updateCanceled',
        ];
        events.forEach((eventName) => {
          addUpdateListener(eventName, () => {
            setPhase((prev) => nextPhaseFromNativeEvent(eventName, prev));
            if (eventName === 'updateNotAvailable' || eventName === 'updateFailed') {
              setPlayUnavailable(true);
            }
            if (eventName === 'updateInstalled') {
              versionPolicy.refresh?.();
            }
          });
        });
        listenersAttached.current = true;
      }

      await startMandatoryUpdateFlow({ startMandatoryUpdate, platform: 'android' });
      setPhase((prev) => (prev === 'awaiting_retry' || prev === 'play_unavailable' ? prev : 'play_flow'));
    } catch {
      setPlayUnavailable(true);
      setPhase('play_unavailable');
    }
  }, [platform, versionPolicy]);

  // Start mandatory flow once when server first blocks the app.
  useEffect(() => {
    const shouldRun = shouldRunMandatoryUpdate(versionPolicy);
    if (!shouldRun) {
      activeRef.current = false;
      autoStartedForBlockRef.current = false;
      setPhase('idle');
      setPlayUnavailable(false);
      return undefined;
    }

    activeRef.current = true;

    if (platform === 'android') {
      if (!autoStartedForBlockRef.current) {
        autoStartedForBlockRef.current = true;
        triggerAndroidMandatoryUpdate();
      }
    } else {
      setPhase('ios_store_only');
    }

    return () => {
      activeRef.current = false;
    };
  }, [versionPolicy.blocked, versionPolicy.status, platform, triggerAndroidMandatoryUpdate]);

  // Re-verify version when app returns from background / Play Store.
  // Do not auto-reopen Play after cancel — only refresh policy (success clears block).
  useEffect(() => {
    if (!shouldRunMandatoryUpdate(versionPolicy)) return undefined;

    let handle = null;
    let cancelled = false;

    import('../services/nativeLifecycle')
      .then((nativeLifecycle) =>
        nativeLifecycle.addAppStateListener(({ isActive }) => {
          if (!isActive || cancelled) return;

          versionPolicy.refresh?.().then((status) => {
            if (cancelled || !activeRef.current) return;
            if (
              platform === 'android'
              && shouldAutoStartPlayOnForeground({ status, phase: phaseRef.current })
            ) {
              triggerAndroidMandatoryUpdate();
            }
          });
        }),
      )
      .then((h) => {
        if (cancelled) h?.remove?.();
        else handle = h;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        handle?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, [
    versionPolicy.blocked,
    versionPolicy.status,
    versionPolicy.refresh,
    platform,
    triggerAndroidMandatoryUpdate,
  ]);

  const retryUpdate = useCallback(() => {
    if (platform === 'android') {
      triggerAndroidMandatoryUpdate();
      return;
    }
    // iOS: caller opens App Store from the blocking screen.
  }, [platform, triggerAndroidMandatoryUpdate]);

  return {
    phase,
    playUnavailable,
    platform,
    retryUpdate,
  };
}
