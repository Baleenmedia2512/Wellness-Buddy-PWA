import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSearch, searchDrySalad } from '../../../features/dry-salad/index.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => searchDrySalad(validateSearch(req.query)));
}
