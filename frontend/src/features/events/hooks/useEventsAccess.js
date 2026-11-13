import { useCallback, useEffect, useState } from 'react';
import { fetchEventsAccess, startEventsTrial } from '../services/eventsAccessApi';

const EMPTY = {
  loaded: false,
  access: 'none',
  daysLeft: null,
  canUseHostTools: false,
  error: '',
  starting: false,
};

/**
 * Server-owned Events host-tools access for one member.
 * Pass null to leave tools locked and skip the request.
 * @param {string|number|null} userId
 */
export default function useEventsAccess(userId) {
  const key = userId == null ? '' : String(userId).trim();
  const [state, setState] = useState(EMPTY);

  const apply = useCallback((access) => {
    setState({
      loaded: true,
      access: access.access,
      daysLeft: access.daysLeft,
      canUseHostTools: access.canUseHostTools === true,
      error: '',
      starting: false,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!key) {
      setState({ ...EMPTY, loaded: true });
      return null;
    }
    const access = await fetchEventsAccess(key);
    if (!access) {
      setState((prev) => ({
        ...prev,
        loaded: true,
        canUseHostTools: false,
        error: 'Could not check event access',
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
    fetchEventsAccess(key).then((access) => {
      if (cancelled) return;
      if (!access) {
        setState({
          ...EMPTY,
          loaded: true,
          error: 'Could not check event access',
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
      const access = await startEventsTrial(key);
      apply(access);
      return access;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        starting: false,
        canUseHostTools: false,
        error: error?.message || 'The free trial could not be started',
      }));
      return null;
    }
  }, [apply, key]);

  return { ...state, refresh, startTrial };
}
