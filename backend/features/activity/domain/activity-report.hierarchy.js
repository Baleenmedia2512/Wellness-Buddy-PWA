/**
 * Activity Report team scope — indexed dual-coaching hierarchy (Active downline).
 * Fast CoachId level queries; same pattern as getDualCoachingTeamHierarchy.
 */
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { isActiveTeamStatus } from '../../../utils/teamHierarchyBuilder.js';

/** In-process cache — warm lambda serves bootstrap + detail without re-walking tree. */
const scopeCache = new Map();
const SCOPE_TTL_MS = 60_000;

/**
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportCoachScope(userId) {
  const userIdNum = Number(userId);
  const key = String(userIdNum);
  const now = Date.now();
  const hit = scopeCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const hierarchy = await getDualCoachingTeamHierarchy(userIdNum, false);
  const isDownline = (m) => (
    Number(m.UserId) !== userIdNum
    && isActiveTeamStatus(m.Status)
    && !m.IsCoCoach
    && !m.IsLoggedInCoach
  );

  const value = {
    directIds: hierarchy
      .filter((m) => m.HierarchyLevel === 1 && isDownline(m))
      .map((m) => m.UserId)
      .filter(Boolean),
    fullIds: hierarchy
      .filter(isDownline)
      .map((m) => m.UserId)
      .filter(Boolean),
  };

  scopeCache.set(key, { value, expiresAt: now + SCOPE_TTL_MS });
  return value;
}
