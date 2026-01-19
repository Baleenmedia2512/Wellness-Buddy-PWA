import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { email, name, height, bmr, dietType } = req.body;

  console.log('👤 [update-user-profile] Request received:', { email, name, height, bmr, dietType });

  // Validate required field
  if (!email) {
    console.log('❌ [update-user-profile] Missing required field: email');
    res.status(400).json({
      success: false,
      message: 'Missing required field: email',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    console.log('📊 [update-user-profile] Using Supabase REST API');

    // First, get the user to verify they exist and get their UserId
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('Email', email)
      .maybeSingle();

    if (userError || !user) {
      console.log('❌ [update-user-profile] User not found:', email);
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const userId = user.UserId;
    console.log('✅ [update-user-profile] User found:', { userId });

    // Build update data object for team_table
    const updateData = {};

    if (name !== undefined && name !== null) {
      updateData.UserName = name;
    }

    if (height !== undefined && height !== null) {
      updateData.Height = parseFloat(height);
    }

    if (dietType !== undefined && dietType !== null) {
      // Validate diet type
      const validDietTypes = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian'];
      if (validDietTypes.includes(dietType)) {
        updateData.DietType = dietType;
      } else {
        console.log('⚠️ [update-user-profile] Invalid diet type:', dietType);
      }
    }

    // Update team_table if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log('📝 [update-user-profile] Updating team_table:', updateData);
      const { error: updateError } = await supabase
        .from('team_table')
        .update(updateData)
        .eq('Email', email);
      
      if (updateError) throw updateError;
      console.log('✅ [update-user-profile] team_table updated successfully');
    }

    // Update BMR in the latest weight record if provided
    let savedBmr = null;
    if (bmr !== undefined && bmr !== null) {
      const bmrValue = parseFloat(bmr);
      if (!isNaN(bmrValue) && bmrValue >= 1100 && bmrValue <= 2200) {
        // Check if user has any weight records
        const { data: weightRecords, error: weightError } = await supabase
          .from('weight_records_table')
          .select('ID')
          .eq('UserId', userId)
          .order('CreatedAt', { ascending: false })
          .limit(1);

        if (weightError) throw weightError;

        if (weightRecords && weightRecords.length > 0) {
          // Update the latest weight record with BMR
          const { error: bmrUpdateError } = await supabase
            .from('weight_records_table')
            .update({ Bmr: bmrValue })
            .eq('ID', weightRecords[0].ID);
          
          if (bmrUpdateError) throw bmrUpdateError;
          console.log('✅ [update-user-profile] BMR updated in latest weight record:', bmrValue);
          savedBmr = bmrValue;
        } else {
          // No weight records exist - BMR will be saved with next weight entry
          console.log('⚠️ [update-user-profile] No weight records found, BMR will be saved with next weight entry');
          // Return the BMR value so frontend knows it was received (but not saved yet)
          savedBmr = bmrValue;
        }
      }
    }

    console.log('✅ [update-user-profile] Profile updated successfully');

    // PERFORMANCE OPTIMIZATION: Clear cached profile data
    // This ensures users see updated data immediately on next load
    try {
      cache.delete(cacheKeys.userProfile(email));
      console.log('🗑️ [update-user-profile] Cache cleared for:', email);
    } catch (cacheError) {
      // Don't fail the request if cache clear fails
      console.warn('⚠️ [update-user-profile] Cache clear failed:', cacheError.message);
    }

    const responseData = {
      success: true,
      message: 'User profile updated successfully',
      data: {
        email,
        name: name || undefined,
        height: height ? parseFloat(height) : undefined,
        bmr: savedBmr || undefined,
        dietType: dietType || undefined,
      },
    };

    console.log('📦 [update-user-profile] Response:', JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ [update-user-profile] Database error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message,
    });
  }
}
