import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveCorrection, validateGetCorrection } from '../../../features/token/token.validators.js';
import { saveCorrection, getCorrection } from '../../../features/token/token.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, () => saveCorrection(validateSaveCorrection(req.body)));
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => getCorrection(validateGetCorrection(req.query)));
  }
  return methodNotAllowed(res);
}
