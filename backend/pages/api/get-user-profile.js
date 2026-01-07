import { getPool, query } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.query;

  console.log('👤 [get-user-profile] Request received:', { email });

  if (!email) {
    console.log('❌ [get-user-profile] Missing required field: email');
    return res.status(400).json({
      success: false,
      message: 'Missing required query parameter: email',
    });
  }

  try {
    // DISABLED: Backend cache disabled for profile data to ensure fresh data after updates
    // User profiles change frequently and cache causes stale data issues
    // const cacheKey = cacheKeys.userProfile(email);
    // const cachedProfile = cache.get(cacheKey);
    // if (cachedProfile) {
    //   console.log('✅ [get-user-profile] Cache HIT for:', email);
    //   res.setHeader('X-Cache', 'HIT');
    //   return res.status(200).json(cachedProfile);
    // }

    console.log('📊 [get-user-profile] Fetching fresh profile data for:', email);

    // Use connection pool - no need to manually close
    const pool = getPool();
    
    // Fetch user profile from team_table
    const [userRows] = await pool.execute(
      `SELECT UserId, UserName, Email, Height, DietType 
       FROM team_table 
       WHERE Email = ? 
       LIMIT 1`,
      [email]
    );

    if (userRows.length === 0) {
      console.log('❌ [get-user-profile] User not found:', email);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];
    console.log('✅ [get-user-profile] User found:', { userId: user.UserId, userName: user.UserName });

    // Fetch latest weight and BMR from weight_records_table
    const [weightRows] = await pool.execute(
      `SELECT Weight, Bmr, CreatedAt 
       FROM weight_records_table 
       WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
       ORDER BY CreatedAt DESC 
       LIMIT 1`,
      [user.UserId]
    );

    // Helper function to format date as local time string (without UTC conversion)
    // MySQL stores local time, but mysql2 returns Date objects which get serialized as UTC
    const formatDateAsLocal = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.getFullYear() + '-' +
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0') + 'T' +
          String(date.getHours()).padStart(2, '0') + ':' +
          String(date.getMinutes()).padStart(2, '0') + ':' +
          String(date.getSeconds()).padStart(2, '0');
      }
      return date;
    };

    // Build response
    const profileData = {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      height: user.Height ? parseFloat(user.Height) : null,
      dietType: user.DietType || null,
      latestWeight: null,
      latestBmr: null,
      weightRecordDate: null,
    };

    if (weightRows.length > 0) {
      profileData.latestWeight = weightRows[0].Weight ? parseFloat(weightRows[0].Weight) : null;
      profileData.latestBmr = weightRows[0].Bmr ? parseFloat(weightRows[0].Bmr) : null;
      profileData.weightRecordDate = formatDateAsLocal(weightRows[0].CreatedAt);
    }
    
    console.log('📦 [get-user-profile] Compiled profile data:', profileData);

    console.log('✅ [get-user-profile] Profile data retrieved successfully');

    const response = {
      success: true,
      data: profileData,
    };

    // DISABLED: Backend cache disabled to ensure fresh data
    // cache.set(cacheKey, response, 300000);
    res.setHeader('X-Cache', 'MISS');
    
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [get-user-profile] Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
      error: error.message,
    });
  }
}
