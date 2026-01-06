import { getPool } from '../../../utils/dbPool.js';

/**
 * API: Admin Time Windows Management
 * GET: Fetch current active time windows
 * POST: Update time window with versioning
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // GET: Fetch current time windows
  if (req.method === 'GET') {
    try {
      const pool = getPool();

      const [rows] = await connection.query(`
        SELECT 
          ActivityType,
          WindowStartTime,
          WindowEndTime,
          EffectiveFromDate,
          EffectiveToDate,
          ChangedBy,
          ChangeReason,
          CreatedAt as LastUpdated
        FROM activity_time_windows_table
        WHERE EffectiveToDate IS NULL
        ORDER BY 
          FIELD(ActivityType, 'weight', 'education', 'breakfast', 'lunch', 'dinner')
      `);
return res.status(200).json({
        success: true,
        timeWindows: rows
      });

    } catch (error) {
      console.error('Error fetching time windows:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  // POST: Update time window
  if (req.method === 'POST') {
    try {
      const {
        activityType,
        windowStartTime,
        windowEndTime,
        effectiveFromDate,
        changedBy,
        changeReason
      } = req.body;

      // Validation
      if (!activityType || !windowStartTime || !windowEndTime || !effectiveFromDate || !changedBy) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['activityType', 'windowStartTime', 'windowEndTime', 'effectiveFromDate', 'changedBy']
        });
      }

      // Validate activity type
      const validActivities = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];
      if (!validActivities.includes(activityType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid activity type',
          validTypes: validActivities
        });
      }

      // Validate time format (HH:MM:SS or HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
      if (!timeRegex.test(windowStartTime) || !timeRegex.test(windowEndTime)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid time format. Use HH:MM or HH:MM:SS'
        });
      }

      // Ensure times have seconds
      const startTime = windowStartTime.length === 5 ? `${windowStartTime}:00` : windowStartTime;
      const endTime = windowEndTime.length === 5 ? `${windowEndTime}:00` : windowEndTime;
      
      // Validate start time is before end time
      if (startTime >= endTime) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be before end time',
          details: `Start: ${startTime}, End: ${endTime}`
        });
      }
      
      // Validate meal time windows don't overlap (only for meals)
      if (['breakfast', 'lunch', 'dinner'].includes(activityType)) {
        const pool = getPool();
        
        const [existingWindows] = await pool.query(`
          SELECT ActivityType, WindowStartTime, WindowEndTime
          FROM activity_time_windows_table
          WHERE EffectiveToDate IS NULL
            AND ActivityType IN ('breakfast', 'lunch', 'dinner')
            AND ActivityType != ?
        `, [activityType]);
        
        // Check for overlaps with other meal windows
        for (const existing of existingWindows) {
          const existingStart = existing.WindowStartTime;
          const existingEnd = existing.WindowEndTime;
          
          // Check if new window overlaps with existing window
          // Overlap occurs if: (newStart < existingEnd) AND (newEnd > existingStart)
          if (startTime < existingEnd && endTime > existingStart) {
            return res.status(400).json({
              success: false,
              error: 'Time window overlaps with existing meal window',
              details: {
                conflictsWith: existing.ActivityType,
                existingWindow: `${existingStart} - ${existingEnd}`,
                requestedWindow: `${startTime} - ${endTime}`
              }
            });
          }
        }
      }

      const pool = getPool();

      await connection.beginTransaction();

      try {
        // Close previous window by setting EffectiveToDate
        await connection.query(`
          UPDATE activity_time_windows_table
          SET EffectiveToDate = ?
          WHERE ActivityType = ?
            AND EffectiveToDate IS NULL
        `, [effectiveFromDate, activityType]);

        // Insert new window
        const [result] = await connection.query(`
          INSERT INTO activity_time_windows_table
          (ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, ChangedBy, ChangeReason)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          activityType,
          startTime,
          endTime,
          effectiveFromDate,
          changedBy,
          changeReason || null
        ]);

        await connection.commit();
return res.status(200).json({
          success: true,
          message: 'Time window updated successfully',
          newWindowId: result.insertId
        });

      } catch (error) {
        await connection.rollback();
throw error;
      }

    } catch (error) {
      console.error('Error updating time window:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  return res.status(405).json({ 
    success: false, 
    error: 'Method not allowed',
    allowedMethods: ['GET', 'POST']
  });
}
