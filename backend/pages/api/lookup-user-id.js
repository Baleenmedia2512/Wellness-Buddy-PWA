import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  // Allow both GET and POST requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  // Extract email from query params (GET) or body (POST)
  const email = req.method === 'GET' ? req.query.email : req.body?.email;

  console.log('🔍 [lookup-user-id] Request received:', { email, method: req.method });

  if (!email) {
    console.log('❌ [lookup-user-id] Email is required');
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  try {
    // ⚡ No cache — always query DB fresh so Status changes reflect immediately
    const cacheKey = `user:lookup:${email}`;

    // Use Supabase REST API (bypasses blocked PostgreSQL ports)
    console.log('📊 [lookup-user-id] Using Supabase REST API');

    const supabase = getSupabaseClient();

    // Query user by email (note: lowercase column names in PostgreSQL)
    console.log('🔎 [lookup-user-id] Querying team_table for email:', email);

    const { data, error } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Status", "Role"')
      .eq('Email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ [lookup-user-id] Supabase query error:', error);
      throw new Error(error.message);
    }

    console.log('📋 [lookup-user-id] Query results:', { found: !!data, data });

    if (!data) {
      console.log('❌ [lookup-user-id] User not found in database');
      res.status(404).json({ 
        success: false, 
        message: 'User not found',
        userNotFound: true
      });
      return;
    }

    const user = data;

    // ── Auto-deactivation check ──────────────────────────────────────────────
    // If user is currently Active, check if they've been inactive for 31+ days
    if (user.Status === 'Active') {
      const lastActivityStr = user.LastActiveAt || user.EntryDateTime;
      if (lastActivityStr) {
        const lastActivity = new Date(lastActivityStr);
        const now = new Date();
        const diffDays = (now - lastActivity) / (1000 * 60 * 60 * 24);

        if (diffDays >= 31) {
          console.log(`⚠️ [lookup-user-id] User inactive for ${Math.floor(diffDays)} days — marking INACTIVE`);
          try {
            const { error: deactivateError } = await supabase
              .from('team_table')
              .update({ Status: 'Inactive' })
              .eq('"UserId"', user.UserId);

            if (deactivateError) {
              console.warn('⚠️ [lookup-user-id] Failed to auto-deactivate user:', deactivateError);
            } else {
              console.log('✅ [lookup-user-id] User auto-deactivated:', user.UserId);
              user.Status = 'Inactive';
            }
          } catch (err) {
            console.warn('⚠️ [lookup-user-id] Error during auto-deactivation:', err);
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const isActive = user.Status === 'Active';

    console.log('✅ [lookup-user-id] User found:', {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: isActive
    });

    if (!isActive) {
      console.log('⚠️ [lookup-user-id] User is INACTIVE - Status:', user.Status);
    } else {
      console.log('✅ [lookup-user-id] User is ACTIVE');
    }

    const response = {
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: isActive,
      role: user.Role || 'user'
    };

    console.log('📤 [lookup-user-id] Sending response:', response);

    // ⚡ No caching — always fetch fresh from DB so any manual Status change
    // (Active ↔ Inactive) reflects immediately on the user's next login.
    res.setHeader('X-Cache', 'MISS');

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [lookup-user-id] Error occurred:', error);
    console.error('❌ [lookup-user-id] Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      stack: error.stack,
      email: email
    });
    res.status(500).json({ 
      success: false, 
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message 
    });
  }
}