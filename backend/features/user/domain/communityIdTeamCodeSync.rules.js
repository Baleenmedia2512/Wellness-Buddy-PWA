/**
 * Legacy coach migration: profile Community ID doubles as Sponsor Team Code
 * when the user has no lead seat yet.
 */
import { normalizeCommunityId } from '../user.validators.js';

const TEAM_CODE_SYNC_ROLES = new Set(['coach', 'upline']);

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeTeamCodeFromCommunityId(raw) {
  const normalized = normalizeCommunityId(raw);
  return normalized ? normalized.toUpperCase() : null;
}

/**
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function isCoachTeamCodeSyncRole(role) {
  return TEAM_CODE_SYNC_ROLES.has(String(role || '').toLowerCase());
}

/**
 * Coach/upline with a Community ID but no Team Code seat yet should sync on profile save.
 *
 * @param {{ role?: string|null, teamId?: string|null, teamSeat?: string|null, communityId?: string|null }} args
 * @returns {boolean}
 */
export function shouldSyncCommunityIdToTeamCode({
  role = null,
  teamId = null,
  teamSeat = null,
  communityId = null,
} = {}) {
  if (!isCoachTeamCodeSyncRole(role)) return false;
  if (teamId && String(teamId).trim()) return false;
  if (teamSeat) return false;
  return !!normalizeTeamCodeFromCommunityId(communityId);
}

/**
 * @param {{ role?: string|null, teamId?: string|null, teamSeat?: string|null, communityId?: string|null }} args
 * @returns {string|null}
 */
export function resolveCoachTeamCodeToSync(args) {
  if (!shouldSyncCommunityIdToTeamCode(args)) return null;
  return normalizeTeamCodeFromCommunityId(args.communityId);
}
