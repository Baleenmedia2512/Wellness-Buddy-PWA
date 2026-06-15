/**
 * Pure helpers for My Dreams Technology (MDT) SMS API phone formatting.
 * E.164 in app storage → MDT `number` parameter (PDF uses 10-digit Indian mobiles).
 */

export function formatMdtDialNumber(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  // MDT docs sample: number=9876543210 (no 91 prefix).
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/** Last 4 digits only — safe for server logs. */
export function maskPhoneForLog(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}

export function mdtApiKeyHint(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return 'missing';
  if (key.length <= 4) return '****';
  return `***${key.slice(-4)}`;
}

export const MDT_OTP_EXPIRY_MINUTES = 10;
