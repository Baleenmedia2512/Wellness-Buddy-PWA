import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveUsage, validateGetUsage } from '../../../features/token/token.validators.js';
import { saveUsage, getUsage } from '../../../features/token/token.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, () => saveUsage(validateSaveUsage(req.body)));
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => getUsage(validateGetUsage(req.query)));
  }
  return methodNotAllowed(res);
}
