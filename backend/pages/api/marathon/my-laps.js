import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleGetMyLaps }                         from '../../../features/marathon/api/my-laps.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => handleGetMyLaps(req.query));
}
