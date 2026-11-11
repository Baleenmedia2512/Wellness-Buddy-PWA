import { useCallback, useEffect, useState } from 'react';
import { fetchReportAccess, startReportTrial } from '../services/reportAccessApi';

const EMPTY = {
  loaded: false,
  access: 'none',
  daysLeft: null,
  canSeeDetails: false,
  error: '',
  starting: false,
};

/**
 * Server-owned report access for one member.
 * Pass null to leave details locked and skip the request.
 * @param {string|number|null} userId
 */
export default function useReportAccess(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [state, setState] = useState(EMPTY);

  const apply = useCallback((access) => {
    setState({
      loaded: true,
      access: access.access,
      daysLeft: access.daysLeft,
      canSeeDetails: access.canSeeDetails === true,
      error: '',
      starting: false,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!key) {
      setState({ ...EMPTY, loaded: true });
      return null;
    }
    const access = await fetchReportAccess(key);
    if (!access) {
      setState((prev) => ({
        ...prev,
        loaded: true,
        canSeeDetails: false,
        error: 'Could not check report access',
        starting: false,
      }));
      return null;
    }
    apply(access);
    return access;
  }, [apply, key]);

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setState({ ...EMPTY, loaded: true });
      return undefined;
    }
    setState(EMPTY);
    fetchReportAccess(key).then((access) => {
      if (cancelled) return;
      if (!access) {
        setState({
          ...EMPTY,
          loaded: true,
          error: 'Could not check report access',
        });
        return;
      }
      apply(access);
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [apply, key, refresh]);

  const startTrial = useCallback(async () => {
    if (!key) return null;
    setState((prev) => ({ ...prev, starting: true, error: '' }));
    try {
      const access = await startReportTrial(key);
      apply(access);
      return access;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        starting: false,
        canSeeDetails: false,
        error: error?.message || 'The free trial could not be started',
      }));
      return null;
    }
  }, [apply, key]);

  return { ...state, refresh, startTrial };
}
