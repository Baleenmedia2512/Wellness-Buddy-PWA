/**
 * POST /api/user/save-email
 *
 * Saves a contact email for users who signed up via phone OTP and have no
 * Email field in the DB. Only writes if the current Email is null or empty,
 * so existing emails (Google sign-in users) are never overwritten.
 *
 * Body: { userId: number, email: string }
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM = 'team_table';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { userId, email } = req.body || {};
  const uid = Number(userId);

  if (!uid || isNaN(uid)) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const supabase = getSupabaseClient();

  // Read current Email first — only write if it is null/empty.
  const { data: row, error: readErr } = await supabase
    .from(TEAM)
    .select('Email')
    .eq('UserId', uid)
    .maybeSingle();

  if (readErr) {
    return res.status(500).json({ success: false, message: 'Failed to read user record.' });
  }
  if (!row) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  if (row.Email && row.Email.trim()) {
    // Email already set — treat as success (idempotent).
    return res.status(200).json({ success: true, email: row.Email.trim() });
  }

  const { error: writeErr } = await supabase
    .from(TEAM)
    .update({ Email: cleanEmail })
    .eq('UserId', uid);

  if (writeErr) {
    return res.status(500).json({ success: false, message: 'Failed to save email.' });
  }

  return res.status(200).json({ success: true, email: cleanEmail });
}
