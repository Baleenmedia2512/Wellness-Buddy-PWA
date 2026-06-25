import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateHistoryInput } from '../../../features/screen/screen.validators.js';
import { getScreenTimeHistory } from '../../../features/screen/screen.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getScreenTimeHistory(validateHistoryInput(req.query)));
}
