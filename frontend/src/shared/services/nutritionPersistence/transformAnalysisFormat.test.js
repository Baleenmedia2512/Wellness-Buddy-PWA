import { transformToBackgroundServiceFormat } from './transformAnalysisFormat';

describe('transformToBackgroundServiceFormat', () => {
  it('preserves Herbalife Shake powder weight, drink volume, and macro decimals', () => {
    const transformed = transformToBackgroundServiceFormat({
      nutrition: {
        calories: 223,
        protein: 24.73,
        carbs: 24.24,
        fat: 2.98,
        fiber: 3,
        sugar: 11.57,
        sodium: 355,
        cholesterol: 7,
        glycemic_index: 20,
      },
      detailedItems: [{
        name: 'Herbalife Shake',
        portionDescription: '1 serving',
        weight_g: 58,
        volume_ml: 300,
        estimatedWeight: 58,
        unit: 'ml',
        isLiquid: true,
        calories: 223,
        protein: 24.73,
        carbs: 24.24,
        fat: 2.98,
        fiber: 3,
        sugar: 11.57,
        sodium: 355,
        cholesterol: 7,
        glycemic_index: 20,
        nutrition: {
          calories: 223,
          protein: 24.73,
          carbs: 24.24,
          fat: 2.98,
          fiber: 3,
          sugar: 11.57,
          sodium: 355,
          cholesterol: 7,
          glycemic_index: 20,
        },
      }],
      confidence: 'high',
    });

    expect(transformed.foods).toHaveLength(1);
    const food = transformed.foods[0];
    expect(food.weight_g).toBe(58);
    expect(food.volume_ml).toBe(300);
    expect(food.unit).toBe('ml');
    expect(food.isLiquid).toBe(true);
    expect(food.nutrition.protein).toBe(24.73);
    expect(food.nutrition.carbs).toBe(24.24);
    expect(food.nutrition.fat).toBe(2.98);
    expect(food.nutrition.sugar).toBe(11.57);
    expect(transformed.total.protein).toBe(24.73);
    expect(transformed.total.sugar).toBe(11.57);
  });

  it('passes through canonical foods shape (water tracker)', () => {
    const transformed = transformToBackgroundServiceFormat({
      foods: [{
        name: 'water',
        volume_ml: 500,
        calories: 0,
        isLiquid: true,
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      }],
      total: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      confidence: 'high',
      processedBy: 'water_preset',
    });

    expect(transformed.foods).toHaveLength(1);
    expect(transformed.foods[0].name).toBe('water');
    expect(transformed.foods[0].volume_ml).toBe(500);
    expect(transformed.processedBy).toBe('water_preset');
    expect(transformed.total.calories).toBe(0);
  });
});
