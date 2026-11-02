/**
 * Race Top 10 live channel is off. The leaderboard refreshes from the API poll.
 */
import { useEffect, useRef } from 'react';

export const RACE_LEADERBOARD_CHANNEL = 'race-leaderboard';
export const RACE_LEADERBOARD_EVENT = 'invalidate';

/**
 * @param {() => void} _onInvalidate
 * @param {{ enabled?: boolean, debounceMs?: number }} [_options]
 */
export function useRaceLeaderboardRealtime(_onInvalidate, _options = {}) {
  const onInvalidateRef = useRef(_onInvalidate);
  onInvalidateRef.current = _onInvalidate;

  useEffect(() => undefined, []);
}
