import { useEffect, useState } from 'react';
import {
  todayBusinessDate,
  DEFAULT_BUSINESS_TIMEZONE,
  resolveBusinessTimezone,
} from '../utils/datetimeUtils';

/**
 * Live business-calendar date (YYYY-MM-DD). Updates on resume and every 60s.
 * @param {string|object|null} [timezoneSource] IANA string or user object with `.timezone`
 */
export function useBusinessToday(timezoneSource = null) {
  const timezoneIana = resolveBusinessTimezone(timezoneSource) || DEFAULT_BUSINESS_TIMEZONE;
  const [today, setToday] = useState(() => todayBusinessDate(timezoneIana));

  useEffect(() => {
    const sync = () => {
      const next = todayBusinessDate(timezoneIana);
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
  }, [timezoneIana]);

  return today;
}
