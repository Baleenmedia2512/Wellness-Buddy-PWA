import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

/**
 * API: Get Education Summary Statistics
 * Returns overall stats independent of paginated logs
 */
export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    const pool = getPool();

    // Get total sessions count
    const [totalResult] = await pool.execute(
      `SELECT COUNT(*) as totalSessions 
       FROM education_logs_table 
       WHERE UserId = ? AND IsDeleted = 0`,
      [userId]
    );

    // Get this month count
    const [monthResult] = await pool.execute(
      `SELECT COUNT(*) as monthCount 
       FROM education_logs_table 
       WHERE UserId = ? 
       AND IsDeleted = 0 
       AND YEAR(CreatedAt) = YEAR(CURDATE()) 
       AND MONTH(CreatedAt) = MONTH(CURDATE())`,
      [userId]
    );

    // Get platform usage counts
    const [platformsResult] = await pool.execute(
      `SELECT Platform, COUNT(*) as count 
       FROM education_logs_table 
       WHERE UserId = ? AND IsDeleted = 0 
       GROUP BY Platform 
       ORDER BY count DESC`,
      [userId]
    );

    // Get last 7 days activity (which days had sessions)
    const [last7DaysResult] = await pool.execute(
      `SELECT DATE(CreatedAt) as sessionDate 
       FROM education_logs_table 
       WHERE UserId = ? 
       AND IsDeleted = 0 
       AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(CreatedAt)`,
      [userId]
    );

    // Get total sessions count in last 7 days
    const [last7DaysCountResult] = await pool.execute(
      `SELECT COUNT(*) as sessionCount 
       FROM education_logs_table 
       WHERE UserId = ? 
       AND IsDeleted = 0 
       AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [userId]
    );

    // Calculate streak (consecutive days with sessions)
    const [streakResult] = await pool.execute(
      `SELECT DATE(CreatedAt) as sessionDate 
       FROM education_logs_table 
       WHERE UserId = ? AND IsDeleted = 0 
       ORDER BY CreatedAt DESC 
       LIMIT 100`,
      [userId]
    );

    // Calculate current streak
    let currentStreak = 0;
    if (streakResult.length > 0) {
      const dates = streakResult.map(row => new Date(row.sessionDate).toDateString());
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

    const totalSessions = totalResult[0].totalSessions;
    const monthCount = monthResult[0].monthCount;
    const topPlatform = platformsResult.length > 0 ? platformsResult[0].Platform : null;
    const platformsInUse = platformsResult.length;
    const last7DaysCount = last7DaysCountResult[0].sessionCount;
    const last7DaysDates = last7DaysResult.map(row => row.sessionDate);

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
