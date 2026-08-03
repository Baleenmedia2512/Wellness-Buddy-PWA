/**
 * Food Type Detection Utility
 * Identifies whether a food item is liquid or solid based on unit and name
 * 
 * Used for:
 * - Preventing solid/liquid correction mix-ups
 * - Ensuring nutrition corrections are applied correctly
 * - Type-safe auto-corrections
 */

/**
 * Detect food type from unit (most reliable method)
 * @param {string} unit - Unit of measurement (ml, g, oz, etc.)
 * @returns {string} 'liquid', 'solid', or 'unknown'
 */
function getFoodTypeByUnit(unit) {
  if (!unit) return 'unknown';
  
  const unitLower = unit.toLowerCase().trim();
  
  // Liquid units
  const liquidUnits = ['ml', 'milliliter', 'millilitre', 'l', 'liter', 'litre', 'fl oz', 'fluid ounce'];
  if (liquidUnits.some(u => unitLower.includes(u))) {
    return 'liquid';
  }
  
  // Solid units
  const solidUnits = ['g', 'gram', 'kg', 'kilogram', 'oz', 'ounce', 'lb', 'pound', 'piece', 'slice', 'serving', 'cup', 'bowl', 'plate'];
  if (solidUnits.some(u => unitLower === u || unitLower.includes(u))) {
    return 'solid';
  }
  
  return 'unknown';
}

/**
 * Detect food type from name patterns (fallback method)
 * @param {string} name - Food name
 * @returns {string} 'liquid', 'solid', or 'unknown'
 */
function getFoodTypeByName(name) {
  if (!name) return 'unknown';
  
  const nameLower = name.toLowerCase();
  
  // Liquid keywords
  const liquidKeywords = [
    'milk', 'tea', 'coffee', 'juice', 'shake', 'smoothie',
    'lassi', 'water', 'soup', 'broth', 'drink', 'beverage',
    'formula 1', 'afresh', 'lemonade', 'buttermilk', 'yogurt drink',
    'energy drink', 'soda', 'cola', 'beer', 'wine', 'cocktail',
    'syrup', 'sauce (liquid)', 'gravy', 'dal (liquid)',
    // Indian beverages
    'chai', 'kaapi', 'kappi', 'moru', 'chaas', 'nimbu pani',
    'tender coconut', 'coconut water', 'sugarcane juice',
  ];
  
  if (liquidKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'liquid';
  }
  
  // Solid keywords
  const solidKeywords = [
    'rice', 'roti', 'chapathi', 'bread', 'chicken', 'fish',
    'vegetable', 'curry', 'biryani', 'dosa', 'idli', 'upma',
    'salad', 'egg', 'paneer', 'dal', 'sambar', 'pasta',
    'noodles', 'meat', 'mutton', 'beef', 'pork', 'prawn',
    'cake', 'cookie', 'biscuit', 'chocolate', 'sweet',
    'pickle', 'chutney', 'powder', 'flour',
    // Tamil Nadu foods
    'pongal', 'uthappam', 'vada', 'appam', 'idiyappam', 'puttu',
    'parotta', 'kothu parotta', 'rasam', 'kuzhambu', 'kootu',
    'poriyal', 'avial', 'thayir sadam', 'curd rice', 'puliyodarai',
    'elumichai sadam', 'thengai sadam', 'tomato rice', 'murukku',
    'seedai', 'sundal', 'bonda', 'bajji', 'mixture', 'halwa',
    'payasam', 'laddu', 'mysore pak',
    // Herbalife solid supplements
    'formula 2', 'multivitamin', 'cell activator', 'nightworks', 'niteworks',
    'herbalife tablet', 'herbalife capsule', 'xtra-cal',
  ];
  
  if (solidKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'solid';
  }
  
  return 'unknown';
}

/**
 * Identify food type using hybrid approach with conflict detection
 * Priority: Name-based (for obvious liquids) > Unit-based > Name-based (general) > Default to solid
 * 
 * @param {Object} food - Food object
 * @param {string} food.name - Food name
 * @param {string} food.unit - Unit of measurement
 * @returns {string} 'liquid' or 'solid'
 */
function identifyFoodType(food) {
  if (!food) return 'solid';
  
  const { name, unit } = food;
  
  // Priority 1: Check for OBVIOUS liquids by name (overrides unit)
  // These should NEVER be classified as solid, even if unit says "g"
  const obviousLiquidPatterns = [
    'milkshake', 'milk shake', 'smoothie', 'juice', 'lassi',
    'tea', 'coffee', 'shake', 'beverage', 'drink', 'soup',
    'broth', 'formula 1', 'afresh', 'water', 'lemonade',
    'buttermilk', 'energy drink', 'soda', 'cola', 'cocktail',
    // Indian beverages
    'chai', 'kaapi', 'kappi', 'moru', 'chaas',
    'tender coconut', 'nimbu pani', 'shikanji',
    // Herbalife non-meal beverages
    'afresh energy drink', 'herbal tea concentrate', 'herbalife tea',
  ];
  
  if (name) {
    const nameLower = name.toLowerCase();
    const isObviousLiquid = obviousLiquidPatterns.some(pattern => 
      nameLower.includes(pattern)
    );
    
    if (isObviousLiquid) {
      // Check for unit conflict (warning)
      const unitType = getFoodTypeByUnit(unit);
      if (unitType === 'solid') {
        console.warn(`  ⚠️ [FOOD-TYPE] CONFLICT: "${name}" is liquid but unit is "${unit}" (solid)`);
        console.warn(`  ⚠️ [FOOD-TYPE] Overriding to liquid based on name`);
      } else {
        console.log(`  [FOOD-TYPE] Identified as obvious liquid by name: ${name} → liquid`);
      }
      return 'liquid';
    }
  }
  
  // Priority 2: Check unit (most reliable for non-obvious cases)
  const unitType = getFoodTypeByUnit(unit);
  if (unitType !== 'unknown') {
    console.log(`  [FOOD-TYPE] Identified by unit: ${unit} → ${unitType}`);
    return unitType;
  }
  
  // Priority 3: Check food name patterns (general keywords)
  const nameType = getFoodTypeByName(name);
  if (nameType !== 'unknown') {
    console.log(`  [FOOD-TYPE] Identified by name: ${name} → ${nameType}`);
    return nameType;
  }
  
  // Priority 4: Default to solid if unsure (safer default)
  console.log(`  [FOOD-TYPE] Unknown type for: ${name}, defaulting to solid`);
  return 'solid';
}

/**
 * Check if two food types are compatible for correction
 * @param {string} type1 - First food type
 * @param {string} type2 - Second food type
 * @returns {boolean} True if types are compatible
 */
function areTypesCompatible(type1, type2) {
  // Both must be the same type
  if (type1 === type2) return true;
  
  // Unknown types are considered compatible (backwards compatibility)
  if (type1 === 'unknown' || type2 === 'unknown') return true;
  
  return false;
}

/**
 * Validate if a correction should be applied based on food types
 * @param {Object} aiFood - AI detected food
 * @param {Object} savedCorrection - Saved correction from database
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateCorrectionByType(aiFood, savedCorrection) {
  const aiType = identifyFoodType({
    name: aiFood.name,
    unit: aiFood.unit
  });
  
  const savedType = savedCorrection.AiFoodType || identifyFoodType({
    name: savedCorrection.AiDetected,
    unit: savedCorrection.AiUnit
  });
  
  if (!areTypesCompatible(aiType, savedType)) {
    return {
      valid: false,
      reason: `Food type mismatch: AI detected ${aiType}, correction is for ${savedType}`
    };
  }
  
  return {
    valid: true,
    reason: 'Food types are compatible'
  };
}

/**
 * Normalize food name for pattern matching (lowercase, collapse whitespace).
 * @param {string} name
 * @returns {string}
 */
function normalizeFoodName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Read display name from a food row in any persisted analysis shape.
 * @param {object} food
 * @returns {string}
 */
function getFoodItemName(food) {
  if (!food || typeof food !== 'object') return '';
  return String(food.name || food.Name || food.foodName || '').trim();
}

/**
 * Herbalife / Herbal Life Afresh — refresh energy drink, NOT breakfast/lunch/dinner.
 * @param {string} name
 * @returns {boolean}
 */
function isAfreshEnergyDrink(name) {
  const n = normalizeFoodName(name);
  if (!n) return false;
  if (n.includes('afresh') || n.includes('a fresh')) return true;
  const isHerbalBrand =
    n.includes('herbalife') || n.includes('herbal life') || n.includes('herballife');
  const isEnergyRefresh =
    n.includes('energy drink') ||
    n.includes('energy mix') ||
    n.includes('refresh drink') ||
    (n.includes('energy') && n.includes('drink'));
  const isMealShake =
    n.includes('formula 1') ||
    n.includes('formula1') ||
    n.includes('f1 shake') ||
    n.includes('meal replacement');
  return isHerbalBrand && isEnergyRefresh && !isMealShake;
}

/**
 * Extract food item objects from any AnalysisData JSON shape.
 * @param {object} parsed
 * @returns {object[]}
 */
function extractFoodItemsFromAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];

  const items = [];
  const push = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const f of arr) {
      if (f && typeof f === 'object') items.push(f);
    }
  };

  push(parsed.foods);
  push(parsed.detailedItems);
  push(parsed.details?.foods);

  if (items.length === 0 && parsed.category?.name) {
    items.push({ name: parsed.category.name });
  }

  return items;
}

/**
 * List of beverage/drink keywords that should NOT count as a meal
 * (breakfast, lunch, or dinner) when they are the ONLY items logged.
 * If a record contains at least one non-exempted food, it still counts.
 */
const EXEMPTED_MEAL_FOODS = [
  // Plain water variants
  'water', 'lemon water', 'hot water', 'cold water', 'sparkling water',
  'mineral water', 'coconut water', 'tender coconut water',

  // Coffee variants (English + Indian)
  'coffee', 'black coffee', 'filter coffee', 'south indian coffee',
  'kaapi', 'kappi', 'kumbakonam coffee', 'instant coffee', 'espresso',

  // Tea variants (English + Indian — 'chai' must be explicit for Tamil Nadu users)
  'tea', 'black tea', 'green tea', 'herbal tea', 'masala tea',
  'chai', 'masala chai', 'ginger chai', 'cutting chai', 'milk tea',
  'kadak chai', 'adrak chai', 'elaichi chai', 'kulhad chai',
  'chamomile tea', 'peppermint tea', 'lemon tea',
  'herbalife herbal tea concentrate', 'herbalife tea', 'herbal tea concentrate',

  // Herbalife non-meal beverages (Afresh is an energy drink, NOT meal replacement)
  'afresh', 'afresh energy drink', 'herbalife afresh', 'herbal life afresh',
  'herbalife afresh energy drink', 'herbal life afresh energy drink',

  // Indian dairy beverages (plain, unsweetened variants)
  'buttermilk', 'moru', 'chaas', 'lassi',

  // Other non-meal beverages
  'lemonade', 'nimbu pani', 'shikanji',
];

/**
 * Check if a food name matches an exempted beverage
 * @param {string} name - Food item name
 * @returns {boolean}
 */
function isExemptedFood(name) {
  if (!name) return false;
  if (isAfreshEnergyDrink(name)) return true;
  const n = normalizeFoodName(name);
  return EXEMPTED_MEAL_FOODS.some((exempt) => {
    const e = exempt.toLowerCase();
    return n === e || n.includes(e);
  });
}

/**
 * Check if an AnalysisData record contains ONLY exempted beverages.
 * If every food item in the record is an exempted drink, the record
 * should not count as a meal (breakfast/lunch/dinner).
 *
 * @param {string|Object} analysisData - Raw JSON string or parsed object
 * @returns {boolean} true if ALL items are exempted (should skip), false otherwise
 */
function isExemptedBeverageOnly(analysisData) {
  try {
    const parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
    if (!parsed) return false;

    const foods = extractFoodItemsFromAnalysis(parsed);
    if (foods.length === 0) return false;

    return foods.every((f) => isExemptedFood(getFoodItemName(f)));
  } catch {
    return false;
  }
}

module.exports = {
  getFoodTypeByUnit,
  getFoodTypeByName,
  identifyFoodType,
  areTypesCompatible,
  validateCorrectionByType,
  isExemptedBeverageOnly,
  isExemptedFood,
  isAfreshEnergyDrink,
  extractFoodItemsFromAnalysis,
  getFoodItemName,
  EXEMPTED_MEAL_FOODS
};
