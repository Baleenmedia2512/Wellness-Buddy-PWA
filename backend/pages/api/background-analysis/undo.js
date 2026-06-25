import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUndo } from '../../../features/background-analysis/analysis.validators.js';
import { undoDelete } from '../../../features/background-analysis/analysis.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => undoDelete(validateUndo(req.body)));
}
