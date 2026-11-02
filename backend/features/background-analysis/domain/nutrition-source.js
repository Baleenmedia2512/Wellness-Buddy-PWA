/**
 * food_nutrition_data_table."Source" — ai vs manual.
 * ProcessedBy is NOT this flag: 'manual_app' is used for both camera AI and Manual Log.
 */

export const NUTRITION_SOURCE = Object.freeze({
  AI: 'ai',
  MANUAL: 'manual',
});

const MANUAL_PROCESSED_BY = new Set([
  'water_preset',
  'afresh_preset',
  'shake_calculator',
]);

const AI_PROCESSED_BY = new Set([
  'background_service',
]);

function normalizeSource(value) {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'ai' || raw === 'ai analysis' || raw === 'gemini') {
    return NUTRITION_SOURCE.AI;
  }
  if (
    raw === 'manual'
    || raw === 'manual entry'
    || raw === 'manual_entry'
    || raw === 'manual-entry'
  ) {
    return NUTRITION_SOURCE.MANUAL;
  }
  return null;
}

/**
 * Resolve ai | manual | null from a save payload.
 * Prefer an explicit analysis.source (new clients). Infer presets. Else null (legacy).
 *
 * @param {object|null|undefined} analysis
 * @param {string|null|undefined} processedBy
 * @returns {'ai'|'manual'|null}
 */
export function resolveNutritionSource(analysis, processedBy = null) {
  const explicit = normalizeSource(analysis?.source ?? analysis?.nutritionSource);
  if (explicit) return explicit;

  if (analysis?.isManualEntry === true) return NUTRITION_SOURCE.MANUAL;

  const byArg = String(processedBy || '').toLowerCase().trim();
  const byAnalysis = String(analysis?.processedBy || '').toLowerCase().trim();
  if (MANUAL_PROCESSED_BY.has(byAnalysis) || MANUAL_PROCESSED_BY.has(byArg)) {
    return NUTRITION_SOURCE.MANUAL;
  }
  if (AI_PROCESSED_BY.has(byAnalysis) || AI_PROCESSED_BY.has(byArg)) {
    return NUTRITION_SOURCE.AI;
  }

  return null;
}
