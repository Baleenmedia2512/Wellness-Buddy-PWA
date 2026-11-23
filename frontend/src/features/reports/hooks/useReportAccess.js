import { useCallback, useEffect, useState } from 'react';
import { blankEntitlement } from '../../payments/domain/entitlementSnapshot';
import { premiumStatusStore, watchEntitlementUser } from '../../payments/services/premiumStatus';
import { startReportTrial } from '../services/reportAccessApi';

const EMPTY = {
  loaded: false,
  access: 'none',
  daysLeft: null,
  expiresAtDisplay: null,
  canSeeDetails: false,
  error: '',
  starting: false,
};

function viewOf(snapshot, { error = '', starting = false } = {}) {
  const access = snapshot?.access || 'none';
  const onTrial = access === 'trial';
  return {
    loaded: snapshot?.reportLoaded === true,
    access,
    daysLeft: access === 'premium' ? (snapshot.daysLeft ?? null) : (onTrial || access === 'ended' ? snapshot.trialDaysLeft : null),
    expiresAtDisplay: onTrial ? (snapshot.trialExpiresAtDisplay ?? null) : (access === 'premium' ? snapshot.expiresAtDisplay : null),
    canSeeDetails: snapshot?.canSeeReportDetails === true,
    error,
    starting,
  };
}

/**
 * Report access from the shared entitlement snapshot.
 * Pass null to leave details locked and skip the request.
 * @param {string|number|null} userId
 */
export default function useReportAccess(userId) {
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
      setError('Could not check report access');
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
      const access = await startReportTrial(key);
      premiumStatusStore.applyReport(key, access);
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
