/**
 * Nutrition Fallback Service
 * Provides nutrition estimates when AI returns 0 or missing values
 * Especially for common Indian foods
 */

// Common Indian foods with typical nutrition (per 100g base, adjusted for typical serving)
const INDIAN_FOOD_DATABASE = {
  // Rice dishes
  'lemon rice': { 
    calories: 230, protein: 4, carbs: 45, fat: 5, fiber: 2, 
    servingSize: 150, unit: 'g', 
    description: '1 cup cooked lemon rice'
  },
  'biryani': { 
    calories: 350, protein: 12, carbs: 48, fat: 12, fiber: 3, 
    servingSize: 200, unit: 'g',
    description: '1 plate vegetable biryani'
  },
  'fried rice': { 
    calories: 280, protein: 6, carbs: 42, fat: 10, fiber: 2, 
    servingSize: 150, unit: 'g',
    description: '1 cup fried rice'
  },
  'curd rice': { 
    calories: 150, protein: 5, carbs: 28, fat: 2, fiber: 1, 
    servingSize: 150, unit: 'g',
    description: '1 cup curd rice'
  },
  'jeera rice': { 
    calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 2, 
    servingSize: 150, unit: 'g',
    description: '1 cup cumin rice'
  },
  'pulao': { 
    calories: 260, protein: 6, carbs: 44, fat: 7, fiber: 3, 
    servingSize: 150, unit: 'g',
    description: '1 cup vegetable pulao'
  },
  
  // South Indian
  'idli': { 
    calories: 39, protein: 2, carbs: 8, fat: 0.2, fiber: 1, 
    servingSize: 40, unit: 'g',
    description: '1 piece idli'
  },
  'dosa': { 
    calories: 133, protein: 4, carbs: 20, fat: 4, fiber: 2, 
    servingSize: 70, unit: 'g',
    description: '1 medium dosa'
  },
  'masala dosa': { 
    calories: 280, protein: 7, carbs: 40, fat: 10, fiber: 4, 
    servingSize: 150, unit: 'g',
    description: '1 masala dosa'
  },
  'vada': { 
    calories: 160, protein: 4, carbs: 16, fat: 9, fiber: 2, 
    servingSize: 50, unit: 'g',
    description: '1 piece medu vada'
  },
  'sambhar': { 
    calories: 80, protein: 4, carbs: 12, fat: 2, fiber: 3, 
    servingSize: 150, unit: 'ml',
    description: '1 bowl sambhar'
  },
  'upma': { 
    calories: 180, protein: 5, carbs: 30, fat: 5, fiber: 3, 
    servingSize: 150, unit: 'g',
    description: '1 bowl upma'
  },
  'pongal': { 
    calories: 220, protein: 6, carbs: 35, fat: 6, fiber: 2, 
    servingSize: 150, unit: 'g',
    description: '1 bowl pongal'
  },
  
  // Curries
  'dal': { 
    calories: 120, protein: 8, carbs: 18, fat: 2, fiber: 5, 
    servingSize: 150, unit: 'ml',
    description: '1 bowl dal'
  },
  'curry': { 
    calories: 110, protein: 4, carbs: 12, fat: 5, fiber: 3, 
    servingSize: 150, unit: 'ml',
    description: '1 bowl mixed vegetable curry'
  },
  'paneer butter masala': { 
    calories: 280, protein: 12, carbs: 10, fat: 22, fiber: 2, 
    servingSize: 150, unit: 'ml',
    description: '1 bowl paneer butter masala'
  },
  'chicken curry': { 
    calories: 220, protein: 18, carbs: 8, fat: 14, fiber: 2, 
    servingSize: 150, unit: 'ml',
    description: '1 bowl chicken curry'
  },
  
  // Breads
  'chapati': { 
    calories: 104, protein: 3, carbs: 18, fat: 3, fiber: 2, 
    servingSize: 40, unit: 'g',
    description: '1 medium chapati'
  },
  'roti': { 
    calories: 104, protein: 3, carbs: 18, fat: 3, fiber: 2, 
    servingSize: 40, unit: 'g',
    description: '1 medium roti'
  },
  'naan': { 
    calories: 262, protein: 8, carbs: 45, fat: 5, fiber: 2, 
    servingSize: 90, unit: 'g',
    description: '1 medium naan'
  },
  'paratha': { 
    calories: 280, protein: 6, carbs: 35, fat: 12, fiber: 3, 
    servingSize: 100, unit: 'g',
    description: '1 medium paratha'
  },
  'poori': { 
    calories: 160, protein: 3, carbs: 18, fat: 9, fiber: 1, 
    servingSize: 40, unit: 'g',
    description: '1 piece poori'
  },
  
  // Snacks
  'samosa': { 
    calories: 252, protein: 5, carbs: 28, fat: 13, fiber: 3, 
    servingSize: 75, unit: 'g',
    description: '1 medium samosa'
  },
  'pakora': { 
    calories: 180, protein: 4, carbs: 18, fat: 10, fiber: 2, 
    servingSize: 50, unit: 'g',
    description: '2-3 pieces pakora'
  },
  'bhaji': { 
    calories: 180, protein: 4, carbs: 18, fat: 10, fiber: 2, 
    servingSize: 50, unit: 'g',
    description: '1 serving bhaji'
  },
  
  // Beverages
  'coconut water': { 
    calories: 46, protein: 1.7, carbs: 9, fat: 0.5, fiber: 2.6, 
    servingSize: 250, unit: 'ml',
    description: '1 glass coconut water'
  },
  'milk': { 
    calories: 150, protein: 8, carbs: 12, fat: 8, fiber: 0, 
    servingSize: 250, unit: 'ml',
    description: '1 glass whole milk'
  },
  'tea': { 
    calories: 30, protein: 1, carbs: 5, fat: 0.5, fiber: 0, 
    servingSize: 150, unit: 'ml',
    description: '1 cup tea with milk and sugar'
  },
  'coffee': { 
    calories: 30, protein: 1, carbs: 5, fat: 0.5, fiber: 0, 
    servingSize: 150, unit: 'ml',
    description: '1 cup coffee with milk and sugar'
  },
  'juice': { 
    calories: 120, protein: 1, carbs: 28, fat: 0, fiber: 0.5, 
    servingSize: 250, unit: 'ml',
    description: '1 glass fruit juice'
  },
  
  // Zero-calorie items
  'water': { 
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, 
    servingSize: 250, unit: 'ml',
    description: '1 glass water'
  },
  'black tea': { 
    calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, 
    servingSize: 150, unit: 'ml',
    description: '1 cup black tea'
  },
  'black coffee': { 
    calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, 
    servingSize: 150, unit: 'ml',
    description: '1 cup black coffee'
  },
  'green tea': { 
    calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, 
    servingSize: 150, unit: 'ml',
    description: '1 cup green tea'
  }
};

// Food category averages (per 100g) for unknown foods
const CATEGORY_AVERAGES = {
  'rice': { calories: 150, protein: 3, carbs: 33, fat: 3, fiber: 2 },
  'bread': { calories: 260, protein: 8, carbs: 45, fat: 5, fiber: 3 },
  'curry': { calories: 80, protein: 3, carbs: 10, fat: 4, fiber: 2 },
  'dal': { calories: 100, protein: 7, carbs: 16, fat: 2, fiber: 4 },
  'vegetable': { calories: 40, protein: 2, carbs: 8, fat: 0.5, fiber: 3 },
  'meat': { calories: 200, protein: 20, carbs: 2, fat: 12, fiber: 0 },
  'snack': { calories: 200, protein: 4, carbs: 22, fat: 10, fiber: 2 },
  'beverage': { calories: 50, protein: 1, carbs: 11, fat: 0, fiber: 0 },
  'liquid': { calories: 30, protein: 1, carbs: 6, fat: 0, fiber: 0 }
};

/**
 * Normalize food name for matching
 */
function normalizeFoodName(name) {
  return name.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
}

/**
 * Get fallback nutrition for a food item
 * @param {object} food - Food object with name and optional weight/volume
 * @returns {object|null} - Nutrition data or null if not found
 */
export function getFallbackNutrition(food) {
  if (!food || !food.name) return null;
  
  const normalizedName = normalizeFoodName(food.name);
  console.log(`🔍 [NUTRITION-FALLBACK] Looking up: "${food.name}" (normalized: "${normalizedName}")`);
  
  // Try exact match first
  if (INDIAN_FOOD_DATABASE[normalizedName]) {
    const dbEntry = INDIAN_FOOD_DATABASE[normalizedName];
    console.log(`✅ [NUTRITION-FALLBACK] Found exact match: ${dbEntry.description}`);
    
    // Calculate nutrition based on actual weight if provided
    let nutrition = {
      calories: dbEntry.calories,
      protein: dbEntry.protein,
      carbs: dbEntry.carbs,
      fat: dbEntry.fat,
      fiber: dbEntry.fiber
    };
    
    // Scale nutrition if actual weight differs from database serving
    const actualWeight = food.weight_g || food.volume_ml || food.grams || dbEntry.servingSize;
    if (actualWeight && actualWeight !== dbEntry.servingSize) {
      const scaleFactor = actualWeight / dbEntry.servingSize;
      nutrition = {
        calories: Math.round(dbEntry.calories * scaleFactor),
        protein: Math.round(dbEntry.protein * scaleFactor * 10) / 10,
        carbs: Math.round(dbEntry.carbs * scaleFactor * 10) / 10,
        fat: Math.round(dbEntry.fat * scaleFactor * 10) / 10,
        fiber: Math.round((dbEntry.fiber || 0) * scaleFactor * 10) / 10
      };
      console.log(`   ⚖️ Scaled from ${dbEntry.servingSize}${dbEntry.unit} to ${actualWeight}${food.unit || dbEntry.unit}`);
    }
    
    return {
      ...nutrition,
      source: 'database',
      matched: normalizedName,
      servingDescription: dbEntry.description
    };
  }
  
  // Try partial match (contains keyword)
  for (const [key, value] of Object.entries(INDIAN_FOOD_DATABASE)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      console.log(`✅ [NUTRITION-FALLBACK] Found partial match: "${key}"`);
      return {
        calories: value.calories,
        protein: value.protein,
        carbs: value.carbs,
        fat: value.fat,
        fiber: value.fiber,
        source: 'database-partial',
        matched: key,
        servingDescription: value.description
      };
    }
  }
  
  // Try category-based estimation
  const category = detectFoodCategory(normalizedName);
  if (category && CATEGORY_AVERAGES[category]) {
    const avg = CATEGORY_AVERAGES[category];
    const weight = food.weight_g || food.volume_ml || food.grams || 100;
    const scaleFactor = weight / 100;
    
    console.log(`⚠️ [NUTRITION-FALLBACK] Using category average: "${category}" (${weight}g)`);
    return {
      calories: Math.round(avg.calories * scaleFactor),
      protein: Math.round(avg.protein * scaleFactor * 10) / 10,
      carbs: Math.round(avg.carbs * scaleFactor * 10) / 10,
      fat: Math.round(avg.fat * scaleFactor * 10) / 10,
      fiber: Math.round(avg.fiber * scaleFactor * 10) / 10,
      source: 'category-estimate',
      category: category
    };
  }
  
  console.log(`❌ [NUTRITION-FALLBACK] No match found for: "${food.name}"`);
  return null;
}

/**
 * Detect food category from name
 */
function detectFoodCategory(normalizedName) {
  // Rice dishes
  if (normalizedName.includes('rice') || normalizedName.includes('biryani') || 
      normalizedName.includes('pulao')) {
    return 'rice';
  }
  
  // Breads
  if (normalizedName.includes('roti') || normalizedName.includes('chapati') || 
      normalizedName.includes('naan') || normalizedName.includes('paratha') ||
      normalizedName.includes('bread')) {
    return 'bread';
  }
  
  // Curries
  if (normalizedName.includes('curry') || normalizedName.includes('masala') || 
      normalizedName.includes('gravy')) {
    return 'curry';
  }
  
  // Dal
  if (normalizedName.includes('dal') || normalizedName.includes('dhal') || 
      normalizedName.includes('lentil')) {
    return 'dal';
  }
  
  // Vegetables
  if (normalizedName.includes('vegetable') || normalizedName.includes('sabzi') || 
      normalizedName.includes('bhaji')) {
    return 'vegetable';
  }
  
  // Meat/Protein
  if (normalizedName.includes('chicken') || normalizedName.includes('mutton') || 
      normalizedName.includes('fish') || normalizedName.includes('egg') ||
      normalizedName.includes('paneer')) {
    return 'meat';
  }
  
  // Snacks
  if (normalizedName.includes('samosa') || normalizedName.includes('pakora') || 
      normalizedName.includes('vada') || normalizedName.includes('bonda')) {
    return 'snack';
  }
  
  // Beverages
  if (normalizedName.includes('juice') || normalizedName.includes('shake') || 
      normalizedName.includes('smoothie')) {
    return 'beverage';
  }
  
  // Liquids
  if (normalizedName.includes('water') || normalizedName.includes('tea') || 
      normalizedName.includes('coffee') || normalizedName.includes('milk')) {
    return 'liquid';
  }
  
  return null;
}

/**
 * Check if nutrition data needs correction (is 0 but shouldn't be)
 * @param {object} food - Food object with name and nutrition
 * @returns {boolean} - True if nutrition looks wrong
 */
export function needsNutritionCorrection(food) {
  if (!food || !food.nutrition) return true;
  
  const { calories, protein, carbs, fat } = food.nutrition;
  
  // Check if it's a known zero-calorie item
  const normalizedName = normalizeFoodName(food.name);
  const zeroCalorieFoods = ['water', 'black tea', 'black coffee', 'green tea'];
  if (zeroCalorieFoods.includes(normalizedName)) {
    return false; // 0 calories is correct for these
  }
  
  // If calories are 0 or all macros are 0, it's likely wrong
  if (calories === 0 || (calories === undefined && carbs === 0 && protein === 0 && fat === 0)) {
    console.log(`⚠️ [NUTRITION-CHECK] "${food.name}" has suspicious 0 values`);
    return true;
  }
  
  return false;
}

/**
 * Apply fallback nutrition to foods that have 0 or missing values
 * @param {array} foods - Array of food objects
 * @returns {array} - Foods with corrected nutrition
 */
export function applyFallbackNutrition(foods) {
  if (!foods || !Array.isArray(foods)) return foods;
  
  console.log(`🔧 [NUTRITION-FALLBACK] Checking ${foods.length} foods for missing nutrition...`);
  
  return foods.map(food => {
    if (needsNutritionCorrection(food)) {
      console.log(`⚠️ [NUTRITION-FALLBACK] "${food.name}" needs correction`);
      
      const fallbackNutrition = getFallbackNutrition(food);
      
      if (fallbackNutrition) {
        console.log(`✅ [NUTRITION-FALLBACK] Applied fallback nutrition:`, fallbackNutrition);
        return {
          ...food,
          nutrition: {
            calories: fallbackNutrition.calories,
            protein: fallbackNutrition.protein,
            carbs: fallbackNutrition.carbs,
            fat: fallbackNutrition.fat,
            fiber: fallbackNutrition.fiber
          },
          calories: fallbackNutrition.calories,
          protein: fallbackNutrition.protein,
          carbs: fallbackNutrition.carbs,
          fat: fallbackNutrition.fat,
          fiber: fallbackNutrition.fiber,
          nutritionSource: fallbackNutrition.source,
          fallbackApplied: true
        };
      } else {
        console.warn(`❌ [NUTRITION-FALLBACK] No fallback found for: "${food.name}"`);
      }
    }
    
    return food;
  });
}

const nutritionFallbackService = {
  getFallbackNutrition,
  needsNutritionCorrection,
  applyFallbackNutrition
};

export default nutritionFallbackService;
