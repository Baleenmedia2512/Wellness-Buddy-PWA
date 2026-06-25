/**
 * @deprecated Import from `shared/services/userIdentity` instead.
 * This file is now a thin re-export proxy pointing at the canonical
 * implementation in `shared/services/userContextService.js`.
 */
export {
  getUserContext,
  clearContextCache,
  getCachedContext,
  formatContextForAI,
  subscribeToContextUpdates,
} from '../../../shared/services/userContextService.js';

const __MOVED_TO_SHARED__ = true;
void __MOVED_TO_SHARED__;
