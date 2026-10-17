import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import {
  DEFAULT_DAILY_AI_CREDITS,
  DEFAULT_AI_MODE_ENABLED,
  aiPhotoAnalysisModeFromConfigRow,
} from '../domain/credits.rules.js';

export async function getLatestConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_credits_config_table')
    .select('id, daily_ai_credits, ai_mode_enabled, availability_windows, updated_at, updated_by_user_id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Column may not exist until migration runs — retry without it.
    if (/availability_windows/i.test(error.message || '')) {
      const fallback = await supabase
        .from('ai_credits_config_table')
        .select('id, daily_ai_credits, ai_mode_enabled, updated_at, updated_by_user_id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallback.error) {
        logger.error('[ai-credits.repo] config fetch failed', { err: fallback.error.message });
        return null;
      }
      return fallback.data;
    }
    logger.error('[ai-credits.repo] config fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function insertConfig({
  dailyAiCredits,
  aiModeEnabled,
  availabilityWindows,
  updatedByUserId,
}) {
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const row = {
    daily_ai_credits: dailyAiCredits,
    ai_mode_enabled: aiModeEnabled,
    updated_at: now,
    updated_by_user_id: updatedByUserId ?? null,
  };
  if (availabilityWindows != null) {
    row.availability_windows = availabilityWindows;
  }
  const { data, error } = await supabase
    .from('ai_credits_config_table')
    .insert(row)
    .select('id, daily_ai_credits, ai_mode_enabled, availability_windows, updated_at, updated_by_user_id')
    .single();
  if (error) {
    // Pre-migration DB: insert without the new column.
    if (/availability_windows/i.test(error.message || '')) {
      const { availability_windows: _omit, ...legacyRow } = row;
      const legacy = await supabase
        .from('ai_credits_config_table')
        .insert(legacyRow)
        .select('id, daily_ai_credits, ai_mode_enabled, updated_at, updated_by_user_id')
        .single();
      if (legacy.error) throw legacy.error;
      return legacy.data;
    }
    throw error;
  }
  return data;
}

/**
 * Read the admin AI Mode switch. Throws when the database state cannot be read.
 * Does not default a failed lookup to enabled.
 *
 * @param {object} [supabaseClient] Injected client. Defaults to this process's SUPABASE_URL.
 * @returns {Promise<{ known: boolean, enabled: boolean }>}
 */
export async function readAiPhotoAnalysisMode(supabaseClient) {
  let supabase;
  try {
    supabase = supabaseClient || getSupabaseClient();
  } catch (err) {
    logger.error('[ai-credits.repo] AI mode client unavailable', { err: err?.message });
    const wrapped = new Error('AI photo analysis mode could not be determined');
    wrapped.code = 'AI_MODE_UNKNOWN';
    throw wrapped;
  }

  try {
    let query = await supabase
      .from('ai_credits_config_table')
      .select('id, daily_ai_credits, ai_mode_enabled, availability_windows')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (query.error && /availability_windows/i.test(query.error.message || '')) {
      query = await supabase
        .from('ai_credits_config_table')
        .select('id, daily_ai_credits, ai_mode_enabled')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (query.error) {
      logger.error('[ai-credits.repo] AI mode lookup failed', { err: query.error.message });
      const wrapped = new Error('AI photo analysis mode could not be determined');
      wrapped.code = 'AI_MODE_UNKNOWN';
      throw wrapped;
    }

    return aiPhotoAnalysisModeFromConfigRow(query.data);
  } catch (err) {
    if (err?.code === 'AI_MODE_UNKNOWN') throw err;
    logger.error('[ai-credits.repo] AI mode lookup failed', { err: err?.message });
    const wrapped = new Error('AI photo analysis mode could not be determined');
    wrapped.code = 'AI_MODE_UNKNOWN';
    throw wrapped;
  }
}

export function configOrDefault(row) {
  return {
    dailyAiCredits: row?.daily_ai_credits ?? DEFAULT_DAILY_AI_CREDITS,
    aiModeEnabled: row?.ai_mode_enabled ?? DEFAULT_AI_MODE_ENABLED,
    availabilityWindows: row?.availability_windows ?? null,
    updatedAt: row?.updated_at ?? null,
    updatedByUserId: row?.updated_by_user_id ?? null,
  };
}

export async function getUsageRow(userId, usageDate) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_credits_daily_usage_table')
    .select('id, user_id, usage_date, credits_used, credits_limit_snapshot, updated_at')
    .eq('user_id', uid)
    .eq('usage_date', usageDate)
    .maybeSingle();
  if (error) {
    logger.error('[ai-credits.repo] usage fetch failed', { err: error.message, userId: uid });
    return null;
  }
  return data;
}

export async function ensureUsageRow(userId, usageDate, limitSnapshot) {
  const existing = await getUsageRow(userId, usageDate);
  if (existing) {
    // Admin may change daily_ai_credits mid-day — keep today's snapshot in sync
    // so status/reserve use the live config, not a stale freeze.
    if (Number(existing.credits_limit_snapshot) !== Number(limitSnapshot)) {
      return updateUsageLimitSnapshot(existing.id, limitSnapshot) || existing;
    }
    return existing;
  }
  const uid = Number.parseInt(String(userId), 10);
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('ai_credits_daily_usage_table')
    .insert({
      user_id: uid,
      usage_date: usageDate,
      credits_used: 0,
      credits_limit_snapshot: limitSnapshot,
      updated_at: now,
    })
    .select('id, user_id, usage_date, credits_used, credits_limit_snapshot, updated_at')
    .single();
  if (error) {
    // Race: another request inserted — re-fetch
    if (String(error.code) === '23505' || /duplicate/i.test(error.message || '')) {
      return getUsageRow(userId, usageDate);
    }
    throw error;
  }
  return data;
}

/** Update credits_limit_snapshot when admin config changes mid-day. */
export async function updateUsageLimitSnapshot(usageRowId, limitSnapshot) {
  if (!usageRowId) return null;
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('ai_credits_daily_usage_table')
    .update({
      credits_limit_snapshot: limitSnapshot,
      updated_at: now,
    })
    .eq('id', usageRowId)
    .select('id, user_id, usage_date, credits_used, credits_limit_snapshot, updated_at')
    .maybeSingle();
  if (error) {
    logger.error('[ai-credits.repo] limit snapshot update failed', { err: error.message });
    return null;
  }
  return data;
}

export async function expireStalePendingReservations(userId, usageDate, maxAgeMs) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) return 0;
  const ageMs = Math.max(60_000, Number(maxAgeMs) || 0);
  const cutoff = new Date(Date.now() - ageMs).toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_credits_reservations_table')
    .update({ status: 'released', resolved_at: nowUtc() })
    .eq('user_id', uid)
    .eq('usage_date', usageDate)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id');
  if (error) {
    logger.error('[ai-credits.repo] stale pending release failed', { err: error.message });
    return 0;
  }
  return data?.length || 0;
}

export async function countPendingReservations(userId, usageDate) {
  const uid = Number.parseInt(String(userId), 10);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('ai_credits_reservations_table')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('usage_date', usageDate)
    .eq('status', 'pending');
  if (error) {
    logger.error('[ai-credits.repo] pending count failed', { err: error.message });
    return 0;
  }
  return count || 0;
}

export async function createReservation({ userId, usageDate }) {
  const uid = Number.parseInt(String(userId), 10);
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('ai_credits_reservations_table')
    .insert({
      user_id: uid,
      usage_date: usageDate,
      status: 'pending',
      created_at: now,
    })
    .select('id, user_id, usage_date, status, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getReservation(reservationId) {
  if (!reservationId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_credits_reservations_table')
    .select('id, user_id, usage_date, status, created_at, resolved_at')
    .eq('id', reservationId)
    .maybeSingle();
  if (error) {
    logger.error('[ai-credits.repo] reservation fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function resolveReservation(reservationId, status) {
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('ai_credits_reservations_table')
    .update({ status, resolved_at: now })
    .eq('id', reservationId)
    .eq('status', 'pending')
    .select('id, user_id, usage_date, status')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function incrementCreditsUsed(userId, usageDate) {
  const row = await getUsageRow(userId, usageDate);
  if (!row) throw new Error('Usage row missing');
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const next = (row.credits_used || 0) + 1;
  const { data, error } = await supabase
    .from('ai_credits_daily_usage_table')
    .update({ credits_used: next, updated_at: now })
    .eq('id', row.id)
    .select('id, credits_used, credits_limit_snapshot')
    .single();
  if (error) throw error;
  return data;
}
