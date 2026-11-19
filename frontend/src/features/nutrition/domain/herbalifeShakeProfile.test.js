/**
 * herbalifeShakeProfile.test.js — Active Fibre Complex + combine math
 */
import {
  ACTIVE_FIBRE_COMPLEX,
  combinePersonalizedProteinNutrition,
  combineShakeNutrition,
  powderGramsFromServings,
  resolveLoggedShakeItem,
  scaleActiveFibreNutrition,
  HERBALIFE_SHAKE_STANDARD,
  PERSONALIZED_PROTEIN_PER_SCOOP,
  FORMULA1_GLYCEMIC_INDEX,
  FORMULA1_NUTRITION_PER_25G,
  SHAKEMATE_GLYCEMIC_INDEX,
  SHAKEMATE_NUTRITION_PER_27G,
} from './herbalifeShakeProfile';
import { SHAKE_PRODUCTS } from './shakeProductProfiles';

describe('Active Fibre Complex nutrition', () => {
  test('label per scoop matches canister (6.7 g)', () => {
    expect(ACTIVE_FIBRE_COMPLEX.weightPerScoopG).toBe(6.7);
    expect(ACTIVE_FIBRE_COMPLEX.nutritionPerScoop).toEqual({
      calories: 12.8,
      protein: 0,
      carbs: 5.7,
      fat: 0,
      fiber: 5.0,
      sugar: 0.19,
      sodium: 16.45,
      cholesterol: 0,
    });
  });

  test('scales linearly by scoop count', () => {
    expect(scaleActiveFibreNutrition(2)).toEqual({
      calories: 25.6,
      protein: 0,
      carbs: 11.4,
      fat: 0,
      fiber: 10,
      sugar: 0.38,
      sodium: 32.9,
      cholesterol: 0,
    });
  });
});

describe('combineShakeNutrition', () => {
  test('standard recipe unchanged when Active Fibre is 0', () => {
    const item = combineShakeNutrition(58, 0);
    expect(item.weight_g).toBe(58);
    expect(item.nutrition.calories).toBe(223);
    expect(item.nutrition.fiber).toBe(3);
  });

  test('adds Active Fibre macros without scaling base mix by fibre weight', () => {
    const item = combineShakeNutrition(58, 1);
    expect(item.weight_g).toBe(64.7);
    expect(item.nutrition.calories).toBe(235.8); // 223 + 12.8
    expect(item.nutrition.protein).toBe(24.73);
    expect(item.nutrition.carbs).toBe(29.94); // 24.24 + 5.7
    expect(item.nutrition.fiber).toBe(8); // 3 + 5
    expect(item.nutrition.sugar).toBe(11.76); // 11.57 + 0.19
    expect(item.nutrition.sodium).toBe(371.45); // 355 + 16.45
  });

  test('Active Fibre alone is saveable', () => {
    const item = combineShakeNutrition(0, 1);
    expect(item.weight_g).toBe(6.7);
    expect(item.nutrition.calories).toBe(12.8);
    expect(item.nutrition.fiber).toBe(5);
  });

  test('6 g protein powder uses the canister label, not a scaled shake', () => {
    const item = combineShakeNutrition(6, 0);
    expect(item.name).toBe('Personalized Protein Powder');
    expect(item.portion).toBe('1 scoop');
    expect(item.isLiquid).toBe(false);
    expect(item.nutrition.protein).toBe(4.96);
    expect(item.nutrition.carbs).toBe(0.24);
    expect(item.nutrition.fat).toBe(0.18);
    expect(item.nutrition.sodium).toBe(68);
    expect(item.nutrition.calories).toBe(22.96);
    expect(item.nutrition.vitamin_a).toBeUndefined();
  });
});

describe('personalized protein powder alone', () => {
  test('1 scoop matches the canister label, not a scaled Herbalife Shake', () => {
    const item = resolveLoggedShakeItem({
      formula1: 0,
      shakemate: 0,
      protein: 1,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);

    expect(item.name).toBe('Personalized Protein Powder');
    expect(item.portion).toBe('1 scoop');
    expect(item.weight_g).toBe(6);
    expect(item.isLiquid).toBe(false);
    expect(item.volume_ml).toBeNull();
    expect(item.nutrition).toEqual(PERSONALIZED_PROTEIN_PER_SCOOP);
    expect(item.nutrition.protein).toBe(4.96);
    expect(item.nutrition.carbs).toBe(0.24);
    expect(item.nutrition.fat).toBe(0.18);
    expect(item.nutrition.sugar).toBe(0);
    expect(item.nutrition.sodium).toBe(68);
    expect(item.nutrition.cholesterol).toBe(0);
    expect(item.nutrition.vitamin_a).toBeUndefined();
    expect(item.nutrition.glycemic_index).toBeUndefined();
  });

  test('2 scoops scale the label', () => {
    const item = combinePersonalizedProteinNutrition(2, 0);
    expect(item.portion).toBe('2 scoops');
    expect(item.weight_g).toBe(12);
    expect(item.nutrition.calories).toBe(45.92);
    expect(item.nutrition.protein).toBe(9.92);
    expect(item.nutrition.sodium).toBe(136);
  });

  test('Active Fibre adds its own label on top of the powder', () => {
    const item = combinePersonalizedProteinNutrition(1, 1);
    expect(item.name).toBe('Personalized Protein Powder');
    expect(item.nutrition.calories).toBe(35.76);
    expect(item.nutrition.protein).toBe(4.96);
    expect(item.nutrition.carbs).toBe(5.94);
    expect(item.nutrition.fiber).toBe(5);
    expect(item.nutrition.sodium).toBe(84.45);
    expect(item.weight_g).toBe(12.7);
  });

  test('2 scoops of Shakemate alone match the canister label, not a scaled shake', () => {
    const item = resolveLoggedShakeItem({
      formula1: 0,
      shakemate: 2,
      protein: 0,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);

    expect(item.name).toBe('Shakemate');
    expect(item.portion).toBe('2 scoops');
    expect(item.weight_g).toBe(27);
    expect(item.isLiquid).toBe(false);
    expect(item.volume_ml).toBeNull();
    expect(item.nutrition).toEqual({
      ...SHAKEMATE_NUTRITION_PER_27G,
      glycemic_index: SHAKEMATE_GLYCEMIC_INDEX,
    });
    expect(item.nutrition.calories).toBe(106);
    expect(item.nutrition.protein).toBe(10.75);
    expect(item.nutrition.carbs).toBe(13.5);
    expect(item.nutrition.fat).toBe(1);
    expect(item.nutrition.sugar).toBe(4.5);
    expect(item.nutrition.sodium).toBe(169);
    expect(item.nutrition.cholesterol).toBe(4);
    expect(item.nutrition.vitamin_d).toBe(1.65);
    expect(item.nutrition.calcium).toBe(129);
    expect(item.nutrition.vitamin_a).toBeUndefined();
    expect(item.nutrition.glycemic_index).toBe(20);
  });

  test('1 scoop of Shakemate is half the 27 g label', () => {
    const item = resolveLoggedShakeItem({
      formula1: 0,
      shakemate: 1,
      protein: 0,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);

    expect(item.portion).toBe('1 scoop');
    expect(item.weight_g).toBe(13.5);
    expect(item.nutrition.calories).toBe(53);
    expect(item.nutrition.protein).toBe(5.38);
    expect(item.nutrition.calcium).toBe(64.5);
    expect(item.nutrition.glycemic_index).toBe(20);
  });

  test('Active Fibre adds its own label on top of Shakemate', () => {
    const item = resolveLoggedShakeItem({
      formula1: 0,
      shakemate: 2,
      protein: 0,
      activeFibre: 1,
    }, SHAKE_PRODUCTS);

    expect(item.name).toBe('Shakemate');
    expect(item.nutrition.calories).toBe(118.8);
    expect(item.nutrition.protein).toBe(10.75);
    expect(item.nutrition.carbs).toBe(19.2);
    expect(item.nutrition.fiber).toBe(5);
    expect(item.nutrition.sodium).toBe(185.45);
    expect(item.nutrition.glycemic_index).toBe(20);
    expect(item.weight_g).toBe(33.7);
  });

  test('Shakemate mixed with Personalized Protein still uses the prepared shake', () => {
    const item = resolveLoggedShakeItem({
      formula1: 0,
      shakemate: 2,
      protein: 1,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);
    expect(item.name).toBe('Herbalife Shake');
    expect(item.weight_g).toBe(33);
    expect(item.nutrition.calories).not.toBe(106);
  });

  test('3 scoops of Formula 1 alone match the canister label, not a scaled shake', () => {
    const item = resolveLoggedShakeItem({
      formula1: 3,
      shakemate: 0,
      protein: 0,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);

    expect(item.name).toBe('Formula 1 Shake');
    expect(item.portion).toBe('3 scoops');
    expect(item.weight_g).toBe(25);
    expect(item.isLiquid).toBe(false);
    expect(item.volume_ml).toBeNull();
    expect(item.nutrition).toEqual({
      ...FORMULA1_NUTRITION_PER_25G,
      glycemic_index: FORMULA1_GLYCEMIC_INDEX,
    });
    expect(item.nutrition.calories).toBe(94.2);
    expect(item.nutrition.protein).toBe(9);
    expect(item.nutrition.carbs).toBe(10.5);
    expect(item.nutrition.fat).toBe(1.8);
    expect(item.nutrition.fiber).toBe(3);
    expect(item.nutrition.sugar).toBe(6.5);
    expect(item.nutrition.sodium).toBe(123);
    expect(item.nutrition.cholesterol).toBe(3);
    expect(item.nutrition.vitamin_a).toBe(210);
    expect(item.nutrition.vitamin_d).toBe(1.75);
    expect(item.nutrition.calcium).toBe(45);
    expect(item.nutrition.iron).toBe(3.5);
    expect(item.nutrition.glycemic_index).toBe(20);
  });

  test('1 scoop of Formula 1 is one third of the 25 g label and keeps GI', () => {
    const item = resolveLoggedShakeItem({
      formula1: 1,
      shakemate: 0,
      protein: 0,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);

    expect(item.portion).toBe('1 scoop');
    expect(item.weight_g).toBe(8.33);
    expect(item.nutrition.calories).toBe(31.4);
    expect(item.nutrition.sugar).toBe(2.17);
    expect(item.nutrition.iron).toBe(1.17);
    expect(item.nutrition.glycemic_index).toBe(20);
  });

  test('Formula 1 mixed with Shakemate still uses the prepared shake profile', () => {
    const standard = resolveLoggedShakeItem({
      formula1: 3,
      shakemate: 2,
      protein: 1,
      activeFibre: 0,
    }, SHAKE_PRODUCTS);
    expect(standard.name).toBe('Herbalife Shake');
    expect(standard.nutrition.calories).toBe(223);
    expect(standard.portion).toBe('1 serving (300ml)');
  });
});

describe('powderGramsFromServings additive flag', () => {
  test('excludes Active Fibre from base powder grams', () => {
    const servings = {
      formula1: 3,
      shakemate: 2,
      protein: 1,
      activeFibre: 2,
    };
    expect(powderGramsFromServings(servings, SHAKE_PRODUCTS, { includeAdditive: false }))
      .toBe(HERBALIFE_SHAKE_STANDARD.weight_g);
    expect(powderGramsFromServings(servings, SHAKE_PRODUCTS, { includeAdditive: true }))
      .toBeCloseTo(58 + 13.4, 5);
  });
});
