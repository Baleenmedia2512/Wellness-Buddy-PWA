import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetCenters, validateRegister, validateUpdate } from '../../../features/nutrition-centers/centers.validators.js';
import { listCenters, register, updateCenter } from '../../../features/nutrition-centers/centers.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, PATCH, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => listCenters(validateGetCenters(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => register(validateRegister(req.body)));
  }
  if (req.method === 'PATCH') {
    return runService(res, () => updateCenter(validateUpdate(req.body)));
  }
  return methodNotAllowed(res);
}
