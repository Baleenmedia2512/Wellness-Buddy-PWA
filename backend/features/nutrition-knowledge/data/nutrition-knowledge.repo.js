/**
 * backend/features/nutrition-knowledge/data/nutrition-knowledge.repo.js
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { normalizeFoodName } from '../domain/nutrition.rules.js';

const TABLE = 'nutrition_master_profiles_table';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    canonical_name: row.canonical_name,
    normalized_name: row.normalized_name,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    reference_weight_g: Number(row.reference_weight_g) || 100,
    is_liquid: Boolean(row.is_liquid),
    portion_label: row.portion_label || null,
    nutrition: typeof row.nutrition === 'object' && row.nutrition ? row.nutrition : {},
    source: row.source,
    status: row.status,
    sightings: Number(row.sightings) || 0,
    version: Number(row.version) || 1,
    reviewed_by_user_id: row.reviewed_by_user_id ?? null,
    updated_at: row.updated_at,
  };
}

/**
 * @param {string} term
 * @param {{ status?: string, limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function searchProfiles(term, { status = 'approved', limit = 20 } = {}) {
  const supabase = getSupabaseClient();
  const q = String(term || '').trim();
  if (q.length < 2) return [];

  const safe = q.replace(/[%_,]/g, ' ').trim();
  if (safe.length < 2) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', status)
    .or(`canonical_name.ilike.%${safe}%,normalized_name.ilike.%${safe}%`)
    .order('canonical_name', { ascending: true })
    .limit(limit);

  if (error) {
    // Table missing / not migrated — caller falls back to in-code seeds.
    logger.warn('[nutrition-knowledge.repo] searchProfiles failed', { err: error.message });
    return null;
  }
  return (data || []).map(mapRow);
}

/**
 * Exact match on normalized_name, or alias contains (JSON).
 * @param {string} name
 * @param {{ status?: string }} [opts]
 */
export async function findProfileByName(name, { status = 'approved' } = {}) {
  const key = normalizeFoodName(name);
  if (!key) return null;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', status)
    .eq('normalized_name', key)
    .limit(1);

  if (error) {
    logger.warn('[nutrition-knowledge.repo] findProfileByName failed', { err: error.message });
    return null;
  }
  if (Array.isArray(data) && data.length > 0) return mapRow(data[0]);

  // Alias match — fetch a small approved set and filter in memory (aliases jsonb).
  const { data: approved, error: err2 } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', status)
    .limit(500);

  if (err2) {
    logger.warn('[nutrition-knowledge.repo] alias scan failed', { err: err2.message });
    return null;
  }
  const hit = (approved || []).find((row) => {
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    return aliases.some((a) => normalizeFoodName(a) === key);
  });
  return hit ? mapRow(hit) : undefined;
}

/**
 * Upsert a draft AI candidate by normalized name. Does not overwrite approved rows' nutrition.
 * @param {{ canonicalName: string, nutrition: object, referenceWeightG?: number, isLiquid?: boolean, portionLabel?: string }} input
 */
export async function upsertAiCandidate(input) {
  const supabase = getSupabaseClient();
  const normalized = normalizeFoodName(input.canonicalName);
  if (!normalized) return null;

  const { data: existingRows, error: findErr } = await supabase
    .from(TABLE)
    .select('*')
    .eq('normalized_name', normalized)
    .limit(1);

  if (findErr) {
    logger.warn('[nutrition-knowledge.repo] upsertAiCandidate find failed', { err: findErr.message });
    return null;
  }

  const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
  const now = new Date().toISOString();

  if (existing) {
    // Never mutate approved seed/admin nutrition from AI traffic.
    if (existing.status === 'approved') {
      const { data, error } = await supabase
        .from(TABLE)
        .update({
          sightings: (Number(existing.sightings) || 0) + 1,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('*')
        .limit(1);
      if (error) {
        logger.warn('[nutrition-knowledge.repo] bump sightings failed', { err: error.message });
        return mapRow(existing);
      }
      return mapRow(data?.[0] || existing);
    }

    const nextSightings = (Number(existing.sightings) || 0) + 1;
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        canonical_name: input.canonicalName,
        nutrition: input.nutrition || existing.nutrition,
        reference_weight_g: input.referenceWeightG || existing.reference_weight_g,
        is_liquid: input.isLiquid ?? existing.is_liquid,
        portion_label: input.portionLabel || existing.portion_label,
        sightings: nextSightings,
        source: 'ai_promoted',
        status: existing.status === 'rejected' ? 'draft' : existing.status,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .limit(1);

    if (error) {
      logger.warn('[nutrition-knowledge.repo] update candidate failed', { err: error.message });
      return null;
    }
    return mapRow(data?.[0]);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      canonical_name: input.canonicalName,
      normalized_name: normalized,
      aliases: [],
      reference_weight_g: input.referenceWeightG || 100,
      is_liquid: Boolean(input.isLiquid),
      portion_label: input.portionLabel || null,
      nutrition: input.nutrition || {},
      source: 'ai_promoted',
      status: 'draft',
      sightings: 1,
      updated_at: now,
    })
    .select('*')
    .limit(1);

  if (error) {
    logger.warn('[nutrition-knowledge.repo] insert candidate failed', { err: error.message });
    return null;
  }
  return mapRow(data?.[0]);
}

/**
 * @param {number|string} profileId
 * @param {{ reviewedByUserId?: number|null }} [opts]
 */
export async function approveProfile(profileId, { reviewedByUserId = null } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'approved',
      reviewed_by_user_id: reviewedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('*')
    .limit(1);

  if (error) {
    logger.error('[nutrition-knowledge.repo] approve failed', { err: error.message, profileId });
    throw error;
  }
  return mapRow(data?.[0] || null);
}
