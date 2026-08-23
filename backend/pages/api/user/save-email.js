/**
 * POST /api/user/save-email
 *
 * Saves display name and/or contact email for phone-OTP / BCM users.
 * - Name-only: { userId, name } — updates UserName (email asked later on profile).
 * - With email: { userId, email, name } — assigns Email if empty; updates name when placeholder.
 * Rejects emails already registered to another user.
 *
 * Body: { userId: number, name: string, email?: string }
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  hasValidProfileName,
  isPlaceholderUserName,
} from '../../../features/user/domain/profileCompleteness.js';
import {
  canAssignEmailToUser,
  EMAIL_TAKEN_MESSAGE,
  normalizeEmailForStorage,
} from '../../../features/user/domain/emailIdentity.rules.js';
import * as userRepo from '../../../features/user/user.repository.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM = 'team_table';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { userId, email, name } = req.body || {};
  const uid = Number(userId);
  const cleanName = String(name || '').trim();
  const emailRaw = email != null ? String(email).trim() : '';
  const wantsEmail = !!emailRaw;

  if (!uid || isNaN(uid)) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }
  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Please enter your full name.' });
  }
  if (wantsEmail && !EMAIL_RE.test(emailRaw)) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const cleanEmail = wantsEmail ? normalizeEmailForStorage(emailRaw) : null;
  if (!hasValidProfileName(cleanName, {
    phoneNumber: undefined,
  })) {
    return res.status(400).json({
      success: false,
      message: 'Please enter your full name.',
    });
  }

  const supabase = getSupabaseClient();

  const { data: row, error: readErr } = await supabase
    .from(TEAM)
    .select('Email, UserName, PhoneNumber')
    .eq('UserId', uid)
    .maybeSingle();

  if (readErr) {
    return res.status(500).json({ success: false, message: 'Failed to read user record.' });
  }
  if (!row) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const updateData = {};
  const existingEmail = normalizeEmailForStorage(row.Email);
  const effectiveEmail = existingEmail || cleanEmail || '';

  if (wantsEmail && !existingEmail) {
    let conflictingUserId = null;
    try {
      const conflict = await userRepo.findByEmailExcludingUserId(cleanEmail, uid, '"UserId"');
      conflictingUserId = conflict?.UserId ?? null;
    } catch {
      return res.status(500).json({ success: false, message: 'Failed to verify email availability.' });
    }

    const gate = canAssignEmailToUser({
      email: cleanEmail,
      userId: uid,
      existingEmailOnUser: existingEmail,
      conflictingUserId,
    });
    if (!gate.ok) {
      return res.status(409).json({
        success: false,
        message: gate.message,
        error: { code: gate.code },
      });
    }

    updateData.Email = cleanEmail;
  }

  const shouldUpdateName = !row.UserName?.trim()
    || isPlaceholderUserName(row.UserName, {
      email: effectiveEmail,
      phoneNumber: row.PhoneNumber,
    })
    || String(row.UserName).trim().toLowerCase() !== cleanName.toLowerCase();
  if (shouldUpdateName) {
    updateData.UserName = cleanName;
  }

  if (Object.keys(updateData).length > 0) {
    const { error: writeErr } = await supabase
      .from(TEAM)
      .update(updateData)
      .eq('UserId', uid);

    if (writeErr) {
      if (writeErr.code === '23505') {
        return res.status(409).json({
          success: false,
          message: EMAIL_TAKEN_MESSAGE,
          error: { code: 'EMAIL_TAKEN' },
        });
      }
      return res.status(500).json({ success: false, message: 'Failed to save profile details.' });
    }
  }

  return res.status(200).json({
    success: true,
    email: existingEmail || cleanEmail || null,
    userName: shouldUpdateName ? cleanName : (row.UserName?.trim() || cleanName),
  });
}
