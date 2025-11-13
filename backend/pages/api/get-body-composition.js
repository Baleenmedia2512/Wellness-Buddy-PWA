/**
 * API Endpoint: Get Body Composition History
 * GET /api/get-body-composition
 * 
 * Retrieves body composition entries with statistics and trends
 */

import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use GET.' 
    });
  }

  try {
    const { userId, date, limit = 30 } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wellness_buddy'
    });

    // Build query based on filters
    let query = `
      SELECT * FROM body_composition_entries
      WHERE UserID = ? AND DeletedAt IS NULL
    `;
    const params = [userId];

    // Add date filter if provided
    if (date) {
      query += ` AND DATE(CreatedAt) = ?`;
      params.push(date);
    }

    query += ` ORDER BY CreatedAt DESC LIMIT ?`;
    params.push(parseInt(limit));

    // Execute query
    const [entries] = await connection.execute(query, params);

    // Calculate statistics
    let stats = {
      totalEntries: 0,
      currentWeight: null,
      currentWeightUnit: 'kg',
      weightChange: 0,
      changeDirection: 'stable',
      currentBMI: null,
      currentBodyFat: null,
      currentMuscleMass: null,
      currentBMR: null,
      averageWeight: 0,
      minWeight: null,
      maxWeight: null
    };

    if (entries.length > 0) {
      // Current (latest) values
      const latest = entries[0];
      stats.currentWeight = parseFloat(latest.Weight);
      stats.currentWeightUnit = latest.WeightUnit;
      stats.currentBMI = latest.BMI ? parseFloat(latest.BMI) : null;
      stats.currentBodyFat = latest.BodyFatPercentage ? parseFloat(latest.BodyFatPercentage) : null;
      stats.currentMuscleMass = latest.MuscleMass ? parseFloat(latest.MuscleMass) : null;
      stats.currentBMR = latest.BMR ? parseInt(latest.BMR) : null;

      // Get all-time stats (not date-filtered)
      const [allEntries] = await connection.execute(
        `SELECT Weight, CreatedAt FROM body_composition_entries
         WHERE UserID = ? AND DeletedAt IS NULL
         ORDER BY CreatedAt DESC`,
        [userId]
      );

      stats.totalEntries = allEntries.length;

      if (allEntries.length > 1) {
        // Calculate weight change from oldest to newest
        const oldest = allEntries[allEntries.length - 1];
        const weightChange = stats.currentWeight - parseFloat(oldest.Weight);
        stats.weightChange = weightChange;
        
        if (weightChange < -0.1) {
          stats.changeDirection = 'loss';
        } else if (weightChange > 0.1) {
          stats.changeDirection = 'gain';
        }

        // Calculate average, min, max
        const weights = allEntries.map(e => parseFloat(e.Weight));
        stats.averageWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
        stats.minWeight = Math.min(...weights);
        stats.maxWeight = Math.max(...weights);
      }
    }

    await connection.end();

    console.log('✅ Body composition history retrieved:', entries.length, 'entries');

    return res.status(200).json({
      success: true,
      message: 'Body composition history retrieved successfully',
      data: entries,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching body composition:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch body composition history',
      error: error.message
    });
  }
}
