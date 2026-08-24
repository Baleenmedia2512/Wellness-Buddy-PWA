/**
 * Historical profile transformation photos.
 * Table: profile_transformation_photos_table
 * Storage: image_url holds the same data-URL / https string used on
 * team_table.transformation_photos (no second storage provider).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import logger from '../../shared/lib/logger.js';

const TABLE = 'profile_transformation_photos_table';

function isMissingTable(error) {
  const msg = String(error?.message || error || '');
  return /profile_transformation_photos_table|relation .* does not exist|Could not find the table/i.test(msg);
}

function isUniqueViolation(error) {
  const code = error?.code || error?.details || '';
  const msg = String(error?.message || error || '');
  return code === '23505' || /duplicate key|unique constraint/i.test(msg);
}

/**
 * @param {number} userId
 * @returns {Promise<object[]>} newest first
 */
export async function listByUserId(userId) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, user_id, image_type, image_url, weight_kg, content_hash, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Insert a photo row. Same user + type + content_hash is a no-op (retry-safe).
 * Never updates weight_kg on an existing row.
 *
 * @param {{ userId: number, imageType: string, imageUrl: string, weightKg: number|null, contentHash: string }} row
 * @returns {Promise<{ inserted: boolean, skipped: boolean }>}
 */
export async function insertIfNew(row) {
  const userId = Number.parseInt(String(row.userId), 10);
  if (!Number.isFinite(userId) || userId < 1) {
    return { inserted: false, skipped: true };
  }

  const supabase = getSupabaseClient();
  const existing = await supabase
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('image_type', row.imageType)
    .eq('content_hash', row.contentHash)
    .limit(1);

  if (existing.error) {
    if (isMissingTable(existing.error)) {
      logger.warn('[transformation-photos] table missing; skipped history insert', { userId });
      return { inserted: false, skipped: true, tableMissing: true };
    }
    throw existing.error;
  }
  if (Array.isArray(existing.data) && existing.data.length > 0) {
    return { inserted: false, skipped: true };
  }

  const payload = {
    user_id: userId,
    image_type: row.imageType,
    image_url: row.imageUrl,
    weight_kg: row.weightKg,
    content_hash: row.contentHash,
    created_at: nowUtc(),
  };

  const { error } = await supabase.from(TABLE).insert(payload);
  if (error) {
    if (isMissingTable(error)) {
      logger.warn('[transformation-photos] table missing; skipped history insert', { userId });
      return { inserted: false, skipped: true, tableMissing: true };
    }
    if (isUniqueViolation(error)) {
      return { inserted: false, skipped: true };
    }
    throw error;
  }
  return { inserted: true, skipped: false };
}
