import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { blankEntitlement } from '../domain/entitlementSnapshot';
import { clearPremiumThemeClass, premiumStatusStore, watchEntitlementUser } from '../services/premiumStatus';

/**
 * Premium state for one member, shared with every screen that shows it.
 * Pass null to skip the check and clear the theme. A failed check keeps the
 * last confirmed answer for this member.
 * @param {string|number|null} userId
 */
export default function usePremiumStatus(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [version, setVersion] = useState(0);
  const status = key ? premiumStatusStore.getStatus(key) : blankEntitlement();
  void version;

  useEffect(() => {
    if (!key) return undefined;
    const unsubscribe = premiumStatusStore.subscribe(key, () => setVersion((value) => value + 1));
    premiumStatusStore.load(key);
    const stopWatch = watchEntitlementUser(key);
    return () => {
      unsubscribe();
      stopWatch();
    };
  }, [key]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!key) {
      clearPremiumThemeClass();
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
