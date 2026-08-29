/**
 * Profile + shared Community ID → CoachTeamId / lead Team Code assignment.
 * New-user onboarding still uses claim-id + validate-otp; this path serves
 * existing users and backfill when CommunityId exists without CoachTeamId.
 */
import logger from '../../shared/lib/logger.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { assignLeadSeat, resolveLeadSeatForUser } from '../../utils/coachTeamSeats.js';
import * as repo from './user.repository.js';
import {
  coachTeamIdNeedsUpdate,
  normalizeStoredTeamCode,
  normalizeTeamCodeFromCommunityId,
  resolveCoachTeamCodeToSync,
  resolveTargetTeamCodeFromExplicitCommunityIdUpdate,
  shouldAlignAllTeamFieldsFromCommunityId,
  shouldApplySharedCoachTeamId,
  shouldBackfillCoachTeamIdFromCommunityId,
  shouldClaimLeadSeatOnExplicitCommunityIdUpdate,
  teamAssignmentFieldsNeedUpdate,
} from './domain/communityIdTeamAssignment.rules.js';

const TEAM_LINK_ERROR = 'This Community ID is not linked to a Sponsor/Co-Sponsor team.';

/**
 * Resolve input to the shared Sponsor/Co-Sponsor team code (coach_teams_table.TeamId).
 *
 * @param {object} supabase
 * @param {string|null|undefined} rawCode
 * @param {number|string|null} [excludeUserId]
 * @returns {Promise<{ found: boolean, teamCode: string|null }>}
 */
export async function resolveSharedTeamCodeFromInput(supabase, rawCode, excludeUserId = null) {
  const code = normalizeTeamCodeFromCommunityId(rawCode);
  if (!code) return { found: false, teamCode: null };
  const excludeId = excludeUserId != null ? Number(excludeUserId) : null;

  const { data: activeTeam, error: activeErr } = await supabase
    .from('coach_teams_table')
    .select('TeamId')
    .eq('TeamId', code)
    .eq('Status', 'active')
    .maybeSingle();
  if (activeErr) throw activeErr;
  if (activeTeam?.TeamId) {
    return { found: true, teamCode: normalizeStoredTeamCode(activeTeam.TeamId) };
  }

  const { data: teamIdRows, error: teamIdErr } = await supabase
    .from('team_table')
    .select('UserId, TeamId, CoachTeamId')
    .eq('TeamId', code)
    .limit(5);
  if (teamIdErr) throw teamIdErr;
  for (const row of teamIdRows || []) {
    if (Number.isFinite(excludeId) && Number(row.UserId) === excludeId) continue;
    const shared = normalizeStoredTeamCode(row.CoachTeamId || row.TeamId);
    if (shared) return { found: true, teamCode: shared };
  }

  const { data: communityRows, error: communityErr } = await supabase
    .from('team_table')
    .select('UserId, TeamId, CoachTeamId, CommunityId')
    .eq('CommunityId', code)
    .limit(10);
  if (communityErr) throw communityErr;
  for (const row of communityRows || []) {
    if (Number.isFinite(excludeId) && Number(row.UserId) === excludeId) continue;
    const shared = normalizeStoredTeamCode(row.CoachTeamId || row.TeamId);
    if (shared) return { found: true, teamCode: shared };
  }

  return { found: false, teamCode: code };
}

/**
 * Coach/upline lead claim from profile Community ID (existing behaviour).
 * @returns {Promise<{ teamId: string, teamSeat: string|null, coachTeamId: string, synced: boolean }|null>}
 */
async function syncCoachLeadTeamCodeFromCommunityId(userId, communityIdSource, teamRow, leadSeat) {
  const teamCode = resolveCoachTeamCodeToSync({
    role: teamRow.Role,
    teamId: teamRow.TeamId,
    teamSeat: leadSeat.seat,
    communityId: communityIdSource,
  });
  if (!teamCode) return null;

  const supabase = getSupabaseClient();
  const seatResult = await assignLeadSeat(supabase, teamCode, Number(userId));
  if (!seatResult.ok) {
    throw new Error(seatResult.error || 'This Community ID is unavailable as a Team Code');
  }

  const resolvedSeat = seatResult.seat === 'already'
    ? (leadSeat.seat || 'sponsor')
    : seatResult.seat;

  await repo.updateUserById(userId, {
    TeamId: teamCode,
    CoachTeamId: teamCode,
    CommunityId: teamCode,
  });

  logger.info('[profile/update] coach Community ID synced to Team Code', {
    userId,
    teamId: teamCode,
    teamSeat: resolvedSeat,
  });

  return {
    teamId: teamCode,
    teamSeat: resolvedSeat || null,
    coachTeamId: teamCode,
    synced: true,
  };
}

/**
 * Member / non-lead: inherit shared CoachTeamId from Community ID.
 * @returns {Promise<{ coachTeamId: string, teamId: string|null, synced: boolean }|null>}
 */
async function syncSharedCoachTeamIdFromCommunityId(
  userId,
  communityIdSource,
  teamRow,
  leadSeat,
  { requireResolvableTeam = false, allowTeamSwitch = false } = {},
) {
  const inputCode = normalizeTeamCodeFromCommunityId(communityIdSource);
  if (!inputCode) return null;

  const supabase = getSupabaseClient();
  const resolved = await resolveSharedTeamCodeFromInput(supabase, inputCode, userId);

  if (!shouldApplySharedCoachTeamId({
    role: teamRow.Role,
    teamId: teamRow.TeamId,
    teamSeat: leadSeat.seat,
    communityId: inputCode,
    resolvedTeamCode: resolved.found ? resolved.teamCode : null,
    coachTeamId: teamRow.CoachTeamId,
    allowTeamSwitch,
  })) {
    if (requireResolvableTeam && !resolved.found) {
      throw new Error(TEAM_LINK_ERROR);
    }
    return null;
  }

  if (!resolved.found) {
    if (requireResolvableTeam) throw new Error(TEAM_LINK_ERROR);
    return null;
  }

  if (!coachTeamIdNeedsUpdate({
    coachTeamId: teamRow.CoachTeamId,
    resolvedTeamCode: resolved.teamCode,
  })) {
    return {
      coachTeamId: resolved.teamCode,
      teamId: teamRow.TeamId ? normalizeStoredTeamCode(teamRow.TeamId) : null,
      synced: false,
    };
  }

  await repo.updateUserById(userId, { CoachTeamId: resolved.teamCode });

  logger.info('[profile/update] Community ID linked to shared CoachTeamId', {
    userId,
    communityId: inputCode,
    coachTeamId: resolved.teamCode,
  });

  return {
    coachTeamId: resolved.teamCode,
    teamId: teamRow.TeamId ? normalizeStoredTeamCode(teamRow.TeamId) : null,
    synced: true,
  };
}

/**
 * Explicit profile Community ID save → keep CommunityId, TeamId, CoachTeamId aligned.
 * @returns {Promise<{ teamId: string, teamSeat?: string|null, coachTeamId: string, synced: boolean }|null>}
 */
async function syncAllTeamFieldsFromExplicitCommunityIdUpdate(
  userId,
  inputCode,
  teamRow,
  leadSeat,
) {
  const supabase = getSupabaseClient();
  const resolved = await resolveSharedTeamCodeFromInput(supabase, inputCode, userId);
  const targetCode = resolveTargetTeamCodeFromExplicitCommunityIdUpdate({
    inputCode,
    resolvedFound: resolved.found,
    resolvedTeamCode: resolved.teamCode,
  });
  if (!targetCode) return null;

  const needsUpdate = teamAssignmentFieldsNeedUpdate({
    teamId: teamRow.TeamId,
    coachTeamId: teamRow.CoachTeamId,
    targetCode,
  });

  let resolvedSeat = leadSeat.seat || null;
  if (needsUpdate && shouldClaimLeadSeatOnExplicitCommunityIdUpdate({
    role: teamRow.Role,
    teamSeat: leadSeat.seat,
  })) {
    const seatResult = await assignLeadSeat(supabase, targetCode, Number(userId));
    if (!seatResult.ok) {
      throw new Error(seatResult.error || 'This Community ID is unavailable as a Team Code');
    }
    resolvedSeat = seatResult.seat === 'already'
      ? (leadSeat.seat || 'sponsor')
      : seatResult.seat;
  }

  if (!needsUpdate) {
    return {
      teamId: targetCode,
      teamSeat: resolvedSeat,
      coachTeamId: targetCode,
      synced: false,
    };
  }

  await repo.updateUserById(userId, {
    TeamId: targetCode,
    CoachTeamId: targetCode,
    CommunityId: targetCode,
  });

  logger.info('[profile/update] Community ID synced to TeamId + CoachTeamId', {
    userId,
    communityId: targetCode,
    teamId: targetCode,
    coachTeamId: targetCode,
    resolvedFromExistingTeam: resolved.found,
  });

  return {
    teamId: targetCode,
    teamSeat: resolvedSeat,
    coachTeamId: targetCode,
    synced: true,
  };
}

/**
 * Sync profile Community ID to TeamId / CoachTeamId / lead seat when applicable.
 *
 * @param {number|string} userId
 * @param {string|null|undefined} communityIdSource
 * @param {{ communityIdExplicitlyUpdated?: boolean }} [options]
 * @returns {Promise<{ teamId?: string, teamSeat?: string|null, coachTeamId?: string, synced?: boolean }|null>}
 */
export async function syncProfileCommunityIdToTeamAssignment(
  userId,
  communityIdSource,
  { communityIdExplicitlyUpdated = false } = {},
) {
  const teamRow = await repo.getTeamCodeFields(userId);
  if (!teamRow) return null;

  const supabase = getSupabaseClient();
  const leadSeat = await resolveLeadSeatForUser(supabase, userId);

  const code = normalizeTeamCodeFromCommunityId(communityIdSource);
  if (code && shouldAlignAllTeamFieldsFromCommunityId({
    communityId: code,
    teamId: teamRow.TeamId,
    coachTeamId: teamRow.CoachTeamId,
    communityIdExplicitlyUpdated,
  })) {
    return syncAllTeamFieldsFromExplicitCommunityIdUpdate(
      userId,
      code,
      teamRow,
      leadSeat,
    );
  }

  const leadSync = await syncCoachLeadTeamCodeFromCommunityId(
    userId,
    communityIdSource,
    teamRow,
    leadSeat,
  );
  if (leadSync) return leadSync;

  const shouldTryMemberLink = code && shouldBackfillCoachTeamIdFromCommunityId({
    communityId: code,
    coachTeamId: teamRow.CoachTeamId,
  });

  if (!shouldTryMemberLink) return null;

  return syncSharedCoachTeamIdFromCommunityId(
    userId,
    code,
    teamRow,
    leadSeat,
    {
      requireResolvableTeam: false,
      allowTeamSwitch: false,
    },
  );
}
