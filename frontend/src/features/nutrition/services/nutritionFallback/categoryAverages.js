// Per-100g averages for unknown foods grouped by category, plus a
// keyword-based detector mapping a normalized name to a category key.

export const CATEGORY_AVERAGES = {
  rice:      { calories: 150, protein: 3,  carbs: 33, fat: 3,   fiber: 2 },
  bread:     { calories: 260, protein: 8,  carbs: 45, fat: 5,   fiber: 3 },
  curry:     { calories: 80,  protein: 3,  carbs: 10, fat: 4,   fiber: 2 },
  dal:       { calories: 100, protein: 7,  carbs: 16, fat: 2,   fiber: 4 },
  vegetable: { calories: 40,  protein: 2,  carbs: 8,  fat: 0.5, fiber: 3 },
  meat:      { calories: 200, protein: 20, carbs: 2,  fat: 12,  fiber: 0 },
  snack:     { calories: 200, protein: 4,  carbs: 22, fat: 10,  fiber: 2 },
  beverage:  { calories: 50,  protein: 1,  carbs: 11, fat: 0,   fiber: 0 },
  liquid:    { calories: 30,  protein: 1,  carbs: 6,  fat: 0,   fiber: 0 },
};

const CATEGORY_RULES = [
  { key: 'rice',      tokens: ['rice', 'biryani', 'pulao'] },
  { key: 'bread',     tokens: ['roti', 'chapati', 'naan', 'paratha', 'bread'] },
  { key: 'curry',     tokens: ['curry', 'masala', 'gravy'] },
  { key: 'dal',       tokens: ['dal', 'dhal', 'lentil'] },
  { key: 'vegetable', tokens: ['vegetable', 'sabzi', 'bhaji'] },
  { key: 'meat',      tokens: ['chicken', 'mutton', 'fish', 'egg', 'paneer'] },
  { key: 'snack',     tokens: ['samosa', 'pakora', 'vada', 'bonda'] },
  { key: 'beverage',  tokens: ['juice', 'shake', 'smoothie'] },
  { key: 'liquid',    tokens: ['water', 'tea', 'coffee', 'milk'] },
];

export const detectFoodCategory = (normalizedName) => {
  const n = String(normalizedName || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.tokens.some((t) => n.includes(t))) return rule.key;
  }
  return null;
};
