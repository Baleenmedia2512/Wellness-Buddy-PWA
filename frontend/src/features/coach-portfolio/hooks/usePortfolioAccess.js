import { useCallback, useEffect, useState } from 'react';
import { fetchPortfolioStatus } from '../services/portfolioApi';

/**
 * @param {string|number|null} userId
 * @returns {{ paid: boolean, loading: boolean, refresh: () => Promise<boolean>, status: object|null }}
 */
export default function usePortfolioAccess(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [paid, setPaid] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(key));

  const refresh = useCallback(async () => {
    if (!key) {
      setPaid(false);
      setStatus(null);
      setLoading(false);
      return false;
    }
    setLoading(true);
    const data = await fetchPortfolioStatus(key);
    const nextPaid = data?.paid === true;
    setPaid(nextPaid);
    setStatus(data);
    setLoading(false);
    return nextPaid;
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!key) {
        setPaid(false);
        setStatus(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchPortfolioStatus(key);
      if (cancelled) return;
      setPaid(data?.paid === true);
      setStatus(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { paid, loading, refresh, status };
}
