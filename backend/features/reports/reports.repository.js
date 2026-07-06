/**
 * reports.repository.js — Data layer for the Reports feature.
 * Owns: team_table (direct-downline lookup) + weight_records_table (latest weight).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * Fetch direct-downline members for a given coach.
 * Returns UserId, UserName, Height for every Active member whose CoachId matches.
 *
 * @param {number} coachId
 * @returns {Promise<Array<{ UserId: number, UserName: string, Height: string|null }>>}
 */
export async function getDirectDownline(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Height"')
    .eq('"CoachId"', coachId)
    .eq('"Status"', 'Active')
    .order('"UserName"', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch the latest weight record for each userId in the supplied array.
 * Returns a Map<userId, weightKg|null>.
 *
 * @param {number[]} userIds
 * @returns {Promise<Map<number, number|null>>}
 */
export async function getLatestWeightsForUsers(userIds) {
  if (!userIds || userIds.length === 0) return new Map();
  const supabase = getSupabaseClient();

  // Fetch all relevant rows ordered by CreatedAt desc; we take the first
  // occurrence per UserId when building the map.
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"UserId", "Weight"')
    .in('"UserId"', userIds)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;

  const map = new Map();
  for (const row of (data || [])) {
    if (!map.has(row.UserId)) {
      map.set(row.UserId, row.Weight !== null ? parseFloat(row.Weight) : null);
    }
  }
  return map;
}
