// Public surface of the food-correction module.
export {
  saveFoodCorrection,
  getUserCorrections,
  reverseLookupOriginalAiName,
} from './correctionApi';

export {
  getGlobalCorrectionsMap,
  clearGlobalCorrectionsCache,
} from './correctionMap';

export {
  applyGlobalAutoCorrections,
  applyUserCorrections,
} from './applyCorrections';
