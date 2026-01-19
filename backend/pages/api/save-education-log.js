import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

  const { userId, imageBase64, platform, topic, confidence, deviceInfo } = req.body;
  console.log('📝 [save-education-log] Request data:', { 
    userId, 
    platform, 
    topic, 
    confidence,
    hasImageBase64: !!imageBase64 
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
    
    // Insert into education_logs_table using Supabase
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('education_logs_table')
      .insert({
        UserId: userId,
        Platform: platform,
        Topic: topic,
        Confidence: confidence || null,
        DeviceInfo: deviceInfo || null,
        ImageBase64: imageBase64ToSave,
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
      id: data?.Id || data?.id || data?.ID
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
