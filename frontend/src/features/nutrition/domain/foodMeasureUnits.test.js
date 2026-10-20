/**
 * foodMeasureUnits.test.js
 * Run: npx react-scripts test --watchAll=false --testPathPattern=foodMeasureUnits
 */
import {
  applyFoodMeasure,
  availableMeasureUnits,
  defaultMeasureForItem,
  isPieceCountableFood,
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

  test('g scales nutrition to absolute grams', () => {
    const out = applyFoodMeasure(dosa, { unit: 'g', quantity: 45 });
    expect(out.servings).toBe(1);
    expect(out.unit).toBe('g');
    expect(out.weight_g).toBe(45);
    expect(out.portion).toBe('45 g');
    expect(out.calories).toBe(270);
    expect(out.protein).toBe(7);
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
