import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetIntake } from '../../../features/water/validation/intake.schema.js';
import { getIntake } from '../../../features/water/api/intake.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getIntake(validateGetIntake(req.query)));
}
