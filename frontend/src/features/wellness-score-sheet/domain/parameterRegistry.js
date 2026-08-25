/**
 * 35 wellness score parameters — mirrors backend parameter-registry.js.
 */

export const PARAMETER_SECTIONS = Object.freeze([
  { id: 'logging', label: 'Activity / Logging' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'progress', label: 'Progress' },
]);

export const WELLNESS_PARAMETERS = Object.freeze([
  { key: 'weight_post', label: 'Weight Post', section: 'logging', scoringMode: 'binary' },
  { key: 'edu_post', label: 'Education Post', section: 'logging', scoringMode: 'binary' },
  { key: 'breakfast_post', label: 'Breakfast Post', section: 'logging', scoringMode: 'binary' },
  { key: 'lunch_post', label: 'Lunch Post', section: 'logging', scoringMode: 'binary' },
  { key: 'dinner_post', label: 'Dinner Post', section: 'logging', scoringMode: 'binary' },
  { key: 'good_habit_post', label: 'Good Habit Post', section: 'logging', scoringMode: 'binary' },

  { key: 'calories', label: 'Calories', section: 'nutrition', scoringMode: 'limit' },
  { key: 'carbohydrates', label: 'Carbohydrates', section: 'nutrition', scoringMode: 'limit' },
  { key: 'fat', label: 'Fat', section: 'nutrition', scoringMode: 'limit' },
  { key: 'protein', label: 'Protein', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'sodium', label: 'Sodium', section: 'nutrition', scoringMode: 'limit' },
  { key: 'cholesterol', label: 'Cholesterol', section: 'nutrition', scoringMode: 'limit' },
  { key: 'sugar', label: 'Sugar', section: 'nutrition', scoringMode: 'limit' },
  { key: 'fiber', label: 'Fiber', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'gi', label: 'GI', section: 'nutrition', scoringMode: 'limit' },

  { key: 'vitamin_a', label: 'Vitamin A', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_c', label: 'Vitamin C', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_d', label: 'Vitamin D', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_e', label: 'Vitamin E', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_k', label: 'Vitamin K', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b1', label: 'Vitamin B1', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b2', label: 'Vitamin B2', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b3', label: 'Vitamin B3', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b6', label: 'Vitamin B6', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b9', label: 'Vitamin B9', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'vitamin_b12', label: 'Vitamin B12', section: 'nutrition', scoringMode: 'proportional' },

  { key: 'calcium', label: 'Calcium', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'iron', label: 'Iron', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'magnesium', label: 'Magnesium', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'potassium', label: 'Potassium', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'zinc', label: 'Zinc', section: 'nutrition', scoringMode: 'proportional' },
  { key: 'phosphorus', label: 'Phosphorus', section: 'nutrition', scoringMode: 'proportional' },

  { key: 'weight_improvement', label: 'Weight Improvement', section: 'progress', scoringMode: 'progress' },
  { key: 'water_qty', label: 'Water Quantity', section: 'progress', scoringMode: 'proportional' },
  { key: 'physical_activity', label: 'Physical Activity', section: 'progress', scoringMode: 'proportional' },
]);

export const DEFAULT_PARAMETER_CONFIG = Object.freeze(
  WELLNESS_PARAMETERS.map((p) => ({
    key: p.key,
    label: p.label,
    section: p.section,
    scoringMode: p.scoringMode,
    maxPoints: 100,
    enabled: true,
  })),
);

export function getParameterMeta(key) {
  return WELLNESS_PARAMETERS.find((p) => p.key === key) || null;
}

export function parametersBySection(parameters = []) {
  const grouped = {};
  for (const section of PARAMETER_SECTIONS) {
    grouped[section.id] = {
      ...section,
      parameters: parameters.filter((p) => {
        const meta = getParameterMeta(p.key);
        return meta?.section === section.id;
      }),
    };
  }
  return grouped;
}
