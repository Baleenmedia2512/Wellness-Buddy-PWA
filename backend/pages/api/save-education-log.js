import { getSupabaseClient, getISTTimestamp, convertToIST } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { largeBodyConfig as config } from '../../utils/apiConfig.js';
import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';

export { config };

export default async function handler(req, res) {
  console.log('🔵 [save-education-log] Request received:', { method: req.method });
  
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.log('❌ [save-education-log] Method not allowed:', req.method);
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, imageBase64, platform, topic, confidence, participantCount, deviceInfo, latitude, longitude, attendanceType, nutritionCenterId, centerName, imageTimestamp } = req.body;
  console.log('📝 [save-education-log] Request data:', { 
    userId, 
    platform, 
    topic, 
    confidence,
    participantCount,
    hasImageBase64: !!imageBase64,
    attendanceType,
    hasLocation: !!(latitude && longitude),
    nutritionCenterId,
    centerName,
    imageTimestamp: imageTimestamp || 'NOT PROVIDED (will use server time)'
  });

  // Validation
  if (!userId || !platform || !topic) {
    console.log('❌ [save-education-log] Missing required fields');
    res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, platform, topic'
    });
    return;
  }

  
  try {
    const supabase = getSupabaseClient();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (imageBase64 && imageBase64.trim() !== '') ? imageBase64 : null;

    console.log('💾 [save-education-log] Inserting into Supabase...');
    
    // Get education time window and check if current time is within it
    const timeWindows = await getTimeWindows();
    const educationWindow = timeWindows.education || { start: '05:00:00', end: '23:59:00' };
    
    // Convert timestamp to IST (whether from EXIF or server time)
    let logTimestampIST, logTimeOnlyIST, deviceTime;
    
    if (imageTimestamp) {
      // User provided EXIF timestamp (could be from any timezone)
      const istConversion = convertToIST(imageTimestamp);
      logTimestampIST = istConversion.istTimestamp;
      logTimeOnlyIST = istConversion.istTimeOnly;
      deviceTime = istConversion.originalDeviceTime;
      
      console.log('📸 Using EXIF timestamp from user device');
    } else {
      // No EXIF - use server time (already in IST)
      logTimestampIST = getISTTimestamp();
      // Extract time directly from the already-formatted IST string "YYYY-MM-DD HH:MM:SS.mmm"
      // Avoids new Date(string).toTimeString() which is server-timezone-dependent
      logTimeOnlyIST = logTimestampIST.substring(11, 19);
      deviceTime = null;
      
      console.log('🖥️ Using server timestamp (no EXIF available)');
    }
    
    // Validate against education time window (in IST)
    const isOnTime = logTimeOnlyIST >= educationWindow.start && logTimeOnlyIST <= educationWindow.end;
    
    console.log('⏰ [save-education-log] Time check:', {
      deviceTime: deviceTime || 'N/A',
      istTimestamp: logTimestampIST,
      istTime: logTimeOnlyIST,
      educationWindow: educationWindow,
      isOnTime: isOnTime ? '✅ ON-TIME' : '⚠️ LATE',
      note: 'All times validated and stored in IST'
    });

    const { data, error } = await supabase
      .from('education_logs_table')
      .insert({
        UserId: userId,
        Platform: platform,
        Topic: topic,
        Confidence: confidence || null,
        DeviceInfo: deviceInfo || null,
        ImageBase64: imageBase64ToSave,
        latitude: latitude || null,
        longitude: longitude || null,
        attendance_type: attendanceType || null,
        nutrition_center_id: nutritionCenterId || null,
        participant_count: participantCount || null,
        center_name: centerName || null,
        IsDeleted: false,
        CreatedAt: logTimestampIST, // Always stored in IST
        UpdatedAt: logTimestampIST
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [save-education-log] Database error:', error);
      console.error('❌ [save-education-log] Error code:', error.code);
      throw error;
    }
    
    console.log('✅ [save-education-log] Successfully saved, ID:', data?.Id || data?.id || data?.ID);
    
    // Update LastActiveAt in team_table to track user activity
    try {
      const { error: activityUpdateError } = await supabase
        .from('team_table')
        .update({ LastActiveAt: getISTTimestamp() })
        .eq('UserId', userId);
      
      if (activityUpdateError) {
        console.warn('⚠️ [save-education-log] Failed to update LastActiveAt:', activityUpdateError);
      } else {
        console.log('✅ [save-education-log] Updated LastActiveAt for user:', userId);
      }
    } catch (err) {
      console.warn('⚠️ [save-education-log] Error updating LastActiveAt:', err);
    }
    
    // Clear education summary cache for this user
    cache.delete(cacheKeys.educationSummary(userId));
    console.log('🗑️ [save-education-log] Cache cleared for user:', userId);
    
    console.log('✅ [save-education-log] Response sent successfully');
    res.status(200).json({
      success: true,
      message: 'Education log saved successfully',
      id: data?.Id || data?.id || data?.ID,
      attendanceType: attendanceType,
      isOnTime: isOnTime,
      timeWindow: educationWindow,
      uploadTime: logTimeOnlyIST,
      logTimestamp: logTimestampIST,
      deviceTime: deviceTime,
      timestampSource: imageTimestamp ? 'EXIF (converted to IST)' : 'server (IST)',
      timezone: 'IST (UTC+5:30)'
    });
    return;

  } catch (error) {
    console.error('❌ [save-education-log] Caught error:', error);
    console.error('❌ [save-education-log] Error message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save education log',
      error: error.message
    });
    return;
  }
}
