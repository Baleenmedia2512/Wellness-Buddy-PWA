/**
 * PATCH /api/body-parameters-card/update
 * Updates an existing body-parameters card by id.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleUpdateCard } from '../../../features/body-parameters-card/api/update.handler.js';

export default function handler(req, res) {
  if (applyCors(req, res, 'PATCH, OPTIONS')) return;
  if (req.method !== 'PATCH') return methodNotAllowed(res);
  return runService(res, () => handleUpdateCard(req.body));
}
