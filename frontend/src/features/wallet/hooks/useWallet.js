import { useCallback, useEffect, useState } from 'react';
import { fetchWallet } from '../services/walletApi';

export default function useWallet(userId) {
  const [balance, setBalance] = useState(0);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (userId == null || String(userId).trim() === '') return null;
    setLoading(true);
    setError('');
    try {
      const data = await fetchWallet(userId);
      setBalance(Number(data?.balance) || 0);
      setPendingRequest(data?.pendingRequest || null);
      return data;
    } catch (err) {
      setError(err?.message || 'Could not load wallet');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, pendingRequest, loading, error, setBalance, setPendingRequest, setError, refresh };
}
