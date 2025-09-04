// Test script to verify nutrition data transformation
// This simulates the transformation logic from nutritionSaveService.js

function transformToBackgroundServiceFormat(analysisResult) {
  try {
    if (!analysisResult) return analysisResult;
    
    // If already in background service format (has foods and total), return as-is
    if (analysisResult.foods && analysisResult.total) {
      return analysisResult;
    }
    
    // If in manual save format (has nutrition object), transform it
    if (analysisResult.nutrition) {
      const nutrition = analysisResult.nutrition;
      const detailedItems = analysisResult.detailedItems || [];
      
      // Create foods array from detailedItems if available, or create single food item
      const foods = detailedItems.length > 0 
        ? detailedItems.map(item => ({
            name: item.name || 'Unknown Food',
            portion: item.portionDescription || '1 serving',
            weight_g: typeof item.estimatedWeight === 'number' ? item.estimatedWeight : 100,
            nutrition: {
              calories: item.calories || 0,
              protein: item.protein || 0,
              carbs: item.carbs || 0,
              fat: item.fat || 0,
              fiber: item.fiber || 0
            }
          }))
        : [{
            name: analysisResult.category?.name || 'Unknown Food',
            portion: '1 serving',
            weight_g: 100,
            nutrition: {
              calories: nutrition.calories || 0,
              protein: nutrition.protein || 0,
              carbs: nutrition.carbs || 0,
              fat: nutrition.fat || 0,
              fiber: nutrition.fiber || 0
            }
          }];
      
      // Create total object from nutrition
      const total = {
        calories: nutrition.calories || 0,
        protein: nutrition.protein || 0,
        carbs: nutrition.carbs || 0,
        fat: nutrition.fat || 0,
        fiber: nutrition.fiber || 0
      };
      
      return {
        foods: foods,
        total: total,
        confidence: analysisResult.confidence || 'medium'
      };
    }
    
    // If in unknown format, return as-is
    return analysisResult;
    
  } catch (error) {
    console.error('[transformToBackgroundServiceFormat] Error transforming data:', error);
    return analysisResult; // Return original if transformation fails
  }
}

// Test with manual save format (like ID 6 in your example)
const manualSaveFormat = {
  "source": "Google Gemini AI - Fast Analysis",
  "category": {"name": "Margherita Pizza"},
  "itemCount": 1,
  "nutrition": {"fat": 50, "carbs": 180, "fiber": 5, "protein": 25, "calories": 1200},
  "confidence": "medium",
  "isRealData": true,
  "detailedItems": [{
    "fat": 50,
    "name": "Margherita Pizza",
    "carbs": 180,
    "fiber": 5,
    "protein": 25,
    "calories": 1200,
    "estimatedWeight": 400,
    "portionDescription": "1 whole pizza"
  }]
};

// Test with background service format (like ID 5 in your example)
const backgroundServiceFormat = {
  "foods": [{
    "name": "Dosa",
    "portion": "1 dosa",
    "weight_g": 100,
    "nutrition": {"fat": 5, "carbs": 25, "fiber": 1, "protein": 5, "calories": 150}
  }, {
    "name": "Coconut Chutney",
    "portion": "1/4 cup",
    "weight_g": 60,
    "nutrition": {"fat": 4, "carbs": 18, "fiber": 2, "protein": 1, "calories": 80}
  }],
  "total": {"fat": 10, "carbs": 46, "fiber": 3.5, "protein": 7, "calories": 250},
  "confidence": "medium"
};

console.log('\n=== TESTING NUTRITION DATA TRANSFORMATION ===\n');

console.log('1. Manual Save Format (ID 6 example):');
console.log('INPUT:', JSON.stringify(manualSaveFormat, null, 2));
const transformed1 = transformToBackgroundServiceFormat(manualSaveFormat);
console.log('OUTPUT:', JSON.stringify(transformed1, null, 2));

console.log('\n2. Background Service Format (ID 5 example):');
console.log('INPUT:', JSON.stringify(backgroundServiceFormat, null, 2));
const transformed2 = transformToBackgroundServiceFormat(backgroundServiceFormat);
console.log('OUTPUT:', JSON.stringify(transformed2, null, 2));

console.log('\n=== VERIFICATION ===');
console.log('Manual save transformed correctly:', transformed1.foods && transformed1.total && transformed1.total.calories === 1200);
console.log('Background service unchanged:', JSON.stringify(transformed2) === JSON.stringify(backgroundServiceFormat));
