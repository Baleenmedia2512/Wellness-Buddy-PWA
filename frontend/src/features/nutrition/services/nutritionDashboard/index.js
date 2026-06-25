// Public surface of the nutrition-dashboard service module.
export { resolveDashboardUserId, isDemoAccount } from './userResolver';
export { fetchDayAnalyses } from './dayAnalysesApi';
export { updateMealNutrition, deleteMealById, undoMealDelete } from './mealMutationsApi';
export { fetchCalorieTrend } from './calorieTrendApi';
export { fetchWatchBurnedCalories } from './burnedCaloriesApi';
export { fetchUserBmr, DEFAULT_CALORIE_TARGET } from './userBmrApi';
export { fetchUserLatestWeight } from './userProfileApi';
export {
  istToLocalDate,
  getMealCategory,
  toLocalDateString,
  parseAnalysisData,
  recalculateTotals,
} from './analysisHelpers';
export { transformDbItemToEditable } from './foodItemTransform';
export { persistMealItems } from './persistMealItems';
export {
  isMobileDevice,
  isSmallChartDevice,
  generateHorizontalCalendarDates,
  generateScrollableDates,
} from './dateHelpers';
export { getFoodSignature, resolveFoodItemIndex } from './foodItemMatching';
