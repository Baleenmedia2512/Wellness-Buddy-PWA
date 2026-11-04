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

/** Duration of Balance count-up after the success popup (ms). */
export const WALLET_BALANCE_COUNT_MS = 1000;

/**
 * Ease Balance from → to for the post-credit count-up. Pure.
 * @param {unknown} from
 * @param {unknown} to
 * @param {number} progress 0..1
 * @returns {number}
 */
export function interpolateWalletBalance(from, to, progress) {
  const a = Number(from);
  const b = Number(to);
  const start = Number.isFinite(a) ? a : 0;
  const end = Number.isFinite(b) ? b : 0;
  const t = Math.min(1, Math.max(0, Number(progress) || 0));
  // ease-out cubic — fast start, soft settle on final Balance
  const eased = 1 - (1 - t) ** 3;
  return Math.round((start + (end - start) * eased) * 100) / 100;
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

/**
 * One clear line for Wallet recharge (easy for anyone).
 * Pure — does not change request/OTP behaviour.
 * @param {{ pending?: object|null, otpLocked?: boolean, amount?: string|number, selected?: object|null }} input
 * @returns {{ step: number, total: number, title: string, hint: string, phase: string }}
 */
export function resolveWalletRechargeGuide({
  pending = null,
  otpLocked = false,
  amount = '',
  selected = null,
} = {}) {
  if (pending && otpLocked) {
    return {
      step: 0,
      total: 4,
      phase: 'locked',
      title: 'Tap Send a new request',
      hint: '',
    };
  }
  if (pending) {
    return {
      step: 4,
      total: 4,
      phase: 'otp',
      title: 'Type the OTP, then tap Add',
      hint: '',
    };
  }
  if (parseWalletAmount(amount) == null) {
    return {
      step: 1,
      total: 4,
      phase: 'amount',
      title: 'Type amount, then tap Next',
      hint: '',
    };
  }
  if (!selected) {
    return {
      step: 2,
      total: 4,
      phase: 'person',
      title: 'Search who you will pay, then tap them',
      hint: '',
    };
  }
  return {
    step: 3,
    total: 4,
    phase: 'send',
    title: 'Tap Send OTP',
    hint: '',
  };
}
