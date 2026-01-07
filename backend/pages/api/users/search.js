/**
 * Search Coaches
 * GET /api/users/search?q={query}
 * 
 * Search for coaches by name or email
 * Only returns users with Role='admin' (coaches)
 * Used in upline coach selection
 */

import { getPool } from '../../../utils/dbPool.js';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get search query and current user email from URL params
    const { q, email: currentUserEmail } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = q.trim();

    // Helper function to mask email like nam*****xyz@gmail.com
    const maskEmail = (email) => {
      if (!email) return '';
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 6) {
        // Short email: show first 2 and last 1
        const visible = localPart.substring(0, 2);
        const last = localPart.substring(localPart.length - 1);
        return `${visible}***${last}@${domain}`;
      }
      // Longer email: show first 3 and last 3
      const start = localPart.substring(0, 3);
      const end = localPart.substring(localPart.length - 3);
      return `${start}*****${end}@${domain}`;
    };

    // Connect to database
    const pool = getPool();

    try {
      // Search for coaches by name or email, excluding current user
      const [coaches] = await pool.execute(
        `SELECT 
          UserId,
          UserName,
          Email,
          CoachName,
          TeamId
        FROM team_table
        WHERE (UserName LIKE ? OR Email LIKE ?)
          AND Status = 'Active'
          AND Email != ?
        ORDER BY UserName ASC
        LIMIT 20`,
        [
          `%${searchQuery}%`,
          `%${searchQuery}%`,
          currentUserEmail || ''
        ]
      );

      // Format results with masked email
      const results = coaches.map(coach => ({
        userId: coach.UserId,
        userName: coach.UserName,
        email: maskEmail(coach.Email),
        displayName: coach.CoachName || coach.UserName,
        teamId: coach.TeamId,
        hasTeamId: !!coach.TeamId
      }));

      return res.status(200).json({
        success: true,
        query: searchQuery,
        count: results.length,
        coaches: results,
        message: results.length === 0 ? 'No coaches found matching your search' : undefined
      });

    } finally {
}

  } catch (error) {
    console.error('Error searching coaches:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to search coaches',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
