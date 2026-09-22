/**
 * avatar-storage.service.js — upload custom profile photos to R2 and save the key.
 * Bytes are JPEG-compressed to ≤22 KB / 256 px before PUT.
 * Non-fatal: callers keep writing team_table.ProfileImage (legacy Base64 / Google URL).
 */
import crypto from 'crypto';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import {
  parseDataUri,
  shouldStoreProfileImageInR2,
} from '../../shared/lib/images/dataUri.js';
import { compressAvatarJpeg } from '../../shared/lib/images/avatarJpeg.js';
import {
  isR2Configured,
  putObject,
  deleteObject,
  listObjectKeys,
  publicObjectUrl,
  avatarRedirectUrl,
} from '../../shared/lib/r2/s3.js';
import { buildAvatarObjectKey, isKeyInFolder, orphanedAvatarKeys, R2_FOLDERS } from '../../shared/lib/r2/objectKeys.js';
import logger from '../../shared/lib/logger.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import * as repo from './user.repository.js';

export function r2AvatarsEnabled() {
  return isEnabled('ff.r2-avatars') && isR2Configured();
}

export function avatarUrlForKey(key) {
  if (!key) return null;
  return publicObjectUrl(key) || avatarRedirectUrl(key);
}

/**
 * @param {string|number} userId
 * @param {string} profileImage data URI
 * @returns {Promise<string|null>} object key
 */
export async function uploadAvatarDataUri(userId, profileImage) {
  if (!r2AvatarsEnabled()) return null;
  if (!shouldStoreProfileImageInR2(profileImage)) return null;
  const parsed = parseDataUri(profileImage);
  if (!parsed) return null;

  const compressed = await compressAvatarJpeg(parsed.bytes);
  const hash = crypto.createHash('sha256').update(compressed.bytes).digest('hex').slice(0, 16);
  const key = buildAvatarObjectKey(userId, hash, 'jpg');
  if (!isKeyInFolder(key, R2_FOLDERS.avatar)) {
    throw new Error('Avatar key must stay under avatars/');
  }

  await putObject({
    key,
    body: compressed.bytes,
    contentType: compressed.contentType,
  });
  return key;
}

/**
 * Upload (if needed) and persist ProfileImageKey. Never throws to the caller.
 * @returns {Promise<string|null>}
 */
export async function persistAvatarKey(userId, profileImage) {
  try {
    if (!shouldStoreProfileImageInR2(profileImage)) return null;

    let previousKey = null;
    try {
      previousKey = (await repo.getAvatarSource(userId))?.ProfileImageKey || null;
    } catch {
      previousKey = null;
    }

    const key = await uploadAvatarDataUri(userId, profileImage);
    if (!key) return null;
    await repo.updateUserById(userId, { ProfileImageKey: key, ProfileImage: null });
    try {
      cache.delete(cacheKeys.userAvatar(userId));
    } catch { /* non-fatal */ }

    if (
      previousKey
      && previousKey !== key
      && isKeyInFolder(previousKey, R2_FOLDERS.avatar)
    ) {
      try {
        await deleteObject({ key: previousKey });
      } catch (err) {
        logger.warn('[avatar-storage] old object delete skipped', {
          userId,
          previousKey,
          message: err?.message || String(err),
        });
      }
    }
    return key;
  } catch (err) {
    logger.warn('[avatar-storage] persist skipped', {
      userId,
      message: err?.message || String(err),
    });
    return null;
  }
}

async function loadLiveAvatarKeys() {
  const keys = new Set();
  const pageSize = 200;
  let from = 0;
  while (true) {
    const rows = await repo.listProfileImageKeysPage({ from, to: from + pageSize - 1 });
    for (const row of rows) {
      const key = row?.ProfileImageKey;
      if (typeof key === 'string' && key) keys.add(key);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return keys;
}

/**
 * Delete leftover avatars/ objects that are not the current ProfileImageKey.
 * Dry-run when write is false. Aborts if the DB returns no live keys.
 *
 * @param {{ write?: boolean, fetchImpl?: typeof fetch }} [opts]
 */
export async function cleanupOrphanAvatars({ write = false, fetchImpl = globalThis.fetch } = {}) {
  if (!r2AvatarsEnabled()) {
    throw new Error('R2 is not configured or ff.r2-avatars is OFF');
  }

  const liveKeys = await loadLiveAvatarKeys();
  if (liveKeys.size === 0) {
    logger.warn('[avatar-storage] orphan cleanup aborted — no live ProfileImageKey rows');
    return { aborted: true, live: 0, listed: 0, orphans: [], deleted: 0 };
  }

  const listed = await listObjectKeys({
    prefix: `${R2_FOLDERS.avatar}/`,
    fetchImpl,
  });
  const orphans = orphanedAvatarKeys(listed, liveKeys);
  let deleted = 0;
  if (write) {
    for (const key of orphans) {
      await deleteObject({ key, fetchImpl });
      deleted += 1;
    }
  }

  return {
    aborted: false,
    live: liveKeys.size,
    listed: listed.length,
    orphans,
    deleted: write ? deleted : 0,
  };
}
