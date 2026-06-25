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

// ─────────────────────────────────────────────────────────────────────────────
// LAP roles (v2 — discipline engine)
// ─────────────────────────────────────────────────────────────────────────────

export const LAP_ROLES = Object.freeze({
  CAPTAIN:            'captain',
  ASSISTANT_CAPTAIN:  'assistant_captain',
  MEMBER:             'member',
});

export const DISCIPLINE_STATUS = Object.freeze({
  ELIGIBLE:  'eligible',   // uploaded within discipline window today
  MISSED:    'missed',     // did not upload within window (may have uploaded outside)
  NO_UPLOAD: 'no_upload',  // no weight record at all today
});

// ─────────────────────────────────────────────────────────────────────────────
// Discipline window helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether a weight upload falls within the admin-configured discipline window.
 *
 * Both times are in IST (UTC+5:30).  The DB stores CreatedAt as a plain IST string
 * "YYYY-MM-DD HH:MM:SS" so we only need to compare the time component.
 *
 * Supabase REST API returns timestamp columns in ISO 8601 format with a "T" separator
 * ("YYYY-MM-DDTHH:MM:SS") even though the DB stores them with a space.  This function
 * normalises both formats before extracting the time component.
 *
 * @param {string} istCreatedAt  — "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" or "HH:MM:SS"
 * @param {string} startHHMM     — "03:00"
 * @param {string} endHHMM       — "07:30"
 * @returns {boolean}
 */
export function isWithinDisciplineWindow(istCreatedAt, startHHMM, endHHMM) {
  if (!istCreatedAt || !startHHMM || !endHHMM) return false;
  // Normalise: replace ISO 8601 "T" separator with a space so both
  // "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" are handled identically.
  const normalised = String(istCreatedAt).replace('T', ' ');
  const timePart = normalised.includes(' ') ? normalised.split(' ')[1] : normalised;
  const [th, tm]  = timePart.split(':').map(Number);
  const [sh, sm]  = startHHMM.split(':').map(Number);
  const [eh, em]  = endHHMM.split(':').map(Number);
  const t = th * 60 + tm;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return t >= s && t <= e;
}

/**
 * Classify a participant's discipline status for the day.
 *
 * @param {string|null} disciplineWindowWeight — non-null means they uploaded within the window
 * @param {string|null} anyTodayWeight         — non-null means they uploaded today at all
 * @returns {'eligible'|'missed'|'no_upload'}
 */
export function classifyDisciplineStatus(disciplineWindowWeight, anyTodayWeight) {
  if (disciplineWindowWeight != null) return DISCIPLINE_STATUS.ELIGIBLE;
  if (anyTodayWeight != null)         return DISCIPLINE_STATUS.MISSED;
  return DISCIPLINE_STATUS.NO_UPLOAD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corrected leader formulas (v2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Day Leader change (v2 formula):
 *   prevDayClosingWeight − todayDisciplineWeight
 * Negative = loss (wins).  Returns null if either value missing.
 *
 * @param {number|null} todayDisciplineWeight
 * @param {number|null} prevDayClosingWeight
 * @returns {number|null}
 */
export function computeDayChange(todayDisciplineWeight, prevDayClosingWeight) {
  if (todayDisciplineWeight == null || prevDayClosingWeight == null) return null;
  return parseFloat((todayDisciplineWeight - prevDayClosingWeight).toFixed(2));
}

/**
 * Compute Lap / Community Leader change (v2 formula):
 *   todayDisciplineWeight − baselineWeight
 * Negative = loss (wins).  Returns null if either value missing.
 *
 * @param {number|null} todayDisciplineWeight
 * @param {number|null} baselineWeight
 * @returns {number|null}
 */
export function computeLapChange(todayDisciplineWeight, baselineWeight) {
  if (todayDisciplineWeight == null || baselineWeight == null) return null;
  return parseFloat((todayDisciplineWeight - baselineWeight).toFixed(2));
}

/**
 * Find the Day Leader from eligible participants.
 * Only participants with disciplineStatus === 'eligible' are considered.
 * Largest loss (most negative dayChange) wins.  Tie-break: lower userId.
 *
 * @param {Array<{ userId, dayChange, disciplineStatus }>} participants
 * @returns {object|null}
 */
export function findDayLeaderV2(participants) {
  const eligible = participants.filter(
    p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE && p.dayChange != null && p.dayChange < 0,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, p) => {
    if (p.dayChange < best.dayChange) return p;
    if (p.dayChange === best.dayChange && p.userId < best.userId) return p;
    return best;
  });
}

/**
 * Find the Lap Leader from eligible participants.
 * Uses lapChange (baseline → today discipline weight).
 *
 * @param {Array<{ userId, lapChange, disciplineStatus }>} participants
 * @returns {object|null}
 */
export function findLapLeaderV2(participants) {
  const eligible = participants.filter(
    p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE && p.lapChange != null && p.lapChange < 0,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, p) => {
    if (p.lapChange < best.lapChange) return p;
    if (p.lapChange === best.lapChange && p.userId < best.userId) return p;
    return best;
  });
}

/**
 * Find the Community Leader across all eligible participants (may span multiple LAPs/marathons).
 * Uses cumulativeChange (baseline → today discipline weight) — same formula as lap.
 *
 * @param {Array<{ userId, cumulativeChange, disciplineStatus, marathonId? }>} allParticipants
 * @returns {object|null}
 */
export function findCommunityLeader(allParticipants) {
  const eligible = allParticipants.filter(
    p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE
      && p.cumulativeChange != null
      && p.cumulativeChange < 0,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, p) => {
    if (p.cumulativeChange < best.cumulativeChange) return p;
    if (p.cumulativeChange === best.cumulativeChange && p.userId < best.userId) return p;
    return best;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Team name sequencing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the display name for a marathon given its base team name and lap sequence.
 * "Power Burners" + lapSequence 3 → "Power Burners - LAP 3"
 * If no teamName, falls back to the stored marathon name.
 *
 * @param {string|null} teamName
 * @param {number}      lapSequence — 1-indexed
 * @param {string}      fallbackName
 * @returns {string}
 */
export function buildMarathonDisplayName(teamName, lapSequence, fallbackName) {
  if (!teamName) return fallbackName;
  return `${teamName} - LAP ${lapSequence}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marathon cycle scheduling (Herbalife: 2 per month)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the current marathon cycle's start date and length (IST).
 *
 * Two cycles per calendar month:
 *   Cycle A: 1st  → 14th  (14 days)
 *   Cycle B: 15th → end   (variable: 13–16 days depending on month)
 *
 * @param {Date} [now] — injectable clock; pass an IST-shifted Date for IST semantics
 * @returns {{ startedAt: string, daysPerLap: number }}
 *   startedAt — "YYYY-MM-DD" of cycle start
 *   daysPerLap — number of days in this cycle
 */
export function computeMarathonCycle(now = new Date()) {
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const day   = now.getUTCDate();

  let startDay, endDay;
  if (day <= 14) {
    startDay = 1;
    endDay   = 14;
  } else {
    startDay = 15;
    // Last day of this month
    endDay   = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  const mm      = String(month + 1).padStart(2, '0');
  const ddStart = String(startDay).padStart(2, '0');
  return {
    startedAt:  `${year}-${mm}-${ddStart}`,
    daysPerLap: endDay - startDay + 1,
  };
}

/**
 * Build a normalised team name from coach and optional co-coach display names.
 * UPPERCASE, letters and digits only, no spaces.
 *
 * @param {string} coachName
 * @param {string|null} [coCoachName]
 * @returns {string}
 */
export function buildTeamName(coachName, coCoachName = null) {
  const sanitise = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = sanitise(coachName);
  if (!coCoachName) return base;
  return base + sanitise(coCoachName);
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligible participant filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter participants to only those with ELIGIBLE discipline status.
 *
 * @param {Array<{ disciplineStatus: string }>} participants
 * @returns {Array}
 */
export function filterEligible(participants) {
  return participants.filter(p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE);
}
