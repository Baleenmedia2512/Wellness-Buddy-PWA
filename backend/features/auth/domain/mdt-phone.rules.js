/**
 * Pure helpers for My Dreams Technology (MDT) SMS API phone formatting.
 * E.164 in app storage → digits-only string for the MDT `number` parameter.
 */

export function formatMdtDialNumber(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  return digits;
}

export const MDT_OTP_EXPIRY_MINUTES = 30;

export const MDT_APP_NAME = 'Wellness Valley';
