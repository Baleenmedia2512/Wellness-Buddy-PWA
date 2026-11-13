import { useCallback, useEffect, useState } from 'react';
import { INACTIVE_PREMIUM_STATUS } from '../domain/premiumStatusStore';
import { premiumStatusStore } from '../services/premiumStatus';

/**
 * Premium state for one member, shared with every screen that shows it.
 * Pass null to skip the check. Any failure leaves the member as not Premium.
 * @param {string|number|null} userId
 * @returns {{
 *   premium: boolean,
 *   daysLeft: number|null,
 *   expiresAt: string|null,
 *   expiresAtDisplay: string|null,
 *   showExpiryWarning: boolean,
 *   refresh: () => Promise<boolean>,
 * }}
 */
export default function usePremiumStatus(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [status, setStatus] = useState(() => (
    key ? premiumStatusStore.getStatus(key) : { ...INACTIVE_PREMIUM_STATUS }
  ));

  useEffect(() => {
    if (!key) {
      setStatus({ ...INACTIVE_PREMIUM_STATUS });
      return undefined;
    }
    setStatus(premiumStatusStore.getStatus(key));
    const unsubscribe = premiumStatusStore.subscribe(key, setStatus);
    premiumStatusStore.load(key);
    return unsubscribe;
  }, [key]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!key) {
      document.documentElement.classList.remove('premium-theme');
      return undefined;
    }
    document.documentElement.classList.toggle('premium-theme', status.premium === true);
    return undefined;
  }, [key, status.premium]);

  const refresh = useCallback(
    () => (key ? premiumStatusStore.load(key, { force: true }) : Promise.resolve(false)),
    [key],
  );

  return {
    premium: status.premium === true,
    daysLeft: status.daysLeft ?? null,
    expiresAt: status.expiresAt ?? null,
    expiresAtDisplay: status.expiresAtDisplay ?? null,
    showExpiryWarning: status.showExpiryWarning === true,
    refresh,
  };
}
