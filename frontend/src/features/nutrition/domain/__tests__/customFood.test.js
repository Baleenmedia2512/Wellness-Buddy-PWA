/**
 * customFood.test.js
 * Run: npx react-scripts test --watchAll=false --testPathPattern=customFood
 */
import { buildCustomMealItem, validateCustomFoodForm } from '../customFood';

describe('validateCustomFoodForm', () => {
  test('accepts name + g/ml quantity + serving count', () => {
    expect(validateCustomFoodForm({
      name: 'subja',
      unit: 'ml',
      quantity: '100',
      servingSize: '13',
    })).toEqual({
      ok: true,
      name: 'subja',
      unit: 'ml',
      quantity: 100,
      servingSize: 13,
    });
  });

  test('legacy: servingSize alone is treated as quantity with 1 serving', () => {
    expect(validateCustomFoodForm({ name: 'subja', unit: 'ml', servingSize: '100' })).toEqual({
      ok: true,
      name: 'subja',
      unit: 'ml',
      quantity: 100,
      servingSize: 1,
    });
  });

  test('rejects empty name and invalid values', () => {
    expect(validateCustomFoodForm({ name: ' ', unit: 'g', quantity: 100, servingSize: 1 }).ok).toBe(false);
    expect(validateCustomFoodForm({ name: 'subja', unit: 'oz', quantity: 100, servingSize: 1 }).ok).toBe(false);
    expect(validateCustomFoodForm({ name: 'subja', unit: 'g', quantity: 0, servingSize: 1 }).ok).toBe(false);
    expect(validateCustomFoodForm({ name: 'subja', unit: 'g', quantity: 100, servingSize: 0 }).ok).toBe(false);
  });
});

describe('buildCustomMealItem', () => {
  test('builds tray item with unit, portion, and servings', () => {
    const item = buildCustomMealItem(
      { profileId: 9, nutrition: {} },
      { name: 'subja', unit: 'g', quantity: 100, servingSize: 13 },
    );
    expect(item.name).toBe('subja');
    expect(item.unit).toBe('g');
    expect(item.portion).toBe('100 g');
    expect(item.weight_g).toBe(100);
    expect(item.servings).toBe(13);
    expect(item.customFood).toBe(true);
    expect(item.profileId).toBe(9);
    expect(item.calories).toBe(0);
  });

  test('marks ml items as liquid with volume_ml', () => {
    const item = buildCustomMealItem(
      {},
      { name: 'lassi', unit: 'ml', quantity: 200, servingSize: 1 },
    );
    expect(item.isLiquid).toBe(true);
    expect(item.volume_ml).toBe(200);
    expect(item.portion).toBe('200 ml');
    expect(item.servings).toBe(1);
  });
});
