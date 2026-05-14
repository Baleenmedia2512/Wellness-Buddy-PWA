import { NUMBER_WORDS } from "./numberWords";

/**
 * Convert an English text-number embedded in `text` into its numeric value.
 *
 * NOTE: legacy semantics use `String.prototype.includes` rather than a word
 * boundary, and iterate insertion order of {@link NUMBER_WORDS}. This means
 * "twenty" can resolve as "two" because "two" is checked first. This is a
 * known quirk of the original implementation and is preserved intentionally
 * to avoid behavioral drift in the editor flow that depends on it.
 *
 * @param {string} text
 * @returns {number|null}
 */
export function textToNumber(text) {
  if (typeof text !== "string") return null;
  const lowerText = text.toLowerCase();
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (lowerText.includes(word)) {
      return num;
    }
  }
  return null;
}
