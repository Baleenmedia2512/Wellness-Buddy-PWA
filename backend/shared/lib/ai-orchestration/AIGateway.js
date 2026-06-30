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
import { getModel, imageInlinePart, SchemaType, FALLBACK_MODEL_NAME } from '../gemini/geminiClient.js';
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

// ── Prompts (module-level constants) ──────────────────────────────────────────

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

Meal-replacement shakes (isLiquid: true, ~250–300 ml serving):
- "Herbalife Formula 1 Shake" — powder sachet or blended shaker bottle with logo.
    Prepared with water: 210 kcal, 18 g protein, 24 g carbs, 3 g fat, 4 g fiber.
    Prepared with 200 ml full-fat milk: 340 kcal, 26 g protein, 36 g carbs, 9 g fat, 4 g fiber.
    Adjust if plant milk (soy/almond) is visible.
- "Herbalife Protein Drink Mix (PDM)" — added to F1 shake.
    Per 1 scoop added to F1: +70 kcal, 15 g protein, 3 g carbs, 0.5 g fat.
- "Herbalife High Protein Iced Coffee" — coffee-flavoured meal drink.
    1 serving: 230 kcal, 20 g protein, 22 g carbs, 5 g fat.

Hydration beverages (isLiquid: true, NOT a meal):
- "Herbalife Afresh Energy Drink" — yellow/orange/green sachet or prepared in a cup.
    Per cup (~200 ml): 15 kcal, 0 g protein, 4 g carbs, 0 g fat, 0 g fiber. sodium 20 mg.
- "Herbalife Herbal Tea Concentrate" — small sachet, dark concentrate bottle.
    Per cup (~200 ml): 8 kcal, 0 g protein, 2 g carbs, 0 g fat. Antioxidant beverage.

Supplements (isLiquid: false, near-zero calories — estimate 5–10 kcal per tablet/capsule):
- "Herbalife Formula 2 Multivitamin" — oval bottle, yellow/white label.
- "Herbalife Formula 3 Cell Activator" — oval bottle, orange label.
- "Herbalife NightWorks / Niteworks" — heart-health supplement.
- "Herbalife Xtra-Cal" — calcium supplement.
- "Herbalife Prolessa Duo" — weight management.
- Any labelled Herbalife supplement bottle/packet: name it exactly as printed.

Micronutrients for Herbalife F1 Shake (per serving, approximate):
  vitamin_a: 250 µg, vitamin_c: 60 mg, vitamin_d: 5 µg, vitamin_e: 5 mg, vitamin_k: 30 µg,
  vitamin_b1: 0.7 mg, vitamin_b2: 0.8 mg, vitamin_b3: 8 mg, vitamin_b6: 0.7 mg, vitamin_b9: 100 µg, vitamin_b12: 1.5 µg,
  calcium: 250 mg, iron: 4 mg, magnesium: 50 mg, potassium: 350 mg, zinc: 3 mg, phosphorus: 200 mg.

=== Tamil Nadu / South Indian foods (SECOND PRIORITY) ===
Use these EXACT names. If unsure, pick the closest Tamil Nadu food — never default to a Western name.

Breakfast items (per 1 standard piece / 1 serving unless noted):
- Idli (1 piece ~45 g):         58 kcal, 2.5 g P, 11 g C, 0.2 g F, 0.5 g fiber. sodium 120 mg.
- Dosa (1 plain ~90 g):        110 kcal, 3.0 g P, 20 g C, 2.5 g F, 1.0 g fiber. sodium 200 mg.
- Masala Dosa (1 ~180 g):      260 kcal, 6.0 g P, 42 g C, 7.0 g F, 3.0 g fiber.
- Rava Dosa (1 ~90 g):         130 kcal, 3.5 g P, 22 g C, 3.5 g F, 1.0 g fiber.
- Uthappam (1 ~120 g):         145 kcal, 4.5 g P, 25 g C, 3.0 g F, 2.0 g fiber.
- Pongal / Ven Pongal (1 cup ~200 g): 320 kcal, 8 g P, 42 g C, 12 g F, 2 g fiber.
- Appam (1 piece ~80 g):        95 kcal, 2.5 g P, 19 g C, 1.0 g F, 1.0 g fiber.
- Puttu (1 serving ~120 g):    195 kcal, 4.0 g P, 40 g C, 2.5 g F, 3.0 g fiber.
- Idiyappam (1 serving ~100 g): 160 kcal, 3.5 g P, 34 g C, 1.0 g F, 1.5 g fiber.
- Poha / Aval (1 cup ~180 g):  240 kcal, 4.0 g P, 48 g C, 3.0 g F, 2.0 g fiber.
- Upma (1 cup ~200 g):         230 kcal, 5.0 g P, 38 g C, 6.0 g F, 2.5 g fiber.

Rice dishes (per 1 cup ~200 g cooked):
- Plain White Rice:             260 kcal, 5.5 g P, 57 g C, 0.5 g F, 0.5 g fiber.
- Curd Rice:                    210 kcal, 7.0 g P, 36 g C, 4.0 g F, 0.5 g fiber.
- Lemon Rice:                   260 kcal, 5.0 g P, 50 g C, 5.0 g F, 2.0 g fiber. sodium 350 mg.
- Puliyodarai / Tamarind Rice:  290 kcal, 5.0 g P, 52 g C, 7.0 g F, 2.5 g fiber.
- Tomato Rice:                  280 kcal, 6.0 g P, 52 g C, 5.5 g F, 2.0 g fiber.
- Coconut Rice:                 310 kcal, 5.5 g P, 50 g C, 9.0 g F, 2.0 g fiber.
- Sambar Rice (sadam):          310 kcal, 10 g P, 52 g C, 6.0 g F, 5.0 g fiber.
- Chicken Biryani (1 plate ~350 g): 620 kcal, 32 g P, 75 g C, 18 g F, 3.0 g fiber.
- Mutton Biryani (1 plate ~350 g):  680 kcal, 35 g P, 72 g C, 24 g F, 3.0 g fiber.
- Seeraga Samba Biryani (1 plate ~350 g): 640 kcal, 30 g P, 76 g C, 20 g F, 3.0 g fiber.
- Vegetable Biryani (1 plate ~300 g): 450 kcal, 10 g P, 78 g C, 12 g F, 4.0 g fiber.

Breads:
- Parotta (1 piece ~90 g):     300 kcal, 6.0 g P, 45 g C, 10 g F, 1.5 g fiber.
- Kothu Parotta (1 serving ~250 g): 480 kcal, 18 g P, 60 g C, 18 g F, 3.0 g fiber.
- Chapati / Roti (1 piece ~40 g): 95 kcal, 3.0 g P, 18 g C, 1.5 g F, 2.0 g fiber.
- Phulka (1 piece ~30 g):       80 kcal, 2.5 g P, 15 g C, 1.0 g F, 2.0 g fiber.

Gravies & curries (per 1 cup ~200 ml/g):
- Sambar:                       100 kcal, 5.5 g P, 14 g C, 3.0 g F, 4.0 g fiber. sodium 450 mg.
- Rasam:                         45 kcal, 1.5 g P,  7 g C, 1.5 g F, 1.0 g fiber. sodium 350 mg.
- Kootu (vegetable+lentil):     150 kcal, 6.0 g P, 20 g C, 5.0 g F, 4.0 g fiber.
- Poriyal (stir-fry, ~100 g):   90 kcal, 3.0 g P, 12 g C, 3.5 g F, 3.0 g fiber.
- Avial (~150 g):               130 kcal, 3.5 g P, 15 g C, 6.0 g F, 4.0 g fiber.
- Moru Kuzhambu (buttermilk curry, ~200 ml): 80 kcal, 3.0 g P, 8 g C, 4.0 g F.
- Vatha Kuzhambu (~150 ml):     110 kcal, 2.0 g P, 10 g C, 7.0 g F, 2.0 g fiber.
- Chicken Chettinad (~200 g):   280 kcal, 28 g P,  8 g C, 16 g F, 1.5 g fiber.
- Mutton Kuzhambu (~200 g):     320 kcal, 25 g P,  9 g C, 21 g F, 1.5 g fiber.
- Meen Kuzhambu / Fish Curry (~200 g): 220 kcal, 24 g P, 7 g C, 11 g F, 1.0 g fiber.
- Egg Curry (1 egg + gravy):    180 kcal, 12 g P,  8 g C, 11 g F, 1.0 g fiber.
- Egg Bhurji (2 eggs):          210 kcal, 14 g P,  6 g C, 14 g F, 1.0 g fiber.
- Paneer Butter Masala (~200 g): 340 kcal, 14 g P, 14 g C, 26 g F, 2.0 g fiber.
- Dal Tadka (~200 ml):          180 kcal, 10 g P, 25 g C, 5.0 g F, 5.0 g fiber.
- Coconut Chutney (2 tbsp ~30 g): 50 kcal, 0.8 g P, 3 g C, 4.0 g F, 1.5 g fiber.
- Tomato Chutney (2 tbsp ~30 g):  25 kcal, 0.5 g P, 4 g C, 1.0 g F, 1.0 g fiber.

Snacks:
- Murukku (1 piece ~30 g):     155 kcal, 2.5 g P, 20 g C, 7.0 g F, 1.0 g fiber.
- Sundal (1 cup ~100 g):       155 kcal, 9.0 g P, 22 g C, 3.5 g F, 7.0 g fiber.
- Bonda (1 piece ~60 g):       145 kcal, 3.5 g P, 20 g C, 6.0 g F, 1.5 g fiber.
- Bajji (1 piece ~50 g):       120 kcal, 3.0 g P, 16 g C, 5.0 g F, 1.5 g fiber.

Beverages (isLiquid: true, per standard serving):
- Filter Coffee with milk (~150 ml): 85 kcal, 3.5 g P, 9 g C, 4.0 g F. calcium 120 mg, potassium 200 mg.
- Masala Chai with milk (~150 ml):   80 kcal, 3.0 g P, 9 g C, 3.5 g F. calcium 110 mg.
- Plain Tea with milk (~150 ml):     60 kcal, 2.5 g P, 7 g C, 3.0 g F.
- Ginger Tea with milk (~150 ml):    65 kcal, 2.5 g P, 8 g C, 3.0 g F.
- Buttermilk / Moru (~200 ml):       35 kcal, 2.5 g P, 5 g C, 1.0 g F. calcium 100 mg.
- Tender Coconut Water (~240 ml):    45 kcal, 0.5 g P, 11 g C, 0.5 g F. potassium 600 mg.
- Sugarcane Juice (~240 ml):        120 kcal, 0.5 g P, 30 g C, 0.0 g F. potassium 180 mg.

Sweets (per 1 piece / 1 serving):
- Sweet Pongal / Sakkarai Pongal (1 cup ~150 g): 350 kcal, 6 g P, 60 g C, 10 g F.
- Payasam (1 cup ~150 ml):   200 kcal, 5.0 g P, 35 g C, 5.0 g F.
- Mysore Pak (1 piece ~50 g):290 kcal, 3.5 g P, 32 g C, 17 g F.
- Halwa (1 piece ~80 g):     280 kcal, 3.0 g P, 45 g C, 10 g F.
- Laddu (1 piece ~50 g):     225 kcal, 4.5 g P, 30 g C, 10 g F.

=== isLiquid ===
true  → all beverages (water, tea, coffee, juices, buttermilk, coconut water, Afresh, Herbal Tea Concentrate, Herbalife shakes)
false → all solid foods (rice, bread, curry, snacks, idli, supplements)

=== FOOD output ===

fastNutrition — 9-field aggregate totals:
{ calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index }

details.foods — one object per visible edible item or beverage:
{
  name,       ← specific: "Idli" / "Herbalife Formula 1 Shake" / "Filter Coffee" — never generic "Food"/"Drink"/"Meal"
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
- Use the reference values above for Tamil Nadu foods and Herbalife products.
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
Herbalife Formula 1 Shake (1 serving, prepared):
  vitamin_a: 250, vitamin_c: 60, vitamin_d: 5, vitamin_e: 5, vitamin_k: 30,
  vitamin_b1: 0.7, vitamin_b2: 0.8, vitamin_b3: 8, vitamin_b6: 0.7, vitamin_b9: 100, vitamin_b12: 1.5,
  calcium: 250, iron: 4, magnesium: 50, potassium: 350, zinc: 3, phosphorus: 200.
Herbalife Afresh Energy Drink (1 cup):
  vitamin_c: 15, potassium: 30. All others: 0.
Herbalife Herbal Tea Concentrate (1 cup):
  vitamin_c: 5. All others: 0.
Herbalife Formula 2 Multivitamin (per daily dose):
  vitamin_a: 700, vitamin_c: 80, vitamin_d: 10, vitamin_e: 12, vitamin_k: 60,
  vitamin_b1: 1.1, vitamin_b2: 1.4, vitamin_b3: 16, vitamin_b6: 1.4, vitamin_b9: 200, vitamin_b12: 2.5,
  calcium: 150, iron: 8, magnesium: 55, potassium: 80, zinc: 7, phosphorus: 100.

=== Tamil Nadu foods — micronutrient references per standard serving ===

Dairy-based beverages (per ~150–200 ml cup with cow's milk):
  Filter Coffee / Masala Chai / Tea with milk / Ginger Tea:
    calcium: 120, potassium: 200, phosphorus: 100, vitamin_b2: 0.20, vitamin_b12: 0.5,
    magnesium: 15, vitamin_a: 50, vitamin_b1: 0.05, vitamin_d: 0.5.

Idli (per 2 pieces ~90 g):
  iron: 0.8, calcium: 20, potassium: 70, phosphorus: 50, magnesium: 15,
  vitamin_b1: 0.06, vitamin_b2: 0.03, vitamin_b3: 0.7, vitamin_b9: 12.

Dosa (plain, per 1 piece ~90 g):
  iron: 0.7, calcium: 15, potassium: 80, phosphorus: 60, magnesium: 18,
  vitamin_b1: 0.08, vitamin_b2: 0.04, vitamin_b3: 0.9, vitamin_b9: 14.

Pongal / Ven Pongal (per 1 cup ~200 g):
  calcium: 25, iron: 1.5, potassium: 150, phosphorus: 90, magnesium: 30,
  vitamin_b1: 0.10, vitamin_b3: 1.5, vitamin_b9: 20.

Sambar (per 1 cup ~200 ml):
  iron: 2.0, calcium: 50, potassium: 350, phosphorus: 80, magnesium: 35,
  vitamin_c: 15, vitamin_b1: 0.10, vitamin_b3: 1.2, vitamin_b9: 40, vitamin_a: 120.

Curd Rice (per 1 cup ~200 g):
  calcium: 150, potassium: 180, phosphorus: 120, vitamin_b2: 0.18, vitamin_b12: 0.4,
  magnesium: 18, vitamin_a: 40.

Chicken Biryani (per 1 plate ~350 g):
  iron: 2.5, zinc: 3.5, potassium: 450, phosphorus: 280, calcium: 40,
  vitamin_b3: 8.0, vitamin_b6: 0.5, vitamin_b12: 0.6, vitamin_b1: 0.15, magnesium: 45.

Mutton Biryani (per 1 plate ~350 g):
  iron: 3.5, zinc: 5.0, potassium: 480, phosphorus: 300, calcium: 45,
  vitamin_b3: 7.0, vitamin_b6: 0.4, vitamin_b12: 1.5, vitamin_b1: 0.18, magnesium: 50.

Parotta (per 1 piece ~90 g):
  iron: 1.2, calcium: 20, phosphorus: 70, potassium: 80, vitamin_b1: 0.12, vitamin_b3: 1.0.

Rasam (per 1 cup ~200 ml):
  vitamin_c: 12, iron: 1.0, potassium: 250, magnesium: 20, calcium: 25, vitamin_a: 40.

Kootu (vegetable+lentil, per 1 cup ~150 g):
  iron: 2.0, calcium: 60, potassium: 300, magnesium: 40, vitamin_c: 20, vitamin_b9: 50.

Tender Coconut Water (per 240 ml):
  potassium: 600, magnesium: 25, calcium: 18, phosphorus: 17, vitamin_c: 4.

Buttermilk / Moru (per 200 ml):
  calcium: 115, potassium: 180, phosphorus: 90, vitamin_b2: 0.15, vitamin_b12: 0.35.

Egg (per 1 whole egg ~50 g):
  vitamin_a: 70, vitamin_d: 1.1, vitamin_b2: 0.24, vitamin_b12: 0.6, vitamin_b9: 24,
  iron: 0.9, calcium: 25, phosphorus: 95, zinc: 0.6, potassium: 70.

For any Tamil Nadu food not listed above, use USDA / IFCT (Indian Food Composition Tables) values.
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
  // 503 = service unavailable (overloaded)
  // 429 = quota exceeded / rate limited (separate quota on fallback model)
  if (status === 503 || status === 429) return true;
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
async function callModel(configKey, parts, schema, { label, trace = null, modelOverride = null }) {
  const model = getModel(configKey, schema, modelOverride);

  // The fallback model uses its own independent circuit breaker so an opened
  // primary breaker does not also block the fallback.
  const circuitService = modelOverride ? `${SERVICE}-fallback` : SERVICE;

  let result, attempts, totalLatencyMs;
  try {
    ({ result, attempts, totalLatencyMs } = await withEnterpriseRetry(
      () => model.generateContent(parts),
      { label, service: circuitService },
    ));
  } catch (err) {
    // Primary model saturated, circuit open, or quota exceeded → try fallback once
    if (!modelOverride && isPrimaryOverloadedError(err)) {
      const status = Number(err.status);
      const reason = err.code === 'CIRCUIT_OPEN' ? 'circuit_open'
                   : (status === 429 || (err.message ?? '').toLowerCase().includes('quota') || (err.message ?? '').toLowerCase().includes('rate limit') || (err.message ?? '').toLowerCase().includes('too many requests')) ? '429_quota_exceeded'
                   : '503_overload';
      logger.warn('AIGateway.callModel: primary model unavailable, switching to fallback', {
        label,
        fallbackModel: FALLBACK_MODEL_NAME,
        reason,
        primaryError:  err.message,
      });
      return callModel(configKey, parts, schema, { label, trace, modelOverride: FALLBACK_MODEL_NAME });
    }
    throw err;
  }

  // Propagate retries into trace
  if (trace && attempts > 1) {
    for (let i = 1; i < attempts; i += 1) trace.addRetry();
  }

  const rawText = result.response.text();

  // Accumulate token usage (available on supported model versions)
  const usage = result.response?.usageMetadata;
  if (trace && usage) {
    trace.addTokenUsage({
      inputTokens:  usage.promptTokenCount     ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      model:        configKey,
    });
  }

  return { rawText, attempts, latencyMs: totalLatencyMs };
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
export async function analyzeUnified(imageBuffer, mimeType, { trace = null } = {}) {
  const label     = 'unified';
  const imagePart = imageInlinePart(imageBuffer, mimeType);
  const stageStart = Date.now();

  try {
    const { rawText, attempts, latencyMs } = await callModel(
      'unified', [imagePart, UNIFIED_PROMPT], UNIFIED_SCHEMA, { label, trace },
    );

    const parsed = safeParseJson(rawText, { label });
    if (!parsed.ok) {
      throw new Error(`AIGateway.analyzeUnified: parse error — ${parsed.error}`);
    }

    const shape = validateShape(parsed.data, ['imageType', 'confidence'], { label });
    if (!shape.ok) {
      throw new Error(`AIGateway.analyzeUnified: schema missing ${shape.missing}`);
    }

    const d        = parsed.data;
    const normType = normaliseType(d.imageType, d.confidence);

    if (trace) {
      trace.addStage({ name: label, latencyMs, success: true, extra: { attempts, imageType: normType } });
    }

    return {
      imageType:      normType,
      confidence:     d.confidence,
      details:        d.details         ?? {},
      fastNutrition:  normType === 'food'       ? (d.fastNutrition  ?? null) : null,
      weightReading:  normType === 'weight'     ? (d.weightReading  ?? null) : null,
      smartwatchData: normType === 'smartwatch' ? (d.smartwatchData ?? null) : null,
      educationData:  normType === 'education'  ? (d.educationData  ?? null) : null,
      latencyMs,
      attempts,
    };
  } catch (err) {
    if (trace) {
      trace.addStage({
        name:      label,
        latencyMs: Date.now() - stageStart,
        success:   false,
        extra:     { error: err.message },
      });
      trace.error({ stage: label, message: err.message, code: err.code });
    }
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
  const prompt     = buildEnrichmentPrompt(fastContext, resolvedFoodItems);
  const stageStart = Date.now();

  const { trace: resolvedTrace = null } = resolvedOpts;

  try {
    const { rawText, attempts, latencyMs } = await callModel(
      'nutrition', [imagePart, prompt], ENRICHMENT_SCHEMA, { label, trace: resolvedTrace },
    );

    const parsed = safeParseJson(rawText, { label });
    if (!parsed.ok) {
      logger.warn('AIGateway.enrichNutrition: parse error — using empty enrichment', { error: parsed.error });
      return { enrichment: {}, confidence: 'low', latencyMs, attempts };
    }

    if (resolvedTrace) {
      resolvedTrace.addStage({ name: label, latencyMs, success: true, extra: { attempts } });
    }

    return {
      enrichment: parsed.data.enrichment ?? {},
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
