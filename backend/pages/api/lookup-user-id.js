import { getSupabaseClient } from '../../utils/supabaseClient.js';
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
    // Check cache first (2 minute TTL for user lookup)
    const cacheKey = `user:lookup:${email}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('✅ [lookup-user-id] Cache HIT for:', email);
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(cached);
      return;
    }

    // Use Supabase REST API (bypasses blocked PostgreSQL ports)
    console.log('📊 [lookup-user-id] Using Supabase REST API');

    const supabase = getSupabaseClient();

    // Query user by email (note: lowercase column names in PostgreSQL)
    console.log('🔎 [lookup-user-id] Querying team_table for email:', email);

    const { data, error } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Status", "Role"')
      .eq('"Email"', email)
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

    // Cache for 5 minutes (userId doesn't change, status checks are periodic)
    cache.set(cacheKey, response, 300000);
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