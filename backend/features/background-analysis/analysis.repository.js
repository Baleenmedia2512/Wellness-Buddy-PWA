import { getSupabaseClient, getISTTimestamp, convertToIST } from '../../utils/supabaseClient.js';

export async function insertAnalysis(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAnalyses({ userId, limit, offset }) {
  const supabase = getSupabaseClient();
  const { data, error, count } = await supabase
    .from('food_nutrition_data_table')
    .select('*', { count: 'exact' })
    .eq('"UserID"', userId)
    .eq('"IsDeleted"', 0)
    // PR 5 — the legacy ImageType column was dropped from this table.
    // captures_table now owns the type discriminator and food_nutrition_data_table
    // only ever contains food rows. The semantic predicate for "show this in
    // the dashboard" is now simply "analysis is complete":
    //   • pending rows  → AnalysisData IS NULL → excluded
    //   • orphan rows from re-tagged captures (food row inserted speculatively,
    //     then user picked weight/education) → AnalysisData IS NULL → excluded
    //   • completed food captures → AnalysisData IS NOT NULL → included
    .not('"AnalysisData"', 'is', null)
    .order('"CreatedAt"', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function softDeleteAnalysis(id, userId) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 1, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID"')
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function restoreAnalysis(id) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 0, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .select();
  if (error) throw error;
  return data || [];
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('team_table')
      .update({ LastActiveAt: getISTTimestamp() })
      .eq('UserId', userId);
  } catch (_) { /* ignore */ }
}

// ─── instant-share helpers ────────────────────────────────────────────────────

/**
 * Insert a "pending" capture row that will be enriched once Gemini analysis
 * completes. The row is immediately addressable by its PublicShareToken.
 */
export async function insertPendingCapture({ userId, imageBase64, captureId = null }) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert({
      UserID: userId.toString(),
      ImagePath: 'instant-share',
      ImageBase64: imageBase64 || null,
      // PR 5 — PublicShareToken / ShareExpiresAt / ImageType have been dropped
      // from this table. captures_table is now canonical for share tokens and
      // the image-type discriminator. The link from this food row to its
      // capture is the (nullable) CaptureID FK populated below; createPendingCapture
      // in the service layer inserts into captures_table FIRST and passes the
      // resulting id here so every new food row is linked to its capture.
      CaptureID: captureId,
      ProcessedBy: 'manual_app',
      DeviceInfo: 'Wellness Valley Web App',
      CreatedAt: currentTime,
      UpdatedAt: currentTime,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fill in analysis columns on an existing pending-capture row.
 * userId is used as an ownership guard — the UPDATE will silently no-op if
 * the row belongs to a different user.
 */
export async function updateWithAnalysisResult(id, userId, analysisFields) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ ...analysisFields, UpdatedAt: currentTime })
    .eq('ID', id)
    .eq('UserID', userId.toString())
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * PR 5 — canonical share-link lookup. captures_table is now the source of
 * truth for the share token, expiry, and image-type discriminator. The
 * nutrition payload still lives on food_nutrition_data_table and is joined
 * back via the CaptureID FK.
 *
 * Returns a row shaped to satisfy the legacy `getPublicCapture` contract:
 *   { ID, UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs,
 *     TotalFat, TotalFiber, ShareExpiresAt, CreatedAt, ImageBase64,
 *     ImageType, CaptureID }
 * or null when the token is unknown.
 *
 * Pre-PR-2 historical rows have no captures_table twin and therefore 404
 * here — this is the intentional breakage documented in
 * migrations/drop_legacy_share_columns_from_food.sql.
 */
export async function findPublicByToken(token) {
  const supabase = getSupabaseClient();
  const { data: cap, error: capErr } = await supabase
    .from('captures_table')
    .select('"ID", "UserID", "ShareExpiresAt", "ImageType", "ImageBase64", "CreatedAt"')
    .eq('"PublicShareToken"', token)
    .eq('"IsDeleted"', 0)
    .limit(1)
    .maybeSingle();
  if (capErr) throw capErr;
  if (!cap) return null;

  // Look up the most recent food row linked to this capture (if any).
  // Non-food captures (weight / education / smartwatch / pending) never have
  // a food row — in that case AnalysisData stays null and getPublicCapture
  // returns the pending shape, which is the correct UX for a typed capture
  // that the recipient should view via the feature tab, not the food viewer.
  const { data: food, error: foodErr } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID", "AnalysisData", "TotalCalories", "TotalProtein", "TotalCarbs", "TotalFat", "TotalFiber"')
    .eq('"CaptureID"', cap.ID)
    .order('"ID"', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (foodErr) throw foodErr;

  return {
    // Surface the food row id when present (legacy mealId semantics);
    // fall back to the captures id so callers always have a stable handle.
    ID:             food?.ID ?? cap.ID,
    UserID:         cap.UserID,
    ShareExpiresAt: cap.ShareExpiresAt,
    ImageBase64:    cap.ImageBase64,
    CreatedAt:      cap.CreatedAt,
    ImageType:      cap.ImageType,
    CaptureID:      cap.ID,
    AnalysisData:   food?.AnalysisData ?? null,
    TotalCalories:  food?.TotalCalories ?? null,
    TotalProtein:   food?.TotalProtein  ?? null,
    TotalCarbs:     food?.TotalCarbs    ?? null,
    TotalFat:       food?.TotalFat      ?? null,
    TotalFiber:     food?.TotalFiber    ?? null,
  };
}

/**
 * PR 5 — deep-link owner lookup. Reads captures_table for owner / expiry /
 * imagetype, then joins to food_nutrition_data_table by CaptureID for the
 * mealId (so the in-app deep-link can still expand the specific food card
 * for food captures). For non-food captures mealId is null and the frontend
 * just routes to the appropriate tab via `tabForImageType()`.
 */
export async function findOwnerByToken(token) {
  const supabase = getSupabaseClient();
  const { data: cap, error: capErr } = await supabase
    .from('captures_table')
    .select('"ID", "UserID", "CreatedAt", "ShareExpiresAt", "ImageType"')
    .eq('"PublicShareToken"', token)
    .eq('"IsDeleted"', 0)
    .limit(1)
    .maybeSingle();
  if (capErr) throw capErr;
  if (!cap) return null;

  const { data: food, error: foodErr } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID"')
    .eq('"CaptureID"', cap.ID)
    .order('"ID"', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (foodErr) throw foodErr;

  return {
    // For food captures, expose the food row ID as the meal handle so the
    // existing Dashboard deep-link logic ('expand this meal card') keeps
    // working. For non-food captures, ID falls back to the capture ID and
    // the frontend treats it as an opaque value.
    ID:             food?.ID ?? cap.ID,
    UserID:         cap.UserID,
    CreatedAt:      cap.CreatedAt,
    ShareExpiresAt: cap.ShareExpiresAt,
    ImageType:      cap.ImageType,
    CaptureID:      cap.ID,
  };
}

/**
 * Walk up the coach chain from `startUserId` (inclusive) and return the
 * ordered list of ancestor user-ids. Used by the deep-link permission
 * check: a viewer is allowed to open a shared meal if they are the owner
 * OR appear anywhere in the owner's coach chain. Cap depth at 10 to
 * prevent runaway queries on accidental cycles.
 */
export async function getCoachChain(startUserId) {
  const supabase = getSupabaseClient();
  const chain = [];
  let current = startUserId?.toString();
  let depth = 0;
  while (current && depth < 10) {
    chain.push(current);
    const { data, error } = await supabase
      .from('team_table')
      .select('"CoachId"')
      .eq('"UserId"', current)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const next = data?.CoachId ? data.CoachId.toString() : null;
    if (!next || next === current || chain.includes(next)) break;
    current = next;
    depth += 1;
  }
  return chain;
}

/**
 * Return true when userIdA and userIdB are active co-coach partners —
 * i.e. a row exists in coach_teams_table where one is CoachId and the other
 * is CoCoachId (either order). Used by the share-link permission check.
 */
export async function isCoCoachPaired(userIdA, userIdB) {
  const supabase = getSupabaseClient();
  const a = userIdA.toString();
  const b = userIdB.toString();
  const { data, error } = await supabase
    .from('coach_teams_table')
    .select('Id')
    .or(`and(CoachId.eq.${a},CoCoachId.eq.${b}),and(CoachId.eq.${b},CoCoachId.eq.${a})`)
    .eq('Status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Fetch a user's display name. Returns null when not found.
 */
export async function findUserName(userId) {
  if (!userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserName"')
    .eq('"UserId"', userId.toString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.UserName || null;
}

/**
 * PR 5 — resolve the captures_table primary key linked to a legacy food row,
 * with an ownership guard. Replaces the old `findTokenByIdForOwner`, which
 * read `food_nutrition_data_table.PublicShareToken` (column dropped in PR 5).
 * Returns the CaptureID (number) or null.
 */
export async function findCaptureIdForOwner(id, userId) {
  if (!id || !userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"CaptureID"')
    .eq('"ID"', id)
    .eq('"UserID"', userId.toString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.CaptureID || null;
}

export { getISTTimestamp, convertToIST };
