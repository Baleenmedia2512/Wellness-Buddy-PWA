/**
 * GET /api/user/avatar?userId=
 *
 * Serves a single profile photo for leaderboard/list UIs without embedding
 * multi-MB base64 blobs in JSON list endpoints.
 *
 * Preference order matches My Profile display (see profileDisplayAvatar.rules.js):
 *   1. R2 object (ProfileImageKey) → 302 to public or signed URL
 *   2. https://… ProfileImage (Google) → 302 redirect
 *   3. Centre transformation photo (transformation_photos.front)
 *   4. data:image/* ProfileImage still in DB → upload to R2 when configured, else binary
 *   5. missing / invalid → 404 (frontend falls back to letter avatar)
 *
 * Optional `inline=1` streams bytes instead of 302 so the profile cropper can
 * read the photo same-origin (R2/Google CORS does not apply). Default remains
 * 302 — not a breaking change for existing <img src> clients.
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { cache, cacheKeys } from '../../../utils/cache.js';
import { parseDataUri } from '../../../shared/lib/images/dataUri.js';
import { avatarRedirectUrl } from '../../../shared/lib/r2/s3.js';
import { persistAvatarKey, r2AvatarsEnabled } from '../../../features/user/avatar-storage.service.js';
import { r2TransformationPhotosEnabled } from '../../../features/user/transformation-photo-storage.service.js';
import { resolveProfileDisplayAvatar } from '../../../features/user/domain/profileDisplayAvatar.rules.js';
import { wantsInlineAvatar } from '../../../features/user/domain/avatarInline.rules.js';
import { getAvatarSource } from '../../../features/user/user.repository.js';
import logger from '../../../shared/lib/logger.js';

const AVATAR_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_INLINE_AVATAR_BYTES = 5 * 1024 * 1024;
const NONE = Object.freeze({ kind: 'none' });

function sendRedirect(res, url, cacheTag) {
  // Redirect URL is stable (userId) while Location target changes on upload —
  // avoid long-lived browser cache of the 302 after a photo change.
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader('X-Cache', cacheTag);
  return res.redirect(302, url);
}

function sendBytes(res, parsed, cacheTag) {
  res.setHeader('Content-Type', parsed.contentType);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader('X-Cache', cacheTag);
  return res.status(200).send(parsed.bytes);
}

async function sendBytesFromUrl(res, url, cacheTag) {
  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return res.status(404).end();
    const contentType = String(imgRes.headers.get('content-type') || 'image/jpeg')
      .split(';')[0]
      .trim() || 'image/jpeg';
    if (!contentType.startsWith('image/')) return res.status(404).end();
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (!buf.length || buf.length > MAX_INLINE_AVATAR_BYTES) return res.status(404).end();
    return sendBytes(res, { contentType, bytes: buf }, cacheTag);
  } catch (err) {
    logger.warn('[avatar] inline fetch failed', { message: err?.message || String(err) });
    return res.status(404).end();
  }
}

function sendAvatar(res, url, cacheTag, inline) {
  if (inline) return sendBytesFromUrl(res, url, cacheTag);
  return sendRedirect(res, url, cacheTag);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  const userId = req.query.userId;
  if (userId == null || userId === '' || String(userId).length > 32) {
    return res.status(400).end();
  }

  const inline = wantsInlineAvatar(req.query);
  const cacheKey = cacheKeys.userAvatar(userId);
  const cached = cache.get(cacheKey);
  if (cached?.kind === 'none') {
    return res.status(404).end();
  }
  if (cached?.kind === 'redirect') {
    return sendAvatar(res, cached.url, 'HIT', inline);
  }
  if (cached?.kind === 'bytes') {
    return sendBytes(res, cached, 'HIT');
  }

  try {
    const data = await getAvatarSource(userId);
    if (!data) {
      cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
      return res.status(404).end();
    }

    const resolved = resolveProfileDisplayAvatar({
      profileImageKey: data.ProfileImageKey,
      profileImage: data.ProfileImage,
      transformationPhotos: data.transformation_photos,
      r2Enabled: r2AvatarsEnabled() || r2TransformationPhotosEnabled(),
      resolveR2Url: avatarRedirectUrl,
    });

    if (resolved.kind === 'redirect') {
      cache.set(cacheKey, { kind: 'redirect', url: resolved.url }, AVATAR_CACHE_TTL_MS);
      return sendAvatar(res, resolved.url, 'MISS', inline);
    }

    if (resolved.kind === 'dataUri') {
      if (resolved.persistAsProfileAvatar && r2AvatarsEnabled()) {
        const key = await persistAvatarKey(userId, resolved.value);
        if (key) {
          const url = avatarRedirectUrl(key);
          if (url) {
            cache.set(cacheKey, { kind: 'redirect', url }, AVATAR_CACHE_TTL_MS);
            return sendAvatar(res, url, 'MISS', inline);
          }
        }
      }
      const parsed = parseDataUri(resolved.value);
      if (!parsed || !parsed.bytes.length) {
        cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
        return res.status(404).end();
      }
      cache.set(cacheKey, { kind: 'bytes', ...parsed }, AVATAR_CACHE_TTL_MS);
      return sendBytes(res, parsed, 'MISS');
    }

    cache.set(cacheKey, NONE, AVATAR_CACHE_TTL_MS);
    return res.status(404).end();
  } catch (err) {
    logger.error('[avatar] Error', { message: err?.message || String(err) });
    return res.status(500).end();
  }
}
