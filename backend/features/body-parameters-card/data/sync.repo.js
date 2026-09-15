/**
 * sync.repo.js — DB access for Body Parameters Card ↔ Profile sync.
 * Writes only changed fields. Does not go through profile.service /
 * update handlers (avoids circular sync).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../../utils/cache.js';
import logger from '../../../shared/lib/logger.js';
import {
  nowUtc,
  utcInstantToLegacyIstWallStorage,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';
import {
  buildTeamTableDiff,
  buildWeightInsertIfChanged,
  hasSyncWrites,
} from '../domain/sync.rules.js';
import { ensureCardLinkedToUser } from './card.repo.js';

const TEAM = 'team_table';
const WEIGHT = 'weight_records_table';

/**
 * @param {number} userId
 * @returns {Promise<{
 *   userName: string|null,
 *   height: number|null,
 *   bmr: number|null,
 *   email: string|null,
 *   gender: string|null,
 *   age: number|null,
 *   visceralFat: number|null,
 *   bodyAge: number|null,
 *   chestCm: number|null,
 *   waistCm: number|null,
 *   hipCm: number|null,
 *   dietType: string|null,
 *   physicalActivityLevel: string|null,
 *   recoveredHealthIssues: string[],
 * }|null>}
 */
export async function getTeamProfileSnapshot(userId) {
  const uid = parseInt(userId, 10);
  const supabase = getSupabaseClient();
  const selectFull =
    '"UserName", "Height", "Bmr", "Email", "Gender", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", "DietType", "PhysicalActivityLevel", recovered_health_issues, transformation_photos';
  const selectMid =
    '"UserName", "Height", "Bmr", "Email", "Gender", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", "DietType", "PhysicalActivityLevel", recovered_health_issues';
  const selectBasic = '"UserName", "Height", "Bmr", "Email", "Gender", "DietType", "PhysicalActivityLevel"';

  let data;
  let error;
  ({ data, error } = await supabase
    .from(TEAM)
    .select(selectFull)
    .eq('UserId', uid)
    .maybeSingle());

  if (error && /transformation_photos/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TEAM)
      .select(selectMid)
      .eq('UserId', uid)
      .maybeSingle());
  }

  if (error && /recovered_health_issues/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TEAM)
      .select(
        '"UserName", "Height", "Bmr", "Email", "Gender", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", "DietType", "PhysicalActivityLevel"',
      )
      .eq('UserId', uid)
      .maybeSingle());
  }

  if (error && /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TEAM)
      .select(selectBasic)
      .eq('UserId', uid)
      .maybeSingle());
  }

  if (error && /DietType|PhysicalActivityLevel/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    const { data: fallback, error: err2 } = await supabase
      .from(TEAM)
      .select('"UserName", "Height", "Bmr", "Email", "Gender"')
      .eq('UserId', uid)
      .maybeSingle();
    if (err2) throw err2;
    if (!fallback) return null;
    return {
      userName: fallback.UserName ?? null,
      height: fallback.Height != null ? parseFloat(fallback.Height) : null,
      bmr: fallback.Bmr != null ? parseFloat(fallback.Bmr) : null,
      email: fallback.Email ?? null,
      gender: fallback.Gender ?? null,
      age: null,
      visceralFat: null,
      bodyAge: null,
      chestCm: null,
      waistCm: null,
      hipCm: null,
      dietType: null,
      physicalActivityLevel: null,
      recoveredHealthIssues: [],
      transformationPhotos: null,
    };
  }

  if (error) throw error;
  if (!data) return null;
  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    userName: data.UserName ?? null,
    height: data.Height != null ? parseFloat(data.Height) : null,
    bmr: data.Bmr != null ? parseFloat(data.Bmr) : null,
    email: data.Email ?? null,
    gender: data.Gender ?? null,
    age: num(data.Age),
    visceralFat: num(data.VisceralFat),
    bodyAge: num(data.BodyAge),
    chestCm: num(data.ChestCm),
    waistCm: num(data.WaistCm),
    hipCm: num(data.HipCm),
    dietType: data.DietType != null ? String(data.DietType).trim() || null : null,
    physicalActivityLevel: data.PhysicalActivityLevel != null
      ? String(data.PhysicalActivityLevel).trim() || null
      : null,
    recoveredHealthIssues: Array.isArray(data.recovered_health_issues)
      ? data.recovered_health_issues.filter((x) => typeof x === 'string' && x.trim())
      : [],
    transformationPhotos: data.transformation_photos ?? null,
  };
}

/**
 * @param {number} userId
 * @returns {Promise<{ weight: number|null, bodyFat: number|null, bmi: number|null, bmr: number|null }|null>}
 */
export async function getLatestWeightSnapshot(userId) {
  const uid = parseInt(userId, 10);
  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from(WEIGHT)
    .select('"Weight", "BodyFat", "Bmi", "Bmr"')
    .eq('UserId', uid)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0,"IsDeleted".eq.false')
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) throw error;
  const data = rows?.[0];
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
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) {
    throw new Error(`[bpc-sync] invalid UserId for team_table patch: ${userId}`);
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .update(diff)
    .eq('UserId', uid)
    .select('UserId');
  if (error) throw error;
  if (!data?.length) {
    throw new Error(`[bpc-sync] team_table patch affected 0 rows for UserId ${uid}`);
  }
}

/**
 * @param {object} row - weight_records_table insert payload
 */
export async function insertWeightRecord(row) {
  if (!row) return;
  // Match weight.service: store CreatedAt as legacy IST wall clock (no Z).
  // Diary parses timezone-less timestamps as IST. DB default `now()` is UTC —
  // omitting CreatedAt made BCM weights show ~5.5h early in Diary.
  const legacyNow = utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
  const payload = {
    ...row,
    CreatedAt: row.CreatedAt ?? legacyNow,
    UpdatedAt: row.UpdatedAt ?? legacyNow,
  };
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(WEIGHT).insert(payload);
  if (error) throw error;
}

/**
 * Sync a persisted card into the linked user's Profile (team_table + weight).
 * Compares before write; skips DB when nothing changed.
 *
 * @param {object} card - body_parameters_cards row (snake_case) with user_id
 * @param {{ dietType?: string|null, physicalActivityLevel?: string|null }} [profileExtras]
 * @returns {Promise<{ synced: boolean, teamFields: string[], weightInserted: boolean }>}
 */
export async function syncCardToProfile(card, profileExtras = {}) {
  const userId = card?.user_id;
  if (!userId) {
    return { synced: false, teamFields: [], weightInserted: false };
  }

  const [profile, latestWeight] = await Promise.all([
    getTeamProfileSnapshot(userId),
    getLatestWeightSnapshot(userId),
  ]);

  const teamDiff = buildTeamTableDiff(card, profile || {}, profileExtras);
  const weightRow = buildWeightInsertIfChanged(card, userId, latestWeight);

  if (!hasSyncWrites(teamDiff, weightRow)) {
    logger.info('[bpc-sync] card → profile skipped (already in sync)', { userId, cardId: card.id });
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
  if (teamDiff.ProfileImage !== undefined || teamDiff.transformation_photos !== undefined) {
    try {
      cache.delete(cacheKeys.userAvatar(userId));
    } catch {
      /* non-fatal */
    }
  }

  logger.info('[bpc-sync] card → profile', {
    userId,
    cardId: card.id,
    teamFields: Object.keys(teamDiff),
    weightInserted: Boolean(weightRow),
  });

  return {
    synced: true,
    teamFields: Object.keys(teamDiff),
    weightInserted: Boolean(weightRow),
  };
}

/**
 * Link card to member (if needed) then sync card → team_table / weight records.
 *
 * @param {object} card - persisted card row
 * @param {object} linkPayload - phone/name/metrics for linking (CoachId is set at onboarding)
 * @returns {Promise<{ synced: boolean, userId: number|null, teamFields: string[], weightInserted: boolean }>}
 */
export async function syncCardToProfileAfterSave(card, linkPayload = {}) {
  const userId = await ensureCardLinkedToUser(card, linkPayload);
  if (!userId) {
    logger.warn('[bpc-sync] card → profile skipped — no phone/user link', { cardId: card?.id });
    return { synced: false, userId: null, teamFields: [], weightInserted: false };
  }

  const profileExtras = {
    dietType: linkPayload.dietType ?? null,
    physicalActivityLevel: linkPayload.physicalActivityLevel ?? null,
    transformationPhotos: linkPayload.transformationPhotos ?? null,
  };

  const result = await syncCardToProfile({ ...card, user_id: userId }, profileExtras);
  return { ...result, userId };
}
