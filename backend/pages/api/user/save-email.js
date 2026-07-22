/**
 * POST /api/user/save-email
 *
 * Saves contact email and display name for users who signed up via phone OTP.
 * Only writes Email if the current Email is null or empty.
 * Updates UserName when the stored name is missing or auto-generated.
 *
 * Body: { userId: number, email: string, name: string }
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  hasValidProfileName,
  isPlaceholderUserName,
} from '../../../features/user/domain/profileCompleteness.js';
import {
  assertEmailAvailable,
  isUniqueViolationError,
  uniqueViolationResponse,
} from '../../../features/user/contact-uniqueness.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM = 'team_table';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const { userId, email, name } = req.body || {};
    const uid = Number(userId);
    const cleanName = String(name || '').trim();

    if (!uid || isNaN(uid)) {
      return { httpStatus: 400, body: { success: false, message: 'userId is required.' } };
    }
    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return { httpStatus: 400, body: { success: false, message: 'A valid email address is required.' } };
    }
    if (!cleanName || cleanName.length < 2) {
      return { httpStatus: 400, body: { success: false, message: 'Please enter your full name.' } };
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!hasValidProfileName(cleanName, { email: cleanEmail })) {
      return {
        httpStatus: 400,
        body: { success: false, message: 'Please enter your full name (not your email address).' },
      };
    }

    const supabase = getSupabaseClient();

    const { data: row, error: readErr } = await supabase
      .from(TEAM)
      .select('Email, UserName, PhoneNumber')
      .eq('UserId', uid)
      .maybeSingle();

    if (readErr) {
      return { httpStatus: 500, body: { success: false, message: 'Failed to read user record.' } };
    }
    if (!row) {
      return { httpStatus: 404, body: { success: false, message: 'User not found.' } };
    }

    const updateData = {};
    const existingEmail = row.Email?.trim() || '';
    const effectiveEmail = existingEmail || cleanEmail;

    if (!existingEmail) {
      const emailCheck = await assertEmailAvailable(cleanEmail, uid);
      if (!emailCheck.ok) {
        return { httpStatus: emailCheck.httpStatus, body: emailCheck.body };
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
      try {
        const { error: writeErr } = await supabase
          .from(TEAM)
          .update(updateData)
          .eq('UserId', uid);

        if (writeErr) {
          if (isUniqueViolationError(writeErr)) return uniqueViolationResponse(writeErr);
          return { httpStatus: 500, body: { success: false, message: 'Failed to save profile details.' } };
        }
      } catch (err) {
        if (isUniqueViolationError(err)) return uniqueViolationResponse(err);
        throw err;
      }
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        email: existingEmail || cleanEmail,
        userName: shouldUpdateName ? cleanName : (row.UserName?.trim() || cleanName),
      },
    };
  });
}
