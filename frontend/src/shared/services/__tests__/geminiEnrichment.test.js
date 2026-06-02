/**
 * Tests for USDA micronutrient enrichment fallback
 * When Gemini returns 0 for sugar/sodium/cholesterol, apply USDA defaults
 */

import { geminiService } from '../geminiService';

describe('GeminiService - USDA Enrichment', () => {
  test('enriches dosa with USDA values when Gemini returns zeros', () => {
    const geminiResponse = {
      foods: [{
        name: 'dosa',
        portion: '1 piece',
        weight_g: 70,
        unit: 'g',
        isLiquid: false,
        nutrition: {
          calories: 133,
          protein: 4,
          carbs: 20,
          fat: 4,
          fiber: 0,      // Gemini returned 0
          sugar: 0,      // Gemini returned 0
          sodium: 0,     // Gemini returned 0
          cholesterol: 0 // Gemini returned 0
        }
      }],
      total: { calories: 133, protein: 4, carbs: 20, fat: 4, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // USDA defaults for dosa per 100g: fiber: 1.5, sugar: 0.5, sodium: 250, cholesterol: 0
    // Scaled to 70g: fiber: 1.05 ≈ 1.1, sugar: 0.35 ≈ 0.4, sodium: 175, cholesterol: 0
    expect(enriched.foods[0].nutrition.fiber).toBeGreaterThan(0);
    expect(enriched.foods[0].nutrition.sugar).toBeGreaterThan(0);
    expect(enriched.foods[0].nutrition.sodium).toBeGreaterThan(0);
    expect(enriched.foods[0].nutrition.cholesterol).toBe(0); // Dosa has no cholesterol
  });

  test('enriches coconut chutney with USDA values', () => {
    const geminiResponse = {
      foods: [{
        name: 'coconut chutney',
        portion: '1 small bowl',
        weight_g: 50,
        unit: 'ml',
        isLiquid: true,
        nutrition: {
          calories: 100,
          protein: 1,
          carbs: 3,
          fat: 10,
          fiber: 0,
          sugar: 0,
          sodium: 0,
          cholesterol: 0
        }
      }],
      total: { calories: 100, protein: 1, carbs: 3, fat: 10, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // USDA defaults for coconut chutney per 100g: fiber: 2.0, sugar: 1.5, sodium: 300, cholesterol: 0
    // Scaled to 50g: fiber: 1.0, sugar: 0.75 ≈ 0.8, sodium: 150, cholesterol: 0
    expect(enriched.foods[0].nutrition.fiber).toBeGreaterThan(0);
    expect(enriched.foods[0].nutrition.sugar).toBeGreaterThan(0);
    expect(enriched.foods[0].nutrition.sodium).toBeGreaterThan(0);
  });

  test('enriches multiple foods and recalculates totals', () => {
    const geminiResponse = {
      foods: [
        {
          name: 'dosa',
          weight_g: 70,
          nutrition: { calories: 133, protein: 4, carbs: 20, fat: 4, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
        },
        {
          name: 'sambar',
          weight_g: 50,
          nutrition: { calories: 70, protein: 3, carbs: 8, fat: 3, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
        }
      ],
      total: { calories: 203, protein: 7, carbs: 28, fat: 7, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // Verify totals were recalculated
    expect(enriched.total.fiber).toBeGreaterThan(0);
    expect(enriched.total.sugar).toBeGreaterThan(0);
    expect(enriched.total.sodium).toBeGreaterThan(0);

    // Verify total is sum of individual foods
    const calculatedFiber = enriched.foods.reduce((sum, f) => sum + f.nutrition.fiber, 0);
    expect(enriched.total.fiber).toBe(calculatedFiber);
  });

  test('does NOT enrich when Gemini provides non-zero values', () => {
    const geminiResponse = {
      foods: [{
        name: 'banana',
        weight_g: 120,
        nutrition: {
          calories: 105,
          protein: 1,
          carbs: 27,
          fat: 0,
          fiber: 3.1,      // Gemini provided value
          sugar: 14.4,     // Gemini provided value
          sodium: 1,       // Gemini provided value
          cholesterol: 0   // Gemini provided value
        }
      }],
      total: { calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3.1, sugar: 14.4, sodium: 1, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // Should preserve ALL Gemini's values (not replace with USDA)
    expect(enriched.foods[0].nutrition.fiber).toBe(3.1);
    expect(enriched.foods[0].nutrition.sugar).toBe(14.4);
    expect(enriched.foods[0].nutrition.sodium).toBe(1);
    expect(enriched.foods[0].nutrition.cholesterol).toBe(0); // 0 is valid for banana
  });

  test('enriches ONLY missing fields (preserves partial Gemini data)', () => {
    const geminiResponse = {
      foods: [{
        name: 'mixed vegetable curry',
        weight_g: 100,
        nutrition: {
          calories: 120,
          protein: 3,
          carbs: 15,
          fat: 5,
          fiber: 4,        // Gemini provided (non-zero)
          sugar: 0,        // Missing
          sodium: 0,       // Missing
          cholesterol: 0   // Missing
        }
      }],
      total: { calories: 120, protein: 3, carbs: 15, fat: 5, fiber: 4, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // Should PRESERVE Gemini's fiber value
    expect(enriched.foods[0].nutrition.fiber).toBe(4);
    
    // Should ENRICH the missing values (using USDA defaults for vegetable curry)
    expect(enriched.foods[0].nutrition.sugar).toBeGreaterThan(0); // Should get USDA value
    expect(enriched.foods[0].nutrition.sodium).toBeGreaterThan(0); // Should get USDA value
    expect(enriched.foods[0].nutrition.cholesterol).toBe(0); // Correct for veg curry
  });

  test('uses default fallback for unknown foods', () => {
    const geminiResponse = {
      foods: [{
        name: 'mystery food item',
        weight_g: 100,
        nutrition: { calories: 200, protein: 5, carbs: 30, fat: 8, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
      }],
      total: { calories: 200, protein: 5, carbs: 30, fat: 8, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // Should apply default fallback values (fiber: 1.0, sugar: 2.0, sodium: 150, cholesterol: 0 per 100g)
    expect(enriched.foods[0].nutrition.fiber).toBe(1.0);
    expect(enriched.foods[0].nutrition.sugar).toBe(2.0);
    expect(enriched.foods[0].nutrition.sodium).toBe(150);
  });

  test('handles partial matches (e.g., "masala dosa" matches "dosa")', () => {
    const geminiResponse = {
      foods: [{
        name: 'Masala Dosa',
        weight_g: 100,
        nutrition: { calories: 190, protein: 6, carbs: 28, fat: 6, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
      }],
      total: { calories: 190, protein: 6, carbs: 28, fat: 6, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
    };

    const enriched = geminiService.enrichMicronutrients(geminiResponse);

    // Should match "dosa" defaults despite being "Masala Dosa"
    expect(enriched.foods[0].nutrition.fiber).toBe(1.5); // dosa default scaled to 100g
    expect(enriched.foods[0].nutrition.sodium).toBe(250);
  });
});
