/**
 * One confirmed access snapshot per member.
 * Premium fields stay compatible with the existing membership cache.
 * Trial and feature flags are added beside them. A failed check does not write.
 */
import { normalizePremiumMembershipStatus } from './premiumStatusStore.js';

/** Premium with no server expiry is shown for at most one day, then refreshed. */
export const UNBOUND_PREMIUM_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function blankEntitlement() {
  return {
    premium: false,
    daysLeft: null,
    expiresAt: null,
    expiresAtDisplay: null,
    showExpiryWarning: false,
    access: 'none',
    trialDaysLeft: null,
    trialExpiresAtDisplay: null,
    canSeeReportDetails: false,
    canUseHostTools: false,
    reportLoaded: false,
    confirmedAt: null,
  };
}

/**
 * End of the server expiry date in India time, as UTC milliseconds.
 * @param {unknown} expiresAtYmd
 * @returns {number|null}
 */
export function premiumExpiryMs(expiresAtYmd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(expiresAtYmd || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;
  const check = new Date(utc + IST_OFFSET_MS);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

/**
 * Read a stored row. Older rows have only the Premium fields.
 * @param {unknown} raw
 */
export function snapshotFromStored(raw) {
  const premium = normalizePremiumMembershipStatus(raw);
  const stored = raw && typeof raw === 'object' ? raw : {};
  const legacy = stored.reportLoaded == null && stored.access == null;
  if (legacy) {
    return {
      ...premium,
      access: premium.premium ? 'premium' : 'none',
      trialDaysLeft: null,
      trialExpiresAtDisplay: null,
      canSeeReportDetails: premium.premium === true,
      canUseHostTools: premium.premium === true,
      reportLoaded: premium.premium === true,
      confirmedAt: Number.isFinite(Number(stored.confirmedAt)) ? Number(stored.confirmedAt) : null,
    };
  }
  const access = typeof stored.access === 'string' ? stored.access : (premium.premium ? 'premium' : 'none');
  const open = access === 'premium' || access === 'trial';
  return {
    ...premium,
    access: premium.premium ? 'premium' : access,
    trialDaysLeft: Number.isFinite(Number(stored.trialDaysLeft)) ? Number(stored.trialDaysLeft) : null,
    trialExpiresAtDisplay: typeof stored.trialExpiresAtDisplay === 'string' && stored.trialExpiresAtDisplay.trim()
      ? stored.trialExpiresAtDisplay.trim()
      : null,
    canSeeReportDetails: premium.premium ? true : (stored.canSeeReportDetails === true || open),
    canUseHostTools: premium.premium ? true : (stored.canUseHostTools === true || open),
    reportLoaded: stored.reportLoaded === true || premium.premium === true,
    confirmedAt: Number.isFinite(Number(stored.confirmedAt)) ? Number(stored.confirmedAt) : null,
  };
}

/**
 * Display copy. Does not change the stored row.
 * A passed server expiry, or a Premium row with no expiry older than a day,
 * stops counting as Premium until the server confirms it again.
 * @param {object|null|undefined} snapshot
 * @param {number} nowMs
 */
export function applyEntitlementFreshness(snapshot, nowMs) {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : blankEntitlement();
  if (snap.premium !== true) return snap;
  const now = Number(nowMs);
  if (!Number.isFinite(now)) return snap;
  const expiry = premiumExpiryMs(snap.expiresAt);
  const confirmedAt = Number.isFinite(Number(snap.confirmedAt)) ? Number(snap.confirmedAt) : null;
  const expired = expiry != null
    ? now > expiry
    : (confirmedAt == null || now - confirmedAt > UNBOUND_PREMIUM_MS);
  if (!expired) return snap;
  const trialOpen = snap.access === 'trial';
  return {
    ...snap,
    premium: false,
    showExpiryWarning: false,
    access: trialOpen ? 'trial' : 'ended',
    canSeeReportDetails: trialOpen,
    canUseHostTools: trialOpen,
    stale: true,
  };
}

function applyReport(snapshot, report) {
  const access = typeof report?.access === 'string' ? report.access : 'none';
  if (snapshot.premium && access !== 'premium') {
    return {
      ...snapshot,
      access: 'premium',
      canSeeReportDetails: true,
      canUseHostTools: true,
      reportLoaded: true,
    };
  }
  const open = access === 'premium' || access === 'trial';
  const daysLeft = Number.isFinite(Number(report?.daysLeft)) ? Number(report.daysLeft) : null;
  const expiresAtDisplay = typeof report?.expiresAtDisplay === 'string' && report.expiresAtDisplay.trim()
    ? report.expiresAtDisplay.trim()
    : null;
  return {
    ...snapshot,
    access,
    trialDaysLeft: access === 'trial' || access === 'ended' ? daysLeft : null,
    trialExpiresAtDisplay: access === 'trial'
      ? (expiresAtDisplay || snapshot.trialExpiresAtDisplay)
      : null,
    canSeeReportDetails: open,
    canUseHostTools: open,
    reportLoaded: true,
    ...(access === 'premium' ? { premium: true } : {}),
  };
}

/**
 * @param {object|null|undefined} previous
 * @param {unknown} answer null, a legacy membership value, or an entitlement packet
 * @returns {{ status: object, write: boolean }}
 */
export function reduceEntitlement(previous, answer) {
  const prev = snapshotFromStored(previous);
  if (answer == null) return { status: prev, write: false };

  if (answer && answer.entitlementPacket === true) {
    if (answer.premiumConfirmed !== true && answer.reportConfirmed !== true) {
      return { status: prev, write: false };
    }
    let next = { ...prev };
    if (answer.premiumConfirmed === true) {
      const status = normalizePremiumMembershipStatus(answer.premium);
      next = { ...next, ...status };
      if (status.premium) {
        next.access = 'premium';
        next.canSeeReportDetails = true;
        next.canUseHostTools = true;
        next.trialDaysLeft = null;
        next.trialExpiresAtDisplay = null;
        next.reportLoaded = true;
      } else if (prev.access === 'premium' && answer.reportConfirmed !== true) {
        next.access = 'none';
        next.canSeeReportDetails = false;
        next.canUseHostTools = false;
        next.reportLoaded = false;
      }
    }
    if (answer.reportConfirmed === true && answer.report) {
      next = applyReport(next, answer.report);
    }
    return { status: next, write: true };
  }

  const status = normalizePremiumMembershipStatus(answer);
  return {
    status: {
      ...prev,
      ...status,
      reportLoaded: true,
      ...(status.premium
        ? {
          access: 'premium',
          canSeeReportDetails: true,
          canUseHostTools: true,
          trialDaysLeft: null,
          trialExpiresAtDisplay: null,
        }
        : {}),
    },
    write: true,
  };
}
