import { createPremiumStatusStore } from '../domain/premiumStatusStore';
import {
  confirmPendingPremiumOrder,
  fetchPremiumStatus,
  hasPendingPremiumOrder,
} from './premiumApi';
import { markPremiumSuccessPending } from './premiumSuccess';

/** One shared Premium answer for the Home header and My Profile. */
export const premiumStatusStore = createPremiumStatusStore({
  loadStatus: async (userId) => {
    const justPaid = await confirmPendingPremiumOrder(userId);
    if (justPaid) {
      markPremiumSuccessPending(userId);
      const membership = await fetchPremiumStatus(userId);
      if (membership) return membership;
      return {
        premium: true,
        daysLeft: null,
        expiresAt: null,
        expiresAtDisplay: null,
        showExpiryWarning: false,
      };
    }
    return fetchPremiumStatus(userId);
  },
  hasPending: hasPendingPremiumOrder,
});
