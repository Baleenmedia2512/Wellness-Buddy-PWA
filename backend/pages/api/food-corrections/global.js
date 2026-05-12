import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGlobal } from '../../../features/food-corrections/food-corrections.validators.js';
import { getGlobalCorrections } from '../../../features/food-corrections/food-corrections.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  return runService(res, () => getGlobalCorrections(validateGlobal(req.query)));
}
