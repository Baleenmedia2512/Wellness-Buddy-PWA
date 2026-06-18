/**
 * marathon.repo.js — Data layer for the Marathon Recognition Engine.
 *
 * The ONLY place in this feature that talks to Supabase / weight_records_table.
 * Uses the same IST date-range pattern as get-global-leaderboard.js.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  computeLapAndDay,
  lapStartDate,
  computeWeightChange,
  changeToGrams,
  findDayLeader,
  findLapLeader,
  computeTeamDailyTotal,
  buildCardSnapshot,
  CARD_TYPES,
} from '../domain/marathon.rules.js';
import logger from '../../../shared/lib/logger.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// ─────────────────────────────────────────────────────────────────────────────
// IST date helpers (mirrors get-global-leaderboard.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

function currentISTMoment() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Convert a JS Date to a plain IST string: "YYYY-MM-DD HH:MM:SS" */
function toISTString(d) {
  return d.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

/** IST date range [00:00:00, 23:59:59] for a given UTC date shifted to IST */
function istDayRange(istMoment, daysAgo = 0) {
  const d = new Date(istMoment);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start: toISTString(start), end: toISTString(end) };
}

/** IST range from beginning of time up to end of a given ISO date string */
function istRangeUpToDate(isoDateStr) {
  // isoDateStr = "YYYY-MM-DD"
  const [y, m, day] = isoDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCHours(23, 59, 59, 999);
  return toISTString(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Marathon CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function insertMarathon({ coachId, name, totalLaps, daysPerLap, startedAt }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_table')
    .insert({ coach_id: coachId, name, total_laps: totalLaps, days_per_lap: daysPerLap, started_at: startedAt })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertParticipants(marathonId, userIds) {
  const supabase  = getSupabaseClient();
  const rows      = userIds.map(uid => ({ marathon_id: marathonId, user_id: uid }));
  const { error } = await supabase.from('marathon_participants').insert(rows);
  if (error) throw error;
}

export async function findMarathonById(id) {
  const supabase  = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_table')
    .select('*')
    .eq('id', id)
    .neq('status', 'cancelled')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMarathonsByCoach(coachId, status = null) {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('marathon_table')
    .select('id, name, status, total_laps, days_per_lap, started_at, completed_at, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Share card storage
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertShareCard({ marathonId, cardType, lapNumber, dayNumber, cardData, createdBy }) {
  const supabase = getSupabaseClient();
  // Always insert a fresh token for each generation request so old links expire naturally
  const { data, error } = await supabase
    .from('marathon_share_cards')
    .insert({
      marathon_id:  marathonId,
      card_type:    cardType,
      lap_number:   lapNumber,
      day_number:   dayNumber,
      card_data:    cardData,
      created_by:   createdBy,
    })
    .select('public_share_token, share_expires_at')
    .single();
  if (error) throw error;
  return data;
}

export async function findShareCard(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_share_cards')
    .select('*')
    .eq('public_share_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card data computation — the heart of the feature
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all data needed to render any marathon card type.
 *
 * Strategy:
 *  1. Load marathon row + participants from DB.
 *  2. Load profiles (name, photo, role) from team_table.
 *  3. Batch-fetch weight records for today/yesterday/lap-start from weight_records_table.
 *  4. Compute dailyChange and lapChange per participant using pure domain functions.
 *  5. Derive leaders, totals, and format the payload for the card renderer.
 *
 * @param {number} marathonId
 * @param {string} cardType — one of CARD_TYPES values
 * @returns {object} cardPayload
 */
export async function computeCardData(marathonId, cardType) {
  const supabase = getSupabaseClient();

  // ── 1. Load marathon ──────────────────────────────────────────────────────
  const marathon = await findMarathonById(marathonId);
  if (!marathon) throw Object.assign(new Error('Marathon not found'), { status: 404 });

  const now = currentISTMoment();
  const { lapNumber, dayNumber } = computeLapAndDay(marathon.started_at, marathon.days_per_lap, now);
  const lapStart                 = lapStartDate(marathon.started_at, marathon.days_per_lap, lapNumber);
  const lapStartStr              = lapStart.toISOString().substring(0, 10); // "YYYY-MM-DD"

  // ── 2. Load active participants ───────────────────────────────────────────
  const { data: pRows, error: pErr } = await supabase
    .from('marathon_participants')
    .select('user_id')
    .eq('marathon_id', marathonId)
    .eq('is_active', true);
  if (pErr) throw pErr;

  if (!pRows || pRows.length === 0) {
    return { marathon, lapNumber, dayNumber, participants: [], cardType };
  }

  const userIds = pRows.map(r => r.user_id);

  // ── 3. Load profiles ──────────────────────────────────────────────────────
  const { data: profiles, error: profErr } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "ProfileImage", "Role"')
    .in('"UserId"', userIds);
  if (profErr) throw profErr;

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.UserId] = p; });

  // ── 4. Batch-fetch weight records ─────────────────────────────────────────
  const today     = istDayRange(now, 0);
  const yesterday = istDayRange(now, 1);
  const lapEndStr = istRangeUpToDate(lapStartStr);

  const [todayRes, yesterdayRes, lapStartRes] = await Promise.all([
    supabase
      .from('weight_records_table')
      .select('"UserId", "Weight", "CreatedAt"')
      .in('"UserId"', userIds)
      .gte('"CreatedAt"', today.start)
      .lte('"CreatedAt"', today.end)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false }),

    supabase
      .from('weight_records_table')
      .select('"UserId", "Weight", "CreatedAt"')
      .in('"UserId"', userIds)
      .gte('"CreatedAt"', yesterday.start)
      .lte('"CreatedAt"', yesterday.end)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false }),

    supabase
      .from('weight_records_table')
      .select('"UserId", "Weight", "CreatedAt"')
      .in('"UserId"', userIds)
      .lte('"CreatedAt"', lapEndStr)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false }),
  ]);

  if (todayRes.error)     throw todayRes.error;
  if (yesterdayRes.error) throw yesterdayRes.error;
  if (lapStartRes.error)  throw lapStartRes.error;

  // ── 5. Build per-user weight maps (latest entry wins — rows already desc-sorted) ──
  const todayWt     = {};
  const yesterdayWt = {};
  const lapStartWt  = {};

  (todayRes.data     || []).forEach(r => { if (!todayWt[r.UserId])     todayWt[r.UserId]     = r.Weight; });
  (yesterdayRes.data || []).forEach(r => { if (!yesterdayWt[r.UserId]) yesterdayWt[r.UserId] = r.Weight; });
  (lapStartRes.data  || []).forEach(r => { if (!lapStartWt[r.UserId])  lapStartWt[r.UserId]  = r.Weight; });

  // ── 6. Assemble participants with computed changes ─────────────────────────
  const participants = userIds.map(uid => {
    const profile = profileMap[uid] || {};
    const tw      = todayWt[uid]     ?? null;
    const yw      = yesterdayWt[uid] ?? null;
    const lw      = lapStartWt[uid]  ?? null;

    const dailyChange = computeWeightChange(tw, yw);   // negative = loss today
    const lapChange   = computeWeightChange(tw, lw);   // negative = loss this lap

    return {
      userId:       uid,
      name:         profile.UserName    || 'Member',
      profileImage: profile.ProfileImage || null,  // base64 or null
      role:         (profile.Role       || 'user').toLowerCase(),
      dailyChange,
      lapChange,
      dailyGrams:   changeToGrams(dailyChange),
      lapGrams:     changeToGrams(lapChange),
      todayWeight:  tw,
    };
  });

  // ── 7. Leaders & team total ────────────────────────────────────────────────
  const dayLeader  = findDayLeader(participants);
  const lapLeader  = findLapLeader(participants);
  const teamDailyTotal = computeTeamDailyTotal(participants);

  logger.info('[marathon.repo] computeCardData', {
    marathonId, cardType, lapNumber, dayNumber,
    participants: participants.length,
    dayLeaderId:  dayLeader?.userId,
    lapLeaderId:  lapLeader?.userId,
  });

  return {
    marathonId,
    cardType,
    marathonName: marathon.name,
    coachId:      marathon.coach_id,
    lapNumber,
    dayNumber,
    participants,
    dayLeader,
    lapLeader,
    teamDailyTotal,
  };
}
