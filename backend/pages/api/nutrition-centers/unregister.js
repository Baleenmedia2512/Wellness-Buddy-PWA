import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUnregister } from '../../../features/nutrition-centers/centers.validators.js';
import { unregister } from '../../../features/nutrition-centers/centers.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => unregister(validateUnregister(req.body)));
}
