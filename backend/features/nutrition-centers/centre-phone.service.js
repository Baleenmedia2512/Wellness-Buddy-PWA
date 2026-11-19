/**
 * SMS OTP for a centre phone that is not the member's login number.
 * Does not create an account or change the signed-in session.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { generateOtpForContactType, isValidSmsOtp } from '../auth/domain/otp-length.rules.js';
import { buildMdtOtpMessage } from '../auth/domain/otp-message.rules.js';
import { maskPhoneForLog } from '../auth/domain/mdt-phone.rules.js';
import { sendMdtSms } from '../auth/data/mdt-sms.client.js';
import * as authRepo from '../auth/auth.repository.js';
import * as repo from './centers.repository.js';
import {
  CENTRE_PHONE_CONTACT_TYPE,
  CENTRE_PHONE_TTL_MINUTES,
  centrePhoneExpiryIst,
  centrePhoneNeedsVerification,
  centrePhoneRecipientKey,
} from './domain/centrePhone.rules.js';

function requireUserId(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) throw new ValidationError(400, 'userId is required');
  return id;
}

function requirePhone(phone) {
  const value = String(phone || '').trim();
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new ValidationError(400, 'Enter a valid mobile number');
  }
  return value.startsWith('+') ? value : `+${digits}`;
}

export async function requestCentrePhoneOtp({ userId, phone }) {
  const id = requireUserId(userId);
  const e164 = requirePhone(phone);
  const recipient = centrePhoneRecipientKey(id, e164);
  await authRepo.deactivateActiveOtps(recipient, CENTRE_PHONE_CONTACT_TYPE);
  const otp = generateOtpForContactType('phone');
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: centrePhoneExpiryIst(),
    ContactType: CENTRE_PHONE_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });
  await sendMdtSms({ e164, message: buildMdtOtpMessage(otp) });
  logger.info('[nutrition-centers] centre phone OTP sent', {
    userId: id,
    phoneHint: maskPhoneForLog(e164),
  });
  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'OTP sent to this mobile number.',
      data: { expiresInMinutes: CENTRE_PHONE_TTL_MINUTES },
    },
  };
}

export async function verifyCentrePhoneOtp({ userId, phone, otp }) {
  const id = requireUserId(userId);
  const e164 = requirePhone(phone);
  const code = String(otp || '').trim();
  if (!isValidSmsOtp(code)) {
    return { httpStatus: 400, body: { success: false, message: 'Enter the 4-digit OTP sent to this number' } };
  }
  const recipient = centrePhoneRecipientKey(id, e164);
  const otpData = await authRepo.fetchActiveOtp(recipient, CENTRE_PHONE_CONTACT_TYPE);
  if (!otpData) {
    return { httpStatus: 400, body: { success: false, message: 'No active code for this number. Send OTP again.' } };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIst = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIst > expiresAt) {
    return { httpStatus: 400, body: { success: false, message: 'OTP expired. Send a new code to this number.' } };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP. Check the code sent to this number.' } };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return {
    httpStatus: 200,
    body: { success: true, message: 'Mobile number verified. You can use it for this centre.', data: { verified: true } },
  };
}

export async function assertCentrePhoneVerified({
  userId, ownerPhone, savedPhone, appVersion, openingHours,
}) {
  const { data: user, error } = await repo.findUserForCentreApproval(userId);
  if (error) return 'Account could not be loaded.';
  const needs = centrePhoneNeedsVerification({
    ownerPhone,
    accountPhone: user?.PhoneNumber,
    savedPhone,
    appVersion,
    openingHours,
  });
  if (!needs) return null;
  const approved = await authRepo.fetchRecentlyVerifiedOtp(
    centrePhoneRecipientKey(userId, ownerPhone),
    CENTRE_PHONE_CONTACT_TYPE,
  );
  if (!approved) {
    return 'Verify the new mobile number with the OTP sent to it before saving this centre.';
  }
  return null;
}

export async function consumeCentrePhoneOtp(userId, ownerPhone) {
  if (!ownerPhone) return;
  await repo.clearVerifiedCentreApproval(
    centrePhoneRecipientKey(userId, ownerPhone),
    CENTRE_PHONE_CONTACT_TYPE,
  );
}
