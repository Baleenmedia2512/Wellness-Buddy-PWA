import { getSupabaseClient } from '../../utils/supabaseClient.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { recipient, otp, contactType = 'email' } = req.body;

  if (!recipient || !otp) {
    return res.status(400).json({ message: 'Recipient and OTP are required' });
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
      return res.status(404).json({ message: 'No active OTP found' });
    }

    const otpData = rows[0];

    if (new Date() > new Date(otpData.ExpiresAt)) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const valid = await bcrypt.compare(otp, otpData.OTPHash);
    if (!valid) {
      return res.status(400).json({ message: 'Invalid OTP' });
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
      
      const { data: newUser, error: insertError } = await supabase
        .from('team_table')
        .insert({
          EntryDateTime: new Date().toISOString(),
          EntryUser: 'Wellness Valley',
          UserName: username,
          Password: hashedPassword,
          'TargetWeight(in_kg)': 0,
          CoachName: '',
          CoCoachName: '',
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
