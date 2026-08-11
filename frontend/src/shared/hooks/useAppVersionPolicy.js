import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  dismissSoftUpdate,
  fetchAppVersionPolicy,
  isSoftUpdateDismissed,
} from '../services/appVersionPolicy.api.js';

/**
 * Server-driven app version gate (native enforced; web lenient unless backend enables enforceWeb).
 */
export function useAppVersionPolicy() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ok');
  const [policy, setPolicy] = useState(null);
  const [softDismissed, setSoftDismissed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchAppVersionPolicy();
    if (!result.ok) {
      // Fail-open on network errors — do not brick the app offline.
      setStatus('ok');
      setPolicy(null);
      setLoading(false);
      return;
    }

    const data = result.data || {};
    const nextStatus = data.status || 'ok';
    setPolicy(data);
    setStatus(nextStatus);
    setSoftDismissed(isSoftUpdateDismissed(data.recommendedVersion));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismissRecommended = useCallback(() => {
    if (policy?.recommendedVersion) {
      dismissSoftUpdate(policy.recommendedVersion);
    }
    setSoftDismissed(true);
  }, [policy?.recommendedVersion]);

  const isNative = (() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();

  const blocked = !loading && status === 'update_required' && (isNative || policy?.enforceWeb);
  const showSoftBanner =
    !loading
    && status === 'update_recommended'
    && !softDismissed
    && (isNative || policy?.enforceWeb);

  return {
    loading,
    status,
    policy,
    blocked,
    showSoftBanner,
    dismissRecommended,
    refresh,
  };
}
