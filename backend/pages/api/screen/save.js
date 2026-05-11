import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveInput } from '../../../features/screen/screen.validators.js';
import { saveScreenTime } from '../../../features/screen/screen.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => saveScreenTime(validateSaveInput(req.body)));
}
