import bcrypt from 'bcryptjs';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import logger from '../../../shared/lib/logger.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { generateEmailOtp } from '../../auth/domain/otp-length.rules.js';
import { buildWalletCashOtpEmail } from '../domain/wallet-otp-email.rules.js';
import {
  formatWalletAmount,
  toPublicCashRequest,
  uniqueWalletIdentity,
  WALLET_FLAG,
  WALLET_OTP_BCRYPT_COST,
  walletOtpResendWaitMs,
} from '../domain/wallet.rules.js';
import * as walletRepo from '../data/wallet.repo.js';
import { findActivePersonByUserId } from '../data/people.repo.js';
import { validateRequestCash, validateResendOtp } from '../validation/wallet.schema.js';
import { scheduleWalletOtpMail } from './deferred-mail.js';

async function sendWalletOtpMail({
  requestId,
  requesterId,
  approverId,
  approverEmail,
  mail,
}) {
  try {
    await sendTransactionalMail({
      to: approverEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (err) {
    logger.warn('[wallet] cash OTP email failed', {
      requesterId,
      message: err?.message,
    });
    await walletRepo.cancelPendingById(requestId);
    throw err;
  }
  await walletRepo.markOtpEmailSent(requestId);
  logger.info('[wallet] cash OTP sent', { requesterId, approverId });
}

export async function requestWalletCash(body) {
  if (!isEnabled(WALLET_FLAG)) {
    throw new ValidationError(404, 'Wallet is not available');
  }
  const { userId, amount, approverUserId } = validateRequestCash(body);
  const identity = uniqueWalletIdentity(userId);
  const requester = await findActivePersonByUserId(identity.userId);
  if (!requester) {
    throw new ValidationError(404, 'Account not found');
  }

  const approver = await findActivePersonByUserId(approverUserId);
  if (!approver || String(approver.Status || '').trim().toLowerCase() !== 'active') {
    throw new ValidationError(404, 'Select a person who is in Wellness Valley');
  }
  if (!approver.Email) {
    throw new ValidationError(
      422,
      'That person has no Wellness Valley email, so we cannot send the code',
    );
  }

  await walletRepo.getOrCreateWallet(identity.userId);
  await walletRepo.cancelPendingByRequesterId(identity.userId);

  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, WALLET_OTP_BCRYPT_COST);

  const inserted = await walletRepo.insertCashRequest({
    requesterId: identity.userId,
    approverId: approver.UserId,
    amount,
    otpHash,
  });
  if (!inserted?.Id) {
    throw new ValidationError(500, 'Could not start the cash request');
  }

  const mail = buildWalletCashOtpEmail({
    otp,
    requesterName: requester.UserName,
    amountLabel: formatWalletAmount(amount),
    requesterPhone: requester.PhoneNumber,
  });

  scheduleWalletOtpMail(() => sendWalletOtpMail({
    requestId: inserted.Id,
    requesterId: identity.userId,
    approverId: approver.UserId,
    approverEmail: approver.Email,
    mail,
  }));

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        pendingRequest: toPublicCashRequest(inserted, {
          approverName: approver.UserName || null,
          approverEmail: approver.Email,
        }),
        message: `Enter the code. We are emailing it to ${approver.UserName || 'the selected person'}.`,
      },
    },
  };
}

export async function resendWalletOtp(body) {
  if (!isEnabled(WALLET_FLAG)) {
    throw new ValidationError(404, 'Wallet is not available');
  }
  const { userId } = validateResendOtp(body);
  const identity = uniqueWalletIdentity(userId);
  const requester = await findActivePersonByUserId(identity.userId);
  if (!requester) {
    throw new ValidationError(404, 'Account not found');
  }

  const pending = await walletRepo.findPendingByRequesterId(identity.userId);
  if (!pending) {
    throw new ValidationError(404, 'No pending wallet request found');
  }
  if (!pending.OtpSentAt) {
    throw new ValidationError(429, 'The code is still being sent. Wait a moment, then resend.');
  }
  const waitMs = walletOtpResendWaitMs(pending.OtpSentAt);
  if (waitMs > 0) {
    const seconds = Math.max(1, Math.ceil(waitMs / 1000));
    throw new ValidationError(429, `Wait ${seconds}s before resending the code.`);
  }

  const approver = await findActivePersonByUserId(pending.ApproverId);
  if (!approver?.Email) {
    throw new ValidationError(
      422,
      'That person has no Wellness Valley email, so we cannot send the code',
    );
  }

  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, WALLET_OTP_BCRYPT_COST);
  await walletRepo.replacePendingOtp({ id: pending.Id, otpHash });

  const mail = buildWalletCashOtpEmail({
    otp,
    requesterName: requester.UserName,
    amountLabel: formatWalletAmount(pending.Amount),
    requesterPhone: requester.PhoneNumber,
  });

  try {
    await sendTransactionalMail({
      to: approver.Email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (err) {
    logger.warn('[wallet] cash OTP resend failed', {
      requesterId: identity.userId,
      requestId: pending.Id,
      message: err?.message,
    });
    throw new ValidationError(502, 'Could not resend the code. Try again.');
  }

  await walletRepo.markOtpEmailSent(pending.Id);
  const refreshed = await walletRepo.findPendingByRequesterId(identity.userId);
  logger.info('[wallet] cash OTP resent', {
    requesterId: identity.userId,
    requestId: pending.Id,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        pendingRequest: toPublicCashRequest(refreshed || pending, {
          approverName: approver.UserName || null,
          approverEmail: approver.Email,
        }),
        message: 'Code sent again.',
      },
    },
  };
}
