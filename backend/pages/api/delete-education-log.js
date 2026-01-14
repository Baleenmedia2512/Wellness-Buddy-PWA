import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only accept DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, logId } = req.body;

  // Validation
  if (!userId || !logId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, logId'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Education log not found or already deleted'
      });
    }

    // Clear cache
    cache.delete(cacheKeys.educationSummary(userId));
    console.log('🗑️ [delete-education-log] Cache cleared for user:', userId);

    return res.status(200).json({
      success: true,
      message: 'Education log deleted successfully',
      deletedId: logId
    });

  } catch (error) {
    console.error('❌ Delete education log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete education log',
      error: error.message
    });
  }
}
