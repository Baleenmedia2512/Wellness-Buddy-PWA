import { ValidationError } from '../../../shared/lib/ValidationError.js';
import {
  isValidWalletOtp,
  parseWalletAmount,
  sanitizePeopleSearchQuery,
  toPositiveUserId,
  WALLET_SEARCH_MIN_CHARS,
} from '../domain/wallet.rules.js';

export function validateWalletUserId(raw) {
  const userId = toPositiveUserId(raw);
  if (!userId) {
    throw new ValidationError(400, 'Sign in again to open your wallet');
  }
  return userId;
}

export function validateRequestCash(body = {}) {
  const userId = validateWalletUserId(body.userId);
  const amount = parseWalletAmount(body.amount);
  if (amount == null) {
    throw new ValidationError(400, 'Enter an amount between ₹1 and ₹1,00,000');
  }
  const approverUserId = toPositiveUserId(body.approverUserId);
  if (!approverUserId) {
    throw new ValidationError(400, 'Select a person in Wellness Valley');
  }
  return { userId, amount, approverUserId };
}

export function validateVerifyOtp(body = {}) {
  const userId = validateWalletUserId(body.userId);
  const otp = String(body.otp ?? '').trim();
  if (!isValidWalletOtp(otp)) {
    throw new ValidationError(400, 'Enter the 4-digit code');
  }
  return { userId, otp };
}

export function validateCancelRequest(body = {}) {
  return { userId: validateWalletUserId(body.userId) };
}

export function validatePeopleSearch(query = {}) {
  const userId = validateWalletUserId(query.userId);
  const q = sanitizePeopleSearchQuery(query.q);
  if (q.length < WALLET_SEARCH_MIN_CHARS) {
    throw new ValidationError(400, 'Type at least 2 characters to search');
  }
  return { userId, q };
}
