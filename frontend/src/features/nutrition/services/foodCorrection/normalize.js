// Pure helpers used across food-correction modules.

export const normalizeFoodName = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[-–—_()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const LIQUID_UNITS = ['ml', 'milliliter', 'millilitre', 'l', 'liter', 'litre', 'fl oz', 'fluid ounce'];
const SOLID_UNITS  = ['g', 'gram', 'kg', 'kilogram', 'oz', 'ounce', 'lb', 'pound',
                      'piece', 'slice', 'serving', 'cup', 'bowl', 'plate'];

export const getFoodTypeByUnit = (unit) => {
  if (!unit) return 'unknown';
  const u = String(unit).toLowerCase().trim();
  if (LIQUID_UNITS.some((x) => u.includes(x))) return 'liquid';
  if (SOLID_UNITS.some((x) => u === x || u.includes(x))) return 'solid';
  return 'unknown';
};

const LIQUID_KEYWORDS = [
  'shake', 'juice', 'milk', 'lassi', 'coffee', 'tea', 'water', 'smoothie',
  'soup', 'drink', 'beverage', 'cola', 'soda', 'beer', 'wine', 'cocktail',
  'latte', 'cappuccino', 'espresso', 'formula 1', 'herbalife',
];

/** True when a food item is a liquid/shake (eligible for autocorrection). */
export const isFoodLiquidOrShake = (food) => {
  if (!food) return false;
  if (food.isLiquid === true) return true;
  if (food.volume_ml !== null && food.volume_ml !== undefined) return true;
  if (food.unit && String(food.unit).toLowerCase().trim() === 'ml') return true;
  const nameLower = (food.name || '').toLowerCase();
  return LIQUID_KEYWORDS.some((kw) => nameLower.includes(kw));
};
