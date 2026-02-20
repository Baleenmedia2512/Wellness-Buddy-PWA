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
    'syrup', 'sauce (liquid)', 'gravy', 'dal (liquid)'
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
    'pickle', 'chutney', 'powder', 'flour'
  ];
  
  if (solidKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'solid';
  }
  
  return 'unknown';
}

/**
 * Identify food type using hybrid approach
 * Priority: Unit-based detection > Name-based detection > Default to solid
 * 
 * @param {Object} food - Food object
 * @param {string} food.name - Food name
 * @param {string} food.unit - Unit of measurement
 * @returns {string} 'liquid' or 'solid'
 */
function identifyFoodType(food) {
  if (!food) return 'solid';
  
  const { name, unit } = food;
  
  // Priority 1: Check unit (most reliable)
  const unitType = getFoodTypeByUnit(unit);
  if (unitType !== 'unknown') {
    console.log(`  [FOOD-TYPE] Identified by unit: ${unit} → ${unitType}`);
    return unitType;
  }
  
  // Priority 2: Check food name patterns
  const nameType = getFoodTypeByName(name);
  if (nameType !== 'unknown') {
    console.log(`  [FOOD-TYPE] Identified by name: ${name} → ${nameType}`);
    return nameType;
  }
  
  // Priority 3: Default to solid if unsure (safer default)
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

module.exports = {
  getFoodTypeByUnit,
  getFoodTypeByName,
  identifyFoodType,
  areTypesCompatible,
  validateCorrectionByType
};
