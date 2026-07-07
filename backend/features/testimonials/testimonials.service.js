/**
 * testimonials.service.js â€” Business logic for the testimonials feature.
 * Orchestrates validation â†’ permissions â†’ data â†’ side-effects (email).
 * Zero HTTP concerns.
 */
import bcrypt from 'bcryptjs';
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
} from './testimonials.validators.js';
import { getISTTimestamp } from '../../utils/supabaseClient.js';
import {
  buildTestimonialCoachEmailHtml,
  buildTestimonialCoachEmailText,
  buildTestimonialCoachEmailSubject,
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

async function sendCoachEmail({ coachEmail, memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeImagePath, afterImagePath }) {
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
    beforeImagePath: beforePath,
    beforeWeightKg:  payload.beforeWeightKg,
    goalType:        payload.goalType,
    durationText:    payload.durationText,
    status:          newStatus,
    otpHash,
    otpExpiresAt:    otpExpiry,
    verifiedAt:      null,
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

  const verifiedAt = getISTTimestamp();
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
  if (payload.beforeWeightKg !== undefined) updates.beforeWeightKg = payload.beforeWeightKg;
  if (payload.afterWeightKg  !== undefined) updates.afterWeightKg  = payload.afterWeightKg;
  if (payload.goalType       !== undefined) updates.goalType       = payload.goalType;
  if (payload.durationText   !== undefined) updates.durationText   = payload.durationText;

  // Determine if after photo is now present (either just uploaded or already stored)
  const afterPathNow = updates.afterImagePath ?? existing.after_image_path;
  // Only treat as "has after" if it's a real after path (not the before-placeholder used for incomplete)
  const afterWeightNow = updates.afterWeightKg ?? existing.after_weight_kg;
  const isNowComplete  = !!(updates.afterImagePath) || existing.status !== 'incomplete';

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

  // Still incomplete â€” just save changes, no email
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
 * Fetch a member's own testimonial with signed image URLs.
 */
export async function getMyTestimonial(rawQuery) {
  const { userId } = validateMyTestimonial(rawQuery);
  const row = await repo.findByUserId(userId);
  if (!row) {
    return { httpStatus: 200, body: { success: true, data: null } };
  }

  const [beforeUrl, afterUrl] = await Promise.all([
    repo.getSignedUrl(row.before_image_path),
    repo.getSignedUrl(row.after_image_path),
  ]);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        id:              row.id,
        beforeWeightKg:  row.before_weight_kg,
        afterWeightKg:   row.after_weight_kg,
        goalType:        row.goal_type,
        durationText:    row.duration_text,
        status:          row.status,
        verifiedAt:      row.verified_at,
        createdAt:       row.created_at,
        updatedAt:       row.updated_at,
        beforeImageUrl:  beforeUrl,
        afterImageUrl:   afterUrl,
      },
    },
  };
}

/**
 * List direct-downline testimonials for a coach.
 * Members with no testimonial are included (testimonial = null â†’ red in UI).
 */
export async function listForCoach(rawQuery) {
  const { coachId } = validateListForCoach(rawQuery);
  const rows = await repo.listForCoach(coachId);

  // Generate signed URLs in parallel for members who have testimonials
  const enriched = await Promise.all(
    rows.map(async ({ user, testimonial }) => {
      if (!testimonial) {
        return { user: sanitizeUser(user), testimonial: null };
      }
      const [beforeUrl, afterUrl] = await Promise.all([
        repo.getSignedUrl(testimonial.before_image_path),
        repo.getSignedUrl(testimonial.after_image_path),
      ]);
      return {
        user: sanitizeUser(user),
        testimonial: {
          id:              testimonial.id,
          beforeWeightKg:  testimonial.before_weight_kg,
          afterWeightKg:   testimonial.after_weight_kg,
          goalType:        testimonial.goal_type,
          durationText:    testimonial.duration_text,
          status:          testimonial.status,
          verifiedAt:      testimonial.verified_at,
          createdAt:       testimonial.created_at,
          updatedAt:       testimonial.updated_at,
          beforeImageUrl:  beforeUrl,
          afterImageUrl:   afterUrl,
        },
      };
    }),
  );

  return {
    httpStatus: 200,
    body: { success: true, data: enriched },
  };
}

function sanitizeUser(user) {
  return {
    userId:       user.UserId,
    userName:     user.UserName,
    profileImage: user.ProfileImage ?? null,
  };
}
