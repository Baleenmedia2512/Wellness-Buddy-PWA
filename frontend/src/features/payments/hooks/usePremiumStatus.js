import { useCallback, useEffect, useState } from 'react';
import { premiumStatusStore } from '../services/premiumStatus';

/**
 * Premium state for one member, shared with every screen that shows it.
 * Pass null to skip the check. Any failure leaves the member as not Premium.
 * @param {string|number|null} userId
 * @returns {{ premium: boolean, refresh: () => Promise<boolean> }}
 */
export default function usePremiumStatus(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [premium, setPremium] = useState(() => (key ? premiumStatusStore.get(key) : false));

  useEffect(() => {
    if (!key) {
      setPremium(false);
      return undefined;
    }
    setPremium(premiumStatusStore.get(key));
    const unsubscribe = premiumStatusStore.subscribe(key, setPremium);
    premiumStatusStore.load(key);
    return unsubscribe;
  }, [key]);

  const refresh = useCallback(
    () => (key ? premiumStatusStore.load(key, { force: true }) : Promise.resolve(false)),
    [key],
  );

  return { premium, refresh };
}
