import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
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

  const { userId, imageBase64, platform, topic, confidence, participantCount, deviceInfo, latitude, longitude, attendanceType, nutritionCenterId, centerName, clientTimestamp, clientTimezoneOffset } = req.body;
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
    clientTimestamp,
    clientTimezoneOffset
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
    
    // Insert into education_logs_table using Supabase
    // Store everything in IST (Indian Standard Time)
    const currentTime = getISTTimestamp();
    
    // 🔍 DEBUG: Log education upload details with client time comparison
    const clientLocalTime = clientTimestamp ? new Date(clientTimestamp) : null;
    console.log('📚 Education Upload:', {
      userId,
      platform,
      topic,
      clientUploaded: clientTimestamp || 'Not provided',
      clientLocalTime: clientLocalTime ? clientLocalTime.toLocaleString('en-US', { hour12: true }) : 'N/A',
      clientTimezoneOffset,
      serverUTC: new Date().toISOString(),
      storedIST: currentTime,
      timeDifference: clientTimestamp ? `${Math.round((new Date() - clientLocalTime) / 1000)}s` : 'N/A',
      note: 'Compare client upload time vs stored IST'
    });
    
    const currentTimeOnly = new Date(currentTime).toTimeString().substring(0, 8);
    const isOnTime = currentTimeOnly >= educationWindow.start && currentTimeOnly <= educationWindow.end;
    
    console.log('⏰ [save-education-log] Time check:', {
      currentTime: currentTimeOnly,
      window: educationWindow,
      isOnTime: isOnTime ? '✅ ON-TIME' : '⚠️ LATE'
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
        CreatedAt: currentTime,
        UpdatedAt: currentTime
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [save-education-log] Database error:', error);
      console.error('❌ [save-education-log] Error code:', error.code);
      throw error;
    }
    
    console.log('✅ [save-education-log] Successfully saved, ID:', data?.ID);
    
    console.log('✅ [save-education-log] Successfully saved, ID:', data?.Id || data?.id || data?.ID);
    
    // Clear education summary cache for this user
    cache.delete(cacheKeys.educationSummary(userId));
    console.log('🗑️ [save-education-log] Cache cleared for user:', userId);
    
    console.log('✅ [save-education-log] Response sent successfully');
    res.status(200).json({
      success: true,
      message: 'Education log saved successfully',
      id: data?.Id || data?.id || data?.ID,
      attendanceType: attendanceType,
      isOnTime: currentTimeOnly >= educationWindow.start && currentTimeOnly <= educationWindow.end,
      timeWindow: educationWindow,
      uploadTime: currentTimeOnly
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
