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

/** Env vars required for DLT-compliant phone OTP via MDT/Baleen. */
export function getMdtSmsConfigGaps() {
  const gaps = [];
  if (!String(process.env.MDT_SMS_API_KEY || '').trim()) gaps.push('MDT_SMS_API_KEY');
  if (!String(process.env.MDT_SMS_SENDER_ID || '').trim()) gaps.push('MDT_SMS_SENDER_ID');
  if (!String(process.env.MDT_SMS_TEMPLATE_ID || '').trim()) gaps.push('MDT_SMS_TEMPLATE_ID');
  return gaps;
}

export function mdtSenderIdHint(senderId = process.env.MDT_SMS_SENDER_ID) {
  const raw = String(senderId || '').trim();
  if (!raw) return 'missing';
  if (raw.length >= 4) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return 'set-but-short';
}

export function mdtTemplateIdHint(templateId = process.env.MDT_SMS_TEMPLATE_ID) {
  const raw = String(templateId || '').trim();
  if (!raw) return 'not-set';
  return `***${raw.slice(-4)}`;
}

export const MDT_OTP_EXPIRY_MINUTES = 10;
