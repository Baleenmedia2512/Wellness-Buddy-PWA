/**
 * @file useOnlineStatus — subscribes to the browser online/offline
 * events and returns the current connectivity state.
 *
 * SSR-safe: defaults to `true` when `navigator` is unavailable.
 */

import { useEffect, useState } from 'react';

/** @returns {boolean} `true` when the device reports it is online. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => readInitial());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

function readInitial() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
