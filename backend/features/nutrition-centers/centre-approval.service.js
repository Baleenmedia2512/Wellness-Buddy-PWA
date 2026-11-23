/**
 * Email the member's coach an approval code, then let the member confirm it
 * before the centre register button is used.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { generateEmailOtp, isValidEmailOtp } from '../auth/domain/otp-length.rules.js';
import * as authRepo from '../auth/auth.repository.js';
import * as repo from './centers.repository.js';
import {
  CENTRE_APPROVAL_CONTACT_TYPE,
  CENTRE_APPROVAL_TTL_MINUTES,
  buildCentreApprovalEmail,
  centreApprovalExpiryIst,
  centreApprovalRecipientKey,
  centreRegisterNeedsCoachApproval,
} from './domain/centreApproval.rules.js';

function requireUserId(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  return id;
}

async function resolveCoachApprover(user) {
  const coachId = Number(user?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before registering a centre. Your coach approves it with an email code.',
    );
  }
  const { data: coach, error } = await repo.findUserForCentreApproval(coachId);
  if (error) throw new ValidationError(500, 'Your coach could not be loaded.');
  if (!coach) throw new ValidationError(404, 'Your coach could not be found.');
  const email = String(coach.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(400, 'Your coach has no email on file, so we cannot send the approval code.');
  }
  const name = String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach';
  return { userId: coach.UserId, email, name };
}

export async function requestCentreCoachApproval({ userId }) {
  const id = requireUserId(userId);
  const { data: user, error } = await repo.findUserForCentreApproval(id);
  if (error) throw new ValidationError(500, 'Account could not be loaded.');
  if (!user) throw new ValidationError(404, 'Account not found');
  const coach = await resolveCoachApprover(user);

  const recipient = centreApprovalRecipientKey(id);
  await authRepo.deactivateActiveOtps(recipient, CENTRE_APPROVAL_CONTACT_TYPE);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: centreApprovalExpiryIst(),
    ContactType: CENTRE_APPROVAL_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });

  const mail = buildCentreApprovalEmail({
    otp,
    memberName: user.UserName,
    coachName: coach.name,
  });
  await sendTransactionalMail({
    to: coach.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  logger.info('[nutrition-centers] coach approval emailed', {
    userId: id,
    coachUserId: coach.userId,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `Sent for approval. OTP sent to your coach ${coach.name}.`,
      data: {
        coachName: coach.name,
        expiresInMinutes: CENTRE_APPROVAL_TTL_MINUTES,
      },
    },
  };
}

export async function verifyCentreCoachApproval({ userId, otp }) {
  const id = requireUserId(userId);
  const code = String(otp || '').trim();
  if (!isValidEmailOtp(code)) {
    return { httpStatus: 400, body: { success: false, message: 'Enter the 4-digit OTP from your coach' } };
  }
  const recipient = centreApprovalRecipientKey(id);
  const otpData = await authRepo.fetchActiveOtp(recipient, CENTRE_APPROVAL_CONTACT_TYPE);
  if (!otpData) {
    return {
      httpStatus: 400,
      body: { success: false, message: 'No active approval code. Send for approval again.' },
    };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIst = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIst > expiresAt) {
    return {
      httpStatus: 400,
      body: { success: false, message: 'Approval code expired. Send for approval again.' },
    };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP. Ask your coach for the code.' } };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Coach approved. You can register this centre now.',
      data: { approved: true },
    },
  };
}

export async function assertCentreCoachApproved({ userId, appVersion, openingHours }) {
  if (!centreRegisterNeedsCoachApproval({ appVersion, openingHours })) return null;
  const approved = await authRepo.fetchRecentlyVerifiedOtp(
    centreApprovalRecipientKey(userId),
    CENTRE_APPROVAL_CONTACT_TYPE,
  );
  if (!approved) {
    return 'Enter the coach approval code before registering this centre.';
  }
  return null;
}

export async function consumeCentreCoachApproval(userId) {
  await repo.clearVerifiedCentreApproval(centreApprovalRecipientKey(userId), CENTRE_APPROVAL_CONTACT_TYPE);
}
