import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUserId, validateSaveCorrection } from '../../../features/food-corrections/food-corrections.validators.js';
import { listCorrections, saveCorrection } from '../../../features/food-corrections/food-corrections.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => listCorrections(validateUserId(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => saveCorrection(validateSaveCorrection(req.body)));
  }
  return methodNotAllowed(res);
}
