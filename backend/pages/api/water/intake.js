import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetIntake } from '../../../features/water/water.validators.js';
import { getIntake } from '../../../features/water/water.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getIntake(validateGetIntake(req.query)));
}
