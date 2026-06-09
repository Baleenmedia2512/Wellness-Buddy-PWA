/**
 * GET  /api/body-parameters-card/public/[token]  — view card
 * POST /api/body-parameters-card/public/[token]  — save card to profile
 *
 * GET is unauthenticated (token is the capability).
 * POST requires requestingUserId in the body.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import {
  handleGetPublicCard,
  handleSaveCardToProfile,
} from '../../../../features/body-parameters-card/api/public.handler.js';

export default function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  const { token } = req.query;

  if (req.method === 'GET') {
    return runService(res, () => handleGetPublicCard(token));
  }

  if (req.method === 'POST') {
    const { requestingUserId } = req.body || {};
    return runService(res, () => handleSaveCardToProfile(token, requestingUserId));
  }

  return methodNotAllowed(res);
}
