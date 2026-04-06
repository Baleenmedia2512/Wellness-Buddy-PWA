/**
 * POST /api/admin/auto-deactivate-inactive-users
 *
 * Cron job endpoint — called automatically by Vercel Cron every day at
 * 18:30 UTC (midnight IST).
 *
 * Logic:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Verify request is from Vercel Cron (or an authorized admin) via
 *    Authorization: Bearer <CRON_SECRET> header.
 * 2. Fetch all users where Status = 'Active'.
 * 3. For each user check:
 *      a) LastActiveAt < TODAY - 31 days  →  mark Inactive
 *      b) LastActiveAt IS NULL AND EntryDateTime < TODAY - 31 days  →  mark Inactive
 *      c) Role is 'admin' or 'coach'  →  EXEMPT (never auto-deactivated)
 * 4. Bulk-update Status = 'Inactive' for all qualifying users.
 * 5. Return a JSON report: { deactivatedCount, deactivatedUsers[], skippedCount }
 *
 * Security:
 * ─────────────────────────────────────────────────────────────────────────────
 * Set CRON_SECRET in your Vercel environment variables.
 * Vercel automatically sends this in the Authorization header for cron jobs.
 *
 * Environment variables required:
 *   CRON_SECRET  – secret token to authenticate the cron call
 */

import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';

const INACTIVITY_DAYS = 31;

// Roles that are NEVER auto-deactivated
const EXEMPT_ROLES = ['admin', 'coach', 'developer'];

export default async function handler(req, res) {
  // ── CORS / OPTIONS ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // ── Authentication ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token !== cronSecret) {
      console.warn('⛔ [auto-deactivate] Unauthorized request — invalid or missing CRON_SECRET');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  } else {
    // If CRON_SECRET is not set, log a warning (allow in dev, but warn loudly)
    console.warn('⚠️ [auto-deactivate] CRON_SECRET is not set — endpoint is unprotected!');
  }

  console.log('🕐 [auto-deactivate] Starting inactivity check...');

  try {
    const supabase = getSupabaseClient();

    // ── Step 1: Calculate the inactivity threshold date ──────────────────────
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVITY_DAYS);
    const thresholdISO = thresholdDate.toISOString();

    console.log(`📅 [auto-deactivate] Inactivity threshold: ${thresholdISO} (${INACTIVITY_DAYS} days ago)`);

    // ── Step 2: Fetch all currently active users ─────────────────────────────
    const { data: activeUsers, error: fetchError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Role", "LastActiveAt", "EntryDateTime"')
      .eq('"Status"', 'Active');

    if (fetchError) {
      console.error('❌ [auto-deactivate] Failed to fetch active users:', fetchError);
      throw fetchError;
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('ℹ️ [auto-deactivate] No active users found. Nothing to do.');
      return res.status(200).json({
        success: true,
        message: 'No active users found',
        deactivatedCount: 0,
        deactivatedUsers: [],
        skippedCount: 0,
        checkedAt: getISTTimestamp(),
      });
    }

    console.log(`👥 [auto-deactivate] Checking ${activeUsers.length} active users...`);

    // ── Step 3: Identify users to deactivate ─────────────────────────────────
    const toDeactivate = [];
    const exemptUsers  = [];
    const recentUsers  = [];

    for (const user of activeUsers) {
      const role = (user.Role || '').toLowerCase();

      // Exempt admins, coaches, developers from auto-deactivation
      if (EXEMPT_ROLES.includes(role)) {
        exemptUsers.push(user.UserId);
        continue;
      }

      // Determine the date to compare against threshold
      // Prefer LastActiveAt; fall back to EntryDateTime for users who signed up
      // before this feature was deployed (their LastActiveAt will be NULL)
      const lastActive = user.LastActiveAt || user.EntryDateTime;

      if (!lastActive) {
        // No date at all — skip to be safe (very unlikely)
        recentUsers.push(user.UserId);
        continue;
      }

      const lastActiveDate = new Date(lastActive);

      if (lastActiveDate < thresholdDate) {
        // User has been inactive for more than INACTIVITY_DAYS
        toDeactivate.push({
          userId:       user.UserId,
          userName:     user.UserName,
          email:        user.Email,
          lastActiveAt: lastActive,
          daysSinceActive: Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24)),
        });
      } else {
        recentUsers.push(user.UserId);
      }
    }

    console.log(`📊 [auto-deactivate] Results:`);
    console.log(`   • To deactivate : ${toDeactivate.length}`);
    console.log(`   • Exempt (coach/admin) : ${exemptUsers.length}`);
    console.log(`   • Still active  : ${recentUsers.length}`);

    // ── Step 4: Bulk update Status = 'Inactive' ───────────────────────────────
    let deactivatedUsers = [];

    if (toDeactivate.length > 0) {
      const userIdsToDeactivate = toDeactivate.map((u) => u.userId);

      const { error: updateError } = await supabase
        .from('team_table')
        .update({ Status: 'Inactive' })
        .in('"UserId"', userIdsToDeactivate);

      if (updateError) {
        console.error('❌ [auto-deactivate] Failed to update user statuses:', updateError);
        throw updateError;
      }

      deactivatedUsers = toDeactivate;
      console.log(`✅ [auto-deactivate] Successfully deactivated ${toDeactivate.length} users:`);
      deactivatedUsers.forEach((u) => {
        console.log(`   • [${u.userId}] ${u.userName} (${u.email}) — last active ${u.daysSinceActive} days ago`);
      });
    } else {
      console.log('✅ [auto-deactivate] No users needed deactivation today.');
    }

    // ── Step 5: Return report ─────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: toDeactivate.length > 0
        ? `${toDeactivate.length} user(s) marked as Inactive`
        : 'No users needed deactivation',
      deactivatedCount:  deactivatedUsers.length,
      deactivatedUsers:  deactivatedUsers.map((u) => ({
        userId:          u.userId,
        userName:        u.userName,
        email:           u.email,
        lastActiveAt:    u.lastActiveAt,
        daysSinceActive: u.daysSinceActive,
      })),
      skippedCount:      exemptUsers.length,
      totalChecked:      activeUsers.length,
      inactivityDays:    INACTIVITY_DAYS,
      threshold:         thresholdISO,
      checkedAt:         getISTTimestamp(),
    });

  } catch (err) {
    console.error('❌ [auto-deactivate] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
}
