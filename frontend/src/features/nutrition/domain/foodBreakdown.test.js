/**
 * foodBreakdown.test.js — nutrient contribution modal helpers.
 *
 * Run: npx react-scripts test --watchAll=false --testPathPattern=foodBreakdown
 */
import {
  extractFoodContributions,
  getNutrientDisplayName,
  getNutrientUnit,
  getNutrientTotal,
  getNutrientTarget,
} from './foodBreakdown';

describe('extractFoodContributions', () => {
  test('splits potassium across foods with percentages', () => {
    const analyses = [{
      AnalysisData: {
        foods: [
          { name: 'Hard-boiled Egg', nutrition: { potassium: 189 } },
          { name: 'Instant Noodles', nutrition: { potassium: 100 } },
        ],
      },
    }];
    const { breakdown, total } = extractFoodContributions(analyses, 'totalPotassium');
    expect(total).toBe(289);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].foodName).toBe('Hard-boiled Egg');
    expect(breakdown[0].amount).toBe(189);
    expect(Math.round(breakdown[0].percentage)).toBe(65);
    expect(breakdown[1].foodName).toBe('Instant Noodles');
    expect(Math.round(breakdown[1].percentage)).toBe(35);
  });

  test('falls back to meal-level DB column when per-food micros are missing', () => {
    const analyses = [{
      TotalPotassium: 400,
      AnalysisData: { foods: [{ name: 'Banana', nutrition: {} }] },
    }];
    const { breakdown, total } = extractFoodContributions(analyses, 'totalPotassium');
    expect(total).toBe(400);
    expect(breakdown[0].foodName).toBe('Banana');
    expect(breakdown[0].amount).toBe(400);
  });
});

describe('nutrient display helpers', () => {
  test('names and units for minerals / heart / glucose-friendly', () => {
    expect(getNutrientDisplayName('totalPotassium')).toBe('Potassium');
    expect(getNutrientUnit('totalPotassium')).toBe('mg');
    expect(getNutrientDisplayName('sodium')).toBe('Sodium');
    expect(getNutrientUnit('sodium')).toBe('mg');
    expect(getNutrientDisplayName('sugar')).toBe('Sugar');
    expect(getNutrientUnit('sugar')).toBe('g');
  });

  test('totals and RDA targets for potassium', () => {
    const dailyStats = { totalPotassium: 289 };
    expect(getNutrientTotal('totalPotassium', dailyStats)).toBe(289);
    expect(getNutrientTarget('totalPotassium')).toBe(3500);
  });
});
