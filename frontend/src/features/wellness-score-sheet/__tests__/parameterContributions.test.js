import {
  buildParameterContributionView,
  extractNutrientContributions,
  extractMealWindowContributions,
  parameterNeedsMeals,
} from '../domain/parameterContributions';

describe('parameterContributions', () => {
  const meals = [
    {
      CreatedAt: '2026-07-24T13:22:21',
      TotalProtein: 20,
      AnalysisData: {
        foods: [
          { name: 'Chicken', nutrition: { protein: 20, calories: 200 } },
          { name: 'Rice', nutrition: { protein: 4, calories: 180, carbs: 40 } },
        ],
      },
    },
    {
      CreatedAt: '2026-07-24T19:10:00',
      TotalProtein: 10,
      AnalysisData: {
        foods: [{ name: 'Dal', nutrition: { protein: 10, calories: 120 } }],
      },
    },
  ];

  test('parameterNeedsMeals for nutrition and meal posts', () => {
    expect(parameterNeedsMeals('protein')).toBe(true);
    expect(parameterNeedsMeals('dinner_post')).toBe(true);
    expect(parameterNeedsMeals('weight_post')).toBe(false);
    expect(parameterNeedsMeals('good_habit_post')).toBe(false);
  });

  test('extractNutrientContributions sorts by amount', () => {
    const { breakdown, total, unit } = extractNutrientContributions(meals, 'protein');
    expect(unit).toBe('g');
    expect(total).toBe(34);
    expect(breakdown[0].foodName).toBe('Chicken');
    expect(breakdown[0].percentage).toBeCloseTo((20 / 34) * 100);
  });

  test('extractNutrientContributions hides amounts that round to 0g', () => {
    const withTrace = [
      {
        AnalysisData: {
          foods: [
            { name: 'Shake', nutrition: { protein: 25 } },
            { name: 'Afresh', nutrition: { protein: 0.2 } },
            { name: 'Herbalifeline', nutrition: { protein: 0.4 } },
          ],
        },
      },
    ];
    const { breakdown, total } = extractNutrientContributions(withTrace, 'protein');
    expect(total).toBe(25);
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].foodName).toBe('Shake');
  });

  test('extractMealWindowContributions filters dinner window', () => {
    const { breakdown, total } = extractMealWindowContributions(
      meals,
      'dinner_post',
      { dinner: { start: '17:30:00', end: '20:30:00' } },
    );
    expect(total).toBe(1);
    expect(breakdown[0].foodName).toBe('Dal');
  });

  test('buildParameterContributionView for protein', () => {
    const view = buildParameterContributionView({
      parameter: {
        key: 'protein',
        label: 'Protein',
        earnedPoints: 80,
        maxPoints: 100,
        calculationReason: '80 / 100 g',
      },
      meals,
    });
    expect(view.title).toBe('Protein');
    expect(view.isPerServing).toBe(true);
    expect(view.breakdown.length).toBeGreaterThan(0);
    expect(view.unit).toBe('g');
  });

  test('multi-day nutrient view labels period and includes meal dates', () => {
    const multiDayMeals = [
      {
        CreatedAt: '2026-07-20T08:00:00',
        AnalysisData: {
          foods: [{ name: 'Oats', nutrition: { calories: 150 } }],
        },
      },
      {
        CreatedAt: '2026-07-24T13:22:21',
        AnalysisData: {
          foods: [{ name: 'Chicken', nutrition: { calories: 200 } }],
        },
      },
    ];
    const view = buildParameterContributionView({
      parameter: {
        key: 'calories',
        label: 'Calories',
        earnedPoints: 6.7,
        maxPoints: 10,
      },
      meals: multiDayMeals,
      periodDayCount: 10,
    });
    expect(view.listLabel).toBe('Top contributing foods over 10 days');
    expect(view.earnedPoints).toBe(6.7);
    expect(view.breakdown).toHaveLength(2);
    expect(view.breakdown[0].foodName).toBe('Chicken');
    expect(view.breakdown[0].detail).toBe('2026-07-24');
    expect(view.breakdown[1].detail).toBe('2026-07-20');
  });

  test('multi-day nutrient view groups same food name and divides amount by log count, sorting by per-log density', () => {
    const shakeMeals = [
      {
        CreatedAt: '2026-10-01T08:00:00',
        AnalysisData: {
          foods: [{ name: 'Herbalife Shake', nutrition: { protein: 25 } }],
        },
      },
      {
        CreatedAt: '2026-10-02T08:00:00',
        AnalysisData: {
          foods: [{ name: 'Herbalife Shake', nutrition: { protein: 25 } }],
        },
      },
      {
        CreatedAt: '2026-10-03T08:00:00',
        AnalysisData: {
          foods: [{ name: 'herbalife shake', nutrition: { protein: 25 } }],
        },
      },
      {
        CreatedAt: '2026-10-03T13:00:00',
        AnalysisData: {
          foods: [{ name: 'Chicken', nutrition: { protein: 30 } }],
        },
      },
    ];
    const view = buildParameterContributionView({
      parameter: {
        key: 'protein',
        label: 'Protein',
        earnedPoints: 5.5,
        maxPoints: 10,
      },
      meals: shakeMeals,
      periodDayCount: 10,
    });
    expect(view.breakdown).toHaveLength(2);
    // Chicken provides 30g/serving vs Herbalife Shake 25g/serving (75g total / 3 logs)
    // so Chicken is sorted first to accurately show which food is richer in protein per consumption.
    expect(view.breakdown[0].foodName).toBe('Chicken');
    expect(view.breakdown[0].amount).toBe(30);
    expect(view.breakdown[0].detail).toBe('2026-10-03');
    expect(view.breakdown[1].foodName).toBe('Herbalife Shake');
    expect(view.breakdown[1].amount).toBe(25);
    expect(view.breakdown[1].totalAmount).toBe(75);
    expect(view.breakdown[1].detail).toBe('3 logs');
    expect(view.totalConsumed).toBe(105);
    expect(view.showAmountPercent).toBe(false);
  });

  test('multi-day nutrient view: HN Skin Booster (20mg/log) ranks above Herbalife Shake (15mg/log across 11 logs)', () => {
    const meals = [];
    // 11 logs of Herbalife Shake with 15mg Vitamin C each (total 165mg)
    for (let i = 1; i <= 11; i++) {
      meals.push({
        CreatedAt: `2026-11-${String(i).padStart(2, '0')}T08:00:00`,
        AnalysisData: {
          foods: [{ name: 'Herbalife Shake', nutrition: { vitaminC: 15 } }],
        },
      });
    }
    // 1 log of HN - Skin Booster - Orange with 20mg Vitamin C
    meals.push({
      CreatedAt: '2026-11-24T10:00:00',
      AnalysisData: {
        foods: [{ name: 'HN - Skin Booster - Orange', nutrition: { vitaminC: 20 } }],
      },
    });

    const view = buildParameterContributionView({
      parameter: {
        key: 'vitamin_c',
        label: 'Vitamin C',
        earnedPoints: 3.9,
        maxPoints: 10,
      },
      meals,
      periodDayCount: 10,
    });

    expect(view.breakdown).toHaveLength(2);
    // HN Skin Booster (20mg) ranks higher than Herbalife Shake (15mg per log)
    expect(view.breakdown[0].foodName).toBe('HN - Skin Booster - Orange');
    expect(view.breakdown[0].amount).toBe(20);
    expect(view.breakdown[0].detail).toBe('2026-11-24');

    expect(view.breakdown[1].foodName).toBe('Herbalife Shake');
    expect(view.breakdown[1].amount).toBe(15);
    expect(view.breakdown[1].totalAmount).toBe(165);
    expect(view.breakdown[1].detail).toBe('11 logs');

    expect(view.totalConsumed).toBe(185);
    expect(view.showAmountPercent).toBe(false);
    expect(view.isPerServing).toBe(true);
  });

  test('extractNutrientContributions includeDateDetail attaches CreatedAt date', () => {
    const { breakdown } = extractNutrientContributions(
      [{
        CreatedAt: '2026-07-21 09:15:00',
        AnalysisData: {
          foods: [{ name: 'Banana', nutrition: { calories: 90 } }],
        },
      }],
      'calories',
      { includeDateDetail: true },
    );
    expect(breakdown[0].detail).toBe('2026-07-21');
  });
});
