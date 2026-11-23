/**
 * Shared JPEG PUT for R2 / MilesWeb.
 * Default compress = diary/activity ≤22 KB (avatarJpeg).
 * Profile / transformation pass a clearer `compress` fn.
 */
import crypto from 'crypto';
import { parseStoredImage, shouldStoreFoodImageInR2 } from '../images/dataUri.js';
import { compressAvatarJpeg } from '../images/avatarJpeg.js';
import { isR2Configured } from './config.js';
import { putObject } from './s3.js';
import { isKeyInFolder } from './objectKeys.js';
import { isMileswebStorageEnabled } from '../milesweb/config.js';

/**
 * @param {{
 *   imageBase64: string,
 *   folder: string,
 *   buildKey: (hash: string) => string,
 *   compress?: (input: Buffer) => Promise<{ bytes: Buffer, contentType: string }>,
 * }} opts
 */
export async function uploadStoredImageToR2({
  imageBase64,
  folder,
  buildKey,
  compress = compressAvatarJpeg,
}) {
  if (!isR2Configured() && !isMileswebStorageEnabled()) return null;
  if (!shouldStoreFoodImageInR2(imageBase64)) return null;
  const parsed = parseStoredImage(imageBase64);
  if (!parsed) return null;

  const compressFn = typeof compress === 'function' ? compress : compressAvatarJpeg;
  const compressed = await compressFn(parsed.bytes);
  const hash = crypto.createHash('sha256').update(compressed.bytes).digest('hex').slice(0, 16);
  const key = buildKey(hash);
  if (!isKeyInFolder(key, folder)) {
    throw new Error(`R2 key must stay under ${folder}/`);
  }
  await putObject({
    key,
    body: compressed.bytes,
    contentType: compressed.contentType,
  });
  return key;
}
