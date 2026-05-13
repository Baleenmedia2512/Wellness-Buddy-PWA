// Single source of truth for pulling food names out of analysis payloads.
// Replaces the duplicated extractFoodNames + parseAnalysisData pair.

const addName = (out, name) => {
  if (!name || typeof name !== 'string') return;
  const normalized = name.trim().toLowerCase();
  if (normalized.length < 2) return;
  if (!out.includes(normalized)) out.push(normalized);
};

/**
 * Walk a parsed analysis object and collect normalized food names from any of:
 *   - foods[]            (background-service shape)
 *   - detailedItems[]    (manual-save shape)
 *   - category.name      (legacy single-food shape)
 */
function collectFoodNames(parsed) {
  const out = [];
  if (!parsed || typeof parsed !== 'object') return out;

  if (Array.isArray(parsed.foods)) {
    parsed.foods.forEach((f) => f && typeof f === 'object' && addName(out, f.name));
  }
  if (Array.isArray(parsed.detailedItems)) {
    parsed.detailedItems.forEach((i) => i && typeof i === 'object' && addName(out, i.name));
  }
  if (parsed.category && typeof parsed.category === 'object') {
    addName(out, parsed.category.name);
  }
  return out;
}

/**
 * Extract food names from an in-memory analysis result.
 * Returns [] on bad input — never throws.
 */
export function extractFoodNames(analysisResult) {
  try {
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.warn('Invalid analysis result provided to extractFoodNames');
      return [];
    }
    const names = collectFoodNames(analysisResult);
    if (names.length === 0) {
      console.warn('No valid food names extracted from analysis result');
    }
    return names;
  } catch (error) {
    console.error('Error extracting food names:', error);
    return [];
  }
}

/**
 * Extract food names from a serialized AnalysisData column value.
 * Returns [] on bad input — never throws.
 */
export function parseAnalysisData(analysisData) {
  try {
    if (!analysisData) return [];
    if (typeof analysisData === 'string' && analysisData.trim() === '') return [];
    let parsed;
    try {
      parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
    } catch (jsonError) {
      console.error('Invalid JSON in analysis data:', jsonError);
      return [];
    }
    return collectFoodNames(parsed);
  } catch (error) {
    console.error('Error parsing analysis data:', error);
    return [];
  }
}
