/**
 * testimonials.service.js â€” Business logic for the testimonials feature.
 * Orchestrates validation â†’ permissions â†’ data â†’ side-effects (email).
 * Zero HTTP concerns.
 */
import bcrypt from 'bcryptjs';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import * as repo from './testimonials.repository.js';
import {
  hasCompletePhotoTestimonial,
  hasRealBeforePhoto,
  hasVisibleAfterCard,
  isPhotoPairComplete,
  resolveHealthIssueOtpChannel,
  shouldHydratePhotosFromProfile,
  shouldSendPhotoApprovalOtp,
} from './domain/photoCompleteness.rules.js';
import {
  resolveOtpRecipientIds,
  toPositiveUserId,
} from './domain/otpRecipient.rules.js';
import {
  hydrateTestimonialPhotosFromProfile,
  syncTestimonialPathsToProfileSafe,
} from './profilePhotoSync.service.js';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import {
  validateSubmitTestimonial,
  validateVerifyOtp,
  validateEditTestimonial,
  validateListForCoach,
  validateMyTestimonial,
  validateTestimonialDetail,
  validatePrepareVideoUpload,
  validateSubmitVideo,
  validateUploadVideoChunk,
  validateVerifyVideoOtp,
  validateVideoReport,
  validateTeamReport,
  validateSubmitAllEdits,
  validateVerifyUnifiedOtp,
  validateResendUnifiedOtp,
  validateUpdateMemberHealthIssues,
  MAX_HEALTH_VIDEO_BYTES,
  MAX_BUSINESS_VIDEO_BYTES,
} from './testimonials.validators.js';
import {
  mapTestimonialsListLeanFields,
  filterTestimonialsListBySearch,
  filterTestimonialsListByHealthIssue,
  filterTestimonialsListByUpload,
  paginateTestimonialsList,
  countTestimonialsUploadLevels,
} from './domain/testimonials-list.pagination.js';
import { isInlineImageReference } from './domain/profileTransformationPhotos.seed.js';
import {
  bufferFromOptionalBase64,
  composeTransformationShareCardJpeg,
} from './domain/composeTransformationShareCard.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  buildTestimonialCoachEmailHtml,
  buildTestimonialCoachEmailText,
  buildTestimonialCoachEmailSubject,
  buildVideoCoachEmailHtml,
  buildVideoCoachEmailText,
  buildVideoCoachEmailSubject,
  buildUnifiedSubmitEmailHtml,
  buildUnifiedSubmitEmailText,
  buildUnifiedSubmitEmailSubject,
} from './testimonialCoachEmail.template.js';

// â”€â”€â”€ OTP helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** How long a coach verification OTP remains valid (product copy + expiry). */
export const TESTIMONIAL_OTP_VALIDITY_HOURS = 24;

function generateOtp() {
  return generateEmailOtp();
}

/**
 * Resolve who receives Transformation OTP email.
 * Coach/sponsor first; if none (top-level admin), fall back to co-coach partner.
 *
 * @param {number} userId
 * @returns {Promise<{
 *   userName: string|null,
 *   coachId: number|null,
 *   coachInfo: { email: string|null, name: string|null }|null,
 *   source: 'coach'|'co-coach'|null,
 * }|null>}
 */
async function resolveVerificationRecipient(userId) {
  const userInfo = await repo.findCoachIdForUser(userId);
  if (!userInfo) return null;

  let coCoachPartnerId = null;
  if (!toPositiveUserId(userInfo.coachId)) {
    coCoachPartnerId = await repo.findCoCoachPartnerId(userId);
  }

  const { recipientId, source } = resolveOtpRecipientIds({
    memberCoachId: userInfo.coachId,
    coCoachPartnerId,
  });

  if (!recipientId) {
    return {
      userName: userInfo.userName ?? null,
      coachId: null,
      coachInfo: null,
      source: null,
    };
  }

  const coachInfo = await repo.findCoachEmail(recipientId);
  if (source === 'co-coach') {
    logger.info('[testimonials] OTP recipient fallback to co-coach', {
      userId,
      recipientId,
    });
  }
  return {
    userName: userInfo.userName ?? null,
    coachId: recipientId,
    coachInfo: coachInfo ?? null,
    source,
  };
}

function requireVerificationRecipient(recipient, message) {
  if (!recipient?.coachId) {
    throw new ValidationError(400, message);
  }
  return recipient;
}

function otpExpiryIst(hoursFromNow = TESTIMONIAL_OTP_VALIDITY_HOURS) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + hoursFromNow * 60 * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

/** Same clock convention as verifyUnifiedOtp / verifyOtp. */
function isOtpExpired(otpExpiresAt) {
  if (!otpExpiresAt) return true;
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istNow > new Date(otpExpiresAt);
}

function storagePath(userId, side, timestamp) {
  return `${userId}/${side}_${timestamp}.jpg`;
}

/** Inline CIDs for Before/After photos in the Transformation card email block. */
const BEFORE_PHOTO_CID = 'transformation-before@wellnessvalley';
const AFTER_PHOTO_CID = 'transformation-after@wellnessvalley';
const PREV_BEFORE_PHOTO_CID = 'transformation-before-prev@wellnessvalley';
const PREV_AFTER_PHOTO_CID = 'transformation-after-prev@wellnessvalley';
const SHARE_CARD_CID = 'transformation-card@wellnessvalley';
const PREV_SHARE_CARD_CID = 'transformation-card-prev@wellnessvalley';

/**
 * Upload Transformation share card for coach email Previous | New compare.
 * Prefers the in-app client capture (same look as Previous). Falls back to a
 * server-composed card from Before/After photo bytes when capture is missing.
 * Rotates the prior card to share_card_prev.jpg only when it differs.
 *
 * @param {number} userId
 * @param {string|null|undefined} shareCardImageBase64 - client capture (preferred)
 * @param {{
 *   beforeImagePath?: string|null,
 *   afterImagePath?: string|null,
 *   beforeImageBase64?: string|null,
 *   afterImageBase64?: string|null,
 *   memberName?: string|null,
 *   beforeWeightKg?: number|null,
 *   afterWeightKg?: number|null,
 *   goalType?: string|null,
 *   durationText?: string|null,
 * }|null} [composeFromPhotos]
 * @returns {Promise<string|null>} storage path when uploaded
 */
async function uploadShareCardImage(userId, shareCardImageBase64, composeFromPhotos = null) {
  // Prefer polished client capture; always fall back to server compose so the
  // email never ships without a Transformation Card when photos exist.
  let newJpeg = bufferFromOptionalBase64(shareCardImageBase64);

  const beforePath = composeFromPhotos?.beforeImagePath;
  const afterPath = composeFromPhotos?.afterImagePath;
  const canCompose = Boolean(
    (composeFromPhotos?.beforeImageBase64 || beforePath)
    && (composeFromPhotos?.afterImageBase64 || afterPath)
    && !(beforePath && repo.isVideoOnlyPlaceholder?.(beforePath))
    && !(afterPath && repo.isVideoOnlyPlaceholder?.(afterPath)),
  );

  if (!newJpeg && canCompose) {
    try {
      let beforeBuffer = bufferFromOptionalBase64(composeFromPhotos.beforeImageBase64);
      let afterBuffer = bufferFromOptionalBase64(composeFromPhotos.afterImageBase64);
      const downloads = [];
      if (!beforeBuffer && beforePath) {
        downloads.push(
          repo.downloadBuffer(beforePath, { retries: 2 }).then((buf) => { beforeBuffer = buf; }),
        );
      }
      if (!afterBuffer && afterPath) {
        downloads.push(
          repo.downloadBuffer(afterPath, { retries: 2 }).then((buf) => { afterBuffer = buf; }),
        );
      }
      if (downloads.length) await Promise.all(downloads);

      if (beforeBuffer?.length && afterBuffer?.length) {
        newJpeg = await composeTransformationShareCardJpeg({
          beforeBuffer,
          afterBuffer,
          memberName: composeFromPhotos.memberName,
          beforeWeightKg: composeFromPhotos.beforeWeightKg,
          afterWeightKg: composeFromPhotos.afterWeightKg,
          goalType: composeFromPhotos.goalType,
          durationText: composeFromPhotos.durationText,
        });
      }
    } catch (err) {
      logger.warn('[testimonials.service] Server share-card compose failed', {
        userId,
        message: err?.message || String(err),
      });
    }
  }

  if (!newJpeg?.length) {
    logger.warn('[testimonials.service] No share card for email (client capture and compose both missing)', {
      userId,
      hadClientCapture: Boolean(shareCardImageBase64),
      canCompose,
    });
    return null;
  }

  const path = repo.shareCardStoragePath(userId);
  const prevPath = repo.previousShareCardStoragePath(userId);
  // When Before/After photo bytes changed, always archive the prior card for Previous | New.
  const photoChanged = Boolean(
    composeFromPhotos?.beforeImageBase64 || composeFromPhotos?.afterImageBase64,
  );
  try {
    const existing = await repo.downloadBuffer(path, { retries: 1 });
    if (existing?.length && (photoChanged || !existing.equals(newJpeg))) {
      await repo.uploadBuffer(prevPath, existing, 'image/jpeg');
    }
  } catch {
    // No previous card yet — first upload.
  }
  await repo.uploadBuffer(path, newJpeg, 'image/jpeg');
  return path;
}

/**
 * Load a storage photo as an inline email attachment (Gmail-safe).
 * @param {string|null|undefined} path
 * @param {string} cid
 * @param {string} filename
 * @returns {Promise<{ cid: string, content: Buffer, filename: string, contentType: string, contentDisposition: string }|null>}
 */
async function loadPhotoEmailAttachment(path, cid, filename) {
  if (!path || repo.isVideoOnlyPlaceholder?.(path)) return null;
  try {
    const content = await repo.downloadBuffer(path, { retries: 2 });
    if (!content?.length) return null;
    return {
      cid,
      content,
      filename,
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    };
  } catch (err) {
    logger.info('[testimonials.service] Photo not available for email CID', {
      path,
      message: err?.message || String(err),
    });
    return null;
  }
}

/**
 * Resolve Before/After src for an email Transformation card.
 * Prefer inline CID attachments so left/right always show the uploaded photos.
 * @param {string|null|undefined} beforeImagePath
 * @param {string|null|undefined} afterImagePath
 * @param {{ beforeCid?: string, afterCid?: string, beforeFile?: string, afterFile?: string }} [ids]
 * @returns {Promise<{ beforeSrc: string|null, afterSrc: string|null, attachments: object[] }>}
 */
async function resolveTransformationCardEmailPhotos(beforeImagePath, afterImagePath, ids = {}) {
  const beforeCid = ids.beforeCid || BEFORE_PHOTO_CID;
  const afterCid = ids.afterCid || AFTER_PHOTO_CID;
  const beforeFile = ids.beforeFile || 'before.jpg';
  const afterFile = ids.afterFile || 'after.jpg';
  const [beforeAtt, afterAtt, beforeSigned, afterSigned] = await Promise.all([
    loadPhotoEmailAttachment(beforeImagePath, beforeCid, beforeFile),
    loadPhotoEmailAttachment(afterImagePath, afterCid, afterFile),
    beforeImagePath ? repo.getEmailSignedUrl(beforeImagePath) : Promise.resolve(null),
    afterImagePath ? repo.getEmailSignedUrl(afterImagePath) : Promise.resolve(null),
  ]);
  const attachments = [beforeAtt, afterAtt].filter(Boolean);
  return {
    beforeSrc: beforeAtt ? `cid:${beforeCid}` : beforeSigned,
    afterSrc: afterAtt ? `cid:${afterCid}` : afterSigned,
    attachments,
  };
}

function healthIssuesEqual(left, right) {
  const normalize = (value) => (
    (Array.isArray(value) ? value : [])
      .map((item) => String(item ?? '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|')
  );
  return normalize(left) === normalize(right);
}

/**
 * Dedupe a health-issue list (case-insensitive). Does not merge with prior DB values.
 * Clients send the full current selection (DiseaseMultiSelect / draftIssues), so
 * removals must replace — not union — or deleted issues keep reappearing.
 */
function normalizeHealthIssuesList(list) {
  const seen = new Set();
  const result = [];
  for (const item of (Array.isArray(list) ? list : [])) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

async function sendHealthIssueOtpEmail({
  channel,
  existing,
  coachInfo,
  userInfo,
  recoveredHealthIssues,
  saveUpdates,
}) {
  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);

  if (channel === 'photo') {
    saveUpdates.status       = 'pending';
    saveUpdates.verifiedAt   = null;
    saveUpdates.otpHash      = otpHash;
    saveUpdates.otpExpiresAt = otpExpiry;

    await repo.updateTestimonial(existing.id, saveUpdates);

    await sendCoachEmail({
      coachEmail:      coachInfo.email,
      memberName:      userInfo.userName,
      goalType:        existing.goal_type,
      beforeWeight:    existing.before_weight_kg,
      afterWeight:     existing.after_weight_kg,
      durationText:    existing.duration_text,
      otp,
      beforeImagePath: existing.before_image_path,
      afterImagePath:  existing.after_image_path,
      recoveredHealthIssues,
      userId:          existing.user_id ?? userInfo?.userId ?? null,
    });

    return 'Health issues updated. Your coach received a new photo OTP by email with your latest images.';
  }

  await repo.updateTestimonial(existing.id, saveUpdates);
  await repo.updateTestimonialVideos(existing.id, {
    videoStatus:       'pending',
    videoOtpHash:      otpHash,
    videoOtpExpiresAt: otpExpiry,
    videoVerifiedAt:   null,
  });

  await sendVideoCoachEmail({
    coachEmail:        coachInfo.email,
    memberName:        userInfo.userName,
    otp,
    healthVideoPath:   existing.health_video_path   ?? null,
    businessVideoPath: existing.business_video_path ?? null,
    recoveredHealthIssues,
  });

  return 'Health issues updated. Your coach received a new video OTP by email with your latest videos.';
}

async function resolveDisplayImageUrl(path) {
  if (!path) return null;
  if (isInlineImageReference(path)) return path;
  return repo.getSignedUrl(path);
}

/**
 * Build API testimonial payload with signed photo/video URLs.
 * Video-only rows (placeholder before image) still return video URLs when present.
 * @param {object|null} testimonial
 * @param {{ includeVideos?: boolean }} [opts]
 */
async function enrichTestimonialForDisplay(testimonial, opts = {}) {
  if (!testimonial) return null;
  const includeVideos = opts.includeVideos !== false;

  const videoOnly = repo.isVideoOnlyPlaceholder(testimonial.before_image_path);
  const hasVideos = !!(testimonial.health_video_path || testimonial.business_video_path);

  if (videoOnly && !hasVideos) return null;

  const [beforeUrl, afterUrl, healthVideoUrl, businessVideoUrl] = await Promise.all([
    videoOnly ? Promise.resolve(null) : resolveDisplayImageUrl(testimonial.before_image_path),
    videoOnly ? Promise.resolve(null) : resolveDisplayImageUrl(testimonial.after_image_path),
    includeVideos && testimonial.health_video_path
      ? repo.getSignedUrl(testimonial.health_video_path)
      : Promise.resolve(null),
    includeVideos && testimonial.business_video_path
      ? repo.getSignedUrl(testimonial.business_video_path)
      : Promise.resolve(null),
  ]);

  return {
    id:                     testimonial.id,
    beforeWeightKg:         videoOnly ? null : testimonial.before_weight_kg,
    afterWeightKg:          videoOnly ? null : testimonial.after_weight_kg,
    goalType:               videoOnly ? null : testimonial.goal_type,
    durationText:           videoOnly ? null : testimonial.duration_text,
    status:                 testimonial.status,
    verifiedAt:             testimonial.verified_at,
    createdAt:              testimonial.created_at,
    updatedAt:              testimonial.updated_at,
    beforeImageUrl:         beforeUrl,
    afterImageUrl:          afterUrl,
    healthVideoPath:        testimonial.health_video_path   ?? null,
    businessVideoPath:      testimonial.business_video_path ?? null,
    healthVideoUrl:         healthVideoUrl,
    businessVideoUrl:       businessVideoUrl,
    videoStatus:            testimonial.video_status        ?? 'none',
    videoVerifiedAt:        testimonial.video_verified_at   ?? null,
    recoveredHealthIssues:  testimonial.recovered_health_issues ?? [],
    // OTP metadata for member UI (never expose hash).
    otpExpiresAt:           testimonial.otp_expires_at ?? null,
    otpExpired:             testimonial.otp_hash
      ? isOtpExpired(testimonial.otp_expires_at)
      : false,
    otpValidityHours:       TESTIMONIAL_OTP_VALIDITY_HOURS,
    hasPendingOtp:          Boolean(testimonial.otp_hash),
    // Alias kept for older clients that read otpPending.
    otpPending:             Boolean(testimonial.otp_hash),
  };
}

async function sendCoachEmail({
  coachEmail,
  memberName,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  otp,
  beforeImagePath,
  afterImagePath,
  recoveredHealthIssues,
  userId = null,
}) {
  void userId;
  const cardPhotos = await resolveTransformationCardEmailPhotos(beforeImagePath, afterImagePath);

  const emailParams = {
    memberName,
    goalType,
    beforeWeight,
    afterWeight,
    durationText,
    otp,
    beforeUrl: cardPhotos.beforeSrc,
    afterUrl: cardPhotos.afterSrc,
    recoveredHealthIssues: recoveredHealthIssues ?? [],
    shareCardSrc: null,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from:    '"Wellness Valley" <easy2work.india@gmail.com>',
    to:      coachEmail,
    subject: buildTestimonialCoachEmailSubject({ memberName }),
    text:    {
      content: buildTestimonialCoachEmailText(emailParams),
      charset: 'utf-8',
    },
    html:    {
      content: buildTestimonialCoachEmailHtml(emailParams),
      charset: 'utf-8',
    },
    headers: {
      'Content-Language': 'en',
    },
    ...(cardPhotos.attachments.length ? { attachments: cardPhotos.attachments } : {}),
  });

  logger.info('[testimonials.service] Coach email dispatched', {
    coachEmail,
    memberName,
    hasBeforePhoto: Boolean(cardPhotos.beforeSrc),
    hasAfterPhoto: Boolean(cardPhotos.afterSrc),
  });
}

// â”€â”€â”€ Service functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Submit a new testimonial (or update an existing one) for a member.
 * If no after photo is provided â†’ status: 'incomplete' (no email sent).
 * If after photo is present    â†’ status: 'pending'    (email + OTP sent to coach).
 */
export async function submitTestimonial(rawBody) {
  const payload = validateSubmitTestimonial(rawBody);

  logger.info('[testimonials] submit', { userId: payload.userId, hasAfter: payload.hasAfter });

  const recipient = requireVerificationRecipient(
    await resolveVerificationRecipient(payload.userId),
    'User has no coach or co-coach assigned. Cannot submit testimonial.',
  );
  const userInfo = { coachId: recipient.coachId, userName: recipient.userName };

  const ts = Date.now();
  const beforePath = storagePath(payload.userId, 'before', ts);

  await repo.uploadImage(payload.beforeImageBase64, beforePath);

  let afterPath = null;
  if (payload.hasAfter) {
    afterPath = storagePath(payload.userId, 'after', ts);
    await repo.uploadImage(payload.afterImageBase64, afterPath);
  }

  await syncTestimonialPathsToProfileSafe({
    userId: payload.userId,
    beforeImagePath: beforePath,
    afterImagePath: afterPath,
  });

  // Generate OTP only when after photo is present (complete submission)
  let otpHash = null;
  let otpExpiry = null;
  let otp = null;
  if (payload.hasAfter) {
    otp       = generateOtp();
    otpHash   = await bcrypt.hash(otp, 10);
    otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);
  }

  const newStatus = payload.hasAfter ? 'pending' : 'incomplete';
  const existing  = await repo.findByUserId(payload.userId);

  let row;
  const rowData = {
    beforeImagePath:        beforePath,
    beforeWeightKg:         payload.beforeWeightKg,
    goalType:               payload.goalType,
    durationText:           payload.durationText,
    status:                 newStatus,
    otpHash,
    otpExpiresAt:           otpExpiry,
    verifiedAt:             null,
    recoveredHealthIssues:  payload.recoveredHealthIssues ?? [],
    ...(afterPath ? { afterImagePath: afterPath, afterWeightKg: payload.afterWeightKg } : {}),
  };

  if (existing) {
    row = await repo.updateTestimonial(existing.id, rowData);
  } else {
    row = await repo.insertTestimonial({
      userId:  payload.userId,
      coachId: userInfo.coachId,
      // Placeholder paths for incomplete â€” will be replaced on completion
      afterImagePath: afterPath ?? beforePath,
      afterWeightKg:  payload.afterWeightKg ?? payload.beforeWeightKg,
      ...rowData,
    });
  }

  // Only email coach (or co-coach fallback) when the testimonial is complete
  if (payload.hasAfter) {
    await uploadShareCardImage(payload.userId, payload.shareCardImageBase64, {
      beforeImagePath: beforePath,
      afterImagePath: afterPath,
      beforeImageBase64: payload.beforeImageBase64,
      afterImageBase64: payload.afterImageBase64,
      memberName: userInfo.userName,
      beforeWeightKg: payload.beforeWeightKg,
      afterWeightKg: payload.afterWeightKg,
      goalType: payload.goalType,
      durationText: payload.durationText,
    });
    const coachInfo = recipient.coachInfo;
    if (coachInfo?.email) {
      await sendCoachEmail({
        coachEmail:    coachInfo.email,
        coachName:     coachInfo.name,
        memberName:    userInfo.userName,
        goalType:      payload.goalType,
        beforeWeight:  payload.beforeWeightKg,
        afterWeight:   payload.afterWeightKg,
        durationText:  payload.durationText,
        otp,
        beforeImagePath: beforePath,
        afterImagePath:  afterPath,
        recoveredHealthIssues: payload.recoveredHealthIssues,
        userId:          payload.userId,
      });
    }
  }

  const message = payload.hasAfter
    ? 'Testimonial submitted! Your coach will receive a verification email with the OTP.'
    : 'Before photo saved! Come back later to add your after photo and complete your testimonial.';

  return {
    httpStatus: 200,
    body: { success: true, message, testimonialId: row.id, status: newStatus },
  };
}

/**
 * Coach verifies the testimonial using the emailed OTP.
 */
export async function verifyOtp(rawBody) {
  const { testimonialId, otp } = validateVerifyOtp(rawBody);

  const row = await repo.findById(testimonialId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (row.status === 'incomplete') throw new ValidationError(422, 'Testimonial is incomplete â€” after photo not yet added');
  if (row.status === 'verified')   throw new ValidationError(409, 'This testimonial is already verified');

  if (!row.otp_hash) throw new ValidationError(422, 'No OTP is set for this testimonial');

  // Check expiry (IST string comparison is safe since both are IST)
  const now     = new Date();
  const istNow  = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const expiry  = new Date(row.otp_expires_at);
  if (istNow > expiry) throw new ValidationError(422, 'OTP has expired. Ask the member to re-submit their testimonial.');

  const valid = await bcrypt.compare(otp, row.otp_hash);
  if (!valid) throw new ValidationError(422, 'Invalid OTP');

  const verifiedAt = nowUtc();
  await repo.updateTestimonial(testimonialId, { status: 'verified', verifiedAt, otpHash: null });

  return {
    httpStatus: 200,
    body: { success: true, message: 'Testimonial verified successfully.' },
  };
}

/**
 * Member edits their testimonial â€” resets to pending and re-emails coach.
 */
export async function editTestimonial(rawBody) {
  const payload = validateEditTestimonial(rawBody);

  const existing = await repo.findByUserId(payload.userId);
  if (!existing) throw new ValidationError(404, 'No testimonial found for this user');

  const recipient = await resolveVerificationRecipient(payload.userId);
  const userInfo  = recipient
    ? { coachId: recipient.coachId, userName: recipient.userName }
    : null;
  const coachInfo = recipient?.coachInfo ?? null;

  const updates = {};
  const ts = Date.now();

  if (payload.beforeImageBase64) {
    const beforePath = storagePath(payload.userId, 'before', ts);
    await repo.uploadImage(payload.beforeImageBase64, beforePath);
    updates.beforeImagePath = beforePath;
  }
  if (payload.afterImageBase64) {
    const afterPath = storagePath(payload.userId, 'after', ts);
    await repo.uploadImage(payload.afterImageBase64, afterPath);
    updates.afterImagePath = afterPath;
  }

  if (updates.beforeImagePath || updates.afterImagePath) {
    await syncTestimonialPathsToProfileSafe({
      userId: payload.userId,
      beforeImagePath: updates.beforeImagePath || null,
      afterImagePath: updates.afterImagePath || null,
    });
  }

  if (payload.beforeWeightKg       !== undefined) updates.beforeWeightKg      = payload.beforeWeightKg;
  if (payload.afterWeightKg        !== undefined) updates.afterWeightKg       = payload.afterWeightKg;
  if (payload.goalType             !== undefined) updates.goalType            = payload.goalType;
  if (payload.durationText         !== undefined) updates.durationText        = payload.durationText;
  if (payload.recoveredHealthIssues !== undefined) {
    // Full list from client — replace so removals persist
    updates.recoveredHealthIssues = normalizeHealthIssuesList(payload.recoveredHealthIssues);
  }

  const requiresReverification = [
    'beforeImagePath',
    'afterImagePath',
    'beforeWeightKg',
    'afterWeightKg',
    'goalType',
    'durationText',
  ].some((field) => updates[field] !== undefined);

  const resolvedHealthIssues = updates.recoveredHealthIssues !== undefined
    ? updates.recoveredHealthIssues
    : (existing.recovered_health_issues ?? []);

  // Health-only edits: shared list for photo + video. Resend coach OTP with the latest entry.
  if (!requiresReverification) {
    const issuesChanged = payload.recoveredHealthIssues !== undefined
      && !healthIssuesEqual(resolvedHealthIssues, existing.recovered_health_issues);

    const otpChannel = issuesChanged ? resolveHealthIssueOtpChannel(existing) : null;
    const saveUpdates = { ...updates };
    let message = 'Health issues saved successfully.';

    if (issuesChanged && otpChannel && coachInfo?.email && userInfo?.userName) {
      message = await sendHealthIssueOtpEmail({
        channel: otpChannel,
        existing,
        coachInfo,
        userInfo,
        recoveredHealthIssues: resolvedHealthIssues,
        saveUpdates,
      });
    } else {
      await repo.updateTestimonial(existing.id, saveUpdates);
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        message,
        testimonialId: existing.id,
        status: otpChannel === 'photo' ? 'pending' : existing.status,
        otpChannel: otpChannel ?? undefined,
        videoStatus: otpChannel === 'video' ? 'pending' : (existing.video_status ?? 'none'),
      },
    };
  }

  // Determine if this request is submitting / changing the after photo
  const includesAfterPhoto = !!payload.afterImageBase64 || updates.afterImagePath !== undefined;

  // Before-only or metadata-only edit — no coach OTP, no health-issue gate here.
  if (requiresReverification && !includesAfterPhoto) {
    const hasCompleteAfter = existing.status !== 'incomplete'
      && existing.after_image_path
      && existing.after_image_path !== existing.before_image_path
      && !repo.isVideoOnlyPlaceholder(existing.after_image_path);

    if (!hasCompleteAfter) {
      updates.status = 'incomplete';
    }

    await repo.updateTestimonial(existing.id, updates);

    return {
      httpStatus: 200,
      body: {
        success: true,
        message: hasCompleteAfter
          ? 'Before photo details updated.'
          : 'Before photo updated. Add your after photo when you\'re ready to complete your testimonial.',
        testimonialId: existing.id,
        status: updates.status ?? existing.status,
      },
    };
  }

  // After photo is part of this update — full verification path
  const afterPathNow = updates.afterImagePath ?? existing.after_image_path;
  const hasRealAfterPhoto = !!updates.afterImagePath
    || (
      existing.status !== 'incomplete'
      && existing.after_image_path
      && existing.after_image_path !== existing.before_image_path
      && !repo.isVideoOnlyPlaceholder(existing.after_image_path)
    );
  const isNowComplete = hasRealAfterPhoto;
  const afterWeightNow = updates.afterWeightKg ?? existing.after_weight_kg;

  if (isNowComplete) {
    // Full testimonial â€” reset to pending and issue new OTP
    const otp       = generateOtp();
    const otpHash   = await bcrypt.hash(otp, 10);
    const otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);
    updates.status       = 'pending';
    updates.otpHash      = otpHash;
    updates.otpExpiresAt = otpExpiry;
    updates.verifiedAt   = null;

    await repo.updateTestimonial(existing.id, updates);

    if (coachInfo?.email && userInfo?.userName) {
      const currentBeforePath = updates.beforeImagePath ?? existing.before_image_path;
      await uploadShareCardImage(payload.userId, payload.shareCardImageBase64, {
        beforeImagePath: currentBeforePath,
        afterImagePath: afterPathNow,
        beforeImageBase64: payload.beforeImageBase64,
        afterImageBase64: payload.afterImageBase64,
        memberName: userInfo.userName,
        beforeWeightKg: updates.beforeWeightKg ?? existing.before_weight_kg,
        afterWeightKg: afterWeightNow,
        goalType: updates.goalType ?? existing.goal_type,
        durationText: updates.durationText ?? existing.duration_text,
      });
      await sendCoachEmail({
        coachEmail:    coachInfo.email,
        coachName:     coachInfo.name,
        memberName:    userInfo.userName,
        goalType:      updates.goalType    ?? existing.goal_type,
        beforeWeight:  updates.beforeWeightKg ?? existing.before_weight_kg,
        afterWeight:   afterWeightNow,
        durationText:  updates.durationText ?? existing.duration_text,
        otp,
        beforeImagePath: currentBeforePath,
        afterImagePath:  afterPathNow,
        recoveredHealthIssues: resolvedHealthIssues,
        userId:          payload.userId,
      });
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        message: 'Testimonial updated! A new verification email has been sent to your coach.',
        testimonialId: existing.id,
        status: 'pending',
      },
    };
  }

  // Still incomplete — after photo not yet in this flow (should not reach here after before-only branch)
  updates.status = 'incomplete';
  await repo.updateTestimonial(existing.id, updates);

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Before photo updated. Add your after photo when you\'re ready to complete your testimonial.',
      testimonialId: existing.id,
      status: 'incomplete',
    },
  };
}

/**
 * Fetch a member's own testimonial with signed image and video URLs.
 */
export async function getMyTestimonial(rawQuery) {
  const { userId } = validateMyTestimonial(rawQuery);
  const row = await repo.findByUserId(userId);
  if (!row) {
    return { httpStatus: 200, body: { success: true, data: null } };
  }

  const data = await enrichTestimonialForDisplay(row);
  let sponsorName = null;
  try {
    const recipient = await resolveVerificationRecipient(userId);
    if (recipient?.coachId) {
      sponsorName = recipient.coachInfo?.name ? String(recipient.coachInfo.name).trim() : null;
    }
  } catch (err) {
    logger.warn('[testimonials] sponsor name lookup failed', { userId, message: err?.message });
  }
  if (data) data.sponsorName = sponsorName;

  return {
    httpStatus: 200,
    body: { success: true, data },
  };
}

/**
 * Fetch a member's own result-video status (independent of photo testimonial).
 */
export async function getMyVideoTestimonial(rawQuery) {
  const { userId } = validateMyTestimonial(rawQuery);
  const row = await repo.findByUserId(userId);
  if (!row) {
    return { httpStatus: 200, body: { success: true, data: null } };
  }

  const videoStatus = row.video_status ?? 'none';
  if (videoStatus === 'none' && !row.health_video_path && !row.business_video_path) {
    return { httpStatus: 200, body: { success: true, data: null } };
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        testimonialId:    row.id,
        videoStatus,
        hasHealthVideo:   !!row.health_video_path,
        hasBusinessVideo: !!row.business_video_path,
        videoVerifiedAt:  row.video_verified_at ?? null,
        recoveredHealthIssues: row.recovered_health_issues ?? [],
      },
    },
  };
}

/**
 * Paginated lean team list for a coach.
 * Signs thumbnail URLs only for the current page (not the full hierarchy).
 * No Base64. No full video URLs — use getTestimonialDetail for media.
 */
export async function listForCoach(rawQuery) {
  const apiStarted = Date.now();
  const { coachId, scope, page, limit, search, healthIssue, uploadFilter } = validateListForCoach(rawQuery);

  const sqlStarted = Date.now();
  const rows = await repo.listForCoach(coachId, scope);
  const sqlMs = Date.now() - sqlStarted;
  let queryCount = 2; // hierarchy context + testimonials batch (best-effort)

  // Map to lean fields (paths only) before filter/paginate — no signed URLs yet.
  const leanJoined = rows.map((row) => {
    const lean = mapTestimonialsListLeanFields(row);
    return {
      ...lean,
      user: { UserId: lean.userId, UserName: lean.userName, userName: lean.userName },
      testimonialRaw: row.testimonial,
      uploadLevel: lean.uploadLevel,
    };
  });

  const searched = filterTestimonialsListByHealthIssue(
    filterTestimonialsListBySearch(leanJoined, search),
    healthIssue,
  );
  const filtered = filterTestimonialsListByUpload(searched, uploadFilter);
  const uploadCounts = countTestimonialsUploadLevels(searched);
  const { pageRows, pagination } = paginateTestimonialsList(filtered, { page, limit });

  // Sign photo thumbs only for this page (≤ 2 × limit storage calls).
  const signStarted = Date.now();
  const data = await Promise.all(
    pageRows.map(async (lean) => {
      const [beforeThumb, afterThumb] = await Promise.all([
        lean.beforeImagePath ? resolveDisplayImageUrl(lean.beforeImagePath) : null,
        lean.afterImagePath ? resolveDisplayImageUrl(lean.afterImagePath) : null,
      ]);
      if (lean.beforeImagePath) queryCount += 1;
      if (lean.afterImagePath) queryCount += 1;

      // Shape matches existing MemberCard contract; thumbs stand in for list display.
      const hasListMedia = !!(lean.beforeImagePath || lean.afterImagePath
        || lean.healthVideoPath || lean.businessVideoPath);
      const testimonial = lean.testimonialId == null && !hasListMedia
        ? null
        : {
            id: lean.testimonialId,
            beforeWeightKg: lean.beforeWeightKg,
            afterWeightKg: lean.afterWeightKg,
            goalType: lean.goalType,
            durationText: lean.durationText,
            status: lean.status,
            verifiedAt: lean.verifiedAt,
            createdAt: lean.createdAt,
            updatedAt: lean.lastUpdated,
            beforeImageUrl: beforeThumb,
            afterImageUrl: afterThumb,
            beforeImageThumbUrl: beforeThumb,
            afterImageThumbUrl: afterThumb,
            healthVideoPath: lean.healthVideoPath,
            businessVideoPath: lean.businessVideoPath,
            healthVideoUrl: null,
            businessVideoUrl: null,
            videoStatus: lean.videoStatus,
            videoVerifiedAt: null,
            recoveredHealthIssues: lean.recoveredHealthIssues,
            uploadStatus: lean.uploadStatus,
            progress: lean.progress,
          };

      return {
        user: {
          userId: lean.userId,
          userName: lean.userName,
          profileImage: null,
          phoneNumber: lean.phoneNumber,
        },
        testimonial,
        lastUpdated: lean.lastUpdated,
        uploadStatus: lean.uploadStatus,
        progress: lean.progress,
        canEditHealthIssues: lean.canEditHealthIssues !== false,
      };
    }),
  );
  const signMs = Date.now() - signStarted;

  const body = {
    success: true,
    data,
    pagination,
    uploadCounts,
  };
  const payloadBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  const apiMs = Date.now() - apiStarted;

  logger.info('[testimonials.listForCoach] perf', {
    coachId,
    scope,
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    search: search || null,
    healthIssue: healthIssue || null,
    uploadFilter,
    sqlMs,
    signMs,
    apiMs,
    queryCount,
    payloadBytes,
    pageSize: data.length,
  });

  return {
    httpStatus: 200,
    body,
  };
}

/**
 * Full member testimonial detail — photos, videos, share fields.
 * Call only when opening / editing / sharing a card.
 */
export async function getTestimonialDetail(rawQuery) {
  const apiStarted = Date.now();
  const { userId, coachId } = validateTestimonialDetail(rawQuery);

  const sqlStarted = Date.now();
  let row = await repo.findByUserId(userId);
  const sqlMs = Date.now() - sqlStarted;

  // Optional coach-tree gate when coachId provided (hierarchy only — no SELECT *)
  if (coachId != null && coachId !== userId) {
    const allowed = await repo.isReportingMember(coachId, userId, 'full');
    if (!allowed) {
      throw new ValidationError(403, 'Member is not in your team hierarchy');
    }
  }

  if (!row) {
    row = await repo.buildTestimonialFromProfilePhotos(userId);
  }

  const enriched = await enrichTestimonialForDisplay(row, { includeVideos: true });
  const body = {
    success: true,
    data: {
      userId,
      testimonial: enriched,
    },
  };
  const payloadBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  const apiMs = Date.now() - apiStarted;

  logger.info('[testimonials.getTestimonialDetail] perf', {
    userId,
    coachId,
    sqlMs,
    apiMs,
    payloadBytes,
    hasTestimonial: !!enriched,
  });

  return {
    httpStatus: 200,
    body,
  };
}

function sanitizeUser(user) {
  return {
    userId:       user.UserId,
    userName:     user.UserName,
    // Avatars via /api/user/avatar — never embed base64 in list payloads.
    profileImage: null,
    phoneNumber:  user.PhoneNumber ?? null,
  };
}

// ─── Video email helper ───────────────────────────────────────────────────────

async function sendVideoCoachEmail({ coachEmail, memberName, otp, healthVideoPath, businessVideoPath, recoveredHealthIssues }) {
  // Generate 7-day signed URLs so coach can watch the videos directly from their email client
  const [healthVideoUrl, businessVideoUrl] = await Promise.all([
    repo.getEmailSignedUrl(healthVideoPath   ?? null),
    repo.getEmailSignedUrl(businessVideoPath ?? null),
  ]);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const emailParams = {
    memberName,
    otp,
    healthVideoUrl,
    businessVideoUrl,
    recoveredHealthIssues: recoveredHealthIssues ?? [],
  };

  await transporter.sendMail({
    from:    '"Wellness Valley" <easy2work.india@gmail.com>',
    to:      coachEmail,
    subject: buildVideoCoachEmailSubject({ memberName }),
    text:    { content: buildVideoCoachEmailText(emailParams),  charset: 'utf-8' },
    html:    { content: buildVideoCoachEmailHtml(emailParams),  charset: 'utf-8' },
    headers: { 'Content-Language': 'en' },
  });

  logger.info('[testimonials.service] Video coach email dispatched', { coachEmail, memberName });
}

// ─── Video service functions ──────────────────────────────────────────────────

async function assertVideoUploadEligible(userId) {
  const recipient = requireVerificationRecipient(
    await resolveVerificationRecipient(userId),
    'User has no coach or co-coach assigned. Cannot submit video testimonial.',
  );
  const userInfo = { coachId: recipient.coachId, userName: recipient.userName };

  let existing = await repo.findByUserId(userId);
  if (!existing) {
    existing = await repo.insertVideoOnlyTestimonial({
      userId,
      coachId: userInfo.coachId,
    });
    logger.info('[testimonials] Created video-only testimonial stub', { userId });
  }

  return { existing, userInfo, recipient };
}

/**
 * Reserve storage paths + session IDs for chunked client video upload.
 * Each chunk is posted separately to stay under Vercel's ~4.5 MB body limit.
 */
export async function prepareVideoUpload(rawBody) {
  const payload = validatePrepareVideoUpload(rawBody);

  logger.info('[testimonials] prepareVideoUpload', { userId: payload.userId });

  await assertVideoUploadEligible(payload.userId);

  const uploads = {};

  if (payload.uploadHealth) {
    const sessionId = crypto.randomUUID();
    uploads.health = {
      path: `${payload.userId}/health_video_${sessionId}.mp4`,
      sessionId,
    };
  }
  if (payload.uploadBusiness) {
    const sessionId = crypto.randomUUID();
    uploads.business = {
      path: `${payload.userId}/business_video_${sessionId}.mp4`,
      sessionId,
    };
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      uploads,
    },
  };
}

function tmpChunkPath(userId, sessionId, chunkIndex) {
  return `${userId}/tmp_${sessionId}_chunk_${chunkIndex}.part`;
}

function sniffVideoContentType(buffer) {
  if (!buffer || buffer.length < 4) return 'video/mp4';
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return 'video/webm';
  }
  return 'video/mp4';
}

function assertAssembledVideoSize(buffer, slot) {
  const maxBytes = slot === 'health' ? MAX_HEALTH_VIDEO_BYTES : MAX_BUSINESS_VIDEO_BYTES;
  if (buffer.length > maxBytes) {
    throw new ValidationError(
      422,
      `Video exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit. Please compress or trim and try again.`,
    );
  }
}

/**
 * Accept one chunk of a video upload, assemble on the final chunk, and store in Supabase.
 */
export async function uploadVideoChunk(rawBody) {
  const payload = validateUploadVideoChunk(rawBody);

  logger.info('[testimonials] uploadVideoChunk', {
    userId: payload.userId,
    sessionId: payload.sessionId,
    chunkIndex: payload.chunkIndex,
    totalChunks: payload.totalChunks,
  });

  await assertVideoUploadEligible(payload.userId);

  const cleaned = payload.chunkBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');
  if (!buffer.length) {
    throw new ValidationError(422, 'Video chunk data is empty. Please retry the upload.');
  }

  // Single-chunk videos upload directly — avoids tmp write/read race on small files.
  if (payload.totalChunks === 1) {
    assertAssembledVideoSize(buffer, payload.slot);
    await repo.uploadBuffer(payload.finalPath, buffer, sniffVideoContentType(buffer));
    return {
      httpStatus: 200,
      body: { success: true, complete: true, path: payload.finalPath },
    };
  }

  const tmpPath = tmpChunkPath(payload.userId, payload.sessionId, payload.chunkIndex);
  await repo.uploadBuffer(tmpPath, buffer, 'application/octet-stream');

  if (payload.chunkIndex !== payload.totalChunks - 1) {
    return {
      httpStatus: 200,
      body: { success: true, complete: false },
    };
  }

  const tmpPaths = [];
  const parts = [];
  for (let i = 0; i < payload.totalChunks; i++) {
    const chunkPath = tmpChunkPath(payload.userId, payload.sessionId, i);
    tmpPaths.push(chunkPath);
    parts.push(await repo.downloadBuffer(chunkPath));
  }

  const assembled = Buffer.concat(parts);
  assertAssembledVideoSize(assembled, payload.slot);
  await repo.uploadBuffer(payload.finalPath, assembled, sniffVideoContentType(assembled));
  await repo.removePaths(tmpPaths);

  return {
    httpStatus: 200,
    body: { success: true, complete: true, path: payload.finalPath },
  };
}

/**
 * Finalise health/business result videos after direct storage upload.
 * Creates a testimonial record automatically when the member has not uploaded photos yet.
 * Always sends an OTP email to the coach for video verification.
 * Both videos are optional — at least one must be provided.
 */
export async function submitVideo(rawBody) {
  const payload = validateSubmitVideo(rawBody);

  logger.info('[testimonials] submitVideo', { userId: payload.userId });

  const { existing, userInfo, recipient } = await assertVideoUploadEligible(payload.userId);

  const uploads = {};

  if (payload.healthVideoPath) {
    const exists = await repo.objectExists(payload.healthVideoPath);
    if (!exists) {
      throw new ValidationError(422, 'Health video upload was not found. Please upload again.');
    }
    uploads.healthVideoPath = payload.healthVideoPath;
  }
  if (payload.businessVideoPath) {
    const exists = await repo.objectExists(payload.businessVideoPath);
    if (!exists) {
      throw new ValidationError(422, 'Business video upload was not found. Please upload again.');
    }
    uploads.businessVideoPath = payload.businessVideoPath;
  }

  // Replace directly so removals are honoured. Health issues are optional.
  const resolvedHealthIssues = payload.recoveredHealthIssues !== undefined
    ? normalizeHealthIssuesList(payload.recoveredHealthIssues)
    : (existing.recovered_health_issues ?? []);

  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);

  await repo.updateTestimonialVideos(existing.id, {
    ...uploads,
    videoStatus:       'pending',
    videoOtpHash:      otpHash,
    videoOtpExpiresAt: otpExpiry,
    videoVerifiedAt:   null,
  });

  if (payload.recoveredHealthIssues !== undefined) {
    await repo.updateTestimonial(existing.id, { recoveredHealthIssues: resolvedHealthIssues });
  }

  const coachInfo = recipient.coachInfo;
  if (coachInfo?.email) {
    await sendVideoCoachEmail({
      coachEmail:        coachInfo.email,
      memberName:        userInfo.userName,
      otp,
      healthVideoPath:   uploads.healthVideoPath   ?? existing.health_video_path   ?? null,
      businessVideoPath: uploads.businessVideoPath ?? existing.business_video_path ?? null,
      recoveredHealthIssues: resolvedHealthIssues,
    });
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Videos uploaded! Your coach will receive a verification email with the OTP.',
      testimonialId: existing.id,
      videoStatus:   'pending',
    },
  };
}

/**
 * Coach verifies the video testimonial using the emailed OTP.
 */
export async function verifyVideoOtp(rawBody) {
  const { testimonialId, otp } = validateVerifyVideoOtp(rawBody);

  const row = await repo.findById(testimonialId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (row.video_status === 'none')     throw new ValidationError(422, 'No videos have been uploaded for this testimonial');
  if (row.video_status === 'verified') throw new ValidationError(409, 'Videos are already verified');

  if (!row.video_otp_hash) throw new ValidationError(422, 'No video OTP is set for this testimonial');

  const now    = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const expiry = new Date(row.video_otp_expires_at);
  if (istNow > expiry) {
    throw new ValidationError(422, 'OTP has expired. Ask the member to re-upload their videos.');
  }

  const valid = await bcrypt.compare(otp, row.video_otp_hash);
  if (!valid) throw new ValidationError(422, 'Invalid OTP');

  const videoVerifiedAt = nowUtc();
  await repo.updateTestimonialVideos(testimonialId, {
    videoStatus:     'verified',
    videoVerifiedAt,
    videoOtpHash:    null,
  });

  return {
    httpStatus: 200,
    body: { success: true, message: 'Video testimonial verified successfully.' },
  };
}

/**
 * Coach: get video upload/verification report for their team.
 */
export async function getVideoReport(rawQuery) {
  const { coachId, scope } = validateVideoReport(rawQuery);
  const rows = await repo.listVideoReportForCoach(coachId, scope);
  return {
    httpStatus: 200,
    body: { success: true, data: rows },
  };
}

function buildTeamUploadStats(uploaded, notUploaded) {
  const total = uploaded + notUploaded;
  if (!total) {
    return {
      uploaded,
      notUploaded,
      totalMembers: 0,
      uploadPercentage: 0,
      notUploadPercentage: 0,
    };
  }
  return {
    uploaded,
    notUploaded,
    totalMembers: total,
    uploadPercentage: Math.round((uploaded / total) * 10000) / 100,
    notUploadPercentage: Math.round((notUploaded / total) * 10000) / 100,
  };
}

/**
 * Coach: upload / not-upload percentages for photo and video reports
 * across direct and full team scopes.
 */
export async function getTeamTestimonialReport(rawQuery) {
  const { coachId } = validateTeamReport(rawQuery);

  const reportingContext = await repo.loadTeamReportingContext(coachId);

  const [
    photoDirect,
    photoFull,
    videoDirect,
    videoFull,
    teamPerformanceByUserId,
  ] = await Promise.all([
    repo.countPhotoUploadStatsForCoach(coachId, 'direct', reportingContext),
    repo.countPhotoUploadStatsForCoach(coachId, 'full', reportingContext),
    repo.countVideoUploadStatsForCoach(coachId, 'direct', reportingContext),
    repo.countVideoUploadStatsForCoach(coachId, 'full', reportingContext),
    repo.buildTeamUploadPerformanceByUserId(coachId, reportingContext),
  ]);

  return {
    httpStatus: 200,
    body: {
      success: true,
      photoReport: {
        directTeam: buildTeamUploadStats(photoDirect.uploaded, photoDirect.notUploaded),
        fullTeam: buildTeamUploadStats(photoFull.uploaded, photoFull.notUploaded),
      },
      videoReport: {
        directTeam: buildTeamUploadStats(videoDirect.uploaded, videoDirect.notUploaded),
        fullTeam: buildTeamUploadStats(videoFull.uploaded, videoFull.notUploaded),
      },
      teamPerformanceByUserId,
    },
  };
}

// ─── Unified edit + OTP ───────────────────────────────────────────────────────

/**
 * Helper: build and send the unified coach email via nodemailer.
 */
async function sendUnifiedCoachEmail({
  coachEmail,
  memberName,
  otp,
  changedSlots,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  beforeImagePath,
  afterImagePath,
  previousBeforeImagePath,
  previousAfterImagePath,
  previousBeforeWeight = null,
  previousAfterWeight = null,
  previousGoalType = null,
  previousDurationText = null,
  previousRecoveredHealthIssues = null,
  healthVideoPath,
  businessVideoPath,
  recoveredHealthIssues,
  isComplete,
  userId = null,
}) {
  const slots = new Set(changedSlots);
  void userId;

  // Previous Transformation Card = state before this submit.
  // Unchanged side keeps the current path; changed side uses the previous storage path.
  const previousCardBeforePath = (slots.has('before') && previousBeforeImagePath)
    ? previousBeforeImagePath
    : beforeImagePath;
  const previousCardAfterPath = (slots.has('after') && previousAfterImagePath)
    ? previousAfterImagePath
    : ((slots.has('before') && previousBeforeImagePath && !previousAfterImagePath)
      ? previousBeforeImagePath // seeded After mirrored Before before the change
      : afterImagePath);
  const photoSlotChanged = slots.has('before') || slots.has('after');
  const previousPairDistinct = Boolean(
    isComplete
    && photoSlotChanged
    && previousCardBeforePath
    && previousCardAfterPath
    && (
      previousCardBeforePath !== beforeImagePath
      || previousCardAfterPath !== afterImagePath
    ),
  );

  // Prefer Transformation Card images only — do not attach loose before/after
  // JPEGs (Gmail lists those as "4 Attachments" like before-previous.jpg).
  const [currentShareCardAttRaw, previousShareCardAttStored, healthVideoUrl, businessVideoUrl] =
    await Promise.all([
      userId
        ? loadPhotoEmailAttachment(repo.shareCardStoragePath(userId), SHARE_CARD_CID, 'transformation-card.jpg')
        : Promise.resolve(null),
      (userId && previousPairDistinct)
        ? loadPhotoEmailAttachment(
          repo.previousShareCardStoragePath(userId),
          PREV_SHARE_CARD_CID,
          'transformation-card-prev.jpg',
        )
        : Promise.resolve(null),
      (slots.has('health') && healthVideoPath)     ? repo.getEmailSignedUrl(healthVideoPath)   : Promise.resolve(null),
      (slots.has('business') && businessVideoPath) ? repo.getEmailSignedUrl(businessVideoPath) : Promise.resolve(null),
    ]);

  // When After/Before changed but share_card_prev is missing, build Previous from
  // the old photo pair so the email still shows Previous | New.
  let previousShareCardAttRaw = previousShareCardAttStored;
  if (
    userId
    && previousPairDistinct
    && !previousShareCardAttRaw
    && previousCardBeforePath
    && previousCardAfterPath
  ) {
    try {
      const [prevBeforeBuf, prevAfterBuf] = await Promise.all([
        repo.downloadBuffer(previousCardBeforePath, { retries: 2 }),
        repo.downloadBuffer(previousCardAfterPath, { retries: 2 }),
      ]);
      if (prevBeforeBuf?.length && prevAfterBuf?.length) {
        const prevJpeg = await composeTransformationShareCardJpeg({
          beforeBuffer: prevBeforeBuf,
          afterBuffer: prevAfterBuf,
          memberName,
          beforeWeightKg: previousBeforeWeight,
          afterWeightKg: previousAfterWeight,
          goalType: previousGoalType,
          durationText: previousDurationText,
        });
        await repo.uploadBuffer(
          repo.previousShareCardStoragePath(userId),
          prevJpeg,
          'image/jpeg',
        );
        previousShareCardAttRaw = {
          cid: PREV_SHARE_CARD_CID,
          content: prevJpeg,
          filename: 'transformation-card-prev.jpg',
          contentType: 'image/jpeg',
          contentDisposition: 'inline',
        };
      }
    } catch (err) {
      logger.warn('[testimonials.service] Could not compose Previous share card for email', {
        userId,
        message: err?.message || String(err),
      });
    }
  }

  // Drop Previous share card when it is byte-identical to New (avoids duplicate thumbs).
  const shareCardsIdentical = Boolean(
    currentShareCardAttRaw?.content?.length
    && previousShareCardAttRaw?.content?.length
    && currentShareCardAttRaw.content.equals(previousShareCardAttRaw.content),
  );
  const currentShareCardAtt = currentShareCardAttRaw;
  const previousShareCardAtt = shareCardsIdentical ? null : previousShareCardAttRaw;
  const showPreviousShareCard = Boolean(previousShareCardAtt) && !shareCardsIdentical;
  const hasShareCardThumbs = Boolean(currentShareCardAtt || previousShareCardAtt);

  // Loose Before/After CIDs only when share cards are missing (HTML card fallback).
  const emptyPhotos = { beforeSrc: null, afterSrc: null, attachments: [] };
  const [cardPhotos, previousCardPhotos] = hasShareCardThumbs
    ? [emptyPhotos, emptyPhotos]
    : await Promise.all([
      (isComplete && beforeImagePath && afterImagePath)
        ? resolveTransformationCardEmailPhotos(beforeImagePath, afterImagePath)
        : Promise.resolve(emptyPhotos),
      (isComplete && previousPairDistinct)
        ? resolveTransformationCardEmailPhotos(previousCardBeforePath, previousCardAfterPath, {
          beforeCid: PREV_BEFORE_PHOTO_CID,
          afterCid: PREV_AFTER_PHOTO_CID,
          beforeFile: 'before-previous.jpg',
          afterFile: 'after-previous.jpg',
        })
        : Promise.resolve(emptyPhotos),
    ]);

  const attachments = hasShareCardThumbs
    ? [currentShareCardAtt, previousShareCardAtt].filter(Boolean)
    : [...cardPhotos.attachments, ...previousCardPhotos.attachments].filter(Boolean);

  // HTTPS preview links — New opens current share_card, Previous opens share_card_prev.
  const previewHrefs = {
    current: userId
      ? await repo.getEmailSignedUrl(repo.shareCardStoragePath(userId))
      : (afterImagePath ? await repo.getEmailSignedUrl(afterImagePath) : null),
    previous: (userId && showPreviousShareCard)
      ? await repo.getEmailSignedUrl(repo.previousShareCardStoragePath(userId))
      : (previousCardAfterPath && previousPairDistinct && !shareCardsIdentical
        ? await repo.getEmailSignedUrl(previousCardAfterPath)
        : null),
  };

  const emailParams = {
    memberName,
    otp,
    changedSlots,
    goalType,
    beforeWeight,
    afterWeight,
    durationText,
    beforeUrl: cardPhotos.beforeSrc,
    afterUrl: cardPhotos.afterSrc,
    // Hide previous photo pair in compare when share cards matched (New === old).
    previousBeforeUrl: showPreviousShareCard || (previousPairDistinct && !shareCardsIdentical)
      ? previousCardPhotos.beforeSrc
      : null,
    previousAfterUrl: showPreviousShareCard || (previousPairDistinct && !shareCardsIdentical)
      ? previousCardPhotos.afterSrc
      : null,
    previousBeforeWeight,
    previousAfterWeight,
    previousGoalType,
    previousDurationText,
    previousRecoveredHealthIssues,
    previousCardImageUrl: previousShareCardAtt ? `cid:${PREV_SHARE_CARD_CID}` : null,
    currentCardImageUrl: currentShareCardAtt ? `cid:${SHARE_CARD_CID}` : null,
    previousPreviewHref: previewHrefs.previous,
    currentPreviewHref: previewHrefs.current,
    healthVideoUrl,
    businessVideoUrl,
    recoveredHealthIssues: recoveredHealthIssues ?? [],
    isComplete,
    shareCardSrc: null,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from:    '"Wellness Valley" <easy2work.india@gmail.com>',
    to:      coachEmail,
    subject: buildUnifiedSubmitEmailSubject({ memberName }),
    text:    { content: buildUnifiedSubmitEmailText(emailParams),  charset: 'utf-8' },
    html:    { content: buildUnifiedSubmitEmailHtml(emailParams),  charset: 'utf-8' },
    headers: { 'Content-Language': 'en' },
    ...(attachments.length ? { attachments } : {}),
  });

  logger.info('[testimonials.service] Unified coach email dispatched', {
    coachEmail,
    memberName,
    changedSlots,
    hasShareCards: hasShareCardThumbs,
    attachmentCount: attachments.length,
    hasPreviousCard: showPreviousShareCard,
  });
}

/**
 * Member submits multiple edited slots in one request; generates a single unified OTP.
 *
 * Logic:
 * - Issues-only with no visible before/after card and no video → silent save, no OTP.
 * - Issues-only on a visible photo card (including seeded after clone) or video → unified OTP.
 * - First after-weight change on a seeded clone completes the photo pair and sends OTP.
 * - Any photo/video change on a complete pair → one OTP stored in otp_hash / video_otp_hash.
 * - Photo status is 'pending' when the testimonial is or becomes complete.
 * - Video status is 'pending' when video slots are dirty.
 */
export async function submitAllEdits(rawBody) {
  const payload = validateSubmitAllEdits(rawBody);

  const recipient = requireVerificationRecipient(
    await resolveVerificationRecipient(payload.userId),
    'User has no coach or co-coach assigned. Cannot submit for approval.',
  );
  const userInfo = { coachId: recipient.coachId, userName: recipient.userName };

  const slots       = new Set(payload.dirtySlots);
  const hasPhotoDirty = slots.has('before') || slots.has('after')
    || payload.beforeWeightKg !== undefined || payload.afterWeightKg !== undefined
    || payload.goalType !== undefined || payload.durationText !== undefined;
  const hasVideoDirty  = slots.has('health') || slots.has('business');
  const hasIssuesDirty = slots.has('issues');
  const hasPhotoBytes = Boolean(payload.beforeImageBase64 || payload.afterImageBase64)
    || slots.has('before') || slots.has('after');

  let existing = await repo.findByUserId(payload.userId);

  // Profile-seeded Mine cards often have no DB row (or a video-only stub).
  // Hydrate Left → Before/After clone before OTP so submit is not a silent save.
  if ((hasPhotoDirty || hasIssuesDirty) && shouldHydratePhotosFromProfile(existing)) {
    const hydrated = await hydrateTestimonialPhotosFromProfile({
      userId: payload.userId,
      existing,
      coachId: userInfo.coachId,
    });
    if (hydrated) existing = hydrated;
  }

  // Unified Transformation UI keeps photos as local drafts until Submit.
  // First submit must create the row — never 404 when validation already passed.
  if (!existing) {
    if ((hasPhotoDirty || payload.submitForApproval) && !hasPhotoBytes) {
      throw new ValidationError(
        422,
        'Add before and after photos before submitting for coach approval.',
      );
    }
    existing = await repo.insertVideoOnlyTestimonial({
      userId:  payload.userId,
      coachId: userInfo.coachId,
    });
    logger.info('[testimonials.service] Created testimonial stub for first unified submit', {
      userId: payload.userId,
      testimonialId: existing.id,
      dirtySlots: payload.dirtySlots,
      hasBeforeImage: Boolean(payload.beforeImageBase64),
      hasAfterImage: Boolean(payload.afterImageBase64),
    });
  } else if (
    (hasPhotoDirty || payload.submitForApproval)
    && shouldHydratePhotosFromProfile(existing)
    && !hasPhotoBytes
  ) {
    throw new ValidationError(
      422,
      'Add before and after photos before submitting for coach approval.',
    );
  }
  // When the issues slot is dirty we replace with the exact incoming list so removals are honoured.
  const mergedIssues = hasIssuesDirty
    ? normalizeHealthIssuesList(payload.recoveredHealthIssues)
    : (existing.recovered_health_issues ?? []);

  const issuesOtpChannel = hasIssuesDirty && !hasPhotoDirty && !hasVideoDirty
    ? resolveHealthIssueOtpChannel(existing)
    : null;

  // Issues-only on an incomplete record → silent save, no OTP required
  if (hasIssuesDirty && !hasPhotoDirty && !hasVideoDirty && !issuesOtpChannel) {
    await repo.updateTestimonial(existing.id, {
      recoveredHealthIssues: mergedIssues,
    });
    const display = await enrichTestimonialForDisplay(await repo.findByUserId(payload.userId));
    return {
      httpStatus: 200,
      body: {
        success:    true,
        message:    'Health issues saved.',
        testimonialId: existing.id,
        status:     existing.status,
        videoStatus: existing.video_status ?? 'none',
        otpSent:    false,
        testimonial: display,
      },
    };
  }

  // Upload new photos
  const ts = Date.now();
  const photoUpdates = {};

  if (slots.has('before') && payload.beforeImageBase64) {
    const beforePath = storagePath(payload.userId, 'before', ts);
    await repo.uploadImage(payload.beforeImageBase64, beforePath);
    photoUpdates.beforeImagePath = beforePath;
  }
  if (slots.has('after') && payload.afterImageBase64) {
    const afterPath = storagePath(payload.userId, 'after', ts);
    await repo.uploadImage(payload.afterImageBase64, afterPath);
    photoUpdates.afterImagePath = afterPath;
  }

  if (photoUpdates.beforeImagePath || photoUpdates.afterImagePath) {
    await syncTestimonialPathsToProfileSafe({
      userId: payload.userId,
      beforeImagePath: photoUpdates.beforeImagePath || null,
      afterImagePath: photoUpdates.afterImagePath || null,
    });
  }

  if (payload.beforeWeightKg !== undefined) photoUpdates.beforeWeightKg = payload.beforeWeightKg;
  if (payload.afterWeightKg  !== undefined) photoUpdates.afterWeightKg  = payload.afterWeightKg;
  // First submit may omit goalType if the UI default was never touched — default loss.
  if (payload.goalType !== undefined) {
    photoUpdates.goalType = payload.goalType;
  } else if (repo.isVideoOnlyPlaceholder(existing.before_image_path)) {
    photoUpdates.goalType = 'loss';
  }
  if (payload.durationText !== undefined) {
    photoUpdates.durationText = payload.durationText;
  } else if (repo.isVideoOnlyPlaceholder(existing.before_image_path) && !existing.duration_text) {
    photoUpdates.durationText = '—';
  }
  if (hasIssuesDirty)                       photoUpdates.recoveredHealthIssues = mergedIssues;

  // Determine if testimonial is/becomes complete (distinct after photo, or
  // seeded clone whose after weight now differs from before).
  const newBeforePath = photoUpdates.beforeImagePath ?? existing.before_image_path;
  const newAfterPath  = photoUpdates.afterImagePath  ?? existing.after_image_path;
  const isComplete = isPhotoPairComplete(existing, {
    beforePath: newBeforePath,
    afterPath: newAfterPath,
    beforeWeightKg: photoUpdates.beforeWeightKg ?? existing.before_weight_kg,
    afterWeightKg: photoUpdates.afterWeightKg ?? existing.after_weight_kg,
  });

  // Visible Before+After (including a seeded clone) + Submit for Approval → OTP.
  // Do not wait for a distinct after path or a weight change — that left
  // seeded cards on silent save with no coach email.
  const photoNeedsOtp = (hasPhotoDirty || payload.submitForApproval)
    && shouldSendPhotoApprovalOtp(existing, {
    beforePath: newBeforePath,
    afterPath: newAfterPath,
    beforeWeightKg: photoUpdates.beforeWeightKg ?? existing.before_weight_kg,
    afterWeightKg: photoUpdates.afterWeightKg ?? existing.after_weight_kg,
    status: existing.status,
  });

  // Persist the UI After clone so the pair exists when coach reviews the email.
  if (
    photoNeedsOtp
    && !hasVisibleAfterCard({ after_image_path: newAfterPath })
    && hasRealBeforePhoto({ before_image_path: newBeforePath })
  ) {
    photoUpdates.afterImagePath = newBeforePath;
  }

  // Health issues are optional — empty list is allowed on photo submit.
  const resolvedHealthIssues = mergedIssues;

  // Capture previous photo paths for email diff BEFORE saving
  const prevBeforeImagePath = slots.has('before') ? existing.before_image_path : null;
  const prevAfterImagePath  = slots.has('after')  ? existing.after_image_path  : null;
  const isBeforeFirstUpload = !prevBeforeImagePath || repo.isVideoOnlyPlaceholder(prevBeforeImagePath);
  const isAfterFirstUpload  =
    !prevAfterImagePath
    || repo.isVideoOnlyPlaceholder(prevAfterImagePath)
    || prevAfterImagePath === existing.before_image_path
    || existing.status === 'incomplete';

  const needsOtp = photoNeedsOtp || Boolean(issuesOtpChannel) || hasVideoDirty;

  // Member asked for coach approval — never silent-save with otpSent:false
  // (that surfaces as "Coach approval did not start" in the app).
  if (payload.submitForApproval && !needsOtp) {
    throw new ValidationError(
      422,
      'Add before and after photos on Transformation, then submit for coach approval.',
    );
  }

  if (!needsOtp) {
    if (hasPhotoDirty && !isComplete) {
      photoUpdates.status = 'incomplete';
    }
    await repo.updateTestimonial(existing.id, photoUpdates);
    const saved = await enrichTestimonialForDisplay(await repo.findByUserId(payload.userId));
    return {
      httpStatus: 200,
      body: {
        success: true,
        message: 'Updates saved.',
        testimonialId: existing.id,
        status: photoUpdates.status ?? existing.status,
        videoStatus: existing.video_status ?? 'none',
        otpSent: false,
        testimonial: saved,
      },
    };
  }

  // Generate single unified OTP
  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);

  // Save photo changes
  const photoDbUpdates = { ...photoUpdates, otpHash, otpExpiresAt: otpExpiry };
  if (photoNeedsOtp || issuesOtpChannel === 'photo') {
    photoDbUpdates.status    = 'pending';
    photoDbUpdates.verifiedAt = null;
  } else if (hasPhotoDirty && !isComplete) {
    photoDbUpdates.status = 'incomplete';
  }
  await repo.updateTestimonial(existing.id, photoDbUpdates);

  // Save video changes
  if (hasVideoDirty || issuesOtpChannel === 'video') {
    const videoUpdates = {
      videoStatus:       'pending',
      videoOtpHash:      otpHash,
      videoOtpExpiresAt: otpExpiry,
      videoVerifiedAt:   null,
    };
    if (slots.has('health'))   videoUpdates.healthVideoPath   = payload.healthVideoPath;
    if (slots.has('business')) videoUpdates.businessVideoPath = payload.businessVideoPath;
    await repo.updateTestimonialVideos(existing.id, videoUpdates);
  } else if (!hasPhotoDirty && issuesOtpChannel !== 'photo') {
    // video-only path won't reach here but guard for clarity
    await repo.updateTestimonialVideos(existing.id, { videoOtpHash: otpHash, videoOtpExpiresAt: otpExpiry });
  }

  // Send unified coach email (coach, or co-coach when member has no CoachId)
  const coachInfo = recipient.coachInfo;
  if (coachInfo?.email && userInfo?.userName) {
    const finalBeforePath    = photoUpdates.beforeImagePath   ?? existing.before_image_path;
    const finalAfterPath     = photoUpdates.afterImagePath    ?? existing.after_image_path;
    const finalHealthVideo   = slots.has('health')   ? payload.healthVideoPath   : (existing.health_video_path   ?? null);
    const finalBusinessVideo = slots.has('business') ? payload.businessVideoPath : (existing.business_video_path ?? null);
    const resolvedDuration   = photoUpdates.durationText ?? existing.duration_text;
    const emailChangedSlots  = [...payload.dirtySlots];
    if (
      photoUpdates.durationText !== undefined
      && String(photoUpdates.durationText).trim() !== String(existing.duration_text ?? '').trim()
      && !emailChangedSlots.includes('duration')
    ) {
      emailChangedSlots.push('duration');
    }

    await uploadShareCardImage(payload.userId, payload.shareCardImageBase64, {
      beforeImagePath: finalBeforePath,
      afterImagePath: finalAfterPath,
      beforeImageBase64: payload.beforeImageBase64,
      afterImageBase64: payload.afterImageBase64,
      memberName: userInfo.userName,
      beforeWeightKg: photoUpdates.beforeWeightKg ?? existing.before_weight_kg,
      afterWeightKg: photoUpdates.afterWeightKg ?? existing.after_weight_kg,
      goalType: photoUpdates.goalType ?? existing.goal_type,
      durationText: resolvedDuration,
    });
    await sendUnifiedCoachEmail({
      coachEmail:             coachInfo.email,
      memberName:             userInfo.userName,
      otp,
      changedSlots:           emailChangedSlots,
      goalType:               photoUpdates.goalType    ?? existing.goal_type,
      beforeWeight:           photoUpdates.beforeWeightKg ?? existing.before_weight_kg,
      afterWeight:            photoUpdates.afterWeightKg  ?? existing.after_weight_kg,
      durationText:           resolvedDuration,
      beforeImagePath:        finalBeforePath,
      afterImagePath:         finalAfterPath,
      // Keep previous paths for the Previous Transformation Card (even if first real After).
      previousBeforeImagePath: prevBeforeImagePath,
      previousAfterImagePath:  prevAfterImagePath,
      previousBeforeWeight:    existing.before_weight_kg,
      previousAfterWeight:     existing.after_weight_kg,
      previousGoalType:        existing.goal_type,
      previousDurationText:    existing.duration_text,
      previousRecoveredHealthIssues: existing.recovered_health_issues ?? [],
      healthVideoPath:        finalHealthVideo,
      businessVideoPath:      finalBusinessVideo,
      recoveredHealthIssues:  resolvedHealthIssues,
      isComplete,
      userId:                 payload.userId,
    });
  }

  const finalStatus      = (photoNeedsOtp || issuesOtpChannel === 'photo')
    ? 'pending'
    : (photoDbUpdates.status ?? existing.status);
  const finalVideoStatus = (hasVideoDirty || issuesOtpChannel === 'video')
    ? 'pending'
    : (existing.video_status ?? 'none');
  const display = await enrichTestimonialForDisplay(await repo.findByUserId(payload.userId));
  if (display) {
    display.sponsorName = coachInfo?.name ? String(coachInfo.name).trim() : null;
  }

  return {
    httpStatus: 200,
    body: {
      success:       true,
      message:       'Updates submitted for approval. Your coach will receive a verification email.',
      testimonialId: existing.id,
      status:        finalStatus,
      videoStatus:   finalVideoStatus,
      otpSent:       true,
      testimonial:   display,
      otpExpiresAt:  otpExpiry,
      otpValidityHours: TESTIMONIAL_OTP_VALIDITY_HOURS,
      sponsorName:   coachInfo?.name ? String(coachInfo.name).trim() : null,
    },
  };
}

/**
 * Verify a unified OTP that was generated by submitAllEdits.
 * Marks both photo status and video status as 'verified' where pending.
 */
export async function verifyUnifiedOtp(rawBody) {
  const { userId, otp } = validateVerifyUnifiedOtp(rawBody);

  const row = await repo.findByUserId(userId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (!row.otp_hash) throw new ValidationError(422, 'No pending verification OTP found. Please re-submit your updates.');

  const now     = new Date();
  const istNow  = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const expiry  = new Date(row.otp_expires_at);
  if (istNow > expiry) {
    throw new ValidationError(422, 'OTP has expired. Use Resend OTP to send a new code to your sponsor.');
  }

  const valid = await bcrypt.compare(otp, row.otp_hash);
  if (!valid) throw new ValidationError(422, 'Invalid OTP. Please check with your coach and try again.');

  const verifiedAt = nowUtc();

  // Mark photo as verified if it was pending (or incomplete with a complete pair + OTP)
  const photoPending = row.status === 'pending'
    || (row.status === 'incomplete' && hasCompletePhotoTestimonial(row));
  const videoPending = (row.video_status ?? 'none') === 'pending';

  const photoUpdates = { otpHash: null, otpExpiresAt: null };
  if (photoPending) {
    photoUpdates.status    = 'verified';
    photoUpdates.verifiedAt = verifiedAt;
  }
  await repo.updateTestimonial(row.id, photoUpdates);

  if (videoPending) {
    await repo.updateTestimonialVideos(row.id, {
      videoStatus:       'verified',
      videoOtpHash:      null,
      videoOtpExpiresAt: null,
      videoVerifiedAt:   verifiedAt,
    });
  }

  const verifiedItems = [
    photoPending   && 'photos',
    videoPending   && 'videos',
  ].filter(Boolean).join(' and ');

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: verifiedItems
        ? `Your ${verifiedItems} have been verified successfully.`
        : 'Verification complete.',
    },
  };
}

/**
 * Resend a unified OTP to the sponsor after the previous code expired.
 */
export async function resendUnifiedOtp(rawBody) {
  const { userId } = validateResendUnifiedOtp(rawBody);

  const row = await repo.findByUserId(userId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (!row.otp_hash) {
    throw new ValidationError(422, 'No pending verification OTP found. Please re-submit your updates.');
  }

  if (!isOtpExpired(row.otp_expires_at)) {
    throw new ValidationError(
      422,
      `OTP is still valid. Ask your sponsor for the code, or wait until it expires (${TESTIMONIAL_OTP_VALIDITY_HOURS} hours from send).`,
    );
  }

  const photoPending = row.status === 'pending';
  const videoPending = (row.video_status ?? 'none') === 'pending';
  if (!photoPending && !videoPending) {
    throw new ValidationError(422, 'Nothing is awaiting verification.');
  }

  const recipient = await resolveVerificationRecipient(userId);
  if (!recipient?.coachId) {
    throw new ValidationError(422, 'You do not have a sponsor or co-coach assigned yet.');
  }
  const userInfo = { coachId: recipient.coachId, userName: recipient.userName };
  const coachInfo = recipient.coachInfo;
  if (!coachInfo?.email) {
    throw new ValidationError(422, 'Sponsor email is not available. Please contact support.');
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(TESTIMONIAL_OTP_VALIDITY_HOURS);

  await repo.updateTestimonial(row.id, {
    otpHash,
    otpExpiresAt: otpExpiry,
  });
  if (videoPending || row.video_otp_hash) {
    await repo.updateTestimonialVideos(row.id, {
      videoOtpHash: otpHash,
      videoOtpExpiresAt: otpExpiry,
    });
  }

  const isComplete = hasCompletePhotoTestimonial({
    ...row,
    before_image_path: row.before_image_path,
    after_image_path: row.after_image_path,
    status: row.status,
  });

  await sendUnifiedCoachEmail({
    coachEmail: coachInfo.email,
    memberName: userInfo.userName,
    otp,
    changedSlots: [],
    goalType: row.goal_type,
    beforeWeight: row.before_weight_kg,
    afterWeight: row.after_weight_kg,
    durationText: row.duration_text,
    beforeImagePath: row.before_image_path,
    afterImagePath: row.after_image_path,
    previousBeforeImagePath: null,
    previousAfterImagePath: null,
    healthVideoPath: row.health_video_path,
    businessVideoPath: row.business_video_path,
    recoveredHealthIssues: row.recovered_health_issues ?? [],
    isComplete,
    userId,
  });

  const display = await enrichTestimonialForDisplay(await repo.findByUserId(userId));
  if (display) {
    display.sponsorName = coachInfo.name ? String(coachInfo.name).trim() : null;
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `A new OTP was sent to your sponsor${coachInfo.name ? ` (${coachInfo.name})` : ''}. It is valid for ${TESTIMONIAL_OTP_VALIDITY_HOURS} hours.`,
      otpExpiresAt: otpExpiry,
      otpValidityHours: TESTIMONIAL_OTP_VALIDITY_HOURS,
      sponsorName: coachInfo.name ? String(coachInfo.name).trim() : null,
      testimonial: display,
    },
  };
}

/**
 * Coach updates a reporting member's recovered health issues (no OTP).
 * Downline / shared-team only — never an upline ancestor.
 */
export async function updateMemberHealthIssues(rawBody) {
  const payload = validateUpdateMemberHealthIssues(rawBody);

  const allowed = await repo.isEditableReportingMember(payload.coachId, payload.userId);
  if (!allowed) {
    throw new ValidationError(403, 'You can only update health issues for your team members, not your upline');
  }

  const existing = await repo.findByUserId(payload.userId);
  if (!existing) {
    throw new ValidationError(404, 'No testimonial found for this user');
  }

  const mergedIssues = normalizeHealthIssuesList(payload.recoveredHealthIssues);

  await repo.updateTestimonial(existing.id, {
    recoveredHealthIssues: mergedIssues,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Health issue updated.',
      recoveredHealthIssues: mergedIssues,
    },
  };
}
