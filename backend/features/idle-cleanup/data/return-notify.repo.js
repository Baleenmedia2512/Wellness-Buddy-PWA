/**
 * return-notify.repo.js — DB + email for idle-return coach alerts.
 * @module backend/features/idle-cleanup/data/return-notify.repo
 */
import nodemailer from 'nodemailer';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { getInactivityCutoff } from '../domain/inactivity-rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {number|string} userId
 * @returns {Promise<{ coachId: number|null, memberName: string|null }>}
 */
export async function findMemberCoachContext(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"CoachId", "UserName"')
    .eq('"UserId"', userId)
    .maybeSingle();

  if (error) {
    logger.warn('[return-notify] member lookup failed', {
      userId,
      error: error.message,
    });
    return { coachId: null, memberName: null };
  }

  return {
    coachId: data?.CoachId ?? null,
    memberName: data?.UserName ?? null,
  };
}

/**
 * @param {number|string} coachId
 * @returns {Promise<{ email: string|null, name: string|null }>}
 */
export async function findCoachContact(coachId) {
  if (!coachId) return { email: null, name: null };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"Email", "UserName"')
    .eq('"UserId"', coachId)
    .maybeSingle();

  if (error) {
    logger.warn('[return-notify] coach lookup failed', {
      coachId,
      error: error.message,
    });
    return { email: null, name: null };
  }

  return {
    email: data?.Email ?? null,
    name: data?.UserName ?? null,
  };
}

/**
 * Atomically claim the idle-return notify for this user.
 * Stamps LastActiveAt only if the member is still idle (≥ threshold).
 * Concurrent lookups: only the first successful update "wins".
 *
 * Matches lookup fallback: idle LastActiveAt, or null LastActiveAt with idle EntryDateTime.
 *
 * @param {number|string} userId
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<boolean>} true when this caller owns the notify
 */
export async function claimIdleReturnNotify(userId, { now = new Date() } = {}) {
  if (!userId) return false;

  const supabase = getSupabaseClient();
  const cutoffIso = getInactivityCutoff(now).toISOString();
  const stamped = nowUtc();

  // Path A: LastActiveAt itself is old enough
  const { data: byLastActive, error: errA } = await supabase
    .from('team_table')
    .update({ LastActiveAt: stamped })
    .eq('UserId', userId)
    .lte('LastActiveAt', cutoffIso)
    .select('UserId');

  if (errA) {
    logger.warn('[return-notify] claim (LastActiveAt) failed', {
      userId,
      error: errA.message,
    });
    return false;
  }
  if (byLastActive?.length) return true;

  // Path B: never stamped LastActiveAt — use EntryDateTime (same as lookup fallback)
  const { data: byEntry, error: errB } = await supabase
    .from('team_table')
    .update({ LastActiveAt: stamped })
    .eq('UserId', userId)
    .is('LastActiveAt', null)
    .lte('EntryDateTime', cutoffIso)
    .select('UserId');

  if (errB) {
    logger.warn('[return-notify] claim (EntryDateTime) failed', {
      userId,
      error: errB.message,
    });
    return false;
  }
  return Boolean(byEntry?.length);
}

/**
 * @deprecated Prefer {@link claimIdleReturnNotify} for return-notify dedupe.
 * Unconditional bump kept for any legacy callers.
 * @param {number|string} userId
 */
export async function touchLastActive(userId) {
  if (!userId) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('team_table')
    .update({ LastActiveAt: nowUtc() })
    .eq('UserId', userId);
  if (error) {
    logger.warn('[return-notify] LastActiveAt update failed', {
      userId,
      error: error.message,
    });
  }
}

/**
 * @param {{ to: string, subject: string, html: string }} params
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendCoachEmail({ to, subject, html }) {
  if (!to) return { success: false, error: 'missing_to' };
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: 'smtp_not_configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: '"Wellness Valley" <easy2work.india@gmail.com>',
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'send_failed' };
  }
}
