import crypto from 'crypto';
import fs from 'fs/promises';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { isMileswebStorageEnabled } from '../../../shared/lib/milesweb/config.js';
import { putMileswebObject } from '../../../shared/lib/milesweb/ftpStorage.js';
import { isAllowedUploadKey, mileswebRedirectUrl } from '../../../shared/lib/milesweb/objectKey.js';
import { findByUserId } from '../../user/user.repository.js';
import { PORTFOLIO_FLAG } from '../domain/access.rules.js';
import { validateUserId } from '../validation/access.schema.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_SLOTS = new Set([
  'profile',
  'entrance',
  'interior',
  'nameboard',
  'activity',
  'logo',
  'testimonial',
]);

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

function extensionForMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return 'jpg';
}

function normalizeSlot(raw) {
  const slot = String(raw || 'activity').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!ALLOWED_SLOTS.has(slot)) {
    throw new ValidationError(400, 'Unknown media slot');
  }
  return slot;
}

/**
 * Upload a portfolio image to MilesWeb FTP under wellnessvalley (never wellness-api).
 * @param {{ userId: unknown, slot?: unknown, file: { filepath: string, mimetype?: string, size?: number } }} input
 */
export async function uploadPortfolioMedia({ userId: rawUserId, slot: rawSlot, file }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  if (!isMileswebStorageEnabled()) {
    throw new ValidationError(503, 'FTP image storage is not configured on this server');
  }

  const userId = validateUserId(rawUserId);
  const slot = normalizeSlot(rawSlot);
  const person = await findByUserId(userId, '"UserId", "Role"');
  if (!person) throw new ValidationError(404, 'Account not found');

  if (!file?.filepath) {
    throw new ValidationError(400, 'An image file is required');
  }

  const mime = String(file.mimetype || '').toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    throw new ValidationError(400, 'Use JPG, PNG, or WEBP images only');
  }

  const size = Number(file.size || 0);
  if (size <= 0) throw new ValidationError(400, 'Image file is empty');
  if (size > MAX_IMAGE_BYTES) {
    throw new ValidationError(400, 'Image must be 2 MB or smaller after compress');
  }

  const bytes = await fs.readFile(file.filepath);
  if (!bytes.length) throw new ValidationError(400, 'Image file is empty');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ValidationError(400, 'Image must be 2 MB or smaller after compress');
  }

  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const ext = extensionForMime(mime);
  const key = `coach-portfolio/${userId}/${slot}-${hash}.${ext}`;
  if (!isAllowedUploadKey(key)) {
    throw new ValidationError(500, 'Could not build a valid storage key');
  }

  await putMileswebObject({ key, body: bytes });
  const url = mileswebRedirectUrl(key);

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        key,
        url,
        slot,
        contentType: mime || 'image/jpeg',
        sizeBytes: bytes.length,
      },
    },
  };
}
