export const WALLET_FLAG = 'ff.wallet';
export const WALLET_OTP_LOCKED_CODE = 'WALLET_OTP_LOCKED';
export const WALLET_OTP_LOCKED_MESSAGE = '5 attempts used. Send a new request.';
export const WALLET_OTP_LENGTH = 4;
export const WALLET_OTP_REGEX = /^\d{4}$/;
export const WALLET_SEARCH_MIN_CHARS = 2;
export const WALLET_MIN_AMOUNT = 1;
export const WALLET_MAX_AMOUNT = 100000;

export function parseWalletAmount(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n < WALLET_MIN_AMOUNT || n > WALLET_MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

export function formatWalletAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * Shown after OTP credit succeeds. Pure copy — no I/O.
 * @param {unknown} amount
 * @returns {string|null}
 */
export function buildCashAddedMessage(amount) {
  const n = parseWalletAmount(amount);
  if (n == null) return null;
  return `Successfully added ₹${formatWalletAmount(n)}`;
}

export function isWalletOtpLockedError(err) {
  if (err?.code === WALLET_OTP_LOCKED_CODE) return true;
  return /5 attempts used|Maximum attempts exceeded/i.test(String(err?.message || ''));
}

export function isValidWalletOtp(otp) {
  return WALLET_OTP_REGEX.test(String(otp ?? '').trim());
}

export function extractWalletOtp(raw) {
  const text = String(raw ?? '');
  if (!text.trim()) return null;
  const exactRun = text.match(/(?:^|\D)(\d{4})(?:\D|$)/);
  if (exactRun?.[1]) return exactRun[1];
  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length >= WALLET_OTP_LENGTH) return digitsOnly.slice(0, WALLET_OTP_LENGTH);
  return null;
}
