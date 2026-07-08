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
 * Upload a base64-encoded video to the testimonials Supabase Storage bucket.
 * Supports mp4 / mov / quicktime — content-type is set based on the data-URI prefix
 * or defaults to video/mp4.
 * @param {string} base64 - raw base64 string (with or without data-URI prefix)
 * @param {string} path   - storage object path, e.g. "42/health_video_1720000000000.mp4"
 * @returns {string} path stored
 */
export async function uploadVideo(base64, path) {
  const supabase = getSupabaseClient();

  // Detect MIME type from data-URI prefix, fallback to video/mp4
  const mimeMatch = base64.match(/^data:([^;]+);base64,/);
  const mimeType  = mimeMatch ? mimeMatch[1] : 'video/mp4';

  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer  = Buffer.from(cleaned, 'base64');

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    logger.error('[testimonials.repo] Video upload failed', { path, error });
    throw error;
  }
  return path;
}

/**
 * Create a short-lived signed URL for direct client-side video upload (bypasses API payload limits).
 * @param {string} path
 * @returns {Promise<{ path: string, token: string, signedUrl: string }>}
 */
export async function createSignedUploadUrl(path) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    logger.error('[testimonials.repo] Signed upload URL failed', { path, error });
    throw error;
  }
  return data;
}

/**
 * Check whether a storage object exists at the given path.
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function objectExists(path) {
  if (!path) return false;
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash) : '';
  const filename = slash >= 0 ? path.slice(slash + 1) : path;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { search: filename, limit: 1 });

  if (error) {
    logger.warn('[testimonials.repo] Storage list failed', { path, error });
    return false;
  }
  return (data || []).some((entry) => entry.name === filename);
}

function throwStorageError(operation, path, error) {
  logger.error(`[testimonials.repo] Storage ${operation} failed`, { path, error });
  const err = new Error(error?.message || `Video storage ${operation} failed`);
  const statusCode = Number(error?.statusCode);
  err.status = Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600
    ? statusCode
    : 502;
  throw err;
}

/**
 * Upload a raw buffer to storage.
 * @param {string} path
 * @param {Buffer} buffer
 * @param {string} [contentType='video/mp4']
 */
export async function uploadBuffer(path, buffer, contentType = 'video/mp4') {
  const supabase = getSupabaseClient();
  const body = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) throwStorageError('upload', path, error);
  return path;
}

/**
 * Download a storage object as a Buffer.
 * @param {string} path
 * @param {{ retries?: number }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function downloadBuffer(path, { retries = 3 } = {}) {
  const supabase = getSupabaseClient();
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer());
    }
    lastError = error;
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throwStorageError('download', path, lastError);
}

/**
 * Remove one or more objects from storage.
 * @param {string[]} paths
 */
export async function removePaths(paths) {
  if (!paths?.length) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    logger.warn('[testimonials.repo] Failed to remove storage paths', { paths, error });
  }
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
 * Update the video-related columns of a testimonial row.
 * Only fields present on the payload object are written.
 * @param {number} id
 * @param {object} payload - partial video fields
 * @returns {object} updated row
 */
export async function updateTestimonialVideos(id, payload) {
  const supabase = getSupabaseClient();
  const updates  = { updated_at: getISTTimestamp() };
  if (payload.healthVideoPath    !== undefined) updates.health_video_path      = payload.healthVideoPath;
  if (payload.businessVideoPath  !== undefined) updates.business_video_path    = payload.businessVideoPath;
  if (payload.videoStatus        !== undefined) updates.video_status           = payload.videoStatus;
  if (payload.videoOtpHash       !== undefined) updates.video_otp_hash         = payload.videoOtpHash;
  if (payload.videoOtpExpiresAt  !== undefined) updates.video_otp_expires_at   = payload.videoOtpExpiresAt;
  if (payload.videoVerifiedAt    !== undefined) updates.video_verified_at      = payload.videoVerifiedAt;

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
 * Fetch team members for a coach alongside their testimonial status.
 * scope:
 *   - direct (default): immediate downline only (CoachId = coachId)
 *   - full: every member in the coach hierarchy recursively
 *
 * @param {number} coachId
 * @param {'direct'|'full'} [scope='direct']
 * @returns {Array<{ user: object, testimonial: object|null }>}
 */
export async function listForCoach(coachId, scope = 'direct') {
  const supabase = getSupabaseClient();

  let members;
  if (scope === 'full') {
    const { buildTeamHierarchy } = await import('../../utils/teamHierarchyBuilder.js');
    const { allMembers } = await buildTeamHierarchy(supabase, coachId);
    const memberIds = (allMembers || [])
      .map((m) => m.UserId)
      .filter((id) => id !== coachId);
    if (memberIds.length === 0) return [];

    const { data, error: membersErr } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "ProfileImage", "PhoneNumber"')
      .in('"UserId"', memberIds)
      .ilike('"Status"', 'active')
      .order('"UserName"', { ascending: true });
    if (membersErr) throw membersErr;
    members = data || [];
  } else {
    const { data, error: membersErr } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "ProfileImage", "PhoneNumber"')
      .eq('"CoachId"', coachId)
      .ilike('"Status"', 'active')
      .order('"UserName"', { ascending: true });
    if (membersErr) throw membersErr;
    members = data || [];
  }

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

/**
 * Fetch team members for a coach with their video upload/verification status.
 * Used by the video report endpoint.
 * @param {number} coachId
 * @param {'direct'|'full'} [scope='direct']
 * @returns {Array<{ user: object, videoStatus: string, hasHealthVideo: boolean, hasBusinessVideo: boolean, videoVerifiedAt: string|null }>}
 */
export async function listVideoReportForCoach(coachId, scope = 'direct') {
  const supabase = getSupabaseClient();

  let members;
  if (scope === 'full') {
    const { buildTeamHierarchy } = await import('../../utils/teamHierarchyBuilder.js');
    const { allMembers } = await buildTeamHierarchy(supabase, coachId);
    const memberIds = (allMembers || [])
      .map((m) => m.UserId)
      .filter((id) => id !== coachId);
    if (memberIds.length === 0) return [];

    const { data, error: membersErr } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "ProfileImage"')
      .in('"UserId"', memberIds)
      .ilike('"Status"', 'active')
      .order('"UserName"', { ascending: true });
    if (membersErr) throw membersErr;
    members = data || [];
  } else {
    const { data, error: membersErr } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "ProfileImage"')
      .eq('"CoachId"', coachId)
      .ilike('"Status"', 'active')
      .order('"UserName"', { ascending: true });
    if (membersErr) throw membersErr;
    members = data || [];
  }

  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.UserId);

  const { data: testimonials, error: testErr } = await supabase
    .from(TABLE)
    .select('user_id, video_status, health_video_path, business_video_path, video_verified_at')
    .in('user_id', memberIds)
    .eq('is_deleted', false)
    .order('id', { ascending: false });
  if (testErr) throw testErr;

  // Most recent testimonial per user
  const testimonialMap = {};
  for (const t of (testimonials || [])) {
    if (!testimonialMap[t.user_id]) testimonialMap[t.user_id] = t;
  }

  return members.map((m) => {
    const t = testimonialMap[m.UserId];
    return {
      user: { userId: m.UserId, userName: m.UserName, email: m.Email, profileImage: m.ProfileImage },
      videoStatus:      t?.video_status      ?? 'none',
      hasHealthVideo:   !!(t?.health_video_path),
      hasBusinessVideo: !!(t?.business_video_path),
      videoVerifiedAt:  t?.video_verified_at ?? null,
    };
  });
}
