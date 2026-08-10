/**
 * backend/features/nutrition-knowledge/index.js
 * Public API for the nutrition knowledge base (ADR-0005).
 */
export {
  resolveProfile,
  searchMaster,
  listMasterSearchItems,
  recordAiFoodCandidate,
  approveMasterProfile,
} from './api/resolve.handler.js';

export { enrichFoodText } from './api/enrich.handler.js';

export {
  NUTRITION_KEYS,
  normalizeFoodName,
  foodNameMatchesQuery,
  foodNameMatchIndex,
  sortByFoodNameMatch,
  editDistance,
  pickNutrition,
  scaleNutrition,
  profileToSearchItem,
  mergeSearchResults,
  shouldAutoPromote,
} from './domain/nutrition.rules.js';

export {
  validateResolve,
  validateSearch,
  validateApprove,
  validateEnrich,
} from './validation/resolve.schema.js';
