import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { fetchAppVersionPolicy } from '../services/appVersionPolicy.api.js';
import {
  APP_UPDATE_EVENT,
  readForcedUpdatePolicy,
  clearForcedUpdatePolicy,
} from '../services/appVersionEnforce.client.js';

/**
 * Server-driven app version gate (mandatory updates only).
 * Once the server returns update_required (policy API or 426 on critical APIs),
 * keep blocking even if a later refresh fails.
 * update_recommended from the server is ignored — no optional update UI.
 */
export function useAppVersionPolicy() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ok');
  const [policy, setPolicy] = useState(null);
  const [hardBlocked, setHardBlocked] = useState(() => Boolean(readForcedUpdatePolicy()));

  const applyForcedFromApi = useCallback((forcedPolicy) => {
    if (!forcedPolicy) return;
    setHardBlocked(true);
    setStatus('update_required');
    setPolicy((prev) => ({ ...(prev || {}), ...forcedPolicy }));
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const result = await fetchAppVersionPolicy();
    if (!result.ok) {
      // Network fail: fall back to persisted 426 block so old clients stay blocked.
      const forced = readForcedUpdatePolicy();
      if (forced) {
        applyForcedFromApi(forced);
        return 'update_required';
      }
      if (!hardBlocked) {
        setStatus('ok');
        setPolicy(null);
      }
      setLoading(false);
      return hardBlocked ? 'update_required' : 'ok';
    }

    const data = result.data || {};
    const nextStatus = data.status || 'ok';
    if (nextStatus === 'update_required') {
      setHardBlocked(true);
    } else if (nextStatus === 'ok') {
      setHardBlocked(false);
      clearForcedUpdatePolicy();
    }
    setPolicy(data);
    setStatus(nextStatus);
    setLoading(false);
    return nextStatus;
  }, [hardBlocked, applyForcedFromApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onForced = (event) => {
      applyForcedFromApi(event?.detail || readForcedUpdatePolicy());
    };
    window.addEventListener(APP_UPDATE_EVENT, onForced);
    return () => window.removeEventListener(APP_UPDATE_EVENT, onForced);
  }, [applyForcedFromApi]);

  const blocked = hardBlocked || (!loading && status === 'update_required');

  let nativePlatform = false;
  try {
    nativePlatform = Capacitor.isNativePlatform();
  } catch {
    nativePlatform = false;
  }

  useEffect(() => {
    if (!nativePlatform) return undefined;
    let handle = null;
    let cancelled = false;
    import('../services/nativeLifecycle')
      .then((nativeLifecycle) =>
        nativeLifecycle.addAppStateListener(({ isActive }) => {
          if (isActive && !cancelled) refresh();
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
  }, [refresh, nativePlatform]);

  return {
    loading,
    status,
    policy,
    blocked,
    refresh,
  };
}
