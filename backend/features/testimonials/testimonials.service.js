/**
 * testimonials.service.js — Business logic for the testimonials feature.
 * Orchestrates validation → permissions → data → side-effects (email).
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

// ─── OTP helpers ──────────────────────────────────────────────────────────────

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

// ─── Email ────────────────────────────────────────────────────────────────────

function buildTestimonialEmailHtml({ memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeUrl, afterUrl }) {
  const goalLabel = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  const weightDiff = Math.abs(afterWeight - beforeWeight).toFixed(1);
  const arrow      = goalType === 'loss' ? '↓' : '↑';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Testimonial Verification — Wellness Valley</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 36px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; font-weight: 700; }
    .header p  { color: #d1fae5; margin: 6px 0 0; font-size: 15px; }
    .body { padding: 40px 32px; }
    .subtitle { color: #374151; font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    .intro { color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 28px; }
    .stats-grid { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat-box { flex: 1; min-width: 120px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-label { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
    .stat-value { color: #047857; font-size: 20px; font-weight: 700; margin-top: 4px; }
    .photos { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .photo-box { flex: 1; min-width: 120px; text-align: center; }
    .photo-box img { width: 100%; max-width: 220px; border-radius: 10px; border: 2px solid #e5e7eb; }
    .photo-label { color: #6b7280; font-size: 12px; font-weight: 600; margin-top: 6px; }
    .otp-section { background: #f0fdf4; border: 2px dashed #6ee7b7; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px; }
    .otp-label { color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .otp-code  { font-size: 40px; font-weight: 700; color: #047857; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 10px 0 0; }
    .otp-expiry { color: #9ca3af; font-size: 13px; margin-top: 8px; }
    .instructions { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 18px 20px; color: #92400e; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 32px; text-align: center; color: #6b7280; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌿 Wellness Valley</h1>
    <p>Member Testimonial — Verification Required</p>
  </div>
  <div class="body">
    <p class="subtitle">Your member has submitted a testimonial!</p>
    <p class="intro">
      <strong>${memberName}</strong> has completed their ${goalLabel.toLowerCase()} journey and submitted a before &amp; after testimonial.
      Please review the details below and enter the OTP in your app to verify it.
    </p>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Before</div>
        <div class="stat-value">${beforeWeight} kg</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">After</div>
        <div class="stat-value">${afterWeight} kg</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Change ${arrow}</div>
        <div class="stat-value">${weightDiff} kg</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Duration</div>
        <div class="stat-value" style="font-size:15px;">${durationText}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Goal</div>
        <div class="stat-value" style="font-size:15px;">${goalLabel}</div>
      </div>
    </div>
    ${beforeUrl && afterUrl ? `
    <div class="photos">
      <div class="photo-box">
        <img src="${beforeUrl}" alt="Before photo" />
        <div class="photo-label">BEFORE</div>
      </div>
      <div class="photo-box">
        <img src="${afterUrl}" alt="After photo" />
        <div class="photo-label">AFTER</div>
      </div>
    </div>` : ''}
    <div class="otp-section">
      <div class="otp-label">Verification OTP</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">⏰ Valid for 24 hours</div>
    </div>
    <div class="instructions">
      <strong>How to verify:</strong><br>
      1. Open the Wellness Valley app<br>
      2. Tap the <strong>Results</strong> tab in the navigation bar<br>
      3. Find <strong>${memberName}</strong> in your team list<br>
      4. Tap <strong>Verify Testimonial</strong> and enter the 6-digit OTP above
    </div>
  </div>
  <div class="footer">
    <strong>Wellness Valley Team</strong><br>
    This is an automated message. Please do not reply to this email.<br>
    Questions? Contact us at easy2work.india@gmail.com
  </div>
</div>
</body>
</html>`;
}

async function sendCoachEmail({ coachEmail, coachName, memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeImagePath, afterImagePath }) {
  const [beforeUrl, afterUrl] = await Promise.all([
    repo.getEmailSignedUrl(beforeImagePath),
    repo.getEmailSignedUrl(afterImagePath),
  ]);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from:    '"Wellness Valley" <easy2work.india@gmail.com>',
    to:      coachEmail,
    subject: `🏆 Testimonial Submitted by ${memberName} — Verify Now`,
    html:    buildTestimonialEmailHtml({ memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeUrl, afterUrl }),
  });

  logger.info('[testimonials.service] Coach email dispatched', { coachEmail, memberName });
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Submit a new testimonial (or replace an existing one) for a member.
 */
export async function submitTestimonial(rawBody) {
  const payload = validateSubmitTestimonial(rawBody);

  logger.info('[testimonials] submit', { userId: payload.userId });

  // Resolve coach
  const userInfo = await repo.findCoachIdForUser(payload.userId);
  if (!userInfo || !userInfo.coachId) {
    throw new ValidationError(400, 'User has no coach assigned. Cannot submit testimonial.');
  }

  const coachInfo = await repo.findCoachEmail(userInfo.coachId);
  if (!coachInfo || !coachInfo.email) {
    throw new ValidationError(400, 'Coach email not found. Cannot send verification email.');
  }

  const ts = Date.now();
  const beforePath = storagePath(payload.userId, 'before', ts);
  const afterPath  = storagePath(payload.userId, 'after', ts);

  // Upload images
  await repo.uploadImage(payload.beforeImageBase64, beforePath);
  await repo.uploadImage(payload.afterImageBase64, afterPath);

  // Generate OTP
  const otp      = generateOtp();
  const otpHash  = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(24);

  // Soft-delete any existing testimonial so the new one is canonical
  const existing = await repo.findByUserId(payload.userId);

  let row;
  if (existing) {
    row = await repo.updateTestimonial(existing.id, {
      beforeImagePath: beforePath,
      afterImagePath:  afterPath,
      beforeWeightKg:  payload.beforeWeightKg,
      afterWeightKg:   payload.afterWeightKg,
      goalType:        payload.goalType,
      durationText:    payload.durationText,
      status:          'pending',
      otpHash,
      otpExpiresAt:    otpExpiry,
      verifiedAt:      null,
    });
  } else {
    row = await repo.insertTestimonial({
      userId:          payload.userId,
      coachId:         userInfo.coachId,
      beforeImagePath: beforePath,
      afterImagePath:  afterPath,
      beforeWeightKg:  payload.beforeWeightKg,
      afterWeightKg:   payload.afterWeightKg,
      goalType:        payload.goalType,
      durationText:    payload.durationText,
      otpHash,
      otpExpiresAt:    otpExpiry,
    });
  }

  // Send verification email to coach
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

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Testimonial submitted. A verification email has been sent to your coach.',
      testimonialId: row.id,
    },
  };
}

/**
 * Coach verifies the testimonial using the emailed OTP.
 */
export async function verifyOtp(rawBody) {
  const { testimonialId, otp } = validateVerifyOtp(rawBody);

  const row = await repo.findById(testimonialId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (row.status === 'verified') throw new ValidationError(409, 'This testimonial is already verified');

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
 * Member edits their testimonial — resets to pending and re-emails coach.
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

  // Always reset to pending and issue a new OTP
  const otp       = generateOtp();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpiry = otpExpiryIst(24);
  updates.status      = 'pending';
  updates.otpHash     = otpHash;
  updates.otpExpiresAt = otpExpiry;
  updates.verifiedAt  = null;

  await repo.updateTestimonial(existing.id, updates);

  // Re-email coach with new OTP
  if (coachInfo?.email && userInfo?.userName) {
    const currentBeforePath = updates.beforeImagePath ?? existing.before_image_path;
    const currentAfterPath  = updates.afterImagePath  ?? existing.after_image_path;
    await sendCoachEmail({
      coachEmail:    coachInfo.email,
      coachName:     coachInfo.name,
      memberName:    userInfo.userName,
      goalType:      updates.goalType     ?? existing.goal_type,
      beforeWeight:  updates.beforeWeightKg ?? existing.before_weight_kg,
      afterWeight:   updates.afterWeightKg  ?? existing.after_weight_kg,
      durationText:  updates.durationText ?? existing.duration_text,
      otp,
      beforeImagePath: currentBeforePath,
      afterImagePath:  currentAfterPath,
    });
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Testimonial updated. A new verification email has been sent to your coach.',
      testimonialId: existing.id,
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
 * Members with no testimonial are included (testimonial = null → red in UI).
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
