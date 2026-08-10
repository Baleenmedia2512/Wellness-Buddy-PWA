import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import {
  DEFAULT_DAILY_AI_CREDITS,
  DEFAULT_AI_MODE_ENABLED,
} from '../domain/credits.rules.js';

export async function getLatestConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_credits_config_table')
    .select('id, daily_ai_credits, ai_mode_enabled, updated_at, updated_by_user_id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error('[ai-credits.repo] config fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function insertConfig({ dailyAiCredits, aiModeEnabled, updatedByUserId }) {
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('ai_credits_config_table')
    .insert({
      daily_ai_credits: dailyAiCredits,
      ai_mode_enabled: aiModeEnabled,
      updated_at: now,
      updated_by_user_id: updatedByUserId ?? null,
    })
    .select('id, daily_ai_credits, ai_mode_enabled, updated_at, updated_by_user_id')
    .single();
  if (error) throw error;
  return data;
}

export function configOrDefault(row) {
  return {
    dailyAiCredits: row?.daily_ai_credits ?? DEFAULT_DAILY_AI_CREDITS,
    aiModeEnabled: row?.ai_mode_enabled ?? DEFAULT_AI_MODE_ENABLED,
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
