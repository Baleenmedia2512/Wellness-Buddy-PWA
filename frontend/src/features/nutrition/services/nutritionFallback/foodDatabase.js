// Per-100g/per-serving nutrition data for common Indian foods.
// Source: typical serving values used by the fallback service.
export const INDIAN_FOOD_DATABASE = {
  // Rice dishes
  'lemon rice':   { calories: 230, protein: 4,  carbs: 45, fat: 5,  fiber: 2, servingSize: 150, unit: 'g',  description: '1 cup cooked lemon rice' },
  'biryani':      { calories: 350, protein: 12, carbs: 48, fat: 12, fiber: 3, servingSize: 200, unit: 'g',  description: '1 plate vegetable biryani' },
  'fried rice':   { calories: 280, protein: 6,  carbs: 42, fat: 10, fiber: 2, servingSize: 150, unit: 'g',  description: '1 cup fried rice' },
  'curd rice':    { calories: 150, protein: 5,  carbs: 28, fat: 2,  fiber: 1, servingSize: 150, unit: 'g',  description: '1 cup curd rice' },
  'jeera rice':   { calories: 210, protein: 4,  carbs: 40, fat: 4,  fiber: 2, servingSize: 150, unit: 'g',  description: '1 cup cumin rice' },
  'pulao':        { calories: 260, protein: 6,  carbs: 44, fat: 7,  fiber: 3, servingSize: 150, unit: 'g',  description: '1 cup vegetable pulao' },
  // South Indian
  'idli':         { calories: 39,  protein: 2,  carbs: 8,  fat: 0.2,fiber: 1, servingSize: 40,  unit: 'g',  description: '1 piece idli' },
  'dosa':         { calories: 133, protein: 4,  carbs: 20, fat: 4,  fiber: 2, servingSize: 70,  unit: 'g',  description: '1 medium dosa' },
  'masala dosa':  { calories: 280, protein: 7,  carbs: 40, fat: 10, fiber: 4, servingSize: 150, unit: 'g',  description: '1 masala dosa' },
  'vada':         { calories: 160, protein: 4,  carbs: 16, fat: 9,  fiber: 2, servingSize: 50,  unit: 'g',  description: '1 piece medu vada' },
  'sambhar':      { calories: 80,  protein: 4,  carbs: 12, fat: 2,  fiber: 3, servingSize: 150, unit: 'ml', description: '1 bowl sambhar' },
  'upma':         { calories: 180, protein: 5,  carbs: 30, fat: 5,  fiber: 3, servingSize: 150, unit: 'g',  description: '1 bowl upma' },
  'pongal':       { calories: 220, protein: 6,  carbs: 35, fat: 6,  fiber: 2, servingSize: 150, unit: 'g',  description: '1 bowl pongal' },
  // Curries
  'dal':                   { calories: 120, protein: 8,  carbs: 18, fat: 2,  fiber: 5, servingSize: 150, unit: 'ml', description: '1 bowl dal' },
  'curry':                 { calories: 110, protein: 4,  carbs: 12, fat: 5,  fiber: 3, servingSize: 150, unit: 'ml', description: '1 bowl mixed vegetable curry' },
  'paneer butter masala':  { calories: 280, protein: 12, carbs: 10, fat: 22, fiber: 2, servingSize: 150, unit: 'ml', description: '1 bowl paneer butter masala' },
  'chicken curry':         { calories: 220, protein: 18, carbs: 8,  fat: 14, fiber: 2, servingSize: 150, unit: 'ml', description: '1 bowl chicken curry' },
  // Breads
  'chapati': { calories: 104, protein: 3, carbs: 18, fat: 3,  fiber: 2, servingSize: 40,  unit: 'g', description: '1 medium chapati' },
  'roti':    { calories: 104, protein: 3, carbs: 18, fat: 3,  fiber: 2, servingSize: 40,  unit: 'g', description: '1 medium roti' },
  'naan':    { calories: 262, protein: 8, carbs: 45, fat: 5,  fiber: 2, servingSize: 90,  unit: 'g', description: '1 medium naan' },
  'paratha': { calories: 280, protein: 6, carbs: 35, fat: 12, fiber: 3, servingSize: 100, unit: 'g', description: '1 medium paratha' },
  'poori':   { calories: 160, protein: 3, carbs: 18, fat: 9,  fiber: 1, servingSize: 40,  unit: 'g', description: '1 piece poori' },
  // Snacks
  'samosa': { calories: 252, protein: 5, carbs: 28, fat: 13, fiber: 3, servingSize: 75, unit: 'g', description: '1 medium samosa' },
  'pakora': { calories: 180, protein: 4, carbs: 18, fat: 10, fiber: 2, servingSize: 50, unit: 'g', description: '2-3 pieces pakora' },
  'bhaji':  { calories: 180, protein: 4, carbs: 18, fat: 10, fiber: 2, servingSize: 50, unit: 'g', description: '1 serving bhaji' },
  // Beverages
  'coconut water': { calories: 46,  protein: 1.7,carbs: 9,  fat: 0.5,fiber: 2.6, servingSize: 250, unit: 'ml', description: '1 glass coconut water' },
  'milk':          { calories: 150, protein: 8,  carbs: 12, fat: 8,  fiber: 0,   servingSize: 250, unit: 'ml', description: '1 glass whole milk' },
  'tea':           { calories: 30,  protein: 1,  carbs: 5,  fat: 0.5,fiber: 0,   servingSize: 150, unit: 'ml', description: '1 cup tea with milk and sugar' },
  'coffee':        { calories: 30,  protein: 1,  carbs: 5,  fat: 0.5,fiber: 0,   servingSize: 150, unit: 'ml', description: '1 cup coffee with milk and sugar' },
  'juice':         { calories: 120, protein: 1,  carbs: 28, fat: 0,  fiber: 0.5, servingSize: 250, unit: 'ml', description: '1 glass fruit juice' },
  // Zero-calorie items
  'water':        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: 250, unit: 'ml', description: '1 glass water' },
  'black tea':    { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: 150, unit: 'ml', description: '1 cup black tea' },
  'black coffee': { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: 150, unit: 'ml', description: '1 cup black coffee' },
  'green tea':    { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: 150, unit: 'ml', description: '1 cup green tea' },
};

// Names already known to legitimately be 0-calorie.
export const ZERO_CALORIE_FOODS = ['water', 'black tea', 'black coffee', 'green tea'];

export const normalizeFoodName = (name) =>
  String(name || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '');
