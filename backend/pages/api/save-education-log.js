import { createClient } from '@supabase/supabase-js';
import { cache, cacheKeys } from '../../utils/cache.js';

// Initialize Supabase client (uses REST API via HTTPS - not blocked)
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

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
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.log('❌ [save-education-log] Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
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
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, platform, topic'
    });
  }

  
  try {
    const supabase = getSupabaseClient();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (imageBase64 && imageBase64.trim() !== '') ? imageBase64 : null;

    console.log('💾 [save-education-log] Inserting into Supabase...');
    
    // Insert into education_logs_table using Supabase
    const { data, error } = await supabase
      .from('education_logs_table')
      .insert({
        UserId: userId,
        Platform: platform,
        Topic: topic,
        Confidence: confidence || null,
        DeviceInfo: deviceInfo || null,
        ImageBase64: imageBase64ToSave
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
    return res.status(200).json({
      success: true,
      message: 'Education log saved successfully',
      id: data?.Id || data?.id || data?.ID
    });

  } catch (error) {
    console.error('❌ [save-education-log] Caught error:', error);
    console.error('❌ [save-education-log] Error message:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save education log',
      error: error.message
    });
  }
}
