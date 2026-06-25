/**
 * /api/captures/undo — restore a soft-deleted capture (undo delete).
 *
 * HTTP Method: POST
 * Auth: Required (user must own the capture)
 * Rate limit: Standard (60 req/min)
 *
 * Body:
 *   { captureId: string|number, userId: string|number }
 *
 * Response:
 *   200: { ok: true, data: { restored: boolean } }
 *   400: { ok: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
 *   500: { ok: false, error: { code: 'INTERNAL_ERROR', message: '...' } }
 *
 * Architecture: Thin handler per claude.md §3.2.
 * Delegates to captures.service → captures.repository.
 */

import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler';
import { undoDeleteById } from '../../../features/captures/captures.service';
import { validateDeleteInput } from '../../../features/captures/validation/captures.validators';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, () => {
    const validated = validateDeleteInput(req.body);
    return undoDeleteById(validated);
  });
}
