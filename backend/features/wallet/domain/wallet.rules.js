/**
 * Wallet cash-in rules. Pure — no I/O.
 *
 * One unique wallet per user. Cash is credited only after the requester
 * enters the OTP that was emailed to a Wellness Valley person's profile email.
 */

export const WALLET_FLAG = 'ff.wallet';
/** Kept for older call sites; wallet OTP does not time-expire. */
export const WALLET_OTP_MINUTES = 30;
/** Sentinel stored in OtpExpiresAt — time-based expiry is disabled. */
export const WALLET_OTP_NO_EXPIRY_AT = '2099-12-31 23:59:59';
export const WALLET_OTP_MAX_ATTEMPTS = 5;
export const WALLET_OTP_LOCKED_CODE = 'WALLET_OTP_LOCKED';
export const WALLET_OTP_LOCKED_MESSAGE = '5 attempts used. Send a new request.';
export const WALLET_OTP_BCRYPT_COST = 12;
export const WALLET_OTP_LENGTH = 4;
export const WALLET_OTP_REGEX = /^\d{4}$/;
export const WALLET_MIN_AMOUNT = 1;
export const WALLET_MAX_AMOUNT = 100000;
export const WALLET_SEARCH_MIN_CHARS = 2;

export const REQUEST_STATUS_PENDING = 'pending';
export const REQUEST_STATUS_APPROVED = 'approved';
export const REQUEST_STATUS_CANCELLED = 'cancelled';
export const REQUEST_STATUS_EXPIRED = 'expired';

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function toPositiveUserId(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Wellness Valley profile email — must already be stored on the person.
 * @param {unknown} email
 * @returns {string|null}
 */
export function wellnessValleyEmail(email) {
  const value = String(email || '').trim();
  if (!value.includes('@') || !value.includes('.')) return null;
  if (/\s/.test(value)) return null;
  return value;
}

/**
 * @param {unknown} raw
 * @returns {number|null} rupees with two decimals
 */
export function parseWalletAmount(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n < WALLET_MIN_AMOUNT || n > WALLET_MAX_AMOUNT) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < WALLET_MIN_AMOUNT || rounded > WALLET_MAX_AMOUNT) return null;
  return rounded;
}

/**
 * Display-only: whole rupees in Indian grouping (no decimals).
 * Does not change stored/API numeric amounts.
 * @param {unknown} amount
 * @returns {string}
 */
export function formatWalletAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * @param {unknown} otp
 * @returns {boolean}
 */
export function isValidWalletOtp(otp) {
  return WALLET_OTP_REGEX.test(String(otp ?? '').trim());
}

/**
 * Wallet OTP does not expire by clock time.
 * Pending stays until Cancel, successful verify, or max failed attempts.
 * @param {unknown} [_expiresAt]
 * @param {Date} [_now]
 * @returns {boolean}
 */
export function isWalletOtpExpired(_expiresAt, _now = new Date()) {
  return false;
}

/**
 * @param {unknown} attempts
 * @param {number} [max]
 * @returns {boolean}
 */
export function walletOtpLockedBody() {
  return {
    ok: false,
    error: {
      code: WALLET_OTP_LOCKED_CODE,
      message: WALLET_OTP_LOCKED_MESSAGE,
    },
  };
}

export function canAttemptWalletOtp(attempts, max = WALLET_OTP_MAX_ATTEMPTS) {
  const n = Number(attempts);
  if (!Number.isFinite(n) || n < 0) return false;
  return n < max;
}

/**
 * @param {Date|string|number} [now]
 * @param {number} [minutes]
 * @returns {Date}
 */
export function walletOtpExpiresAt(now = new Date(), minutes = WALLET_OTP_MINUTES) {
  const base = now instanceof Date ? now : new Date(now);
  return new Date(base.getTime() + minutes * 60 * 1000);
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizePeopleSearchQuery(raw) {
  return String(raw || '')
    .trim()
    .replace(/[,%()_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One wallet identity per user — never a shared or derived id.
 * @param {number} userId
 * @returns {{ userId: number }}
 */
export function uniqueWalletIdentity(userId) {
  const id = toPositiveUserId(userId);
  if (!id) return null;
  return { userId: id };
}

/**
 * Public pending request — never includes the OTP hash.
 * @param {object|null} row
 * @param {{ approverName?: string|null, approverEmail?: string|null }} extras
 */
export function toPublicCashRequest(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.Id),
    amount: Number(row.Amount),
    amountLabel: formatWalletAmount(row.Amount),
    approverId: Number(row.ApproverId),
    approverName: extras.approverName || null,
    approverEmail: extras.approverEmail || null,
    status: String(row.Status || ''),
    expiresAt: row.OtpExpiresAt || null,
    requestedAt: row.RequestedAt || null,
    emailSent: Boolean(row.OtpSentAt),
  };
}
