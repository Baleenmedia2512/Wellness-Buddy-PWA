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

  const { centerName, latitude, longitude, educationHour, ownerUserId, ownerPhone } = req.body;

  console.log('🏢 [register-nutrition-center] Request:', {
    centerName,
    latitude,
    longitude,
    educationHour,
    ownerUserId,
  });

  // Validation
  if (!centerName || !latitude || !longitude || !ownerUserId) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: centerName, latitude, longitude, ownerUserId',
    });
    return;
  }

  // Validate coordinates
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({
      success: false,
      message: 'Invalid coordinates',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Verify user exists in database
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId"')
      .eq('"UserId"', ownerUserId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // ✅ Any user can register a nutrition center (no coach restriction)

    // Check for duplicate centre name (case-insensitive, across all active centres)
    const { data: existing, error: dupError } = await supabase
      .from('nutrition_centers_table')
      .select('id, center_name')
      .ilike('center_name', centerName.trim())
      .eq('is_deleted', false)
      .maybeSingle();

    if (dupError) {
      console.error('❌ [register-nutrition-center] Duplicate check error:', dupError);
      throw new Error(dupError.message);
    }

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `This centre name is already taken. Please choose a different name.`,
        duplicate: true,
      });
    }

    // Insert nutrition center
    const { data: center, error: insertError } = await supabase
      .from('nutrition_centers_table')
      .insert({
        center_name: centerName,
        latitude: lat,
        longitude: lng,
        education_hour: educationHour || null,
        owner_user_id: ownerUserId,
        owner_phone: ownerPhone || null,
        status: 'active',
        is_deleted: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [register-nutrition-center] Insert error:', insertError);
      throw new Error(insertError.message);
    }

    console.log('✅ [register-nutrition-center] Success:', center.id);

    res.status(201).json({
      success: true,
      data: center,
      message: 'Nutrition center registered successfully',
    });

  } catch (error) {
    console.error('❌ [register-nutrition-center] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
