import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDeleteInput } from '../../../features/weight/weight.validators.js';
import { deleteWeight } from '../../../features/weight/weight.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'DELETE, OPTIONS')) return;
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  return runService(res, () => deleteWeight(validateDeleteInput(req.body)));
}
