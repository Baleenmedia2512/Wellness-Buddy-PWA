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

// â”€â”€â”€ Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildTestimonialEmailHtml({ memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeUrl, afterUrl }) {
  const goalLabel  = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  const weightDiff = Math.abs(afterWeight - beforeWeight).toFixed(1);
  const arrow      = goalType === 'loss' ? 'â†“' : 'â†‘';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Testimonial Verification â€” Wellness Valley</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,table,td,p,a,li { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
    body { margin:0; padding:0; background:#f3f4f6; }
    @media only screen and (max-width:600px) {
      .wrapper   { width:100% !important; }
      .stat-row td { display:block !important; width:50% !important; float:left; box-sizing:border-box; }
      .photo-td  { display:block !important; width:100% !important; padding-bottom:12px !important; }
      .body-pad  { padding:24px 16px !important; }
      .otp-code  { font-size:36px !important; letter-spacing:6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:20px 10px;">

    <!-- Wrapper -->
    <table class="wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px 24px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:26px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">ðŸŒ¿ Wellness Valley</p>
          <p style="margin:8px 0 0;color:#d1fae5;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Member Testimonial â€” Verification Required</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td class="body-pad" style="padding:32px 28px;">

          <!-- Intro -->
          <p style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your member has submitted a testimonial!</p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <strong style="color:#111827;">${memberName}</strong> has completed their ${goalLabel.toLowerCase()} journey.
            Review the details below, then share the OTP with your member to verify.
          </p>

          <!-- Stats â€” 2-column table, wraps on mobile -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr class="stat-row">
              <td width="33%" style="padding:0 6px 10px 0;vertical-align:top;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">Before</p>
                    <p style="margin:4px 0 0;color:#047857;font-size:20px;font-weight:700;font-family:sans-serif;">${beforeWeight} kg</p>
                  </td></tr>
                </table>
              </td>
              <td width="33%" style="padding:0 6px 10px;vertical-align:top;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">After</p>
                    <p style="margin:4px 0 0;color:#047857;font-size:20px;font-weight:700;font-family:sans-serif;">${afterWeight} kg</p>
                  </td></tr>
                </table>
              </td>
              <td width="33%" style="padding:0 0 10px 6px;vertical-align:top;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">Change ${arrow}</p>
                    <p style="margin:4px 0 0;color:#047857;font-size:20px;font-weight:700;font-family:sans-serif;">${weightDiff} kg</p>
                  </td></tr>
                </table>
              </td>
            </tr>
            <tr class="stat-row">
              <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">Duration</p>
                    <p style="margin:4px 0 0;color:#047857;font-size:15px;font-weight:700;font-family:sans-serif;">${durationText}</p>
                  </td></tr>
                </table>
              </td>
              <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">Goal</p>
                    <p style="margin:4px 0 0;color:#047857;font-size:15px;font-weight:700;font-family:sans-serif;">${goalLabel}</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>

          ${beforeUrl && afterUrl ? `
          <!-- Photos -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr>
              <td class="photo-td" width="50%" style="padding-right:8px;vertical-align:top;text-align:center;">
                <img src="${beforeUrl}" alt="Before" width="240" style="width:100%;max-width:240px;border-radius:10px;border:2px solid #e5e7eb;" />
                <p style="margin:6px 0 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">BEFORE</p>
              </td>
              <td class="photo-td" width="50%" style="padding-left:8px;vertical-align:top;text-align:center;">
                <img src="${afterUrl}" alt="After" width="240" style="width:100%;max-width:240px;border-radius:10px;border:2px solid #e5e7eb;" />
                <p style="margin:6px 0 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:sans-serif;">AFTER</p>
              </td>
            </tr>
          </table>` : ''}

          <!-- OTP box -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
            <tr>
              <td style="background:#f0fdf4;border:2px dashed #6ee7b7;border-radius:12px;padding:28px 20px;text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:sans-serif;">Verification OTP</p>
                <p class="otp-code" style="margin:10px 0 0;color:#047857;font-size:44px;font-weight:700;letter-spacing:10px;font-family:'Courier New',Courier,monospace;">${otp}</p>
                <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;font-family:sans-serif;">â° Valid for 24 hours</p>
              </td>
            </tr>
          </table>

          <!-- Instructions -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:18px 20px;color:#92400e;font-size:14px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <strong>How to verify your member:</strong><br>
                1. Review the before &amp; after photos above<br>
                2. If you approve, <strong>share the OTP</strong> with <strong>${memberName}</strong> via WhatsApp or phone<br>
                3. Your member enters the OTP in the Wellness Valley app to get verified<br>
                4. If you don't approve, simply don't share the OTP
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 28px;text-align:center;color:#6b7280;font-size:13px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <strong style="color:#374151;">Wellness Valley Team</strong><br>
          This is an automated message. Please do not reply to this email.<br>
          Questions? Contact us at easy2work.india@gmail.com
        </td>
      </tr>

    </table>
    <!-- /Wrapper -->

  </td></tr>
</table>
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
    subject: `ðŸ† Testimonial Submitted by ${memberName} â€” Verify Now`,
    html:    buildTestimonialEmailHtml({ memberName, goalType, beforeWeight, afterWeight, durationText, otp, beforeUrl, afterUrl }),
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
