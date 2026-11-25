import bcrypt from 'bcryptjs';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import logger from '../../../shared/lib/logger.js';
import {
  canAttemptWalletOtp,
  formatWalletAmount,
  isWalletOtpExpired,
  uniqueWalletIdentity,
  WALLET_FLAG,
  WALLET_OTP_MAX_ATTEMPTS,
  walletOtpLockedBody,
} from '../domain/wallet.rules.js';
import * as walletRepo from '../data/wallet.repo.js';
import { findActivePersonByUserId } from '../data/people.repo.js';
import { validateCancelRequest, validateVerifyOtp } from '../validation/wallet.schema.js';

export async function verifyWalletOtp(body) {
  if (!isEnabled(WALLET_FLAG)) {
    throw new ValidationError(404, 'Wallet is not available');
  }
  const { userId, otp } = validateVerifyOtp(body);
  const identity = uniqueWalletIdentity(userId);
  const requester = await findActivePersonByUserId(identity.userId);
  if (!requester) {
    throw new ValidationError(404, 'Account not found');
  }

  const pending = await walletRepo.findPendingByRequesterId(identity.userId);
  if (!pending) {
    throw new ValidationError(404, 'No pending wallet request found');
  }

  if (pending.IsExpired || isWalletOtpExpired(pending.OtpExpiresAt)) {
    await walletRepo.markExpired(pending.Id);
    throw new ValidationError(400, 'This code has expired. Send a new request.');
  }

  if (!canAttemptWalletOtp(pending.OtpAttempts, WALLET_OTP_MAX_ATTEMPTS)) {
    await walletRepo.markExpired(pending.Id);
    return { httpStatus: 400, body: walletOtpLockedBody() };
  }

  const matches = await bcrypt.compare(String(otp), pending.OtpHash);
  if (!matches) {
    const next = Number(pending.OtpAttempts || 0) + 1;
    await walletRepo.incrementOtpAttempts(pending.Id, next);
    const left = WALLET_OTP_MAX_ATTEMPTS - next;
    if (left <= 0) {
      await walletRepo.markExpired(pending.Id);
      return { httpStatus: 400, body: walletOtpLockedBody() };
    }
    throw new ValidationError(
      400,
      `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`,
    );
  }

  let credited;
  try {
    credited = await walletRepo.approveAndCredit({
      requestId: pending.Id,
      requesterId: identity.userId,
      amount: pending.Amount,
    });
  } catch (err) {
    if (err?.message === 'WALLET_REQUEST_NOT_PENDING') {
      throw new ValidationError(409, 'This request was already processed');
    }
    throw err;
  }

  logger.info('[wallet] cash credited', {
    requesterId: identity.userId,
    requestId: pending.Id,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        balance: credited.balance,
        creditedAmount: pending.Amount,
        message: `₹${formatWalletAmount(pending.Amount)} added to your wallet.`,
      },
    },
  };
}

export async function cancelWalletRequest(body) {
  if (!isEnabled(WALLET_FLAG)) {
    throw new ValidationError(404, 'Wallet is not available');
  }
  const { userId } = validateCancelRequest(body);
  const identity = uniqueWalletIdentity(userId);
  const requester = await findActivePersonByUserId(identity.userId);
  if (!requester) {
    throw new ValidationError(404, 'Account not found');
  }
  await walletRepo.cancelPendingByRequesterId(identity.userId);
  const wallet = await walletRepo.getOrCreateWallet(identity.userId);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        balance: wallet?.Balance ?? 0,
        pendingRequest: null,
      },
    },
  };
}
