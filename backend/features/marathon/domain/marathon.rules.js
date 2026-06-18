/**
 * marathon.rules.js — Pure business logic for the Marathon Recognition Engine.
 *
 * No I/O. No imports from axios, pg, supabase, react, or process.env.
 * Inject a clock (now) for all date-sensitive functions so tests remain deterministic.
 */

export const SHARE_TTL_DAYS = 7;

export const CARD_TYPES = Object.freeze({
  TEAM:              'team',
  DAY_LEADER:        'day_leader',
  LAP_LEADER:        'lap_leader',
  COMMUNITY_LEADER:  'community_leader',
});

export const MARATHON_STATUS = Object.freeze({
  ACTIVE:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

// ─────────────────────────────────────────────────────────────────────────────
// Lap & day position
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the current lap number and day-within-lap for a marathon.
 *
 * Uses UTC-normalised day counts to avoid DST/timezone drift; callers should
 * pass an IST-shifted `now` if they want IST-based "today" semantics.
 *
 * @param {string|Date} startedAt  — marathon start date (time component ignored)
 * @param {number}      daysPerLap
 * @param {Date}        [now]      — injectable clock; defaults to new Date()
 * @returns {{ lapNumber: number, dayNumber: number, totalDaysElapsed: number }}
 */
export function computeLapAndDay(startedAt, daysPerLap, now = new Date()) {
  const start   = new Date(startedAt);
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMs   = Date.UTC(now.getFullYear(),   now.getMonth(),   now.getDate());
  const totalDaysElapsed = Math.max(0, Math.floor((nowMs - startMs) / 86_400_000));
  const lapNumber        = Math.floor(totalDaysElapsed / daysPerLap) + 1;
  const dayNumber        = (totalDaysElapsed % daysPerLap) + 1;
  return { lapNumber, dayNumber, totalDaysElapsed };
}

/**
 * Return the calendar start date (inclusive) for a given 1-indexed lap number.
 *
 * @param {string|Date} startedAt
 * @param {number}      daysPerLap
 * @param {number}      lapNumber  — 1-indexed
 * @returns {Date}
 */
export function lapStartDate(startedAt, daysPerLap, lapNumber) {
  const d = new Date(startedAt);
  d.setUTCDate(d.getUTCDate() + (lapNumber - 1) * daysPerLap);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight change calculations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a weight delta between two readings.
 * Convention (matches the reference cards): **negative = loss, positive = gain**.
 *
 * @param {number|null} currentWeight
 * @param {number|null} referenceWeight
 * @returns {number|null} delta in kg rounded to 2 dp, or null if either value missing
 */
export function computeWeightChange(currentWeight, referenceWeight) {
  if (currentWeight == null || referenceWeight == null) return null;
  return parseFloat((currentWeight - referenceWeight).toFixed(2));
}

/**
 * Convert a kg change to an integer grams value for the team-grid display.
 * Negative grams = weight loss.
 *
 * @param {number|null} changeKg
 * @returns {number|null}
 */
export function changeToGrams(changeKg) {
  if (changeKg == null) return null;
  return Math.round(changeKg * 1000);
}

/**
 * Format a weight change for card display text.
 *   -0.7  → "-0.70 KG"
 *    0.3  → "+0.30 KG"
 *    0    → "0.00 KG"
 *   null  → "—"
 *
 * @param {number|null} changeKg
 * @returns {string}
 */
export function formatWeightChange(changeKg) {
  if (changeKg == null) return '—';
  const abs  = Math.abs(changeKg);
  const sign = changeKg < 0 ? '-' : changeKg > 0 ? '+' : '';
  return `${sign}${abs.toFixed(2)} KG`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leader selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the Day Leader — participant with the largest weight loss today.
 * "Largest loss" = most negative `dailyChange`.
 * Ties broken by lower userId (earlier registration).
 *
 * @param {Array<{ userId: number, dailyChange: number|null, [key: string]: any }>} participants
 * @returns {object|null}
 */
export function findDayLeader(participants) {
  const eligible = participants.filter(p => p.dailyChange != null && p.dailyChange < 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, p) => {
    if (p.dailyChange < best.dailyChange) return p;
    if (p.dailyChange === best.dailyChange && p.userId < best.userId) return p;
    return best;
  });
}

/**
 * Find the Lap Leader — participant with the largest total loss this lap.
 * "Largest loss" = most negative `lapChange`.
 *
 * @param {Array<{ userId: number, lapChange: number|null, [key: string]: any }>} participants
 * @returns {object|null}
 */
export function findLapLeader(participants) {
  const eligible = participants.filter(p => p.lapChange != null && p.lapChange < 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, p) => {
    if (p.lapChange < best.lapChange) return p;
    if (p.lapChange === best.lapChange && p.userId < best.userId) return p;
    return best;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Share token
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether a share card's token is still valid.
 *
 * @param {string|Date} shareExpiresAt
 * @param {Date}        [now]
 * @returns {boolean}
 */
export function isShareValid(shareExpiresAt, now = new Date()) {
  if (!shareExpiresAt) return false;
  return new Date(shareExpiresAt) > now;
}

/**
 * Build the JSONB snapshot stored in `marathon_share_cards.card_data`.
 * The snapshot makes the public-share page independent of live data after expiry.
 *
 * @param {string} cardType — one of CARD_TYPES
 * @param {object} liveData — computed payload from the repo
 * @returns {object}
 */
export function buildCardSnapshot(cardType, liveData) {
  return { cardType, generatedAt: new Date().toISOString(), ...liveData };
}

// ─────────────────────────────────────────────────────────────────────────────
// Team total
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sum the daily weight changes for a team card footer.
 * Includes all participants regardless of sign (gains count against totals).
 *
 * @param {Array<{ dailyChange: number|null }>} participants
 * @returns {number} kg, 2 dp
 */
export function computeTeamDailyTotal(participants) {
  const total = participants.reduce((sum, p) => sum + (p.dailyChange ?? 0), 0);
  return parseFloat(total.toFixed(2));
}
