import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleGetCardData }                       from '../../../features/marathon/api/get-card-data.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => handleGetCardData(req.query));
}
