/**
 * Barrel for the pure nutrition-math sub-slice.
 * All exports are React-free and have no I/O.
 */
export { textToNumber } from "./quantityParser";
export { decimalToFraction } from "./decimalToFraction";
export { computeNutrition, derivePer100g } from "./computeNutrition";
export { generateServingOptions } from "./generateServingOptions";
export { NUMBER_WORDS, NUMBER_WORD_LIST } from "./numberWords";
