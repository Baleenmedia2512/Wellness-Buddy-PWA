/**
 * backend/features/dry-salad/validation/search.schema.js
 */
export function validateSearch(query = {}) {
  const searchTerm = String(query.query || query.searchTerm || '').trim();
  const userId = query.userId != null ? String(query.userId) : null;
  return { searchTerm, userId };
}
