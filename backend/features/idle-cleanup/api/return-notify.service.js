/**
 * return-notify.service.js — Notify coach when a member returns after idle.
 *
 * Called from user lookup on login/status check. Never changes Status.
 *
 * Dedupe (claim-first): stamp LastActiveAt only if still idle; send email only
 * when this request won the claim. Parallel /api/user/lookup calls cannot each
 * send — losers get already_claimed.
 *
 * Trade-off: if email fails after a successful claim, we do not retry that gap
 * (avoids duplicate storms). Failures are logged.
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
 * If the member was idle ≥ threshold, claim the notify slot then email their coach once.
 * Failures are logged and never thrown — lookup must stay non-blocking.
 *
 * @param {{
 *   userId: number|string,
 *   lastActiveAt: Date|string|null|undefined,
 *   now?: Date,
 * }} params
 * @param {Partial<typeof repo>} [deps] optional overrides for tests
 * @returns {Promise<{ notified: boolean, reason: string }>}
 */
export async function notifyCoachIfReturningIdleUser({
  userId,
  lastActiveAt,
  now = new Date(),
}, deps = {}) {
  const db = {
    claimIdleReturnNotify: deps.claimIdleReturnNotify || repo.claimIdleReturnNotify,
    findMemberCoachContext: deps.findMemberCoachContext || repo.findMemberCoachContext,
    findCoachContact: deps.findCoachContact || repo.findCoachContact,
    sendCoachEmail: deps.sendCoachEmail || repo.sendCoachEmail,
  };

  if (!userId) {
    return { notified: false, reason: 'missing_user' };
  }

  if (!shouldNotifyCoachOnReturn(lastActiveAt, now)) {
    return { notified: false, reason: 'not_idle' };
  }

  const idleDays = idleDaysSince(lastActiveAt, now) ?? 0;

  try {
    // Claim before send so concurrent lookups cannot each mail the coach.
    const claimed = await db.claimIdleReturnNotify(userId, { now });
    if (!claimed) {
      return { notified: false, reason: 'already_claimed' };
    }

    const { coachId, memberName } = await db.findMemberCoachContext(userId);
    if (!coachId) {
      return { notified: false, reason: 'no_coach' };
    }

    const coach = await db.findCoachContact(coachId);
    if (!coach.email) {
      return { notified: false, reason: 'no_coach_email' };
    }

    const subject = `${memberName || 'A team member'} is back on Wellness Valley`;
    const html = buildEmailHtml({
      coachName: coach.name,
      memberName,
    });

    const sent = await db.sendCoachEmail({
      to: coach.email,
      subject,
      html,
    });

    if (!sent.success) {
      logger.warn('[return-notify] coach email failed after claim', {
        userId,
        coachId,
        error: sent.error,
        idleDays,
      });
      return { notified: false, reason: 'email_failed' };
    }

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
