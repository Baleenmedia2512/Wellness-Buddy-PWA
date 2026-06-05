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

const TABLE = 'captures_table';

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
  shareExpiresAt = null,
  imageBase64 = null,
  imagePath = null,
  deviceInfo = null,
  processedBy = null,
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      UserID: userId.toString(),
      PublicShareToken: publicShareToken,
      ShareExpiresAt: shareExpiresAt,
      ImageBase64: imageBase64,
      ImagePath: imagePath,
      DeviceInfo: deviceInfo,
      ProcessedBy: processedBy,
      // ImageType defaults to 'pending' (DB DEFAULT).
      // CreatedAt / UpdatedAt default to now() (DB DEFAULT).
    })
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
