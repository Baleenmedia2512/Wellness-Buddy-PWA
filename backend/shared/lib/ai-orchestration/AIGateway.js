/**
 * backend/shared/lib/ai-orchestration/AIGateway.js
 * ---------------------------------------------------------------------------
 * Model-agnostic AI abstraction layer.
 *
 * Every AI call enters the system through this file. Business logic and the
 * orchestrator NEVER import geminiClient directly — they call gateway methods.
 * Swapping the underlying model (Gemini → Claude, GPT-4o, etc.) is a one-file
 * change here with zero business-logic impact.
 *
 * Public methods:
 *   analyzeUnified(buf, mime, opts)         Single multimodal call → classify + fast nutrition
 *   classifyImage(buf, mime, opts)          Classify-only shim (backwards-compat)
 *   analyzeNutrition(buf, mime, opts)       Full 26-field nutrition (fast + enrichment)
 *   enrichNutrition(buf, mime, ctx, opts)   Micronutrient enrichment only (background)
 *   detectWeight(buf, mime, opts)           Weight-scale reading shim
 *   detectMeeting(buf, mime, opts)          Education/meeting shim
 *
 * Token efficiency:
 *   - Single unified inference replaces two sequential Gemini calls for food images.
 *   - FAST path (5 macros) is returned synchronously; micronutrients run as a
 *     background enrichment job with a context-aware prompt that avoids
 *     re-analysing macros.
 *   - All model instances are cached singletons (geminiClient).
 *   - Schemas are module-level constants (not rebuilt per request).
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import {
  generateContent,
  imageInlinePart,
  SchemaType,
  FALLBACK_MODEL_NAME,
} from '../gemini/geminiClient.js';
import { safeParseJson, validateShape } from '../gemini/safeJson.js';
import { withEnterpriseRetry } from './RetryPolicy.js';

const SERVICE = 'gemini';

// ── Schema fragments (module-level constants) ─────────────────────────────────

/** Fast macros: returned inline on every food analysis. */
const FAST_NUTRITION_PROPS = {
  calories:    { type: SchemaType.NUMBER },
  protein:     { type: SchemaType.NUMBER },
  carbs:       { type: SchemaType.NUMBER },
  fat:         { type: SchemaType.NUMBER },
  fiber:       { type: SchemaType.NUMBER },
  // Include these in fast path so carousel cards are populated without waiting for enrichment
  sugar:       { type: SchemaType.NUMBER },
  sodium:      { type: SchemaType.NUMBER },
  cholesterol: { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
};

/** Enrichment micros: vitamins + minerals returned by background job. */
const ENRICHMENT_PROPS = {
  sugar:          { type: SchemaType.NUMBER },
  sodium:         { type: SchemaType.NUMBER },
  cholesterol:    { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
  vitamin_a:      { type: SchemaType.NUMBER },
  vitamin_c:      { type: SchemaType.NUMBER },
  vitamin_d:      { type: SchemaType.NUMBER },
  vitamin_e:      { type: SchemaType.NUMBER },
  vitamin_k:      { type: SchemaType.NUMBER },
  vitamin_b1:     { type: SchemaType.NUMBER },
  vitamin_b2:     { type: SchemaType.NUMBER },
  vitamin_b3:     { type: SchemaType.NUMBER },
  vitamin_b6:     { type: SchemaType.NUMBER },
  vitamin_b9:     { type: SchemaType.NUMBER },
  vitamin_b12:    { type: SchemaType.NUMBER },
  calcium:        { type: SchemaType.NUMBER },
  iron:           { type: SchemaType.NUMBER },
  magnesium:      { type: SchemaType.NUMBER },
  potassium:      { type: SchemaType.NUMBER },
  zinc:           { type: SchemaType.NUMBER },
  phosphorus:     { type: SchemaType.NUMBER },
};

/** Full nutrition: all 26 fields returned per-food item in the unified call. */
const FULL_NUTRITION_PROPS = { ...FAST_NUTRITION_PROPS, ...ENRICHMENT_PROPS };

// ── Structured response schemas (module-level singletons) ─────────────────────

/**
 * Unified single-call schema.
 * Classifies the image AND captures type-appropriate fast data in one inference.
 * NOTE: Gemini structured-output does NOT support `additionalProperties` — never add it.
 */
const UNIFIED_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    imageType:  { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
    // `details` fully specified so Gemini populates the correct sub-fields
    // per imageType without needing additionalProperties.
    details: {
      type: SchemaType.OBJECT,
      properties: {
        // ── FOOD ───────────────────────────────────────────────────
        foods: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name:      { type: SchemaType.STRING },
              portion:   { type: SchemaType.STRING },
              weight_g:  { type: SchemaType.NUMBER },
              volume_ml: { type: SchemaType.NUMBER },  // required for drinks/liquids
              isLiquid:  { type: SchemaType.BOOLEAN }, // true for water, tea, shakes, etc.
              nutrition: {
                type: SchemaType.OBJECT,
                properties: FULL_NUTRITION_PROPS,
                // Require macros + sugar/sodium/cholesterol/GI so carousel cards
                // are always populated from the initial call (no enrichment needed).
                required: ['calories', 'protein', 'carbs', 'fat', 'fiber',
                           'sugar', 'sodium', 'cholesterol', 'glycemic_index'],
              },
            },
            // Minimum required per item so food lists are never empty/nutrition-less
            required: ['name', 'nutrition'],
          },
        },
        total: {
          type: SchemaType.OBJECT,
          properties: FULL_NUTRITION_PROPS,
        },
        // ── WEIGHT ─────────────────────────────────────────────
        weightValue: { type: SchemaType.NUMBER },
        unit:        { type: SchemaType.STRING },
        bmi:         { type: SchemaType.NUMBER },
        bodyFat:     { type: SchemaType.NUMBER },
        muscleMass:  { type: SchemaType.NUMBER },
        bmr:         { type: SchemaType.NUMBER },
        // ── SMARTWATCH ────────────────────────────────────────
        caloriesBurned: { type: SchemaType.NUMBER },
        steps:          { type: SchemaType.NUMBER },
        source:         { type: SchemaType.STRING },
        // ── EDUCATION ────────────────────────────────────────
        platform:         { type: SchemaType.STRING },
        participantCount: { type: SchemaType.NUMBER },
      },
    },
    fastNutrition: {
      type:       SchemaType.OBJECT,
      properties: FAST_NUTRITION_PROPS,
      required:   ['calories', 'protein', 'carbs', 'fat', 'fiber',
                   'sugar', 'sodium', 'cholesterol', 'glycemic_index'],
    },
    weightReading: {
      type: SchemaType.OBJECT,
      properties: {
        value: { type: SchemaType.NUMBER },
        unit:  { type: SchemaType.STRING },
      },
    },
    smartwatchData: {
      type: SchemaType.OBJECT,
      properties: {
        caloriesBurned: { type: SchemaType.NUMBER },
        steps:          { type: SchemaType.NUMBER },
        source:         { type: SchemaType.STRING },
      },
    },
    educationData: {
      type: SchemaType.OBJECT,
      properties: {
        isMeeting: { type: SchemaType.BOOLEAN },
        platform:  { type: SchemaType.STRING },
      },
    },
  },
  required: ['imageType', 'confidence'],
};

/**
 * Enrichment-only schema.
 * Micronutrients only — macros are NOT re-analysed, saving ~60 % of output tokens.
 */
const ENRICHMENT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    enrichment: {
      type:       SchemaType.OBJECT,
      properties: ENRICHMENT_PROPS,
      required:   Object.keys(ENRICHMENT_PROPS),
    },
    confidence: { type: SchemaType.STRING },
  },
  required: ['enrichment', 'confidence'],
};

// ── Herbalife prepared shake (fixed business profile) ─────────────────────────

/** Canonical name for a prepared Herbalife meal-replacement shake. */
const HERBALIFE_SHAKE_NAME = 'Herbalife Shake';

/**
 * Fixed nutrition for the standard Wellness Valley prepared shake recipe.
 * Single source of truth — reused by prompts and deterministic backend overrides.
 */
const HERBALIFE_SHAKE_NUTRITION = Object.freeze({
  name:      HERBALIFE_SHAKE_NAME,
  portion:   '1 serving',
  weight_g:  58,
  volume_ml: 300,
  unit:      'ml',
  isLiquid:  true,
  nutrition: Object.freeze({
    calories:       223,
    protein:        24.73,
    carbs:          24.24,
    fat:            2.98,
    fiber:          3.00,
    sugar:          11.57,
    sodium:         355,
    cholesterol:    7,
    glycemic_index: 20,
    vitamin_a:      210,
    vitamin_c:      15,
    vitamin_d:      3.40,
    vitamin_e:      5,
    vitamin_k:      0,
    vitamin_b1:     0.45,
    vitamin_b2:     0.45,
    vitamin_b3:     5,
    vitamin_b6:     0.80,
    vitamin_b9:     85,
    vitamin_b12:    0.40,
    calcium:        129,
    iron:           3,
    magnesium:      50,
    potassium:      260,
    zinc:           2.5,
    phosphorus:     0,
  }),
});

function cloneHerbalifeShakeNutrition() {
  return { ...HERBALIFE_SHAKE_NUTRITION.nutrition };
}

function extractHerbalifeShakeFastNutrition() {
  const nutrition = HERBALIFE_SHAKE_NUTRITION.nutrition;
  return Object.fromEntries(FAST_NUTRITION_KEYS.map((key) => [key, nutrition[key]]));
}

function extractHerbalifeShakeEnrichment() {
  const nutrition = HERBALIFE_SHAKE_NUTRITION.nutrition;
  return Object.fromEntries(
    Object.keys(ENRICHMENT_PROPS).map((key) => [key, nutrition[key] ?? 0]),
  );
}

const FAST_NUTRITION_KEYS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol', 'glycemic_index',
]);

const ALL_NUTRITION_KEYS = Object.freeze(Object.keys(HERBALIFE_SHAKE_NUTRITION.nutrition));

function normalizeFoodName(name) {
  return String(name ?? '').trim().toLowerCase();
}

/** Formula 1 powder/container product — NOT a prepared drink; never apply shake override. */
function isFormula1ProductContainer(name) {
  const n = normalizeFoodName(name);
  if (!n.includes('formula 1') && !n.includes('formula1')) return false;
  return (
    n.includes('nutritional shake mix')
    || n.includes('shake mix')
    || /\bpowder\b/.test(n)
    || (n.includes('mix') && !n.includes('protein drink mix'))
  );
}

/**
 * True when AI labelled a prepared Herbalife meal-replacement shake (including legacy names).
 * @param {string} name
 */
function isPreparedHerbalifeShakeName(name) {
  const n = normalizeFoodName(name);
  if (!n) return false;
  if (isFormula1ProductContainer(n)) return false;
  if (n === 'herbalife shake') return true;
  if (n.includes('wellness valley shake')) return true;
  if (n.includes('formula 1') && n.includes('shake')) return true;
  if (n.includes('herbalife') && n.includes('shake')) return true;
  return false;
}

function buildHerbalifeShakeFoodItem(existing = {}) {
  const nutrition = cloneHerbalifeShakeNutrition();
  const {
    nutrition: _nutrition,
    calories: _calories,
    protein: _protein,
    carbs: _carbs,
    fat: _fat,
    fiber: _fiber,
    sugar: _sugar,
    sodium: _sodium,
    cholesterol: _cholesterol,
    glycemic_index: _glycemicIndex,
    vitamin_a: _vitaminA,
    vitamin_c: _vitaminC,
    vitamin_d: _vitaminD,
    vitamin_e: _vitaminE,
    vitamin_k: _vitaminK,
    vitamin_b1: _vitaminB1,
    vitamin_b2: _vitaminB2,
    vitamin_b3: _vitaminB3,
    vitamin_b6: _vitaminB6,
    vitamin_b9: _vitaminB9,
    vitamin_b12: _vitaminB12,
    calcium: _calcium,
    iron: _iron,
    magnesium: _magnesium,
    potassium: _potassium,
    zinc: _zinc,
    phosphorus: _phosphorus,
    name: _name,
    portion: _portion,
    weight_g: _weightG,
    volume_ml: _volumeMl,
    unit: _unit,
    isLiquid: _isLiquid,
    ...rest
  } = existing;

  return {
    ...rest,
    name:      HERBALIFE_SHAKE_NUTRITION.name,
    portion:   HERBALIFE_SHAKE_NUTRITION.portion,
    weight_g:  HERBALIFE_SHAKE_NUTRITION.weight_g,
    volume_ml: HERBALIFE_SHAKE_NUTRITION.volume_ml,
    unit:      HERBALIFE_SHAKE_NUTRITION.unit,
    isLiquid:  HERBALIFE_SHAKE_NUTRITION.isLiquid,
    nutrition,
  };
}

function sumNutritionFields(foods) {
  const shakeFoods = foods.filter((food) => isPreparedHerbalifeShakeName(food?.name));
  const otherFoods = foods.filter((food) => !isPreparedHerbalifeShakeName(food?.name));

  if (shakeFoods.length > 0 && otherFoods.length === 0) {
    return cloneHerbalifeShakeNutrition();
  }

  let total = shakeFoods.length > 0
    ? cloneHerbalifeShakeNutrition()
    : Object.fromEntries(ALL_NUTRITION_KEYS.map((key) => [key, 0]));

  for (const food of otherFoods) {
    const nutrition = food?.nutrition ?? {};
    for (const key of ALL_NUTRITION_KEYS) {
      const val = nutrition[key];
      if (val != null && val !== '') total[key] += +val;
    }
  }

  return total;
}

function extractFastNutrition(total, foods = []) {
  if (Array.isArray(foods) && foods.length === 1 && isPreparedHerbalifeShakeName(foods[0]?.name)) {
    return extractHerbalifeShakeFastNutrition();
  }

  return Object.fromEntries(
    FAST_NUTRITION_KEYS.map((key) => [key, total?.[key] ?? 0]),
  );
}

function extractEnrichmentNutrition(nutrition) {
  if (nutrition === HERBALIFE_SHAKE_NUTRITION.nutrition) {
    return extractHerbalifeShakeEnrichment();
  }

  return Object.fromEntries(
    Object.keys(ENRICHMENT_PROPS).map((key) => [key, nutrition?.[key] ?? 0]),
  );
}

function sumEnrichmentFields(left, right) {
  const result = {};
  for (const key of Object.keys(ENRICHMENT_PROPS)) {
    result[key] = (left?.[key] ?? 0) + (right?.[key] ?? 0);
  }
  return result;
}

/**
 * Apply fixed Herbalife Shake nutrition to detected prepared shakes and recompute totals.
 * @param {object|null|undefined} details
 * @returns {object}
 */
function applyHerbalifeShakeOverrides(details) {
  if (!details || !Array.isArray(details.foods) || details.foods.length === 0) {
    return details ?? {};
  }

  let shakeFound = false;
  const foods = details.foods.map((food) => {
    if (!isPreparedHerbalifeShakeName(food?.name)) return food;
    shakeFound = true;
    return buildHerbalifeShakeFoodItem(food);
  });

  if (!shakeFound) return details;

  return { ...details, foods, total: sumNutritionFields(foods) };
}

function formatHerbalifeShakeEnrichmentReference() {
  const micros = extractEnrichmentNutrition(HERBALIFE_SHAKE_NUTRITION.nutrition);
  return Object.entries(micros)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

const HERBALIFE_SHAKE_DETECTION_PROMPT = `Herbalife Shake — STANDARD PREPARED MEAL-REPLACEMENT DRINK (detection only):

Members prepare the same fixed recipe (58 g total powder + water → ~300 ml; water = 0 calories):
  • Formula 1 Nutritional Shake Mix — 3 scoops — 25 g
  • ShakeMate — 2 scoops — 27 g
  • Protein Drink Mix (PDM) — 1 scoop — 6 g

Classify as "${HERBALIFE_SHAKE_NAME}" when the drink is thick, creamy, opaque, smoothie or milkshake consistency,
inside a shaker, glass, or cup and appears to be a Herbalife meal-replacement drink.

NEVER name a prepared drink "Herbalife Formula 1 Shake" or "Herbalife Wellness Valley Shake".
Use "Herbalife Formula 1" / "Herbalife Formula 1 Nutritional Shake Mix" ONLY for the powder product container itself.
Transparent drinks remain "Herbalife Afresh Energy Drink".

Do NOT estimate powder weight, scoop count, or shake nutrition — set all "${HERBALIFE_SHAKE_NAME}" nutrition fields to 0;
the server applies the fixed profile after detection.

Additional visible ingredients (banana, apple, milk, oats, berries, almonds, peanut butter, etc.):
  list each as a SEPARATE food item with independently estimated nutrition.
  Do NOT modify "${HERBALIFE_SHAKE_NAME}" nutrition — extras are summed into details.total only.`;

const UNIFIED_PROMPT = `Analyze this image in one pass. Return exactly one JSON object matching the schema.

=== PRIORITY CONTEXT ===
This app serves a Tamil Nadu, India wellness community using Herbalife products.
PRIORITY RECOGNITION ORDER (highest → lowest):
  1. Herbalife product (shake, supplement, beverage packet)
  2. Tamil Nadu / South Indian / Indian food
  3. Other Asian food
  4. Western / international food
When the food is ambiguous or unclear, ALWAYS assume Tamil Nadu food before any Western food.
If you see something that could be either dosa batter or pancake batter → call it dosa batter.
If it could be rice or pasta → call it rice.
Never default to a Western food name when an Indian equivalent is plausible.

=== imageType ===

"food" — DEFAULT. Any edible item, drink, supplement, raw ingredient, or packaged food.
  Includes: meals, snacks, water, tea, coffee, juices, shakes, protein powders, pills, sauces.
  BIAS: If there is ANY reasonable chance this is food, return "food". When in doubt → "food".

"weight" — Weighing scale with a VISIBLE numeric reading (kg or lbs). No digits visible → "other".

"smartwatch" — Device or phone screen showing activity data: steps, calories, heart rate, distance.
  Devices: Apple Watch, Garmin, Fitbit, Samsung Galaxy Watch, Mi Band, Google Fit, Samsung Health.
  Activity data on any screen → "smartwatch", never "education".

"education" — Video-call screenshot with ALL THREE present:
  (1) participant video tiles  (2) meeting toolbar  (3) Google Meet / Zoom / Teams UI.
  Any element missing → NOT education.

"other" — Only when clearly none of the above. When in doubt → use "food".

=== confidence ===
Score 0.0–1.0. Reports certainty only — never changes imageType.
A blurry food photo = "food" at 0.55, not "other".

=== Herbalife products (HIGHEST PRIORITY — recognise on sight) ===
These are the most common items in this app. When in doubt, check Herbalife first.

=== Herbalife Drink Recognition (Highest Priority) ===

Always classify Herbalife drinks using TEXTURE first, then transparency, then consistency, then colour.
Texture has higher priority than colour.

Classification priority:
1. Texture
2. Transparency
3. Consistency
4. Colour

Herbalife Afresh Energy Drink (hydration / refresh energy — NOT a meal):
- Transparent or semi-transparent.
- Thin, watery consistency like tea or coloured water.
- Never creamy or thick.
- Brown, amber, green or yellow colours are acceptable.
- Examples: transparent brown drink → Herbalife Afresh Energy Drink; semi-transparent tea → Herbalife Afresh Energy Drink.
- Always classify as "Herbalife Afresh Energy Drink".
- Per cup (~200 ml): 15 kcal, 0 g protein, 4 g carbs, 0 g fat, 0 g fiber. sodium 20 mg.

Herbalife Shake (standard meal-replacement — prepared drink in cup/glass/bottle/shaker):
- Users upload photos of PREPARED shakes, not dry powder.
- Thick, creamy, smooth, velvety; opaque; milkshake or smoothie consistency.
- Chocolate, vanilla, coffee or strawberry colours are acceptable.
- Examples: thick chocolate shake in shaker → Herbalife Shake; creamy vanilla drink in glass → Herbalife Shake.
- Always name prepared thick shakes "${HERBALIFE_SHAKE_NAME}" — never "Herbalife Formula 1 Shake".
- Do NOT estimate powder weight, scoop count, or shake nutrition (use 0; server applies fixed profile).

${HERBALIFE_SHAKE_DETECTION_PROMPT}

Other Herbalife products:
- "Herbalife Formula 1 Nutritional Shake Mix" / "Herbalife Formula 1" — ONLY when the Formula 1 powder container is visible (not a prepared drink).
- "Herbalife Protein Drink Mix (PDM)" — powder/scoop container only (identify only; do not estimate nutrition when shown separately).
- "Herbalife High Protein Iced Coffee" — coffee-flavoured meal drink (identify only; do not estimate nutrition).
- "Herbalife Herbal Tea Concentrate" — small sachet, dark concentrate bottle.
    Per cup (~200 ml): 8 kcal, 0 g protein, 2 g carbs, 0 g fat. Antioxidant beverage.

Supplements (isLiquid: false, near-zero calories — estimate 5–10 kcal per tablet/capsule):
- "Herbalife Formula 2 Multivitamin" — oval bottle, yellow/white label.
- "Herbalife Formula 3 Cell Activator" — oval bottle, orange label.
- "Herbalife NightWorks / Niteworks" — heart-health supplement.
- "Herbalife Xtra-Cal" — calcium supplement.
- "Herbalife Prolessa Duo" — weight management.
- Any labelled Herbalife supplement bottle/packet: name it exactly as printed.

=== Tamil Nadu / South Indian foods (SECOND PRIORITY) ===
Use these EXACT names. If unsure, pick the closest Tamil Nadu food — never default to a Western name.
Estimate nutrition using USDA FoodData Central / IFCT (Indian Food Composition Tables) values.

Breakfast (~portion): Idli (~45 g/piece), Dosa (~90 g), Masala Dosa (~180 g), Rava Dosa (~90 g),
  Uthappam (~120 g), Pongal/Ven Pongal (~200 g/cup), Appam (~80 g), Puttu (~120 g),
  Idiyappam (~100 g), Poha/Aval (~180 g/cup), Upma (~200 g/cup).

Rice (~200 g/cup cooked): Plain White Rice, Curd Rice, Lemon Rice, Puliyodarai/Tamarind Rice,
  Tomato Rice, Coconut Rice, Sambar Rice (sadam), Chicken Biryani (~350 g/plate),
  Mutton Biryani (~350 g/plate), Seeraga Samba Biryani (~350 g/plate), Vegetable Biryani (~300 g/plate).

Breads: Parotta (~90 g), Kothu Parotta (~250 g), Chapati/Roti (~40 g), Phulka (~30 g).

Gravies (~200 ml/g cup): Sambar, Rasam, Kootu, Poriyal (~100 g), Avial (~150 g),
  Moru Kuzhambu, Vatha Kuzhambu (~150 ml), Chicken Chettinad, Mutton Kuzhambu,
  Meen Kuzhambu/Fish Curry, Egg Curry, Egg Bhurji, Paneer Butter Masala, Dal Tadka,
  Coconut Chutney (~30 g), Tomato Chutney (~30 g).

Snacks: Murukku (~30 g), Sundal (~100 g), Bonda (~60 g), Bajji (~50 g).

Beverages (isLiquid: true): Filter Coffee with milk (~150 ml), Masala Chai with milk (~150 ml),
  Plain Tea with milk (~150 ml), Ginger Tea with milk (~150 ml), Buttermilk/Moru (~200 ml),
  Tender Coconut Water (~240 ml), Sugarcane Juice (~240 ml).

Sweets: Sweet Pongal/Sakkarai Pongal (~150 g), Payasam (~150 ml), Mysore Pak (~50 g),
  Halwa (~80 g), Laddu (~50 g).

=== isLiquid ===
true  → all beverages (water, tea, coffee, juices, buttermilk, coconut water, Afresh, Herbal Tea Concentrate, Herbalife Shake)
false → solid foods and supplement tablets/capsules

=== FOOD output ===

fastNutrition — 9-field aggregate totals:
{ calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index }

details.foods — one object per visible edible item or beverage:
{
  name,       ← specific: "Idli" / "Herbalife Shake" / "Filter Coffee" — never generic "Food"/"Drink"/"Meal"
  portion,    ← realistic serving size string  e.g. "2 pieces" / "1 cup (200 ml)"
  weight_g,   ← solids (g)
  volume_ml,  ← liquids (ml); provide both when estimable
  isLiquid,
  nutrition: {
    calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index,
    vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k,
    vitamin_b1, vitamin_b2, vitamin_b3, vitamin_b6, vitamin_b9, vitamin_b12,
    calcium, iron, magnesium, potassium, zinc, phosphorus
  }
}

Nutrition rules:
- All 26 fields required per item. Absent/unknown → 0, never null. All values numeric.
- vitamin_a: µg RAE | vitamin_d/k: µg | vitamin_c, b-vitamins, minerals: mg.
- Plain water: all nutrients 0.
- Use USDA / IFCT values for Tamil Nadu foods and Herbalife Afresh / Herbal Tea (exact values above).
- "${HERBALIFE_SHAKE_NAME}": identify only — set all nutrition fields to 0; the server applies the fixed standard recipe profile.
- If extra fruits or add-ins are visible, list them as separate food items with independent nutrition; sum into details.total.
- For any other Indian food, estimate using USDA FoodData Central or equivalent.

details.total — same 26 flat fields, sum of all foods:
{ calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index,
  vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k,
  vitamin_b1, vitamin_b2, vitamin_b3, vitamin_b6, vitamin_b9, vitamin_b12,
  calcium, iron, magnesium, potassium, zinc, phosphorus }

Consistency rules:
- Detect EVERY visible edible item: main dish, sides, chutneys, sauces, condiments, beverages, water. Each = separate object in details.foods. Do NOT stop at the dominant dish.
- fastNutrition MUST equal details.total for all 9 shared fields.
- details.total MUST equal the sum of all details.foods items.

=== WEIGHT output ===
weightReading: { value: <kg; convert lbs>, unit: "kg" }
details: { weightValue, unit:"kg", bmi, bodyFat, muscleMass, bmr } — null if not on display

=== SMARTWATCH output ===
smartwatchData: { caloriesBurned, steps, source }  ← source = brand e.g. "Apple Watch"
details: { caloriesBurned, steps, source }

=== EDUCATION output ===
educationData: { isMeeting: true, platform }  ← "Google Meet" | "Zoom" | "Teams"
details: { platform, participantCount }

Omit or null fields not relevant to the detected imageType.
JSON only. No markdown. No explanation.`;

/**
 * Build an enrichment prompt with fast-nutrition context and food item names.
 * @param {{ calories, protein, carbs, fat } | null} fastCtx
 * @param {string[]} [foodItems]  Names of identified food items (e.g. ['Filter Coffee'])
 * @returns {string}
 */
function buildEnrichmentPrompt(fastCtx, foodItems) {
  const ctx = fastCtx
    ? `calories=${fastCtx.calories ?? '?'} kcal, protein=${fastCtx.protein ?? '?'} g, carbs=${fastCtx.carbs ?? '?'} g, fat=${fastCtx.fat ?? '?'} g`
    : 'macros unknown';
  const foodLabel = Array.isArray(foodItems) && foodItems.length > 0
    ? foodItems.join(', ')
    : 'the food item in the image';
  return `This food image was already analysed (${foodLabel}): ${ctx}.

Provide ONLY the 21 micronutrient enrichment values — do NOT re-estimate macros.
Return JSON matching the schema exactly (all enrichment fields required).
All values numeric; absent/unknown → 0, never null.
Units: vitamin_a µg RAE | vitamin_d/k µg | all others mg.

Use the reference values below when the identified food matches. Interpolate for mixed dishes.

=== Herbalife products ===
${HERBALIFE_SHAKE_NAME} (1 serving — fixed; server-side profile):
  ${formatHerbalifeShakeEnrichmentReference()}
  When "${HERBALIFE_SHAKE_NAME}" is the only identified item, return these exact micronutrient values.

Herbalife Afresh Energy Drink (1 cup):
  vitamin_c: 15, potassium: 30. All others: 0.
Herbalife Herbal Tea Concentrate (1 cup):
  vitamin_c: 5. All others: 0.
Herbalife Formula 2 Multivitamin (per daily dose):
  vitamin_a: 700, vitamin_c: 80, vitamin_d: 10, vitamin_e: 12, vitamin_k: 60,
  vitamin_b1: 1.1, vitamin_b2: 1.4, vitamin_b3: 16, vitamin_b6: 1.4, vitamin_b9: 200, vitamin_b12: 2.5,
  calcium: 150, iron: 8, magnesium: 55, potassium: 80, zinc: 7, phosphorus: 100.

For all Tamil Nadu foods use USDA / IFCT (Indian Food Composition Tables) values from your training data.
For any other food, use USDA FoodData Central.

JSON only. No markdown.`;
}

/**
 * Returns true when the primary model should be abandoned in favour of the
 * fallback model.  Triggers on:
 *   1. Circuit breaker opened after N consecutive failures — the primary is
 *      saturated; bypass immediately without waiting for more retries.
 *   2. All retries exhausted with 503 / service-unavailable errors.
 *   3. All retries exhausted with 429 / quota-exceeded / rate-limit errors.
 *      Google's API returns 429 with "Resource has been exhausted" when the
 *      per-model quota is hit; switching to the fallback model (a separate
 *      quota bucket) is the correct recovery action.
 */
function isPrimaryOverloadedError(err) {
  if (!err) return false;
  // Circuit opened for the primary → the primary service is considered down
  if (err.code === 'CIRCUIT_OPEN') return true;
  const status = Number(err.status);
  // 502 = bad gateway (upstream Gemini infrastructure failure)
  // 503 = service unavailable (overloaded)
  // 429 = quota exceeded / rate limited (separate quota on fallback model)
  if (status === 502 || status === 503 || status === 429) return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('503')                       ||
    msg.includes('service unavailable')       ||
    msg.includes('high demand')               ||
    msg.includes('429')                       ||
    msg.includes('quota')                     ||
    msg.includes('rate limit')                ||
    msg.includes('resource has been exhausted') ||
    msg.includes('too many requests')
  );
}

// ── Internal call helper ──────────────────────────────────────────────────────

/**
 * Call a Gemini model with enterprise retry + optional trace instrumentation.
 * On persistent 503 overload the call is automatically retried once on
 * FALLBACK_MODEL_NAME so callers remain resilient during peak load spikes.
 *
 * @param {'classify'|'nutrition'|'unified'} configKey
 * @param {Array}   parts        [imagePart, promptString]
 * @param {object}  schema       Structured response schema
 * @param {object}  opts
 * @param {string}  opts.label
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @param {string|null} [opts.modelOverride]  Internal: set by fallback path.
 * @returns {Promise<{ rawText: string, attempts: number, latencyMs: number }>}
 */
async function callModel(
  configKey,
  parts,
  schema,
  { label, trace = null, modelOverride = null },
) {
  // The fallback model uses its own independent circuit breaker so an opened
  // primary breaker does not also block the fallback.
  const circuitService = modelOverride
    ? `${SERVICE}-fallback`
    : SERVICE;

  let result, attempts, totalLatencyMs;

  try {
    ({ result, attempts, totalLatencyMs } = await withEnterpriseRetry(
      () =>
        generateContent(
          configKey,
          parts,
          schema,
          modelOverride,
          trace
        ),
      {
        label,
        service: circuitService,

        // Primary model (Flash): cap at 2 attempts.
        ...(modelOverride ? {} : { maxAttempts: 2 }),
      },
    ));
  } catch (err) {
    // Primary model saturated, circuit open, or quota exceeded → try fallback once
    if (!modelOverride && isPrimaryOverloadedError(err)) {
      const status = Number(err.status);

      const reason =
        err.code === 'CIRCUIT_OPEN'
          ? 'circuit_open'
          : status === 502
            ? '502_bad_gateway'
            : (
                status === 429 ||
                (err.message ?? '').toLowerCase().includes('quota') ||
                (err.message ?? '').toLowerCase().includes('rate limit') ||
                (err.message ?? '').toLowerCase().includes('too many requests')
              )
              ? '429_quota_exceeded'
              : '503_overload';

      logger.warn(
        'AIGateway.callModel: primary model unavailable, switching to fallback',
        {
          label,
          fallbackModel: FALLBACK_MODEL_NAME,
          reason,
          primaryError: err.message,
        },
      );

      return callModel(configKey, parts, schema, {
        label,
        trace,
        modelOverride: FALLBACK_MODEL_NAME,
      });
    }

    throw err;
  }

  // Propagate retries into trace
  if (trace && attempts > 1) {
    for (let i = 1; i < attempts; i += 1) {
      trace.addRetry();
    }
  }

  const rawText = result.response.text();

  // Accumulate token usage
  const usage = result.response?.usageMetadata;
  if (trace && usage) {
    trace.addTokenUsage({
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      model: configKey,
    });
  }

  const finishReason = result.response?.candidates?.[0]?.finishReason;

  if (finishReason === 'MAX_TOKENS') {
    const err = new Error(
      `MAX_TOKENS: Gemini truncated response after ${
        usage?.candidatesTokenCount ?? '?'
      } output tokens (thinking=${
        usage?.thoughtsTokenCount ?? '?'
      }). Increase maxOutputTokens in MODEL_CONFIGS.${configKey}.`,
    );

    err.code = 'MAX_TOKENS';
    err.status = 503;

    logger.error('AIGateway.callModel: MAX_TOKENS truncation', {
      label,
      configKey,
      candidatesTokenCount: usage?.candidatesTokenCount ?? null,
      thoughtsTokenCount: usage?.thoughtsTokenCount ?? null,
      promptTokenCount: usage?.promptTokenCount ?? null,
    });

    throw err;
  }

  return {
  rawText,
  attempts,
  latencyMs: totalLatencyMs,
  usage: {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    totalTokens:
      (usage?.promptTokenCount ?? 0) +
      (usage?.candidatesTokenCount ?? 0),
    thoughtsTokens: usage?.thoughtsTokenCount ?? 0,
  },
  model: modelOverride ?? MODEL_NAME,
};
}

// ── Type normalisation ────────────────────────────────────────────────────────

const TYPE_ALIAS = Object.freeze({ weight_scale: 'weight', meeting: 'education' });

function normaliseType(raw, confidence) {
  // Trust Gemini's self-reported imageType when confidence is reasonable.
  // The prompt already instructs Gemini to ALWAYS choose "food" over "other"
  // when there is ANY reasonable chance it is food. Only override as a last-
  // resort sanity check at 0.10 (practically zero confidence).
  if (!raw || confidence < 0.10) return 'other';
  return TYPE_ALIAS[raw] ?? raw;
}

// ── Public gateway methods ────────────────────────────────────────────────────

/**
 * Single multimodal inference: classify + fast nutrition in one Gemini call.
 *
 * Returns:
 *   { imageType, confidence, details,
 *     fastNutrition   (food only),
 *     weightReading   (weight only),
 *     smartwatchData  (smartwatch only),
 *     educationData   (education only),
 *     latencyMs, attempts }
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @returns {Promise<object>}
 */
export async function analyzeUnified(
  imageBuffer,
  mimeType,
  {
    trace = null,
    context = null,
    modelOverride = null,
  } = {},
) {
  const label = 'unified';
  const imagePart = imageInlinePart(imageBuffer, mimeType);
  const stageStart = Date.now();

  try {
    const { rawText, attempts, latencyMs,usage, model} = await callModel(
      'unified',
      [imagePart, UNIFIED_PROMPT],
      UNIFIED_SCHEMA,
      {
        label,
        trace,
        context,
        modelOverride,
      },
    );

    const parsed = safeParseJson(rawText, { label });

    if (!parsed.ok) {
      throw new Error(`AIGateway.analyzeUnified: parse error — ${parsed.error}`);
    }

    const shape = validateShape(
      parsed.data,
      ['imageType', 'confidence'],
      { label },
    );

    if (!shape.ok) {
      throw new Error(
        `AIGateway.analyzeUnified: schema missing ${shape.missing}`,
      );
    }

    const d = parsed.data;
    const normType = normaliseType(d.imageType, d.confidence);

    let details = d.details ?? {};
    let fastNutrition = null;

    if (normType === 'food') {
      details = applyHerbalifeShakeOverrides(details);

      const foods = Array.isArray(details.foods)
        ? details.foods
        : [];

      if (details.total) {
        fastNutrition = extractFastNutrition(details.total, foods);
      } else if (
        foods.length === 1 &&
        isPreparedHerbalifeShakeName(foods[0]?.name)
      ) {
        details.total = cloneHerbalifeShakeNutrition();
        fastNutrition = extractHerbalifeShakeFastNutrition();
      } else {
        fastNutrition = d.fastNutrition ?? null;
      }
    }

    if (trace) {
      trace.addStage({
        name: label,
        latencyMs,
        success: true,
        extra: {
          attempts,
          imageType: normType,
          requestId: context?.requestId,
        },
      });
    }

    logger.info('AI Unified Analysis Completed', {
      requestId: context?.requestId,
      userId: context?.userId,
      endpoint: context?.endpoint,
      operation: context?.operation,
      imageType: normType,
      model: modelOverride ?? MODEL_NAME,
      latencyMs,
      attempts,
    });

    return {
      imageType: normType,
      confidence: d.confidence,
      details,
      fastNutrition,
      weightReading:
        normType === 'weight'
          ? (d.weightReading ?? null)
          : null,
      smartwatchData:
        normType === 'smartwatch'
          ? (d.smartwatchData ?? null)
          : null,
      educationData:
        normType === 'education'
          ? (d.educationData ?? null)
          : null,
      latencyMs,
      attempts,
      usage,
      model,
    };
  } catch (err) {
    if (trace) {
      trace.addStage({
        name: label,
        latencyMs: Date.now() - stageStart,
        success: false,
        extra: {
          error: err.message,
          requestId: context?.requestId,
        },
      });

      trace.error({
        stage: label,
        message: err.message,
        code: err.code,
      });
    }

    logger.error('AI Unified Analysis Failed', {
      requestId: context?.requestId,
      userId: context?.userId,
      endpoint: context?.endpoint,
      operation: context?.operation,
      model: modelOverride ?? MODEL_NAME,
      error: err.message,
      code: err.code,
    });

    throw err;
  }
}

/**
 * Backwards-compatible classify-only call.
 * Internally calls analyzeUnified but returns only the classify fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function classifyImage(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    imageType:  result.imageType,
    confidence: result.confidence,
    details:    result.details,
    latencyMs:  result.latencyMs,
    attempts:   result.attempts,
  };
}

/**
 * Enrichment analysis: micronutrients only (21 fields, no macros re-run).
 * Intended for the background enrichment job.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {{ calories, protein, carbs, fat } | null} fastContext  Fast-analysis context.
 * @param {string[]} [foodItems]  Names of identified food items for context.
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @returns {Promise<{ enrichment: object, confidence: string, latencyMs: number }>}
 */
export async function enrichNutrition(imageBuffer, mimeType, fastContext, foodItems, { trace = null } = {}) {
  // Support legacy call signature where foodItems was omitted (foodItems = opts object)
  let resolvedFoodItems = foodItems;
  let resolvedOpts = { trace };
  if (foodItems && !Array.isArray(foodItems) && typeof foodItems === 'object') {
    resolvedOpts = foodItems;
    resolvedFoodItems = [];
  }

  const label      = 'enrichment';
  const imagePart  = imageInlinePart(imageBuffer, mimeType);
  const stageStart = Date.now();

  const { trace: resolvedTrace = null } = resolvedOpts;

  const shakeItems = (resolvedFoodItems ?? []).filter(isPreparedHerbalifeShakeName);
  const otherItems = (resolvedFoodItems ?? []).filter((name) => !isPreparedHerbalifeShakeName(name));
  const fixedShakeEnrichment = extractHerbalifeShakeEnrichment();

  // Prepared Herbalife Shake only — skip Gemini; return deterministic micronutrients.
  if (shakeItems.length > 0 && otherItems.length === 0) {
    const latencyMs = Date.now() - stageStart;
    if (resolvedTrace) {
      resolvedTrace.addStage({ name: label, latencyMs, success: true, extra: { attempts: 0, herbalifeShakeFixed: true } });
    }
    return {
      enrichment: fixedShakeEnrichment,
      confidence: 'high',
      latencyMs,
      attempts: 0,
    };
  }

  const prompt = buildEnrichmentPrompt(fastContext, otherItems.length > 0 ? otherItems : resolvedFoodItems);

  try {
    const { rawText, attempts, latencyMs } = await callModel(
      'nutrition', [imagePart, prompt], ENRICHMENT_SCHEMA, { label, trace: resolvedTrace },
    );

    const parsed = safeParseJson(rawText, { label });
    if (!parsed.ok) {
      logger.warn('AIGateway.enrichNutrition: parse error — using empty enrichment', { error: parsed.error });
      return { enrichment: {}, confidence: 'low', latencyMs, attempts };
    }

    let enrichment = parsed.data.enrichment ?? {};

    // Shake + extras: fixed shake micronutrients + Gemini estimate for additional items.
    if (shakeItems.length > 0 && otherItems.length > 0) {
      enrichment = sumEnrichmentFields(fixedShakeEnrichment, enrichment);
    }

    if (resolvedTrace) {
      resolvedTrace.addStage({ name: label, latencyMs, success: true, extra: { attempts } });
    }

    return {
      enrichment,
      confidence: parsed.data.confidence ?? 'low',
      latencyMs,
      attempts,
    };
  } catch (err) {
    if (resolvedTrace) {
      resolvedTrace.addStage({ name: label, latencyMs: Date.now() - stageStart, success: false, extra: { error: err.message } });
      resolvedTrace.error({ stage: label, message: err.message, code: err.code });
    }
    // Enrichment failures are non-fatal — return empty rather than crashing
    logger.warn('AIGateway.enrichNutrition: failed, returning empty enrichment', { error: err.message });
    return { enrichment: {}, confidence: 'low', latencyMs: Date.now() - stageStart, attempts: 1 };
  }
}

/**
 * Full 26-field nutrition analysis (fast + enrichment in one call).
 * Used by the legacy /api/ai/analyze-nutrition endpoint to preserve its contract.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function analyzeNutrition(imageBuffer, mimeType, { trace = null } = {}) {
  // Run unified classification first to get fast macros
  const unified = await analyzeUnified(imageBuffer, mimeType, { trace });
  const fast    = unified.fastNutrition ?? {};

  // Run enrichment in parallel (same image, context-aware prompt with food names)
  const foodItems = (unified.details?.foods ?? []).map(f => f.name).filter(Boolean);
  const enriched = await enrichNutrition(imageBuffer, mimeType, fast, foodItems, { trace });
  const micro    = enriched.enrichment ?? {};

  return {
    foods:        [],                           // backwards-compatible empty array
    total:        { ...fast, ...micro },
    confidence:   unified.confidence,
    fastNutrition: fast,
    enrichment:   micro,
    imageType:    unified.imageType,
  };
}

/**
 * Backwards-compatible weight detection.
 * Uses the unified call and returns the weightReading fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function detectWeight(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    weight:        result.weightReading?.value ?? null,
    unit:          result.weightReading?.unit  ?? 'kg',
    confidence:    result.confidence,
    isWeightScale: result.imageType === 'weight',
    latencyMs:     result.latencyMs,
  };
}

/**
 * Backwards-compatible meeting/education detection.
 * Uses the unified call and returns educationData fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function detectMeeting(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    isMeeting:  result.educationData?.isMeeting ?? false,
    platform:   result.educationData?.platform  ?? '',
    confidence: result.confidence,
    latencyMs:  result.latencyMs,
  };
}
