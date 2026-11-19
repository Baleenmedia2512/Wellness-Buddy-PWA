import { useCallback, useEffect, useState } from 'react';
import { blankEntitlement } from '../../payments/domain/entitlementSnapshot';
import { premiumStatusStore, watchEntitlementUser } from '../../payments/services/premiumStatus';
import { startEventsTrial } from '../services/eventsAccessApi';

const EMPTY = {
  loaded: false,
  access: 'none',
  daysLeft: null,
  canUseHostTools: false,
  error: '',
  starting: false,
};

function viewOf(snapshot, { error = '', starting = false } = {}) {
  const access = snapshot?.access || 'none';
  return {
    loaded: snapshot?.reportLoaded === true,
    access,
    daysLeft: access === 'trial' || access === 'ended' ? (snapshot.trialDaysLeft ?? null) : (snapshot.daysLeft ?? null),
    canUseHostTools: snapshot?.canUseHostTools === true,
    error,
    starting,
  };
}

/**
 * Digital Portfolio access from the same snapshot as Reports.
 * Pass null to leave tools locked and skip the request.
 * @param {string|number|null} userId
 */
export default function useEventsAccess(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const snapshot = key ? premiumStatusStore.getStatus(key) : blankEntitlement();
  void version;

  useEffect(() => {
    if (!key) return undefined;
    setError('');
    const unsubscribe = premiumStatusStore.subscribe(key, () => setVersion((value) => value + 1));
    const current = premiumStatusStore.getStatus(key);
    premiumStatusStore.load(key, { force: current.reportLoaded !== true });
    const stopWatch = watchEntitlementUser(key);
    return () => {
      unsubscribe();
      stopWatch();
    };
  }, [key]);

  const refresh = useCallback(async () => {
    if (!key) return null;
    await premiumStatusStore.load(key, { force: true });
    const next = premiumStatusStore.getStatus(key);
    if (next.reportLoaded !== true) {
      setError('Could not check event access');
      return null;
    }
    setError('');
    return viewOf(next);
  }, [key]);

  const startTrial = useCallback(async () => {
    if (!key) return null;
    setStarting(true);
    setError('');
    try {
      const access = await startEventsTrial(key);
      premiumStatusStore.applyReport(key, {
        access: access.access,
        daysLeft: access.daysLeft,
        canUseHostTools: access.canUseHostTools === true,
        canSeeDetails: access.canUseHostTools === true,
      });
      await premiumStatusStore.load(key, { force: true });
      setStarting(false);
      return access;
    } catch (startError) {
      setStarting(false);
      setError(startError?.message || 'The free trial could not be started');
      return null;
    }
  }, [key]);

  if (!key) return { ...EMPTY, loaded: true, refresh, startTrial };
  return { ...viewOf(snapshot, { error, starting }), refresh, startTrial };
}
