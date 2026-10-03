import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { DEFAULT_NAV_ACCESS_MATRIX, normalizeMatrix } from '../domain/navAccess.rules.js';

const TABLE = 'nav_page_access_config_table';

export async function getLatestConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, matrix, updated_at, updated_by_user_id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error('[nav-page-access.repo] config fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function insertConfig({ matrix, updatedByUserId }) {
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      matrix,
      updated_at: now,
      updated_by_user_id: updatedByUserId ?? null,
    })
    .select('id, matrix, updated_at, updated_by_user_id')
    .single();
  if (error) throw error;
  return data;
}

export function configOrDefault(row) {
  return {
    matrix: normalizeMatrix(row?.matrix ?? DEFAULT_NAV_ACCESS_MATRIX),
    updatedAt: row?.updated_at ?? null,
    updatedByUserId: row?.updated_by_user_id ?? null,
  };
}
