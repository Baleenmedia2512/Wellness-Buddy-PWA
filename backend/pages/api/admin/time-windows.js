import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import { syncTaskWindowsAfterAdminChange } from '../../../features/tasks/api/sync-task-windows.handler.js';
import logger from '../../../shared/lib/logger.js';

/**
 * API: Admin Time Windows Management
 * GET: Fetch current active time windows
 * POST: Update time window with versioning
 * Uses Supabase REST API (consistent with other working APIs)
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  const supabase = getSupabaseClient();

  // GET: Fetch current time windows
  if (req.method === 'GET') {
    // Prevent Vercel/CDN caching so we always get fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const { data: rows, error } = await supabase
        .from('activity_time_windows_table')
        .select('ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, EffectiveToDate, ChangedBy, ChangeReason, CreatedAt')
        .is('EffectiveToDate', null)
        .order('ActivityType');

      if (error) {
        console.error('Error fetching time windows:', error);
        throw error;
      }

      // Sort by activity type order
      const activityOrder = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];
      const sortedRows = (rows || []).sort((a, b) => {
        return activityOrder.indexOf(a.ActivityType) - activityOrder.indexOf(b.ActivityType);
      });

      res.status(200).json({
        success: true,
        timeWindows: sortedRows.map(row => ({
          ...row,
          LastUpdated: row.CreatedAt
        }))
      });
      return;

    } catch (error) {
      console.error('Error fetching time windows:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
      return;
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
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['activityType', 'windowStartTime', 'windowEndTime', 'effectiveFromDate', 'changedBy']
        });
        return;
      }

      // Validate activity type
      const validActivities = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];
      if (!validActivities.includes(activityType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid activity type',
          validTypes: validActivities
        });
        return;
      }

      // Validate time format (HH:MM:SS or HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
      if (!timeRegex.test(windowStartTime) || !timeRegex.test(windowEndTime)) {
        res.status(400).json({
          success: false,
          error: 'Invalid time format. Use HH:MM or HH:MM:SS'
        });
        return;
      }

      // Ensure times have seconds
      const startTime = windowStartTime.length === 5 ? `${windowStartTime}:00` : windowStartTime;
      const endTime = windowEndTime.length === 5 ? `${windowEndTime}:00` : windowEndTime;
      
      // Validate start time is before end time
      if (startTime >= endTime) {
        res.status(400).json({
          success: false,
          error: 'Start time must be before end time',
          details: `Start: ${startTime}, End: ${endTime}`
        });
        return;
      }
      
      // Validate meal time windows don't overlap (only for meals)
      if (['breakfast', 'lunch', 'dinner'].includes(activityType)) {
        const { data: existingWindows, error: existingError } = await supabase
          .from('activity_time_windows_table')
          .select('ActivityType, WindowStartTime, WindowEndTime')
          .is('EffectiveToDate', null)
          .in('ActivityType', ['breakfast', 'lunch', 'dinner'])
          .neq('ActivityType', activityType);

        if (existingError) {
          console.error('Error checking existing windows:', existingError);
          throw existingError;
        }
        
        // Check for overlaps with other meal windows
        for (const existing of (existingWindows || [])) {
          const existingStart = existing.WindowStartTime;
          const existingEnd = existing.WindowEndTime;
          
          // Check if new window overlaps with existing window
          if (startTime < existingEnd && endTime > existingStart) {
            res.status(400).json({
              success: false,
              error: 'Time window overlaps with existing meal window',
              details: {
                conflictsWith: existing.ActivityType,
                existingWindow: `${existingStart} - ${existingEnd}`,
                requestedWindow: `${startTime} - ${endTime}`
              }
            });
            return;
          }
        }
      }

      // Close previous window by setting EffectiveToDate
      const { error: updateError } = await supabase
        .from('activity_time_windows_table')
        .update({ EffectiveToDate: effectiveFromDate })
        .eq('ActivityType', activityType)
        .is('EffectiveToDate', null);

      if (updateError) {
        console.error('Error closing previous window:', updateError);
        throw updateError;
      }

      // Insert new window
      const currentTime = getISTTimestamp();
      const { data: insertResult, error: insertError } = await supabase
        .from('activity_time_windows_table')
        .insert({
          ActivityType: activityType,
          WindowStartTime: startTime,
          WindowEndTime: endTime,
          EffectiveFromDate: effectiveFromDate,
          ChangedBy: changedBy,
          ChangeReason: changeReason || null,
          CreatedAt: currentTime
        })
        .select('Id')
        .single();

      if (insertError) {
        console.error('Error inserting new window:', insertError);
        throw insertError;
      }

      // Keep pending tasks + reminders aligned with the new active window row.
      try {
        const { updatedCount } = await syncTaskWindowsAfterAdminChange(
          activityType,
          effectiveFromDate,
        );
        logger.info('Pending tasks synced after time window change', {
          activityType,
          effectiveFromDate,
          updatedCount,
        });
      } catch (syncErr) {
        logger.error('Failed to sync pending tasks after window change (non-blocking)', {
          activityType,
          error: syncErr.message,
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Time window updated successfully',
        newWindowId: insertResult?.Id
      });
      return;

    } catch (error) {
      console.error('Error in time windows:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
      return;
    }
  }

  res.status(405).json({ 
    success: false, 
    error: 'Method not allowed',
    allowedMethods: ['GET', 'POST']
  });
  return;
}
