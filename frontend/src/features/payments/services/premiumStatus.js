import { createPremiumStatusStore } from '../domain/premiumStatusStore';
import {
  confirmPendingPremiumOrder,
  fetchPremiumStatus,
  hasPendingPremiumOrder,
} from './premiumApi';

/** One shared Premium answer for the Home header and My Profile. */
export const premiumStatusStore = createPremiumStatusStore({
  loadStatus: async (userId) => {
    await confirmPendingPremiumOrder(userId);
    return fetchPremiumStatus(userId);
  },
  hasPending: hasPendingPremiumOrder,
});
