/**
 * Unit tests for diary food activity typing + volume/scoop extraction.
 */
import {
  DIARY_FOOD_ACTIVITY,
  resolveFoodActivityType,
  shouldShowMealBadge,
  extractVolumeMl,
  extractScoops,
  extractShakeServings,
  extractShakeProducts,
  sumAfreshScoopsFromDayAnalyses,
  extractFoodItemDisplayNames,
} from '../activityType';
import { formatWaterVolume } from '../formatVolume';
import { resolveFoodRowPresentation } from '../foodRowDisplay';
import {
  buildDiaryShareText,
  buildFoodShareText,
  buildWaterShareText,
  buildAfreshShareText,
  buildShakeShareText,
  buildEducationShareText,
  buildWeightShareText,
  buildDiaryShareSuffix,
  resolveBeverageDayShareText,
  resolveWeightDeltaDisplay,
} from '../share';

describe('diary activityType', () => {
  test('detects water via processedBy without merging afresh', () => {
    expect(resolveFoodActivityType({
      processedBy: 'water_preset',
      foodData: { name: 'Plain Water', detailedItems: [{ name: 'Plain Water', volume_ml: 1000 }] },
    })).toBe(DIARY_FOOD_ACTIVITY.WATER);

    expect(resolveFoodActivityType({
      processedBy: 'afresh_preset',
      foodData: { name: 'Herbalife Afresh', detailedItems: [{ name: 'Herbalife Afresh', scoops: 2 }] },
    })).toBe(DIARY_FOOD_ACTIVITY.AFRESH);

    expect(resolveFoodActivityType({
      processedBy: 'water_preset',
    })).not.toBe(DIARY_FOOD_ACTIVITY.AFRESH);
  });

  test('detects water tracker rows by name when processedBy is missing', () => {
    expect(resolveFoodActivityType({
      foodData: { name: 'water', detailedItems: [{ name: 'water', volume_ml: 250 }] },
    })).toBe(DIARY_FOOD_ACTIVITY.WATER);
  });

  test('detects legacy water rows with volume but missing processedBy', () => {
    expect(resolveFoodActivityType({
      foodData: {
        name: 'Unknown Food',
        detailedItems: [{
          name: 'Unknown Food',
          volume_ml: 500,
          isLiquid: true,
          unit: 'ml',
          nutrition: { calories: 0 },
        }],
      },
    })).toBe(DIARY_FOOD_ACTIVITY.WATER);
  });

  test('detects shake via processedBy', () => {
    expect(resolveFoodActivityType({
      processedBy: 'shake_calculator',
      foodData: { name: 'Herbalife Shake', detailedItems: [{ name: 'Herbalife Shake' }] },
    })).toBe(DIARY_FOOD_ACTIVITY.SHAKE);
  });

  test('hides meal badge for water and afresh only', () => {
    expect(shouldShowMealBadge(DIARY_FOOD_ACTIVITY.WATER)).toBe(false);
    expect(shouldShowMealBadge(DIARY_FOOD_ACTIVITY.AFRESH)).toBe(false);
    expect(shouldShowMealBadge(DIARY_FOOD_ACTIVITY.FOOD)).toBe(true);
    expect(shouldShowMealBadge(DIARY_FOOD_ACTIVITY.SHAKE)).toBe(true);
  });

  test('extracts volume and scoops independently', () => {
    expect(extractVolumeMl({
      detailedItems: [{ name: 'Plain Water', volume_ml: 1000 }],
    })).toBe(1000);
    expect(extractScoops({
      detailedItems: [{ name: 'Afresh', scoops: 2 }],
    })).toBe(2);
    expect(extractShakeServings({
      detailedItems: [{ name: 'Herbalife Shake', portion: '1 serving (300ml)' }],
    })).toBe(1);
  });

  test('extracts every food item display name for share captions', () => {
    expect(extractFoodItemDisplayNames({
      detailedItems: [
        { name: 'White Rice' },
        { name: 'Sambar' },
        { name: 'Onion' },
      ],
    })).toEqual(['White Rice', 'Sambar', 'Onion']);

    expect(extractFoodItemDisplayNames({
      detailedItems: [
        { name: 'White Rice' },
        { name: 'white rice' },
        { name: 'Sambar' },
      ],
    })).toEqual(['White Rice', 'Sambar']);

    expect(extractFoodItemDisplayNames({
      foods: [{ name: 'Masala Dosa' }],
      detailedItems: [
        { name: 'Masala Dosa' },
        { name: 'Dosa with Onion' },
        { name: 'Dosa batter' },
        { name: 'Egg Dosa' },
        { name: 'Ragi Dosa' },
      ],
    })).toEqual([
      'Masala Dosa',
      'Dosa with Onion',
      'Dosa batter',
      'Egg Dosa',
      'Ragi Dosa',
    ]);
  });

  test('sums afresh scoops across day analyses without counting water', () => {
    expect(sumAfreshScoopsFromDayAnalyses([
      {
        ProcessedBy: 'afresh_preset',
        AnalysisData: {
          processedBy: 'afresh_preset',
          foods: [{ name: 'Herbalife Afresh Energy Drink', scoops: 1, volume_ml: 200 }],
        },
      },
      {
        ProcessedBy: 'afresh_preset',
        AnalysisData: {
          processedBy: 'afresh_preset',
          foods: [{ name: 'Herbalife Afresh Energy Drink', scoops: 1, volume_ml: 200 }],
        },
      },
      {
        ProcessedBy: 'water_preset',
        AnalysisData: {
          processedBy: 'water_preset',
          foods: [{ name: 'Plain Water', volume_ml: 500 }],
        },
      },
    ])).toBe(2);

    expect(sumAfreshScoopsFromDayAnalyses([])).toBe(0);
    expect(sumAfreshScoopsFromDayAnalyses(null)).toBe(0);
  });
});

describe('formatWaterVolume', () => {
  test('formats L and mL', () => {
    expect(formatWaterVolume(1000)).toBe('1 L');
    expect(formatWaterVolume(1500)).toBe('1.5 L');
    expect(formatWaterVolume(500)).toBe('500 mL');
    expect(formatWaterVolume(250)).toBe('250 mL');
  });
});

describe('diary share builders', () => {
  test('food template includes meal, name, macros, GI', () => {
    const text = buildFoodShareText({
      mealLabel: 'Lunch',
      foodName: 'Parotta',
      calories: 320,
      protein: 8,
      carbs: 42,
      fat: 12,
      glycemicIndex: 62,
    });
    expect(text).toContain('🍽️ Lunch');
    expect(text).toContain('Food: Parotta');
    expect(text).toContain('Calories: 320 kcal');
    expect(text).toContain('Protein: 8 g');
    expect(text).toContain('GI: 62');
  });

  test('water template has quantity only', () => {
    const text = buildWaterShareText({ volumeMl: 1000 });
    expect(text).toContain('💧 Water Intake');
    expect(text).toContain('Consumed: 1 L');
    expect(text).not.toContain('kcal');
    expect(text).not.toContain('Breakfast');
  });

  test('afresh template has scoops and no meal category', () => {
    const text = buildAfreshShareText({ scoops: 2 });
    expect(text).toBe('🥤 Afresh\n\nScoops: 2');
    expect(text).not.toContain('Lunch');
  });

  test('shake template includes name and product scoops', () => {
    const text = buildShakeShareText({
      shakeName: 'Herbalife Shake',
      shakeProducts: { formula1: 3, shakemate: 2, protein: 1 },
    });
    expect(text).toContain('🥤 Protein Shake');
    expect(text).toContain('Name: Herbalife Shake');
    expect(text).toContain('Formula 1: 3 scoops, Shakemate: 2 scoops, Personalized Protein: 1 scoop');
    expect(text).not.toContain('Serving:');
  });

  test('shake template falls back to serving when scoops missing', () => {
    const text = buildShakeShareText({ shakeName: 'Herbalife Shake', servings: 1 });
    expect(text).toContain('Serving: 1');
  });

  test('education template includes platform and session', () => {
    const text = buildEducationShareText({
      platform: 'Wellness Valley',
      session: 'Healthy Eating Basics',
    });
    expect(text).toContain('🎓 Education');
    expect(text).toContain('Platform: Wellness Valley');
    expect(text).toContain('Session: Healthy Eating Basics');
  });

  test('weight template computes decrease and increase', () => {
    const down = buildWeightShareText({ previousWeight: 72, currentWeight: 70.5 });
    expect(down).toContain('Before: 72 kg');
    expect(down).toContain('After: 70.5 kg');
    expect(down).toContain('⬇️ Decreased by 1.5 kg');

    const up = buildWeightShareText({ previousWeight: 70, currentWeight: 71 });
    expect(up).toContain('⬆️ Increased by 1 kg');

    const smallUp = buildWeightShareText({ previousWeight: 73.35, currentWeight: 73.5 });
    expect(smallUp).toContain('⬆️ Increased by 150 g');

    const uiDown = resolveWeightDeltaDisplay(72, 70.5);
    expect(uiDown.direction).toBe('down');
    expect(uiDown.label).toBe('Decreased by 1.5 kg');
    expect(uiDown.className).toContain('emerald');

    const uiUp = resolveWeightDeltaDisplay(70, 71);
    expect(uiUp.direction).toBe('up');
    expect(uiUp.label).toBe('Increased by 1 kg');
    expect(uiUp.className).toContain('red');

    const uiGrams = resolveWeightDeltaDisplay(73.35, 73.5);
    expect(uiGrams.direction).toBe('up');
    expect(uiGrams.label).toBe('Increased by 150 g');

    // 0 kg is not a valid previous weight — no fake "Increased by 73.5 kg"
    expect(resolveWeightDeltaDisplay(0, 73.5).label).toBeNull();
  });

  test('dispatcher routes by activity type', () => {
    expect(buildDiaryShareText('water', { volumeMl: 500 })).toContain('500 mL');
    expect(buildDiaryShareText('afresh', { scoops: 3 })).toContain('Scoops: 3');
    expect(buildDiaryShareText('education', { platform: 'Zoom', session: 'Intro' }))
      .toContain('Platform: Zoom');
  });
});

describe('buildDiaryShareSuffix', () => {
  test('water and afresh suffixes show total consumed so far today', () => {
    expect(buildDiaryShareSuffix('water', { volumeMl: 1000 }))
      .toBe('*Consumed: 1 L* water so far today');
    expect(buildDiaryShareSuffix('water', { volumeMl: 2500 }))
      .toBe('*Consumed: 2.5 L* water so far today');
    expect(buildDiaryShareSuffix('water', { volumeMl: 500 }))
      .toBe('*Consumed: 500 mL* water so far today');
    expect(buildDiaryShareSuffix('afresh', { scoops: 2 }))
      .toBe('*Consumed: 2 scoops* Afresh so far today,');
    expect(buildDiaryShareSuffix('afresh', { scoops: 1 }))
      .toBe('*Consumed: 1 scoop* Afresh so far today,');
    expect(buildDiaryShareSuffix('afresh', { scoops: 1, soFarToday: false }))
      .toBe('*Consumed: 1 scoop* Afresh,');
    expect(buildDiaryShareSuffix('water', { volumeMl: 200, soFarToday: false }))
      .toBe('*Consumed: 200 mL* water');
  });

  test('food suffix is total kcal then each item on its own line', () => {
    expect(buildDiaryShareSuffix('food', {
      foodName: 'White Rice+4more',
      calories: 875,
      protein: 28,
      carbs: 160,
      fat: 12,
      fiber: 16,
      glycemicIndex: 66,
    })).toBe('*875 kcal, GI : 66 (MEDIUM)*\n*White Rice+4more,*');
  });

  test('food suffix lists overall kcal and GI first, then every bold item name', () => {
    expect(buildDiaryShareSuffix('food', {
      foodName: 'White Rice+2more',
      foodItems: [
        { name: 'White Rice', glycemicIndex: 73 },
        { name: 'Sambar', glycemicIndex: 50 },
        { name: 'Onion', glycemicIndex: 10 },
      ],
      calories: 875,
      protein: 28,
      carbs: 160,
      fat: 12,
      fiber: 16,
      glycemicIndex: 66,
    })).toBe('*875 kcal, GI : 66 (MEDIUM)*\n*White Rice*\n*Sambar*\n*Onion*');
  });

  test('food suffix keeps a trailing comma only for items missing GI', () => {
    expect(buildDiaryShareSuffix('food', {
      foodName: 'White Rice+2more',
      foodItems: [
        { name: 'Masala Chai (Indian spiced tea)' },
        { name: 'Masala Dosa', glycemicIndex: 65 },
        { name: 'Chana Masala', glycemicIndex: 33 },
      ],
      calories: 875,
      glycemicIndex: 55,
    })).toBe('*875 kcal, GI : 55 (LOW)*\n*Masala Chai (Indian spiced tea),*\n*Masala Dosa*\n*Chana Masala*');
  });

  test('weight suffix omits invalid previous weights (0 or negative)', () => {
    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 0,
      currentWeight: 77,
    })).toBe('After: 77 kg');

    expect(buildDiaryShareSuffix('weight', {
      previousWeight: -5,
      currentWeight: 77,
    })).toBe('After: 77 kg');
  });

  test('weight suffix includes before, after, and arrow', () => {
    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 55.7,
      currentWeight: 55.6,
    })).toBe('Before: 55.7 kg\nAfter: 55.6 kg ⬇️');

    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 70,
      currentWeight: 71,
    })).toBe('Before: 70 kg\nAfter: 71 kg ⬆️');

    expect(buildDiaryShareSuffix('weight', {
      currentWeight: 55.6,
    })).toBe('After: 55.6 kg');
  });

  test('weight suffix lists Ideal, Before, After with arrow on after', () => {
    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 73.65,
      currentWeight: 73.4,
      idealWeight: 73.6,
    })).toBe('Ideal: 73.6 kg\nBefore: 73.65 kg\nAfter: 73.4 kg ⬇️');

    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 73.4,
      currentWeight: 72.9,
      idealWeight: 73.7,
    })).toBe('Ideal: 73.7 kg\nBefore: 73.4 kg\nAfter: 72.9 kg ⬇️');

    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 72.9,
      currentWeight: 72.85,
      idealWeight: 73.7,
    })).toBe('Ideal: 73.7 kg\nBefore: 72.9 kg\nAfter: 72.85 kg ⬇️');

    expect(buildDiaryShareSuffix('weight', {
      previousWeight: 73.4,
      currentWeight: 74.1,
      idealWeight: 73.7,
    })).toBe('Ideal: 73.7 kg\nBefore: 73.4 kg\nAfter: 74.1 kg ⬆️');

    expect(buildDiaryShareSuffix('weight', {
      currentWeight: 55.6,
      idealWeight: 62.4,
    })).toBe('Ideal: 62.4 kg\nAfter: 55.6 kg');
  });

  test('workout suffix shows calories burnt so far today', () => {
    expect(buildDiaryShareSuffix('workout', { caloriesBurned: 457 }))
      .toBe('Calories Burnt: 457 kcal so far today');
    expect(buildDiaryShareSuffix('watch', { kcal: 320 }))
      .toBe('Calories Burnt: 320 kcal so far today');
  });

  test('education suffix is session · platform without type prefix', () => {
    expect(buildDiaryShareSuffix('education', {
      platform: 'Zoom',
      session: 'Academy',
    })).toBe('*Academy · Zoom,*');

    expect(buildDiaryShareSuffix('education', {
      session: 'Daily Education',
      platform: 'Zoom',
    })).toBe('*Daily Education · Zoom,*');

    expect(buildDiaryShareSuffix('education', {
      session: 'Academy',
    })).toBe('Academy');
  });

  test('good-habit suffix is Good Habit, with notes when present', () => {
    expect(buildDiaryShareSuffix('good-habit', {
      habitType: 'image_notes',
      notes: 'Morning walk',
    })).toBe('Good Habit — Morning walk');
    expect(buildDiaryShareSuffix('good-habit', {
      habitType: 'image_notes',
    })).toBe('Good Habit');
    expect(buildDiaryShareSuffix('good-habit', {
      habitType: 'before_after',
    })).toBe('Good Habit');
  });

  test('shake suffix includes Formula 1, Shakemate, and Protein scoops', () => {
    expect(buildDiaryShareSuffix('shake', {
      shakeName: 'Herbalife Shake',
      shakeProducts: { formula1: 3, shakemate: 2, protein: 1 },
    })).toBe('*Herbalife Shake,*\n*Formula 1: 3 scoops,*\n*Shakemate: 2 scoops,*\n*Personalized Protein: 1 scoop,*');

    expect(buildDiaryShareSuffix('shake', {
      shakeName: 'Herbalife Shake',
      shakeProducts: { formula1: 3, shakemate: 0, protein: 1 },
    })).toBe('*Herbalife Shake,*\n*Formula 1: 3 scoops,*\n*Personalized Protein: 1 scoop,*');

    expect(buildDiaryShareSuffix('shake', {
      shakeName: 'Herbalife Shake',
      servings: 1,
    })).toBe('Herbalife Shake, serving 1');
  });
});

describe('resolveBeverageDayShareText', () => {
  test('water prefers day total over this-card fallback', () => {
    expect(resolveBeverageDayShareText({
      activityType: 'water',
      totalMl: 3500,
      fallbackVolumeMl: 2000,
    })).toBe('*Consumed: 3.5 L* water so far today');
  });

  test('water falls back to card volume when day total missing', () => {
    expect(resolveBeverageDayShareText({
      activityType: 'water',
      totalMl: null,
      fallbackVolumeMl: 2000,
    })).toBe('*Consumed: 2 L* water so far today');
  });

  test('afresh prefers day scoops over this-card fallback', () => {
    expect(resolveBeverageDayShareText({
      activityType: 'afresh',
      totalAfreshScoops: 4,
      fallbackScoops: 2,
      calories: 14,
    })).toBe('Consumed: 4 scoops Afresh so far today');
  });
});

describe('extractShakeProducts', () => {
  test('reads scoop counts from detailedItems', () => {
    expect(extractShakeProducts({
      detailedItems: [{
        name: 'Herbalife Shake',
        shakeProducts: { formula1: 3, shakemate: 2, protein: 1 },
      }],
    })).toEqual({ formula1: 3, shakemate: 2, protein: 1 });
  });
});

describe('resolveFoodRowPresentation', () => {
  test('water row shows volume not kcal and hides meal badge', () => {
    const view = resolveFoodRowPresentation({
      processedBy: 'water_preset',
      foodData: {
        name: 'Plain Water',
        detailedItems: [{ name: 'Plain Water', volume_ml: 1000 }],
        nutrition: { calories: 0 },
      },
      calories: 0,
      mealLabel: 'Lunch',
    });
    expect(view.activityType).toBe('water');
    expect(view.showMealBadge).toBe(false);
    expect(view.primaryValue).toBe('1');
    expect(view.primaryUnit).toBe('L');
    expect(view.shareText).toBe('*Consumed: 1 L* water');
    expect(view.thumbFallback).toBe('💧');
  });

  test('water diary caption uses this card volume, not a day total', () => {
    const view = resolveFoodRowPresentation({
      processedBy: 'water_preset',
      foodData: {
        name: 'Plain Water',
        detailedItems: [{ name: 'Plain Water', volume_ml: 200 }],
        nutrition: { calories: 0 },
      },
      calories: 0,
    });
    expect(view.shareText).toBe('*Consumed: 200 mL* water');
  });

  test('afresh row shows kcal with scoops secondary and hides meal badge', () => {
    const view = resolveFoodRowPresentation({
      processedBy: 'afresh_preset',
      foodData: {
        name: 'Herbalife Afresh Energy Drink (2 scoops)',
        detailedItems: [{ name: 'Herbalife Afresh Energy Drink (2 scoops)', scoops: 2 }],
        nutrition: { calories: 7 },
      },
      calories: 7,
      mealLabel: 'Breakfast',
    });
    expect(view.activityType).toBe('afresh');
    expect(view.showMealBadge).toBe(false);
    expect(view.primaryValue).toBe('7');
    expect(view.primaryUnit).toBe('kcal');
    expect(view.secondaryLabel).toBe('2 scoops');
    expect(view.shareText).toBe('*Consumed: 2 scoops* Afresh,');
    expect(view.thumbFallback).toBe('🥤');
  });

  test('afresh diary caption uses this card scoops, not a day total', () => {
    const view = resolveFoodRowPresentation({
      processedBy: 'afresh_preset',
      foodData: {
        name: 'Herbalife Afresh Energy Drink',
        detailedItems: [{ name: 'Herbalife Afresh Energy Drink', scoops: 1 }],
        nutrition: { calories: 4 },
      },
      calories: 4,
    });
    expect(view.shareText).toBe('*Consumed: 1 scoop* Afresh,');
  });

  test('food row share caption lists every item and total kcal', () => {
    const view = resolveFoodRowPresentation({
      foodData: {
        name: 'White Rice+2more',
        detailedItems: [
          { name: 'White Rice', calories: 200, nutrition: { glycemic_index: 73 } },
          { name: 'Sambar', calories: 80, nutrition: { glycemic_index: 50 } },
          { name: 'Onion', calories: 20, nutrition: { glycemic_index: 10 } },
        ],
        nutrition: { calories: 300, protein: 8, carbs: 50, fat: 4, fiber: 3, glycemic_index: 70 },
      },
      calories: 300,
    });
    expect(view.shareText).toBe('*300 kcal, GI : 70 (HIGH)*\n*White Rice*\n*Sambar*\n*Onion*');
  });
});
