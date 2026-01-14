import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, userId } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Education log ID is required'
    });
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
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: set IsDeleted back to 0
    const { data, error } = await supabase
      .from('education_logs_table')
      .update({ "IsDeleted": 0 })
      .eq('"Id"', id)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education log not found'
      });
    }

    // Clear cache if userId provided
    if (userId) {
      cache.delete(cacheKeys.educationSummary(userId));
      console.log('🗑️ [undo-deleted-education-log] Cache cleared for user:', userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Education log restored successfully',
      restoredId: id
    });
  } catch (error) {
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore education log',
      error: error.message
    });
  }
}
