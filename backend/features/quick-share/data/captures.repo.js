/**
 * backend/features/quick-share/data/captures.repo.js
 * ---------------------------------------------------------------------------
 * Data-access layer for the quick-share feature.
 * Only this file may talk to Supabase.
 * ---------------------------------------------------------------------------
 */
import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Create a new capture row with a public share token, returning the full row.
 * AnalysisData is initially null — background analysis fills it in.
 *
 * @param {{ userId: string|number, token: string, expiresAt: Date, imageBase64?: string }} opts
 * @returns {Promise<{ ID: number, PublicShareToken: string }>}
 */
export async function createCapture({ userId, token, expiresAt, imageBase64 }) {
  const supabase = getSupabaseClient();
  const now = getISTTimestamp();

  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert({
      UserID: userId,
      PublicShareToken: token,
      ShareExpiresAt: expiresAt.toISOString(),
      AnalysisData: null,
      IsDeleted: 0,
      CreatedAt: now,
      UpdatedAt: now,
      ...(imageBase64 ? { ImageBase64: imageBase64 } : {}),
    })
    .select('ID, PublicShareToken')
    .single();

  if (error) {
    logger.error('[captures.repo] createCapture failed', { userId, err: error.message });
    throw error;
  }
  return data;
}

/**
 * Store completed AI analysis result for the given capture row ID.
 *
 * @param {{ id: number, analysisData: object }} opts
 * @returns {Promise<void>}
 */
export async function updateCaptureAnalysis({ id, analysisData }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('food_nutrition_data_table')
    .update({
      AnalysisData: JSON.stringify(analysisData),
      UpdatedAt: getISTTimestamp(),
    })
    .eq('ID', id);

  if (error) {
    logger.error('[captures.repo] updateCaptureAnalysis failed', { id, err: error.message });
    throw error;
  }
}

/**
 * Fetch a capture row by its public share token.
 * Returns null when not found, expired, or deleted.
 *
 * @param {string} token
 * @returns {Promise<{ ID: number, AnalysisData: string|null, ShareExpiresAt: string } | null>}
 */
export async function findCaptureByToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('ID, AnalysisData, ShareExpiresAt')
    .eq('PublicShareToken', token)
    .eq('IsDeleted', 0)
    .single();

  if (error) {
    // "not found" is code PGRST116 — not a real error
    if (error.code === 'PGRST116') return null;
    logger.error('[captures.repo] findCaptureByToken failed', { token, err: error.message });
    throw error;
  }

  if (!data) return null;

  // Treat expired links as not found
  if (data.ShareExpiresAt && new Date(data.ShareExpiresAt) < new Date()) {
    return null;
  }

  return data;
}
