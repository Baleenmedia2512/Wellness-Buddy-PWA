/**
 * sync.repo.js — MySQL access for Body Parameters Card ↔ Profile sync.
 * Writes only changed fields. Does not go through profile.service /
 * update handlers (avoids circular sync).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
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

function mysql() {
  return getPrisma();
}

function plainNum(value) {
  if (value == null) return null;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const asNumber = value.toNumber();
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
}

/** Store the IST wall-clock string as the same digits in a UTC DATETIME column. */
function wallClockDate(wall) {
  return new Date(`${String(wall).trim().replace(' ', 'T')}Z`);
}

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
  if (!Number.isFinite(uid) || uid < 1) return null;
  const data = await mysql().team_table.findUnique({
    where: { UserId: uid },
    select: {
      UserName: true,
      Height: true,
      Bmr: true,
      Email: true,
      Gender: true,
      Age: true,
      VisceralFat: true,
      BodyAge: true,
      ChestCm: true,
      WaistCm: true,
      HipCm: true,
      DietType: true,
      PhysicalActivityLevel: true,
      recovered_health_issues: true,
      transformation_photos: true,
    },
  });
  if (!data) return null;
  return {
    userName: data.UserName ?? null,
    height: plainNum(data.Height),
    bmr: plainNum(data.Bmr),
    email: data.Email ?? null,
    gender: data.Gender ?? null,
    age: plainNum(data.Age),
    visceralFat: plainNum(data.VisceralFat),
    bodyAge: plainNum(data.BodyAge),
    chestCm: plainNum(data.ChestCm),
    waistCm: plainNum(data.WaistCm),
    hipCm: plainNum(data.HipCm),
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
  if (!Number.isFinite(uid) || uid < 1) return null;
  const data = await mysql().weight_records_table.findFirst({
    where: {
      UserId: BigInt(uid),
      OR: [{ IsDeleted: null }, { IsDeleted: false }],
    },
    orderBy: { CreatedAt: 'desc' },
    select: { Weight: true, BodyFat: true, Bmi: true, Bmr: true },
  });
  if (!data) return null;
  return {
    weight: plainNum(data.Weight),
    bodyFat: plainNum(data.BodyFat),
    bmi: plainNum(data.Bmi),
    bmr: plainNum(data.Bmr),
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
  const updated = await mysql().team_table.updateMany({
    where: { UserId: uid },
    data: diff,
  });
  if (!updated.count) {
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
  const legacyNow = wallClockDate(utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST));
  const bmr = row.Bmr == null ? null : Math.round(Number(row.Bmr));
  await mysql().$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET time_zone = '+00:00'");
    await tx.weight_records_table.create({
      data: {
        UserId: BigInt(row.UserId),
        Weight: row.Weight,
        Bmi: row.Bmi ?? null,
        BodyFat: row.BodyFat ?? null,
        Bmr: Number.isFinite(bmr) ? bmr : null,
        CreatedAt: row.CreatedAt ? wallClockDate(row.CreatedAt) : legacyNow,
        UpdatedAt: row.UpdatedAt ? wallClockDate(row.UpdatedAt) : legacyNow,
      },
    });
  });
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
