import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { filterEducationLogsOnly } from '../domain/education-log.helpers.js';
import {
  applyDayFilter,
  applyBeforeDayFilter,
} from '../../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

function parseUserId(userId) {
  const uid = Number.parseInt(String(userId), 10);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

export async function getLatestConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('wellness_score_config_table')
    .select('id, parameters, updated_at, updated_by_user_id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error('[wellness-score.repo] config fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function insertConfig({ parameters, updatedByUserId }) {
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const { data, error } = await supabase
    .from('wellness_score_config_table')
    .insert({
      parameters,
      updated_at: now,
      updated_by_user_id: updatedByUserId ?? null,
    })
    .select('id, parameters, updated_at, updated_by_user_id')
    .single();
  if (error) throw error;
  return data;
}

export async function getEducationLogsForDate(userId, date, timezoneIana = IANA_IST) {
  const uid = parseUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"CreatedAt", "Topic", "Platform"')
    .eq('"UserId"', uid)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query;
  if (error) {
    logger.error('[wellness-score.repo] education logs failed', { userId: uid, date, err: error.message });
    return [];
  }
  return filterEducationLogsOnly(data || []);
}

export async function getWeightRecordsForDate(userId, date, timezoneIana = IANA_IST) {
  const uid = parseUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseClient();
  let query = supabase
    .from('weight_records_table')
    .select('Weight, CreatedAt')
    .eq('UserId', uid)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false');
  query = applyDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query;
  if (error) {
    logger.error('[wellness-score.repo] weight records failed', { userId: uid, date, err: error.message });
    return [];
  }
  return data || [];
}

export async function getPreviousWeightBeforeDate(userId, date, timezoneIana = IANA_IST) {
  const uid = parseUserId(userId);
  if (!uid) return null;
  const supabase = getSupabaseClient();
  let query = supabase
    .from('weight_records_table')
    .select('Weight, CreatedAt')
    .eq('UserId', uid)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false');
  query = applyBeforeDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query
    .order('CreatedAt', { ascending: false })
    .limit(1);
  if (error) {
    logger.error('[wellness-score.repo] previous weight failed', { userId: uid, date, err: error.message });
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function upsertDailyScore({
  userId,
  scoreDate,
  totalEarned,
  totalPossible,
  percentage,
  goalMode,
  parameters,
}) {
  const uid = parseUserId(userId);
  if (!uid) return null;
  const supabase = getSupabaseClient();
  const now = nowUtc();
  const row = {
    user_id: uid,
    score_date: scoreDate,
    total_earned: Math.max(0, Number(totalEarned) || 0),
    total_possible: Math.max(0, Number(totalPossible) || 0),
    percentage: Math.max(0, Math.min(100, Number(percentage) || 0)),
    goal_mode: goalMode || 'loss',
    parameters: parameters || [],
    computed_at: now,
  };
  const { data, error } = await supabase
    .from('wellness_score_daily_table')
    .upsert(row, { onConflict: 'user_id,score_date' })
    .select('user_id, score_date, total_earned, total_possible, percentage, goal_mode, parameters, computed_at')
    .single();
  if (error) {
    logger.error('[wellness-score.repo] daily score upsert failed', {
      userId: uid,
      scoreDate,
      err: error.message,
    });
    return null;
  }
  return data;
}

export async function getStoredScoresInRange(userId, startDate, endDate) {
  const uid = parseUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('wellness_score_daily_table')
    .select('score_date, total_earned, total_possible, percentage, goal_mode, parameters, computed_at')
    .eq('user_id', uid)
    .gte('score_date', startDate)
    .lte('score_date', endDate)
    .order('score_date', { ascending: true });
  if (error) {
    logger.error('[wellness-score.repo] daily score range fetch failed', {
      userId: uid,
      startDate,
      endDate,
      err: error.message,
    });
    return [];
  }
  return data || [];
}
