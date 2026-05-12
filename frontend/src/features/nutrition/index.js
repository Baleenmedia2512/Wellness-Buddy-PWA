// Public surface of the `nutrition` feature slice.
export { default as NutritionCard } from './shared/components/NutritionCard';
export { default as NutritionDashboard } from './shared/components/NutritionDashboard';
export { default as SmartFoodSearchModal } from './shared/components/SmartFoodSearchModal';
export { default as ManualFoodEntryModal } from './shared/components/ManualFoodEntryModal';
export { default as DuplicateFoodModal } from './shared/components/DuplicateFoodModal';
export { default as EditableFoodItem } from './shared/components/EditableFoodItem';
export * from './shared/services/foodCorrectionService';
export * from './shared/services/duplicateDetectionService';
export * from './shared/services/backgroundNutritionService';
export * from './shared/services/nutritionSaveService';
export * from './shared/services/nutritionFallback';
