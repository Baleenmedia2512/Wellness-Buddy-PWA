/**
 * Digital Portfolio per-site yearly slots (₹399/yr).
 * New app versions use credits; older / missing version keep events-trial gate (§5.1).
 *
 * PORTFOLIO_SITE_SLOTS_MIN = next-release APP_VERSION when this feature ships.
 * Legacy removal: after MIN_REQUIRED >= this min and no supported client needs events-trial for portfolio.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

/** First app version that uses site credits instead of trial/Premium for Digital Portfolio. */
export const PORTFOLIO_SITE_SLOTS_MIN = '3.5.7';

export const PORTFOLIO_SITE_ENTITLEMENT_DAYS = 365;

export const PORTFOLIO_SITE_ORDER_KIND = Object.freeze({
  CREDIT: 'credit',
  RENEW: 'renew',
});

export const PORTFOLIO_SITE_ENTITLEMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
});

/**
 * @param {string|null|undefined} appVersion
 * @returns {boolean}
 */
export function usesPortfolioSiteSlots(appVersion) {
  return isAtLeastVersion(appVersion, PORTFOLIO_SITE_SLOTS_MIN) === true;
}

/**
 * @param {Date|string|number|null|undefined} expiresAt
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isEntitlementActive(expiresAt, nowMs = Date.now()) {
  if (expiresAt == null || expiresAt === '') return false;
  const ms = expiresAt instanceof Date
    ? expiresAt.getTime()
    : Date.parse(String(expiresAt));
  return Number.isFinite(ms) && ms > nowMs;
}

/**
 * @param {Array<{ submissionId?: number|null, expiresAt?: unknown, status?: string }>} rows
 * @param {number} [nowMs]
 * @returns {number}
 */
export function countUnusedCredits(rows, nowMs = Date.now()) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => {
    if (String(row?.status || '').toLowerCase() !== PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID) {
      return false;
    }
    if (row?.submissionId != null && Number(row.submissionId) > 0) return false;
    return isEntitlementActive(row?.expiresAt, nowMs);
  }).length;
}

/**
 * Latest ExpiresAt among paid rows bound to a submission.
 * @param {Array<{ submissionId?: number|null, expiresAt?: unknown, status?: string }>} rows
 * @param {number} submissionId
 * @returns {Date|null}
 */
export function latestExpiryForSubmission(rows, submissionId) {
  const sid = Number(submissionId);
  if (!Number.isFinite(sid) || sid <= 0 || !Array.isArray(rows)) return null;
  let best = null;
  for (const row of rows) {
    if (String(row?.status || '').toLowerCase() !== PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID) {
      continue;
    }
    if (Number(row?.submissionId) !== sid) continue;
    const ms = row?.expiresAt instanceof Date
      ? row.expiresAt.getTime()
      : Date.parse(String(row?.expiresAt || ''));
    if (!Number.isFinite(ms)) continue;
    if (best == null || ms > best.getTime()) best = new Date(ms);
  }
  return best;
}

/**
 * @param {Array<{ submissionId?: number|null, expiresAt?: unknown, status?: string }>} rows
 * @param {number} submissionId
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isSubmissionEntitlementActive(rows, submissionId, nowMs = Date.now()) {
  const latest = latestExpiryForSubmission(rows, submissionId);
  return isEntitlementActive(latest, nowMs);
}

/**
 * Renew / first-pay expiry: max(now, currentExpires) + days.
 * @param {Date|string|number|null|undefined} currentExpiresAt
 * @param {number} nowMs
 * @param {number} [days]
 * @returns {Date}
 */
export function computeExtendedExpiresAt(
  currentExpiresAt,
  nowMs = Date.now(),
  days = PORTFOLIO_SITE_ENTITLEMENT_DAYS,
) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let base = now;
  if (currentExpiresAt != null && currentExpiresAt !== '') {
    const ms = currentExpiresAt instanceof Date
      ? currentExpiresAt.getTime()
      : Date.parse(String(currentExpiresAt));
    if (Number.isFinite(ms) && ms > base) base = ms;
  }
  return new Date(base + days * 24 * 60 * 60 * 1000);
}

/**
 * Public API summary for site credits.
 * @param {{
 *   unusedCredits: number,
 *   sites?: Array<{
 *     submissionId: number,
 *     centerId?: number|null,
 *     expiresAt?: string|null,
 *     active?: boolean,
 *   }>,
 * }} input
 */
export function toSiteCreditsPayload(input) {
  return {
    unusedCredits: Math.max(0, Number(input?.unusedCredits) || 0),
    sites: Array.isArray(input?.sites) ? input.sites : [],
    minVersion: PORTFOLIO_SITE_SLOTS_MIN,
    priceBaseInr: null,
  };
}
