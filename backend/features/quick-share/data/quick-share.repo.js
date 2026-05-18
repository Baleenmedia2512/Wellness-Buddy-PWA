/**
 * backend/features/quick-share/data/quick-share.repo.js
 * ---------------------------------------------------------------------------
 * Data access for quick-share. Reuses the existing food_nutrition_data_table.
 * No business rules — every domain decision lives in domain/.
 * ---------------------------------------------------------------------------
 */
import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';

/**
 * Insert a pending capture row. AnalysisData is null until the background
 * Gemini call writes it via updateAnalysis().
 *
 * @param {object} args
 * @returns {Promise<object>} the inserted row (selected back)
 */
export async function insertPendingCapture({
  userId,
  imageBase64,
  publicShareToken,
  shareExpiresAt,
  clientNonce,
}) {
  const supabase = getSupabaseClient();
  const now = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert({
      UserID: String(userId),
      ImagePath: `quick-share/${publicShareToken}.jpg`,
      ImageBase64: imageBase64,
      AnalysisData: null,
      ProcessedBy: 'quick_share',
      DeviceInfo: 'Wellness Valley Quick Share',
      PublicShareToken: publicShareToken,
      ShareExpiresAt: shareExpiresAt,
      // ClientNonce is stored if the column exists; ignore otherwise.
      ...(clientNonce ? { ClientNonce: clientNonce } : {}),
      CreatedAt: now,
      UpdatedAt: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch a row by public token (no userId — this is the unauth read path).
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function findByPublicToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID", "UserID", "AnalysisData", "ConfidenceScore", "CreatedAt", "ShareExpiresAt", "IsDeleted"')
    .eq('"PublicShareToken"', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Write the Gemini analysis result into an existing capture row.
 * @param {object} args
 */
export async function updateAnalysis({ id, analysisData, confidenceScore }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('food_nutrition_data_table')
    .update({
      AnalysisData: typeof analysisData === 'string' ? analysisData : JSON.stringify(analysisData),
      ConfidenceScore: confidenceScore ?? null,
      UpdatedAt: getISTTimestamp(),
    })
    .eq('"ID"', id);
  if (error) throw error;
}
