/**
 * Coach-facing Google Maps Listing request APIs.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import logger from '../../../shared/lib/logger.js';
import { isMileswebStorageEnabled } from '../../../shared/lib/milesweb/config.js';
import { putMileswebObject } from '../../../shared/lib/milesweb/ftpStorage.js';
import { isAllowedUploadKey, mileswebRedirectUrl } from '../../../shared/lib/milesweb/objectKey.js';
import { fetchFullPlaceAddress } from '../../../shared/lib/reverseGeocode.js';
import { findByUserId } from '../../user/user.repository.js';
import {
  findActiveCentersByOwnerIds,
  findCenterById,
} from '../../nutrition-centers/centers.repository.js';
import * as submissionRepo from '../../coach-portfolio/data/submission.repo.js';
import * as requestRepo from '../data/request.repo.js';
import { buildGbpOpsEmail, parseOpsEmailList } from '../domain/opsEmail.rules.js';
import {
  GBP_FLAG,
  GBP_PRIMARY_CATEGORIES,
  GBP_STATUS,
  canCoachEditRequest,
  canCoachSubmitRequest,
  mediaFolderKeyFor,
  toPublicGbpRequest,
  validateGbpRequestForSubmit,
} from '../domain/request.rules.js';
import { validateCenterId, validateRequestId, validateUserId } from '../validation/access.schema.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

function featureDisabled() {
  throw new ValidationError(404, 'Google Maps Listing is not available');
}

function assertFeature() {
  if (!isEnabled(GBP_FLAG)) featureDisabled();
}

async function loadOwnedCenters(userId) {
  const owned = await findActiveCentersByOwnerIds([userId]);
  return Array.isArray(owned) ? owned : [];
}

async function assertOwnsCenter(userId, centerId) {
  const list = await loadOwnedCenters(userId);
  const match = list.find((c) => Number(c?.id) === Number(centerId));
  if (!match) {
    throw new ValidationError(403, 'You can only request a listing for a center you own');
  }
  return match;
}

function extForMime(mime, kind) {
  const m = String(mime || '').toLowerCase();
  if (kind === 'video') {
    if (m === 'video/webm') return 'webm';
    if (m === 'video/quicktime') return 'mov';
    return 'mp4';
  }
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Prefill website from published Digital Portfolio slug when present.
 */
async function resolvePortfolioWebsite(userId, centerId, hostBase) {
  try {
    const row = await submissionRepo.findSubmissionByUserAndCenter(userId, centerId);
    if (row?.isPublished && row?.publicSlug) {
      const base = String(hostBase || process.env.PUBLIC_SITE_BASE_URL || 'https://wellnessvalley.in')
        .trim()
        .replace(/\/$/, '');
      return `${base}/coach/${row.publicSlug}`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function listMine({ userId: rawUserId }) {
  assertFeature();
  const userId = validateUserId(rawUserId);
  const person = await findByUserId(userId, '"UserId", "Role", "UserName", "PhoneNumber"');
  if (!person) throw new ValidationError(404, 'Account not found');

  const centers = await loadOwnedCenters(userId);
  const requests = await requestRepo.listByUserId(userId);
  const byCenter = new Map(requests.map((r) => [Number(r.centerId), r]));

  const websites = centers.map((c) => {
    const centerId = Number(c.id);
    const req = byCenter.get(centerId) || null;
    return {
      centerId,
      centerName: String(c.center_name || '').trim(),
      hasRequest: Boolean(req),
      request: req ? toPublicGbpRequest(req) : null,
    };
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        websites,
        centerCount: centers.length,
        categories: [...GBP_PRIMARY_CATEGORIES],
        phoneHint: String(person.PhoneNumber || '').replace(/\D/g, ''),
      },
    },
  };
}

/**
 * Resolve exact NAP address for an owned center from GPS + Nominatim.
 */
export async function getCenterPlace({ userId: rawUserId, centerId: rawCenterId }) {
  assertFeature();
  const userId = validateUserId(rawUserId);
  const centerId = validateCenterId(rawCenterId);
  const person = await findByUserId(userId, '"UserId", "PhoneNumber"');
  if (!person) throw new ValidationError(404, 'Account not found');

  await assertOwnsCenter(userId, centerId);
  const { data: center } = await findCenterById(centerId);
  if (!center) throw new ValidationError(404, 'Center not found');
  if (Number(center.owner_user_id) !== userId) {
    throw new ValidationError(403, 'You can only request a listing for a center you own');
  }

  const centerName = String(center.center_name || '').trim();
  const ownerPhone = String(center.owner_phone || person.PhoneNumber || '').replace(/\D/g, '');
  const lat = Number(center.latitude);
  const lng = Number(center.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ValidationError(
      400,
      'This center has no GPS pin. Set the center location on the map first, then try again.',
    );
  }

  const place = await fetchFullPlaceAddress(lat, lng);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        centerId,
        centerName,
        phoneHint: ownerPhone,
        businessName: centerName,
        streetAddress: place.streetAddress,
        landmark: place.landmark,
        area: place.area,
        city: place.city,
        state: place.state || 'Tamil Nadu',
        pincode: place.pincode,
        latitude: place.latitude,
        longitude: place.longitude,
        mapsLink: `https://maps.google.com/?q=${lat},${lng}`,
      },
    },
  };
}

export async function saveDraft({
  userId: rawUserId,
  centerId: rawCenterId,
  fields = {},
  siteBaseUrl = '',
}) {
  assertFeature();
  const userId = validateUserId(rawUserId);
  const centerId = validateCenterId(rawCenterId);
  const person = await findByUserId(userId, '"UserId", "PhoneNumber"');
  if (!person) throw new ValidationError(404, 'Account not found');

  const center = await assertOwnsCenter(userId, centerId);
  const existing = await requestRepo.findByUserAndCenter(userId, centerId);
  if (existing && !canCoachEditRequest(existing.status)) {
    throw new ValidationError(409, 'This listing request can no longer be edited');
  }

  const merged = { ...fields };
  if (!String(merged.businessName || '').trim()) {
    merged.businessName = String(center.center_name || '').trim();
  }
  if (!String(merged.phone || '').trim()) {
    merged.phone = String(person.PhoneNumber || '').replace(/\D/g, '');
  }
  if (!String(merged.websiteUrl || '').trim()) {
    merged.websiteUrl = await resolvePortfolioWebsite(userId, centerId, siteBaseUrl);
  }

  const row = await requestRepo.upsertDraft({ userId, centerId, fields: merged });
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicGbpRequest(row) },
  };
}

export async function uploadMedia({
  userId: rawUserId,
  requestId: rawRequestId,
  file,
}) {
  assertFeature();
  if (!isMileswebStorageEnabled()) {
    throw new ValidationError(503, 'FTP media storage is not configured on this server');
  }
  const userId = validateUserId(rawUserId);
  const requestId = validateRequestId(rawRequestId);
  const person = await findByUserId(userId, '"UserId"');
  if (!person) throw new ValidationError(404, 'Account not found');

  const row = await requestRepo.findById(requestId);
  if (!row || Number(row.userId) !== userId) {
    throw new ValidationError(404, 'Request not found');
  }
  if (!canCoachEditRequest(row.status)) {
    throw new ValidationError(409, 'Media can only be uploaded while the request is editable');
  }
  await assertOwnsCenter(userId, row.centerId);

  if (!file?.filepath) throw new ValidationError(400, 'A media file is required');
  const mime = String(file.mimetype || '').toLowerCase();
  const isVideo = VIDEO_MIME.has(mime) || String(file.originalFilename || '').match(/\.(mp4|mov|webm|m4v)$/i);
  const isImage = IMAGE_MIME.has(mime) || String(file.originalFilename || '').match(/\.(jpe?g|png|webp)$/i);
  if (!isVideo && !isImage) {
    throw new ValidationError(400, 'Use JPG, PNG, WEBP images or MP4/MOV/WebM video');
  }
  const kind = isVideo ? 'video' : 'photo';
  const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const size = Number(file.size || 0);
  if (size <= 0) throw new ValidationError(400, 'Media file is empty');
  if (size > maxBytes) {
    throw new ValidationError(
      400,
      kind === 'video' ? 'Video must be 80 MB or smaller' : 'Image must be 2 MB or smaller',
    );
  }

  const bytes = await fs.readFile(file.filepath);
  if (!bytes.length) throw new ValidationError(400, 'Media file is empty');
  if (bytes.length > maxBytes) {
    throw new ValidationError(
      400,
      kind === 'video' ? 'Video must be 80 MB or smaller' : 'Image must be 2 MB or smaller',
    );
  }

  const folder = row.mediaFolderKey || mediaFolderKeyFor({ userId, requestId });
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const ext = extForMime(mime, kind);
  const key = `${folder}/${kind}-${hash}.${ext}`;
  if (!isAllowedUploadKey(key)) {
    throw new ValidationError(500, 'Could not build a valid storage key');
  }
  await putMileswebObject({ key, body: bytes });
  const url = mileswebRedirectUrl(key);
  const updated = await requestRepo.appendMediaFile({
    requestId,
    userId,
    fileMeta: {
      key,
      url,
      mime: mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      bytes: bytes.length,
      originalName: String(file.originalFilename || ''),
      kind,
    },
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        file: {
          key,
          url,
          kind,
          bytes: bytes.length,
        },
        request: toPublicGbpRequest(updated),
      },
    },
  };
}

export async function submitRequest({ userId: rawUserId, requestId: rawRequestId }) {
  assertFeature();
  const userId = validateUserId(rawUserId);
  const requestId = validateRequestId(rawRequestId);
  const person = await findByUserId(userId, '"UserId", "UserName"');
  if (!person) throw new ValidationError(404, 'Account not found');

  const row = await requestRepo.findById(requestId);
  if (!row || Number(row.userId) !== userId) {
    throw new ValidationError(404, 'Request not found');
  }
  if (!canCoachSubmitRequest(row.status)) {
    throw new ValidationError(409, 'This request cannot be submitted in its current status');
  }
  await assertOwnsCenter(userId, row.centerId);

  const errors = validateGbpRequestForSubmit({
    ...row,
    centerId: row.centerId,
    mediaFiles: row.mediaFiles,
  });
  if (errors.length) {
    throw new ValidationError(400, errors.join('; '));
  }

  const submitted = await requestRepo.markSubmitted({ requestId, userId });
  const pub = toPublicGbpRequest(submitted);
  pub.userName = person.UserName || pub.userName;

  const recipients = parseOpsEmailList(process.env.GBP_LISTING_OPS_EMAIL);
  if (recipients.length) {
    const mail = buildGbpOpsEmail(pub);
    try {
      await sendTransactionalMail({
        to: recipients.join(', '),
        subject: mail.subject,
        text: mail.text,
      });
    } catch (err) {
      logger.warn('[gbp-listing] ops email failed', { message: err?.message || String(err) });
    }
  } else {
    logger.warn('[gbp-listing] GBP_LISTING_OPS_EMAIL not set; skip ops email');
  }

  return {
    httpStatus: 200,
    body: { ok: true, data: pub },
  };
}
