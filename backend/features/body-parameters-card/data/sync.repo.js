/**
 * sync.repo.js — DB access for Body Parameters Card ↔ Profile sync.
 * Writes only changed fields. Does not go through profile.service /
 * update handlers (avoids circular sync).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../../utils/cache.js';
import logger from '../../../shared/lib/logger.js';
import {
  buildTeamTableDiff,
  buildWeightInsertIfChanged,
  hasSyncWrites,
} from '../domain/sync.rules.js';

const TEAM = 'team_table';
const WEIGHT = 'weight_records_table';

/**
 * @param {number} userId
 * @returns {Promise<{ userName: string|null, height: number|null, bmr: number|null, email: string|null }|null>}
 */
export async function getTeamProfileSnapshot(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('UserName, Height, Bmr, Email')
    .eq('UserId', parseInt(userId, 10))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    userName: data.UserName ?? null,
    height: data.Height != null ? parseFloat(data.Height) : null,
    bmr: data.Bmr != null ? parseFloat(data.Bmr) : null,
    email: data.Email ?? null,
  };
}

/**
 * @param {number} userId
 * @returns {Promise<{ weight: number|null, bodyFat: number|null, bmi: number|null, bmr: number|null }|null>}
 */
export async function getLatestWeightSnapshot(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(WEIGHT)
    .select('Weight, BodyFat, Bmi, Bmr')
    .eq('UserId', parseInt(userId, 10))
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    weight: data.Weight != null ? parseFloat(data.Weight) : null,
    bodyFat: data.BodyFat != null ? parseFloat(data.BodyFat) : null,
    bmi: data.Bmi != null ? parseFloat(data.Bmi) : null,
    bmr: data.Bmr != null ? parseFloat(data.Bmr) : null,
  };
}

/**
 * Apply a team_table patch. No-op when diff is empty.
 * @param {number} userId
 * @param {object} diff
 */
export async function patchTeamProfile(userId, diff) {
  if (!diff || Object.keys(diff).length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update(diff)
    .eq('UserId', parseInt(userId, 10));
  if (error) throw error;
}

/**
 * @param {object} row - weight_records_table insert payload
 */
export async function insertWeightRecord(row) {
  if (!row) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(WEIGHT).insert(row);
  if (error) throw error;
}

/**
 * Sync a persisted card into the linked user's Profile.
 * Compares before write; skips DB when nothing changed.
 * Writes via this repo only — never through profile.service — so Profile→Card
 * sync does not re-enter.
 *
 * @param {object} card - body_parameters_cards row (snake_case) with user_id
 * @returns {Promise<{ synced: boolean, teamFields: string[], weightInserted: boolean }>}
 */
export async function syncCardToProfile(card) {
  const userId = card?.user_id;
  if (!userId) {
    return { synced: false, teamFields: [], weightInserted: false };
  }

  const [profile, latestWeight] = await Promise.all([
    getTeamProfileSnapshot(userId),
    getLatestWeightSnapshot(userId),
  ]);

  const teamDiff = buildTeamTableDiff(card, profile || {});
  const weightRow = buildWeightInsertIfChanged(card, userId, latestWeight);

  if (!hasSyncWrites(teamDiff, weightRow)) {
    return { synced: false, teamFields: [], weightInserted: false };
  }

  if (Object.keys(teamDiff).length > 0) {
    await patchTeamProfile(userId, teamDiff);
  }
  if (weightRow) {
    await insertWeightRecord(weightRow);
  }

  if (profile?.email) {
    try {
      cache.delete(cacheKeys.userProfile(profile.email));
    } catch {
      /* non-fatal */
    }
  }

  logger.info('[bpc-sync] card → profile', {
    userId,
    teamFields: Object.keys(teamDiff),
    weightInserted: Boolean(weightRow),
  });

  return {
    synced: true,
    teamFields: Object.keys(teamDiff),
    weightInserted: Boolean(weightRow),
  };
}
