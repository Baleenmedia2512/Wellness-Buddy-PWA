import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUndoDelete } from '../../../features/education/education.validators.js';
import { undoDelete } from '../../../features/education/education.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => undoDelete(validateUndoDelete(req.body)));
}
