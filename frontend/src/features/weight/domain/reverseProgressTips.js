/**
 * reverseProgressTips.js
 * Pure domain module — no I/O, no React, no axios.
 *
 * Governs when and what wellness tips are shown after a user logs a weight
 * entry that is significantly higher than their previous one.
 *
 * Feature: weight/reverse-progress-tips
 * Owner: weight feature team
 */

/** Minimum weight increase (kg vs previous entry) that triggers the tip popup. */
export const REVERSE_PROGRESS_THRESHOLD_KG = 4;

/**
 * Ordered list of actionable wellness tips shown when reverse progress is detected.
 * Each string is one self-contained tip, ready for display as a bulleted line.
 */
const TIPS = [
  "🏃 Add 30 min of brisk walking or jogging to your day.",
  "🚴 Include physical activity like cycling, yoga, or a workout session.",
  "🥗 Swap refined carbs (rice, roti, bread) for vegetables at your next meal.",
  "🍽️ Reduce your portion size — try eating until 80 % full.",
  "🚫 Avoid fried snacks and sugary drinks for the next 48 hours.",
  "💧 Drink 2–3 litres of water throughout the day to reduce water retention.",
  "🌙 Aim for 7–8 hours of sleep — poor sleep raises cortisol and weight.",
];

/**
 * Returns the list of wellness tips when the weight change exceeds the threshold,
 * or `null` when no popup should be shown.
 *
 * @param {number} changeKg - Weight change in kg (today − yesterday). Positive = gain.
 * @returns {string[] | null}
 */
export function selectTips(changeKg) {
  if (!Number.isFinite(changeKg)) return null;
  if (changeKg < REVERSE_PROGRESS_THRESHOLD_KG) return null;
  return TIPS;
}
