/**
 * POST /api/body-parameters-card/create
 * Creates a new body-parameters card and returns the share token.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleCreateCard } from '../../../features/body-parameters-card/api/create.handler.js';

export default function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => handleCreateCard(req.body));
}
