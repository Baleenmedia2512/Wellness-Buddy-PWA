/**
 * return-notify.service.js — Notify coach when a member returns after idle.
 *
 * Called from user lookup on login/status check. Never changes Status.
 * Dedupes by refreshing LastActiveAt only after a successful notify.
 *
 * @module backend/features/idle-cleanup/api/return-notify.service
 */
import {
  idleDaysSince,
  shouldNotifyCoachOnReturn,
} from '../domain/inactivity-rules.js';
import * as repo from '../data/return-notify.repo.js';
import logger from '../../../shared/lib/logger.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml({ coachName, memberName }) {
  const safeCoach = escapeHtml(coachName || 'Coach');
  const safeMember = escapeHtml(memberName || 'Your team member');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #047857; margin-bottom: 8px;">Member returned to the app</h2>
      <p style="margin: 0 0 16px;">Hi ${safeCoach},</p>
      <p style="margin: 0 0 16px;">
        <strong>${safeMember}</strong> just came back to Wellness Valley.
      </p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
        Wellness Valley · idle return notice
      </p>
    </div>
  `.trim();
}

/**
 * If the member was idle ≥ threshold, email their coach once, then touch LastActiveAt.
 * Failures are logged and never thrown — lookup must stay non-blocking.
 *
 * @param {{
 *   userId: number|string,
 *   lastActiveAt: Date|string|null|undefined,
 *   now?: Date,
 * }} params
 * @returns {Promise<{ notified: boolean, reason: string }>}
 */
export async function notifyCoachIfReturningIdleUser({
  userId,
  lastActiveAt,
  now = new Date(),
}) {
  if (!userId) {
    return { notified: false, reason: 'missing_user' };
  }

  if (!shouldNotifyCoachOnReturn(lastActiveAt, now)) {
    return { notified: false, reason: 'not_idle' };
  }

  const idleDays = idleDaysSince(lastActiveAt, now) ?? 0;

  try {
    const { coachId, memberName } = await repo.findMemberCoachContext(userId);
    if (!coachId) {
      return { notified: false, reason: 'no_coach' };
    }

    const coach = await repo.findCoachContact(coachId);
    if (!coach.email) {
      return { notified: false, reason: 'no_coach_email' };
    }

    const subject = `${memberName || 'A team member'} is back on Wellness Valley`;
    const html = buildEmailHtml({
      coachName: coach.name,
      memberName,
    });

    const sent = await repo.sendCoachEmail({
      to: coach.email,
      subject,
      html,
    });

    if (!sent.success) {
      logger.warn('[return-notify] coach email failed', {
        userId,
        coachId,
        error: sent.error,
        idleDays,
      });
      return { notified: false, reason: 'email_failed' };
    }

    // Refresh activity only after a successful send so skipped/failed attempts
    // can retry on the next login instead of being consumed silently.
    await repo.touchLastActive(userId);

    logger.info('[return-notify] coach notified of idle return', {
      userId,
      coachId,
      idleDays,
    });
    return { notified: true, reason: 'sent' };
  } catch (err) {
    logger.warn('[return-notify] unexpected failure', {
      userId,
      error: err?.message || String(err),
    });
    return { notified: false, reason: 'error' };
  }
}
