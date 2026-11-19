import crypto from 'crypto';
import fs from 'fs/promises';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { isMileswebStorageEnabled } from '../../../shared/lib/milesweb/config.js';
import { putMileswebObject } from '../../../shared/lib/milesweb/ftpStorage.js';
import { mileswebRedirectUrl } from '../../../shared/lib/milesweb/objectKey.js';
import { findByUserId } from '../../user/user.repository.js';
import { PORTFOLIO_FLAG } from '../domain/access.rules.js';
import { validateUserId } from '../validation/access.schema.js';

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

function extensionForMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  return 'mp4';
}

/**
 * Upload an intro video to MilesWeb FTP for a paid coach.
 * @param {{ userId: unknown, file: { filepath: string, mimetype?: string, size?: number, originalFilename?: string } }} input
 */
export async function uploadIntroVideo({ userId: rawUserId, file }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  if (!isMileswebStorageEnabled()) {
    throw new ValidationError(503, 'FTP video storage is not configured on this server');
  }

  const userId = validateUserId(rawUserId);
  const person = await findByUserId(userId, '"UserId", "Role"');
  if (!person) throw new ValidationError(404, 'Account not found');

  if (!file?.filepath) {
    throw new ValidationError(400, 'A video file is required');
  }

  const mime = String(file.mimetype || '').toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    throw new ValidationError(400, 'Use MP4, WebM, or MOV video only');
  }

  const size = Number(file.size || 0);
  if (size <= 0) throw new ValidationError(400, 'Video file is empty');
  if (size > MAX_VIDEO_BYTES) {
    throw new ValidationError(400, 'Intro video must be 80 MB or smaller');
  }

  const bytes = await fs.readFile(file.filepath);
  if (!bytes.length) throw new ValidationError(400, 'Video file is empty');
  if (bytes.length > MAX_VIDEO_BYTES) {
    throw new ValidationError(400, 'Intro video must be 80 MB or smaller');
  }

  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const ext = extensionForMime(mime);
  const key = `coach-portfolio/${userId}/intro-${hash}.${ext}`;

  await putMileswebObject({ key, body: bytes });
  const url = mileswebRedirectUrl(key);

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        key,
        url,
        contentType: mime || 'video/mp4',
        sizeBytes: bytes.length,
      },
    },
  };
}
