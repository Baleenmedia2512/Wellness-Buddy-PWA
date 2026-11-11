/**
 * Coach Website portfolio access — paid gate (Phase 1: admin mark; later Cashfree).
 */

export const PORTFOLIO_FLAG = 'ff.coach-portfolio';

export const PORTFOLIO_STATUS = Object.freeze({
  NOT_PAID: 'not_paid',
  PAID: 'paid',
});

export const PORTFOLIO_SOURCE = Object.freeze({
  ADMIN: 'admin',
  CASHFREE: 'cashfree',
});

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
export function isPortfolioPaid(status) {
  return String(status || '').trim().toLowerCase() === PORTFOLIO_STATUS.PAID;
}

/**
 * @param {boolean} paid
 * @returns {'paid'|'not_paid'}
 */
export function statusFromPaidFlag(paid) {
  return paid ? PORTFOLIO_STATUS.PAID : PORTFOLIO_STATUS.NOT_PAID;
}

/**
 * Public payload for status APIs.
 * @param {{ userId: number, status?: string|null, source?: string|null, markedAt?: string|Date|null, userName?: string|null }} row
 */
export function toPublicAccess(row) {
  const status = isPortfolioPaid(row?.status)
    ? PORTFOLIO_STATUS.PAID
    : PORTFOLIO_STATUS.NOT_PAID;
  return {
    userId: Number(row.userId),
    paid: status === PORTFOLIO_STATUS.PAID,
    status,
    source: row?.source ? String(row.source) : null,
    markedAt: row?.markedAt ? String(row.markedAt) : null,
    userName: row?.userName != null ? String(row.userName) : null,
  };
}
