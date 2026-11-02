/**
 * Dedicated demo / review accounts (pure — no I/O).
 *
 * Email demo: internal QA (testereasywork@gmail.com).
 * Phone demo: Cashfree payment-review login — no real SMS; fixed OTP.
 *
 * Keep phone national digits in sync with
 * frontend/src/features/user/domain/demoAccount.js
 */

import { phonesMatch, canonicalPhoneForStorage } from './phone-identity.rules.js';

export const DEMO_EMAIL = 'testereasywork@gmail.com';
/** Indian national digits; login sends E.164 +91… */
export const DEMO_PHONE_NATIONAL = '9876543211';
export const DEMO_LOGIN_OTP = '1234';
export const DEMO_DELETE_OTP = '6543';

export const DEMO_PHONE_DISPLAY_NAME = 'cashfree test';

export function isDemoEmail(recipient) {
  return String(recipient || '').toLowerCase().trim() === DEMO_EMAIL;
}

export function isDemoPhone(recipient) {
  return phonesMatch(recipient, DEMO_PHONE_NATIONAL);
}

/**
 * @param {string} recipient
 * @param {'email'|'phone'|string} [contactType]
 */
export function isDemoRecipient(recipient, contactType) {
  if (contactType === 'phone') return isDemoPhone(recipient);
  if (contactType === 'email') return isDemoEmail(recipient);
  return isDemoEmail(recipient) || isDemoPhone(recipient);
}

export function isValidDemoLoginOtp(otp) {
  return String(otp || '').trim() === DEMO_LOGIN_OTP;
}

export function isValidDemoDeleteOtp(otp) {
  return String(otp || '').trim() === DEMO_DELETE_OTP;
}

/** Canonical team_table.PhoneNumber for the Cashfree demo row. */
export function demoPhoneForStorage() {
  return canonicalPhoneForStorage(DEMO_PHONE_NATIONAL);
}
