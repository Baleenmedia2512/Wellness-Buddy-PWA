/**
 * ideal-weight-milestone.repo.js — DB + mail for first ideal-weight reach.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { buildLeadPartnerByUserId } from '../../../utils/teamHierarchyTree.js';
import { walkCoachIdChain } from '../../../utils/sponsorCoachResolution.js';
import { IDEAL_REACH_NOTIFY_MAX_LEVELS } from '../domain/ideal-weight-milestone.rules.js';
import logger from '../../../shared/lib/logger.js';

const ACTIVE_WEIGHT_FILTER = 'IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0';

function isMissingColumnError(error, columnName) {
  const msg = String(error?.message || error || '');
  return new RegExp(columnName, 'i').test(msg)
    && /column|does not exist|not find|unknown/i.test(msg);
}

/**
 * @param {number|string} userId
 * @returns {Promise<string|null>}
 */
export async function getIdealWeightReachedAt(userId) {
  if (!userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"IdealWeightReachedAt"')
    .eq('"UserId"', userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error, 'IdealWeightReachedAt')) {
      logger.warn('[ideal-milestone] IdealWeightReachedAt column missing — run migration');
      return null;
    }
    throw error;
  }
  return data?.IdealWeightReachedAt ?? null;
}

/**
 * @param {number|string} userId
 * @returns {Promise<Array<{ ID: number, Weight: number|string, CreatedAt: string }>>}
 */
export async function listActiveWeightsAsc(userId) {
  if (!userId) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"ID", "Weight", "CreatedAt"')
    .eq('"UserId"', userId)
    .or(ACTIVE_WEIGHT_FILTER)
    .order('"CreatedAt"', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Atomically stamp IdealWeightReachedAt when still null.
 * @param {number|string} userId
 * @param {string} reachedAtIso UTC ISO
 * @returns {Promise<boolean>} true when this caller owns the stamp
 */
export async function claimIdealWeightReachedAt(userId, reachedAtIso) {
  if (!userId || !reachedAtIso) return false;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .update({ IdealWeightReachedAt: reachedAtIso })
    .eq('"UserId"', userId)
    .is('"IdealWeightReachedAt"', null)
    .select('"UserId"');

  if (error) {
    if (isMissingColumnError(error, 'IdealWeightReachedAt')) {
      logger.warn('[ideal-milestone] claim skipped — column missing');
      return false;
    }
    logger.warn('[ideal-milestone] claim IdealWeightReachedAt failed', {
      userId,
      error: error.message,
    });
    return false;
  }
  return Boolean(data?.length);
}

/**
 * Claim the coach-notify slot (once).
 * @param {number|string} userId
 * @returns {Promise<boolean>}
 */
export async function claimIdealWeightReachedNotify(userId) {
  if (!userId) return false;
  const stamped = nowUtc();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .update({ IdealWeightReachedNotifiedAt: stamped })
    .eq('"UserId"', userId)
    .not('"IdealWeightReachedAt"', 'is', null)
    .is('"IdealWeightReachedNotifiedAt"', null)
    .select('"UserId"');

  if (error) {
    if (isMissingColumnError(error, 'IdealWeightReachedNotifiedAt')) {
      logger.warn('[ideal-milestone] notify claim skipped — column missing');
      return false;
    }
    logger.warn('[ideal-milestone] claim IdealWeightReachedNotifiedAt failed', {
      userId,
      error: error.message,
    });
    return false;
  }
  return Boolean(data?.length);
}

/**
 * Backfill write: set reached (+ optionally notified) only when still null.
 * @param {number|string} userId
 * @param {string} reachedAtIso
 * @param {{ suppressNotify?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function backfillIdealWeightReachedAt(userId, reachedAtIso, { suppressNotify = true } = {}) {
  if (!userId || !reachedAtIso) return false;
  const patch = { IdealWeightReachedAt: reachedAtIso };
  if (suppressNotify) {
    patch.IdealWeightReachedNotifiedAt = reachedAtIso;
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .update(patch)
    .eq('"UserId"', userId)
    .is('"IdealWeightReachedAt"', null)
    .select('"UserId"');

  if (error) {
    logger.warn('[ideal-milestone] backfill write failed', {
      userId,
      error: error.message,
    });
    return false;
  }
  return Boolean(data?.length);
}

/**
 * @param {number|string} userId
 * @returns {Promise<{ coachId: number|null, memberName: string|null, heightCm: number|null }>}
 */
export async function findMemberCoachContext(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"CoachId", "UserName", "Height"')
    .eq('"UserId"', userId)
    .maybeSingle();

  if (error) {
    logger.warn('[ideal-milestone] member lookup failed', {
      userId,
      error: error.message,
    });
    return { coachId: null, memberName: null, heightCm: null };
  }

  const heightRaw = data?.Height;
  const heightCm = heightRaw != null && heightRaw !== '' ? parseFloat(heightRaw) : null;

  return {
    coachId: data?.CoachId ?? null,
    memberName: data?.UserName ?? null,
    heightCm: Number.isFinite(heightCm) ? heightCm : null,
  };
}

/**
 * Nearest-first CoachId ancestors for notify fan-out (up to maxLevels).
 * Starts at direct sponsor (`startCoachId`), not the member.
 *
 * @param {number|string|null|undefined} startCoachId
 * @param {number} [maxLevels]
 * @returns {Promise<string[]>}
 */
export async function listCoachAncestorIdsForNotify(
  startCoachId,
  maxLevels = IDEAL_REACH_NOTIFY_MAX_LEVELS,
) {
  if (startCoachId == null || startCoachId === '') return [];
  const limit = Number.isFinite(Number(maxLevels)) && Number(maxLevels) > 0
    ? Math.floor(Number(maxLevels))
    : IDEAL_REACH_NOTIFY_MAX_LEVELS;
  try {
    const chain = await walkCoachIdChain(String(startCoachId));
    return (chain || []).slice(0, limit).map((id) => String(id));
  } catch (err) {
    logger.warn('[ideal-milestone] coach ancestor walk failed', {
      startCoachId,
      error: err?.message || String(err),
    });
    return [];
  }
}

/**
 * Active coach_teams Sponsor ↔ Co-Sponsor partners for the given lead user IDs.
 *
 * @param {Array<number|string>} userIds
 * @returns {Promise<Map<number, number>>} leadUserId → partnerUserId
 */
export async function findLeadPartnersByUserIds(userIds) {
  const ids = [...new Set(
    (userIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (ids.length === 0) return new Map();

  const supabase = getSupabaseClient();
  const orFilter = ids.map((id) => `CoachId.eq.${id},CoCoachId.eq.${id}`).join(',');
  const { data, error } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .or(orFilter)
    .eq('Status', 'active');

  if (error) {
    logger.warn('[ideal-milestone] lead partner lookup failed', {
      count: ids.length,
      error: error.message,
    });
    return new Map();
  }

  return buildLeadPartnerByUserId(data || []);
}

/**
 * @param {number|string} coachId
 * @returns {Promise<{ email: string|null, name: string|null }>}
 */
export async function findCoachContact(coachId) {
  if (!coachId) return { email: null, name: null };
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"Email", "UserName"')
    .eq('"UserId"', coachId)
    .maybeSingle();

  if (error) {
    logger.warn('[ideal-milestone] coach lookup failed', {
      coachId,
      error: error.message,
    });
    return { email: null, name: null };
  }

  return {
    email: data?.Email ?? null,
    name: data?.UserName ?? null,
  };
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} params
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendCoachEmail({ to, subject, text, html }) {
  if (!to) return { success: false, error: 'missing_to' };
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: 'smtp_not_configured' };
  }
  try {
    await sendTransactionalMail({ to, subject, text, html });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'send_failed' };
  }
}

/**
 * Users with height set and IdealWeightReachedAt still null (for backfill).
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<Array<{ UserId: number, Height: string|number|null }>>}
 */
export async function listUsersPendingIdealReachedBackfill({ limit = 100, offset = 0 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "Height"')
    .is('"IdealWeightReachedAt"', null)
    .not('"Height"', 'is', null)
    .order('"UserId"', { ascending: true })
    .range(offset, offset + Math.max(1, limit) - 1);

  if (error) {
    if (isMissingColumnError(error, 'IdealWeightReachedAt')) {
      throw new Error('IdealWeightReachedAt column missing — run add_ideal_weight_reached_columns.sql');
    }
    throw error;
  }
  return data || [];
}
