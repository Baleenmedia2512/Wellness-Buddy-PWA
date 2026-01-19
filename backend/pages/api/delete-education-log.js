import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  // Only accept DELETE
  if (req.method !== 'DELETE') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, logId } = req.body;

  // Validation
  if (!userId || !logId) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, logId'
    });
    return;
  }

  
  try {
    // Database connection
    const supabase = getSupabaseClient();

    // Soft delete: set IsDeleted = 1 (allows undo)
    const { data, error } = await supabase
      .from('education_logs_table')
      .update({ "IsDeleted": 1 })
      .eq('"Id"', logId)
      .eq('"UserId"', userId)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Education log not found or already deleted'
      });
      return;
    }

    // Clear cache
    cache.delete(cacheKeys.educationSummary(userId));
    console.log('🗑️ [delete-education-log] Cache cleared for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Education log deleted successfully',
      deletedId: logId
    });
    return;

  } catch (error) {
    console.error('❌ Delete education log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete education log',
      error: error.message
    });
    return;
  }
}
