import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { largeBodyConfig as config } from '../../utils/apiConfig.js';

export { config };

export default async function handler(req, res) {
  console.log('🔵 [save-background-analysis] Request received:', { method: req.method, timestamp: new Date().toISOString() });
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ [save-background-analysis] Method not allowed:', req.method);
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  // Check if request body is too large or malformed
  if (!req.body) {
    console.log('❌ [save-background-analysis] Request body is missing or too large');
    res.status(400).json({ 
      message: 'Request body is missing or too large. Maximum size is 10MB.' 
    });
    return;
  }

  const { userId, imagePath, analysisResult, timestamp, deviceInfo, ImageBase64 } = req.body;
  console.log('📝 [save-background-analysis] Request data:', { 
    userId, 
    imagePath, 
    hasAnalysisResult: !!analysisResult,
    deviceInfo,
    hasImageBase64: !!ImageBase64
  });

  if (!userId || !imagePath || !analysisResult) {
    console.log('❌ [save-background-analysis] Missing required fields:', { userId: !!userId, imagePath: !!imagePath, analysisResult: !!analysisResult });
    res.status(400).json({ 
      message: 'Missing required fields: userId, imagePath, analysisResult' 
    });
    return;
  }

  try {
    // Parse analysis result to extract nutrition values
    let totalCalories = null, totalProtein = null, totalCarbs = null, totalFat = null, totalFiber = null;
    let confidenceScore = null;
    let processedBy = 'manual_app'; // Default for manual saves (matches DB enum)
    
    // Function to convert confidence string to numeric value
    const convertConfidenceToNumeric = (confidence) => {
      if (typeof confidence === 'number') return confidence;
      if (typeof confidence === 'string') {
        switch (confidence.toLowerCase()) {
          case 'high': return 0.90;
          case 'medium': return 0.70;
          case 'low': return 0.50;
          case 'very_high': return 0.95;
          case 'very_low': return 0.30;
          default: return 0.70; // Default to medium confidence
        }
      }
      return null;
    };
    
    try {
      const analysis = typeof analysisResult === 'string' ? JSON.parse(analysisResult) : analysisResult;
      console.log('📊 [save-background-analysis] Parsed analysis:', { 
        hasFoods: !!analysis.foods, 
        foodsLength: analysis.foods?.length,
        hasTotal: !!analysis.total,
        hasNutrition: !!analysis.nutrition,
        confidence: analysis.confidence
      });
      
      // Check if this is from background service (has foods array with total)
      if (analysis.foods && analysis.foods.length > 0 && analysis.total) {
        // This is the standard format (both background service and manual save now use this)
        totalCalories = analysis.total.calories || null;
        totalProtein = analysis.total.protein || null;
        totalCarbs = analysis.total.carbs || null;
        totalFat = analysis.total.fat || null;
        totalFiber = analysis.total.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        // Determine source based on deviceInfo - only actual Android Background Service should be background_service
        processedBy = (deviceInfo && deviceInfo.includes('Android Background Service')) ? 'background_service' : 'manual_app';
        console.log('✅ [save-background-analysis] Using standard format (foods + total)');
      } else if (analysis.nutrition) {
        // Legacy manual save format - use nutrition object (keeping for backwards compatibility)
        totalCalories = analysis.nutrition.calories || null;
        totalProtein = analysis.nutrition.protein || null;
        totalCarbs = analysis.nutrition.carbs || null;
        totalFat = analysis.nutrition.fat || null;
        totalFiber = analysis.nutrition.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        processedBy = 'manual_app';
        console.log('✅ [save-background-analysis] Using legacy format (nutrition object)');
      } else if (analysis.foods && analysis.foods.length > 0) {
        // Fallback: extract from first food item (legacy format)
        const firstFood = analysis.foods[0];
        if (firstFood.nutrition) {
          totalCalories = firstFood.nutrition.calories || null;
          totalProtein = firstFood.nutrition.protein || null;
          totalCarbs = firstFood.nutrition.carbs || null;
          totalFat = firstFood.nutrition.fat || null;
          totalFiber = firstFood.nutrition.fiber || null;
        }
        confidenceScore = convertConfidenceToNumeric(firstFood.confidence || analysis.confidence);
        processedBy = 'background_service';
        console.log('✅ [save-background-analysis] Using fallback format (first food item)');
      }
      
      console.log('📊 [save-background-analysis] Extracted nutrition:', { 
        totalCalories, 
        totalProtein, 
        totalCarbs, 
        totalFat, 
        totalFiber,
        confidenceScore,
        processedBy
      });
    } catch (parseError) {
      console.warn('⚠️ [save-background-analysis] Could not parse nutrition data:', parseError);
    }

    // Database connection - Use Supabase REST API
    const supabase = getSupabaseClient();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (ImageBase64 && ImageBase64.trim() !== '') ? ImageBase64 : null;

    const analysisDataJson = typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult);

    console.log('💾 [save-background-analysis] Preparing to insert into Supabase:', {
      UserID: userId.toString(),
      ImagePath: imagePath.substring(0, 50) + '...',
      hasImageBase64: !!imageBase64ToSave,
      TotalCalories: totalCalories,
      ProcessedBy: processedBy
    });

    // Insert using Supabase - use PascalCase column names as they exist in Supabase
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .insert({
        UserID: userId.toString(),
        ImagePath: imagePath,
        AnalysisData: analysisDataJson,
        ConfidenceScore: confidenceScore,
        TotalCalories: totalCalories,
        TotalProtein: totalProtein,
        TotalCarbs: totalCarbs,
        TotalFat: totalFat,
        TotalFiber: totalFiber,
        ProcessedBy: processedBy,
        DeviceInfo: deviceInfo || (processedBy === 'background_service' ? 'Android Background Service' : 'Wellness Valley Web App'),
        ImageBase64: imageBase64ToSave,
        CreatedAt: currentTime,
        UpdatedAt: currentTime
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [save-background-analysis] Database save error:', error);
      console.error('❌ [save-background-analysis] Error code:', error.code);
      console.error('❌ [save-background-analysis] Error details:', error.details);
      console.error('❌ [save-background-analysis] Error hint:', error.hint);
      throw error;
    }

    console.log('✅ [save-background-analysis] Successfully saved to database, ID:', data?.ID);

    res.status(200).json({
      success: true,
      id: data?.ID || data?.id,
      message: 'Analysis saved successfully',
      data: {
        userId,
        imagePath: imagePath.substring(imagePath.lastIndexOf('/') + 1),
        nutrition: {
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber
        },
        confidence: confidenceScore,
        timestamp: new Date().toISOString()
      }
    });
    
    // Clear nutrition cache only (education is separate domain)
    cache.delete(cacheKeys.nutritionMeals(userId));
    console.log('🗑️ [save-background-analysis] Nutrition cache cleared for user:', userId);
    console.log('✅ [save-background-analysis] Response sent successfully');

  } catch (error) {
    console.error('❌ [save-background-analysis] Caught error:', error);
    console.error('❌ [save-background-analysis] Error code:', error.code);
    console.error('❌ [save-background-analysis] Error message:', error.message);
    console.error('❌ [save-background-analysis] Error stack:', error.stack);
    
    // Enhanced error messages for different error types
    let errorMessage = 'Failed to save analysis';
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please try again.';
    } else if (error.message?.includes('Connection terminated')) {
      errorMessage = 'Database connection was terminated. Retrying...';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused. Please check if database is accessible.';
    } else if (error.code === '23505') {
      errorMessage = 'Duplicate key error: The database sequence needs to be reset. Please contact support.';
      console.error('❌ [save-background-analysis] DUPLICATE KEY ERROR - Sequence out of sync!');
      console.error('❌ [save-background-analysis] Run this SQL in Supabase: SELECT setval(pg_get_serial_sequence(\'food_nutrition_data_table\', \'ID\'), (SELECT MAX("ID") FROM food_nutrition_data_table));');
    }
    
    console.error('❌ [save-background-analysis] Sending error response:', errorMessage);
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
