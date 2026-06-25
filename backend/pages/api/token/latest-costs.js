import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateLatestCosts } from '../../../features/token/token.validators.js';
import { getLatestCosts } from '../../../features/token/token.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return runService(res, () => getLatestCosts(validateLatestCosts(req.query)));
}
