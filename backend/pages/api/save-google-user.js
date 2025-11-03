import mysql from 'mysql2/promise';

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

  const { email, displayName } = req.body;

  console.log('💾 [save-google-user] Request received:', { email, displayName });

  if (!email || !displayName) {
    console.log('❌ [save-google-user] Missing required fields');
    return res.status(400).json({ message: 'Email and Display Name are required' });
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    console.log('📊 [save-google-user] Database connection established');

    const [existingRows] = await connection.execute(
      'SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    console.log('🔍 [save-google-user] Checked for existing user:', { 
      email, 
      found: existingRows.length > 0 
    });

    if (!existingRows.length) {
      console.log('➕ [save-google-user] Creating new user in database');
      
      // Generate a unique username by checking if it exists
      let username = displayName;
      let usernameExists = true;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (usernameExists && attempts < maxAttempts) {
        const [usernameRows] = await connection.execute(
          'SELECT UserId FROM team_table WHERE UserName = ? LIMIT 1',
          [username]
        );
        
        if (usernameRows.length === 0) {
          usernameExists = false;
        } else {
          // Append timestamp or increment to make it unique
          attempts++;
          username = `${displayName}_${Date.now().toString().slice(-6)}`;
          console.log(`⚠️ [save-google-user] Username '${displayName}' exists, trying '${username}'`);
        }
      }
      
      if (usernameExists) {
        // Fallback: use email prefix with timestamp
        username = `${email.split('@')[0]}_${Date.now().toString().slice(-6)}`;
        console.log(`⚠️ [save-google-user] Using fallback username: ${username}`);
      }
      
      try {
        await connection.execute(
          `INSERT INTO team_table
              (EntryDateTime, EntryUser, UserName, Password, \`TargetWeight(in_kg)\`, CoachName, CoCoachName, Status, CoachApproved, Email)
          VALUES (NOW(), 'Google Sign-In', ?, 'User@123#', 0, '', '', 'Active', 0, ?)`,
          [username, email]
        );
        
        console.log('✅ [save-google-user] New user created successfully:', { email, username });
        await connection.end();
        
        res.json({ 
          success: true, 
          message: 'User created successfully',
          isNewUser: true,
          username: username
        });
      } catch (insertErr) {
        // Handle duplicate entry error gracefully
        if (insertErr.code === 'ER_DUP_ENTRY') {
          console.log('⚠️ [save-google-user] Duplicate entry detected, checking if user exists by email again...');
          
          // Check one more time if user was created by another concurrent request
          const [recheckRows] = await connection.execute(
            'SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ? LIMIT 1',
            [email]
          );
          
          await connection.end();
          
          if (recheckRows.length > 0) {
            console.log('ℹ️ [save-google-user] User was created by concurrent request:', email);
            res.json({ 
              success: true, 
              message: 'User already exists',
              isNewUser: false,
              user: {
                userId: recheckRows[0].UserId,
                userName: recheckRows[0].UserName,
                email: recheckRows[0].Email,
                status: recheckRows[0].Status
              }
            });
          } else {
            // Still can't create user - return error
            console.error('❌ [save-google-user] Failed to create user due to duplicate:', insertErr);
            res.status(500).json({ 
              success: false,
              message: 'Failed to create user account. Please try again.',
              error: 'Duplicate entry conflict'
            });
          }
        } else {
          // Other insert error
          throw insertErr;
        }
      }
    } else {
      console.log('ℹ️ [save-google-user] User already exists:', email);
      await connection.end();
      
      res.json({ 
        success: true, 
        message: 'User already exists',
        isNewUser: false,
        user: {
          userId: existingRows[0].UserId,
          userName: existingRows[0].UserName,
          email: existingRows[0].Email,
          status: existingRows[0].Status
        }
      });
    }
  } catch (err) {
    console.error('❌ [save-google-user] Error occurred:', err);
    console.error('❌ [save-google-user] Error details:', {
      message: err.message,
      stack: err.stack,
      email
    });
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: err.message 
    });
  }
}
