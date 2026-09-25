/**
 * Profile Community ID create / co-sponsor — 24h sponsor OTP (ADR-0013).
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { assignLeadSeat, releaseLeadSeat, resolveLeadSeatForUser } from '../../utils/coachTeamSeats.js';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import * as userRepo from './user.repository.js';
import * as requestRepo from './communityIdApproval.repository.js';
import { normalizeTeamCodeFromCommunityId } from './domain/communityIdTeamCodeSync.rules.js';
import {
  CLAIM_ALREADY_OWNED,
  CLAIM_FULL,
  COMMUNITY_ID_OTP_BCRYPT_COST,
  COMMUNITY_ID_OTP_FLAG,
  COMMUNITY_ID_OTP_HOURS,
  COMMUNITY_ID_OTP_MAX_ATTEMPTS,
  REQUEST_KIND_CO_SPONSOR,
  REQUEST_STATUS_PENDING,
  buildCommunityIdOccupancy,
  canAttemptCommunityIdOtp,
  classifyCommunityIdRequest,
  communityIdOtpExpiresAt,
  isCommunityIdOtpExpired,
  resolveCoachTeamIdFromApprover,
  resolveConfirmedCommunityId,
  toPublicCommunityIdRequest,
} from './domain/communityIdApproval.rules.js';
import {
  buildCoSponsorCommunityIdOtpEmail,
  buildCreateCommunityIdOtpEmail,
} from './domain/communityIdOtpEmail.rules.js';

function featureDisabled() {
  throw new ValidationError(404, 'Community ID approval is not available.');
}

function clearProfileCache({ email, userId }) {
  if (email) {
    try { cache.delete(cacheKeys.userProfile(String(email).toLowerCase())); } catch { /* non-fatal */ }
  }
  if (userId != null) {
    try { cache.delete(cacheKeys.userProfile(`id:${userId}`)); } catch { /* non-fatal */ }
  }
}

async function loadRequester({ email, userId }) {
  if (userId) {
    const row = await requestRepo.findUserIdentity(userId);
    if (row) return row;
  }
  if (email) {
    return userRepo.findByEmail(
      email,
      '"UserId", "UserName", "Email", "CoachId", "TeamId", "CoachTeamId", "CommunityId", "Role", "Status"',
    );
  }
  return null;
}

async function loadOccupancy(code, requesterId) {
  const [activeTeam, teamIdOwnerIds, pendingCreate] = await Promise.all([
    requestRepo.findActiveCoachTeam(code),
    requestRepo.findTeamIdOwners(code, requesterId),
    requestRepo.findPendingCreateByCommunityId(code, requesterId),
  ]);
  return buildCommunityIdOccupancy({
    activeTeam,
    teamIdOwnerIds,
    pendingCreateRequesterId: pendingCreate?.RequesterId ?? null,
  });
}

async function resolveMainSponsorName(mainSponsorId) {
  if (!mainSponsorId) return null;
  const row = await requestRepo.findUserIdentity(mainSponsorId);
  return row?.UserName ? String(row.UserName).trim() : null;
}

/**
 * Additive GET profile field. Never throws for a missing table.
 * @param {number|string} userId
 */
export async function getPublicPendingCommunityIdRequest(userId) {
  if (!isEnabled(COMMUNITY_ID_OTP_FLAG)) return null;
  try {
    const pending = await requestRepo.findPendingByRequesterId(userId);
    if (!pending) return null;
    if (isCommunityIdOtpExpired(pending.OtpExpiresAt)) {
      await requestRepo.markExpired(pending.Id);
      return null;
    }
    const approver = await requestRepo.findUserIdentity(pending.ApproverId);
    return toPublicCommunityIdRequest(pending, {
      approverName: approver?.UserName || null,
    });
  } catch (err) {
    if (requestRepo.isCommunityIdRequestsTableMissing(err)) {
      logger.warn('[community-id] requests table missing — run create_community_id_requests_table.sql');
      return null;
    }
    throw err;
  }
}

export async function requestCommunityIdApproval({ email = null, userId = null, communityId }) {
  if (!isEnabled(COMMUNITY_ID_OTP_FLAG)) featureDisabled();

  const requester = await loadRequester({ email, userId });
  if (!requester) {
    throw new ValidationError(404, 'User not found');
  }

  const supabase = getSupabaseClient();
  const leadSeat = await resolveLeadSeatForUser(supabase, requester.UserId);
  const confirmedCode = resolveConfirmedCommunityId({
    teamId: requester.TeamId,
    communityId: requester.CommunityId,
    teamSeat: leadSeat.seat,
  });

  const code = normalizeTeamCodeFromCommunityId(communityId);
  if (!code) {
    throw new ValidationError(400, 'Community ID is required');
  }

  let occupancy;
  try {
    occupancy = await loadOccupancy(code, requester.UserId);
  } catch (err) {
    if (requestRepo.isCommunityIdRequestsTableMissing(err)) {
      throw new ValidationError(503, 'Community ID approval is not configured yet. Run the database migration.');
    }
    throw err;
  }

  const classified = classifyCommunityIdRequest({
    requestedCode: code,
    requesterId: requester.UserId,
    requesterCoachId: requester.CoachId,
    requesterConfirmedCode: confirmedCode,
    occupancy,
  });

  if (!classified.ok) {
    if (classified.status === CLAIM_ALREADY_OWNED) {
      return {
        httpStatus: 200,
        body: {
          success: true,
          alreadyOwned: true,
          communityId: classified.code,
          message: classified.message,
        },
      };
    }
    throw new ValidationError(
      classified.status === CLAIM_FULL ? 409 : 400,
      classified.message,
    );
  }

  const approver = await requestRepo.findUserIdentity(requester.CoachId);
  if (!approver) {
    throw new ValidationError(404, 'Your sponsor could not be found.');
  }
  if (!approver.Email || !String(approver.Email).includes('@')) {
    throw new ValidationError(
      502,
      'Your sponsor has no email on file, so we cannot send the approval code.',
    );
  }

  const mainSponsorName = classified.kind === REQUEST_KIND_CO_SPONSOR
    ? (await resolveMainSponsorName(classified.mainSponsorId))
    : null;

  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, COMMUNITY_ID_OTP_BCRYPT_COST);
  const requestedAt = nowUtc();
  const otpExpiresAt = communityIdOtpExpiresAt(new Date(requestedAt)).toISOString();

  await requestRepo.cancelPendingByRequesterId(requester.UserId);

  const inserted = await requestRepo.insertRequest({
    RequesterId: requester.UserId,
    ApproverId: approver.UserId,
    CommunityId: classified.code,
    RequestKind: classified.kind,
    MainSponsorId: classified.mainSponsorId,
    MainSponsorName: mainSponsorName,
    OtpHash: otpHash,
    OtpExpiresAt: otpExpiresAt,
    OtpSentAt: requestedAt,
    OtpAttempts: 0,
    Status: REQUEST_STATUS_PENDING,
    RequestedAt: requestedAt,
  });

  const mail = classified.kind === REQUEST_KIND_CO_SPONSOR
    ? buildCoSponsorCommunityIdOtpEmail({
      otp,
      memberName: requester.UserName,
      communityId: classified.code,
      mainSponsorName,
      expiresHours: COMMUNITY_ID_OTP_HOURS,
    })
    : buildCreateCommunityIdOtpEmail({
      otp,
      memberName: requester.UserName,
      communityId: classified.code,
      expiresHours: COMMUNITY_ID_OTP_HOURS,
    });

  try {
    await sendTransactionalMail({
      to: approver.Email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (err) {
    logger.warn('[community-id] sponsor OTP email failed', {
      requesterId: requester.UserId,
      message: err?.message,
    });
    throw new ValidationError(502, 'Could not email the approval code to your sponsor. Please try again.');
  }

  logger.info('[community-id] approval OTP sent', {
    requesterId: requester.UserId,
    kind: classified.kind,
    communityId: classified.code,
  });

  clearProfileCache({ email: requester.Email, userId: requester.UserId });

  const publicRequest = toPublicCommunityIdRequest(inserted, {
    approverName: approver.UserName || null,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: classified.kind === REQUEST_KIND_CO_SPONSOR
        ? 'Approval code sent to your sponsor. They will confirm you as Co-Sponsor.'
        : 'Approval code sent to your sponsor. Community ID is pending until they approve.',
      communityIdRequest: publicRequest,
      expiresIn: '24 hours',
    },
  };
}

export async function verifyCommunityIdOtp({ email = null, userId = null, otp }) {
  if (!isEnabled(COMMUNITY_ID_OTP_FLAG)) featureDisabled();

  const requester = await loadRequester({ email, userId });
  if (!requester) {
    throw new ValidationError(404, 'User not found');
  }

  let pending;
  try {
    pending = await requestRepo.findPendingByRequesterId(requester.UserId);
  } catch (err) {
    if (requestRepo.isCommunityIdRequestsTableMissing(err)) {
      throw new ValidationError(503, 'Community ID approval is not configured yet. Run the database migration.');
    }
    throw err;
  }

  if (!pending) {
    throw new ValidationError(404, 'No pending Community ID request found.');
  }

  if (isCommunityIdOtpExpired(pending.OtpExpiresAt)) {
    await requestRepo.markExpired(pending.Id);
    throw new ValidationError(400, 'This code has expired (24 hours). Please send a new request.');
  }

  if (!canAttemptCommunityIdOtp(pending.OtpAttempts, COMMUNITY_ID_OTP_MAX_ATTEMPTS)) {
    await requestRepo.markExpired(pending.Id);
    throw new ValidationError(400, 'Maximum attempts exceeded. Please send a new request.');
  }

  const matches = await bcrypt.compare(String(otp), pending.OtpHash);
  if (!matches) {
    const next = Number(pending.OtpAttempts || 0) + 1;
    await requestRepo.incrementOtpAttempts(pending.Id, next);
    const left = COMMUNITY_ID_OTP_MAX_ATTEMPTS - next;
    throw new ValidationError(
      400,
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Maximum attempts exceeded. Please send a new request.',
    );
  }

  const supabase = getSupabaseClient();
  const previousSeat = await resolveLeadSeatForUser(supabase, requester.UserId);
  const nextCode = normalizeTeamCodeFromCommunityId(pending.CommunityId);
  const previousCode = normalizeTeamCodeFromCommunityId(previousSeat.teamId);

  const seatResult = await assignLeadSeat(supabase, pending.CommunityId, Number(requester.UserId));
  if (!seatResult.ok) {
    throw new ValidationError(409, seatResult.error || 'This Community ID is unavailable.');
  }

  if (previousSeat.seat && previousCode && nextCode && previousCode !== nextCode) {
    await releaseLeadSeat(supabase, Number(requester.UserId), previousCode);
  }

  const resolvedSeat = seatResult.seat === 'already'
    ? (pending.RequestKind === REQUEST_KIND_CO_SPONSOR ? 'co-sponsor' : 'sponsor')
    : seatResult.seat;

  const approver = await requestRepo.findUserIdentity(pending.ApproverId);
  const coachTeamId = resolveCoachTeamIdFromApprover({
    approverCommunityId: approver?.CommunityId,
    approverTeamId: approver?.TeamId,
    approverCoachTeamId: approver?.CoachTeamId,
    existingCoachTeamId: requester.CoachTeamId,
  });

  const teamUpdate = {
    CommunityId: pending.CommunityId,
    TeamId: pending.CommunityId,
  };
  if (coachTeamId) {
    teamUpdate.CoachTeamId = coachTeamId;
  }

  await userRepo.updateUserById(requester.UserId, teamUpdate);
  await requestRepo.markApproved(pending.Id);

  logger.info('[community-id] request approved', {
    requesterId: requester.UserId,
    communityId: pending.CommunityId,
    coachTeamId: coachTeamId || null,
    teamSeat: resolvedSeat,
  });

  clearProfileCache({ email: requester.Email, userId: requester.UserId });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: resolvedSeat === 'co-sponsor'
        ? 'You are now Co-Sponsor of this Community ID.'
        : 'Community ID confirmed. You are the Sponsor.',
      communityId: pending.CommunityId,
      teamId: pending.CommunityId,
      teamSeat: resolvedSeat,
    },
  };
}
