import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleFinalizeDay }                       from '../../../features/marathon/api/finalize-day.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => handleFinalizeDay(req.body));
}
