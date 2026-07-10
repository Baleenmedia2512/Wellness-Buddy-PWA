import { useEffect, useState } from 'react';
import { todayDateInIST } from '../../../shared/utils/timezoneUtils';

/**
 * Live IST calendar date (YYYY-MM-DD). Updates when:
 * - the app resumes from background (visibility / focus)
 * - the clock crosses midnight IST (polled every 60s)
 *
 * Do NOT use `useMemo(() => todayDateInIST(), [])` — that freezes yesterday
 * if the PWA stayed open overnight.
 */
export function useISTToday() {
  const [today, setToday] = useState(() => todayDateInIST());

  useEffect(() => {
    const sync = () => {
      const next = todayDateInIST();
      setToday((prev) => (prev === next ? prev : next));
    };

    sync();
    const interval = setInterval(sync, 60_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return today;
}
