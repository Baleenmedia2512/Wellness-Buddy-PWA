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

  const { id, userId } = req.body; // userId optional but recommended for safety

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Weight entry ID is required'
    });
    return;
  }

  
  try {
    const supabase = getSupabaseClient();

    // OPTIONAL safety: ensure this row belongs to the user
    if (userId) {
      const { data: ownerCheck, error: checkError } = await supabase
        .from('weight_records_table')
        .select('"ID"')
        .eq('"ID"', id)
        .eq('"UserId"', userId)
        .limit(1);

      if (checkError) throw checkError;
      
      if (!ownerCheck || ownerCheck.length === 0) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
        return;
      }
    }

    // Restore: flip IsDeleted back to 0
    const currentTime = getISTTimestamp();
    const { data: result, error: updateError } = await supabase
      .from('weight_records_table')
      .update({ IsDeleted: 0, UpdatedAt: currentTime })
      .eq('"ID"', id)
      .select();

    if (updateError) throw updateError;
    
    if (!result || result.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Weight entry not found'
      });
      return;
    }

    // Clear profile cache if userId provided
    if (userId) {
      const { data: user, error: userError } = await supabase
        .from('team_table')
        .select('"Email"')
        .eq('"UserId"', userId)
        .limit(1);

      if (userError) throw userError;
      
      if (user && user.length > 0 && user[0].Email) {
        cache.delete(cacheKeys.userProfile(user[0].Email));
        console.log('🗑️ [undo-deleted-weight-entry] Cache cleared for user:', user[0].Email);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Weight entry restored successfully',
      restoredId: id
    });
    return;
  } catch (error) {
    console.error('❌ Database undo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore weight entry',
      error: error.message
    });
    return;
  }
}
