/**
 * Wellness University Enrollment API
 * POST /api/wellness-university/enroll
 *
 * Allows users to enroll in Wellness University programs
 * Stores enrollment with IST timezone
 */

import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import nodemailer from 'nodemailer';
import logger from '../../../shared/lib/logger.js';

// ── Email helper (same pattern as upline/request.js) ─────────────────────────
async function sendEnrollmentNotification({ coachEmail, coachName, memberName, memberEmail, programs }) {
  if (!coachEmail) return;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const programList = programs.map((p) => `<li>${p}</li>`).join('');
    await transporter.sendMail({
      from: '"Wellness Valley" <easy2work.india@gmail.com>',
      to: coachEmail,
      subject: '🎓 New Wellness University Enrollment - Wellness Valley',
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0}
        .container{max-width:600px;margin:0 auto;background:#fff}
        .header{background:linear-gradient(135deg,#10b981,#059669);padding:40px 20px;text-align:center}
        .header h1{color:#fff;margin:0;font-size:28px;font-weight:600}
        .content{padding:40px}
        .info-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0}
        .footer{background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb}
        .footer p{color:#6b7280;font-size:14px;margin:0}
        ul{padding-left:20px;color:#374151}li{margin-bottom:6px}</style></head>
        <body><div class="container">
          <div class="header"><h1>🌿 Wellness Valley</h1><p style="color:#d1fae5;margin:8px 0 0">Wellness University</p></div>
          <div class="content">
            <p style="color:#374151;font-size:18px;font-weight:600">Hello ${coachName || 'Coach'}! 👋</p>
            <p style="color:#4b5563">Your team member <strong>${memberName}</strong> (${memberEmail}) has enrolled in the following Wellness University programs:</p>
            <div class="info-box"><ul>${programList}</ul></div>
            <p style="color:#4b5563">You can view their enrollment details in the Wellness Counselling section.</p>
          </div>
          <div class="footer"><p><strong>Wellness Valley Team</strong><br>This is an automated message. Please do not reply.</p></div>
        </div></body></html>`,
    });
    logger.info('[enroll] Coach notification email sent', { coachEmail });
  } catch (err) {
    // Non-fatal: log and continue — enrollment success must not depend on email delivery
    logger.warn('[enroll] Coach notification email failed (non-fatal):', err.message);
  }
}

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
    return;
  }

  try {
    const { email, userId, programs } = req.body;

    // Validation: require email OR userId
    if (!email && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Email or userId is required',
      });
    }

    if (!programs || !Array.isArray(programs) || programs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one program',
      });
    }

    logger.debug('🎓 [enroll] Enrollment request:', { email, userId, programCount: programs.length });

    const supabase = getSupabaseClient();

    // Look up user by userId (preferred — works even when email is empty) or email.
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "CoachId"')
      .eq(userId ? '"UserId"' : '"Email"', userId || email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [enroll] User lookup error:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please complete your profile first.',
      });
    }

    logger.debug('✅ [enroll] User found:', { userId: user.UserId, userName: user.UserName });

    // Check if user is already enrolled
    const { data: existingEnrollment, error: checkError } = await supabase
      .from('wellness_university_enrollments_table')
      .select('"Id"')
      .eq('"UserId"', user.UserId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [enroll] Check enrollment error:', checkError);
      throw new Error(checkError.message);
    }

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in Wellness University',
      });
    }

    // Create enrollment record — store as map: { programName: isoDate }
    const enrollmentDate = getISTTimestamp();
    const programsMap = {};
    programs.forEach((p) => { programsMap[p] = enrollmentDate; });
    const programsJson = JSON.stringify(programsMap);

    const { data: newEnrollment, error: insertError } = await supabase
      .from('wellness_university_enrollments_table')
      .insert({
        UserId: user.UserId,
        EnrolledPrograms: programsJson,
        EnrollmentDate: enrollmentDate,
        LastUpdated: enrollmentDate,
        CreatedAt: enrollmentDate,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [enroll] Insert error:', insertError);
      throw new Error(insertError.message);
    }

    logger.debug('✅ [enroll] Enrollment created successfully:', { enrollmentId: newEnrollment.Id });

    // Notify coach via email (non-fatal: enrollment succeeds even if email delivery fails)
    if (user.CoachId) {
      const { data: coachRow } = await supabase
        .from('team_table')
        .select('"UserName", "Email", "CoachName"')
        .eq('UserId', user.CoachId)
        .maybeSingle();
      if (coachRow?.Email) {
        await sendEnrollmentNotification({
          coachEmail: coachRow.Email,
          coachName: coachRow.CoachName || coachRow.UserName,
          memberName: user.UserName,
          memberEmail: user.Email,
          programs: Object.keys(programsMap),
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Enrollment successful',
      enrollment: {
        id: newEnrollment.Id,
        programs: Object.keys(programsMap),
        enrollmentDate: enrollmentDate,
      },
    });
  } catch (error) {
    console.error('❌ [enroll] Server error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
}
