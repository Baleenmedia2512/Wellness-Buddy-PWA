/**
 * GET /api/body-parameters-card/list
 * Lists all body parameter cards for a coach's team
 */
import { handleListCards } from '../../../features/body-parameters-card/api/list.handler.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed' } });
  }
  return handleListCards(req, res);
}
