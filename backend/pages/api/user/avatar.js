/**
 * GET /api/user/avatar?userId=
 *
 * Serves a single profile photo for leaderboard/list UIs without embedding
 * multi-MB base64 blobs in JSON list endpoints.
 *
 * - data:image/* → binary response with Cache-Control
 * - https://… → 302 redirect to the remote URL
 * - missing / invalid → 404 (frontend falls back to letter avatar)
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { cache } from '../../../utils/cache.js';

const AVATAR_CACHE_TTL_MS = 5 * 60 * 1000;
const NONE = Object.freeze({ kind: 'none' });

function parseDataUri(value) {
  const match = String(value).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  try {
    return {
      kind: 'bytes',
      contentType: match[1],
      bytes: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  const userId = req.query.userId;
  if (userId == null || userId === '' || String(userId).length > 32) {
    return res.status(400).end();
  }

  const cacheKey = `user:avatar:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached?.kind === 'none') {
    return res.status(404).end();
  }
  if (cached?.kind === 'redirect') {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.redirect(302, cached.url);
  }
  if (cached?.kind === 'bytes') {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).send(cached.bytes);
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('team_table')
      .select('ProfileImage')
      .eq('UserId', userId)
      .maybeSingle();

    if (error || !data?.ProfileImage) {
      cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
      return res.status(404).end();
    }

    const img = data.ProfileImage;
    if (typeof img === 'string' && img.startsWith('https://')) {
      cache.set(cacheKey, { kind: 'redirect', url: img }, AVATAR_CACHE_TTL_MS);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.redirect(302, img);
    }

    if (typeof img === 'string' && img.startsWith('data:image/')) {
      const parsed = parseDataUri(img);
      if (!parsed || !parsed.bytes.length) {
        cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
        return res.status(404).end();
      }
      cache.set(cacheKey, parsed, AVATAR_CACHE_TTL_MS);
      res.setHeader('Content-Type', parsed.contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).send(parsed.bytes);
    }

    cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
    return res.status(404).end();
  } catch (err) {
    console.error('[avatar] Error:', err?.message || err);
    return res.status(500).end();
  }
}
