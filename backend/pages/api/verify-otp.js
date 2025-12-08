import mysql from 'mysql2/promise';
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
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    const [rows] = await connection.execute(
      'SELECT ID, OTPHash, ExpiresAt FROM otp_tokens_table WHERE Recipient = ? AND ContactType = ? AND IsActive = TRUE ORDER BY ID DESC LIMIT 1',
      [recipient, contactType]
    );

    if (!rows.length) {
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
    await connection.execute(
      'UPDATE otp_tokens_table SET Verified = TRUE, IsActive = FALSE WHERE ID = ?',
      [otpData.ID]
    );

    // Check & insert user if not exists.
    const [userRows] = await connection.execute(
      'SELECT * FROM team_table WHERE Email = ? LIMIT 1',
      [recipient]
    );

    let userInfo;
    let isNewUser = false;

    if (userRows.length) {
      userInfo = userRows[0];
      isNewUser = false;
    } else {
      const username = recipient.split('@')[0];
      const defaultPassword = 'User@123#';
      const hashedPassword = defaultPassword; // You can hash it later if you want
      
      await connection.execute(
        `INSERT INTO team_table
          (EntryDateTime, EntryUser, UserName, Password, \`TargetWeight(in_kg)\`, CoachName, CoCoachName, Status, CoachApproved, Email)
          VALUES (NOW(), 'Wellness Valley', ?, ?, 0, '', '', 'Active', 0, ?)`,
        [username, hashedPassword, recipient]
      );

      const [newUserRows] = await connection.execute(
        'SELECT * FROM team_table WHERE Email = ? LIMIT 1',
        [recipient]
      );

      userInfo = newUserRows[0];
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
