// Public surface of the food-correction module.
export {
  saveFoodCorrection,
  getUserCorrections,
  reverseLookupOriginalAiName,
  searchFoods,
  toFoodSearchItem,
} from './correctionApi';

export {
  getGlobalCorrectionsMap,
  clearGlobalCorrectionsCache,
} from './correctionMap';

export {
  applyGlobalAutoCorrections,
  applyUserCorrections,
} from './applyCorrections';
