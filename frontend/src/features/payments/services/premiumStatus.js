import { createPremiumStatusStore } from '../domain/premiumStatusStore';
import {
  confirmPendingPremiumOrder,
  fetchPremiumStatus,
  hasPendingPremiumOrder,
} from './premiumApi';
import { fetchReportAccess } from '../../reports/services/reportAccessApi';
import { markPremiumSuccessPending } from './premiumSuccess';
import { addAppStateListener } from '../../../shared/services/nativeLifecycle/index.js';

const MEMBERSHIP_KEY = 'wv.premiumMembership.v1';

function membershipStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readMembershipMap() {
  try {
    const raw = membershipStorage()?.getItem(MEMBERSHIP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const OPTIMISTIC_PREMIUM = {
  premium: true,
  daysLeft: null,
  expiresAt: null,
  expiresAtDisplay: null,
  showExpiryWarning: false,
};

/** One shared Premium and trial answer for every screen. */
export const premiumStatusStore = createPremiumStatusStore({
  recall(userId) {
    const row = readMembershipMap()[String(userId)];
    return row && typeof row === 'object' ? row : null;
  },
  remember(userId, status) {
    const box = membershipStorage();
    if (!box) return;
    const all = readMembershipMap();
    all[String(userId)] = status;
    box.setItem(MEMBERSHIP_KEY, JSON.stringify(all));
  },
  loadStatus: async (userId) => {
    const justPaid = await confirmPendingPremiumOrder(userId);
    if (justPaid) markPremiumSuccessPending(userId);
    const [premium, report] = await Promise.all([
      fetchPremiumStatus(userId),
      fetchReportAccess(userId),
    ]);
    const premiumConfirmed = premium?.confirmed === true || (justPaid && premium?.confirmed !== true);
    return {
      entitlementPacket: true,
      premiumConfirmed,
      premium: premium?.confirmed === true
        ? premium.status
        : (justPaid ? OPTIMISTIC_PREMIUM : null),
      reportConfirmed: report != null,
      report,
    };
  },
  hasPending: hasPendingPremiumOrder,
});

const watchCounts = new Map();
let foregroundAttached = false;

function refreshWatchedUsers() {
  watchCounts.forEach((_count, userId) => {
    premiumStatusStore.load(userId, { force: true });
  });
}

function attachForegroundRefresh() {
  if (foregroundAttached || typeof document === 'undefined') return;
  foregroundAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshWatchedUsers();
  });
  addAppStateListener((state) => {
    if (state?.isActive) refreshWatchedUsers();
  }).catch(() => {});
}

/** Refresh this member when the app returns. Several screens share one listener. */
export function watchEntitlementUser(userId) {
  const key = String(userId || '').trim();
  if (!key) return () => {};
  attachForegroundRefresh();
  watchCounts.set(key, (watchCounts.get(key) || 0) + 1);
  return () => {
    const next = (watchCounts.get(key) || 1) - 1;
    if (next <= 0) watchCounts.delete(key);
    else watchCounts.set(key, next);
  };
}

/** Drop the blue theme without deleting the saved membership of any member. */
export function clearPremiumThemeClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('premium-theme');
}
