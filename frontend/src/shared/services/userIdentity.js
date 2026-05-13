/**
 * @file userIdentity — canonical entry point for user-identity
 * helpers (`getUserId`, `clearUserIdCache`, user-context resolution).
 *
 * Implementation lives in sibling modules under `shared/services/`.
 * Features must import from this path rather than reaching into
 * `features/user/...`, which would create cross-slice coupling.
 *
 * Named exports only.
 */

export { getUserId, clearUserIdCache } from './getUserId.js';

export {
  getUserContext,
  clearContextCache,
  getCachedContext,
  formatContextForAI,
  subscribeToContextUpdates,
} from './userContextService.js';
