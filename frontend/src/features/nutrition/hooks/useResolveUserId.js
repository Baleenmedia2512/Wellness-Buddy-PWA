/**
 * useResolveUserId — memoized async resolver for the dashboard's effective userId.
 *
 * Thin useCallback wrapper around resolveDashboardUserId(user, apiBaseUrl) so
 * effects/callbacks can list it in their deps without re-creating on every
 * render. Returns the literal 'DEMO_USER' sentinel for demo accounts and null
 * on failure — the dashboard renders empty instead of throwing.
 */
import { useCallback } from 'react';
import { resolveDashboardUserId } from '../services/nutritionDashboard';

export function useResolveUserId({ user, apiBaseUrl }) {
  return useCallback(
    () => resolveDashboardUserId(user, apiBaseUrl),
    [user, apiBaseUrl],
  );
}
