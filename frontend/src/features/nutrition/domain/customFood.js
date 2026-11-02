/**
 * Helpers for Manual Log custom food (name + g|ml quantity + serving count, no macros).
 */

/**
 * Case-insensitive trimmed food name key for exact-match checks.
 * @param {unknown} value
 * @returns {string}
 */
export function foodNameKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * True when any result has the same name as the typed query (exact, ignoring case).
 * Partial library hits (e.g. "dates" for query "dates shake") do not count.
 * @param {unknown} query
 * @param {Array<{ name?: unknown }|null|undefined>} [items]
 * @returns {boolean}
 */
export function hasExactFoodNameMatch(query, items = []) {
  const key = foodNameKey(query);
  if (!key) return false;
  return (Array.isArray(items) ? items : []).some(
    (item) => foodNameKey(item?.name) === key,
  );
}

/**
 * Offer Add "query" when the user typed a name that is not already an exact hit.
 * Partial search results must not hide the custom-add row.
 * @param {{ query: unknown, results?: unknown[], isSearching?: boolean }} opts
 * @returns {boolean}
 */
export function shouldOfferCustomFoodAdd({ query, results = [], isSearching = false } = {}) {
  if (isSearching) return false;
  const key = foodNameKey(query);
  if (!key) return false;
  return !hasExactFoodNameMatch(key, results);
}

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
  // API already scales master nutrition to this quantity (e.g. 100ml → 250ml).
  const fromApi = (apiItem?.nutrition && typeof apiItem.nutrition === 'object')
    ? apiItem.nutrition
    : {};
  const nutrition = {
    calories: Number(fromApi.calories ?? apiItem?.calories) || 0,
    protein: Number(fromApi.protein ?? apiItem?.protein) || 0,
    carbs: Number(fromApi.carbs ?? apiItem?.carbs) || 0,
    fat: Number(fromApi.fat ?? apiItem?.fat) || 0,
    fiber: Number(fromApi.fiber ?? apiItem?.fiber) || 0,
    ...fromApi,
  };
  nutrition.calories = Number(nutrition.calories) || 0;

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
