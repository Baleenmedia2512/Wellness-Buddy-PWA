/**
 * POST /api/coach-portfolio/public-rating
 * Anonymous visitor star rating (1–5, no comments) for a published coach page.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { submitPublicPortfolioRating } from '../../../features/coach-portfolio/api/public-rating.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => submitPublicPortfolioRating(req));
}
