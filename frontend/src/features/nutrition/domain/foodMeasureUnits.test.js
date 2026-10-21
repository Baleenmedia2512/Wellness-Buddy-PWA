/**
 * foodMeasureUnits.test.js
 * Run: npx react-scripts test --watchAll=false --testPathPattern=foodMeasureUnits
 */
import {
  applyFoodMeasure,
  availableMeasureUnits,
  defaultMeasureForItem,
  impliedPieceCount,
  isPieceCountableFood,
  normalizePieceFoodToSingleServing,
  previewMeasureNutrition,
} from './foodMeasureUnits';

describe('isPieceCountableFood', () => {
  test.each([
    'Dosa',
    'Masala Dosa',
    'Idli',
    'idaly',
    'Chapathi',
    'chapati',
    'Porata',
    'Paratha',
    'Idyapam',
    'Idiyappam',
  ])('treats %s as piece food', (name) => {
    expect(isPieceCountableFood(name)).toBe(true);
    expect(isPieceCountableFood({ name })).toBe(true);
  });

  test.each(['Rice', 'Chicken Noodles', 'Milagu Rasam', 'Lays'])(
    'does not treat %s as piece food',
    (name) => {
      expect(isPieceCountableFood(name)).toBe(false);
    },
  );
});

describe('availableMeasureUnits / defaultMeasureForItem', () => {
  test('regular foods get g/ml; piece foods get pcs only (no g/ml)', () => {
    expect(availableMeasureUnits({ name: 'Rice' })).toEqual(['g', 'ml']);
    expect(availableMeasureUnits({ name: 'Dosa' })).toEqual(['pcs']);
    expect(availableMeasureUnits({ name: 'Idli' })).toEqual(['pcs']);
    expect(availableMeasureUnits({ name: 'Chapathi' })).toEqual(['pcs']);
  });

  test('defaults piece foods to 1 pcs and solids to grams', () => {
    expect(defaultMeasureForItem({ name: 'Dosa', weight_g: 90 })).toEqual({
      unit: 'pcs',
      quantity: 1,
    });
    expect(defaultMeasureForItem({ name: 'Rice', weight_g: 150 })).toEqual({
      unit: 'g',
      quantity: 150,
    });
    expect(defaultMeasureForItem({
      name: 'Rasam',
      weight_g: 200,
      isLiquid: true,
    })).toEqual({ unit: 'ml', quantity: 200 });
  });
});

describe('normalizePieceFoodToSingleServing', () => {
  test('splits multi-piece Latest totals back to 1 piece (servings)', () => {
    const multi = {
      name: 'Dosa',
      calories: 13500,
      protein: 350,
      weight_g: 2250,
      servings: 25,
      nutrition: { calories: 13500, protein: 350 },
    };
    expect(impliedPieceCount(multi)).toBe(25);
    const one = normalizePieceFoodToSingleServing(multi);
    expect(one.calories).toBe(540);
    expect(one.protein).toBe(14);
    expect(one.servings).toBe(1);
    expect(one.weight_g).toBe(90);
  });

  test('splits multi-piece totals from weight when servings missing', () => {
    const multi = {
      name: 'Dosa',
      calories: 13500,
      protein: 350,
      weight_g: 2250,
      nutrition: { calories: 13500, protein: 350 },
    };
    const one = normalizePieceFoodToSingleServing(multi);
    expect(one.calories).toBe(540);
    expect(one.protein).toBe(14);
  });

  test('leaves a normal single dosa unchanged', () => {
    const one = {
      name: 'Dosa',
      calories: 540,
      protein: 14,
      weight_g: 90,
      nutrition: { calories: 540, protein: 14 },
    };
    expect(normalizePieceFoodToSingleServing(one).calories).toBe(540);
  });

  test('2 dosas @ 270 kcal → 1 piece base 135; preview scales with pcs', () => {
    const loggedTwo = {
      name: 'Dosa',
      calories: 270,
      protein: 8,
      weight_g: 180,
      servings: 2,
      portion: '2 pieces',
      nutrition: { calories: 270, protein: 8 },
    };
    expect(impliedPieceCount(loggedTwo)).toBe(2);
    expect(normalizePieceFoodToSingleServing(loggedTwo).calories).toBe(135);
    expect(previewMeasureNutrition(loggedTwo, { unit: 'pcs', quantity: 1 })).toEqual({
      calories: 135,
      protein: 4,
      portionLabel: '1 piece',
    });
    expect(previewMeasureNutrition(loggedTwo, { unit: 'pcs', quantity: 2 })).toEqual({
      calories: 270,
      protein: 8,
      portionLabel: '2 pieces',
    });
    expect(defaultMeasureForItem(loggedTwo)).toEqual({ unit: 'pcs', quantity: 1 });
  });
});

describe('applyFoodMeasure', () => {
  const dosa = {
    name: 'Dosa',
    calories: 540,
    protein: 14,
    carbs: 80,
    fat: 18,
    weight_g: 90,
    nutrition: { calories: 540, protein: 14, carbs: 80, fat: 18 },
  };

  test('pcs keeps per-piece nutrition and sets servings', () => {
    const out = applyFoodMeasure(dosa, { unit: 'pcs', quantity: 2 });
    expect(out.servings).toBe(2);
    expect(out.calories).toBe(540);
    expect(out.portion).toBe('2 pieces');
    expect(out.measureUnit).toBe('pcs');
  });

  test('pcs normalizes inflated Latest totals before adding', () => {
    const multi = {
      name: 'Dosa',
      calories: 13500,
      protein: 350,
      weight_g: 2250,
      servings: 25,
      nutrition: { calories: 13500, protein: 350 },
    };
    const out = applyFoodMeasure(multi, { unit: 'pcs', quantity: 1 });
    expect(out.calories).toBe(540);
    expect(out.servings).toBe(1);
  });

  test('g scales nutrition to absolute grams', () => {
    const out = applyFoodMeasure(dosa, { unit: 'g', quantity: 45 });
    expect(out.servings).toBe(1);
    expect(out.unit).toBe('g');
    expect(out.weight_g).toBe(45);
    expect(out.portion).toBe('45 g');
    expect(out.calories).toBe(270);
    expect(out.protein).toBe(7);
  });

  test('1000 ml previews as 1 L', () => {
    const drink = {
      name: 'Turbo Drink',
      calories: 122.8,
      protein: 16.12,
      weight_g: 1000,
      isLiquid: true,
      unit: 'ml',
      nutrition: { calories: 122.8, protein: 16.12 },
    };
    expect(previewMeasureNutrition(drink, { unit: 'ml', quantity: 1000 })).toEqual({
      calories: 123,
      protein: 16.1,
      portionLabel: '1 L',
    });
  });

  test('ml marks liquid and sets volume', () => {
    const soup = {
      name: 'Rasam',
      calories: 45,
      weight_g: 150,
      nutrition: { calories: 45, protein: 1 },
    };
    const out = applyFoodMeasure(soup, { unit: 'ml', quantity: 300 });
    expect(out.unit).toBe('ml');
    expect(out.isLiquid).toBe(true);
    expect(out.volume_ml).toBe(300);
    expect(out.calories).toBe(90);
  });
});
