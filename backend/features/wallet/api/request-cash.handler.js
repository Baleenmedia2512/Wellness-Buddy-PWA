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
  WALLET_OTP_MINUTES,
} from '../domain/wallet.rules.js';
import * as walletRepo from '../data/wallet.repo.js';
import { findActivePersonByUserId } from '../data/people.repo.js';
import { validateRequestCash } from '../validation/wallet.schema.js';
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
    expiresMinutes: WALLET_OTP_MINUTES,
  });
  if (!inserted?.Id) {
    throw new ValidationError(500, 'Could not start the cash request');
  }

  const mail = buildWalletCashOtpEmail({
    otp,
    requesterName: requester.UserName,
    amountLabel: formatWalletAmount(amount),
    expiresMinutes: WALLET_OTP_MINUTES,
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
