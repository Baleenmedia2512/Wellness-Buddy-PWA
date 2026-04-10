import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { id, userId } = req.body;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Education log ID is required'
    });
    return;
  }

  
  try {
    const supabase = getSupabaseClient();

    // Optional safety check: ensure row belongs to user
    if (userId) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('education_logs_table')
        .select('"Id"')
        .eq('"Id"', id)
        .eq('"UserId"', userId)
        .limit(1);

      if (ownerError) throw ownerError;

      if (!ownerCheck || ownerCheck.length === 0) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
        return;
      }
    }

    // Restore: set IsDeleted back to 0
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('education_logs_table')
      .update({ "IsDeleted": 0, "UpdatedAt": currentTime })
      .eq('"Id"', id)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Education log not found'
      });
      return;
    }

    // Clear cache if userId provided
    if (userId) {
      cache.delete(cacheKeys.educationSummary(userId));
      console.log('🗑️ [undo-deleted-education-log] Cache cleared for user:', userId);
    }

    // Update LastActiveAt in team_table to track user activity
    if (userId) {
      try {
        const { error: activityUpdateError } = await supabase
          .from('team_table')
          .update({ LastActiveAt: getISTTimestamp() })
          .eq('UserId', userId);
        
        if (activityUpdateError) {
          console.warn('⚠️ [undo-deleted-education-log] Failed to update LastActiveAt:', activityUpdateError);
        } else {
          console.log('✅ [undo-deleted-education-log] Updated LastActiveAt for user:', userId);
        }
      } catch (err) {
        console.warn('⚠️ [undo-deleted-education-log] Error updating LastActiveAt:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Education log restored successfully',
      restoredId: id
    });
    return;
  } catch (error) {
    console.error('❌ Database undo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore education log',
      error: error.message
    });
    return;
  }
}
