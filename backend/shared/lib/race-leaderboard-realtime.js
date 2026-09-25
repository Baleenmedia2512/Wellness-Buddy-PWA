/**
 * Fire-and-forget Realtime Broadcast so Home Top 10 clients refresh.
 * Topic: race-leaderboard / event: invalidate (no PII in payload).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import logger from './logger.js';

export const RACE_LEADERBOARD_CHANNEL = 'race-leaderboard';
export const RACE_LEADERBOARD_EVENT = 'invalidate';

/**
 * @param {string} [reason]
 */
export function publishRaceLeaderboardInvalidate(reason = 'update') {
  // Never block the write path.
  setTimeout(() => {
    void (async () => {
      let channel = null;
      const supabase = getSupabaseClient();
      try {
        channel = supabase.channel(RACE_LEADERBOARD_CHANNEL);
        const status = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve('TIMEOUT'), 2500);
          channel.subscribe((s) => {
            if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
              clearTimeout(timer);
              resolve(s);
            }
          });
        });
        if (status !== 'SUBSCRIBED') {
          logger.warn('[race-lb] broadcast subscribe failed', { status, reason });
          return;
        }
        await channel.send({
          type: 'broadcast',
          event: RACE_LEADERBOARD_EVENT,
          payload: { reason: String(reason || 'update'), at: Date.now() },
        });
      } catch (err) {
        logger.warn('[race-lb] broadcast skipped', {
          reason,
          message: err?.message || String(err),
        });
      } finally {
        if (channel) {
          try {
            await supabase.removeChannel(channel);
          } catch {
            /* non-fatal */
          }
        }
      }
    })();
  }, 0);
}
