/**
 * Shared map of English number-words → numeric values used by the
 * quantity parser. Hoisted to module scope to dedupe two identical
 * inline declarations that previously lived inside generateServingOptions.
 *
 * Order is preserved exactly to match the legacy first-match semantics
 * of textToNumber (which does substring `includes` checks, not word-
 * boundary matches). Do not reorder.
 */
export const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  half: 0.5,
  quarter: 0.25,
};

/** Insertion-ordered list of the same words (used by the regex pass). */
export const NUMBER_WORD_LIST = Object.keys(NUMBER_WORDS);
