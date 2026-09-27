/**
 * Subscribe to race Top 10 invalidate pings (Supabase Realtime Broadcast).
 * Channel/event must match backend shared/lib/race-leaderboard-realtime.js
 */
import { useEffect, useRef } from 'react';
import { getBrowserSupabase } from '../../../shared/services/browserSupabase.js';

export const RACE_LEADERBOARD_CHANNEL = 'race-leaderboard';
export const RACE_LEADERBOARD_EVENT = 'invalidate';

const DEFAULT_DEBOUNCE_MS = 2000;

/**
 * @param {() => void} onInvalidate
 * @param {{ enabled?: boolean, debounceMs?: number }} [options]
 * @returns {{ realtimeReady: boolean }}
 */
export function useRaceLeaderboardRealtime(onInvalidate, options = {}) {
  const { enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  useEffect(() => {
    if (!enabled) return undefined;

    const supabase = getBrowserSupabase();
    if (!supabase) return undefined;

    let timer = null;
    const schedule = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          onInvalidateRef.current?.();
        } catch {
          /* non-fatal */
        }
      }, debounceMs);
    };

    const channel = supabase.channel(RACE_LEADERBOARD_CHANNEL, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: RACE_LEADERBOARD_EVENT }, () => {
        schedule();
      })
      .subscribe();

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (!document.hidden) schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer != null) clearTimeout(timer);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* non-fatal */
      }
    };
  }, [enabled, debounceMs]);
}
