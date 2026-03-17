import { getSupabaseClient } from '../../utils/supabaseClient.js';
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { email } = req.query;

  console.log('👤 [get-user-profile] Request received:', { email });

  if (!email) {
    console.log('❌ [get-user-profile] Missing required field: email');
    res.status(400).json({
      success: false,
      message: 'Missing required query parameter: email',
    });
    return;
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

    const supabase = getSupabaseClient();

    // Fetch user profile from team_table using Supabase
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachName", "UplineCoachId", "PhoneNumber"')
      .eq('"Email"', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [get-user-profile] Query error:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      console.log('❌ [get-user-profile] User not found:', email);
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    console.log('✅ [get-user-profile] User found:', { userId: user.UserId, userName: user.UserName });

    // Fetch latest weight and BMR from weight_records_table
    const { data: weightRows, error: weightError } = await supabase
      .from('weight_records_table')
      .select('"Weight", "Bmr", "CreatedAt"')
      .eq('"UserId"', user.UserId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

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
    const height = user.Height ? parseFloat(user.Height) : null;
    const dietType = user.DietType || null;

    const phoneNumber = user.PhoneNumber || null;

    // A profile is considered complete when the three key mandatory fields are filled:
    // Height (needed for BMR formula), Diet Type (needed for AI food analysis), Phone Number.
    const profileComplete = !!(height && dietType && phoneNumber);

    const profileData = {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      height,
      dietType,
      phoneNumber,
      profileComplete,
      profileImage: user.ProfileImage || null,
      coachName: user.CoachName || null,
      uplineCoachId: user.UplineCoachId || null,
      latestWeight: null,
      latestBmr: null,
      weightRecordDate: null,
    };

    console.log('🎓 [get-user-profile] Coach info:', { 
      coachName: user.CoachName, 
      uplineCoachId: user.UplineCoachId 
    });

    if (weightError) {
      console.warn('⚠️ [get-user-profile] Weight query error:', weightError);
    } else if (weightRows && weightRows.length > 0) {
      const latestWeight = weightRows[0];
      profileData.latestWeight = latestWeight.Weight ? parseFloat(latestWeight.Weight) : null;
      profileData.latestBmr = latestWeight.Bmr ? parseFloat(latestWeight.Bmr) : null;
      profileData.weightRecordDate = latestWeight.CreatedAt;
    }
    
    console.log('📦 [get-user-profile] Compiled profile data:', {
      ...profileData,
      profileImage: profileData.profileImage ? '[IMAGE_DATA]' : null
    });

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
