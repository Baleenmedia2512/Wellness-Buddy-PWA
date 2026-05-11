import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateCheckName } from '../../../features/nutrition-centers/centers.validators.js';
import { checkName } from '../../../features/nutrition-centers/centers.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return runService(res, () => checkName(validateCheckName(req.query)));
}
