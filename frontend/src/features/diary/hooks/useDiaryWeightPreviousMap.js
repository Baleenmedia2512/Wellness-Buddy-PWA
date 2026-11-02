/**
 * diary/hooks/useDiaryWeightPreviousMap.js
 *
 * Resolves chronologically previous weight per entry id using full weight
 * history — same source as WeightCardModal / WeightDashboard, not same-day
 * diary feed rows only.
 */
import { useEffect, useMemo, useState } from 'react';
import { getWeightHistory } from '../../weight/services/weight.api';
import { buildPreviousWeightMap } from '../../weight/services/weightDashboardFormatter';

/**
 * @param {Object} params
 * @param {string|null} params.ownerUserId
 * @param {string|null} params.viewerUserId
 * @param {number} [params.refreshKey]
 * @param {boolean} [params.enabled]
 * @returns {Map<string, number|null>}
 */
export function useDiaryWeightPreviousMap({
  ownerUserId,
  viewerUserId,
  refreshKey = 0,
  enabled = true,
}) {
  const [weightHistory, setWeightHistory] = useState([]);

  useEffect(() => {
    if (!enabled || !ownerUserId) {
      setWeightHistory([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await getWeightHistory(ownerUserId, {
          includeImage: false,
          cacheBust: true,
          viewerUserId,
        });
        if (cancelled) return;
        if (ok && data?.success && Array.isArray(data.data)) {
          setWeightHistory(data.data);
        } else {
          setWeightHistory([]);
        }
      } catch {
        if (!cancelled) setWeightHistory([]);
      }
    })();

    return () => { cancelled = true; };
  }, [ownerUserId, viewerUserId, refreshKey, enabled]);

  return useMemo(() => {
    const base = buildPreviousWeightMap(weightHistory);
    const map = new Map();
    for (const [id, weight] of base.entries()) {
      const parsed = weight != null ? parseFloat(weight) : null;
      map.set(
        String(id),
        Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      );
    }
    return map;
  }, [weightHistory]);
}
