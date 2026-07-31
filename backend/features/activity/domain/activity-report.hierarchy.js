/**
 * Activity Report team scope — same rules as Ideal Weight (reportingHierarchyService).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  loadReportingContextForCoach,
  getFullReportingMembers,
  getDirectReportingMembers,
} from '../../../utils/reportingHierarchyService.js';

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

  const supabase = getSupabaseClient();
  const context = await loadReportingContextForCoach(supabase, userIdNum);

  const value = {
    directIds: getDirectReportingMembers(userIdNum, context)
      .map((member) => member.UserId)
      .filter(Boolean),
    fullIds: getFullReportingMembers(userIdNum, context)
      .map((member) => member.UserId)
      .filter(Boolean),
  };

  scopeCache.set(key, { value, expiresAt: now + SCOPE_TTL_MS });
  return value;
}
