import { useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/api.config.js';

export function useGoodHabitDetailImages({ userId, habitId }) {
  const src = useMemo(() => {
    if (userId == null || habitId == null) return null;
    return `${getApiBaseUrl()}/api/good-habits?id=${encodeURIComponent(habitId)}&userId=${encodeURIComponent(userId)}&slot=main`;
  }, [userId, habitId]);

  return { src, loading: false, error: null };
}
