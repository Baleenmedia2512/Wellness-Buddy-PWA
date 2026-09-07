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
    expect(view.breakdown.length).toBeGreaterThan(0);
    expect(view.unit).toBe('g');
  });
});
