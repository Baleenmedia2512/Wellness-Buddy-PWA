/**
 * POST /api/user/save-email
 *
 * Saves contact email and display name for users who signed up via phone OTP.
 * Only writes Email if the current Email is null or empty.
 * Rejects emails already registered to another user.
 * Updates UserName when the stored name is missing or auto-generated.
 *
 * Body: { userId: number, email: string, name: string }
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

  if (!uid || isNaN(uid)) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }
  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Please enter your full name.' });
  }

  const cleanEmail = normalizeEmailForStorage(email);
  if (!hasValidProfileName(cleanName, { email: cleanEmail })) {
    return res.status(400).json({
      success: false,
      message: 'Please enter your full name (not your email address).',
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
  const effectiveEmail = existingEmail || cleanEmail;

  if (!existingEmail) {
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
    });
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
    email: existingEmail || cleanEmail,
    userName: shouldUpdateName ? cleanName : (row.UserName?.trim() || cleanName),
  });
}
