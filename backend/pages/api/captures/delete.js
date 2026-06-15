/**
 * backend/pages/api/captures/delete.js
 * ---------------------------------------------------------------------------
 * DELETE /api/captures/delete
 * Soft-delete a capture (sets IsDeleted=1). Only the owner may delete.
 * 
 * Request body:
 *   { captureId: string|number, userId: string|number }
 * 
 * Response:
 *   200 { ok: true, data: { deleted: true } }
 *   200 { ok: true, data: { deleted: false } } if already deleted/not found
 *   400 { ok: false, error: { message: "..." } } for validation errors
 * ---------------------------------------------------------------------------
 */

import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDeleteInput } from '../../../features/captures/validation/captures.validators.js';
import { deleteById } from '../../../features/captures/captures.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'DELETE, OPTIONS')) return;
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  return runService(res, () => deleteById(validateDeleteInput(req.body)));
}
