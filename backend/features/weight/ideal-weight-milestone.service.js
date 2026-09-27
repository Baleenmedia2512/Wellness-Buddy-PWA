/**
 * ideal-weight-milestone.service.js — Detect first BMI 19–23 reach; email sponsor once.
 *
 * Product locks (Ideal Weight Report):
 * - Recipient = direct CoachId (sponsor), not ADR-0007 ideal-weight coach label
 * - First reach only (no re-entry notify / date rewrite)
 * - First log already in range counts
 * - Trigger on new insert only (not edits)
 * - Email gated by ff.reports-module; persistence always attempted
 *
 * @module backend/features/weight/ideal-weight-milestone.service
 */
import {
  findFirstIdealReachedEntry,
  isSaveTheFirstIdealReach,
  isWeightInIdealRange,
  shouldAttemptIdealMilestoneOnSave,
} from './domain/ideal-weight-milestone.rules.js';
import * as repo from './data/ideal-weight-milestone.repo.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { normalizeStoredTimestampToUtcIso } from '../../shared/lib/datetime/index.js';
import { computeIdealWeightRange } from '../../utils/weightValidation.js';
import logger from '../../shared/lib/logger.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDisplayDate(isoOrDate) {
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate ?? '');
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return String(isoOrDate ?? '');
  }
}

function buildEmail({ coachName, memberName, weightKg, idealMin, idealMax, reachedAt }) {
  const safeCoach = escapeHtml(coachName || 'Coach');
  const safeMember = escapeHtml(memberName || 'Your team member');
  const dateLabel = formatDisplayDate(reachedAt);
  const weightLabel = Number.isFinite(Number(weightKg))
    ? `${Number(weightKg).toFixed(1)} kg`
    : '—';
  const rangeLabel =
    Number.isFinite(Number(idealMin)) && Number.isFinite(Number(idealMax))
      ? `${Number(idealMin).toFixed(1)} – ${Number(idealMax).toFixed(1)} kg`
      : 'BMI 19–23';

  const subject = `${memberName || 'A team member'} reached ideal weight`;
  const text = [
    `Hi ${coachName || 'Coach'},`,
    '',
    `${memberName || 'Your team member'} reached ideal weight on ${dateLabel}.`,
    `Current weight: ${weightLabel}`,
    `Ideal range: ${rangeLabel}`,
    '',
    'Wellness Valley · Ideal Weight milestone',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #047857; margin-bottom: 8px;">Member reached ideal weight</h2>
      <p style="margin: 0 0 16px;">Hi ${safeCoach},</p>
      <p style="margin: 0 0 16px;">
        <strong>${safeMember}</strong> reached ideal weight on <strong>${escapeHtml(dateLabel)}</strong>.
      </p>
      <p style="margin: 0 0 8px;">Current weight: <strong>${escapeHtml(weightLabel)}</strong></p>
      <p style="margin: 0 0 16px;">Ideal range: <strong>${escapeHtml(rangeLabel)}</strong></p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
        Wellness Valley · Ideal Weight milestone
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

function toReachedAtIso(createdAt) {
  if (createdAt == null) return null;
  try {
    return normalizeStoredTimestampToUtcIso(createdAt);
  } catch {
    try {
      const d = new Date(createdAt);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }
}

/**
 * After a successful weight insert: stamp first IdealWeightReachedAt if needed,
 * and email the sponsor once when this save is the chronological first reach.
 *
 * Failures are logged and never thrown — weight save must stay non-blocking.
 *
 * @param {{
 *   userId: number|string,
 *   weightKg: number|string,
 *   heightCm?: number|string|null,
 *   isNewInsert: boolean,
 *   newEntryId?: number|string|null,
 *   newEntryCreatedAt?: string|Date|null,
 * }} params
 * @param {Partial<typeof repo>} [deps]
 * @returns {Promise<{ recorded: boolean, notified: boolean, reason: string }>}
 */
export async function maybeRecordIdealWeightMilestone(params, deps = {}) {
  const {
    userId,
    weightKg,
    heightCm: heightHint = null,
    isNewInsert,
    newEntryId = null,
    newEntryCreatedAt = null,
  } = params;

  const db = {
    getIdealWeightReachedAt: deps.getIdealWeightReachedAt || repo.getIdealWeightReachedAt,
    listActiveWeightsAsc: deps.listActiveWeightsAsc || repo.listActiveWeightsAsc,
    claimIdealWeightReachedAt: deps.claimIdealWeightReachedAt || repo.claimIdealWeightReachedAt,
    claimIdealWeightReachedNotify:
      deps.claimIdealWeightReachedNotify || repo.claimIdealWeightReachedNotify,
    findMemberCoachContext: deps.findMemberCoachContext || repo.findMemberCoachContext,
    findCoachContact: deps.findCoachContact || repo.findCoachContact,
    sendCoachEmail: deps.sendCoachEmail || repo.sendCoachEmail,
  };

  if (!userId) {
    return { recorded: false, notified: false, reason: 'missing_user' };
  }

  try {
    const already = await db.getIdealWeightReachedAt(userId);
    if (!shouldAttemptIdealMilestoneOnSave({ isNewInsert, alreadyReachedAt: already })) {
      return {
        recorded: false,
        notified: false,
        reason: already ? 'already_reached' : 'not_new_insert',
      };
    }

    const context = await db.findMemberCoachContext(userId);
    const heightCm = heightHint != null && heightHint !== ''
      ? heightHint
      : context.heightCm;

    // Cheap reject: if this new weight is out of range, history may still have
    // an earlier in-range row (backfill gap). Still scan so report dates fill in
    // without waiting for an in-range re-log — only when column is null.
    // Skip scan when current weight is out of range AND we only care about
    // live notify? Product: backfill job owns historical; live path only when
    // current save is in range (avoids a history query on every out-of-range log).
    if (!isWeightInIdealRange(weightKg, heightCm)) {
      return { recorded: false, notified: false, reason: 'not_in_ideal_range' };
    }

    const history = await db.listActiveWeightsAsc(userId);
    const first = findFirstIdealReachedEntry(history, heightCm);
    if (!first) {
      return { recorded: false, notified: false, reason: 'no_in_range_history' };
    }

    const reachedAtIso = toReachedAtIso(first.createdAt);
    if (!reachedAtIso) {
      return { recorded: false, notified: false, reason: 'invalid_reached_at' };
    }

    const claimed = await db.claimIdealWeightReachedAt(userId, reachedAtIso);
    if (!claimed) {
      return { recorded: false, notified: false, reason: 'already_claimed' };
    }

    const shouldNotify = isSaveTheFirstIdealReach({
      firstEntryId: first.id,
      firstCreatedAt: first.createdAt,
      newEntryId,
      newEntryCreatedAt: newEntryCreatedAt ?? first.createdAt,
    });

    if (!shouldNotify) {
      // Historical first found on this save (backfill gap) — stamp only, no email.
      return { recorded: true, notified: false, reason: 'recorded_historical_first' };
    }

    if (!isEnabled('ff.reports-module')) {
      return { recorded: true, notified: false, reason: 'reports_flag_off' };
    }

    const notifyClaimed = await db.claimIdealWeightReachedNotify(userId);
    if (!notifyClaimed) {
      return { recorded: true, notified: false, reason: 'notify_already_claimed' };
    }

    if (!context.coachId) {
      return { recorded: true, notified: false, reason: 'no_coach' };
    }

    const coach = await db.findCoachContact(context.coachId);
    if (!coach.email) {
      return { recorded: true, notified: false, reason: 'no_coach_email' };
    }

    const range = computeIdealWeightRange(heightCm);
    const mail = buildEmail({
      coachName: coach.name,
      memberName: context.memberName,
      weightKg,
      idealMin: range?.idealMin,
      idealMax: range?.idealMax,
      reachedAt: reachedAtIso,
    });

    const sent = await db.sendCoachEmail({
      to: coach.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (!sent.success) {
      logger.warn('[ideal-milestone] coach email failed after notify claim', {
        userId,
        coachId: context.coachId,
        error: sent.error,
      });
      return { recorded: true, notified: false, reason: 'email_failed' };
    }

    logger.info('[ideal-milestone] coach notified of ideal weight reach', {
      userId,
      coachId: context.coachId,
    });
    return { recorded: true, notified: true, reason: 'sent' };
  } catch (err) {
    logger.warn('[ideal-milestone] unexpected failure', {
      userId,
      error: err?.message || String(err),
    });
    return { recorded: false, notified: false, reason: 'error' };
  }
}
