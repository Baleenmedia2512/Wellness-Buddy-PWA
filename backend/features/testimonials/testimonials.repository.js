/**
 * testimonials.repository.js — Data layer for testimonials_table + Supabase Storage.
 * The ONLY place in this feature that talks to the database or storage.
 */
import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import logger from '../../shared/lib/logger.js';

const TABLE = 'testimonials_table';
const BUCKET = 'testimonials';
const SIGNED_URL_EXPIRY_SECONDS = 1800;       // 30 min — in-app display
const EMAIL_SIGNED_URL_EXPIRY_SECONDS = 604800; // 7 days — coach email

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Upload a base64-encoded image to the testimonials Supabase Storage bucket.
 * @param {string} base64 - raw base64 string (no data URI prefix)
 * @param {string} path   - storage object path, e.g. "42/before_1720000000000.jpg"
 * @returns {string} path stored
 */
export async function uploadImage(base64, path) {
  const supabase = getSupabaseClient();

  // Strip data-URI prefix if present (e.g. "data:image/jpeg;base64,...")
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    logger.error('[testimonials.repo] Storage upload failed', { path, error });
    throw error;
  }
  return path;
}

/**
 * Generate a short-lived signed URL for in-app display.
 * @param {string} path
 * @returns {string|null} signed URL or null on error
 */
export async function getSignedUrl(path) {
  if (!path) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) {
    logger.warn('[testimonials.repo] Failed to create signed URL', { path, error });
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Generate a long-lived signed URL for embedding in the coach email.
 * @param {string} path
 * @returns {string|null}
 */
export async function getEmailSignedUrl(path) {
  if (!path) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, EMAIL_SIGNED_URL_EXPIRY_SECONDS);
  if (error) {
    logger.warn('[testimonials.repo] Failed to create email signed URL', { path, error });
    return null;
  }
  return data?.signedUrl ?? null;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Find a user's active testimonial.
 * @param {number} userId
 * @returns {object|null}
 */
export async function findByUserId(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Find a testimonial by its PK.
 * @param {number} id
 * @returns {object|null}
 */
export async function findById(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Insert a new testimonial row.
 * @param {object} payload
 * @returns {object} inserted row
 */
export async function insertTestimonial(payload) {
  const supabase = getSupabaseClient();
  const now = getISTTimestamp();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id:           payload.userId,
      coach_id:          payload.coachId,
      before_image_path: payload.beforeImagePath,
      after_image_path:  payload.afterImagePath,
      before_weight_kg:  payload.beforeWeightKg,
      after_weight_kg:   payload.afterWeightKg,
      goal_type:         payload.goalType,
      duration_text:     payload.durationText,
      status:            'pending',
      otp_hash:          payload.otpHash,
      otp_expires_at:    payload.otpExpiresAt,
      created_at:        now,
      updated_at:        now,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update an existing testimonial (edit flow — always resets to pending).
 * @param {number} id
 * @param {object} payload - partial fields to update
 * @returns {object} updated row
 */
export async function updateTestimonial(id, payload) {
  const supabase = getSupabaseClient();
  const updates = { updated_at: getISTTimestamp() };
  if (payload.beforeImagePath !== undefined) updates.before_image_path = payload.beforeImagePath;
  if (payload.afterImagePath  !== undefined) updates.after_image_path  = payload.afterImagePath;
  if (payload.beforeWeightKg  !== undefined) updates.before_weight_kg  = payload.beforeWeightKg;
  if (payload.afterWeightKg   !== undefined) updates.after_weight_kg   = payload.afterWeightKg;
  if (payload.goalType        !== undefined) updates.goal_type         = payload.goalType;
  if (payload.durationText    !== undefined) updates.duration_text     = payload.durationText;
  if (payload.status          !== undefined) updates.status            = payload.status;
  if (payload.otpHash         !== undefined) updates.otp_hash          = payload.otpHash;
  if (payload.otpExpiresAt    !== undefined) updates.otp_expires_at    = payload.otpExpiresAt;
  if (payload.verifiedAt      !== undefined) updates.verified_at       = payload.verifiedAt;

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all direct team members for a coach alongside their testimonial status.
 * Returns team_table rows with a nullable testimonials_table row joined in.
 *
 * @param {number} coachId
 * @returns {Array<{ user: object, testimonial: object|null }>}
 */
export async function listForCoach(coachId) {
  const supabase = getSupabaseClient();

  // 1. Fetch direct members
  const { data: members, error: membersErr } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Email", "ProfileImage"')
    .eq('"CoachId"', coachId)
    .eq('"Status"', 'Active')
    .order('"UserName"', { ascending: true });
  if (membersErr) throw membersErr;
  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.UserId);

  // 2. Fetch testimonials for those members (non-deleted, most recent per user)
  const { data: testimonials, error: testErr } = await supabase
    .from(TABLE)
    .select('*')
    .in('user_id', memberIds)
    .eq('is_deleted', false)
    .order('id', { ascending: false });
  if (testErr) throw testErr;

  // 3. Build a map: userId → latest testimonial
  const testimonialMap = {};
  for (const t of (testimonials || [])) {
    if (!testimonialMap[t.user_id]) {
      testimonialMap[t.user_id] = t;
    }
  }

  return members.map((m) => ({
    user:        m,
    testimonial: testimonialMap[m.UserId] ?? null,
  }));
}

/**
 * Look up a user's coach email.
 * @param {number} coachId
 * @returns {string|null}
 */
export async function findCoachEmail(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"Email", "UserName"')
    .eq('"UserId"', coachId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0
    ? { email: data[0].Email, name: data[0].UserName }
    : null;
}

/**
 * Look up a user's CoachId.
 * @param {number} userId
 * @returns {number|null}
 */
export async function findCoachIdForUser(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"CoachId", "UserName"')
    .eq('"UserId"', userId)
    .limit(1);
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  return { coachId: data[0].CoachId, userName: data[0].UserName };
}
