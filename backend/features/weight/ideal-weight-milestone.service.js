/**
 * ideal-weight-milestone.service.js — Detect first BMI 19–23 reach; email sponsor + coach.
 *
 * Product locks (Ideal Weight Report):
 * - Recipients = Sponsor (direct CoachId) AND Ideal-Weight Coach (ADR-0007),
 *   when different people / emails. Same person → one email only.
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
import { resolveSponsorAndIdealCoach } from '../../utils/sponsorCoachResolution.js';
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

function buildEmail({ recipientName, recipientRole, memberName, weightKg, idealMin, idealMax, reachedAt }) {
  const roleLabel = recipientRole === 'sponsor' ? 'Sponsor' : 'Coach';
  const safeRecipient = escapeHtml(recipientName || roleLabel);
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
    `Hi ${recipientName || roleLabel},`,
    '',
    `${memberName || 'Your team member'} reached ideal weight on ${dateLabel}.`,
    `Current weight: ${weightLabel}`,
    `Ideal range: ${rangeLabel}`,
    '',
    `Wellness Valley · Ideal Weight milestone (${roleLabel})`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #047857; margin-bottom: 8px;">Member reached ideal weight</h2>
      <p style="margin: 0 0 16px;">Hi ${safeRecipient},</p>
      <p style="margin: 0 0 16px;">
        <strong>${safeMember}</strong> reached ideal weight on <strong>${escapeHtml(dateLabel)}</strong>.
      </p>
      <p style="margin: 0 0 8px;">Current weight: <strong>${escapeHtml(weightLabel)}</strong></p>
      <p style="margin: 0 0 16px;">Ideal range: <strong>${escapeHtml(rangeLabel)}</strong></p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
        Wellness Valley · Ideal Weight milestone · ${escapeHtml(roleLabel)}
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
 * Build unique email targets: Sponsor + Ideal-Weight Coach (ADR-0007).
 * Same person / same email → one send.
 *
 * @param {{
 *   sponsorId: string|null,
 *   sponsorName: string|null,
 *   idealCoachId: string|null,
 *   idealCoachName: string|null,
 * }} labels
 * @param {(id: number|string) => Promise<{ email: string|null, name: string|null }>} findContact
 * @returns {Promise<Array<{ userId: string, email: string, name: string|null, role: 'sponsor'|'coach' }>>}
 */
export async function buildIdealReachEmailRecipients(labels, findContact) {
  const candidates = [];
  if (labels?.sponsorId) {
    candidates.push({
      userId: String(labels.sponsorId),
      nameHint: labels.sponsorName,
      role: 'sponsor',
    });
  }
  if (labels?.idealCoachId) {
    candidates.push({
      userId: String(labels.idealCoachId),
      nameHint: labels.idealCoachName,
      role: 'coach',
    });
  }

  const byEmail = new Map();
  for (const c of candidates) {
    const contact = await findContact(c.userId);
    const email = contact?.email ? String(contact.email).trim().toLowerCase() : '';
    if (!email) continue;
    if (byEmail.has(email)) {
      const existing = byEmail.get(email);
      if (existing.role === 'coach' && c.role === 'sponsor') {
        byEmail.set(email, {
          userId: c.userId,
          email: contact.email,
          name: contact.name || c.nameHint || existing.name,
          role: 'sponsor',
        });
      }
      continue;
    }
    byEmail.set(email, {
      userId: c.userId,
      email: contact.email,
      name: contact.name || c.nameHint || null,
      role: c.role,
    });
  }
  return [...byEmail.values()];
}

/**
 * After a successful weight insert: stamp first IdealWeightReachedAt if needed,
 * and email Sponsor + Ideal-Weight Coach when this save is the chronological first reach.
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
 * @param {object} [deps]
 * @returns {Promise<{ recorded: boolean, notified: boolean, reason: string, emailed?: number }>}
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
    resolveSponsorAndIdealCoach:
      deps.resolveSponsorAndIdealCoach || resolveSponsorAndIdealCoach,
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
      return { recorded: true, notified: false, reason: 'recorded_historical_first' };
    }

    if (!isEnabled('ff.reports-module')) {
      return { recorded: true, notified: false, reason: 'reports_flag_off' };
    }

    const notifyClaimed = await db.claimIdealWeightReachedNotify(userId);
    if (!notifyClaimed) {
      return { recorded: true, notified: false, reason: 'notify_already_claimed' };
    }

    const labels = await db.resolveSponsorAndIdealCoach(userId);
    const recipients = await buildIdealReachEmailRecipients(labels, db.findCoachContact);

    if (recipients.length === 0) {
      return { recorded: true, notified: false, reason: 'no_recipient_email' };
    }

    const range = computeIdealWeightRange(heightCm);
    let sentCount = 0;
    for (const recipient of recipients) {
      const mail = buildEmail({
        recipientName: recipient.name,
        recipientRole: recipient.role,
        memberName: context.memberName,
        weightKg,
        idealMin: range?.idealMin,
        idealMax: range?.idealMax,
        reachedAt: reachedAtIso,
      });
      const sent = await db.sendCoachEmail({
        to: recipient.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      if (sent.success) {
        sentCount += 1;
      } else {
        logger.warn('[ideal-milestone] recipient email failed after notify claim', {
          userId,
          recipientId: recipient.userId,
          role: recipient.role,
          error: sent.error,
        });
      }
    }

    if (sentCount === 0) {
      return { recorded: true, notified: false, reason: 'email_failed', emailed: 0 };
    }

    logger.info('[ideal-milestone] sponsor/coach notified of ideal weight reach', {
      userId,
      emailed: sentCount,
      sponsorId: labels?.sponsorId ?? null,
      idealCoachId: labels?.idealCoachId ?? null,
    });
    return { recorded: true, notified: true, reason: 'sent', emailed: sentCount };
  } catch (err) {
    logger.warn('[ideal-milestone] unexpected failure', {
      userId,
      error: err?.message || String(err),
    });
    return { recorded: false, notified: false, reason: 'error' };
  }
}
