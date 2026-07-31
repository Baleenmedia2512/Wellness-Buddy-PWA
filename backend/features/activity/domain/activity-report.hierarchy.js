/**
 * Activity Report team scope — same hierarchy as Ideal Weight & Transformation reports.
 * Uses reportingHierarchyService (inactive-coach rollup, direct vs full rules).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  loadReportingContext,
  getReportingMemberIds,
} from '../../../utils/reportingHierarchyService.js';

/** In-process cache — activity report fires 3 API calls per page (summary + member + detail). */
let contextCache = { value: null, expiresAt: 0 };
const CONTEXT_TTL_MS = 60_000;

async function getSharedReportingContext() {
  const now = Date.now();
  if (contextCache.value && contextCache.expiresAt > now) {
    return contextCache.value;
  }
  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  contextCache = { value: context, expiresAt: now + CONTEXT_TTL_MS };
  return context;
}

/**
 * Direct / full member IDs for a coach — matches downline-weight & testimonial scopes.
 *
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportCoachScope(userId) {
  const userIdNum = Number(userId);
  const context = await getSharedReportingContext();

  if (!context.userById.has(userIdNum)) {
    return { directIds: [], fullIds: [] };
  }

  return {
    directIds: getReportingMemberIds(userIdNum, 'direct', context),
    fullIds: getReportingMemberIds(userIdNum, 'full', context),
  };
}
