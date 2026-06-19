import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleDeleteMarathon }                    from '../../../features/marathon/api/delete-marathon.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => handleDeleteMarathon(req.body));
}
