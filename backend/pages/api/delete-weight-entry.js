import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  console.log('🔵 [delete-weight-entry] Request received:', { method: req.method });
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    console.log('❌ [delete-weight-entry] Method not allowed:', req.method);
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, entryId } = req.body;
  console.log('📝 [delete-weight-entry] Request data:', { userId, entryId });

  if (!userId || !entryId) {
    console.log('❌ [delete-weight-entry] Missing required fields');
    res.status(400).json({ 
      message: 'Missing required fields: userId, entryId' 
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Soft delete the entry (set IsDeleted = 1) using Supabase
    console.log('💾 [delete-weight-entry] Soft deleting entry:', entryId);
    const currentTime = getISTTimestamp();
    const { data: updateData, error: updateError } = await supabase
      .from('weight_records_table')
      .update({ IsDeleted: 1, UpdatedAt: currentTime })
      .eq('ID', entryId)
      .eq('UserId', userId)
      .select();

    if (updateError) {
      console.error('❌ [delete-weight-entry] Update error:', updateError);
      throw updateError;
    }
    
    if (!updateData || updateData.length === 0) {
      console.log('❌ [delete-weight-entry] Entry not found or unauthorized');
      res.status(404).json({
        success: false,
        message: 'Weight entry not found or unauthorized'
      });
      return;
    }

    console.log('✅ [delete-weight-entry] Entry deleted successfully');

    // Clear profile cache
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('Email')
      .eq('UserId', userId)
      .maybeSingle();
    
    if (!userError && user?.Email) {
      cache.delete(cacheKeys.userProfile(user.Email));
      console.log('🗑️ [delete-weight-entry] Cache cleared for user:', user.Email);
    }

    console.log('✅ [delete-weight-entry] Response sent successfully');
    res.status(200).json({
      success: true,
      message: 'Weight entry deleted successfully',
      deletedId: entryId
    });

  } catch (error) {
    console.error('❌ [delete-weight-entry] Caught error:', error);
    console.error('❌ [delete-weight-entry] Error message:', error.message);
    console.error('❌ [delete-weight-entry] Error code:', error.code);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete weight entry',
      error: error.message
    });
  }
}
