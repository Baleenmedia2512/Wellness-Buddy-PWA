import { useEffect, useState } from 'react';
import { fetchGoodHabitImages } from '../services/goodHabitApi';

function toImgSrc(b64) {
  if (!b64) return null;
  const raw = String(b64);
  return raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
}

export function useGoodHabitDetailImages({ userId, habitId }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId == null || habitId == null) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGoodHabitImages({ userId, id: habitId })
      .then((data) => {
        if (cancelled) return;
        setSrc(toImgSrc(data.imageBase64 || data.afterImageBase64 || data.beforeImageBase64));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Couldn't load photos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, habitId]);

  return { src, loading, error };
}
