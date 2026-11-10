import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  isWalletOtpExpired,
  toPublicCashRequest,
  uniqueWalletIdentity,
  WALLET_FLAG,
} from '../domain/wallet.rules.js';
import * as walletRepo from '../data/wallet.repo.js';
import { findActivePersonByUserId } from '../data/people.repo.js';
import { validateWalletUserId } from '../validation/wallet.schema.js';

function featureDisabled() {
  throw new ValidationError(404, 'Wallet is not available');
}

async function publicPending(userId) {
  const pending = await walletRepo.findPendingByRequesterId(userId);
  if (!pending) return null;
  if (pending.IsExpired || isWalletOtpExpired(pending.OtpExpiresAt)) {
    await walletRepo.markExpired(pending.Id);
    return null;
  }
  const approver = await findActivePersonByUserId(pending.ApproverId);
  return toPublicCashRequest(pending, {
    approverName: approver?.UserName || null,
    approverEmail: approver?.Email || null,
  });
}

export async function getWallet({ userId: rawUserId }) {
  if (!isEnabled(WALLET_FLAG)) featureDisabled();
  const userId = validateWalletUserId(rawUserId);
  const identity = uniqueWalletIdentity(userId);
  const owner = await findActivePersonByUserId(identity.userId);
  if (!owner) {
    throw new ValidationError(404, 'Account not found');
  }
  const wallet = await walletRepo.getOrCreateWallet(identity.userId);
  const pendingRequest = await publicPending(identity.userId);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        userId: identity.userId,
        balance: wallet?.Balance ?? 0,
        pendingRequest,
      },
    },
  };
}
