import { ValidationError } from '../../shared/lib/ValidationError.js';
import { DEFAULT_SUGGESTION_LIMIT } from './domain/foodPairs.rules.js';

export function validateSuggestionsQuery(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  const limitRaw = query.limit != null ? Number(query.limit) : DEFAULT_SUGGESTION_LIMIT;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(20, Math.max(1, Math.floor(limitRaw)))
    : DEFAULT_SUGGESTION_LIMIT;
  const exclude = String(query.exclude || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    userId: query.userId,
    anchor: String(query.anchor || '').trim(),
    limit,
    exclude,
  };
}
