/**
 * backend/features/captures/data/captures.repository.js
 * ---------------------------------------------------------------------------
 * The ONLY module allowed to read or write `captures_table` directly.
 * Per claude.md §2.7, all DB access for a feature is funnelled through its
 * data layer. Other features call `captures.service.js`, never this file.
 *
 * Column casing matches the migration in
 * `backend/migrations/create_captures_table.sql`: PascalCase, quoted.
 *
 * Timestamp policy: the new table uses `timestamptz DEFAULT now()` (real UTC).
 * We never pass `"CreatedAt"`/`"UpdatedAt"` from the application layer — the
 * DEFAULT fires on INSERT, and a single UPDATE statement bumps `"UpdatedAt"`
 * via `now()`. This keeps the new model free of the IST string-pasting that
 * historically caused subtle off-by-one-day bugs in `food_nutrition_data_table`.
 * ---------------------------------------------------------------------------
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  IANA_IST,
  filterRowsByCalendarDateRange,
} from '../../../shared/lib/datetime/index.js';
import { applyDateRangeFilter } from '../../../shared/lib/datetime/applyDayFilter.js';

const TABLE = 'captures_table';

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error || '');
  return /column/i.test(msg) && new RegExp(columnName, 'i').test(msg);
}

/**
 * Insert a new pending capture row.
 *
 * @param {Object} input
 * @param {string} input.userId            stringified owner id
 * @param {string} input.publicShareToken  UUID, must match the legacy row's token
 * @param {string|null} [input.shareExpiresAt]
 * @param {string|null} [input.imageBase64]
 * @param {string|null} [input.imagePath]
 * @param {string|null} [input.deviceInfo]
 * @param {string|null} [input.processedBy]
 * @returns {Promise<Object>} the inserted row (PascalCase keys)
 */
export async function insertPending({
  userId,
  publicShareToken,
  shareCode = null,
  shareExpiresAt = null,
  imageBase64 = null,
  imagePath = null,
  deviceInfo = null,
  processedBy = null,
  latitude,
  longitude,
  city,
  village,
  attendanceType,
  nutritionCenterId,
  centerName,
}) {
  const supabase = getSupabaseClient();
  const row = {
    UserID: userId.toString(),
    PublicShareToken: publicShareToken,
    ShareCode: shareCode,
    ShareExpiresAt: shareExpiresAt,
    ImageBase64: imageBase64,
    ImagePath: imagePath,
    DeviceInfo: deviceInfo,
    ProcessedBy: processedBy,
    // ImageType defaults to 'pending' (DB DEFAULT).
    // CreatedAt / UpdatedAt default to now() (DB DEFAULT).
  };
  // Only include location keys when the caller supplied them. Omitting keeps
  // photo-create working before the location-columns migration is applied.
  const locationProvided = [
    latitude, longitude, city, village, attendanceType, nutritionCenterId, centerName,
  ].some((v) => v !== undefined);
  if (locationProvided) {
    row.Latitude = latitude ?? null;
    row.Longitude = longitude ?? null;
    row.City = city ?? null;
    row.Village = village ?? null;
    row.AttendanceType = attendanceType ?? null;
    row.NutritionCenterId = nutritionCenterId ?? null;
    row.CenterName = centerName ?? null;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Look up a capture by its public share token. Returns null when not found.
 * Used by both the public viewer (PR 3) and the dual-write update path.
 */
export async function findByToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('"PublicShareToken"', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Look up a capture by short ShareCode. Returns null when not found.
 */
export async function findByShareCode(shareCode) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('"ShareCode"', shareCode)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Resolve either a legacy UUID token or a short ShareCode.
 */
export async function findByShareIdentifier(identifier) {
  const value = (identifier || '').toString().trim();
  if (!value) return null;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SHARE_CODE_RE = /^[A-Za-z0-9]{6,10}$/;

  if (UUID_RE.test(value)) {
    return findByToken(value);
  }
  if (SHARE_CODE_RE.test(value)) {
    return findByShareCode(value);
  }
  return null;
}

/**
 * Look up a capture by its primary key, with an ownership guard.
 * Returns the row or null. Added in PR 5 — the resolve path now uses
 * the captures-side ID directly (no more legacy food.ID indirection).
 */
export async function findByIdForOwner(captureId, userId) {
  if (!captureId || !userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('"ID"', captureId)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 0)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** ImageKey only — other domains pointer to this object. */
export async function getImageKeyById(captureId) {
  if (!captureId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('"ImageKey"')
    .eq('"ID"', captureId)
    .eq('"IsDeleted"', 0)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error, 'ImageKey')) return null;
    throw error;
  }
  return data?.ImageKey || null;
}

export async function updateCaptureImageKey(captureId, userId, imageKey) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ ImageKey: imageKey, ImageBase64: null })
    .eq('"ID"', captureId)
    .eq('"UserID"', String(userId));
  if (error) {
    if (isMissingColumn(error, 'ImageKey')) {
      throw new Error('Run migration add_image_key_to_captures_table.sql before capture R2');
    }
    throw error;
  }
}

/**
 * Capture photos in the IST calendar window that have not been copied to R2 yet.
 * CreatedAt is timestamptz UTC — filter with real UTC day bounds.
 */
export async function listPendingCaptureImageBackfill({
  from = 0,
  to = 49,
  startYmd,
  endYmd,
} = {}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(TABLE)
    .select('"ID", "UserID", "ImageBase64", "ImageKey", "CreatedAt"')
    .eq('"IsDeleted"', 0)
    .is('ImageKey', null)
    .not('ImageBase64', 'is', null);
  query = applyDateRangeFilter(query, 'CreatedAt', startYmd, endYmd, IANA_IST);
  const { data, error } = await query
    .order('CreatedAt', { ascending: true })
    .order('"ID"', { ascending: true })
    .range(from, to);
  if (error) {
    if (isMissingColumn(error, 'ImageKey')) {
      throw new Error('Run migration add_image_key_to_captures_table.sql before backfill');
    }
    throw error;
  }
  return filterRowsByCalendarDateRange(data || [], startYmd, endYmd, IANA_IST, 'CreatedAt');
}

/**
 * PR-A.2 / ADR-0003 — look up a capture by primary key WITHOUT an owner
 * guard. Used by the retry-promotion orchestrator: the orchestrator must
 * read the row to learn who the owner is BEFORE the permission policy can
 * decide whether the viewer may act on it. The policy
 * (`domain/permissions/retry.policy.js`) enforces access; this read does
 * NOT — callers MUST pair it with `assertCanRetryCapture(...)`.
 *
 * Returns the row or null when not found / soft-deleted.
 */
export async function findById(captureId) {
  if (!captureId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('"ID"', captureId)
    .eq('"IsDeleted"', 0)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Set the ImageType on a capture row identified by its token, with an
 * ownership guard. Returns the updated row, or null if no row matched
 * (wrong owner, wrong token, or already deleted).
 *
 * NOTE: this function does NOT enforce the state machine — callers MUST go
 * through `captures.service.updateType()` so `assertCanTransition` runs.
 */
export async function updateImageTypeByToken({ token, userId, imageType }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ImageType: imageType, UpdatedAt: new Date().toISOString() })
    .eq('"PublicShareToken"', token)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 0)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Set the ImageType on a capture row identified by its primary key, with an
 * ownership guard. Returns the updated row or null. Mirrors
 * `updateImageTypeByToken` but keyed by CaptureID — added in PR 5 because
 * the legacy `food_nutrition_data_table.PublicShareToken` column was dropped,
 * so the background-analysis service can no longer translate food.ID → token.
 *
 * NOTE: does NOT enforce the state machine. Callers must go through
 * `captures.service.updateTypeById()` so `assertCanTransition` runs.
 */
export async function updateImageTypeById({ captureId, userId, imageType }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ImageType: imageType, UpdatedAt: new Date().toISOString() })
    .eq('"ID"', captureId)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 0)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * 2026-06-09: Soft-delete a capture. Sets IsDeleted=1 to hide it from all
 * listing queries. Only the owner may delete.
 *
 * Returns:
 *   { deleted: true }       on success
 *   { deleted: false }      if the row was not found or already deleted
 *
 * Never throws on not-found — callers treat that as a no-op.
 */
export async function softDeleteById({ captureId, userId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 1, UpdatedAt: new Date().toISOString() })
    .eq('"ID"', captureId)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 0)  // Only delete if not already deleted
    .select()
    .maybeSingle();
  if (error) throw error;
  return { deleted: !!data };
}

/**
 * undoSoftDeleteById — restore a soft-deleted capture (undo delete).
 *
 * Sets IsDeleted back to 0 for the given capture. Only restores if:
 *   - The capture belongs to the given userId (ownership guard)
 *   - The capture is currently marked IsDeleted=1
 *
 * Params:
 *   { captureId: string|number, userId: string|number }
 *
 * Returns:
 *   { restored: true }      on success
 *   { restored: false }     if not found or not deleted
 *
 * Never throws on not-found — callers treat that as a no-op.
 */
export async function undoSoftDeleteById({ captureId, userId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 0, UpdatedAt: new Date().toISOString() })
    .eq('"ID"', captureId)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 1)  // Only restore if currently deleted
    .select()
    .maybeSingle();
  if (error) throw error;
  return { restored: !!data };
}
