/**
 * Shared ≤22 KB JPEG PUT for activity photos (weight / education / good-habit / food).
 */
import crypto from 'crypto';
import { parseStoredImage, shouldStoreFoodImageInR2 } from '../images/dataUri.js';
import { compressAvatarJpeg } from '../images/avatarJpeg.js';
import { isR2Configured } from './config.js';
import { putObject } from './s3.js';
import { isKeyInFolder } from './objectKeys.js';

export async function uploadStoredImageToR2({ imageBase64, folder, buildKey }) {
  if (!isR2Configured()) return null;
  if (!shouldStoreFoodImageInR2(imageBase64)) return null;
  const parsed = parseStoredImage(imageBase64);
  if (!parsed) return null;

  const compressed = await compressAvatarJpeg(parsed.bytes);
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
