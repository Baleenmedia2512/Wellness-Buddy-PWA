/**
 * Pure planning helpers for the food-correction save flow.
 *
 * These functions encode the high-risk "what should we save and under which
 * AI-detected name?" decision tree that previously lived inline inside
 * EditableFoodItem.js (`saveCorrectionIfNeeded`). Extracted to keep the
 * decision logic React-free and unit-testable.
 *
 * No I/O is performed here. The component is still responsible for calling
 * saveFoodCorrection / getUserContext with the values returned.
 */

/**
 * Resolve the original AI-detected name for a food item, walking the same
 * fallback chain the legacy implementation used:
 *   originalFoodSnapshot.originalAiName
 *   → foodItem.originalAiName
 *   → originalFoodSnapshot.correctionMetadata.aiDetected
 *   → foodItem.correctionMetadata.aiDetected
 *   → (if any of the two items was auto-corrected) the originalName argument,
 *     emitting a console.error so we keep the same logging surface
 *   → otherwise originalName
 *
 * @param {object|null|undefined} originalFoodSnapshot
 * @param {object|null|undefined} foodItem
 * @param {string|undefined} originalName
 * @returns {string|undefined}
 */
export function resolveAiDetectedName(originalFoodSnapshot, foodItem, originalName) {
  let aiDetectedName =
    originalFoodSnapshot?.originalAiName ||
    foodItem?.originalAiName ||
    originalFoodSnapshot?.correctionMetadata?.aiDetected ||
    foodItem?.correctionMetadata?.aiDetected;

  if (
    !aiDetectedName &&
    (originalFoodSnapshot?.wasAutoCorrected || foodItem?.wasAutoCorrected)
  ) {
    // Preserve the legacy "CRITICAL ERROR" logging surface so monitoring stays intact.
    // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
    console.error("🚨 CRITICAL ERROR: Auto-corrected item has NO originalAiName!");
    aiDetectedName = originalName;
  } else if (!aiDetectedName) {
    aiDetectedName = originalName;
  }

  return aiDetectedName;
}

/**
 * Compare an original snapshot of a food item against an updated version and
 * return either a save plan or `null` when no correction needs to be saved.
 *
 * This is a pure function. Behavior matches the legacy `saveCorrectionIfNeeded`
 * decision tree exactly:
 *   - skip if neither name nor weight changed (weight delta ≤ 0.5)
 *   - the userCorrectedName is the new name when name changed, otherwise the
 *     original name
 *   - correctedData carries the FINAL (post-grams-edit) nutrition values from
 *     the updatedFood object, not from the AI detection
 *
 * @param {{originalFoodSnapshot:object|null|undefined, foodItem:object, updatedFood:object}} input
 * @returns {{
 *   aiDetectedName: string|undefined,
 *   userCorrectedName: string|undefined,
 *   correctedData: {
 *     correctedQuantity:number|undefined,
 *     correctedUnit:string|undefined,
 *     correctedCalories:number|undefined,
 *     correctedCarbs:number|undefined,
 *     correctedProtein:number|undefined,
 *     correctedFat:number|undefined,
 *     correctedFiber:number|undefined,
 *   },
 *   nameChanged: boolean,
 *   weightChanged: boolean,
 * }|null}
 */
export function planFoodCorrection({ originalFoodSnapshot, foodItem, updatedFood }) {
  const originalName = originalFoodSnapshot?.name;
  const newName = updatedFood?.name;
  const originalGrams =
    originalFoodSnapshot?.grams || originalFoodSnapshot?.serving?.grams;
  const newGrams = updatedFood?.grams || updatedFood?.serving?.grams;

  const nameChanged =
    !!originalName &&
    !!newName &&
    originalName.trim().toLowerCase() !== newName.trim().toLowerCase();
  const weightChanged =
    !!originalGrams &&
    !!newGrams &&
    Math.abs(originalGrams - newGrams) > 0.5;

  if (!nameChanged && !weightChanged) {
    return null;
  }

  const aiDetectedName = resolveAiDetectedName(
    originalFoodSnapshot,
    foodItem,
    originalName,
  );

  const userCorrectedName = nameChanged ? newName : originalName;

  const correctedData = {
    correctedQuantity: updatedFood?.grams || updatedFood?.serving?.grams,
    correctedUnit: updatedFood?.unit || updatedFood?.serving?.unit,
    correctedCalories: updatedFood?.nutrition?.calories,
    correctedCarbs: updatedFood?.nutrition?.carbs,
    correctedProtein: updatedFood?.nutrition?.protein,
    correctedFat: updatedFood?.nutrition?.fat,
    correctedFiber: updatedFood?.nutrition?.fiber,
  };

  return {
    aiDetectedName,
    userCorrectedName,
    correctedData,
    nameChanged,
    weightChanged,
  };
}
