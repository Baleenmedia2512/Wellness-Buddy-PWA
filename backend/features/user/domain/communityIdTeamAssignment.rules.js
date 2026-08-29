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
