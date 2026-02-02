import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

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

  const { email, displayName } = req.body;

  console.log('💾 [save-google-user] Request received:', { email, displayName });

  if (!email || !displayName) {
    console.log('❌ [save-google-user] Missing required fields');
    res.status(400).json({ message: 'Email and Display Name are required' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    const { data: existingRows, error: existingError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Status"')
      .eq('"Email"', email)
      .limit(1);

    if (existingError) throw existingError;

    console.log('🔍 [save-google-user] Checked for existing user:', { 
      email, 
      found: existingRows && existingRows.length > 0 
    });

    if (!existingRows || existingRows.length === 0) {
      console.log('➕ [save-google-user] Creating new user in database');
      
      // Generate a unique username by checking if it exists
      let username = displayName;
      let usernameExists = true;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (usernameExists && attempts < maxAttempts) {
        const { data: usernameRows, error: usernameError } = await supabase
          .from('team_table')
          .select('"UserId"')
          .eq('"UserName"', username)
          .limit(1);

        if (usernameError) throw usernameError;
        
        if (!usernameRows || usernameRows.length === 0) {
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
        const currentTime = getISTTimestamp();
        const { data: insertData, error: insertErr } = await supabase
          .from('team_table')
          .insert({
            EntryDateTime: currentTime,
            EntryUser: 'Google Sign-In',
            UserName: username,
            Password: 'User@123#',
            TargetWeightInKg: 0,
            CoachName: '',
            CoCoachName: '',
            Status: 'Active',
            CoachApproved: 0,
            Email: email
          })
          .select()
          .single();

        if (insertErr) {
          // Handle duplicate entry error gracefully
          if (insertErr.code === '23505') { // PostgreSQL unique violation
            console.log('⚠️ [save-google-user] Duplicate entry detected, checking if user exists by email again...');
            
            // Check one more time if user was created by another concurrent request
            const { data: recheckRows, error: recheckError } = await supabase
              .from('team_table')
              .select('"UserId", "UserName", "Email", "Status"')
              .eq('"Email"', email)
              .limit(1);

            if (recheckError) throw recheckError;

            if (recheckRows && recheckRows.length > 0) {
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
              return;
            } else {
              // Still can't create user - return error
              console.error('❌ [save-google-user] Failed to create user due to duplicate:', insertErr);
              res.status(500).json({ 
                success: false,
                message: 'Failed to create user account. Please try again.',
                error: 'Duplicate entry conflict'
              });
              return;
            }
          } else {
            // Other insert error
            throw insertErr;
          }
        }
        
        console.log('✅ [save-google-user] New user created successfully:', { email, username });
        res.json({ 
          success: true, 
          message: 'User created successfully',
          isNewUser: true,
          username: username
        });
        return;
      } catch (insertErr) {
        throw insertErr;
      }
    } else {
      console.log('ℹ️ [save-google-user] User already exists:', email);
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
      return;
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
    return;
  }
}
