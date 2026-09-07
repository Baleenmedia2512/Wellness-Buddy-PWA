/**
 * Sponsor / Co-Sponsor lead seats on coach_teams_table.
 *
 * Max 2 leads per TeamId:
 * - CoachId   → Sponsor (first lead)
 * - CoCoachId → Co-Sponsor (second lead)
 *
 * Race-safe: Co-Sponsor updates require CoCoachId IS NULL.
 */
import { nowUtc } from '../shared/lib/datetime/index.js';

/**
 * Shared CoachTeamId for a member after OTP.
 * Lead claim → claimed TeamId. Skip → guide's CoachTeamId, else guide's TeamId.
 *
 * @param {{ claimedTeamId?: string|null, guide?: { CoachTeamId?: string|null, TeamId?: string|null }|null }} args
 * @returns {string|null}
 */
/**
 * team_table fields to clear when a pending upline OTP request is cancelled.
 * Established members (already have CoachId) keep their tree link and CoachTeamId.
 *
 * @param {{ coachId?: number|string|null }} args
 * @returns {{ TeamId: null, CoachId?: null, CoachTeamId?: null }}
 */
export function buildTeamTableClearOnCancelRequest({ coachId = null } = {}) {
  const hadEstablishedCoach = coachId != null && String(coachId).trim() !== '';
  const update = { TeamId: null };
  if (!hadEstablishedCoach) {
    update.CoachId = null;
    update.CoachTeamId = null;
  }
  return update;
}

/**
 * Seat + update payload when reactivating an inactive coach_teams row.
 *
 * @param {{ CoachId?: number|null, CoCoachId?: number|null, Status?: string }} team
 * @param {number} userId
 * @returns {{ ok: boolean, seat?: 'sponsor'|'co-sponsor'|'already', update?: object, error?: string }}
 */
export function resolveInactiveTeamSeatAssignment(team, userId) {
  if (!team || team.Status === 'active') {
    return { ok: false, error: 'Team is not inactive' };
  }

  const sponsorId = team.CoachId != null ? Number(team.CoachId) : null;
  const coId = team.CoCoachId != null ? Number(team.CoCoachId) : null;
  const uid = Number(userId);

  if (sponsorId === uid) {
    return { ok: true, seat: 'already', update: { Status: 'active' } };
  }
  if (coId === uid) {
    return { ok: true, seat: 'already', update: { Status: 'active' } };
  }
  if (!Number.isFinite(sponsorId) || sponsorId <= 0) {
    return { ok: true, seat: 'sponsor', update: { CoachId: uid, Status: 'active' } };
  }
  if ((!Number.isFinite(coId) || coId <= 0) && sponsorId !== uid) {
    return { ok: true, seat: 'co-sponsor', update: { CoCoachId: uid, Status: 'active' } };
  }
  return { ok: false, error: 'Team is full' };
}

export function resolveMemberCoachTeamId({ claimedTeamId = null, guide = null } = {}) {
  const claimed = claimedTeamId && String(claimedTeamId).trim() ? String(claimedTeamId).trim() : null;
  if (claimed) return claimed;
  const fromCoachTeam = guide?.CoachTeamId && String(guide.CoachTeamId).trim();
  if (fromCoachTeam) return String(guide.CoachTeamId).trim();
  const fromTeamId = guide?.TeamId && String(guide.TeamId).trim();
  if (fromTeamId) return String(guide.TeamId).trim();
  return null;
}

/**
 * Resolve whether userId is Sponsor or Co-Sponsor on an active team.
 * @param {object} supabase
 * @param {number} userId
 * @returns {Promise<{ seat: 'sponsor'|'co-sponsor'|null, teamId: string|null }>}
 */
export async function resolveLeadSeatForUser(supabase, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return { seat: null, teamId: null };

  const { data, error } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId')
    .or(`CoachId.eq.${id},CoCoachId.eq.${id}`)
    .eq('Status', 'active')
    .maybeSingle();

  if (error || !data) return { seat: null, teamId: null };
  if (Number(data.CoachId) === id) {
    return { seat: 'sponsor', teamId: data.TeamId || null };
  }
  if (Number(data.CoCoachId) === id) {
    return { seat: 'co-sponsor', teamId: data.TeamId || null };
  }
  return { seat: null, teamId: data.TeamId || null };
}

/**
 * Assign the current user to a Sponsor or Co-Sponsor seat for teamId.
 *
 * @param {object} supabase
 * @param {string} teamId
 * @param {number} userId
 * @returns {Promise<{ ok: boolean, seat: 'sponsor'|'co-sponsor'|'already'|null, error?: string }>}
 */
export async function assignLeadSeat(supabase, teamId, userId) {
  if (!teamId || !userId) {
    return { ok: false, seat: null, error: 'Team ID and user are required' };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId, Status')
    .eq('TeamId', teamId);

  if (existingError) throw existingError;

  const team = existingRows?.[0] || null;

  if (!team) {
    const { error: insertError } = await supabase.from('coach_teams_table').insert([
      {
        TeamId: teamId,
        CoachId: userId,
        CoCoachId: null,
        Status: 'active',
      },
    ]);

    if (!insertError) {
      return { ok: true, seat: 'sponsor' };
    }

    // Unique conflict / race — another user created the row; try Co-Sponsor.
    const conflictCode = insertError.code || insertError?.details;
    const isConflict =
      insertError.code === '23505' ||
      /duplicate|unique/i.test(String(insertError.message || '')) ||
      conflictCode === '23505';

    if (!isConflict) {
      throw insertError;
    }
  }

  const { data: freshRows, error: freshError } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId, Status')
    .eq('TeamId', teamId)
    .limit(1);

  if (freshError) throw freshError;

  const fresh = freshRows?.[0];
  if (!fresh) {
    return { ok: false, seat: null, error: 'Failed to claim team seat' };
  }

  if (fresh.CoachId === userId || fresh.CoCoachId === userId) {
    return { ok: true, seat: 'already' };
  }

  const updateTime = nowUtc();

  if (fresh.Status !== 'active') {
    const reactivation = resolveInactiveTeamSeatAssignment(fresh, userId);
    if (!reactivation.ok) {
      return { ok: false, seat: null, error: reactivation.error || 'Team is unavailable' };
    }

    const { data: reactivated, error: reactivateError } = await supabase
      .from('coach_teams_table')
      .update({ ...reactivation.update, UpdatedAt: updateTime })
      .eq('TeamId', teamId)
      .neq('Status', 'active')
      .select('TeamId');

    if (reactivateError) throw reactivateError;
    if (reactivated?.length) {
      return { ok: true, seat: reactivation.seat };
    }
    // Status flipped by a concurrent claim — fall through
  }

  const { data: latestRows, error: latestError } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId, Status')
    .eq('TeamId', teamId)
    .eq('Status', 'active')
    .limit(1);

  if (latestError) throw latestError;

  const latest = latestRows?.[0];
  if (!latest) {
    return { ok: false, seat: null, error: 'Team is unavailable' };
  }

  if (latest.CoachId === userId || latest.CoCoachId === userId) {
    return { ok: true, seat: 'already' };
  }

  if (latest.CoachId && latest.CoCoachId) {
    return { ok: false, seat: null, error: 'Team is full' };
  }

  if (latest.CoachId && !latest.CoCoachId) {
    const { data: coRows, error: coError } = await supabase
      .from('coach_teams_table')
      .update({ CoCoachId: userId, UpdatedAt: updateTime })
      .eq('TeamId', teamId)
      .eq('Status', 'active')
      .is('CoCoachId', null)
      .select('TeamId');

    if (coError) throw coError;
    if (coRows?.length) {
      return { ok: true, seat: 'co-sponsor' };
    }
    return { ok: false, seat: null, error: 'Team is full' };
  }

  // Active row with empty CoachId (unexpected) — claim Sponsor
  const { data: sponsorRows, error: sponsorError } = await supabase
    .from('coach_teams_table')
    .update({ CoachId: userId, UpdatedAt: updateTime })
    .eq('TeamId', teamId)
    .eq('Status', 'active')
    .is('CoachId', null)
    .select('TeamId');

  if (sponsorError) throw sponsorError;
  if (sponsorRows?.length) {
    return { ok: true, seat: 'sponsor' };
  }

  return { ok: false, seat: null, error: 'Team is full' };
}
