/**
 * Activity Report team scope — same member set as Ideal Weight Report (indexed load).
 */
import { getFullTeamMembersIndexed } from '../../reports/reports.repository.js';

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

  const { rawMembers } = await getFullTeamMembersIndexed(userIdNum);

  const value = {
    directIds: rawMembers
      .filter((member) => member.isDirectToRoot)
      .map((member) => member.UserId)
      .filter(Boolean),
    fullIds: rawMembers
      .map((member) => member.UserId)
      .filter(Boolean),
  };

  scopeCache.set(key, { value, expiresAt: now + SCOPE_TTL_MS });
  return value;
}
