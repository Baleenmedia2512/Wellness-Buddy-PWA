import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleListMarathons }                     from '../../../features/marathon/api/list-marathons.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => handleListMarathons(req.query));
}
