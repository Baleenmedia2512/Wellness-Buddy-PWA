/**
 * Public exports for food-suggestions (frequency-v1).
 */
export {
  recordMealFoodPairs,
  getFoodSuggestions,
  PROVIDER_ID,
} from './food-suggestions.service.js';

export {
  normalizeFoodNameKey,
  enumerateUndirectedPairs,
  extractFoodNamesFromAnalysis,
  mergeOftenWithPersonalFirst,
  partnersFromPairRows,
  MIN_GLOBAL_PAIR_COUNT,
  PERSONAL_SUFFICIENT_COUNT,
  PERSONAL_OFTEN_WITH_MIN,
} from './domain/foodPairs.rules.js';
