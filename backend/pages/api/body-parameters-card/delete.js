/**
 * DELETE /api/body-parameters-card/delete
 * Soft-deletes a body-parameters card owned by the coach.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleDeleteCard } from '../../../features/body-parameters-card/api/delete.handler.js';

export default function handler(req, res) {
  if (applyCors(req, res, 'DELETE, OPTIONS')) return;
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  return runService(res, () => handleDeleteCard(req.body));
}
