// Public surface of the duplicate-detection module.
import { checkForDuplicateFood } from './duplicateFood';
import { checkForDuplicateWeight } from './duplicateWeight';
import { getMealCategory, getMealCategoryName } from './mealCategory';
import { extractFoodNames } from './foodNameExtractor';

export { checkForDuplicateFood, checkForDuplicateWeight };
export { getMealCategory, getMealCategoryName, extractFoodNames };

export const duplicateDetectionService = {
  checkForDuplicateFood,
  checkForDuplicateWeight,
  getMealCategory,
  getMealCategoryName,
  extractFoodNames,
};
