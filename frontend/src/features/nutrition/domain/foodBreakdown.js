/**
 * Food-breakdown helpers for nutrient contribution modals.
 * Shared by Home NutritionCarousel and Reports NutritionSectionStack.
 * Behavior preserved from the original carousel implementations.
 */

function parseAnalysisData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Extract foods and their nutrient contributions from analyses.
 * Supports: macros, micros, calories, sodium, cholesterol, sugar, fiber, vitamins, minerals.
 */
export function extractFoodContributions(analyses, nutrientKey) {
  const foods = [];
  let total = 0;

  // Strip "total" prefix if present (e.g., totalVitaminA -> vitaminA)
  const normalizedKey = nutrientKey.startsWith('total')
    ? nutrientKey.charAt(5).toLowerCase() + nutrientKey.slice(6)
    : nutrientKey;

  // DB column name for meal-level fallback (e.g., totalVitaminA -> TotalVitaminA)
  const dbColKey = nutrientKey.startsWith('total')
    ? nutrientKey.charAt(0).toUpperCase() + nutrientKey.slice(1)
    : null;

  (analyses || []).forEach((analysis) => {
    if (analysis.isUndoPlaceholder) return;
    const data = parseAnalysisData(analysis.AnalysisData);
    const foodList = data.foods || [];

    let mealFoodTotal = 0;
    const mealFoods = [];

    foodList.forEach((food) => {
      const nutrition = food.nutrition || {};
      let amount = 0;

      if (normalizedKey === 'protein') amount = nutrition.protein || 0;
      else if (normalizedKey === 'fat') amount = nutrition.fat || 0;
      else if (normalizedKey === 'carbs') amount = nutrition.carbs || 0;
      else if (normalizedKey === 'calories') amount = nutrition.calories || 0;
      else if (normalizedKey === 'sodium') amount = nutrition.sodium || 0;
      else if (normalizedKey === 'cholesterol') amount = nutrition.cholesterol || 0;
      else if (normalizedKey === 'sugar') amount = nutrition.sugar || 0;
      else if (normalizedKey === 'fiber') amount = nutrition.fiber || 0;
      else if (normalizedKey === 'vitaminA') amount = nutrition.vitamin_a || nutrition.vitaminA || 0;
      else if (normalizedKey === 'vitaminC') amount = nutrition.vitamin_c || nutrition.vitaminC || 0;
      else if (normalizedKey === 'vitaminD') amount = nutrition.vitamin_d || nutrition.vitaminD || 0;
      else if (normalizedKey === 'vitaminE') amount = nutrition.vitamin_e || nutrition.vitaminE || 0;
      else if (normalizedKey === 'vitaminK') amount = nutrition.vitamin_k || nutrition.vitaminK || 0;
      else if (normalizedKey === 'vitaminB1' || normalizedKey === 'thiamin') amount = nutrition.vitamin_b1 || nutrition.vitaminB1 || nutrition.thiamin || 0;
      else if (normalizedKey === 'vitaminB2' || normalizedKey === 'riboflavin') amount = nutrition.vitamin_b2 || nutrition.vitaminB2 || nutrition.riboflavin || 0;
      else if (normalizedKey === 'vitaminB3' || normalizedKey === 'niacin') amount = nutrition.vitamin_b3 || nutrition.vitaminB3 || nutrition.niacin || 0;
      else if (normalizedKey === 'vitaminB6') amount = nutrition.vitamin_b6 || nutrition.vitaminB6 || 0;
      else if (normalizedKey === 'vitaminB9' || normalizedKey === 'folate') amount = nutrition.vitamin_b9 || nutrition.vitaminB9 || nutrition.folate || 0;
      else if (normalizedKey === 'vitaminB12') amount = nutrition.vitamin_b12 || nutrition.vitaminB12 || 0;
      else if (normalizedKey === 'calcium') amount = nutrition.calcium || 0;
      else if (normalizedKey === 'iron') amount = nutrition.iron || 0;
      else if (normalizedKey === 'magnesium') amount = nutrition.magnesium || 0;
      else if (normalizedKey === 'potassium') amount = nutrition.potassium || 0;
      else if (normalizedKey === 'zinc') amount = nutrition.zinc || 0;
      else if (normalizedKey === 'phosphorus') amount = nutrition.phosphorus || 0;

      // Carousel modal shows amount.toFixed(0) — hide rows that would display as 0.
      if (amount > 0 && Math.round(amount) !== 0) {
        mealFoods.push({ foodName: food.name || 'Unknown food', amount });
        mealFoodTotal += amount;
      }
    });

    if (mealFoods.length > 0) {
      mealFoods.forEach((f) => foods.push(f));
      total += mealFoodTotal;
    } else if (dbColKey) {
      const mealTotal = Number(analysis[dbColKey]) || 0;
      if (mealTotal > 0 && Math.round(mealTotal) !== 0) {
        const mealName = (() => {
          const fl = data.foods || [];
          if (fl.length === 1) return fl[0].name || 'Meal';
          if (fl.length > 1) return `${fl[0].name || 'Meal'} (+${fl.length - 1} more)`;
          return data.total?.category || 'Meal';
        })();
        foods.push({ foodName: mealName, amount: mealTotal });
        total += mealTotal;
      }
    }
  });

  const breakdown = foods
    .map((f) => ({
      ...f,
      percentage: total > 0 ? (f.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { breakdown, total };
}

export function getNutrientDisplayName(nutrient) {
  const key = nutrient?.startsWith('total') ? nutrient.slice(5) : nutrient;

  const names = {
    protein: 'Protein', fat: 'Fat', carbs: 'Carbs', calories: 'Calories',
    sodium: 'Sodium', cholesterol: 'Cholesterol', sugar: 'Sugar', fiber: 'Fiber',
    VitaminA: 'Vitamin A', VitaminC: 'Vitamin C', VitaminD: 'Vitamin D',
    VitaminE: 'Vitamin E', VitaminK: 'Vitamin K',
    VitaminB1: 'Vitamin B1', VitaminB2: 'Vitamin B2', VitaminB3: 'Vitamin B3',
    VitaminB6: 'Vitamin B6', VitaminB9: 'Vitamin B9', VitaminB12: 'Vitamin B12',
    Calcium: 'Calcium', Iron: 'Iron', Magnesium: 'Magnesium',
    Potassium: 'Potassium', Zinc: 'Zinc', Phosphorus: 'Phosphorus',
  };
  return names[key] || '';
}

export function getNutrientUnit(nutrient) {
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient;

  if (['protein', 'fat', 'carbs', 'sugar', 'fiber'].includes(key)) return 'g';
  if (['sodium', 'cholesterol', 'calcium', 'magnesium', 'potassium', 'phosphorus', 'vitaminc', 'vitaminb1', 'vitaminb2', 'vitaminb3', 'vitaminb6', 'iron'].includes(key)) return 'mg';
  if (['vitamina', 'vitamind', 'vitamine', 'vitamink', 'vitaminb9', 'vitaminb12', 'zinc'].includes(key)) return 'µg';
  if (key === 'calories') return 'kcal';
  return '';
}

export function getNutrientTotal(nutrient, dailyStats, calCard, heartCard, lowCarbCard) {
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient?.toLowerCase();

  if (key === 'protein') return dailyStats?.totalProtein || 0;
  if (key === 'fat') return dailyStats?.totalFat || 0;
  if (key === 'carbs') return dailyStats?.totalCarbs || 0;
  if (key === 'calories') return calCard?.consumed || 0;
  if (key === 'sodium') return heartCard?.sodium?.consumed || 0;
  if (key === 'cholesterol') return heartCard?.cholesterol?.consumed || 0;
  if (key === 'sugar') return lowCarbCard?.sugar?.consumed || 0;
  if (key === 'fiber') return lowCarbCard?.fiber?.consumed || 0;
  if (key === 'vitamina') return dailyStats?.totalVitaminA || 0;
  if (key === 'vitaminc') return dailyStats?.totalVitaminC || 0;
  if (key === 'vitamind') return dailyStats?.totalVitaminD || 0;
  if (key === 'vitamine') return dailyStats?.totalVitaminE || 0;
  if (key === 'vitamink') return dailyStats?.totalVitaminK || 0;
  if (key === 'vitaminb1') return dailyStats?.totalVitaminB1 || 0;
  if (key === 'vitaminb2') return dailyStats?.totalVitaminB2 || 0;
  if (key === 'vitaminb3') return dailyStats?.totalVitaminB3 || 0;
  if (key === 'vitaminb6') return dailyStats?.totalVitaminB6 || 0;
  if (key === 'vitaminb9') return dailyStats?.totalVitaminB9 || 0;
  if (key === 'vitaminb12') return dailyStats?.totalVitaminB12 || 0;
  if (key === 'calcium') return dailyStats?.totalCalcium || 0;
  if (key === 'iron') return dailyStats?.totalIron || 0;
  if (key === 'magnesium') return dailyStats?.totalMagnesium || 0;
  if (key === 'potassium') return dailyStats?.totalPotassium || 0;
  if (key === 'zinc') return dailyStats?.totalZinc || 0;
  if (key === 'phosphorus') return dailyStats?.totalPhosphorus || 0;
  return 0;
}

export function getNutrientTarget(nutrient, proteinTarget, fatTarget, carbsTarget, calorieTarget, heartCard, lowCarbCard) {
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient?.toLowerCase();

  if (key === 'protein') return proteinTarget || 0;
  if (key === 'fat') return fatTarget || 0;
  if (key === 'carbs') return carbsTarget || 0;
  if (key === 'calories') return calorieTarget || 0;
  if (key === 'sodium') return heartCard?.sodium?.target || 2300;
  if (key === 'cholesterol') return heartCard?.cholesterol?.target || 300;
  if (key === 'sugar') return lowCarbCard?.sugar?.target || 50;
  if (key === 'fiber') return lowCarbCard?.fiber?.target || 25;
  if (key === 'vitamina') return 900;
  if (key === 'vitaminc') return 90;
  if (key === 'vitamind') return 20;
  if (key === 'vitamine') return 15;
  if (key === 'vitamink') return 120;
  if (key === 'vitaminb1') return 1.2;
  if (key === 'vitaminb2') return 1.3;
  if (key === 'vitaminb3') return 16;
  if (key === 'vitaminb6') return 1.7;
  if (key === 'vitaminb9') return 400;
  if (key === 'vitaminb12') return 2.4;
  if (key === 'calcium') return 1000;
  if (key === 'iron') return 18;
  if (key === 'magnesium') return 420;
  if (key === 'potassium') return 3500;
  if (key === 'zinc') return 11;
  if (key === 'phosphorus') return 700;
  return 0;
}
