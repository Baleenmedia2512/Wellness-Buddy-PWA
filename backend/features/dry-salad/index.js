/**
 * Public API — Dry Salad catalog (Manual Log search) + slot combos.
 */
export { searchDrySalad } from './api/search.handler.js';
export { validateSearch } from './validation/search.schema.js';
export { getDrySaladSuggestions } from './api/suggestions.handler.js';
export { validateSuggestionsQuery } from './validation/suggestions.schema.js';
export { listApprovedCatalogNameKeys } from './api/catalog-keys.handler.js';
