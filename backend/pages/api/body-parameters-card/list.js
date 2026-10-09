/**
 * GET /api/body-parameters-card/list
 * Lists all body parameter cards for a coach's team
 */
import { handleListCards } from '../../../features/body-parameters-card/api/list.handler.js';
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';

export default async function handler(req, res) {
  // Prevent Vercel edge CDN and all intermediate caches from storing this
  // response. The list is user-specific and changes immediately after every
  // card save, so any CDN caching causes the mobile app to see stale data.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Must allow X-App-Version* + Cache-Control — otherwise browser blocks preflight (CORS).
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  return handleListCards(req, res);
}
