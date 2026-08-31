/**
 * Phone onboarding: attach a verified email, or recover an existing
 * email-account after OTP (changed phone number).
 */
import logger from '../../shared/lib/logger.js';
import { sendOtp, verifyEmailOwnershipOtp } from '../auth/auth.service.js';
import * as repo from './user.repository.js';
import { hasValidProfileName } from './domain/profileCompleteness.js';
import { normalizeEmailForStorage } from './domain/emailIdentity.rules.js';
import {
  decideOnboardingEmailAction,
  planAdoptPhoneTransfer,
  EMAIL_TAKEN_ADOPT_MESSAGE,
} from './domain/onboardingEmail.rules.js';

const USER_COLS = '"UserId", "UserName", "Email", "PhoneNumber", "Status"';

function toSessionUser(row, { phone } = {}) {
  return {
    id: row.UserId,
    username: row.UserName,
    email: row.Email || '',
    phone: row.PhoneNumber || phone || '',
    status: row.Status,
  };
}

export async function checkOnboardingEmail({ userId, email, sendOtp: shouldSendOtp = false }) {
  const conflict = await repo.findByEmailExcludingUserId(email, userId, '"UserId"');
  if (conflict?.UserId) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        available: false,
        code: 'EMAIL_TAKEN',
        message: EMAIL_TAKEN_ADOPT_MESSAGE,
      },
    };
  }
  if (!shouldSendOtp) {
    return {
      httpStatus: 200,
      body: { success: true, available: true },
    };
  }

  const sent = await sendOtp({ recipient: email, contactType: 'email' });
  if (sent.httpStatus !== 200) {
    return sent;
  }
  return {
    httpStatus: 200,
    body: { success: true, available: true, otpSent: true },
  };
}

export async function verifyOnboardingEmail({
  userId,
  email,
  otp,
  name,
  adoptExisting,
}) {
  const otpResult = await verifyEmailOwnershipOtp({ recipient: email, otp });
  if (otpResult.httpStatus !== 200) {
    return otpResult;
  }

  const current = await repo.findByUserId(userId, USER_COLS);
  if (!current) {
    return { httpStatus: 404, body: { success: false, message: 'User not found' } };
  }

  const owner = await repo.findByEmail(email, USER_COLS);
  const decision = decideOnboardingEmailAction({
    currentUserId: userId,
    emailOwnerUserId: owner?.UserId ?? null,
    adoptExisting,
  });

  if (decision.action === 'OFFER_ADOPT') {
    return {
      httpStatus: 409,
      body: {
        success: false,
        code: decision.code,
        message: decision.message,
        canAdopt: true,
      },
    };
  }

  const cleanName = String(name || '').trim();
  const shouldSetName = cleanName.length >= 2
    && hasValidProfileName(cleanName, { phoneNumber: current.PhoneNumber });

  if (decision.action === 'ASSIGN' || decision.action === 'ALREADY_OWNED') {
    const patch = { Email: normalizeEmailForStorage(email) };
    if (shouldSetName) patch.UserName = cleanName;
    await repo.updateUserById(userId, patch);
    const updated = await repo.findByUserId(userId, USER_COLS);
    logger.info('[onboarding-email] assigned verified email', { userId });
    return {
      httpStatus: 200,
      body: {
        success: true,
        adopted: false,
        email: updated?.Email || email,
        userName: updated?.UserName || cleanName,
        user: toSessionUser(updated || current),
      },
    };
  }

  // ADOPT — recover the email account and move this phone onto it.
  const phonePlan = planAdoptPhoneTransfer({
    newPhone: current.PhoneNumber,
    existingPhone: owner.PhoneNumber,
  });
  if (!phonePlan.ok) {
    return { httpStatus: 400, body: { success: false, message: phonePlan.message } };
  }

  const originalPhone = current.PhoneNumber;
  try {
    await repo.updateUserById(userId, {
      PhoneNumber: null,
      Status: 'Inactive',
    });

    const existingPatch = {};
    if (!phonePlan.samePhone) {
      existingPatch.PhoneNumber = originalPhone;
    }
    if (shouldSetName && !hasValidProfileName(owner.UserName, {
      phoneNumber: owner.PhoneNumber,
      email: owner.Email,
    })) {
      existingPatch.UserName = cleanName;
    }
    if (Object.keys(existingPatch).length > 0) {
      await repo.updateUserById(owner.UserId, existingPatch);
    }
  } catch (err) {
    try {
      await repo.updateUserById(userId, {
        PhoneNumber: originalPhone,
        Status: current.Status || 'Active',
      });
    } catch {
      /* restore best-effort */
    }
    logger.warn('[onboarding-email] adopt failed', { message: err?.message });
    return {
      httpStatus: 500,
      body: { success: false, message: 'Could not move your number onto that account. Try again.' },
    };
  }

  const recovered = await repo.findByUserId(owner.UserId, USER_COLS);
  logger.info('[onboarding-email] recovered existing email account', {
    fromUserId: userId,
    toUserId: owner.UserId,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      adopted: true,
      email: recovered?.Email || email,
      userName: recovered?.UserName || owner.UserName,
      user: toSessionUser(recovered || owner, { phone: current.PhoneNumber }),
    },
  };
}
