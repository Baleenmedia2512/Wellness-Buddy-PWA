/**
 * Pure phone helpers for Call / WhatsApp actions.
 * Legacy team rows often store 10-digit Indian numbers without a country code.
 */

const PLACEHOLDER = /^(n\/?a|—|-)$/i;

/**
 * @param {unknown} phone
 * @returns {string}
 */
export function digitsOnlyPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * True when the value looks like a real handset number (not empty / N/A).
 * @param {unknown} phone
 * @returns {boolean}
 */
export function isCallablePhone(phone) {
  const label = String(phone || '').trim();
  if (!label || PLACEHOLDER.test(label)) return false;
  const digits = digitsOnlyPhone(phone);
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Digits with country code for WhatsApp / wa.me (no '+').
 * 10-digit values are treated as Indian national numbers.
 * @param {unknown} phone
 * @returns {string}
 */
export function whatsAppPhoneDigits(phone) {
  const digits = digitsOnlyPhone(phone);
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * @param {unknown} phone
 * @returns {string} tel: href, or '' when not callable
 */
export function telHref(phone) {
  if (!isCallablePhone(phone)) return '';
  const raw = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (raw.startsWith('+')) return `tel:${raw}`;
  const digits = digitsOnlyPhone(phone);
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `tel:+91${digits.slice(1)}`;
  return `tel:+${digits}`;
}

/**
 * @param {unknown} phone
 * @returns {string} https://wa.me/<digits>, or '' when not callable
 */
export function whatsAppHref(phone) {
  if (!isCallablePhone(phone)) return '';
  const digits = whatsAppPhoneDigits(phone);
  return digits ? `https://wa.me/${digits}` : '';
}
