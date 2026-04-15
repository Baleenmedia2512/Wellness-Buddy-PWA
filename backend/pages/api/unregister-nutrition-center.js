import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { centerId, userId } = req.body;

  console.log('🗑️ [unregister-nutrition-center] Request:', { centerId, userId });

  if (!centerId || !userId) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: centerId, userId',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Check ownership
    const { data: center, error: centerError } = await supabase
      .from('nutrition_centers_table')
      .select('owner_user_id')
      .eq('id', centerId)
      .single();

    if (centerError || !center) {
      throw new Error('Center not found');
    }

    // Verify user is the owner or admin
    const { data: user } = await supabase
      .from('team_table')
      .select('"Role"')
      .eq('"UserId"', userId)
      .single();

    const isOwner = center.owner_user_id === parseInt(userId);
    const isAdmin = user && (user.Role === 'admin' || user.Role === 'developer');

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only the owner or admin can unregister this center',
      });
      return;
    }

    // Soft delete the center
    const { error: updateError } = await supabase
      .from('nutrition_centers_table')
      .update({
        status: 'inactive',
        is_deleted: true,
      })
      .eq('id', centerId);

    if (updateError) {
      console.error('❌ [unregister-nutrition-center] Update error:', updateError);
      throw new Error(updateError.message);
    }

    console.log('✅ [unregister-nutrition-center] Success:', centerId);

    res.status(200).json({
      success: true,
      message: 'Nutrition center unregistered successfully',
    });

  } catch (error) {
    console.error('❌ [unregister-nutrition-center] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
