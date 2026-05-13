// Build a corrected food object from a matched correction record.
// Preserves the AI-original name, applies type-safety, quantity, and nutrition.
import { getFoodTypeByUnit } from './normalize';

const macros = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

const applyQuantity = (food, correction) => {
  const qty = parseFloat(correction.correctedQuantity);
  if (!correction.correctedQuantity || isNaN(qty)) return food;
  const isLiquid = correction.correctedUnit === 'ml';
  return {
    ...food,
    weight_g: isLiquid ? null : qty,
    volume_ml: isLiquid ? qty : null,
    grams: isLiquid ? null : qty,
    serving: { ...(food.serving || {}), quantity: qty, unit: correction.correctedUnit || food.serving?.unit },
  };
};

const applyNutrition = (food, correction) => {
  let next = { ...food };
  let applied = false;
  for (const k of macros) {
    const v = correction[k];
    if (v !== null && v !== undefined && !isNaN(parseFloat(v))) {
      const n = parseFloat(v);
      next[k] = n;
      next.nutrition = { ...(next.nutrition || {}), [k]: n };
      applied = true;
    }
  }
  if (applied) console.log(`   📊 Applied corrected nutrition for "${correction.user_corrected}"`);
  return next;
};

/**
 * @returns { food, skipped: boolean, skipReason?: string }
 */
export function buildCorrectedFood(food, correction, matchType, trueOriginalAiName) {
  // Type-safety: don't auto-correct a solid into a liquid (or vice-versa).
  const correctedType = getFoodTypeByUnit(correction.correctedUnit);
  const originalType  = getFoodTypeByUnit(food.unit);
  if (correctedType !== 'unknown' && originalType !== 'unknown' && correctedType !== originalType) {
    console.log(`   ⚠️ TYPE MISMATCH SKIP: "${food.name}" (${originalType}) → "${correction.user_corrected}" (${correctedType})`);
    return { food, skipped: true, skipReason: 'type-mismatch' };
  }

  let next = {
    ...food,
    name: correction.user_corrected,
    originalAiName: trueOriginalAiName,
    wasAutoCorrected: true,
    correctionSource: correction.source || (correction.user_id ? 'user-specific' : 'global'),
    correctionMetadata: {
      matchType,
      correctionId: correction.id,
      timestamp: new Date().toISOString(),
      source: correction.source || (correction.user_id ? 'user-specific' : 'global'),
    },
  };

  if (correction.correctedQuantity) next = applyQuantity(next, correction);
  if (correction.correctedUnit && correction.correctedUnit !== food.unit) next.unit = correction.correctedUnit;
  next = applyNutrition(next, correction);
  return { food: next, skipped: false };
}
