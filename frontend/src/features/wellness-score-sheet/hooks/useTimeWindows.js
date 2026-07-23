import { useEffect, useState } from 'react';
import { getTimeWindows } from '../../misc/services/misc.api';

/**
 * Loads activity time windows from /api/misc/time-windows for wellness score hints.
 */
export function useTimeWindows() {
  const [timeWindows, setTimeWindows] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getTimeWindows()
      .then((data) => {
        if (!cancelled && data?.success && data?.windows) {
          setTimeWindows(data.windows);
        }
      })
      .catch(() => {
        /* non-fatal — hints fall back to generic copy */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return timeWindows;
}
