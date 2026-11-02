import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSuggestionsQuery, getDrySaladSuggestions } from '../../../features/dry-salad/index.js';

/**
 * GET /api/dry-salad/suggestions?userId=&slot=
 * Additive: usual combo for the current (or requested) time slot.
 * Missing/unknown slot → derived from now in the owner's timezone.
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getDrySaladSuggestions(validateSuggestionsQuery(req.query)));
}
