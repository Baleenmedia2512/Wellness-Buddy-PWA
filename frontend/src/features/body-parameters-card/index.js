/**
 * body-parameters-card — Feature barrel export.
 * Public API for the body-parameters-card slice per VSA (claude.md §2).
 */

// API services
export {
  createBodyParamsCard,
  updateBodyParamsCard,
  fetchPublicCard,
  saveCardToProfile,
} from './services/bodyParamsCardApi.js';

// Domain logic
export {
  savePendingCard,
  consumePendingCard,
  peekPendingCard,
} from './domain/pendingBodyParamsCard.js';

export {
  preloadBodyParamsShareAssets,
} from './domain/preload-share-assets.js';

// Components
export { default as BodyParamsCardPreview } from './components/BodyParamsCardPreview.jsx';
export { default as BodyParamsForm } from './components/BodyParamsForm.jsx';
export { default as BodyParamsShareSheet } from './components/BodyParamsShareSheet.jsx';
