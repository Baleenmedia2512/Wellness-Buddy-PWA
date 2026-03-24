import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { recipient, otp, contactType = 'email' } = req.body;

  if (!recipient || !otp) {
    res.status(400).json({ message: 'Recipient and OTP are required' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Get active OTP token
    const { data: rows, error: otpError } = await supabase
      .from('otp_tokens_table')
      .select('"ID", "OTPHash", "ExpiresAt"')
      .eq('"Recipient"', recipient)
      .eq('"ContactType"', contactType)
      .eq('"IsActive"', true)
      .order('"ID"', { ascending: false })
      .limit(1);

    if (otpError) throw otpError;

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'No active OTP found' });
      return;
    }

    const otpData = rows[0];

    // Compare current IST time with stored expiry time (both in IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const currentIST = new Date(now.getTime() + istOffset);
    const expiresAt = new Date(otpData.ExpiresAt + 'Z'); // Add Z to parse as UTC, then compare
    
    if (currentIST > expiresAt) {
      res.status(400).json({ message: 'OTP expired' });
      return;
    }

    const valid = await bcrypt.compare(otp, otpData.OTPHash);
    if (!valid) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    // OTP verified - deactivate token
    const { error: updateError } = await supabase
      .from('otp_tokens_table')
      .update({ 
        Verified: true, 
        IsActive: false
      })
      .eq('"ID"', otpData.ID);

    if (updateError) throw updateError;

    // Check if user exists
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('*')
      .eq('"Email"', recipient)
      .limit(1);

    if (userError) throw userError;

    let userInfo;
    let isNewUser = false;

    if (userRows && userRows.length > 0) {
      userInfo = userRows[0];
      isNewUser = false;
    } else {
      const username = recipient.split('@')[0];
      const defaultPassword = 'User@123#';
      const hashedPassword = defaultPassword; // You can hash it later if you want
      const currentTime = getISTTimestamp();
      
      const { data: newUser, error: insertError } = await supabase
        .from('team_table')
        .insert({
          EntryDateTime: currentTime,
          EntryUser: 'Wellness Valley',
          UserName: username,
          Password: hashedPassword,
          // TargetWeightInKg: 0,
          'TargetWeightInKg': 0,
          Status: 'Active',
          CoachApproved: 0,
          Email: recipient
        })
        .select()
        .single();

      if (insertError) throw insertError;

      userInfo = newUser;
      isNewUser = true;
      console.log('🆕 [verify-otp] New user created:', recipient);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      isNewUser: isNewUser,
      user: {
        id: userInfo.UserId,
        username: userInfo.UserName,
        email: userInfo.Email,
        status: userInfo.Status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
