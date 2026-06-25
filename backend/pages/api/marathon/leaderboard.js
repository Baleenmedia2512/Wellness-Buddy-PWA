import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleGetLeaderboard }                    from '../../../features/marathon/api/leaderboard.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => handleGetLeaderboard(req.query));
}
