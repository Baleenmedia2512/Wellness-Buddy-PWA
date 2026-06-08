// Public surface of the `nutrition` feature slice.
export { default as NutritionCard } from './components/NutritionCard';
export { default as HomeNutritionCarousel } from './components/HomeNutritionCarousel';
export { default as FoodImageShareCard } from './components/FoodImageShareCard';
export { default as NutritionDashboard } from './components/NutritionDashboard';
export { default as SmartFoodSearchModal } from './components/SmartFoodSearchModal';
export { default as ManualFoodEntryModal } from './components/ManualFoodEntryModal';
export { default as DuplicateFoodModal } from './components/DuplicateFoodModal';
export { default as EditableFoodItem } from './components/EditableFoodItem';
export { default as FoodDetailModal } from './components/FoodDetailModal';
export { default as NutritionSummaryCards } from './components/dashboard/NutritionSummaryCards';
export { default as NutritionFilters } from './components/dashboard/NutritionFilters';
export { useUserCalorieTarget, useBurnedCalories, useResolveUserId, useDayAnalyses, useCalorieTrend, useCalorieChartData } from './hooks';
export * from './services/foodCorrectionService';
export * from './services/foodCorrection';
export * from './services/duplicateDetectionService';
export * from './services/backgroundNutritionService';
export * from './services/nutritionSaveService';
export * from './services/nutritionFallback';
export { aggregateFoodTotals, FOOD_TOTAL_FIELDS } from './domain/aggregateFoodTotals';

