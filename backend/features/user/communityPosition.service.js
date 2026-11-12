/**
 * Community Position — catalog plus coach OTP (ADR-0016).
 * The member picks a role. Their coach (CoachId) receives a 24h code.
 * The position is saved only after the member enters that code.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import * as userRepo from './user.repository.js';
import * as repo from './communityPosition.repository.js';
import { buildCommunityPositionOtpEmail } from './domain/communityPositionOtpEmail.rules.js';
import {
  COMMUNITY_POSITION_OTP_BCRYPT_COST,
  COMMUNITY_POSITION_OTP_FLAG,
  COMMUNITY_POSITION_OTP_HOURS,
  COMMUNITY_POSITION_OTP_MAX_ATTEMPTS,
  LEGACY_COMMUNITY_POSITIONS,
  POSITION_ALREADY_HELD,
  POSITION_STATUS_PENDING,
  canAttemptCommunityPositionOtp,
  classifyCommunityPositionRequest,
  communityPositionOtpExpiresAt,
  isCommunityPositionOtpExpired,
  normalizePositionCode,
  toPublicCommunityPosition,
  toPublicCommunityPositionRequest,
} from './domain/communityPosition.rules.js';

const IDENTITY_COLS = '"UserId", "UserName", "Email", "CoachId"';

function featureDisabled() {
  throw new ValidationError(404, 'Community Position approval is not available.');
}

function clearProfileCache({ email, userId }) {
  if (email) {
    try { cache.delete(cacheKeys.userProfile(String(email).toLowerCase())); } catch { /* non-fatal */ }
  }
  if (userId != null) {
    try { cache.delete(cacheKeys.userProfile(`id:${userId}`)); } catch { /* non-fatal */ }
  }
}

function legacyPublicPositions() {
  return LEGACY_COMMUNITY_POSITIONS.map((row) => ({ ...row, active: true }));
}

async function loadUser({ email, userId }) {
  if (userId) {
    const row = await userRepo.findByUserId(userId, IDENTITY_COLS);
    if (row) return row;
  }
  if (email) return userRepo.findByEmail(email, IDENTITY_COLS);
  return null;
}

async function resolveCoachApprover(user) {
  const coachId = Number(user?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before choosing a community position. Ask your wellness centre to connect you.',
    );
  }
  const coach = await userRepo.findByUserId(coachId, '"UserId", "UserName", "Email"');
  if (!coach) throw new ValidationError(404, 'Your coach could not be found.');
  const coachEmail = String(coach.Email || '').trim();
  if (!coachEmail.includes('@')) {
    throw new ValidationError(
      400,
      'Your coach has no email on file, so we cannot send the approval code.',
    );
  }
  const name = String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach';
  return { userId: coach.UserId, email: coachEmail, name };
}

async function loadActiveCatalog() {
  try {
    const rows = await repo.listPositions({ activeOnly: true });
    return {
      source: 'catalog',
      positions: rows.map(toPublicCommunityPosition).filter(Boolean),
    };
  } catch (err) {
    if (repo.isPositionsTableMissing(err)) {
      return { source: 'legacy', positions: legacyPublicPositions() };
    }
    throw err;
  }
}

async function loadConfirmedCode(userId) {
  const prefs = await userRepo.getEventProfilePreferences(userId);
  return normalizePositionCode(prefs?.eventLevel);
}

/**
 * Active codes for event registration. Empty when the catalog table is missing
 * so callers keep the legacy allow-list.
 * @returns {Promise<string[]>}
 */
export async function listActivePositionCodes() {
  const catalog = await loadActiveCatalog();
  if (catalog.source !== 'catalog') return [];
  return catalog.positions.filter((row) => row.active).map((row) => row.code);
}

export async function listCommunityPositions() {
  const catalog = await loadActiveCatalog();
  return {
    httpStatus: 200,
    body: {
      success: true,
      positions: catalog.positions.filter((row) => row.active !== false),
      source: catalog.source,
    },
  };
}

/**
 * @param {unknown} code
 * @returns {Promise<object|null>}
 */
export async function describeCommunityPosition(code) {
  const normalized = normalizePositionCode(code);
  if (!normalized) return null;
  try {
    const row = await repo.findPositionByCode(normalized);
    if (row) return toPublicCommunityPosition(row);
  } catch (err) {
    if (!repo.isPositionsTableMissing(err)) throw err;
  }
  const legacy = LEGACY_COMMUNITY_POSITIONS.find((row) => row.code === normalized);
  if (legacy) return { ...legacy, active: true };
  return {
    code: normalized,
    label: normalized,
    featureKey: null,
    usageNote: '',
    sortOrder: 0,
    active: true,
  };
}

export async function getPublicPendingCommunityPositionRequest(userId) {
  if (!isEnabled(COMMUNITY_POSITION_OTP_FLAG)) return null;
  try {
    const pending = await repo.findPendingByRequesterId(userId);
    if (!pending) return null;
    if (isCommunityPositionOtpExpired(pending.OtpExpiresAt)) {
      await repo.markExpired(pending.Id);
      return null;
    }
    const approver = await userRepo.findByUserId(
      pending.ApproverId,
      '"UserId", "UserName", "Email"',
    );
    const described = await describeCommunityPosition(pending.PositionCode);
    return toPublicCommunityPositionRequest(pending, {
      approverName: approver?.UserName || null,
      approverEmail: approver?.Email || null,
      label: described?.label || pending.PositionCode,
      featureKey: described?.featureKey || null,
    });
  } catch (err) {
    if (repo.isPositionRequestsTableMissing(err)) {
      logger.warn('[community-position] requests table missing — run create_community_positions.sql');
      return null;
    }
    throw err;
  }
}

function setupRequired() {
  throw new ValidationError(
    503,
    'Community positions are not ready yet. Run create_community_positions.sql, then try again.',
  );
}

/**
 * @param {{ email?: string|null, userId?: number|null, positionCode: string }} input
 */
export async function requestCommunityPositionApproval({
  email = null,
  userId = null,
  positionCode,
}) {
  if (!isEnabled(COMMUNITY_POSITION_OTP_FLAG)) featureDisabled();

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  const catalog = await loadActiveCatalog();
  const confirmed = await loadConfirmedCode(user.UserId);
  const classified = classifyCommunityPositionRequest({
    requestedCode: positionCode,
    confirmedCode: confirmed,
    activeCodes: catalog.positions.map((row) => row.code),
  });

  if (!classified.ok && classified.status === POSITION_ALREADY_HELD) {
    try { await repo.cancelPendingByRequesterId(user.UserId); } catch { /* non-fatal */ }
    clearProfileCache({ email: user.Email || email, userId: user.UserId });
    const held = catalog.positions.find((row) => row.code === classified.code)
      || await describeCommunityPosition(classified.code);
    return {
      httpStatus: 200,
      body: {
        success: true,
        alreadyHeld: true,
        message: classified.message,
        positionCode: classified.code,
        communityPosition: held,
      },
    };
  }
  if (!classified.ok) throw new ValidationError(400, classified.message);

  const coach = await resolveCoachApprover(user);
  const position = catalog.positions.find((row) => row.code === classified.code);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, COMMUNITY_POSITION_OTP_BCRYPT_COST);
  const requestedAt = nowUtc();
  const otpExpiresAt = communityPositionOtpExpiresAt(new Date(requestedAt)).toISOString();

  try {
    await repo.cancelPendingByRequesterId(user.UserId);
    await repo.insertRequest({
      RequesterId: user.UserId,
      ApproverId: coach.userId,
      PositionCode: classified.code,
      OtpHash: otpHash,
      OtpExpiresAt: otpExpiresAt,
      OtpSentAt: requestedAt,
      OtpAttempts: 0,
      Status: POSITION_STATUS_PENDING,
      RequestedAt: requestedAt,
    });
  } catch (err) {
    if (repo.isPositionRequestsTableMissing(err) || repo.isPositionsTableMissing(err)) {
      setupRequired();
    }
    throw err;
  }

  const mail = buildCommunityPositionOtpEmail({
    otp,
    memberName: user.UserName,
    positionLabel: position?.label || classified.code,
    expiresHours: COMMUNITY_POSITION_OTP_HOURS,
  });
  await sendTransactionalMail({
    to: coach.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  logger.info('[community-position] coach approval email sent', {
    userId: user.UserId,
    coachUserId: coach.userId,
    positionCode: classified.code,
  });

  const pending = await repo.findPendingByRequesterId(user.UserId);
  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `We sent an approval code to your coach (${coach.name}). Ask them for the code to take this position.`,
      communityPositionRequest: toPublicCommunityPositionRequest(pending || {
        PositionCode: classified.code,
        Status: POSITION_STATUS_PENDING,
        OtpExpiresAt: otpExpiresAt,
      }, {
        approverName: coach.name,
        approverEmail: coach.email,
        label: position?.label || classified.code,
        featureKey: position?.featureKey || null,
      }),
    },
  };
}

/**
 * @param {{ email?: string|null, userId?: number|null, otp: string }} input
 */
export async function verifyCommunityPositionOtp({ email = null, userId = null, otp }) {
  if (!isEnabled(COMMUNITY_POSITION_OTP_FLAG)) featureDisabled();

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  let pending;
  try {
    pending = await repo.findPendingByRequesterId(user.UserId);
  } catch (err) {
    if (repo.isPositionRequestsTableMissing(err)) setupRequired();
    throw err;
  }
  if (!pending) {
    throw new ValidationError(400, 'No active approval code found. Ask your coach to check email, or send a new code.');
  }
  if (isCommunityPositionOtpExpired(pending.OtpExpiresAt)) {
    await repo.markExpired(pending.Id);
    throw new ValidationError(400, 'Approval code expired. Send a new one to your coach.');
  }
  if (!canAttemptCommunityPositionOtp(pending.OtpAttempts, COMMUNITY_POSITION_OTP_MAX_ATTEMPTS)) {
    throw new ValidationError(400, 'Too many tries. Send a new code to your coach.');
  }

  const matches = await bcrypt.compare(String(otp || '').trim(), pending.OtpHash);
  if (!matches) {
    const next = Number(pending.OtpAttempts || 0) + 1;
    await repo.incrementOtpAttempts(pending.Id, next);
    throw new ValidationError(400, 'Invalid approval code');
  }

  const code = normalizePositionCode(pending.PositionCode);
  const saved = await userRepo.setEventProfilePreferences(user.UserId, { eventLevel: code });
  if (!saved) {
    throw new ValidationError(500, 'Community position could not be saved.');
  }
  await repo.markApproved(pending.Id);
  clearProfileCache({ email: user.Email || email, userId: user.UserId });

  const communityPosition = await describeCommunityPosition(code);
  logger.info('[community-position] position saved after coach approval', {
    userId: user.UserId,
    positionCode: code,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Community position confirmed.',
      positionCode: code,
      eventLevel: code,
      communityPosition,
    },
  };
}
