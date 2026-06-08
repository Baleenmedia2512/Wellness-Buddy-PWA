/**
 * reverseProgressTips.js
 * Pure domain module — no I/O, no React, no axios.
 *
 * Governs when and what wellness tips are shown after a user logs a weight
 * entry compared to their previous one.
 *
 * Two directions handled:
 *   - GAIN ≥ REVERSE_PROGRESS_THRESHOLD_KG → corrective tips (exercise, diet)
 *   - any LOSS (< 0)                        → food encouragement tips
 *
 * Feature: weight/reverse-progress-tips
 * Owner: weight feature team
 */

/** Any weight gain (> 0 kg) triggers the gain-tip popup — even 100 g. */
export const REVERSE_PROGRESS_THRESHOLD_KG = 0;

/** Tips shown when weight goes UP by ≥ 4 kg — warm coaching tone, action-focused. */
const GAIN_TIPS = [
  "💪 Try a 20-min walk or light jog today — even a gentle stroll helps get things moving again.",
  "🥗 At your next meal, fill half your plate with vegetables and cut rice or roti by half.",
  "� A quick 15-min evening walk after dinner is one of the fastest ways to burn extra calories.",
  "💧 Start tomorrow morning with 2 glasses of water before anything else — it kickstarts metabolism!",
  "🍜 Try replacing one heavy meal today with a light soup, salad, or dal — your body will thank you.",
  "�️ A short 20-min home workout (jumping jacks, squats, push-ups) can turn the day around fast!",
  "😴 Aim to sleep by 10 PM tonight — your body burns fat most efficiently during deep sleep.",
];

/** Tips shown when weight goes DOWN — celebratory, keeps the user motivated. */
const LOSS_TIPS = [
  "🥦 Keep it up! More greens, less fried food — you're already doing all the right things.",
  "🍳 Add a good protein to your next meal — eggs, paneer, dal, or chicken — to keep energy high.",
  "💧 Keep sipping water throughout the day — hydration is a big part of why this is working!",
  "� Try making lunch your biggest meal and keeping dinner light — it really locks in progress.",
  "🧘 A short walk or 10 min of stretching today will make tomorrow's number even better.",
  "🍌 Swap a processed snack for a fruit today — small swaps add up to big results over time.",
  "🌙 Protect your sleep routine — consistent rest keeps hormones balanced and progress steady.",
];

/**
 * Picks exactly `count` random items from `arr` without repeats.
 *
 * @param {string[]} arr
 * @param {number} count
 * @returns {string[]}
 */
function pickRandom(arr, count) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Decides whether to show a tips popup and which tips to show.
 *
 * Tip counts:
 *   - gain  → exactly 1 tip  (focused, not overwhelming when weight went up)
 *   - loss  → 2 or 3 tips    (more encouragement when weight went down)
 *
 * Colors:
 *   - gain  → 'warning' (yellow — gentle alert, as shown in the app)
 *   - loss  → 'success' (green  — celebrate the user)
 *
 * @param {number} changeKg - Weight change in kg (today − yesterday).
 *                            Positive = gained weight. Negative = lost weight.
 * @returns {{ direction: 'gain'|'loss', color: 'warning'|'success', tips: string[] } | null}
 */
export function selectTips(changeKg) {
  if (!Number.isFinite(changeKg)) return null;

  // Any positive gain — even 100 g — triggers 1 focused coaching tip
  if (changeKg > 0) {
    return { direction: "gain", color: "warning", tips: pickRandom(GAIN_TIPS, 1) };
  }

  // Any loss — 2 or 3 tips to keep momentum going
  if (changeKg < 0) {
    const count = Math.random() < 0.5 ? 2 : 3;
    return { direction: "loss", color: "success", tips: pickRandom(LOSS_TIPS, count) };
  }

  // Exactly 0 kg change: no popup
  return null;
}
