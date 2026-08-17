/**
 * testimonials.service.js â€” Business logic for the testimonials feature.
 * Orchestrates validation â†’ permissions â†’ data â†’ side-effects (email).
 * Zero HTTP concerns.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import * as repo from './testimonials.repository.js';
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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryIst(hoursFromNow = 24) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + hoursFromNow * 60 * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

function storagePath(userId, side, timestamp) {
  return `${userId}/${side}_${timestamp}.jpg`;
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
 * Merge incoming health issues into the existing list (case-insensitive).
 * Prevents a client sending only the newly selected issue from wiping prior issues.
 */
function unionHealthIssues(existingList, incomingList) {
  const seen = new Set();
  const result = [];
  for (const item of [...(Array.isArray(existingList) ? existingList : []), ...(Array.isArray(incomingList) ? incomingList : [])]) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/** Extract millis timestamp embedded in storage paths like `42/before_1720000000000.jpg`. */
function parseStoragePathTimestamp(path) {
  if (!path || typeof path !== 'string') return 0;
  const match = path.match(/_(\d{10,13})\./);
  return match ? Number(match[1]) : 0;
}

/** Member submitted a complete before/after photo testimonial (pending or verified). */
function hasCompletePhotoTestimonial(row) {
  if (repo.isVideoOnlyPlaceholder(row.before_image_path)) return false;
  if (row.status === 'incomplete') return false;
  const afterPath = row.after_image_path;
  if (!afterPath || afterPath === row.before_image_path) return false;
  return !repo.isVideoOnlyPlaceholder(afterPath);
}

function hasVideoTestimonial(row) {
  return !!(row.health_video_path || row.business_video_path);
}

/**
 * Health issues are shared across photo + video flows.
 * When they change, OTP email should attach the member's latest submitted entry.
 */
function resolveHealthIssueOtpChannel(row) {
  const hasPhoto = hasCompletePhotoTestimonial(row);
  const hasVideo = hasVideoTestimonial(row);
  if (!hasPhoto && !hasVideo) return null;
  if (hasPhoto && !hasVideo) return 'photo';
  if (!hasPhoto && hasVideo) return 'video';

  const photoTs = Math.max(
    parseStoragePathTimestamp(row.before_image_path),
    parseStoragePathTimestamp(row.after_image_path),
  );
  const videoTs = Math.max(
    Date.parse(row.video_verified_at || '') || 0,
    Date.parse(row.updated_at || '') || 0,
  );
  return photoTs >= videoTs ? 'photo' : 'video';
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
  const otpExpiry = otpExpiryIst(24);

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
    videoOnly ? Promise.resolve(null) : repo.getSignedUrl(testimonial.before_image_path),
    videoOnly ? Promise.resolve(null) : repo.getSignedUrl(testimonial.after_image_path),
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
  };
}

async function sendCoachEmail({ coachEmail, memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeImagePath, afterImagePath, recoveredHealthIssues }) {
  const [beforeUrl, afterUrl] = await Promise.all([
    repo.getEmailSignedUrl(beforeImagePath),
    repo.getEmailSignedUrl(afterImagePath),
  ]);

  const emailParams = {
    memberName,
    goalType,
    beforeWeight,
    afterWeight,
    durationText,
    otp,
    beforeUrl,
    afterUrl,
    recoveredHealthIssues: recoveredHealthIssues ?? [],
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
  });

  logger.info('[testimonials.service] Coach email dispatched', { coachEmail, memberName });
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

  const userInfo = await repo.findCoachIdForUser(payload.userId);
  if (!userInfo || !userInfo.coachId) {
    throw new ValidationError(400, 'User has no coach assigned. Cannot submit testimonial.');
  }

  const ts = Date.now();
  const beforePath = storagePath(payload.userId, 'before', ts);

  await repo.uploadImage(payload.beforeImageBase64, beforePath);

  let afterPath = null;
  if (payload.hasAfter) {
    afterPath = storagePath(payload.userId, 'after', ts);
    await repo.uploadImage(payload.afterImageBase64, afterPath);
  }

  // Generate OTP only when after photo is present (complete submission)
  let otpHash = null;
  let otpExpiry = null;
  let otp = null;
  if (payload.hasAfter) {
    otp       = generateOtp();
    otpHash   = await bcrypt.hash(otp, 10);
    otpExpiry = otpExpiryIst(24);
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

  // Only email coach when the testimonial is complete
  if (payload.hasAfter) {
    const coachInfo = await repo.findCoachEmail(userInfo.coachId);
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

  const userInfo  = await repo.findCoachIdForUser(payload.userId);
  const coachInfo = userInfo?.coachId ? await repo.findCoachEmail(userInfo.coachId) : null;

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
  if (payload.beforeWeightKg       !== undefined) updates.beforeWeightKg      = payload.beforeWeightKg;
  if (payload.afterWeightKg        !== undefined) updates.afterWeightKg       = payload.afterWeightKg;
  if (payload.goalType             !== undefined) updates.goalType            = payload.goalType;
  if (payload.durationText         !== undefined) updates.durationText        = payload.durationText;
  if (payload.recoveredHealthIssues !== undefined) {
    updates.recoveredHealthIssues = unionHealthIssues(
      existing.recovered_health_issues,
      payload.recoveredHealthIssues,
    );
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

  if (isNowComplete && resolvedHealthIssues.length === 0) {
    throw new ValidationError(422, 'At least one recovered health issue is required');
  }

  if (isNowComplete) {
    // Full testimonial â€” reset to pending and issue new OTP
    const otp       = generateOtp();
    const otpHash   = await bcrypt.hash(otp, 10);
    const otpExpiry = otpExpiryIst(24);
    updates.status       = 'pending';
    updates.otpHash      = otpHash;
    updates.otpExpiresAt = otpExpiry;
    updates.verifiedAt   = null;

    await repo.updateTestimonial(existing.id, updates);

    if (coachInfo?.email && userInfo?.userName) {
      const currentBeforePath = updates.beforeImagePath ?? existing.before_image_path;
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
        lean.beforeImagePath ? repo.getSignedUrl(lean.beforeImagePath) : null,
        lean.afterImagePath ? repo.getSignedUrl(lean.afterImagePath) : null,
      ]);
      if (lean.beforeImagePath) queryCount += 1;
      if (lean.afterImagePath) queryCount += 1;

      // Shape matches existing MemberCard contract; thumbs stand in for list display.
      const testimonial = lean.testimonialId == null && !lean.healthVideoPath && !lean.businessVideoPath
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
  const row = await repo.findByUserId(userId);
  const sqlMs = Date.now() - sqlStarted;

  // Optional coach-tree gate when coachId provided (hierarchy only — no SELECT *)
  if (coachId != null && coachId !== userId) {
    const allowed = await repo.isReportingMember(coachId, userId, 'full');
    if (!allowed) {
      throw new ValidationError(403, 'Member is not in your team hierarchy');
    }
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
  const userInfo = await repo.findCoachIdForUser(userId);
  if (!userInfo || !userInfo.coachId) {
    throw new ValidationError(400, 'User has no coach assigned. Cannot submit video testimonial.');
  }

  let existing = await repo.findByUserId(userId);
  if (!existing) {
    existing = await repo.insertVideoOnlyTestimonial({
      userId,
      coachId: userInfo.coachId,
    });
    logger.info('[testimonials] Created video-only testimonial stub', { userId });
  }

  return { existing, userInfo };
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
    await repo.uploadBuffer(payload.finalPath, buffer, 'video/mp4');
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
  await repo.uploadBuffer(payload.finalPath, assembled, 'video/mp4');
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

  const { existing, userInfo } = await assertVideoUploadEligible(payload.userId);

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

  const resolvedHealthIssues = payload.recoveredHealthIssues !== undefined
    ? unionHealthIssues(existing.recovered_health_issues, payload.recoveredHealthIssues)
    : (existing.recovered_health_issues ?? []);

  if (resolvedHealthIssues.length === 0) {
    throw new ValidationError(422, 'At least one recovered health issue is required before uploading videos for verification.');
  }

  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(24);

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

  const coachInfo = await repo.findCoachEmail(userInfo.coachId);
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
  healthVideoPath,
  businessVideoPath,
  recoveredHealthIssues,
  isComplete,
}) {
  const slots = new Set(changedSlots);

  const [beforeUrl, afterUrl, prevBeforeUrl, prevAfterUrl, healthVideoUrl, businessVideoUrl] =
    await Promise.all([
      (isComplete && beforeImagePath && slots.has('before')) ? repo.getEmailSignedUrl(beforeImagePath)         : Promise.resolve(null),
      (isComplete && afterImagePath  && slots.has('after'))  ? repo.getEmailSignedUrl(afterImagePath)          : Promise.resolve(null),
      (slots.has('before') && previousBeforeImagePath)       ? repo.getEmailSignedUrl(previousBeforeImagePath) : Promise.resolve(null),
      (slots.has('after')  && previousAfterImagePath)        ? repo.getEmailSignedUrl(previousAfterImagePath)  : Promise.resolve(null),
      (slots.has('health') && healthVideoPath)               ? repo.getEmailSignedUrl(healthVideoPath)         : Promise.resolve(null),
      (slots.has('business') && businessVideoPath)           ? repo.getEmailSignedUrl(businessVideoPath)       : Promise.resolve(null),
    ]);

  const emailParams = {
    memberName,
    otp,
    changedSlots,
    goalType,
    beforeWeight,
    afterWeight,
    durationText,
    beforeUrl,
    afterUrl,
    previousBeforeUrl: prevBeforeUrl,
    previousAfterUrl:  prevAfterUrl,
    healthVideoUrl,
    businessVideoUrl,
    recoveredHealthIssues: recoveredHealthIssues ?? [],
    isComplete,
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
  });

  logger.info('[testimonials.service] Unified coach email dispatched', { coachEmail, memberName, changedSlots });
}

/**
 * Member submits multiple edited slots in one request; generates a single unified OTP.
 *
 * Logic:
 * - Issues-only on an incomplete testimonial → silent save, no OTP, no email.
 * - Issues-only on a complete photo/video testimonial → unified OTP (same as other slots).
 * - Any photo/video change → one OTP stored in both otp_hash and video_otp_hash fields.
 * - Photo status is set to 'pending' only when the testimonial is or becomes complete (has both photos).
 * - Video status is set to 'pending' when video slots are dirty.
 * - Always overwrites otp_hash with the new unified OTP (so verifyUnifiedOtp can work).
 */
export async function submitAllEdits(rawBody) {
  const payload = validateSubmitAllEdits(rawBody);

  const existing = await repo.findByUserId(payload.userId);
  if (!existing) {
    throw new ValidationError(404, 'No testimonial found. Please submit your before photo first.');
  }

  const userInfo = await repo.findCoachIdForUser(payload.userId);
  if (!userInfo?.coachId) {
    throw new ValidationError(400, 'User has no coach assigned. Cannot submit for approval.');
  }

  const slots       = new Set(payload.dirtySlots);
  const hasPhotoDirty = slots.has('before') || slots.has('after')
    || payload.beforeWeightKg !== undefined || payload.afterWeightKg !== undefined
    || payload.goalType !== undefined || payload.durationText !== undefined;
  const hasVideoDirty  = slots.has('health') || slots.has('business');
  const hasIssuesDirty = slots.has('issues');
  const mergedIssues = hasIssuesDirty
    ? unionHealthIssues(existing.recovered_health_issues, payload.recoveredHealthIssues)
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
  if (payload.beforeWeightKg !== undefined) photoUpdates.beforeWeightKg = payload.beforeWeightKg;
  if (payload.afterWeightKg  !== undefined) photoUpdates.afterWeightKg  = payload.afterWeightKg;
  if (payload.goalType       !== undefined) photoUpdates.goalType        = payload.goalType;
  if (payload.durationText   !== undefined) photoUpdates.durationText    = payload.durationText;
  if (hasIssuesDirty)                       photoUpdates.recoveredHealthIssues = mergedIssues;

  // Determine if testimonial is/becomes complete (has both real photos)
  const newBeforePath = photoUpdates.beforeImagePath ?? existing.before_image_path;
  const newAfterPath  = photoUpdates.afterImagePath  ?? existing.after_image_path;
  const hasRealBefore = newBeforePath && !repo.isVideoOnlyPlaceholder(newBeforePath);
  const hasRealAfter  = newAfterPath
    && !repo.isVideoOnlyPlaceholder(newAfterPath)
    && newAfterPath !== existing.before_image_path
    && newAfterPath !== newBeforePath;
  const isComplete = !!(hasRealBefore && hasRealAfter);

  // Guard: if photos still incomplete after update, no OTP needed for photo changes
  const photoNeedsOtp = hasPhotoDirty && isComplete;

  // Validate health issues are present when completing a testimonial
  const resolvedHealthIssues = mergedIssues;

  if (photoNeedsOtp && resolvedHealthIssues.length === 0) {
    throw new ValidationError(422, 'At least one recovered health issue is required.');
  }

  // Capture previous photo paths for email diff BEFORE saving
  const prevBeforeImagePath = slots.has('before') ? existing.before_image_path : null;
  const prevAfterImagePath  = slots.has('after')  ? existing.after_image_path  : null;
  const isBeforeFirstUpload = !prevBeforeImagePath || repo.isVideoOnlyPlaceholder(prevBeforeImagePath);
  const isAfterFirstUpload  =
    !prevAfterImagePath
    || repo.isVideoOnlyPlaceholder(prevAfterImagePath)
    || prevAfterImagePath === existing.before_image_path
    || existing.status === 'incomplete';

  // Generate single unified OTP
  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(24);

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

  // Send unified coach email
  const coachInfo = await repo.findCoachEmail(userInfo.coachId);
  if (coachInfo?.email && userInfo?.userName) {
    const finalBeforePath    = photoUpdates.beforeImagePath   ?? existing.before_image_path;
    const finalAfterPath     = photoUpdates.afterImagePath    ?? existing.after_image_path;
    const finalHealthVideo   = slots.has('health')   ? payload.healthVideoPath   : (existing.health_video_path   ?? null);
    const finalBusinessVideo = slots.has('business') ? payload.businessVideoPath : (existing.business_video_path ?? null);

    await sendUnifiedCoachEmail({
      coachEmail:             coachInfo.email,
      memberName:             userInfo.userName,
      otp,
      changedSlots:           payload.dirtySlots,
      goalType:               photoUpdates.goalType    ?? existing.goal_type,
      beforeWeight:           photoUpdates.beforeWeightKg ?? existing.before_weight_kg,
      afterWeight:            photoUpdates.afterWeightKg  ?? existing.after_weight_kg,
      durationText:           photoUpdates.durationText   ?? existing.duration_text,
      beforeImagePath:        finalBeforePath,
      afterImagePath:         finalAfterPath,
      previousBeforeImagePath: isBeforeFirstUpload ? null : prevBeforeImagePath,
      previousAfterImagePath:  isAfterFirstUpload  ? null : prevAfterImagePath,
      healthVideoPath:        finalHealthVideo,
      businessVideoPath:      finalBusinessVideo,
      recoveredHealthIssues:  resolvedHealthIssues,
      isComplete,
    });
  }

  const finalStatus      = (photoNeedsOtp || issuesOtpChannel === 'photo')
    ? 'pending'
    : (photoDbUpdates.status ?? existing.status);
  const finalVideoStatus = (hasVideoDirty || issuesOtpChannel === 'video')
    ? 'pending'
    : (existing.video_status ?? 'none');
  const display = await enrichTestimonialForDisplay(await repo.findByUserId(payload.userId));

  return {
    httpStatus: 200,
    body: {
      success:       true,
      message:       'Updates submitted for approval. Your coach will receive a verification email.',
      testimonialId: existing.id,
      status:        finalStatus,
      videoStatus:   finalVideoStatus,
      testimonial:   display,
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
    throw new ValidationError(422, 'OTP has expired. Please re-submit your updates to receive a new OTP.');
  }

  const valid = await bcrypt.compare(otp, row.otp_hash);
  if (!valid) throw new ValidationError(422, 'Invalid OTP. Please check with your coach and try again.');

  const verifiedAt = nowUtc();

  // Mark photo as verified if it was pending
  const photoPending = row.status === 'pending';
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
 * Coach updates a reporting member's recovered health issues (no OTP).
 */
export async function updateMemberHealthIssues(rawBody) {
  const payload = validateUpdateMemberHealthIssues(rawBody);

  const allowed = await repo.isReportingMember(payload.coachId, payload.userId, 'full');
  if (!allowed) {
    throw new ValidationError(403, 'Member is not in your team hierarchy');
  }

  const existing = await repo.findByUserId(payload.userId);
  if (!existing) {
    throw new ValidationError(404, 'No testimonial found for this user');
  }

  const mergedIssues = unionHealthIssues(
    existing.recovered_health_issues,
    payload.recoveredHealthIssues,
  );

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
