/**
 * GET /api/body-parameters-card/list
 * Lists all body parameter cards for a coach's team
 */
import { handleListCards } from '../../../features/body-parameters-card/api/list.handler.js';

export default async function handler(req, res) {
  // Prevent Vercel edge CDN and all intermediate caches from storing this
  // response. The list is user-specific and changes immediately after every
  // card save, so any CDN caching causes the mobile app to see stale data.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed' } });
  }

  return handleListCards(req, res);
}
