/**
 * ideal-weight-milestone.service.js — Detect first BMI 19–23 reach; email upline.
 *
 * Product locks:
 * - Recipients = Coach + Co-Coach for up to 3 CoachId ancestor levels
 *   (level 1 = direct sponsor). Same person / email → one send.
 * - First reach only (no re-entry notify / date rewrite)
 * - First log already in range counts
 * - Trigger on new insert only (not edits)
 * - Email gated by ff.reports-module; persistence always attempted
 *
 * @module backend/features/weight/ideal-weight-milestone.service
 */
import {
  collectIdealReachNotifyTargets,
  findFirstIdealReachedEntry,
  IDEAL_REACH_NOTIFY_MAX_LEVELS,
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

function roleLabelForEmail(recipientRole) {
  if (recipientRole === 'cocoach') return 'Co-Coach';
  if (recipientRole === 'sponsor') return 'Sponsor';
  return 'Coach';
}

function buildEmail({
  recipientName,
  recipientRole,
  level = null,
  memberName,
  weightKg,
  idealMin,
  idealMax,
  reachedAt,
}) {
  const roleLabel = roleLabelForEmail(recipientRole);
  const levelSuffix = Number.isFinite(Number(level)) && Number(level) > 0
    ? ` · Level ${Number(level)}`
    : '';
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
    `Wellness Valley · Ideal Weight milestone (${roleLabel}${levelSuffix})`,
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
        Wellness Valley · Ideal Weight milestone · ${escapeHtml(roleLabel)}${escapeHtml(levelSuffix)}
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
 * Resolve contacts for notify targets; same email → one send.
 * Prefer coach over cocoach when the same address appears twice.
 *
 * @param {Array<{ userId: string, role: 'coach'|'cocoach', level: number }>} targets
 * @param {(id: number|string) => Promise<{ email: string|null, name: string|null }>} findContact
 * @returns {Promise<Array<{ userId: string, email: string, name: string|null, role: 'coach'|'cocoach', level: number }>>}
 */
export async function buildIdealReachEmailRecipients(targets, findContact) {
  const list = Array.isArray(targets) ? targets : [];
  const byEmail = new Map();

  for (const t of list) {
    if (!t?.userId) continue;
    const contact = await findContact(t.userId);
    const email = contact?.email ? String(contact.email).trim().toLowerCase() : '';
    if (!email) continue;

    const next = {
      userId: String(t.userId),
      email: contact.email,
      name: contact.name || null,
      role: t.role === 'cocoach' ? 'cocoach' : 'coach',
      level: Number(t.level) || 1,
    };

    if (byEmail.has(email)) {
      const existing = byEmail.get(email);
      // Prefer coach role; prefer nearer level when roles tie.
      if (existing.role === 'cocoach' && next.role === 'coach') {
        byEmail.set(email, next);
      } else if (
        existing.role === next.role
        && Number(next.level) < Number(existing.level)
      ) {
        byEmail.set(email, next);
      }
      continue;
    }
    byEmail.set(email, next);
  }
  return [...byEmail.values()];
}

/**
 * Walk up to 3 CoachId levels and attach each level's co-coach partner.
 *
 * @param {number|string} memberUserId
 * @param {number|string|null|undefined} sponsorCoachId
 * @param {object} db
 * @returns {Promise<Array<{ userId: string, role: 'coach'|'cocoach', level: number }>>}
 */
export async function resolveIdealReachNotifyTargets(memberUserId, sponsorCoachId, db) {
  const listAncestors = db.listCoachAncestorIdsForNotify || repo.listCoachAncestorIdsForNotify;
  const findPartners = db.findLeadPartnersByUserIds || repo.findLeadPartnersByUserIds;

  const ancestorCoachIds = await listAncestors(
    sponsorCoachId,
    IDEAL_REACH_NOTIFY_MAX_LEVELS,
  );
  const partnerByCoachId = await findPartners(ancestorCoachIds);
  return collectIdealReachNotifyTargets({
    ancestorCoachIds,
    partnerByCoachId,
    memberUserId,
    maxLevels: IDEAL_REACH_NOTIFY_MAX_LEVELS,
  });
}

/**
 * After a successful weight insert: stamp first IdealWeightReachedAt if needed,
 * and email coach + co-coach up to 3 upline levels when this save is the first reach.
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
    listCoachAncestorIdsForNotify:
      deps.listCoachAncestorIdsForNotify || repo.listCoachAncestorIdsForNotify,
    findLeadPartnersByUserIds:
      deps.findLeadPartnersByUserIds || repo.findLeadPartnersByUserIds,
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

    const targets = await resolveIdealReachNotifyTargets(
      userId,
      context.coachId,
      db,
    );
    const recipients = await buildIdealReachEmailRecipients(targets, db.findCoachContact);

    if (recipients.length === 0) {
      return { recorded: true, notified: false, reason: 'no_recipient_email' };
    }

    const range = computeIdealWeightRange(heightCm);
    let sentCount = 0;
    for (const recipient of recipients) {
      const mail = buildEmail({
        recipientName: recipient.name,
        recipientRole: recipient.role,
        level: recipient.level,
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
          level: recipient.level,
          error: sent.error,
        });
      }
    }

    if (sentCount === 0) {
      return { recorded: true, notified: false, reason: 'email_failed', emailed: 0 };
    }

    logger.info('[ideal-milestone] coach/co-coach notified of ideal weight reach', {
      userId,
      emailed: sentCount,
      targets: targets.length,
      levels: Math.min(IDEAL_REACH_NOTIFY_MAX_LEVELS, targets.reduce(
        (max, t) => Math.max(max, Number(t.level) || 0),
        0,
      )),
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
