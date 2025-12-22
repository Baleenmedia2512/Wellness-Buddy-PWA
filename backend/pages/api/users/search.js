/**
 * Search Coaches
 * GET /api/users/search?q={query}
 * 
 * Search for coaches by name or email
 * Only returns users with Role='admin' (coaches)
 * Used in upline coach selection
 */

import mysql from 'mysql2/promise';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get search query from URL params
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = q.trim();

    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    try {
      // Search for coaches by name or email
      const [coaches] = await connection.execute(
        `SELECT 
          UserId,
          UserName,
          Email,
          CoachName,
          TeamId
        FROM team_table
        WHERE (UserName LIKE ? OR Email LIKE ?)
          AND Status = 'Active'
        ORDER BY UserName ASC
        LIMIT 20`,
        [
          `%${searchQuery}%`,
          `%${searchQuery}%`
        ]
      );

      // Format results
      const results = coaches.map(coach => ({
        userId: coach.UserId,
        userName: coach.UserName,
        email: coach.Email,
        coachName: coach.CoachName || coach.UserName,
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
      await connection.end();
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
