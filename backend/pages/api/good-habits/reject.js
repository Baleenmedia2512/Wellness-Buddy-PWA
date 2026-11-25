/**
 * Public coach Reject link for Task by Coach (token from email — no login).
 * GET  → confirm page
 * POST → soft-delete habit → wellness score for that IST day drops
 */
import { applyCors } from '../../../shared/lib/handler.js';
import { handleGoodHabitRejectRequest } from '../../../features/good-habits/api/coach-reject.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  try {
    const result = await handleGoodHabitRejectRequest(req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.httpStatus || 200).send(result.html || '');
  } catch (err) {
    console.error('[good-habits/reject]', err?.message || err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(
      '<!DOCTYPE html><html><body><p>Something went wrong. Try again later.</p></body></html>',
    );
  }
}
