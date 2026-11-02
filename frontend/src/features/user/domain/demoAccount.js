/**
 * Frontend mirror of backend/features/auth/domain/demo-account.rules.js
 * Cashfree payment-review phone: no real SMS; login OTP is fixed.
 */

import { normalizePhone, DEFAULT_COUNTRY } from './contactIdentifier.js';

export const DEMO_EMAIL = 'testereasywork@gmail.com';
export const DEMO_PHONE_NATIONAL = '9876543211';
export const DEMO_LOGIN_OTP = '1234';

function nationalDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isDemoEmail(email) {
  return String(email || '').toLowerCase().trim() === DEMO_EMAIL;
}

export function isDemoPhone(phone, countryDial = DEFAULT_COUNTRY.dial) {
  const raw = String(phone || '').trim();
  if (!raw) return false;
  const e164 = raw.startsWith('+') ? raw : normalizePhone(raw, countryDial);
  return nationalDigits(e164) === DEMO_PHONE_NATIONAL
    || nationalDigits(raw) === DEMO_PHONE_NATIONAL;
}
