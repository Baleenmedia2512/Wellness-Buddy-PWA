import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

/**
 * API: Get Education Summary Statistics
 * Returns overall stats independent of paginated logs
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    // Check cache first (3 minute TTL)
    const cacheKey = cacheKeys.educationSummary(userId);
    const cached = cache.get(cacheKey);
    
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // Use connection pool to avoid ETIMEDOUT errors
    const supabase = getSupabaseClient();

    // Get all education logs for calculations (limit to recent for performance)
    const { data: allLogs, error: allLogsError } = await supabase
      .from('education_logs_table')
      .select('"CreatedAt", "Platform"')
      .eq('"UserId"', userId)
      .eq('"IsDeleted"', 0)
      .order('"CreatedAt"', { ascending: false })
      .limit(1000);

    if (allLogsError) throw allLogsError;

    const logs = allLogs || [];

    // Calculate total sessions count
    const totalSessions = logs.length;

    // Calculate this month count
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthCount = logs.filter(log => {
      const logDate = new Date(log.CreatedAt);
      return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    }).length;

    // Calculate platform usage counts
    const platformCounts = {};
    logs.forEach(log => {
      platformCounts[log.Platform] = (platformCounts[log.Platform] || 0) + 1;
    });
    const platformsResult = Object.entries(platformCounts)
      .map(([platform, count]) => ({ Platform: platform, count }))
      .sort((a, b) => b.count - a.count);

    // Get last 7 days activity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7DaysLogs = logs.filter(log => new Date(log.CreatedAt) >= sevenDaysAgo);
    const last7DaysCount = last7DaysLogs.length;
    
    const last7DaysDateSet = new Set();
    last7DaysLogs.forEach(log => {
      const date = new Date(log.CreatedAt);
      date.setHours(0, 0, 0, 0);
      last7DaysDateSet.add(date.toISOString().split('T')[0]);
    });
    const last7DaysDates = Array.from(last7DaysDateSet).sort();

    // Calculate current streak
    let currentStreak = 0;
    if (logs.length > 0) {
      const dates = logs.map(row => new Date(row.CreatedAt).toDateString());
      const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toDateString();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      // Streak must start from today or yesterday
      if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
        currentStreak = 0;
      } else {
        // Start from the most recent day (today or yesterday)
        let checkDate = new Date(today);
        if (!uniqueDates.includes(todayStr)) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        
        // Count consecutive days going backwards
        while (uniqueDates.includes(checkDate.toDateString())) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    const topPlatform = platformsResult.length > 0 ? platformsResult[0].Platform : null;
    const platformsInUse = platformsResult.length;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const response = {
      success: true,
      summary: {
        totalSessions,
        monthCount,
        topPlatform,
        platformsInUse,
        last7DaysCount,
        last7DaysDates,
        currentStreak
      }
    };

    // Cache for 3 minutes
    cache.set(cacheKey, response, 180000);
    res.setHeader('X-Cache', 'MISS');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error fetching education summary:', error);
    
    // Set CORS headers even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(500).json({ 
      success: false, 
      message: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : 'Failed to fetch education summary',
      error: error.message 
    });
  }
}
