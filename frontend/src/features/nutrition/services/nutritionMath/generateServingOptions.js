import { textToNumber } from "./quantityParser";
import { NUMBER_WORDS, NUMBER_WORD_LIST } from "./numberWords";
import { decimalToFraction } from "./decimalToFraction";

/**
 * Generate dynamic serving-size options around a detected portion quantity.
 *
 * Behavior matches the legacy implementation that previously lived inline in
 * EditableFoodItem.js (lines ~337–612). The algorithm:
 *   1. Parse `portionDesc` for a numeric quantity (fraction / decimal / whole
 *      / number-only / english word) and the unit token.
 *   2. Generate 1–4 options below and 2–4 options above the detected quantity
 *      using a fixed pattern of 0.25 / 0.5 / 1.0 increments.
 *   3. Project each quantity into grams and a scaled per-quantity nutrition
 *      object via per100g multipliers (calories rounded; macros ceil'd).
 *   4. Format the description using fractions if the original input used a
 *      fraction; otherwise decimals.
 *
 * Pure: no React, no DOM, no I/O.
 *
 * @param {{grams:number}} baseServing
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber?:number}} per100g
 * @param {string} itemName
 * @param {string} portionDesc
 * @returns {Array<{description:string, grams:number, nutrition:object, isOriginal:boolean}>}
 */
export function generateServingOptions(
  baseServing,
  per100g,
  itemName,
  portionDesc,
) {
  const options = [];

  // Extract quantity from portion description - handles fractions, whole numbers, text numbers, and numbers-only
  // Examples: "2 idlis", "two parottas", "1/2 cup", "1 1/2 bowls", "3 chapatis", "3"
  let detectedQuantity = 1;
  let itemUnit = itemName.toLowerCase();
  let useFractionFormat = false; // Track if original was in fraction format

  // First, try to convert text numbers to digits (e.g., "two parottas" -> "2 parottas")
  let normalizedDesc = portionDesc;
  const textNum = textToNumber(portionDesc);
  if (textNum !== null) {
    // Replace text number with digit
    for (const word of NUMBER_WORD_LIST) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      if (regex.test(portionDesc)) {
        normalizedDesc = portionDesc.replace(
          regex,
          NUMBER_WORDS[word.toLowerCase()],
        );
        break;
      }
    }
  }

  // Try to match fraction pattern (e.g., "1/2 cup", "1 1/2 bowls", "0.5 cup")
  const fractionMatch = normalizedDesc.match(
    /(\d+)?\s*(\d+)\/(\d+)\s*([a-zA-Z]+)/,
  );
  if (fractionMatch) {
    useFractionFormat = true; // Original was in fraction format
    const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    detectedQuantity = whole + numerator / denominator;
    itemUnit = fractionMatch[4];
  } else {
    // Try to match decimal number (e.g., "0.5 cup")
    const decimalMatch = normalizedDesc.match(/(\d+\.?\d*)\s*([a-zA-Z]+)/);
    if (decimalMatch) {
      detectedQuantity = parseFloat(decimalMatch[1]);
      itemUnit = decimalMatch[2];
    } else {
      // Try to match whole number with unit (e.g., "2 idlis", "3 chapatis")
      const wholeMatch = normalizedDesc.match(/(\d+)\s*([a-zA-Z]+)/);
      if (wholeMatch) {
        detectedQuantity = parseInt(wholeMatch[1]);
        itemUnit = wholeMatch[2];
      } else {
        // Try to match number-only (e.g., "3")
        const numberOnlyMatch = normalizedDesc.match(/^\d+\.?\d*$/);
        if (numberOnlyMatch) {
          detectedQuantity = parseFloat(normalizedDesc);
          // itemUnit already set to itemName.toLowerCase()
        }
      }
    }
  }

  // Generate serving options dynamically following the pattern:
  // 0.25 (1/4) → 0.25, 0.5, 0.75, 1, 1.5
  // 0.5 (1/2) → 0.25, 0.5, 1, 1.5, 2
  // 1 → 0.5, 1, 1.5, 2, 3
  // 2 → 1, 1.5, 2, 2.5, 3, 4
  // 3 → 1, 2, 2.5, 3, 3.5, 4, 5
  // Pattern: Always use 0.5 and 1 increments only, minimum 0.25

  const servingSizes = [];

  // Generate options below original
  if (detectedQuantity <= 0.5) {
    // For 0.25 and 0.5: add smaller fractions
    if (detectedQuantity > 0.25) {
      servingSizes.push(0.25);
    }
    if (detectedQuantity === 0.5) {
      // Already have 0.25, don't duplicate
    }
  } else if (detectedQuantity === 0.75) {
    servingSizes.push(0.25, 0.5);
  } else if (detectedQuantity === 1) {
    servingSizes.push(0.5);
  } else if (detectedQuantity === 1.5) {
    servingSizes.push(0.5, 1);
  } else if (detectedQuantity >= 2) {
    // For 2 and above: add options below in 0.5 decrements
    // Try to get 2 options below, but not go below 0.5 for values < 2, or 1 for values >= 2
    const minValue = detectedQuantity >= 2 ? 1 : 0.5;

    // First option below (larger decrement)
    let firstBelow;
    if (detectedQuantity >= 3) {
      // For 3+: go down by 1 or more
      firstBelow = Math.max(
        minValue,
        detectedQuantity - Math.floor(detectedQuantity / 2),
      );
    } else {
      // For 2-2.5: go down by 0.5 or 1
      firstBelow = Math.max(minValue, detectedQuantity - 1);
    }

    // Second option below (smaller decrement)
    const secondBelow = detectedQuantity - 0.5;

    // Add first below if valid and different from second
    if (
      firstBelow >= minValue &&
      Math.abs(firstBelow - secondBelow) > 0.1
    ) {
      servingSizes.push(firstBelow);
    }

    // Add second below if valid
    if (secondBelow >= minValue) {
      servingSizes.push(secondBelow);
    }
  }

  // Add original
  servingSizes.push(detectedQuantity);

  // Generate options above original
  if (detectedQuantity < 0.5) {
    // For 0.25: add 0.5, 0.75, 1, 1.5
    servingSizes.push(0.5, 0.75, 1, 1.5);
  } else if (detectedQuantity === 0.5) {
    // For 0.5: add 1, 1.5, 2
    servingSizes.push(1, 1.5, 2);
  } else if (detectedQuantity === 0.75) {
    // For 0.75: add 1, 1.5, 2
    servingSizes.push(1, 1.5, 2);
  } else {
    // For 1 and above: add +0.5, +1, and larger jumps
    servingSizes.push(detectedQuantity + 0.5);
    servingSizes.push(detectedQuantity + 1);

    // Add bigger jumps for variety
    if (detectedQuantity >= 2) {
      servingSizes.push(detectedQuantity + 1.5);
      servingSizes.push(detectedQuantity + 2.5);
    } else {
      // For 1-1.5: add 3 as a bigger option
      servingSizes.push(detectedQuantity + 1.5);
    }
  }

  // Remove duplicates and sort
  const uniqueSizes = [...new Set(servingSizes)].sort((a, b) => a - b);

  // Generate options from unique sizes
  uniqueSizes.forEach((qty) => {
    const multiplier = qty / detectedQuantity;
    const gramsForQty = Math.round(baseServing.grams * multiplier);
    const nutritionMultiplier = gramsForQty / 100;

    // Format display based on original format
    let qtyDisplay;
    if (useFractionFormat) {
      // Use fraction format (e.g., "1/2", "3/4", "1 1/2")
      qtyDisplay = decimalToFraction(qty);
    } else {
      // Use decimal format (e.g., "0.5", "1", "1.5")
      qtyDisplay = qty % 1 === 0 ? qty.toString() : qty.toFixed(1);
    }

    const isOriginal = Math.abs(qty - detectedQuantity) < 0.01;

    options.push({
      description: isOriginal
        ? `${qtyDisplay} ${itemUnit} (original)`
        : `${qtyDisplay} ${itemUnit}`,
      grams: gramsForQty,
      nutrition: {
        calories: Math.round(per100g.calories * nutritionMultiplier),
        protein: Math.ceil(per100g.protein * nutritionMultiplier),
        carbs: Math.ceil(per100g.carbs * nutritionMultiplier),
        fat: Math.ceil(per100g.fat * nutritionMultiplier),
        fiber: Math.ceil((per100g.fiber || 0) * nutritionMultiplier),
      },
      isOriginal: isOriginal,
    });
  });

  return options;
}
