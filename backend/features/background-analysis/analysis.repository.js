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
 * Look up the food row (if any) already created for a given capture, with an
 * ownership guard. Used by `save()` to perform an idempotent upsert keyed by
 * CaptureID — a retry of the same analysis (or a background-service replay)
 * must not create a duplicate food row for one capture. Returns the row or null.
 *
 * Pre-PR-6 history: the food row was inserted speculatively at capture-time
 * (`insertPendingCapture`), so an UPDATE-by-ID was always safe. PR 6 dropped
 * that speculation — captures_table is now the only at-capture-time write —
 * so the upsert has to look the row up by FK instead.
 */
export async function findFoodByCaptureId(captureId, userId) {
  if (!captureId || !userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID"')
    .eq('"CaptureID"', captureId)
    .eq('"UserID"', userId.toString())
    .eq('"IsDeleted"', 0)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
    .select('"ID", "AnalysisData", "TotalCalories", "TotalProtein", "TotalCarbs", "TotalFat", "TotalFiber", "TotalSugar", "TotalSodium", "TotalCholesterol"')
    .eq('"CaptureID"', cap.ID)
    .order('"ID"', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (foodErr) throw foodErr;

  return {
    // Surface the food row id when present (legacy mealId semantics);
    // fall back to the captures id so callers always have a stable handle.
    ID:               food?.ID ?? cap.ID,
    UserID:           cap.UserID,
    ShareExpiresAt:   cap.ShareExpiresAt,
    ImageBase64:      cap.ImageBase64,
    CreatedAt:        cap.CreatedAt,
    ImageType:        cap.ImageType,
    CaptureID:        cap.ID,
    AnalysisData:     food?.AnalysisData    ?? null,
    TotalCalories:    food?.TotalCalories   ?? null,
    TotalProtein:     food?.TotalProtein    ?? null,
    TotalCarbs:       food?.TotalCarbs      ?? null,
    TotalFat:         food?.TotalFat        ?? null,
    TotalFiber:       food?.TotalFiber      ?? null,
    TotalSugar:       food?.TotalSugar      ?? null,
    TotalSodium:      food?.TotalSodium     ?? null,
    TotalCholesterol: food?.TotalCholesterol ?? null,
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

  const imageType = cap.ImageType || 'food';

  // For each image type, look up the domain row by CaptureID so the frontend
  // can match the exact card (not just the date) when a share link is opened.
  let domainId = null;

  if (imageType === 'food') {
    const { data: food, error: foodErr } = await supabase
      .from('food_nutrition_data_table')
      .select('"ID"')
      .eq('"CaptureID"', cap.ID)
      .order('"ID"', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (foodErr) throw foodErr;
    domainId = food?.ID ?? null;
  } else if (imageType === 'weight') {
    const { data: wt, error: wtErr } = await supabase
      .from('weight_records_table')
      .select('"ID"')
      .eq('"CaptureID"', cap.ID)
      .limit(1)
      .maybeSingle();
    if (wtErr) throw wtErr;
    domainId = wt?.ID ?? null;
  } else if (imageType === 'education' || imageType === 'smartwatch') {
    // Smartwatch entries are saved to education_logs_table (same as education).
    const { data: edu, error: eduErr } = await supabase
      .from('education_logs_table')
      .select('"Id"')
      .eq('"CaptureID"', cap.ID)
      .limit(1)
      .maybeSingle();
    if (eduErr) throw eduErr;
    domainId = edu?.Id ?? null;
  }

  return {
    // domainId is the row ID inside the feature table (food/weight/education).
    // Falls back to cap.ID when the lookup finds nothing (e.g. save failed
    // or the CaptureID column was not yet populated for legacy rows).
    ID:             domainId ?? cap.ID,
    UserID:         cap.UserID,
    CreatedAt:      cap.CreatedAt,
    ShareExpiresAt: cap.ShareExpiresAt,
    ImageType:      imageType,
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

export { getISTTimestamp, convertToIST };
