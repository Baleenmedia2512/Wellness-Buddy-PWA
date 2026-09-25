/**
 * Community ID create / co-sponsor approval rules (Profile OTP flow).
 * Pure — no I/O.
 *
 * Create: requester's sponsor (CoachId) receives a 24h OTP.
 * Co-sponsor: same approver; email names the community's main sponsor.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import { COMMUNITY_ID_MIN_LENGTH } from '../user.validators.js';
import { normalizeTeamCodeFromCommunityId } from './communityIdTeamCodeSync.rules.js';

export const COMMUNITY_ID_OTP_FLAG = 'ff.community-id-otp';
export const COMMUNITY_ID_OTP_MIN_APP_VERSION = '3.5.0';
export const COMMUNITY_ID_OTP_HOURS = 24;
export const COMMUNITY_ID_OTP_MAX_ATTEMPTS = 5;
export const COMMUNITY_ID_OTP_BCRYPT_COST = 12;

export const REQUEST_KIND_CREATE = 'create';
export const REQUEST_KIND_CO_SPONSOR = 'co-sponsor';

export const REQUEST_STATUS_PENDING = 'pending';
export const REQUEST_STATUS_APPROVED = 'approved';
export const REQUEST_STATUS_CANCELLED = 'cancelled';
export const REQUEST_STATUS_EXPIRED = 'expired';

export const CLAIM_NO_SPONSOR = 'no-sponsor';
export const CLAIM_ALREADY_OWNED = 'already-owned';
/** @deprecated Kept for older clients/tests; change requests are now allowed. */
export const CLAIM_ALREADY_CONFIRMED = 'already-confirmed';
export const CLAIM_FULL = 'full';
export const CLAIM_INVALID = 'invalid';
export const CLAIM_CREATE = 'create';
export const CLAIM_CO_SPONSOR = 'co-sponsor';

const NO_SPONSOR_MESSAGE =
  'Link a sponsor before creating a Community ID. Ask your wellness centre to connect you.';
const ALREADY_OWNED_MESSAGE = 'This Community ID is already yours.';
const FULL_MESSAGE =
  'This Community ID already has a Sponsor and Co-Sponsor.';
const INVALID_MESSAGE = 'Community ID must be 4–100 letters or numbers.';

function toPositiveUserId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * New Profile clients skip immediate Community ID apply on POST /api/user/profile.
 * Old / missing versions keep legacy immediate save.
 *
 * @param {{ flagEnabled?: boolean, appVersion?: string|null, minAppVersion?: string }} args
 * @returns {boolean}
 */
export function shouldDeferCommunityIdToOtpFlow({
  flagEnabled = false,
  appVersion = null,
  minAppVersion = COMMUNITY_ID_OTP_MIN_APP_VERSION,
} = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, minAppVersion) === true;
}

/**
 * @param {unknown} expiresAt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isCommunityIdOtpExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return now.getTime() > exp.getTime();
}

/**
 * @param {unknown} attempts
 * @param {number} [max]
 * @returns {boolean}
 */
export function canAttemptCommunityIdOtp(
  attempts,
  max = COMMUNITY_ID_OTP_MAX_ATTEMPTS,
) {
  const n = Number(attempts);
  if (!Number.isFinite(n) || n < 0) return true;
  return n < max;
}

/**
 * @param {unknown} requestedAt
 * @param {number} [hours]
 * @returns {Date}
 */
export function communityIdOtpExpiresAt(
  requestedAt = new Date(),
  hours = COMMUNITY_ID_OTP_HOURS,
) {
  const start = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Collapse coach_teams + TeamId owners + pending create into occupancy.
 *
 * @param {{
 *   activeTeam?: { CoachId?: unknown, CoCoachId?: unknown }|null,
 *   teamIdOwnerIds?: unknown[],
 *   pendingCreateRequesterId?: unknown,
 * }} args
 */
export function buildCommunityIdOccupancy({
  activeTeam = null,
  teamIdOwnerIds = [],
  pendingCreateRequesterId = null,
} = {}) {
  let sponsorUserId = toPositiveUserId(activeTeam?.CoachId);
  let coSponsorUserId = toPositiveUserId(activeTeam?.CoCoachId);
  const owners = [...new Set(
    (teamIdOwnerIds || []).map(toPositiveUserId).filter(Boolean),
  )];
  if (!sponsorUserId && owners[0]) sponsorUserId = owners[0];
  if (!coSponsorUserId && owners[1] && owners[1] !== sponsorUserId) {
    coSponsorUserId = owners[1];
  }
  return {
    sponsorUserId,
    coSponsorUserId,
    pendingCreateRequesterId: toPositiveUserId(pendingCreateRequesterId),
  };
}

/**
 * Decide create vs co-sponsor vs reject.
 *
 * @param {{
 *   requestedCode?: unknown,
 *   requesterId?: unknown,
 *   requesterCoachId?: unknown,
 *   requesterConfirmedCode?: unknown,
 *   occupancy?: {
 *     sponsorUserId?: number|null,
 *     coSponsorUserId?: number|null,
 *     pendingCreateRequesterId?: number|null,
 *   },
 * }} args
 */
export function classifyCommunityIdRequest({
  requestedCode = null,
  requesterId = null,
  requesterCoachId = null,
  requesterConfirmedCode = null,
  occupancy = {},
} = {}) {
  const code = normalizeTeamCodeFromCommunityId(requestedCode);
  if (!code || code.length < COMMUNITY_ID_MIN_LENGTH) {
    return { ok: false, status: CLAIM_INVALID, message: INVALID_MESSAGE, code: null };
  }

  if (!toPositiveUserId(requesterCoachId)) {
    return {
      ok: false,
      status: CLAIM_NO_SPONSOR,
      message: NO_SPONSOR_MESSAGE,
      code,
    };
  }

  const uid = toPositiveUserId(requesterId);
  const confirmed = normalizeTeamCodeFromCommunityId(requesterConfirmedCode);
  if (confirmed && confirmed === code) {
    return {
      ok: false,
      status: CLAIM_ALREADY_OWNED,
      message: ALREADY_OWNED_MESSAGE,
      code,
    };
  }
  // Confirmed users may request a different Community ID (Profile Change).
  // On OTP verify the previous lead seat is released before the new one is assigned.

  const sponsorId = toPositiveUserId(occupancy?.sponsorUserId);
  const coId = toPositiveUserId(occupancy?.coSponsorUserId);
  const pendingCreateId = toPositiveUserId(occupancy?.pendingCreateRequesterId);
  const effectiveSponsor = sponsorId || pendingCreateId;

  if (uid && (effectiveSponsor === uid || coId === uid)) {
    return {
      ok: false,
      status: CLAIM_ALREADY_OWNED,
      message: ALREADY_OWNED_MESSAGE,
      code,
    };
  }

  if (effectiveSponsor && coId && effectiveSponsor !== coId) {
    return { ok: false, status: CLAIM_FULL, message: FULL_MESSAGE, code };
  }

  if (effectiveSponsor) {
    return {
      ok: true,
      status: CLAIM_CO_SPONSOR,
      kind: REQUEST_KIND_CO_SPONSOR,
      seat: 'co-sponsor',
      mainSponsorId: effectiveSponsor,
      code,
    };
  }

  return {
    ok: true,
    status: CLAIM_CREATE,
    kind: REQUEST_KIND_CREATE,
    seat: 'sponsor',
    mainSponsorId: null,
    code,
  };
}

/**
 * Strip OTP hash before returning a pending request to the client.
 *
 * @param {object|null} row
 * @param {{ approverName?: string|null }} [opts]
 */
export function toPublicCommunityIdRequest(row, { approverName = null } = {}) {
  if (!row) return null;
  const kind = row.RequestKind === REQUEST_KIND_CO_SPONSOR
    ? REQUEST_KIND_CO_SPONSOR
    : REQUEST_KIND_CREATE;
  return {
    id: row.Id ?? null,
    communityId: row.CommunityId ?? null,
    kind,
    status: row.Status ?? REQUEST_STATUS_PENDING,
    expiresAt: row.OtpExpiresAt ?? null,
    approverName: approverName || null,
    mainSponsorName: row.MainSponsorName || null,
    seat: kind === REQUEST_KIND_CO_SPONSOR ? 'co-sponsor' : 'sponsor',
  };
}

/**
 * Confirmed Community ID for a lead: TeamId or CommunityId when a seat exists.
 *
 * @param {{ teamId?: unknown, communityId?: unknown, teamSeat?: unknown }} args
 * @returns {string|null}
 */
export function resolveConfirmedCommunityId({
  teamId = null,
  communityId = null,
  teamSeat = null,
} = {}) {
  if (teamSeat) {
    return normalizeTeamCodeFromCommunityId(communityId || teamId);
  }
  return normalizeTeamCodeFromCommunityId(teamId);
}

/**
 * CoachTeamId is the approver/sponsor's team — not the member's new Community ID.
 * Prefer the sponsor's Community ID, then TeamId, then their own CoachTeamId.
 *
 * @param {{
 *   approverCommunityId?: unknown,
 *   approverTeamId?: unknown,
 *   approverCoachTeamId?: unknown,
 *   existingCoachTeamId?: unknown,
 * }} args
 * @returns {string|null}
 */
export function resolveCoachTeamIdFromApprover({
  approverCommunityId = null,
  approverTeamId = null,
  approverCoachTeamId = null,
  existingCoachTeamId = null,
} = {}) {
  return normalizeTeamCodeFromCommunityId(approverCommunityId)
    || normalizeTeamCodeFromCommunityId(approverTeamId)
    || normalizeTeamCodeFromCommunityId(approverCoachTeamId)
    || normalizeTeamCodeFromCommunityId(existingCoachTeamId);
}
