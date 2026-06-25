import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUndoInput } from '../../../features/weight/weight.validators.js';
import { undoDeleteWeight } from '../../../features/weight/weight.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => undoDeleteWeight(validateUndoInput(req.body)));
}
