/**
 * Community ID / Team Code → shared CoachTeamId assignment rules (profile path).
 * Lead-seat claims reuse communityIdTeamCodeSync.rules.js.
 */
import {
  isCoachTeamCodeSyncRole,
  normalizeTeamCodeFromCommunityId,
  resolveCoachTeamCodeToSync,
} from './communityIdTeamCodeSync.rules.js';

export { normalizeTeamCodeFromCommunityId, resolveCoachTeamCodeToSync };

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeStoredTeamCode(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim().toUpperCase();
}

/**
 * Member (or non-lead-claim) should inherit CoachTeamId from a resolved shared team code.
 *
 * @param {{ role?: string|null, teamId?: string|null, teamSeat?: string|null, communityId?: string|null, resolvedTeamCode?: string|null, coachTeamId?: string|null, allowTeamSwitch?: boolean }} args
 * @returns {boolean}
 */
export function shouldApplySharedCoachTeamId({
  role = null,
  teamId = null,
  teamSeat = null,
  communityId = null,
  resolvedTeamCode = null,
  coachTeamId = null,
  allowTeamSwitch = false,
} = {}) {
  if (resolveCoachTeamCodeToSync({
    role,
    teamId,
    teamSeat,
    communityId,
  })) {
    return false;
  }
  const input = normalizeTeamCodeFromCommunityId(communityId);
  const resolved = normalizeStoredTeamCode(resolvedTeamCode);
  if (!input || !resolved) return false;

  if (allowTeamSwitch && coachTeamIdNeedsUpdate({ coachTeamId, resolvedTeamCode: resolved })) {
    return true;
  }

  if (teamSeat) return false;
  return true;
}

/**
 * @param {{ coachTeamId?: string|null, resolvedTeamCode?: string|null }} args
 * @returns {boolean}
 */
export function coachTeamIdNeedsUpdate({
  coachTeamId = null,
  resolvedTeamCode = null,
} = {}) {
  const current = normalizeStoredTeamCode(coachTeamId);
  const next = normalizeStoredTeamCode(resolvedTeamCode);
  if (!next) return false;
  return current !== next;
}

/**
 * Target team code when the user explicitly saves Community ID in profile.
 * Prefer a resolved shared team; otherwise use the typed code.
 *
 * @param {{ inputCode?: string|null, resolvedFound?: boolean, resolvedTeamCode?: string|null }} args
 * @returns {string|null}
 */
export function resolveTargetTeamCodeFromExplicitCommunityIdUpdate({
  inputCode = null,
  resolvedFound = false,
  resolvedTeamCode = null,
} = {}) {
  const input = normalizeTeamCodeFromCommunityId(inputCode);
  if (!input) return null;
  if (resolvedFound) {
    return normalizeStoredTeamCode(resolvedTeamCode) || input;
  }
  return input;
}

/**
 * @param {{ teamId?: string|null, coachTeamId?: string|null, targetCode?: string|null }} args
 * @returns {boolean}
 */
export function teamAssignmentFieldsNeedUpdate({
  teamId = null,
  coachTeamId = null,
  targetCode = null,
} = {}) {
  const target = normalizeStoredTeamCode(targetCode);
  if (!target) return false;
  const currentTeamId = normalizeStoredTeamCode(teamId);
  const currentCoachTeamId = normalizeStoredTeamCode(coachTeamId);
  return currentTeamId !== target || currentCoachTeamId !== target;
}

/**
 * Sponsor / Co-Sponsor leads must claim a seat when profile Community ID changes team code.
 *
 * @param {{ role?: string|null, teamSeat?: string|null }} args
 * @returns {boolean}
 */
export function shouldClaimLeadSeatOnExplicitCommunityIdUpdate({
  role = null,
  teamSeat = null,
} = {}) {
  return isCoachTeamCodeSyncRole(role) || !!teamSeat;
}

/**
 * Register coach_teams_table when profile Community ID is a new team code (not joining an existing team).
 *
 * @param {{ resolvedFound?: boolean, communityIdExplicitlyUpdated?: boolean }} args
 * @returns {boolean}
 */
export function shouldRegisterCoachTeamForCommunityId({
  resolvedFound = false,
  communityIdExplicitlyUpdated = false,
} = {}) {
  if (!communityIdExplicitlyUpdated) return false;
  return !resolvedFound;
}

/**
 * Whether assignLeadSeat should run during profile Community ID sync.
 *
 * @param {{ role?: string|null, teamSeat?: string|null, resolvedFound?: boolean, communityIdExplicitlyUpdated?: boolean }} args
 * @returns {boolean}
 */
export function shouldEnsureCoachTeamRowOnCommunityIdSync({
  role = null,
  teamSeat = null,
  resolvedFound = false,
  communityIdExplicitlyUpdated = false,
} = {}) {
  if (shouldRegisterCoachTeamForCommunityId({ resolvedFound, communityIdExplicitlyUpdated })) {
    return true;
  }
  return shouldClaimLeadSeatOnExplicitCommunityIdUpdate({ role, teamSeat });
}

/**
 * Profile save payload for team_table when Community ID is included.
 * Cleared Community ID updates display only; team codes are left unchanged.
 *
 * @param {string|null|undefined} communityId
 * @returns {Record<string, string|null>|null}
 */
export function buildTeamFieldsFromProfileCommunityId(communityId) {
  if (communityId === undefined) return null;
  const teamCode = normalizeTeamCodeFromCommunityId(communityId);
  if (!teamCode) {
    return { CommunityId: null };
  }
  return {
    CommunityId: teamCode,
    TeamId: teamCode,
    CoachTeamId: teamCode,
  };
}

/**
 * Keep CommunityId, TeamId, and CoachTeamId aligned from profile Community ID.
 *
 * @param {{ communityId?: string|null, teamId?: string|null, coachTeamId?: string|null, communityIdExplicitlyUpdated?: boolean }} args
 * @returns {boolean}
 */
export function shouldAlignAllTeamFieldsFromCommunityId({
  communityId = null,
  teamId = null,
  coachTeamId = null,
  communityIdExplicitlyUpdated = false,
} = {}) {
  const code = normalizeTeamCodeFromCommunityId(communityId);
  if (!code) return false;
  if (communityIdExplicitlyUpdated) return true;
  const currentTeamId = normalizeStoredTeamCode(teamId);
  const currentCoachTeamId = normalizeStoredTeamCode(coachTeamId);
  if (!currentTeamId || !currentCoachTeamId) return true;
  return currentTeamId !== code || currentCoachTeamId !== code;
}

/**
 * Backfill CoachTeamId from stored CommunityId when team link was never created.
 *
 * @param {{ communityId?: string|null, coachTeamId?: string|null, teamCode?: string|null }} args
 * @returns {boolean}
 */
export function shouldBackfillCoachTeamIdFromCommunityId({
  communityId = null,
  coachTeamId = null,
  teamCode = null,
} = {}) {
  if (coachTeamId && String(coachTeamId).trim()) return false;
  const code = normalizeTeamCodeFromCommunityId(communityId ?? teamCode);
  return !!code;
}

/**
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function isMemberTeamLinkRole(role) {
  return !isCoachTeamCodeSyncRole(role);
}
