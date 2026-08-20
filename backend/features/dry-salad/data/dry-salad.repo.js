/**
 * backend/features/dry-salad/data/dry-salad.repo.js
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import {
  foodNameMatchesQuery,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

const TABLE = 'dry_salad_items_table';

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * @param {{ status?: string, limit?: number }} [opts]
 * @returns {Promise<object[]|null>}
 */
export async function listApproved({ status = 'approved', limit = 50 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', status)
    .order('canonical_name', { ascending: true })
    .limit(limit);

  if (error) {
    logger.warn('[dry-salad.repo] listApproved failed', { err: error.message });
    return null;
  }
  return (data || []).map(mapRow);
}

/**
 * @param {string} term
 * @param {{ status?: string, limit?: number }} [opts]
 * @returns {Promise<object[]|null>}
 */
export async function searchItems(term, { status = 'approved', limit = 20 } = {}) {
  const supabase = getSupabaseClient();
  const q = String(term || '').trim();
  if (q.length < 1) return listApproved({ status, limit });

  const safe = q.replace(/[%_,]/g, ' ').trim();
  if (safe.length < 1) return [];

  const fetchLimit = Math.max(limit * 4, 80);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', status)
    .or(`canonical_name.ilike.%${safe}%,normalized_name.ilike.%${safe}%`)
    .order('canonical_name', { ascending: true })
    .limit(fetchLimit);

  if (error) {
    logger.warn('[dry-salad.repo] searchItems failed', { err: error.message });
    return null;
  }

  let rows = (data || []).map(mapRow);

  if (rows.length === 0 && safe.length >= 3) {
    const prefix = safe.slice(0, 2).replace(/[%_,]/g, ' ').trim();
    if (prefix.length >= 1) {
      const broad = await supabase
        .from(TABLE)
        .select('*')
        .eq('status', status)
        .or(`canonical_name.ilike.%${prefix}%,normalized_name.ilike.%${prefix}%`)
        .order('canonical_name', { ascending: true })
        .limit(Math.max(fetchLimit, 60));
      if (broad.error) {
        logger.warn('[dry-salad.repo] searchItems broad failed', {
          err: broad.error.message,
        });
      } else {
        rows = (broad.data || [])
          .map(mapRow)
          .filter((row) => foodNameMatchesQuery(row.canonical_name, safe, row.aliases));
      }
    }
  }

  return sortByFoodNameMatch(rows, safe).slice(0, limit);
}
