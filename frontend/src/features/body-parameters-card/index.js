/**
 * Body Parameters Card Feature - Public API
 * Exports public functions for use by other parts of the app
 */

// Components
export { default as BodyParamsForm } from './components/BodyParamsForm';
export { default as BodyParamsShareSheet } from './components/BodyParamsShareSheet';
export { default as BodyParamsSearchBar } from './components/BodyParamsSearchBar';

// API services
export {
  fetchPublicCard,
  listBodyParamsCards,
  getBodyParamsCard,
  deleteBodyParamsCard,
} from './services/bodyParamsCardApi';

// Domain logic
export { buildOnboardingShareUrl } from './domain/platform-store.rules';
export { preloadBodyParamsShareAssets } from './domain/preload-share-assets';
export { buildBpcSearchSuggestions } from './domain/searchSuggestions';
