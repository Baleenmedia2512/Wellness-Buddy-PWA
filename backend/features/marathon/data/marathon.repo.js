/**
 * marathon.repo.js — Data layer for the Marathon Recognition Engine.
 *
 * The ONLY place in this feature that talks to Supabase / weight_records_table.
 * Uses the same IST date-range pattern as get-global-leaderboard.js.
 *
 * v2 (migration 0016):
 *  - computeCardData uses baseline_weight + discipline-window filtering
 *  - lockBaselineWeights: lock weights at enrollment
 *  - getMarathonConfig / saveMarathonConfig: admin-configurable discipline times
 *  - saveDailyResults / getDailyResults: finalized leader storage
 *  - getPendingRecognition / markRecognitionViewed: splash screen tracking
 *  - getLeaderboard: live ranked participant list
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  computeLapAndDay,
  lapStartDate,          // eslint-disable-line no-unused-vars -- kept for callers
  computeWeightChange,   // eslint-disable-line no-unused-vars -- kept for callers
  changeToGrams,
  formatWeightChange,
  findDayLeader,         // v1 — kept for backward compat (tests)
  findLapLeader,         // v1 — kept for backward compat (tests)
  computeTeamDailyTotal,
  buildCardSnapshot,     // eslint-disable-line no-unused-vars -- used by handler
  CARD_TYPES,
  DISCIPLINE_STATUS,
  isWithinDisciplineWindow,
  classifyDisciplineStatus,
  computeDayChange,
  computeLapChange,
  findDayLeaderV2,
  findLapLeaderV2,
  findCommunityLeader,
} from '../domain/marathon.rules.js';
import logger from '../../../shared/lib/logger.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const DEFAULT_DISCIPLINE_START = '03:00';
const DEFAULT_DISCIPLINE_END   = '07:30';

// ─────────────────────────────────────────────────────────────────────────────
// IST helpers
// ─────────────────────────────────────────────────────────────────────────────

function currentISTMoment() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toISTString(d) {
  return d.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

function istDayRange(istMoment, daysAgo = 0) {
  const d = new Date(istMoment);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const start = new Date(d); start.setUTCHours(0, 0, 0, 0);
  const end   = new Date(d); end.setUTCHours(23, 59, 59, 999);
  return { start: toISTString(start), end: toISTString(end) };
}

function istRangeUpToDate(isoDateStr) { // eslint-disable-line no-unused-vars
  const [y, m, day] = isoDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCHours(23, 59, 59, 999);
  return toISTString(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Marathon CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function insertMarathon({ coachId, name, teamName, lapSequence, totalLaps, daysPerLap, startedAt }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_table')
    .insert({
      coach_id:     coachId,
      name,
      team_name:    teamName   || null,
      lap_sequence: lapSequence || 1,
      total_laps:   totalLaps,
      days_per_lap: daysPerLap,
      started_at:   startedAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Insert participants with explicit LAP roles.
 * Accepts array of { userId, role } objects.
 * Falls back to 'member' for any entry without a role.
 */
export async function insertParticipantsWithRoles(marathonId, participants) {
  const supabase = getSupabaseClient();
  const rows = participants.map(p => ({
    marathon_id: marathonId,
    user_id:     typeof p === 'object' ? p.userId : p,
    lap_role:    typeof p === 'object' ? (p.role || 'member') : 'member',
  }));
  const { error } = await supabase.from('marathon_participants').insert(rows);
  if (error) throw error;
}

/** Legacy: plain user IDs, all get role 'member'. */
export async function insertParticipants(marathonId, userIds) {
  return insertParticipantsWithRoles(
    marathonId,
    userIds.map(uid => ({ userId: uid, role: 'member' })),
  );
}

export async function findMarathonById(id) {
  const supabase = getSupabaseClient();
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
    .select('id, name, team_name, lap_sequence, status, total_laps, days_per_lap, started_at, completed_at, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** List all active marathons a user is enrolled in (member-facing). */
export async function listActiveMarathonsForUser(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_participants')
    .select('marathon_id, lap_role, baseline_weight, marathon_table!inner(id, name, team_name, lap_sequence, status, total_laps, days_per_lap, started_at, coach_id)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('marathon_table.status', 'active');
  if (error) throw error;
  return (data || []).map(r => ({
    ...r.marathon_table,
    lapRole:        r.lap_role,
    baselineWeight: r.baseline_weight,
  }));
}

/**
 * Count existing LAPs for a captain's team name (for auto lap_sequence assignment).
 */
export async function countLapSequenceForTeam(coachId, teamName) {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('marathon_table')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('team_name', teamName)
    .neq('status', 'cancelled');
  if (error) throw error;
  return count || 0;
}

/**
 * Mark all currently-active LAPs for the same coach+team as completed.
 * Called when a new LAP is created for an existing team so that only one
 * LAP per team is active at any time.
 */
export async function completePreviousActiveLaps(coachId, teamName) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('marathon_table')
    .update({ status: 'completed', completed_at: now })
    .eq('coach_id', coachId)
    .eq('team_name', teamName)
    .eq('status', 'active');
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline weight locking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lock baseline weights at marathon creation time.
 * Fetches each participant's latest available weight and stores it
 * in marathon_participants.baseline_weight.
 */
export async function lockBaselineWeights(marathonId, userIds) {
  const supabase = getSupabaseClient();

  const { data: weights, error } = await supabase
    .from('weight_records_table')
    .select('"UserId", "Weight"')
    .in('"UserId"', userIds)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;

  const latestPerUser = {};
  (weights || []).forEach(r => {
    if (!latestPerUser[r.UserId]) latestPerUser[r.UserId] = r.Weight;
  });

  await Promise.all(
    userIds.map(async uid => {
      const bw = latestPerUser[uid] ?? null;
      if (bw == null) return;
      const { error: upErr } = await supabase
        .from('marathon_participants')
        .update({ baseline_weight: bw })
        .eq('marathon_id', marathonId)
        .eq('user_id', uid);
      if (upErr) logger.warn('[marathon.repo] lockBaselineWeights partial failure', { uid, msg: upErr.message });
    }),
  );

  logger.info('[marathon.repo] lockBaselineWeights', {
    marathonId,
    total: userIds.length,
    locked: Object.keys(latestPerUser).length,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Discipline config
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarathonConfig(marathonId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_config')
    .select('discipline_start_time, discipline_end_time')
    .eq('marathon_id', marathonId)
    .maybeSingle();
  if (error) logger.warn('[marathon.repo] getMarathonConfig fallback', { marathonId, msg: error.message });
  return {
    disciplineStartTime: data?.discipline_start_time?.substring(0, 5) || DEFAULT_DISCIPLINE_START,
    disciplineEndTime:   data?.discipline_end_time?.substring(0, 5)   || DEFAULT_DISCIPLINE_END,
  };
}

export async function saveMarathonConfig(marathonId, { disciplineStartTime, disciplineEndTime }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('marathon_config')
    .upsert({
      marathon_id:           marathonId,
      discipline_start_time: disciplineStartTime,
      discipline_end_time:   disciplineEndTime,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'marathon_id' });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Share card storage (unchanged from v1)
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertShareCard({ marathonId, cardType, lapNumber, dayNumber, cardData, createdBy }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_share_cards')
    .insert({ marathon_id: marathonId, card_type: cardType, lap_number: lapNumber, day_number: dayNumber, card_data: cardData, created_by: createdBy })
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
// Card data computation v2 — discipline engine
// ─────────────────────────────────────────────────────────────────────────────

export async function computeCardData(marathonId, cardType) {
  const supabase = getSupabaseClient();

  const marathon = await findMarathonById(marathonId);
  if (!marathon) throw Object.assign(new Error('Marathon not found'), { status: 404 });

  const config = await getMarathonConfig(marathonId);
  const now    = currentISTMoment();
  const { lapNumber, dayNumber } = computeLapAndDay(marathon.started_at, marathon.days_per_lap, now);

  // Participants with baseline + role
  const { data: pRows, error: pErr } = await supabase
    .from('marathon_participants')
    .select('user_id, lap_role, baseline_weight')
    .eq('marathon_id', marathonId)
    .eq('is_active', true);
  if (pErr) throw pErr;

  if (!pRows?.length) {
    return { marathon, lapNumber, dayNumber, participants: [], cardType };
  }

  const userIds      = pRows.map(r => r.user_id);
  const baselineMap  = {};
  const roleMap      = {};
  pRows.forEach(r => {
    baselineMap[r.user_id] = r.baseline_weight;
    roleMap[r.user_id]     = r.lap_role || 'member';
  });

  // Profiles
  const { data: profiles, error: profErr } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "ProfileImage"')
    .in('"UserId"', userIds);
  if (profErr) throw profErr;
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.UserId] = p; });

  // Weight records: today + yesterday
  const today     = istDayRange(now, 0);
  const yesterday = istDayRange(now, 1);

  const [todayRes, yestRes] = await Promise.all([
    supabase.from('weight_records_table')
      .select('"UserId", "Weight", "CreatedAt"')
      .in('"UserId"', userIds)
      .gte('"CreatedAt"', today.start).lte('"CreatedAt"', today.end)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false }),
    supabase.from('weight_records_table')
      .select('"UserId", "Weight", "CreatedAt"')
      .in('"UserId"', userIds)
      .gte('"CreatedAt"', yesterday.start).lte('"CreatedAt"', yesterday.end)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false }),
  ]);
  if (todayRes.error) throw todayRes.error;
  if (yestRes.error)  throw yestRes.error;

  // Build per-user weight maps
  const todayClosingByUser     = {}; // latest weight today (any time)
  const todayDisciplineByUser  = {}; // latest weight within discipline window
  const prevClosingByUser      = {}; // latest weight yesterday

  (todayRes.data || []).forEach(r => {
    if (!todayClosingByUser[r.UserId]) todayClosingByUser[r.UserId] = r.Weight;
    if (!todayDisciplineByUser[r.UserId] && isWithinDisciplineWindow(r.CreatedAt, config.disciplineStartTime, config.disciplineEndTime)) {
      todayDisciplineByUser[r.UserId] = r.Weight;
    }
  });
  (yestRes.data || []).forEach(r => {
    if (!prevClosingByUser[r.UserId]) prevClosingByUser[r.UserId] = r.Weight;
  });

  // Assemble participants
  const participants = userIds.map(uid => {
    const disciplineWeight  = todayDisciplineByUser[uid] ?? null;
    const closingWeight     = todayClosingByUser[uid]    ?? null;
    const prevClosingWeight = prevClosingByUser[uid]     ?? null;
    const baselineWeight    = baselineMap[uid]           ?? null;
    const disciplineStatus  = classifyDisciplineStatus(disciplineWeight, closingWeight);
    const dayChange         = computeDayChange(disciplineWeight, prevClosingWeight);
    const lapChange         = computeLapChange(disciplineWeight, baselineWeight);

    return {
      userId:           uid,
      name:             profileMap[uid]?.UserName    || 'Member',
      profileImage:     profileMap[uid]?.ProfileImage || null,
      role:             roleMap[uid],
      disciplineStatus,
      dayChange,
      lapChange,
      cumulativeChange: lapChange,
      // backward compat
      dailyChange:      dayChange,
      dailyGrams:       changeToGrams(dayChange),
      lapGrams:         changeToGrams(lapChange),
      todayWeight:      closingWeight,
      disciplineWeight,
      baselineWeight,
      prevClosingWeight,
    };
  });

  const dayLeader      = findDayLeaderV2(participants);
  const lapLeader      = findLapLeaderV2(participants);
  const teamDailyTotal = computeTeamDailyTotal(participants);

  // Community leader: cross-marathon
  let communityLeader = null;
  if (cardType === CARD_TYPES.COMMUNITY_LEADER) {
    communityLeader = await _computeCommunityLeader(supabase, config, now);
  }

  logger.info('[marathon.repo] computeCardData v2', {
    marathonId, cardType, lapNumber, dayNumber,
    participants: participants.length,
    eligible: participants.filter(p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE).length,
    dayLeaderId: dayLeader?.userId,
    lapLeaderId: lapLeader?.userId,
  });

  const marathonDisplayName = marathon.team_name
    ? `${marathon.team_name} - LAP ${marathon.lap_sequence}`
    : marathon.name;

  return {
    marathonId,
    cardType,
    marathonName: marathonDisplayName,
    coachId:      marathon.coach_id,
    lapNumber,
    dayNumber,
    participants,
    dayLeader,
    lapLeader,
    communityLeader,
    teamDailyTotal,
    disciplineConfig: config,
  };
}

async function _computeCommunityLeader(supabase, config, now) {
  const { data: activeMarathons } = await supabase
    .from('marathon_table').select('id').eq('status', 'active');
  if (!activeMarathons?.length) return null;

  const allIds = activeMarathons.map(m => m.id);

  const { data: allPRows } = await supabase
    .from('marathon_participants')
    .select('user_id, baseline_weight, marathon_id')
    .in('marathon_id', allIds)
    .eq('is_active', true)
    .not('baseline_weight', 'is', null);
  if (!allPRows?.length) return null;

  const allUserIds = [...new Set(allPRows.map(r => r.user_id))];
  const today = istDayRange(now, 0);
  const { data: todayWeights } = await supabase
    .from('weight_records_table')
    .select('"UserId", "Weight", "CreatedAt"')
    .in('"UserId"', allUserIds)
    .gte('"CreatedAt"', today.start).lte('"CreatedAt"', today.end)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });

  const disciplineMap = {};
  (todayWeights || []).forEach(r => {
    if (!disciplineMap[r.UserId] && isWithinDisciplineWindow(r.CreatedAt, config.disciplineStartTime, config.disciplineEndTime)) {
      disciplineMap[r.UserId] = r.Weight;
    }
  });

  const candidateMap = {};
  allPRows.forEach(r => {
    const dw = disciplineMap[r.user_id] ?? null;
    const bw = r.baseline_weight;
    const cumulativeChange = computeLapChange(dw, bw);
    const status = classifyDisciplineStatus(dw, null);
    const existing = candidateMap[r.user_id];
    if (!existing || (cumulativeChange != null && cumulativeChange < (existing.cumulativeChange ?? 0))) {
      candidateMap[r.user_id] = { userId: r.user_id, baselineWeight: bw, disciplineWeight: dw, cumulativeChange, disciplineStatus: status, marathonId: r.marathon_id };
    }
  });

  const leader = findCommunityLeader(Object.values(candidateMap));
  if (!leader) return null;

  const { data: prof } = await supabase
    .from('team_table').select('"UserName", "ProfileImage"').eq('"UserId"', leader.userId).maybeSingle();

  return { ...leader, name: prof?.UserName || 'Member', profileImage: prof?.ProfileImage || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily results
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDailyResults(marathonId, results) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('marathon_daily_results')
    .upsert({
      marathon_id:                    marathonId,
      result_date:                    results.resultDate,
      lap_number:                     results.lapNumber,
      day_number:                     results.dayNumber,
      day_leader_user_id:             results.dayLeader?.userId           || null,
      day_leader_reduction_kg:        results.dayLeader?.dayChange        ? Math.abs(results.dayLeader.dayChange)        : null,
      lap_leader_user_id:             results.lapLeader?.userId           || null,
      lap_leader_reduction_kg:        results.lapLeader?.lapChange        ? Math.abs(results.lapLeader.lapChange)        : null,
      community_leader_user_id:       results.communityLeader?.userId     || null,
      community_leader_reduction_kg:  results.communityLeader?.cumulativeChange
        ? Math.abs(results.communityLeader.cumulativeChange) : null,
      eligible_count:                 results.eligibleCount    || 0,
      total_participants:             results.totalParticipants || 0,
      computed_at:                    new Date().toISOString(),
    }, { onConflict: 'marathon_id,result_date' });
  if (error) throw error;
}

export async function getDailyResults(marathonId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('marathon_daily_results')
    .select('*')
    .eq('marathon_id', marathonId)
    .eq('result_date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getLeaderboard(marathonId, type, topN = 10) {
  const cardType = type === 'day' ? CARD_TYPES.DAY_LEADER
                 : type === 'lap' ? CARD_TYPES.LAP_LEADER
                 : CARD_TYPES.COMMUNITY_LEADER;

  const data     = await computeCardData(marathonId, cardType);
  const all      = data.participants || [];

  const sorted = [...all]
    .filter(p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE)
    .filter(p => (type === 'day' ? p.dayChange : p.lapChange) != null)
    .sort((a, b) => {
      const av = type === 'day' ? (a.dayChange ?? 0) : (a.lapChange ?? 0);
      const bv = type === 'day' ? (b.dayChange ?? 0) : (b.lapChange ?? 0);
      return av - bv;
    });

  return sorted.slice(0, topN).map((p, i) => ({
    rank:             i + 1,
    userId:           p.userId,
    name:             p.name,
    profileImage:     p.profileImage,
    role:             p.role,
    disciplineStatus: p.disciplineStatus,
    changeKg:         type === 'day' ? p.dayChange  : p.lapChange,
    changeDisplay:    type === 'day' ? formatWeightChange(p.dayChange) : formatWeightChange(p.lapChange),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Recognition splash tracking
// ─────────────────────────────────────────────────────────────────────────────

export async function getPendingRecognition(userId) {
  const supabase  = getSupabaseClient();
  const now       = currentISTMoment();
  const todayDate = now.toISOString().substring(0, 10);

  const { data: participations, error: pErr } = await supabase
    .from('marathon_participants')
    .select('marathon_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (pErr) throw pErr;
  if (!participations?.length) return [];

  const userMarathonIds = participations.map(r => r.marathon_id);

  const { data: results, error: rErr } = await supabase
    .from('marathon_daily_results')
    .select('*, marathon_table!inner(name, team_name, lap_sequence)')
    .in('marathon_id', userMarathonIds)
    .eq('result_date', todayDate);
  if (rErr) throw rErr;
  if (!results?.length) return [];

  const { data: viewed } = await supabase
    .from('marathon_recognition_views')
    .select('marathon_id, result_date')
    .eq('user_id', userId)
    .in('marathon_id', userMarathonIds)
    .eq('result_date', todayDate);

  const viewedSet = new Set((viewed || []).map(v => `${v.marathon_id}_${v.result_date}`));
  const pending   = results.filter(r => !viewedSet.has(`${r.marathon_id}_${r.result_date}`));
  if (!pending.length) return [];

  const winnerIds = [...new Set([
    ...pending.map(r => r.day_leader_user_id),
    ...pending.map(r => r.lap_leader_user_id),
    ...pending.map(r => r.community_leader_user_id),
  ].filter(Boolean))];

  let profileMap = {};
  if (winnerIds.length) {
    const { data: profs } = await supabase
      .from('team_table').select('"UserId", "UserName", "ProfileImage"').in('"UserId"', winnerIds);
    (profs || []).forEach(p => { profileMap[p.UserId] = p; });
  }

  return pending.map(r => {
    const mt = r.marathon_table || {};
    const displayName = mt.team_name ? `${mt.team_name} - LAP ${mt.lap_sequence}` : mt.name || '';
    const mkLeader = (uid, reductionKg, labelKey) => uid ? {
      userId: uid,
      name: profileMap[uid]?.UserName || 'Member',
      profileImage: profileMap[uid]?.ProfileImage || null,
      reductionKg,
      [labelKey]: reductionKg ? `-${Number(reductionKg).toFixed(2)} KG` : '—',
    } : null;
    return {
      marathonId:      r.marathon_id,
      marathonName:    displayName,
      resultDate:      r.result_date,
      lapNumber:       r.lap_number,
      dayNumber:       r.day_number,
      dayLeader:       mkLeader(r.day_leader_user_id,       r.day_leader_reduction_kg,       'dailyChangeDisplay'),
      lapLeader:       mkLeader(r.lap_leader_user_id,       r.lap_leader_reduction_kg,       'lapChangeDisplay'),
      communityLeader: mkLeader(r.community_leader_user_id, r.community_leader_reduction_kg, 'lapChangeDisplay'),
    };
  });
}

export async function markRecognitionViewed(userId, marathonId, resultDate) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('marathon_recognition_views')
    .upsert(
      { user_id: userId, marathon_id: marathonId, result_date: resultDate },
      { onConflict: 'user_id,marathon_id,result_date' },
    );
  if (error) throw error;
}
