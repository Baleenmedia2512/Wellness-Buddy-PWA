/**
 * Helpers for Manual Log custom food (name + g|ml quantity + serving count, no macros).
 */

/**
 * @param {object} input
 * @param {unknown} input.name
 * @param {unknown} input.unit
 * @param {unknown} [input.quantity] — amount in g or ml for one serving
 * @param {unknown} [input.servingSize] — servings count (new) OR legacy g/ml amount when quantity omitted
 * @returns {{ ok: true, name: string, unit: 'g'|'ml', quantity: number, servingSize: number } | { ok: false, error: string }}
 */
export function validateCustomFoodForm({ name, unit, quantity, servingSize }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Food name is required' };
  }
  const u = String(unit ?? '').toLowerCase().trim();
  if (u !== 'g' && u !== 'ml') {
    return { ok: false, error: 'Choose g or ml' };
  }

  const hasQuantity = quantity != null && quantity !== '';
  const qty = Number(hasQuantity ? quantity : servingSize);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Quantity must be a positive number' };
  }

  const servings = hasQuantity ? Number(servingSize) : 1;
  if (!Number.isFinite(servings) || servings <= 0) {
    return { ok: false, error: 'Serving size must be a positive number' };
  }

  return {
    ok: true,
    name: trimmed,
    unit: u,
    quantity: qty,
    servingSize: servings,
  };
}

/**
 * Build a meal-tray item from API custom-food response + form values.
 * @param {object} apiItem
 * @param {{ name: string, unit: 'g'|'ml', quantity: number, servingSize?: number }} form
 */
export function buildCustomMealItem(apiItem, form) {
  const name = String(form.name || apiItem?.name || '').trim();
  const unit = form.unit === 'ml' ? 'ml' : 'g';
  const quantity = Number(form.quantity) > 0 ? Number(form.quantity) : 100;
  const servings = Number(form.servingSize) > 0 ? Number(form.servingSize) : 1;
  const amount = Math.round(quantity * 100) / 100;
  const portion = `${Number.isInteger(amount) ? amount : amount} ${unit}`;
  const isLiquid = unit === 'ml';
  const nutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    ...(apiItem?.nutrition && typeof apiItem.nutrition === 'object' ? apiItem.nutrition : {}),
  };
  if (nutrition.calories == null) nutrition.calories = 0;

  return {
    name,
    category: isLiquid ? 'Beverage' : 'Food',
    isLiquid,
    is_liquid: isLiquid,
    unit,
    source: 'master',
    customFood: true,
    profileId: apiItem?.profileId ?? apiItem?.id ?? null,
    weight_g: amount,
    volume_ml: isLiquid ? amount : null,
    portion,
    servings,
    calories: nutrition.calories || 0,
    protein: nutrition.protein || 0,
    carbs: nutrition.carbs || 0,
    fat: nutrition.fat || 0,
    fiber: nutrition.fiber || 0,
    nutrition,
  };
}
