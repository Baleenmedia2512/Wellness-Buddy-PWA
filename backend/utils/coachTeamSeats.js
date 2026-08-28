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
    const { data: reactivated, error: reactivateError } = await supabase
      .from('coach_teams_table')
      .update({
        CoachId: userId,
        CoCoachId: null,
        Status: 'active',
        UpdatedAt: updateTime,
      })
      .eq('TeamId', teamId)
      .neq('Status', 'active')
      .select('TeamId');

    if (reactivateError) throw reactivateError;
    if (reactivated?.length) {
      return { ok: true, seat: 'sponsor' };
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
