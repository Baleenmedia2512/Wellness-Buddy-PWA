/**
 * Coach reject for a verified Task by Coach — soft-delete habit (score drops).
 */
import crypto from 'crypto';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { nowUtc, utcInstantToLegacyIstWallStorage, IANA_IST } from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';
import { findByUserId } from '../../user/user.repository.js';
import { goodHabitOtpExpiryUtcIso } from '../domain/otp.rules.js';
import {
  buildGoodHabitRejectEmail,
  buildGoodHabitRejectUrl,
} from '../domain/rejectEmail.rules.js';
import { buildGoodHabitPhotoAttachment } from '../domain/otpEmail.rules.js';
import * as rejectRepo from '../data/reject.repo.js';
import * as habitRepo from '../data/good-habits.repo.js';

function featureDisabled() {
  throw new ValidationError(404, 'Task by Coach is not enabled');
}

/**
 * Resolve linked coach email for Task by Coach notifications.
 * @param {number|string} userId
 * @returns {Promise<{ userId: number, email: string, name: string, memberName: string }>}
 */
export async function resolveTaskByCoachApprover(userId) {
  const member = await findByUserId(
    userId,
    '"UserId", "UserName", "CoachId"',
  );
  if (!member) {
    throw new ValidationError(404, 'Account not found');
  }
  const coachId = Number(member.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before logging Task by Coach. Your coach is emailed the photo with a Reject option.',
    );
  }
  const coach = await findByUserId(coachId, '"UserId", "UserName", "Email"');
  if (!coach) {
    throw new ValidationError(404, 'Your coach could not be found.');
  }
  const email = String(coach.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(
      400,
      'Your coach has no email on file, so we cannot notify them about this task.',
    );
  }
  return {
    userId: coach.UserId,
    email,
    name: String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach',
    memberName: String(member.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'Your member',
  };
}

/**
 * After save: email coach photo + Reject button (mail-லயே).
 * Reject soft-deletes habit → score decreases. No "Task rejected" page — back to mail.
 *
 * @param {{
 *   habitId: number|string,
 *   userId: number|string,
 *   memberName?: string|null,
 *   coachUserId?: number|string|null,
 *   coachEmail?: string|null,
 *   coachName?: string|null,
 *   imageBase64?: string|null,
 * }} input
 */
export async function emailCoachRejectOption(input) {
  if (!isEnabled('ff.good-habit')) return;
  const habitId = Number(input?.habitId);
  const userId = Number(input?.userId);
  if (!Number.isFinite(habitId) || habitId <= 0 || !Number.isFinite(userId) || userId <= 0) {
    return;
  }

  let coachEmail = String(input?.coachEmail || '').trim().toLowerCase();
  let coachName = String(input?.coachName || '').trim() || 'Coach';
  let coachUserId = Number(input?.coachUserId);
  let memberName = input?.memberName;

  if (!coachEmail.includes('@')) {
    const coach = await resolveTaskByCoachApprover(userId);
    coachEmail = coach.email;
    coachName = coach.name;
    coachUserId = coach.userId;
    memberName = memberName || coach.memberName;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAtUtcIso = goodHabitOtpExpiryUtcIso();
  await rejectRepo.insertRejectToken({
    token,
    habitId,
    userId,
    coachUserId: Number.isFinite(coachUserId) ? coachUserId : 0,
    expiresAtUtcIso,
  });

  const mail = buildGoodHabitRejectEmail({
    memberName,
    coachName,
    rejectUrl: buildGoodHabitRejectUrl(token),
  });
  const photo = buildGoodHabitPhotoAttachment(input?.imageBase64);
  await sendTransactionalMail({
    to: coachEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: photo ? [photo] : [],
  });

  logger.info('[good-habits] coach reject emailed', {
    userId: String(userId),
    habitId: String(habitId),
    coachUserId: Number.isFinite(coachUserId) ? String(coachUserId) : null,
  });
}

/**
 * Apply coach reject via email token (no session — token is the auth).
 * Soft-deletes the habit so wellness score for that IST day drops.
 *
 * @param {string} rawToken
 * @returns {Promise<{ status: 'rejected'|'already'|'expired'|'missing', memberName?: string }>}
 */
export async function applyGoodHabitReject(rawToken) {
  if (!isEnabled('ff.good-habit')) featureDisabled();
  const token = String(rawToken || '').trim();
  if (!token) {
    return { status: 'missing' };
  }

  const row = await rejectRepo.findRejectToken(token);
  if (!row) {
    return { status: 'missing' };
  }
  if (row.usedAt) {
    return { status: 'already' };
  }
  if (Number.isFinite(row.expiresAt?.getTime?.()) && row.expiresAt.getTime() < Date.now()) {
    return { status: 'expired' };
  }

  const habit = await habitRepo.findHabitById(row.habitId, row.userId);
  if (!habit || Number(habit.IsDeleted) === 1 || habit.IsDeleted === true) {
    await rejectRepo.markRejectTokenUsed(token, nowUtc());
    return { status: 'already' };
  }

  // Coach authority — do not apply member diary-lock rules.
  const updatedAt = utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
  await habitRepo.softDeleteHabit(row.habitId, row.userId, updatedAt);
  await rejectRepo.markRejectTokenUsed(token, nowUtc());

  const member = await findByUserId(row.userId, '"UserName"');
  const memberName = String(member?.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'Member';

  logger.info('[good-habits] coach rejected task', {
    userId: String(row.userId),
    habitId: String(row.habitId),
  });

  return { status: 'rejected', memberName };
}

/**
 * Email Reject link must hit a URL (mail clients cannot disable a button in-place).
 * On success: no "Task rejected" page — immediately leave this URL.
 * Prefer Diary in-app Reject for button-disable UX.
 */
export function renderRejectPageHtml({ status, memberName = 'Member' } = {}) {
  const ok = status === 'rejected' || status === 'already';
  if (ok) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <title></title>
  <script>
    (function () {
      try {
        if (window.history.length > 1) { window.history.back(); return; }
      } catch (e) {}
      try { window.close(); } catch (e2) {}
    })();
  </script>
</head>
<body></body>
</html>`;
  }

  const title = {
    expired: 'Link expired',
    missing: 'Link not found',
  }[status] || 'Could not reject';

  const detail = {
    expired: 'This reject link has expired. Open the member Diary in Wellness Valley to reject.',
    missing: 'This reject link is invalid. Open the member Diary in Wellness Valley to reject.',
  }[status] || `Could not reject ${escapeHtml(memberName)}'s task. Open their Diary in the app.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a">
  <main style="max-width:420px;margin:40px auto;padding:20px;background:#fff;border-radius:14px;border:1px solid #e2e8f0">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#047857">Wellness Valley</p>
    <h1 style="margin:0 0 10px;font-size:18px">${escapeHtml(title)}</h1>
    <p style="margin:0;font-size:14px;color:#334155">${detail}</p>
  </main>
</body>
</html>`;
}

/**
 * GET or POST with token → reject immediately (soft-delete → score drops).
 * No confirm step / no SPA redirect — email link is one-click.
 */
export async function handleGoodHabitRejectRequest(req) {
  if (!isEnabled('ff.good-habit')) {
    return {
      httpStatus: 404,
      html: renderRejectPageHtml({ status: 'missing' }),
    };
  }

  const method = String(req?.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return { httpStatus: 405, html: renderRejectPageHtml({ status: 'missing' }) };
  }

  const token = String(req?.body?.token || req?.query?.token || '').trim();
  if (!token) {
    return { httpStatus: 400, html: renderRejectPageHtml({ status: 'missing' }) };
  }

  const result = await applyGoodHabitReject(token);
  const statusMap = {
    rejected: 200,
    already: 200,
    expired: 410,
    missing: 404,
  };
  return {
    httpStatus: statusMap[result.status] || 400,
    html: renderRejectPageHtml({
      status: result.status,
      memberName: result.memberName,
    }),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
