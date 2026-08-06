// Public surface of the `diary` feature slice (PR-C / ADR-0003).
//
// External consumers (currently only `shell/components/Dashboard.js`)
// MUST import via this barrel. Reaching into `./components/rows/*`
// from outside the slice is a dependency-cruiser violation.
export { default as DiaryFeed } from './components/DiaryFeed';
export { DIARY_UNDO_SECONDS } from './components/DiaryUndoRow';

// Hook is exported so tests + a future embedded "today's diary" widget
// can subscribe without going through the full DiaryFeed shell.
export { useDiary } from './hooks/useDiary';

// Activity display + WhatsApp share builders (ADR-0003 diary subtypes).
export {
  DIARY_FOOD_ACTIVITY,
  resolveFoodActivityType,
  shouldShowMealBadge,
  extractVolumeMl,
  extractScoops,
  extractShakeServings,
  extractShakeProducts,
  sumAfreshScoopsFromDayAnalyses,
} from './domain/activityType';
export { formatWaterVolume } from './domain/formatVolume';
export { resolveFoodRowPresentation } from './domain/foodRowDisplay';
export {
  buildDiaryShareText,
  buildFoodShareText,
  buildWaterShareText,
  buildAfreshShareText,
  buildShakeShareText,
  buildEducationShareText,
  buildWeightShareText,
  buildDiaryShareSuffix,
  resolveWeightDeltaDisplay,
} from './domain/share';
