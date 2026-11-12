/**
 * Day 2, 4, 6, and 8 reminder pass.
 * The caller supplies the mailer. Tests pass a fake sender and never send mail.
 * A slot is claimed before send so two workers cannot both deliver it.
 * If the send fails, the claim is released and a later pass can retry.
 * Completing the field stops later slots.
 */
import { roleMatchesAudience } from './domain/evaluateMandatoryFields.js';
import { campaignDayIndex, dueReminderDays, reminderBit } from './domain/campaignSchedule.js';
import { getRegisteredField } from './domain/fieldRegistry.js';
import { classifyMandatorySchemaGap } from './data/mandatoryFields.repo.js';
import * as repo from './data/mandatoryFields.repo.js';
import { profileSnapshot } from './mandatoryFields.service.js';
import logger from '../../shared/lib/logger.js';

function graceKey(userId, fieldKey) {
  return `${userId}:${fieldKey}`;
}

function snapshotFromCandidate(row) {
  return profileSnapshot(row, null, null, row?.EventLevel || null);
}

function schemaResult(err) {
  const gap = classifyMandatorySchemaGap(err);
  if (gap === 'tables-missing') {
    return { ok: true, sent: 0, failed: 0, skippedNoEmail: 0, skipped: 'schema-missing' };
  }
  if (gap === 'campaign-columns-missing') {
    return { ok: false, sent: 0, failed: 0, skippedNoEmail: 0, skipped: 'campaign-columns-missing' };
  }
  return null;
}

function safeSendFailure(err) {
  const message = String(err?.message || '');
  if (message.includes('@')) return 'send-failed';
  return err?.code || message.slice(0, 120) || 'send-failed';
}

/**
 * @param {{
 *   now?: Date,
 *   listRules?: typeof repo.listRules,
 *   listCandidates?: typeof repo.listReminderCandidates,
 *   listGrace?: typeof repo.listGraceRows,
 *   claimSlot?: typeof repo.claimReminderSlot,
 *   releaseSlot?: typeof repo.releaseReminderSlot,
 *   send?: (input: { to: string, subject: string, text: string }) => Promise<unknown>,
 * }} [deps]
 */
export async function runDueMandatoryReminders({
  now = new Date(),
  listRules = repo.listRules,
  listCandidates = repo.listReminderCandidates,
  listGrace = repo.listGraceRows,
  claimSlot = repo.claimReminderSlot,
  releaseSlot = repo.releaseReminderSlot,
  send,
} = {}) {
  const empty = { sent: 0, failed: 0, skippedNoEmail: 0 };
  if (typeof send !== 'function') {
    return { ok: false, ...empty, reason: 'no-sender' };
  }
  let rules;
  try {
    rules = await listRules();
  } catch (err) {
    const schema = schemaResult(err);
    if (schema) return schema;
    throw err;
  }
  const active = (rules || []).filter((rule) => rule?.required === true && rule.required_since && rule.notify_enabled !== false);
  if (active.length === 0) return { ok: true, ...empty };

  let candidates;
  let graceRows;
  try {
    [candidates, graceRows] = await Promise.all([listCandidates(), listGrace()]);
  } catch (err) {
    const schema = schemaResult(err);
    if (schema) return schema;
    throw err;
  }
  const graceByKey = new Map((graceRows || []).map((row) => [graceKey(row.user_id, row.field_key), row]));
  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;

  for (const rule of active) {
    const entry = getRegisteredField(rule.field_key);
    if (!entry) continue;
    const dayIndex = campaignDayIndex(rule.required_since, now);
    for (const person of candidates || []) {
      if (!roleMatchesAudience(person.Role, rule.audience)) continue;
      const profile = snapshotFromCandidate(person);
      if (entry.isFilled(profile, {
        positionScope: rule.position_scope,
        positionCodes: rule.position_codes,
      })) continue;
      const grace = graceByKey.get(graceKey(person.UserId, rule.field_key));
      const mask = Number(grace?.reminder_mask) || 0;
      const due = dueReminderDays(dayIndex, mask);
      if (due.length === 0) continue;
      const to = String(person.Email || '').trim();
      if (!to) {
        skippedNoEmail += 1;
        logger.warn('[mandatory-fields] reminder skipped, no email address', {
          userId: person.UserId,
          fieldKey: rule.field_key,
          days: due,
        });
        continue;
      }
      let workingMask = mask;
      for (const day of due) {
        const bit = reminderBit(day);
        const nextMask = workingMask | bit;
        const claim = {
          userId: person.UserId,
          fieldKey: rule.field_key,
          expectedMask: workingMask,
          nextMask,
        };
        const claimed = await claimSlot(claim);
        if (!claimed) break;
        try {
          await send({
            to,
            subject: `Wellness Valley: ${entry.label} is still needed`,
            text: `${entry.label} is still missing. The app limits normal use on day 10 of this request.`,
          });
          workingMask = nextMask;
          sent += 1;
          logger.info('[mandatory-fields] reminder sent', {
            userId: person.UserId,
            fieldKey: rule.field_key,
            day,
          });
        } catch (err) {
          failed += 1;
          let released = false;
          try {
            released = await releaseSlot({
              userId: person.UserId,
              fieldKey: rule.field_key,
              expectedMask: nextMask,
              previousMask: workingMask,
            });
          } catch (releaseErr) {
            logger.error('[mandatory-fields] reminder slot could not be released', {
              userId: person.UserId,
              fieldKey: rule.field_key,
              day,
              code: safeSendFailure(releaseErr),
            });
          }
          logger.warn('[mandatory-fields] reminder send failed', {
            userId: person.UserId,
            fieldKey: rule.field_key,
            day,
            released,
            code: safeSendFailure(err),
          });
          break;
        }
      }
    }
  }

  return { ok: true, sent, failed, skippedNoEmail };
}
