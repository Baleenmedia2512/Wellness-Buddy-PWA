import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleCreateMarathon }                    from '../../../features/marathon/api/create-marathon.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => handleCreateMarathon(req.body));
}
